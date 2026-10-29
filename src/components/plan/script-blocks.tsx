import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * **The numbered script blocks** (D-components; `Overall.html:9726-9790` on the plan page, `:10295-10348`
 * in the catalog's drawer, styles `:2457-2492`, `:2582-2596`).
 *
 * Presentational and nothing else: every word comes in by props, and nothing here knows what a product
 * is, so the Recruitment Attack Plan (**P17-T3**, its second user) draws a candidate's script with the
 * same pieces. The product screens compose them in `product-script.tsx`.
 *
 * **Authored words are rendered as text**: children are React nodes, never HTML. The prototype pours each
 * script through `innerHTML` (F-34, F-54); a `<b>` or a `<script>` here prints as the characters it is.
 *
 * `size` is the prototype's two scales: the page's (`page`) and the drawer's, a step smaller (`drawer`).
 */
export type ScriptSize = 'page' | 'drawer';

/**
 * One numbered block: the round number, its label in small caps, and what it says. `lead` is the *Good fit
 * for* block's amber tone (`.good-fit-block`) — amber-ink rather than amber-dark, which misses 4.5:1 as
 * small text on a card (`a11y.spec.tsx`).
 */
export function ScriptBlock({
  n,
  label,
  lead = false,
  size = 'page',
  children,
}: {
  n: number;
  label: string;
  lead?: boolean;
  size?: ScriptSize;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'border-b border-hairline last:border-b-0 last:pb-1',
        size === 'page' ? 'py-[18px]' : 'py-4',
        lead && 'pt-3.5',
      )}
      data-block={n}
    >
      <h3
        className={cn(
          'mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide',
          lead ? 'text-amber-ink' : 'text-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-2xs font-bold',
            lead ? 'border-amber-ink text-amber-ink' : 'border-navy text-navy',
          )}
        >
          {n}
        </span>
        <span>
          <span className="sr-only">{n} </span>
          {label}
        </span>
      </h3>
      {children}
    </section>
  );
}

/** Plain words under a block's label (`.d-text`). */
export function ScriptText({ children }: { children: ReactNode }) {
  return <p className="m-0 text-base leading-relaxed text-navy">{children}</p>;
}

/** The line to open with, in the display face and in quotation marks (`.opening-line`). */
export function OpeningLine({ text, size = 'page' }: { text: string; size?: ScriptSize }) {
  return (
    <p className={cn('m-0 font-display font-bold leading-snug text-navy', size === 'page' ? 'text-lg' : 'text-md')}>
      “{text}”
    </p>
  );
}

/** A list of points, each behind an amber dot (`.benefit-list`, `.d-benefit-list`). */
export function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
      {items.map((item, i) => (
        <li key={`${i}-${item}`} className="flex items-start gap-[9px] text-base text-navy">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The full script, in its warm box (`.say-box`). */
export function SayBox({ text, size = 'page' }: { text: string; size?: ScriptSize }) {
  return (
    <div className={cn('rounded-[10px] border border-hairline bg-base', size === 'page' ? 'px-[18px] py-4' : 'px-4 py-3.5')}>
      <p className={cn('m-0 whitespace-pre-line text-navy', size === 'page' ? 'text-md leading-[1.65]' : 'text-base leading-relaxed')}>
        {text}
      </p>
    </div>
  );
}

/** What to do next, behind a navy dot (`.next-action`). */
export function NextAction({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-base text-navy">
      <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-navy" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** A quiet line in italics, where a script is missing (`.no-script-note`). */
export function ScriptNote({ children }: { children: ReactNode }) {
  return <p className="my-3 text-base italic text-muted">{children}</p>;
}
