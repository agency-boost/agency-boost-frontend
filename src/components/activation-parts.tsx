'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Card } from '@/components/ui/field';
import { KpiTile } from '@/components/ui/kpi-tile';
import { NavIcon } from '@/components/ui/nav-icon';
import { NumberBadge } from '@/components/ui/number-badge';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { activationMessages } from '@/i18n/messages/activation';
import {
  aspectTitle, autoBadge, byHandBadge, dayShown, isWholeDate,
  type ActivationAspectProgress, type ActivationItemLink, type ActivationView, type AspectStatus,
} from '@/lib/activation';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

/**
 * The parts the hire's page and the leader's detail share (`Overall.html:3270-3414`): the progress card
 * with its two tiles, its bar and its table; the numbered aspect cards; the *Auto* chip and the
 * attribution marker; and the date field both write through. One component per part, so the two pages
 * cannot draw the same thing two ways — the prototype draws them twice, with `act-` and `nh-` ids.
 *
 * **Every figure here is served** (P13-T2 AC-5): the day, the window, the counts, the percentage and
 * each aspect's verdict are the read's, printed, never worked out.
 *
 * **Their words are the catalogue's** (`i18n/messages/activation.ts`; P18.98-T4), in the reader's language, and the
 * percentage is written in the figures' (`useFigureLanguage()`).
 */

/** `.section-num` with the prototype's lightning bolt (`:3277-3279`, `:3371-3373`): the progress card's head. */
export function BoltBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-navy text-navy"
    >
      <NavIcon name="bolt" className="h-3.5 w-3.5" />
    </span>
  );
}

/** `.section-head` with its bolt: *Your activation progress* or *Activation progress*. */
export function ProgressHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-md font-bold text-navy">
      <BoltBadge />
      {children}
    </h2>
  );
}

/** The pill's paint per verdict: *Done* green, *In progress* the amber tint with navy words (I-116), *Not started* red. */
const PILL_TONE = { done: 'success', in_progress: 'watch', not_started: 'alert' } as const satisfies Record<AspectStatus, string>;

/** `.aspect-progress-table tr.status-*` (`:1516-1517`): the row's tint. */
const ROW_TINT: Record<AspectStatus, string | undefined> = {
  done: 'bg-success/[0.07]',
  in_progress: 'bg-amber/[0.07]',
  not_started: undefined,
};

export function AspectStatusPill({ status }: { status: AspectStatus }) {
  const label = useMessages(activationMessages).aspectStatus[status];
  return (
    <StatusPill
      // `watch` carries no words of its own; every tone here is given the prototype's.
      {...(PILL_TONE[status] === 'watch' ? { status: 'watch' as const, label } : { status: PILL_TONE[status], label })}
      className="whitespace-nowrap px-2.5 py-1 text-xs font-semibold normal-case tracking-normal"
    />
  );
}

/**
 * `.act-progress-grid` (`:3293-3317`, `:3377-3399`): *Day* and *Completed* over the 8px bar on the left,
 * the aspect table on the right; one column on a phone (`:1529`).
 *
 * `markOverdue` is the leader's: the detail's *Day* tile turns red past the window below 100% (`:6801`),
 * and the hire's page has no such state (`:6615-6630`). **The red is not the only cue**: the tile's text
 * ends *", overdue"* for a screen reader (*The module's own strings*), and nothing visible is added.
 */
