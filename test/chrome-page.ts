import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../tailwind.config';

/**
 * **A component's markup, drawn by a real Chrome with the app's own stylesheet** (P19.9-T5 AC-2; 2026-11-08) — for a
 * `*.browser.spec.ts` that measures what jsdom cannot: a height, a computed colour, what is under a point.
 *
 * The markup is the component's own (`react-dom/server`), the stylesheet `globals.css` compiled by the real Tailwind
 * config over exactly that markup, and the page served from a local server — no Next, no dev server, no port of the
 * app's. Chrome is driven over the DevTools protocol with Node's own WebSocket, as `sandboxed-document.browser.spec.ts`
 * drives it. **`CHROME` is undefined where none is installed**, and the spec skips (`describe.skipIf(!CHROME)`).
 */
export const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((path): path is string => !!path && existsSync(path));

/**
 * **A whole page for `markup`**: `globals.css` — the tokens and the Tailwind layers — compiled by the real config for the
 * classes the page wears and nothing else, and the markup in a body of the page's ground.
 */
export async function pageFor(markup: string): Promise<string> {
  const body = `<body class="bg-base">${markup}</body>`;
  const source = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');
  const { css } = await postcss([
    tailwindcss({ ...config, content: [{ raw: body, extension: 'html' }] }),
  ]).process(source, { from: undefined });
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>browser spec</title><style>${css}</style></head>
${body}</html>`;
}

/** A page of the browser, driven over the DevTools protocol. */
export class Tab {
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

/**
 * **One Chrome, one local server, one tab**: `show(html, width)` loads a page at a width — a phone's below 768px — and
 * resolves once it has loaded; `stop()` closes all three.
 */
export async function startBrowser(): Promise<{
  tab: Tab;
  show: (html: string, width: number, height?: number) => Promise<void>;
  stop: () => Promise<void>;
}> {
  let page = '<!doctype html><title>blank</title>';
  const server: Server = await new Promise((resolve) => {
    const s = createServer((req, res) => {
      // The app's own font (`public/fonts/`), so a width is measured in the face the app draws.
      const font = /^\/fonts\/[\w.-]+\.woff2$/.exec(req.url ?? '');
      if (font && existsSync(join(process.cwd(), 'public', font[0]))) {
        res.writeHead(200, { 'Content-Type': 'font/woff2' });
        res.end(readFileSync(join(process.cwd(), 'public', font[0])));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const profile = mkdtempSync(join(tmpdir(), 'ab-browser-'));
  const chrome: ChildProcess = spawn(CHROME!, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
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
  const tab = await Tab.open(devtools);
  await tab.send('Page.enable');
  await tab.send('Runtime.enable');

  let visit = 0;
  const show = async (html: string, width: number, height = 812) => {
    page = html;
    visit += 1;
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await tab.send('Page.navigate', { url: `${origin}/${visit}` });
    for (let tries = 0; tries < 100; tries += 1) {
      if (await tab.evaluate<boolean>(`document.readyState === "complete" && location.pathname === "/${visit}" && document.fonts.status === "loaded"`)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`The page did not load at ${width}px.`);
  };

  const stop = async () => {
    tab.close();
    if (chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once('exit', resolve));
      chrome.kill();
      await exited;
    }
    await new Promise((resolve) => server.close(resolve));
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };

  return { tab, show, stop };
}
