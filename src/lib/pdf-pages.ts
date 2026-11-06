'use client';

/**
 * **A PDF's pages, drawn on the device with `pdf.js`** (P19.7-T3 AC-1; ADR-0222 §4, §8): step 3 shows the very bytes the
 * API built, so what the agent sees is what *Simpan PDF* saves.
 *
 * - **Loaded only here**, by a dynamic `import()`: no other screen carries `pdf.js`. **The package's `legacy` build**, which
 *   the library ships for browsers a year or two old — the mid-range Android phone and the older iPhone the agent's daily
 *   loop is budgeted for — where the modern build needs this year's.
 * - **Its worker is the app's own** — bundled from `pdfjs-dist` and served from this origin (`new URL(…, import.meta.url)`),
 *   so no other host is reached and the page's policy needs nothing new. `pdfjs-dist` 6 evaluates no string as code, so
 *   no `unsafe-eval` is asked for (ADR-0222 §8's `isEvalSupported: false` is the library's only behaviour now).
 * - **A copy of the bytes** goes to the worker, which takes what it is handed: the caller's blob stays whole, to be saved.
 */

/** One drawn page: its size at the width asked for, and the words on it for a screen reader. */
export interface DrawnPage { cssWidth: number; cssHeight: number; text: string }

/** An opened file: how many pages it has, a way to draw each, and a way to let it go. */
export interface OpenedPdf {
  pages: number;
  /**
   * Draw page `n` (from 1) on `canvas` at `cssWidth` CSS pixels wide, its backing store `sharpness` times denser — so a
   * pinch to zoom stays sharp. Answers the page's size and its text.
   */
  draw(n: number, canvas: HTMLCanvasElement, cssWidth: number, sharpness: number): Promise<DrawnPage>;
  close(): void;
}

let worker: Worker | null = null;

/** Open a PDF's bytes for drawing. */
export async function openPdf(bytes: ArrayBuffer): Promise<OpenedPdf> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!worker) {
    worker = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
    pdfjs.GlobalWorkerOptions.workerPort = worker;
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) });
  const document = await task.promise;
  return {
    pages: document.numPages,
    async draw(n, canvas, cssWidth, sharpness) {
      const page = await document.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      const scale = cssWidth / natural.width;
      const viewport = page.getViewport({ scale: scale * sharpness });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
      return { cssWidth, cssHeight: natural.height * scale, text };
    },
    close() {
      void task.destroy();
    },
  };
}
