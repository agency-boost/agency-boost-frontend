'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { FeedbackPart } from '@/components/events-analytics/feedback';
import { KehadiranPart } from '@/components/events-analytics/kehadiran';
import { PillTabs } from '@/components/events-analytics/parts';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readEventFeedback, readKehadiran, type EventFeedback, type Kehadiran } from '@/lib/event-analytics';
import { formatMonth } from '@/lib/format';
import { SectionError, SectionLoading } from './shared';

type Part = 'attendance' | 'feedback';

/** The months the period picker offers: this one and the eleven before it, newest first. */
function lastTwelve(current: string): string[] {
  const [y, m] = current.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const at = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/**
 * ***Event*** **— Advanced analytics' seventh tab** (P19.25-T1, T2; ADR-0281; the brief of 19 November, *Event*, redone):
 * two parts, ***Kehadiran | Feedback***, and **one filter, the period** — *Sejak awal tahun* or a month. No AB filter:
 * *Per group* covers it. *Lihat masukan ›* on Pengaturan › Events opens it on *Feedback* with that event chosen
 * (`?view=feedback&event=<id>&month=YYYY-MM`). Its states: a skeleton shaped like the cards, the shared error, and
 * *Belum ada data* inside the layout.
 *
 * `platformKpmId` is kept for `SectionBody`'s signature: the Super Admin reads the tab inside the KPM, as its Owner
 * (ADR-0268 §3), and the platform read's look-as tab that passed one is gone.
 */
export function EventsSection(_props: { platformKpmId?: string }) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const params = useSearchParams();
  const askedView = params?.get('view');
  const askedEvent = params?.get('event') ?? undefined;
  const askedMonth = params?.get('month');
  const [part, setPart] = useState<Part>(askedView === 'feedback' ? 'feedback' : 'attendance');
  const [month, setMonth] = useState<string | undefined>(askedMonth && /^\d{4}-\d{2}$/.test(askedMonth) ? askedMonth : undefined);
  const [kehadiran, setKehadiran] = useState<Kehadiran | null>(null);
  const [feedback, setFeedback] = useState<EventFeedback | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);
  const panelId = useId();
  const periodId = useId();

  const load = useCallback((live: () => boolean) => {
    setError(null);
    const read = part === 'attendance'
      ? readKehadiran(month).then((v) => { if (live()) setKehadiran(v); })
      : readEventFeedback(month).then((v) => { if (live()) setFeedback(v); });
    read.catch((err) => { if (live()) setError(toDisplayError(err)); });
  }, [part, month]);
  useEffect(() => {
    let live = true;
    load(() => live);
    return () => { live = false; };
  }, [load, version]);

  const view = part === 'attendance' ? kehadiran : feedback;
  const current = view?.currentMonth ?? kehadiran?.currentMonth ?? feedback?.currentMonth;
  const shownMonth = view?.period.month ?? '';

  return (
    <div data-section="events">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PillTabs
          label={t.partsLabel}
          tabs={[{ id: 'attendance', label: t.parts.attendance }, { id: 'feedback', label: t.parts.feedback }]}
          active={part}
          onSelect={setPart}
          panelId={panelId}
        />
        {current && (
          <span className="relative inline-flex">
            <label htmlFor={periodId} className="sr-only">{t.period}</label>
            <select
              id={periodId}
              value={shownMonth}
              onChange={(e) => setMonth(e.target.value || undefined)}
              className="h-11 appearance-none rounded-pill border border-hairline bg-card pl-4 pr-9 text-md font-semibold text-ink"
            >
              <option value="">{t.ytd}</option>
              {lastTwelve(current).map((m) => <option key={m} value={m}>{formatMonth(m, language)}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink">⌄</span>
          </span>
        )}
      </div>
      <div id={panelId} role="tabpanel">
        {error ? <SectionError error={error} /> : !view || (month !== undefined && view.period.month !== month) || (month === undefined && view.period.kind !== 'ytd') ? <SectionLoading /> : part === 'attendance'
          ? <KehadiranPart view={view as Kehadiran} initialEvent={askedView === 'feedback' ? undefined : askedEvent} onRecorded={() => setVersion((n) => n + 1)} />
          : <FeedbackPart view={view as EventFeedback} initialEvent={askedEvent} />}
      </div>
    </div>
  );
}
