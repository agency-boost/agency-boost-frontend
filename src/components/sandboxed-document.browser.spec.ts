import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FRAME_MIN_HEIGHT_PX } from '@/lib/html-document';
import { SANDBOXED_FRAME } from './sandboxed-document';

/**
 * **What a lesson can reach, asked of a real browser** (P19.6-T2 AC-3, AC-4; ADR-0217 §4).
 *
 * jsdom honours no `sandbox`, so this asks Chrome. Two local servers stand in for the two hosts: **the app**, which sets
 * a cookie and a `localStorage` entry the way a signed-in page holds its state, and **the storage host**, a different
 * origin that serves the probe — a page that tries to read `document.cookie`, `localStorage` and `parent.document`,
 * follows one of its own anchor links, and posts what it found to the page (a sandboxed page may still post a message).
 * The probe is framed with `SANDBOXED_FRAME`'s own attributes, at 375, 768, 1024 and 1280 px.
 *
 * - **From the storage host, sandboxed** — how every lesson is drawn — it reads nothing.
 * - **From the app's own origin, sandboxed** — the case ADR-0217 forbids, kept as the worst one — it still reads
 *   nothing: the frame's opaque origin is what holds, not the host alone.
 * - **From the app's origin, unsandboxed** — the control — it reads all three, so a pass above is not a probe that
 *   could read nothing anywhere.
 *
 * **Skipped where no Chrome is installed** (`CHROME_PATH`, or the usual places on macOS and Linux). GitHub's Ubuntu
 * runner has one.
 */
const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((path): path is string => !!path && existsSync(path));

const WIDTHS = [375, 768, 1024, 1280] as const;
const SECRET = 'agencyboost-secret-value';

/** The lesson stand-in: it reads what it can, follows its own anchor, and says what it found. */
const PROBE = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>probe</title></head>
<body style="margin:0">
<nav><a id="jump" href="#part-3">Bagian 3</a></nav>
<section style="height:1600px">Bagian 1</section>
<section id="part-3" style="height:1600px">Bagian 3</section>
<script>
  var found = { tag: location.search.slice(1) };
  try { found.cookie = document.cookie; } catch (e) { found.cookie = 'refused:' + e.name; }
  try { found.storage = String(localStorage.getItem('agencyboost.session')); } catch (e) { found.storage = 'refused:' + e.name; }
  try { found.parent = String(parent.document.title); } catch (e) { found.parent = 'refused:' + e.name; }
  found.origin = self.origin;
  document.getElementById('jump').click();
  setTimeout(function () {
    found.scrolledInside = window.scrollY > 0;
    found.innerWidth = document.documentElement.clientWidth;
    parent.postMessage(found, '*');
  }, 400);
</script>
</body></html>`;

/**
 * The app's page: its own state, the frames, and what each reports. `all` frames the three probes (AC-3); otherwise
 * the storage host's alone, as a module's page draws one lesson, so nothing else can move the page (AC-4).
 */
const appPage = (storage: string, app: string, all: boolean) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${SECRET}</title></head>
<body style="margin:0">
<main id="main" style="padding:16px">
  <iframe id="storage" title="storage" data-src="${storage}/probe.html?storage-sandboxed" data-sandboxed="1"></iframe>
  ${all ? `<iframe id="app" title="app" data-src="${app}/probe.html?app-sandboxed" data-sandboxed="1"></iframe>
  <iframe id="control" title="control" data-src="${app}/probe.html?app-unsandboxed"></iframe>` : ''}
</main>
<div style="height:2000px"></div>
<script>
  localStorage.setItem('agencyboost.session', '${SECRET}');
  window.__found = {};
  window.addEventListener('message', function (e) { window.__found[e.data.tag] = e.data; });
  var attributes = ${JSON.stringify(SANDBOXED_FRAME)};
  document.querySelectorAll('iframe').forEach(function (frame) {
    if (frame.dataset.sandboxed) {
      frame.setAttribute('sandbox', attributes.sandbox);
      frame.setAttribute('allow', attributes.allow);
      frame.setAttribute('referrerpolicy', attributes.referrerPolicy);
    }
    frame.style.display = 'block';
    frame.style.width = '100%';
    frame.style.height = '${FRAME_MIN_HEIGHT_PX}px';
    frame.style.border = '0';
    frame.src = frame.dataset.src;
  });
</script>
</body></html>`;

function serve(handler: (path: string) => { type: string; body: string; cookie?: string }): Promise<Server> {
  const server = createServer((req, res) => {
    const { type, body, cookie } = handler(new URL(req.url ?? '/', 'http://x').pathname);
    res.writeHead(200, { 'Content-Type': type, ...(cookie ? { 'Set-Cookie': cookie } : {}) });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const originOf = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

/** A page of the browser, driven over the DevTools protocol with Node's own WebSocket. */
class Tab {
  private next = 0;
  private waiting = new Map<number, (value: unknown) => void>();
  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown };
      if (message.id !== undefined) this.waiting.get(message.id)?.(message.result);
    });
  }

  static async open(devtools: string): Promise<Tab> {
    const target = await (await fetch(`${devtools}/json/new?about:blank`, { method: 'PUT' })).json() as { webSocketDebuggerUrl: string };
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Tab(socket);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.next;
    return new Promise<T>((resolve) => {
      this.waiting.set(id, resolve as (value: unknown) => void);
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const answer = await this.send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true });
    return answer.result.value;
  }

  close() {
    this.socket.close();
  }
}

