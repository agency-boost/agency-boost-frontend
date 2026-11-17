'use client';

import { ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { Lead } from '@/lib/leads';

/*
 * **The closed leads, on their own** (P19.16-T4 AC-3): moved out of `leads-table.tsx`, which re-exports them, so the
 * coachee's *Leads* tab can draw `/leads`' *Leads yang ditutup* without the table — its dialogs, its inline editors —
 * joining the coaching session's first load (`coaching-leads.tsx` is the session's too).
 */

/** A list as it arrives, page after page. */
export interface List {
  rows: Lead[];
  /** The server's count from the first page — right before the last page has arrived. */
  total: number;
}

/** One closed card's state: what has arrived, and what stopped the rest. */
export interface ClosedCard {
  list: List | null;
  error: ApiError | null;
}

/**
 * The two lists below the table: what was won, and what was not (`Overall.html:2824-2842`).
 *
 * **The record, not the work.** The table is leads still open; these are how the year has gone, and
 * somewhere to reopen from when a lead comes back. Each row is the name over *Sales · {stage}*
 * (`:5577`), with one action that says what it does — `.reopen-btn` is an outlined pill rather than a
 * glyph (`:524-529`), because it is the only action and it destroys nothing.
 *
 * **Each card stands on its own.** It waits in its own skeleton, fails in its own place, and when a
 * later page does not arrive says how much of the list it is showing — a card short of its own
 * header total with nothing said would read as the whole record.
 */
export function ClosedLeads({
  won,
  lost,
  busy,
  refusalsOf,
  stageLabel,
  onReopen,
  stacked = false,
}: {
  /** One card under the other at every width: the laptop's list column beside the lead's pane (UI-116). */
  stacked?: boolean;
  won: ClosedCard;
  lost: ClosedCard;
  busy: Record<string, boolean>;
  refusalsOf: (id: string) => ApiError[];
  /**
   * The office's own word for the stage. A lead carries the **code** — renaming a stage must not
   * orphan the leads sitting on it (invariant §3) — so the label comes from the published snapshot.
   */
  stageLabel: (row: Lead) => string | null;
  /**
   * Absent under a finalized session's lock, and on a coachee's *Leads* tab (P19.16-T4 AC-3): the lists still read, and
   * nothing moves back.
   */
  onReopen?: (row: Lead) => void;
}) {
  const t = useMessages(leadsMessages);
  const cards = [
    { outcome: 'won' as const, title: t.closed.won, card: won, empty: t.closed.noneWon, waiting: t.closed.loadingWon },
    { outcome: 'lost' as const, title: t.closed.lost, card: lost, empty: t.closed.noneLost, waiting: t.closed.loadingLost },
  ];

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-md font-bold text-navy">{t.closed.title}</h2>
      <div className={stacked ? 'grid gap-4' : 'grid gap-4 lg:grid-cols-2'}>
        {cards.map(({ outcome, title, card: { list, error }, empty, waiting }) => (
          <div key={outcome} className="overflow-hidden rounded-lg border border-card-edge bg-card">
            <header
              className={cn(
                'flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 text-md font-bold',
                outcome === 'won' ? 'bg-success/[0.06] text-success' : 'bg-alert/[0.06] text-alert',
              )}
            >
              <h3>{title}</h3>
              {list && <span className="text-sm font-semibold text-muted">{list.total}</span>}
            </header>

            {list === null ? (
              error
                ? <div className="px-4 py-4"><ErrorBanner {...error} /></div>
                : <Skeleton label={waiting} className="px-4 py-4"><SkeletonText lines={2} /></Skeleton>
            ) : (
              <>
                {list.rows.length === 0 && !error
                  ? <p className="px-4 py-4 text-sm italic text-muted">{empty}</p>
                  : list.rows.map((row) => (
                    <div key={row.id} className="border-b border-hairline px-4 py-2.5 last:border-b-0">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-md font-semibold text-navy">{row.name || t.closed.unnamed}</span>
                          <span className="text-xs text-muted">
                            {t.types[row.type === 'recruitment' ? 'recruitment' : 'sales']}
                            {stageLabel(row) ? ` · ${stageLabel(row)}` : ''}
                          </span>
                        </span>
                        {onReopen && <button
                          type="button"
                          disabled={busy[row.id] === true}
                          onClick={() => onReopen(row)}
                          className={cn(
                            'shrink-0 whitespace-nowrap rounded-pill border border-hairline px-2.5 py-1',
                            'text-xs font-semibold text-navy-soft hover:bg-secondary-hover/[0.08]',
                            'disabled:cursor-not-allowed disabled:opacity-40',
                          )}
                        >
                          {t.closed.reopen}
                        </button>}
                      </div>
                      {/* A refused reopen says so where it was asked for, as a row's refusal does. */}
                      {refusalsOf(row.id).map((refusal) => (
                        <div key={`${refusal.code} ${refusal.message}`} className="mt-2"><ErrorBanner {...refusal} /></div>
                      ))}
                    </div>
                  ))}
                {error && (
                  <div className="flex flex-col gap-2 border-t border-hairline px-4 py-3">
                    <p className="text-xs text-muted">{t.closed.partial({ shown: list.rows.length, total: list.total })}</p>
                    <ErrorBanner {...error} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
