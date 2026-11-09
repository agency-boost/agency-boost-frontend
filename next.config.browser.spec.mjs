import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUIDES_DIRECTORY, guideHeaders } from './next.config.mjs';

/**
 * **The guides run as written under their own policy, and reach nothing of the app's — asked of a real browser**
 * (P19.6-T5 AC-5, Panduan-AC5; ADR-0219 §3).
 *
 * jsdom honours no Content-Security-Policy, so this asks Chrome. A local server stands in for the app's host: its own
 * page sets a cookie and a `localStorage` entry, as a signed-in page holds its state, and it serves each public guide
 * at its path **with the headers `next.config.mjs` writes for it**. Opened at its role's fragment:
 *
 * - **its inline scripts ran** — they build the role cards from the guide's data and open the fragment's role alone —
 *   and **its styles applied**, the two blocks and the one style attribute: the hashes match the file;
 * - **its origin is opaque** (`sandbox`), so the app's cookie and storage are refused it on the app's own host;
 * - **no Content-Security-Policy violation is reported** while it loads.
 *
 * **The control**: the same file under the same policy with its script hashes taken out builds nothing, so a pass above
 * is not a page that would have run under any policy.
 *
 * **Skipped where no Chrome is installed** (`CHROME_PATH`, or the usual places on macOS and Linux), as T2's frame check.
 * Google's font files may not load without a network; nothing here depends on them.
 */
const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((path) => !!path && existsSync(path));

const SECRET = 'agencyboost-secret-value';
const POLICIES = Object.fromEntries(guideHeaders().map((e) => [e.source, e.headers[0].value]));
/** The guide's policy with every script hash removed: what a stale hash would do to it. */
const withoutScripts = (policy) => policy.replace(/script-src [^;]+/, "script-src 'none'");

/** The app's own page, holding the state a guide must not reach. */
const APP_PAGE = `<!doctype html><html><head><title>${SECRET}</title></head><body>
<script>localStorage.setItem('agencyboost.session', '${SECRET}');</script></body></html>`;

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const guide = /^\/(control\/)?panduan\/([a-z-]+\.html)$/.exec(url.pathname);
    if (guide) {
      const policy = POLICIES[`/panduan/${guide[2]}`];
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': guide[1] ? withoutScripts(policy) : policy,
      });
      res.end(readFileSync(join(GUIDES_DIRECTORY, guide[2])));
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': `agencyboost_refresh=${SECRET}; Path=/` });
      res.end(APP_PAGE);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** One page of the browser, driven over the DevTools protocol with Node's own WebSocket. */
class Tab {
  next = 0;
  waiting = new Map();
  logged = [];

