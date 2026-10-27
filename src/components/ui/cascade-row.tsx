import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import { NavIcon, type NavIconName } from './nav-icon';
import { ConfigBadge } from './config-badge';

export interface CascadeColumn {
  /** *Set appointment*, *Sales meeting*, *Submission polis* (ADR-0160 §4). */
  readonly label: string;
  /**
   * The activity this column counts against, by the name Log Activity gives it — *Set Appointment* — where it
   * was the log's number, *Activity #3* (P18.95-T5 AC-5). Never the stored code, an internal id (ADR-0062 §3);
   * omitted while the name is unknown, or when it would only repeat `label`.
   */
  readonly chip?: string;
  readonly icon: NavIconName;
  /** The monthly figure as the screen writes it — *57/month* (ADR-0160 §4). */
  readonly month: string;
  /** The `≈ 19/week` line — larger than the prototype's grey caption, and blue, at the client's request. */
  readonly week?: string;
  /** The column the card is about. Exactly one, and it is the last. */
  readonly hero?: boolean;
}

/**
 * The goal calculator's signature layout: what you have to do each month, and the rate between steps.
 *
 * `Overall.html:3014-3060`, CSS `:703-735`. Three filled, bordered, centred panels with an icon plate
 * on top and a chip naming the activity they count against, joined by fixed-width columns carrying a
 * `→` over the conversion percentage.
 *
 * **The arrows are the argument.** Without them the row is three numbers that happen to be adjacent;
 * with them it reads as *40 appointments set, of which 50% become 20 sales meetings, of which 30% become
 * 6 submissions* — which is the one thing the screen exists to explain. The version this replaces rendered
 * them as the text `—30%→` in grey, at the same size as a caption.
 *
 * **The hero is the last column**, deeper in fill and border, because the closings figure is what the
 * plan is for. Its value uses `--color-amber-deep`, as do the others: amber-dark on this very tint is
 * `2.82:1`, which is the prototype's own contrast defect (parity F-71) and not something to reproduce.
 *
 * **Below 640px it stacks and the arrows rotate**, as the prototype's own media query does
 * (`:731-735`) — a `→` between vertically stacked panels points at nothing.
 *
 * **The weekly line is larger and blue** (P13.1-T5 AC-5, the client's request of 2026-10-07): the
 * prototype's `.cascade-sub` is an 11px grey caption (`:724`). Blue is `--color-navy-soft`, which passes AA
 * as small text on this tint; the prototype's `--blue`, `--color-info`, passes only as large text, ≈19px
 * bold, which would outweigh the monthly figure above it (`tokens.md`, *Status*).
 */
export function CascadeRow({
  columns,
  links,
  className,
}: {
  columns: readonly CascadeColumn[];
  /** The rate between column *n* and *n+1*, already formatted — `30%`. One fewer than the columns. */
  links: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-stretch gap-1.5 sm:flex-row', className)}>
      {columns.map((col, i) => (
        <Fragment key={col.label}>
          <div
            data-hero={col.hero ? 'true' : undefined}
            className={cn(
              'min-w-0 flex-1 rounded-md border px-2.5 py-3.5 text-center',
              col.hero ? 'border-amber/50 bg-amber/[0.14]' : 'border-amber/35 bg-amber/[0.08]',
            )}
          >
            <span className="mx-auto mb-2 flex h-[34px] w-[34px] items-center justify-center rounded-md border border-hairline bg-card text-navy">
              <NavIcon name={col.icon} />
            </span>
            <span className="mb-1 flex flex-col items-center gap-1">
              <span className="text-sm leading-snug text-muted">{col.label}</span>
              {col.chip ? (
                // A name can be a sentence — *Melakukan presentasi penjualan untuk calon atau existing nasabah* — so
                // it wraps inside the panel rather than running out of it.
                <ConfigBadge tone="navy" className="max-w-full whitespace-normal text-center normal-case tracking-normal">
                  {col.chip}
                </ConfigBadge>
              ) : null}
            </span>
            <span className="block font-body text-2xl font-bold leading-none text-amber-deep">
              {col.month}
            </span>
            {col.week ? <span className="mt-1 block text-md font-semibold text-navy-soft">{col.week}</span> : null}
          </div>

          {i < links.length ? (
            <div
              className={cn(
                'flex shrink-0 items-center justify-center gap-1.5 py-0.5',
                'w-full flex-row sm:w-[52px] sm:flex-col sm:gap-[3px] sm:py-0',
              )}
            >
              <span aria-hidden="true" className="rotate-90 text-md text-navy/30 sm:rotate-0">
                →
              </span>
              {/*
                * Read aloud as a whole sentence. A bare "30%" between two panels tells a
                * screen-reader user nothing about which two it joins, and the arrow it sits under is
                * decorative — so the relationship has to be in the text or it is nowhere.
                *
                * *From … to …*, the shape of the field it repeats — *Appointment to Sales meeting* — since
                * the stages became actions (ADR-0160 §4): *30% of set appointment become sales meeting*
                * is not a sentence.
                */}
              <span className="text-xs font-bold text-navy-soft">
                <span className="sr-only">
                  {`${links[i]} from ${columns[i].label.toLowerCase()} to ${columns[i + 1].label.toLowerCase()}`}
                </span>
                <span aria-hidden="true">{links[i]}</span>
              </span>
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
