'use client';

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { openPdf, type DrawnPage, type OpenedPdf } from '@/lib/pdf-pages';

/** The backing store's density over the screen's: twice the device's, at most three — sharp when pinched to zoom. */
const sharpness = () => Math.min(3, (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1) * 2);

/** A blob's bytes, wherever `Blob.arrayBuffer` is missing. */
const bytesOf = (file: Blob): Promise<ArrayBuffer> =>
  typeof file.arrayBuffer === 'function' ? file.arrayBuffer() : new Response(file).arrayBuffer();

/** An A4-shaped wait, as the shell's skeletons are shaped like what is coming. */
export function A4Placeholder({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => <div key={i} className="aspect-[210/297] w-full rounded-md bg-card" />)}
      </div>
    </Skeleton>
  );
}

/**
 * **The PDF's pages themselves** (P19.7-T3 AC-1; Acc. 15; ADR-0222 §4): each page of the very file the API built, A4
 * at the width of the screen, drawn denser than the screen so a pinch to zoom stays sharp — the page itself allows the
 * pinch (the viewport sets no maximum scale). Each page is an image named *Halaman n dari N*, with its words beside it
 * for a screen reader (WCAG 1.1.1). Nothing here fetches: `file` is the blob the step holds, the same one *Simpan PDF*
 * saves.
 */
export function PdfPages({ file, onFailed }: { file: Blob; onFailed: () => void }) {
  const t = useMessages(proposalMessages).pdf;
  const box = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [opened, setOpened] = useState<OpenedPdf | null>(null);
  const [drawn, setDrawn] = useState<DrawnPage[] | null>(null);
  const failed = useRef(onFailed);
  failed.current = onFailed;

  useEffect(() => {
    let live = true;
    let held: OpenedPdf | null = null;
    setOpened(null);
    setDrawn(null);
    bytesOf(file)
      .then(openPdf)
      .then((pdf) => {
        if (!live) return pdf.close();
        held = pdf;
        setOpened(pdf);
      })
      .catch(() => { if (live) failed.current(); });
    return () => {
      live = false;
      held?.close();
    };
  }, [file]);

  useEffect(() => {
    if (!opened) return;
    let live = true;
    const width = box.current?.clientWidth || 360;
    (async () => {
      const pages: DrawnPage[] = [];
      for (let n = 1; n <= opened.pages; n += 1) {
        const canvas = canvases.current[n - 1];
        if (canvas) pages.push(await opened.draw(n, canvas, width, sharpness()));
      }
      if (live) setDrawn(pages);
    })().catch(() => { if (live) failed.current(); });
    return () => { live = false; };
  }, [opened]);

  const count = opened?.pages ?? 0;
  return (
    <div ref={box} data-proposal-pages={count} aria-label={t.pages} role="group" className="flex flex-col gap-3">
      {!drawn && <A4Placeholder label={t.loading} />}
      {Array.from({ length: count }, (_, i) => (
        <figure key={i} className={drawn ? 'm-0' : 'sr-only'}>
          <canvas
            ref={(el) => { canvases.current[i] = el; }}
            role="img"
            aria-label={t.page({ n: i + 1, count })}
            className="block aspect-[210/297] h-auto w-full rounded-md bg-card shadow-bar"
          />
          {drawn?.[i]?.text && <figcaption className="sr-only">{drawn[i].text}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