  constructor(socket) {
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) this.waiting.get(message.id)?.(message.result);
      if (message.method === 'Log.entryAdded') this.logged.push(message.params.entry.text);
      if (message.method === 'Runtime.consoleAPICalled') this.logged.push(message.params.args.map((a) => a.value).join(' '));
      if (message.method === 'Runtime.exceptionThrown') this.logged.push(message.params.exceptionDetails.text);
    });
  }

  static async open(devtools) {
    const target = await (await fetch(`${devtools}/json/new?about:blank`, { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Tab(socket);
  }

  send(method, params = {}) {
    const id = ++this.next;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const answer = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    return answer.result.value;
  }
}

describe.skipIf(!CHROME)('P19.6-T5 AC-5 the guides under their own policy, in a real browser (ADR-0219 §3)', () => {
  let chrome;
  let profile;
  let server;
  let origin;
  let tab;

  beforeAll(async () => {
    server = await serve();
    origin = `http://127.0.0.1:${server.address().port}`;
    profile = mkdtempSync(join(tmpdir(), 'ab-guides-'));
    chrome = spawn(CHROME, [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
      '--no-default-browser-check', '--disable-gpu', '--no-sandbox', '--remote-allow-origins=*', 'about:blank',
    ]);
    const devtools = await new Promise((resolve, reject) => {
      let said = '';
      chrome.stderr.on('data', (chunk) => {
        said += chunk.toString();
        const found = /DevTools listening on ws:\/\/([^/]+)\//.exec(said);
        if (found) resolve(`http://${found[1]}`);
      });
      chrome.once('exit', () => reject(new Error(`Chrome exited: ${said}`)));
    });
    tab = await Tab.open(devtools);
    await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable'].map((m) => tab.send(m)));
    // The app's state, on the same host the guides are served from.
    await tab.send('Page.navigate', { url: `${origin}/` });
    await waitFor(`document.readyState === "complete" && localStorage.getItem('agencyboost.session') === '${SECRET}'`);
  }, process.env.CI ? 120_000 : 30_000); // Chrome's cold start on a runner

  afterAll(async () => {
    tab?.socket.close();
    if (chrome && chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once('exit', resolve));
      chrome.kill();
      await exited;
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    if (profile) rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  async function waitFor(expression) {
    for (let tries = 0; tries < 100; tries += 1) {
      if (await tab.evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Never true: ${expression}`);
  }

  /** Open a guide at a fragment, and read what its page became. */
  async function open(path) {
    // A fresh document each time, as a new tab opens one: from one fragment to another of the same file is no load.
    await tab.send('Page.navigate', { url: 'about:blank' });
    await waitFor('location.href === "about:blank"');
    tab.logged = [];
    await tab.send('Page.navigate', { url: `${origin}${path}` });
    await waitFor('document.readyState === "complete"');
    await new Promise((resolve) => setTimeout(resolve, 300));
    return tab.evaluate(`(() => {
      const read = (f) => { try { return String(f()); } catch (e) { return 'refused:' + e.name; } };
      const roles = [...document.querySelectorAll('#roles .role')];
      const said = document.querySelector('h2[style]');
      return {
        origin: self.origin,
        cookie: read(() => document.cookie),
        storage: read(() => localStorage.getItem('agencyboost.session')),
        roles: roles.map((r) => r.id),
        shown: roles.filter((r) => r.style.display !== 'none').map((r) => r.id),
        basics: document.querySelectorAll('#basics .basic').length,
        headerStyled: getComputedStyle(document.querySelector('header.top')).backgroundColor !== 'rgba(0, 0, 0, 0)',
        attributeStyled: said ? getComputedStyle(said).marginTop : null,
      };
    })()`);
  }

  const violations = () => tab.logged.filter((text) => /Content Security Policy/i.test(text ?? ''));

  it.each([
    ['/panduan/agent-leader.html#agent', ['agent', 'leader'], 'agent'],
    ['/panduan/agent-leader.html#leader', ['agent', 'leader'], 'leader'],
    ['/panduan/kpm-owner-admin.html#owner', ['owner', 'admin'], 'owner'],
    ['/panduan/kpm-owner-admin.html#admin', ['owner', 'admin'], 'admin'],
  ])('Panduan-AC5 P19.6-T5 AC-5 %s runs as written, opens its role, and reaches no state of the app', async (path, roles, role) => {
    const page = await open(path);
    expect(page.roles.sort()).toEqual([...roles].sort());
    expect(page.shown).toEqual([role]);
    expect(page.basics).toBe(4);
    expect(page.headerStyled).toBe(true);
    expect(page.attributeStyled).toBe('28px');
    expect(page.origin).toBe('null');
    expect(page.cookie).toMatch(/^(refused:SecurityError|)$/);
    expect(page.storage).toBe('refused:SecurityError');
    expect(violations()).toEqual([]);
  }, 30_000);

  it('P19.6-T5 AC-5 the role buttons still choose the role inside the sandbox, and the address follows, as delivered', async () => {
    await open('/panduan/agent-leader.html#agent');
    const after = await tab.evaluate(`(() => {
      document.querySelector('#picker button[data-role="leader"]').click();
      return {
        shown: [...document.querySelectorAll('#roles .role')].filter((r) => r.style.display !== 'none').map((r) => r.id),
        pressed: document.querySelector('#picker button[data-role="leader"]').getAttribute('aria-pressed'),
        hash: location.hash,
      };
    })()`);
    expect(after.shown).toEqual(['leader']);
    expect(after.pressed).toBe('true');
    // The guide's own `history.replaceState` of the fragment is allowed an opaque origin: the address follows the role.
    expect(after.hash).toBe('#leader');
    expect(violations()).toEqual([]);
  }, 30_000);

  it('P19.6-T5 AC-5 the control: the same guide without its script hashes builds nothing, and the browser says why', async () => {
    const page = await open('/control/panduan/agent-leader.html#leader');
    expect(page.roles).toEqual([]);
    expect(page.basics).toBe(0);
    expect(violations().length).toBeGreaterThan(0);
  }, 30_000);
});