describe.skipIf(!CHROME)('P19.6-T2 a lesson in the sandboxed frame, in a real browser (ADR-0217 §4)', () => {
  let chrome: ChildProcess;
  let profile: string;
  let app: Server;
  let storage: Server;
  let tab: Tab;

  beforeAll(async () => {
    storage = await serve(() => ({ type: 'text/html', body: PROBE }));
    app = await serve((path) => (path === '/probe.html'
      ? { type: 'text/html', body: PROBE }
      : { type: 'text/html', body: appPage(originOf(storage), originOf(app), path !== '/one'), cookie: `agencyboost_refresh=${SECRET}; Path=/` }));
    profile = mkdtempSync(join(tmpdir(), 'ab-sandbox-'));
    chrome = spawn(CHROME!, [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
      '--no-default-browser-check', '--disable-gpu', '--no-sandbox',
      // jsdom's WebSocket names the test page's origin; DevTools refuses an origin it was not told of.
      '--remote-allow-origins=*', 'about:blank',
    ]);
    const devtools = await new Promise<string>((resolve, reject) => {
      let said = '';
      chrome.stderr!.on('data', (chunk: Buffer) => {
        said += chunk.toString();
        const found = /DevTools listening on ws:\/\/([^/]+)\//.exec(said);
        if (found) resolve(`http://${found[1]}`);
      });
      chrome.once('exit', () => reject(new Error(`Chrome exited: ${said}`)));
    });
    tab = await Tab.open(devtools);
    await tab.send('Page.enable');
    await tab.send('Runtime.enable');
  }, 30_000);

  afterAll(async () => {
    tab?.close();
    if (chrome && chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once('exit', resolve));
      chrome.kill();
      await exited;
    }
    await Promise.all([app, storage].map((s) => s && new Promise((resolve) => s.close(resolve))));
    if (profile) rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** Load the app's page at a width, and wait for its probes: the three, or the storage host's alone. */
  async function at(width: number, all = true) {
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await tab.send('Page.navigate', { url: `${originOf(app)}/${all ? '' : 'one'}` });
    const count = all ? 3 : 1;
    for (let tries = 0; tries < 100; tries += 1) {
      const found = await tab.evaluate<Record<string, Record<string, unknown>> | null>(
        `document.readyState === "complete" && window.__found && Object.keys(window.__found).length === ${count} ? window.__found : null`,
      );
      if (found) {
        const page = await tab.evaluate<{ scrollY: number; main: number; frames: number[] }>(`({
          scrollY: window.scrollY,
          main: document.getElementById('main').clientWidth - 32,
          frames: [...document.querySelectorAll('iframe')].map((f) => f.getBoundingClientRect().width),
        })`);
        return { found, page };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`The probes did not report at ${width}px.`);
  }

  it.each(WIDTHS)('P19.6-T2 AC-3 at %ipx a sandboxed lesson reads no cookie, no storage and nothing of the page', async (width) => {
    const { found } = await at(width);
    for (const tag of ['storage-sandboxed', 'app-sandboxed']) {
      const probe = found[tag];
      // Chrome refuses each outright in a frame with no allow-same-origin; an empty answer would do as well.
      expect([tag, probe.cookie]).toEqual([tag, expect.stringMatching(/^(refused:SecurityError|)$/)]);
      expect([tag, probe.storage]).toEqual([tag, 'refused:SecurityError']);
      expect([tag, probe.parent]).toEqual([tag, 'refused:SecurityError']);
      // An opaque origin: on no host at all, so not the app's.
      expect([tag, probe.origin]).toEqual([tag, 'null']);
    }
    // The control proves the probe can read when nothing confines it.
    expect(found['app-unsandboxed']).toMatchObject({
      cookie: expect.stringContaining(SECRET), storage: SECRET, parent: SECRET, origin: originOf(app),
    });
  }, 30_000);

  it.each(WIDTHS)('P19.6-T2 AC-4 at %ipx the frame fills the content width, and the lesson’s anchor scrolls the lesson, not the page', async (width) => {
    const { found, page } = await at(width, false);
    for (const frameWidth of page.frames) expect(Math.round(frameWidth)).toBe(page.main);
    expect(found['storage-sandboxed'].scrolledInside).toBe(true);
    expect(found['storage-sandboxed'].innerWidth).toBeGreaterThan(0);
    expect(page.scrollY).toBe(0);
  }, 30_000);
});