export function ProgressSummary({
  view, label, markOverdue = false,
}: {
  view: ActivationView;
  /** The card's heading, which names the bar and the table for a screen reader. */
  label: string;
  markOverdue?: boolean;
}) {
  const t = useMessages(activationMessages);
  const figures = useFigureLanguage();
  const complete = view.total > 0 && view.done === view.total;
  const overdue = markOverdue && view.overdue;
  const width = Math.min(100, Math.max(0, view.pct));
  const pctComplete = t.pctComplete({ pct: formatPercent(view.pct, {}, figures) });
  return (
    <div className="grid gap-6 sm:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col gap-3 sm:pt-7">
        <KpiTile
          label={t.day}
          value={dayShown(view.day, view.window)}
          unit={<>/{view.window}{overdue && <span className="sr-only">{t.overdue}</span>}</>}
          variant={overdue ? 'overdue' : 'plain'}
          className="flex items-center justify-between px-4 py-3"
        />
        <KpiTile
          label={t.completed}
          value={view.done}
          unit={`/${view.total}`}
          variant={complete ? 'complete' : 'plain'}
          className="flex items-center justify-between px-4 py-3"
        />
        <div className="flex flex-col justify-center">
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={width}
            aria-valuetext={pctComplete}
            className="h-2 overflow-hidden rounded-md border border-hairline bg-base"
          >
            <div className="h-full rounded-md bg-gradient-to-r from-amber to-amber-dark" style={{ width: `${width}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-bold text-navy">{pctComplete}</p>
        </div>
      </div>
      {/* Scrolls inside the card on the narrowest phone, so the page never does (T4 AC-8). */}
      <div className="min-w-0 overflow-x-auto">
        <AspectTable aspects={view.aspects} caption={label} />
      </div>
    </div>
  );
}

/** `.aspect-progress-table.compact` (`:3309-3316`, `:1506-1519`): *Aspect · Items · Status*. */
function AspectTable({ aspects, caption }: { aspects: readonly ActivationAspectProgress[]; caption: string }) {
  const t = useMessages(activationMessages);
  const HEAD = 'border-b border-hairline px-2.5 py-1 text-left text-2xs font-semibold uppercase tracking-wide text-muted';
  const CELL = 'border-b border-hairline px-2.5 py-1.5 text-sm font-medium text-navy';
  return (
    <table className="relative w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={HEAD}>{t.aspect}</th>
          <th scope="col" className={HEAD}>{t.items}</th>
          <th scope="col" className={HEAD}>{t.status}</th>
        </tr>
      </thead>
      <tbody className="[&>tr:last-child>*]:border-b-0">
        {aspects.map((aspect) => (
          <tr key={aspect.code} data-status={aspect.status} className={ROW_TINT[aspect.status]}>
            <th scope="row" className={cn(CELL, 'text-left')}>{aspectTitle(aspect.label)}</th>
            <td className={cn(CELL, 'font-semibold text-muted')}>{aspect.done}/{aspect.total}</td>
            <td className={CELL}><AspectStatusPill status={aspect.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A numbered aspect card (`.goal-card` with `.section-head`, `:3319-3347`): its position, its name, its rows. */
export function AspectCard({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <Card density="compact">
      <h2 className="mb-1 flex items-center gap-2.5 font-display text-md font-bold text-navy">
        <NumberBadge n={n} size="md" />
        {aspectTitle(label)}
      </h2>
      {children}
    </Card>
  );
}

/** `.activation-item` (`:1467-1468`): a row, a hairline between rows and none after the last. */
export const ITEM_ROW = 'border-b border-hairline py-[11px] last:border-b-0';

/** The row's checkbox (`:1471`): 16px, ticked in the success green. */
export const ITEM_CHECKBOX = 'h-4 w-4 shrink-0 cursor-pointer accent-success disabled:cursor-default';

/**
 * Who ticked a done item and when, or which link completed it (OD-121, T4 AC-5): an `ⓘ` whose words
 * show on hover, focus and tap and are its accessible name (ADR-0062 §2, form 2) — the provenance marker
 * the Summary and Goal Settings already use.
 */
export function AttributionMark({ words }: { words: string | null }) {
  if (!words) return null;
  return <TippedGlyph glyph="ⓘ" name={words} tip={words} align="fit" className="-my-1.5" />;
}

/**
 * `.auto-badge` (`:662-667`, `:6580`): *Auto*, its tooltip and the end of its name the registry's
 * `completesWhen` (T4 AC-4) — how the row says what it waits for without a line of its own (ADR-0031).
 */
export function AutoBadge({ link }: { link: ActivationItemLink }) {
  const words = autoBadge(link.completesWhen, useLanguage());
  return (
    <TippedGlyph
      glyph={words.glyph}
      name={words.name}
      tip={words.tip}
      align="fit"
      className="-my-1"
      face="h-auto w-auto rounded-pill bg-navy/[0.06] px-[7px] py-0.5 text-2xs font-bold uppercase tracking-wide text-muted hover:bg-navy/[0.1]"
    />
  );
}

/**
 * *Ticked by hand* (D-orphan, P18.5-T3 AC-4): a linked item whose link does not complete it now — its training
 * module is not offered — so the hire or a leader ticks it. The office's Settings badge, its words and its
 * tooltip (`byHandBadge`), in this row's pill.
 */
export function ByHandBadge() {
  const words = byHandBadge(useLanguage());
  return (
    <TippedGlyph
      glyph={words.glyph}
      name={words.name}
      tip={words.tip}
      align="fit"
      className="-my-1"
      face="h-auto w-auto whitespace-nowrap rounded-pill border border-hairline bg-base px-[7px] py-0.5 text-2xs font-bold uppercase tracking-wide text-muted hover:bg-base hover:text-navy"
    />
  );
}

/** *"Go to {label} →"* (`:6584`), the prototype's `.reopen-btn` pill, as the link it is. */
export function GoToLink({ link }: { link: ActivationItemLink }) {
  const t = useMessages(activationMessages);
  // A module no longer offered has no page to open (D-orphan): the item keeps its words, and no link.
  if (!link.route) return null;
  return (
    <Link
      href={link.route}
      className="inline-flex items-center whitespace-nowrap rounded-pill border border-hairline px-[11px] py-[5px] text-sm font-semibold text-navy-soft hover:bg-navy-soft/[0.08]"
    >
      {t.goTo({ label: link.label })}
    </Link>
  );
}

/** A row's write that failed: put back, and why (T4 AC-7). */
export function RowError({ message }: { message: string | undefined }) {
  const t = useMessages(activationMessages);
  if (!message) return null;
  return <p role="alert" className="mt-1.5 text-xs font-semibold text-alert">{t.notSaved({ why: message })}</p>;
}

/**
 * Writes one at a time, in the order they were asked: each answer is the whole activation, so an
 * earlier answer landing after a later one would put back what the later one changed.
 */
export function useWriteQueue() {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(write);
    chain.current = next.catch(() => undefined);
    return next;
  }, []);
}

/** How long a typed date waits before it is saved, so a day typed digit by digit is one write, not two. */
export const DATE_SETTLE_MS = 600;

/**
 * A date written as the prototype writes its inputs, **on change, with no save button** (`:6662-6668`), through the
 * shared {@link DateField} (P18.96-T2 AC-4): the date is shown as the app writes it, and the device's picker chooses
 * it.
 *
 * A date can still be typed a digit at a time where a browser lets the field take keys, and every partial value but
 * the last is a date nobody meant: so a value is written once it is whole and `allowed`, after a short pause, and at
 * once when the field is left. Clearing it writes `null` when `clearable`. A write the server refuses puts the field
 * back: `value` is the last saved date, and the field returns to it whenever it changes or `resetKey` does.
 */
export function AutoSaveDateField({
  id, value, onCommit, allowed = isWholeDate, clearable = false, invalidText, resetKey = 0, className, ...rest
}: {
  id?: string;
  value: string | null;
  onCommit: (next: string | null) => void;
  allowed?: (value: string) => boolean;
  clearable?: boolean;
  /** Said under the field when a whole date falls outside what `allowed` takes. */
  invalidText?: string;
  resetKey?: number;
  className?: string;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, 'min' | 'max' | 'aria-label' | 'aria-describedby' | 'readOnly'>) {
  const [draft, setDraft] = useState(value ?? '');
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorId = useId();

  useEffect(() => {
    setDraft(value ?? '');
    setInvalid(false);
  }, [value, resetKey]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commit = (next: string, leaving = false) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (next === (value ?? '')) return;
    if (next === '' && clearable) {
      onCommit(null);
      return;
    }
    if (!isWholeDate(next)) {
      // Left half-typed: the field goes back to what is saved rather than showing a date that is not.
      if (leaving) setDraft(value ?? '');
      return;
    }
    if (!allowed(next)) {
      setInvalid(true);
      return;
    }
    onCommit(next);
  };

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <DateField
        {...rest}
        id={id}
        density="compact"
        value={draft}
        invalid={invalid}
        aria-describedby={invalid && invalidText ? errorId : rest['aria-describedby']}
        onChange={(next) => {
          setDraft(next);
          setInvalid(false);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(next), DATE_SETTLE_MS);
        }}
        onBlur={(e) => commit(e.target.value, true)}
        className="w-[150px]"
      />
      {invalid && invalidText && (
        <span id={errorId} role="alert" className="mt-1 text-xs font-semibold text-alert">{invalidText}</span>
      )}
    </span>
  );
}

/** The page's wait: the progress card's shape, then two aspect cards. */
export function ActivationSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-hairline bg-card px-5 py-4">
          <SkeletonBar className="h-5 w-56" />
          <div className="mt-4 grid gap-6 sm:grid-cols-[0.8fr_1.2fr]">
            <div className="flex flex-col gap-3">
              <SkeletonBar className="h-12 w-full" />
              <SkeletonBar className="h-12 w-full" />
              <SkeletonBar className="h-2 w-full" />
            </div>
            <SkeletonText lines={6} />
          </div>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-hairline bg-card px-5 py-4">
            <SkeletonBar className="h-5 w-40" />
            <SkeletonText lines={3} className="mt-4" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
