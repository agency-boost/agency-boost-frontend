'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { cn } from '@/lib/cn';
import { recordedIndexes, type Kehadiran } from '@/lib/event-analytics';
import { formatMonth, formatShortDay } from '@/lib/format';
import { useFigureLanguage } from '@/i18n/language-provider';
import { PillTabs, TONE_FILL, useFigureText, usePercentText } from './parts';
import { PerEvent } from './per-event';

const PerGroup = dynamic(() => import('./per-group').then((m) => m.PerGroup), { ssr: false });
const PerOrang = dynamic(() => import('./per-orang').then((m) => m.PerOrang), { ssr: false });

export type KehadiranViewKind = 'event' | 'group' | 'person';

/**
 * ***Kehadiran*** (P19.25-T1 AC-1, AC-2; ADR-0281 §1, §3): **the navy card** — the average share hadir over the period's
 * recorded events, *"rata-rata 18 dari 30 anggota hadir per event"*, and a tile per informal group coloured green ≥ 80%,
 * yellow 50–79%, red < 50% — then ***Per event · Per group · Per orang*** with *"Hadir atau tidak hadir · n event"* on the
 * right. Hadir or tidak hadir only: every member the event was for is expected, and an event whose roll call nobody has
 * taken is in no average.
 */
export function KehadiranPart({ view, initialEvent, onRecorded }: {
  view: Kehadiran;
  /** An event to open first — *Lihat masukan ›* from Pengaturan › Events. */
  initialEvent?: string;
  onRecorded: () => void;
}) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const pct = usePercentText();
  const figure = useFigureText();
  const panelId = useId();
  const [kind, setKind] = useState<KehadiranViewKind>('event');
  // *Bandingkan dengan*: the newest recorded event until another is chosen.
  const [compare, setCompare] = useState<number | null>(null);
  const recorded = recordedIndexes(view);
  const compareIndex = compare !== null && recorded.includes(compare) ? compare : recorded[0] ?? null;
  const when = view.period.month ? t.inMonth({ month: formatMonth(view.period.month, language) }) : t.sinceJanuary;

  return (
    <div data-part="kehadiran">
      <section data-card="kehadiran" className="mb-4 rounded-card bg-secondary p-4 text-secondary-contrast">
        <h3 className="text-sm font-bold text-secondary-muted">
          {t.cardTitle({ events: figure(view.recordedEvents, 0), when, members: figure(view.members, 0) })}
        </h3>
        <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-end md:gap-3">
          <p className="font-display text-4xl font-extrabold leading-none tabular-nums text-primary-on-secondary">{pct(view.summary.pct)}</p>
          {view.summary.pct !== null && (
            <p className="text-md font-semibold md:pb-1">
              {t.average({ h: figure(view.summary.hadir, 0), n: figure(view.summary.expected, 0) })}
            </p>
          )}
        </div>
        {view.groups.length > 0 && (
          <ul className="mt-3 grid gap-2 md:grid-cols-3">
            {view.groups.map((g) => (
              <li
                key={g.key}
                data-group-tile={g.key}
                data-tone={g.period.tone ?? 'none'}
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-row p-3 md:grid-cols-1',
                  g.period.tone ? TONE_FILL[g.period.tone] : 'bg-pill-grey text-pill-grey-ink',
                )}
              >
                <span className="text-sm font-bold md:order-1">{g.group?.name ?? t.noGroup}</span>
                <span className="row-span-2 text-2xl font-extrabold tabular-nums md:order-2 md:row-span-1 md:text-3xl">{pct(g.period.pct)}</span>
                <span className="text-sm font-semibold md:order-3">
                  {g.period.pct !== null && t.groupTile({ h: figure(g.period.hadir, 0), n: figure(g.period.expected, 0) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <PillTabs
          label={t.viewsLabel}
          tabs={[{ id: 'event', label: t.views.event }, { id: 'group', label: t.views.group }, { id: 'person', label: t.views.person }]}
          active={kind}
          onSelect={setKind}
          panelId={panelId}
        />
        {kind === 'group'
          ? <CompareWith view={view} value={compareIndex} onChange={setCompare} />
          : <p className="text-sm text-muted">{t.note({ n: figure(view.recordedEvents, 0) })}</p>}
      </div>

      <div id={panelId} role="tabpanel">
        {kind === 'event' && <PerEvent view={view} initialEvent={initialEvent} onRecorded={onRecorded} />}
        {kind === 'group' && <PerGroup view={view} compareIndex={compareIndex} />}
        {kind === 'person' && <PerOrang view={view} />}
      </div>
    </div>
  );
}

/**
 * ***Bandingkan dengan [event ▾]*** (P19.25-T1 AC-4): every recorded event of the period, newest first; the newest by
 * default. A native select in the page's pill, so it opens inside the screen on every device.
 */
function CompareWith({ view, value, onChange }: { view: Kehadiran; value: number | null; onChange: (index: number) => void }) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const id = useId();
  const options = recordedIndexes(view);
  if (options.length === 0 || value === null) return null;
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">{t.compareWith}</label>
      <span className="relative inline-flex min-w-0">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 max-w-[16rem] appearance-none truncate rounded-pill border border-hairline bg-card pl-4 pr-9 text-md font-semibold text-ink"
        >
          {options.map((i) => (
            <option key={view.past[i].eventId} value={i}>
              {`${view.past[i].title} · ${formatShortDay(view.past[i].startsOn, {}, language)}`}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink">⌄</span>
      </span>
    </span>
  );
}
