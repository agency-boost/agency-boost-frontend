'use client';

import type { ReactNode } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { samplePreviewMessages } from '@/i18n/messages/sample-preview';
import { cn } from '@/lib/cn';
import type { SampleName } from '@/lib/sample-data';

/**
 * ***Contoh*** — **the sample of an empty page** (P19-T4 AC-3; D-37, UI-159 item 3; ADR-0189 §3): under a leader page's
 * normal layout at *0* / *–*, a greyed sample of that same layout — the page's own components fed fictional data
 * (`lib/sample-data.ts`) — labelled *Contoh*, and **one next step** under it.
 *
 * - **It is not data.** The sample is `inert` and hidden from a screen reader (`aria-hidden`), which hears its name
 *   instead (*Contoh tampilan halaman ini setelah ada data. Bukan data sebenarnya.*); nothing in it is focusable,
 *   clickable or counted, and its people are named *Agen contoh 1* (ADR-0189 §3).
 * - **It is greyed**: the layout at reduced opacity in greyscale, so it never reads as the reader's own figures.
 * - **The next step is live**: one button, or — for somebody in no office — the two UI-166 gives (`NoKpmYet`).
 *
 * An explicit client request (D-37, UI-159 item 3), registered in `prototype-parity.md` as an *Improve*.
 */
export function SamplePreview({
  sample, action, message, className,
}: {
  /** The page's own layout with sample props: drawn greyed and inert. */
  sample: ReactNode;
  /** The one next step, live. */
  action?: ReactNode;
  /** A line between the sample and the step (the no-office card's). */
  message?: ReactNode;
  className?: string;
}) {
  const t = useMessages(samplePreviewMessages);
  return (
    <section aria-label={t.sampleName} data-sample-preview="" className={cn('mt-3', className)}>
      <div className="relative overflow-hidden rounded-lg">
        <span
          data-sample-label=""
          className="absolute left-2 top-2 z-10 rounded-pill bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-contrast"
        >
          {t.label}
        </span>
        <div
          aria-hidden="true"
          inert
          data-sample=""
          className="pointer-events-none select-none opacity-50 grayscale"
        >
          {sample}
        </div>
      </div>
      {message && <p className="mt-3 text-center text-md font-semibold text-navy">{message}</p>}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}

/** ***Belum ada data*** (D-37): the short grey line an empty page shows under its normal layout. */
export function NoDataLine({ className }: { className?: string }) {
  const t = useMessages(samplePreviewMessages);
  return <p data-no-data="" className={cn('mt-2 text-md text-muted', className)}>{t.noData}</p>;
}

/** The catalogue's *Agen contoh {n}*, for `lib/sample-data.ts`' builders. */
export function useSampleName(): { person: SampleName; leader: string } {
  const t = useMessages(samplePreviewMessages);
  return { person: (n: number) => t.person({ n }), leader: t.leader };
}
