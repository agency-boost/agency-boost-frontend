import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { build, type Rollup } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHROME, startBrowser, type Tab } from '@test/chrome-page';

/**
 * **A PDF the app saves arrives whole, in a real Chrome** (the P19.30 browser walk, 2026-11-23). In headless Chrome
 * *Akun & password*'s *Unduh PDF* and the KPM report's ended `canceled`, 0 bytes, while the API had answered the file and
 * the toast said it was downloaded — and the passwords had been issued again. jsdom downloads nothing, so this asks
 * Chrome, with the **components themselves**: `test/download-harness.tsx` bundled by Vite with the app's aliases, run
 * against a `fetch` stubbed in the page, and clicked with real mouse events (`Input.dispatchMouseEvent`), so a download
 * the click starts is part of a user gesture as a reader's is.
 *
 * - ***Akun & password*** — two steps: *Buat PDF* issues once and holds the file; *Unduh PDF* saves it in the click, and
 *   again on a second click, the same bytes and nothing issued again.
 * - **The KPM report** — *Unduh PDF* fetches, then saves after the `await`: what `saveFile` (the link in the page, the
 *   URL kept a minute) has to carry.
 *
 * Each **completes** (`Browser.downloadProgress`, `state: 'completed'`), its file on disk the PDF's size, at 375 and 1280.
 * **Skipped where no Chrome is installed** (`CHROME`).
 */
const PDF = `%PDF-1.3\n${'% padding so the file has a size worth checking\n'.repeat(40)}%%EOF\n`;
const PREVIEW = { count: 4, kpmName: 'PruDynamic', fileName: 'Akun-password-PruDynamic-2026-11-23.pdf' };

/** The page's `fetch`: the preview's JSON, and the PDF for the two routes that answer one. Counts what is asked. */
const FETCH_STUB = `
window.process = window.process || { env: {} };
window.calls = [];
window.fetch = async (input, init) => {
  const url = String(input);
  const method = (init && init.method) || 'GET';
  window.calls.push(method + ' ' + url.replace(/^.*\\/api\\/v1/, ''));
  if (url.includes('/members/temporary-passwords/preview')) {
    return new Response(JSON.stringify(${JSON.stringify(PREVIEW)}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/members/temporary-passwords') || url.includes('/report?month=')) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return new Response(new Blob([${JSON.stringify(PDF)}], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf' } });
  }
  return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
};`;

/** The harness, bundled once: React, the two dialogs and everything they import, as one script. */
async function bundle(): Promise<string> {
  const root = process.cwd();
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    root,
    plugins: [react()],
    resolve: { alias: { '@': join(root, 'src'), '@test': join(root, 'test') } },
    define: {
      // Under vitest the React plugin compiles JSX for React's development runtime (`jsxDEV`), so React's own is that.
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.NEXT_PUBLIC_API_ORIGIN': JSON.stringify('http://api.test'),
      'process.env.NEXT_PUBLIC_APP_ENV': JSON.stringify('development'),
    },
    build: {
      write: false,
      minify: false,
      emptyOutDir: false,
      lib: { entry: join(root, 'test/download-harness.tsx'), formats: ['iife'], name: 'downloadHarness', fileName: () => 'harness.js' },
    },
  }) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const first = (Array.isArray(output) ? output[0] : output).output.find((chunk) => chunk.type === 'chunk') as Rollup.OutputChunk;
  return first.code;
}

