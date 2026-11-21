'use client';

import { useState, type ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { cn } from '@/lib/cn';
import { FIRST_ROWS, signed, type EventFeedback, type FeedbackEventRow, type FeedbackQuote, type FeedbackShares } from '@/lib/event-analytics';
import { formatMonth, formatNumber, formatShortDay } from '@/lib/format';
import { usePhone } from '@/lib/use-phone';
import { BlockHead, NoDataLine, SeeAll, toneText, useFigureText, usePercentText } from './parts';

/**
 * ***Feedback*** (P19.25-T2 AC-1, AC-2; ADR-0281 §4, §5) — **no survey to send**: every event created in the app asks those
 * who came for a score from 0 to 10, why, and what could be better, from its end. **The navy card**: the NPS of all the
 * period's past events, the average score, the answers, and *"121 dari 206 yang hadir memberi feedback"*, with the
 * promoter / passive / detractor bar. Then **one row per event, lowest NPS first** (six and *Lihat semua*): name, *"date ·
 * n jawaban · rata-rata x"* (*sedikit jawaban* under three), the NPS on the right (green ≥ 30, yellow 0–29, red < 0) and a
 * slim 6px bar. **Tapping one** shows *Kenapa memberi nilai ini* and *Yang bisa diperbaiki* — the attendees' own words,
 * tagged *Leader* or *Agent*, never named — beside the list on a tablet and a laptop (sticky), under the row on a phone.
 * *Ringkasan AI* is not drawn while reading with Claude is on hold (OD-358; parity row).
 */
export function FeedbackPart({ view, initialEvent }: { view: EventFeedback; initialEvent?: string }) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const phone = usePhone();
  const pct = usePercentText();
  const figure = useFigureText();
  const initial = initialEvent ? view.rows.findIndex((r) => r.eventId === initialEvent) : -1;
  const [selected, setSelected] = useState<number | null>(initial >= 0 ? initial : null);
  const [all, setAll] = useState(initial >= FIRST_ROWS);
  const shownIndex = selected ?? (phone || view.rows.length === 0 ? null : 0);
  const rows = all ? view.rows : view.rows.slice(0, FIRST_ROWS);
  const when = view.period.month ? t.inMonth({ month: formatMonth(view.period.month, language) }) : t.sinceJanuary;
  const nps = (value: number | null) => (value === null ? '–' : signed(value, formatNumber(Math.abs(value), {}, language)));
  const s = view.summary;
  const c = view.constants;
  const detail = shownIndex === null ? null : <Words row={view.rows[shownIndex]} />;

  return (
    <div data-part="feedback">
      <section data-card="feedback" className="mb-4 rounded-card bg-secondary p-4 text-secondary-contrast">
        <h3 className="text-sm font-bold text-secondary-muted">{t.fbTitle({ events: figure(view.events, 0), when })}</h3>
        <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-end md:gap-3">
          <p className="font-display text-4xl font-extrabold leading-none tabular-nums text-primary-on-secondary">{nps(s.nps)}</p>
          {s.average !== null && (
            <p className="text-md font-semibold md:pb-1">{t.npsLine({ avg: figure(s.average), n: figure(s.answers, 0) })}</p>
          )}
        </div>
        {s.shares && <SharesBar shares={s.shares} labelled className="mt-3 h-5" />}
        {s.share !== null && (
          <p className="mt-2 text-sm">{t.respondedLine({ a: figure(s.answers, 0), h: figure(s.hadir, 0), pct: pct(s.share) })}</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="min-w-0">
          <BlockHead aside={t.lowestFirst}>{t.perEvent}</BlockHead>
          <div className="overflow-hidden rounded-card bg-card">
            {view.rows.length === 0 ? <NoDataLine /> : (
              <ul>
                {rows.map((row, i) => {
                  const on = shownIndex === i;
                  const day = formatShortDay(row.startsOn, {}, language);
                  const line = !row.recorded ? t.rowLineWaiting({ date: day })
                    : row.answers === 0 ? t.rowLineNone({ date: day })
                      : t.rowLine({ date: day, n: figure(row.answers, 0), avg: figure(row.average) });
                  return (
                    <li key={row.eventId} className="border-b border-divider last:border-b-0">
                      <div className={cn('relative px-4 py-2.5', on && 'bg-today before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[""]')}>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setSelected((v) => (phone && v === i ? null : i))}
                            className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
                          >
                            <span className="block truncate font-bold text-navy">{row.title}</span>
                            <span className="block text-sm text-muted">
                              {line}
                              {row.recorded && row.answers > 0 && row.few && <> · <em className="font-semibold not-italic text-pill-amber-ink">{t.few}</em></>}
                            </span>
                          </button>
                          <span className={cn('shrink-0 text-xl font-extrabold tabular-nums', toneText(row.tone))}>{nps(row.nps)}</span>
                        </div>
                        {row.shares && <SharesBar shares={row.shares} className="mt-2 h-1.5" />}
                      </div>
                      {phone && on && <div data-detail-under="" className="border-t border-divider bg-base px-3 py-3">{detail}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
            {view.rows.length > FIRST_ROWS && <SeeAll n={view.rows.length} open={all} onToggle={() => setAll((v) => !v)} />}
            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-divider px-4 py-2.5 text-sm text-muted">
              <Legend tone="bg-nps-promoter">{t.promoter({ from: figure(c.promoterMin, 0), to: figure(c.scaleMax, 0) })}</Legend>
              <Legend tone="bg-nps-passive">{t.passive({ from: figure(c.detractorMax + 1, 0), to: figure(c.promoterMin - 1, 0) })}</Legend>
              <Legend tone="bg-nps-detractor">{t.detractor({ from: figure(c.scaleMin, 0), to: figure(c.detractorMax, 0) })}</Legend>
            </p>
          </div>
        </div>
        {!phone && <aside data-detail="" className="min-w-0 md:sticky md:top-4">{detail}</aside>}
      </div>
    </div>
  );
}

function Legend({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', tone)} />{children}</span>;
}

/** The promoter / passive / detractor bar: green, yellow, red, by share — on the card with each share written in it. */
function SharesBar({ shares, labelled = false, className }: { shares: FeedbackShares; labelled?: boolean; className?: string }) {
  const t = useMessages(eventAnalyticsMessages);
  const pct = usePercentText();
  const parts: [keyof FeedbackShares, string][] = [
    ['promoter', 'bg-nps-promoter text-white'], ['passive', 'bg-nps-passive text-navy'], ['detractor', 'bg-nps-detractor text-white'],
  ];
  return (
    <span
      role="img"
      aria-label={t.sharesLabel({ p: pct(shares.promoter), q: pct(shares.passive), d: pct(shares.detractor) })}
      className={cn('flex w-full overflow-hidden rounded-pill bg-divider', className)}
    >
      {parts.filter(([key]) => shares[key] > 0).map(([key, tone]) => (
        <span key={key} className={cn('flex items-center justify-center text-xs font-bold', tone)} style={{ width: `${shares[key]}%` }}>
          {labelled && shares[key] >= 8 ? pct(shares[key]) : null}
        </span>
      ))}
    </span>
  );
}

/** One event's words: *Kenapa memberi nilai ini* and *Yang bisa diperbaiki*, each answer tagged *Leader* or *Agent*. */
function Words({ row }: { row: FeedbackEventRow | undefined }) {
  const t = useMessages(eventAnalyticsMessages);
  if (!row) return null;
  const list = (quotes: readonly FeedbackQuote[]) => (quotes.length === 0
    ? <p className="px-4 pb-3 text-sm text-muted">{t.noWords}</p>
    : (
      <ul className="space-y-2 px-4 pb-3">
        {quotes.map((q, i) => (
          <li key={i} className="flex items-start gap-2 rounded-row bg-base px-3 py-2 text-sm">
            <span className="shrink-0 rounded-pill bg-secondary-50 px-2 py-0.5 text-xs font-bold text-navy">{q.role === 'leader' ? t.leader : t.agent}</span>
            <q className="italic text-ink">{q.text}</q>
          </li>
        ))}
      </ul>
    ));
  return (
    <section aria-label={row.title}>
      <BlockHead>{row.title}</BlockHead>
      <div className="overflow-hidden rounded-card bg-card">
        <h4 className="px-4 pb-2 pt-3 text-md font-bold text-ink">{t.why}</h4>
        {list(row.why)}
        <h4 className="px-4 pb-2 pt-1 text-md font-bold text-ink">{t.improve}</h4>
        {list(row.improve)}
      </div>
    </section>
  );
}
