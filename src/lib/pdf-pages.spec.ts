import { afterEach, describe, expect, it, vi } from 'vitest';

/** `pdf.js`, as far as step 3 uses it: a document of two A4 pages, each rendered onto a canvas. */
const pdfjs = vi.hoisted(() => {
  const rendered: { width: number; height: number; scale: number }[] = [];
  const handed: Uint8Array[] = [];
  const page = (n: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 595.28 * scale, height: 841.89 * scale, scale }),
    render: ({ canvas, viewport }: { canvas: HTMLCanvasElement; viewport: { scale: number } }) => {
      rendered.push({ width: canvas.width, height: canvas.height, scale: viewport.scale });
      return { promise: Promise.resolve() };
    },
    getTextContent: async () => ({
      items: n === 1
        ? [{ str: 'Proposal untuk Bapak/Ibu Rosa', hasEOL: true }, { str: 'Umur 42', hasEOL: false }]
        : [{ str: 'Rincian', hasEOL: false }],
    }),
  });
  const destroy = vi.fn(async () => {});
  return {
    rendered,
    handed,
    destroy,
    GlobalWorkerOptions: { workerPort: null as unknown },
    getDocument: vi.fn(({ data }: { data: Uint8Array }) => {
      handed.push(data);
      return { promise: Promise.resolve({ numPages: 2, getPage: async (n: number) => page(n) }), destroy };
    }),
  };
});
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => pdfjs);

const workers: { url: string; options: unknown }[] = [];
class FakeWorker {
  constructor(url: URL | string, options: unknown) {
    workers.push({ url: String(url), options });
  }
}

/**
 * **P19.7-T3 AC-1 — `pdf.js` on step 3** (ADR-0222 §4, §8): loaded only here, its worker the app's own module, the bytes
 * handed over as a copy so the blob *Simpan PDF* saves stays whole, each page drawn denser than the screen.
 */
describe('openPdf (P19.7-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.7-T3 AC-1 starts one same-origin module worker, and hands pdf.js a copy of the bytes', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { openPdf } = await import('./pdf-pages');
    const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
    const first = await openPdf(bytes);
    await openPdf(bytes);
    expect(workers).toHaveLength(1);
    expect(workers[0].url).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs/);
    expect(workers[0].options).toEqual({ type: 'module' });
    expect(pdfjs.GlobalWorkerOptions.workerPort).toBeInstanceOf(FakeWorker);
    expect(pdfjs.handed[0].buffer).not.toBe(bytes);
    expect([...pdfjs.handed[0]]).toEqual([37, 80, 68, 70]);
    expect(first.pages).toBe(2);
  });

  it('P19.7-T3 AC-1 draws a page A4 at the width asked, its backing store denser, and answers its words', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { openPdf } = await import('./pdf-pages');
    const opened = await openPdf(new ArrayBuffer(4));
    const canvas = document.createElement('canvas');
    const drawn = await opened.draw(1, canvas, 360, 2);
    expect(drawn.cssWidth).toBe(360);
    expect(drawn.cssHeight).toBeCloseTo(360 * (841.89 / 595.28), 3);
    expect(drawn.text).toBe('Proposal untuk Bapak/Ibu Rosa\nUmur 42');
    expect([canvas.width, canvas.height]).toEqual([720, Math.floor(720 * (841.89 / 595.28))]);
    opened.close();
    expect(pdfjs.destroy).toHaveBeenCalled();
  });
});