describe.skipIf(!CHROME)('saving a PDF in a real Chrome (P19.30, the 2026-11-23 browser walk)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;
  let script = '';
  let folder = '';

  beforeAll(async () => {
    script = await bundle();
    browser = await startBrowser();
  }, 120_000);

  afterAll(async () => {
    await browser?.stop();
    if (folder) rmSync(folder, { recursive: true, force: true });
  });

  /** Downloads into a fresh folder, every one reported: what each came to, by its name. */
  async function downloadsInto(tab: Tab) {
    folder = mkdtempSync(join(tmpdir(), 'ab-downloads-'));
    const states = new Map<string, { name: string; state: string; bytes: number }>();
    tab.on<{ guid: string; suggestedFilename: string }>('Browser.downloadWillBegin', ({ guid, suggestedFilename }) => {
      states.set(guid, { name: suggestedFilename, state: 'started', bytes: 0 });
    });
    tab.on<{ guid: string; state: string; receivedBytes: number }>('Browser.downloadProgress', ({ guid, state, receivedBytes }) => {
      const now = states.get(guid);
      if (now) states.set(guid, { ...now, state, bytes: receivedBytes });
    });
    await tab.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: folder, eventsEnabled: true });
    return states;
  }

  /**
   * A real click on the element `selector` finds — the mouse pressed and let go at its centre, once the element is live
   * and has stopped moving (a sheet slides up from the foot of a phone's screen).
   */
  async function click(tab: Tab, selector: string) {
    const where = `(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el || el.disabled) return null; const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`;
    let last = '';
    for (let tries = 0; tries < 100; tries += 1) {
      const now = await tab.evaluate<string | null>(where);
      if (now && now === last) break;
      last = now ?? '';
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    if (!last) throw new Error(`Nothing to click: ${selector}`);
    const at = JSON.parse(last) as { x: number; y: number };
    for (const type of ['mousePressed', 'mouseReleased']) {
      await tab.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    }
  }

  /** Asks the page until `expression` is something, for at most five seconds. */
  async function waitFor<T>(tab: Tab, expression: string): Promise<T> {
    for (let tries = 0; tries < 100; tries += 1) {
      const value = await tab.evaluate<T | null>(expression);
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Never true: ${expression}`);
  }

  /** Every download finished, each `completed` with the PDF's bytes, on disk under its name. */
  async function finished(states: Map<string, { name: string; state: string; bytes: number }>, count: number) {
    for (let tries = 0; tries < 100; tries += 1) {
      const all = [...states.values()];
      if (all.length >= count && all.every((d) => d.state !== 'started' && d.state !== 'inProgress')) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return [...states.values()];
  }

  async function page(which: 'temporary' | 'report', width: number) {
    await browser.show(`<!doctype html><html lang="id"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1"><title>downloads</title></head>
      <body><div id="root"></div><script>${FETCH_STUB}</script><script>${script.replace(/<\/script/gi, '<\\/script')}</script>
      <script>window.mountDialog(${JSON.stringify(which)});</script></body></html>`, width);
  }

  it.each([375, 1280])('Akun & password at %ipx: Buat PDF issues once; Unduh PDF saves the whole file, twice, nothing issued again', async (width) => {
    const { tab } = browser;
    const states = await downloadsInto(tab);
    await page('temporary', width);

    // Step 1: made and held — the toast says it is ready, nothing is saved yet.
    await click(tab, '[data-temporary-passwords-actions] button:last-child');
    await waitFor(tab, `!!document.querySelector('[data-temporary-passwords="ready"]')`);
    expect(states.size).toBe(0);

    // Step 2: saved in the click, and again.
    await click(tab, '[data-temporary-passwords-actions] button:last-child');
    expect(await finished(states, 1)).toEqual([{ name: PREVIEW.fileName, state: 'completed', bytes: PDF.length }]);
    await click(tab, '[data-temporary-passwords-actions] button:last-child');
    const both = await finished(states, 2);
    expect(both.map((d) => [d.state, d.bytes])).toEqual([['completed', PDF.length], ['completed', PDF.length]]);

    // On disk, whole: no partial file left behind.
    const files = readdirSync(folder);
    expect(files.some((f) => f.endsWith('.crdownload'))).toBe(false);
    for (const file of files) expect(statSync(join(folder, file)).size).toBe(PDF.length);
    expect(existsSync(join(folder, PREVIEW.fileName))).toBe(true);

    // The passwords were issued once: one POST to the issuing route, whatever the clicks.
    const calls = await tab.evaluate<string[]>('window.calls');
    expect(calls.filter((c) => c === 'POST /members/temporary-passwords')).toHaveLength(1);
  }, 30_000);

  it.each([375, 1280])('the KPM report at %ipx: Unduh PDF fetches, then saves the whole file after the await', async (width) => {
    const { tab } = browser;
    const states = await downloadsInto(tab);
    await page('report', width);

    await click(tab, '[data-kpm-report-actions] button:last-child');
    const [download] = await finished(states, 1);
    expect(download).toMatchObject({ state: 'completed', bytes: PDF.length });
    expect(download.name).toMatch(/^Laporan-KPM-BSD-City-Branch-\d{4}-\d{2}\.pdf$/);
    expect(statSync(join(folder, download.name)).size).toBe(PDF.length);
  }, 30_000);
});
