'use client';

import { useEffect, useState } from 'react';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { SectionCard } from '@/components/ui/section-card';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readEventsNps, type EventsNps } from '@/lib/advanced-analytics-page';
import { formatCalendarDay, formatMonth, formatNumber } from '@/lib/format';
import { monthsUpTo, SectionFilters } from './demographics-section';
import { SectionError, SectionLoading } from './shared';

/** An NPS as the score is written: signed, whole, *—* with no answer. */
function npsText(nps: number | null, language: ReturnType<typeof useFigureLanguage>): string {
  if (nps === null) return '—';
  return `${nps > 0 ? '+' : ''}${formatNumber(nps, {}, language)}`;
}

/**
 * ***Event*** — **the events' NPS** (P19.5-T3 AC-3; ADR-0215 §4; OWN Case 7; OD-256): the KPM's score for the period —
 * standard NPS over every counted answer, its average under it — beside each event with feedback: its NPS over its
 * confirmed attendees, its average and its count. The year to date by default, or a month; the AB filter keeps that AB's
 * Group's answers. **No respondent is named** — the names stay on *Lihat masukan* in the event settings (ADR-0141).
 */
export function EventsSection({ platformKpmId }: { platformKpmId?: string }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const language = useFigureLanguage();
  const [query, setQuery] = useState<{ month?: string; ab?: string }>({});
  const [view, setView] = useState<EventsNps | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readEventsNps(query, platformKpmId)
      .then((answer) => {
        if (!live) return;
        setView(answer);
        setCurrent((c) => c ?? answer.period.to.slice(0, 7));
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [query, platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const e = t.events;
  const months = [
    { value: '', label: t.filters.ytd },
    ...monthsUpTo(current ?? view.period.to.slice(0, 7)).map((m) => ({ value: m, label: formatMonth(m, language) })),
  ];

  return (
    <div data-section="events">
      <SectionFilters
        abs={view.abs}
        ab={query.ab}
        onAb={(ab) => setQuery((q) => ({ ...q, ab }))}
        months={months}
        month={query.month ?? ''}
        onMonth={(month) => setQuery((q) => ({ ...q, month }))}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <SectionCard title={e.kpm}>
          <div className="px-4 py-4" data-kpm-nps="">
            <p className="font-display text-3xl font-bold tabular-nums text-navy">{npsText(view.kpm.nps, language)}</p>
            {view.kpm.average !== null && (
              <p className="mt-1 text-sm text-muted">{e.average({ n: formatNumber(view.kpm.average, { maxDecimals: 1 }, language) })}</p>
            )}
            <p className="mt-1 text-sm text-muted">{e.answers({ n: view.kpm.n })}</p>
          </div>
        </SectionCard>
        {view.events.length === 0 ? (
          <SectionCard title={e.event}>
            <p className="px-4 py-6 text-center text-md text-muted">{e.none}</p>
          </SectionCard>
        ) : (
          <DataTable caption={t.sections.events} columns={[e.event, e.score, t.filters.period]}>
            {view.events.map((event) => (
              <Row key={event.eventId} data-row={event.eventId}>
                <Cell className="min-w-[12rem] font-semibold">{event.title}</Cell>
                <Cell className="whitespace-nowrap tabular-nums">
                  <span className="font-semibold">{npsText(event.nps, language)}</span>
                  <span className="ml-2 text-sm text-muted">
                    {event.average !== null && `${e.average({ n: formatNumber(event.average, { maxDecimals: 1 }, language) })} · `}
                    {e.answers({ n: event.n })}
                  </span>
                </Cell>
                <Cell className="whitespace-nowrap text-sm text-muted">{formatCalendarDay(event.startsOn, language)}</Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
