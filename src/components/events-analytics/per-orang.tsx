'use client';

import { useMemo, useState } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { PersonName } from '@/components/advanced-analytics/shared';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { cn } from '@/lib/cn';
import {
  FIRST_PEOPLE, sortPeople, stripIndexes, type Kehadiran, type KehadiranPerson, type PeopleSort,
} from '@/lib/event-analytics';
import { formatShortDay } from '@/lib/format';
import { usePhone } from '@/lib/use-phone';
import { NoDataLine, SeeAll, ThinBar, useFigureText } from './parts';

/**
 * ***Per orang*** (P19.25-T1 AC-5; ADR-0281 §3): every member, ***Hadir*** lowest first by default; the column headers
 * ***Nama · Terakhir hadir · Hadir*** sort (Hadir toggles lowest / highest first). After the name, **the last 15 events
 * as squares** (*"15 event terakhir · lama → baru"*): green hadir, pink tidak hadir, and no square for an event that was
 * not for them; hovering or tapping one shows the event, its date and *Hadir* / *Tidak hadir* **below the square**, so it
 * never covers the headers. *Terakhir hadir* is red when more than three events have passed since; *Hadir* is *"2 dari 12
 * event"* with a bar; WhatsApp for those who came to under half. Ten rows, then *Lihat semua*.
 */
export function PerOrang({ view }: { view: Kehadiran }) {
  const t = useMessages(eventAnalyticsMessages);
  const phone = usePhone();
  const figure = useFigureText();
  const [sort, setSort] = useState<PeopleSort>('hadir-asc');
  const [all, setAll] = useState(false);
  const order = useMemo(() => new Map(view.past.map((e, i) => [e.eventId, i])), [view.past]);
  const strip = useMemo(() => stripIndexes(view), [view]);
  // Every member now with an event they were expected at; somebody who has left is only named in an event's lists.
  const rows = useMemo(
    () => sortPeople(view.people.filter((p) => p.current && p.expected > 0), sort, order),
    [view.people, sort, order],
  );
  if (rows.length === 0) return <div className="rounded-card bg-card"><NoDataLine /></div>;
  const shown = all ? rows : rows.slice(0, FIRST_PEOPLE);

  const header = (key: 'nama' | 'last' | 'hadir', label: string) => {
    const on = key === 'hadir' ? sort.startsWith('hadir') : sort === key;
    const next: PeopleSort = key === 'hadir' ? (sort === 'hadir-asc' ? 'hadir-desc' : 'hadir-asc') : key;
    const glyph = !on ? '⇅' : key === 'hadir' ? (sort === 'hadir-asc' ? '↑' : '↓') : '↑';
    return (
      <button
        type="button"
        onClick={() => setSort(next)}
        aria-label={t.sortBy({ column: label })}
        className={cn('inline-flex min-h-11 items-center gap-1 text-sm font-bold', on ? 'text-navy' : 'text-muted')}
      >
        {label}
        <span aria-hidden="true" className={cn('text-xs', on && 'text-primary-ink')}>{glyph}</span>
      </button>
    );
  };
  const ariaSort = (key: 'nama' | 'last' | 'hadir') => {
    if (key === 'hadir' && sort.startsWith('hadir')) return sort === 'hadir-asc' ? 'ascending' : 'descending';
    return sort === key ? 'ascending' : 'none';
  };
  const stripLabel = t.colStrip({ n: figure(strip.length, 0) });

  return (
    <div data-part="per-orang">
      {/* No `overflow-hidden`: a square's tooltip opens below it and must not be cut at the card's foot. */}
      <div className="rounded-card bg-card">
        {phone ? (
          <>
            <div className="flex flex-wrap gap-2 border-b border-divider px-3 py-1">
              {header('nama', t.colName)}
              {header('last', t.colLast)}
              {header('hadir', t.colHadir)}
            </div>
            <ul>
              {shown.map((p) => (
                <li key={p.membershipId} className="border-b border-divider px-3 py-2.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <PersonName person={p} size={32} />
                    <span className="flex shrink-0 items-start gap-1">
                      <HadirCell person={p} />
                      <Wa person={p} />
                    </span>
                  </div>
                  <div className="mt-1.5 pl-[42px]">
                    <Strip view={view} person={p} indexes={strip} label={stripLabel} />
                    <LastCell view={view} person={p} order={order} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <table className="relative w-full table-fixed border-collapse">
            <caption className="sr-only">{t.views.person}</caption>
            <colgroup>
              <col className="w-[30%]" />
              <col />
              <col className="w-[17%]" />
              <col className="w-[18%]" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr className="border-b border-divider text-left">
                <th scope="col" aria-sort={ariaSort('nama')} className="py-1 pl-4 font-normal">{header('nama', t.colName)}</th>
                <th scope="col" className="py-1 text-sm font-bold text-muted">{stripLabel}</th>
                <th scope="col" aria-sort={ariaSort('last')} className="py-1 pl-3 font-normal">{header('last', t.colLast)}</th>
                <th scope="col" aria-sort={ariaSort('hadir')} className="py-1 font-normal">{header('hadir', t.colHadir)}</th>
                <th scope="col"><span className="sr-only">WhatsApp</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.membershipId} className="border-b border-divider align-middle last:border-b-0">
                  <td className="py-2 pl-4 pr-2"><PersonName person={p} size={28} nameClassName="lg:truncate" /></td>
                  <td className="py-2 pr-2"><Strip view={view} person={p} indexes={strip} label={stripLabel} /></td>
                  <td className="py-2 pl-3 pr-2"><LastCell view={view} person={p} order={order} /></td>
                  <td className="py-2 pr-2"><HadirCell person={p} wide /></td>
                  <td className="py-2 pr-2 text-right"><Wa person={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > FIRST_PEOPLE && <SeeAll n={rows.length} open={all} onToggle={() => setAll((v) => !v)} />}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-signal-green" />{t.legendCame}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] border border-signal-red/50 bg-pill-red" />{t.legendMissed}</span>
      </p>
    </div>
  );
}

/**
 * The squares, oldest to newest. A square is a button that takes no Tab stop — a tap or a hover shows its tooltip, below
 * it; the strip as a whole is described once for a screen reader (the share is in *Hadir* beside it).
 */
function Strip({ view, person, indexes, label }: { view: Kehadiran; person: KehadiranPerson; indexes: readonly number[]; label: string }) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const figure = useFigureText();
  return (
    <span
      role="img"
      aria-label={`${label}: ${t.attendedRecentOf({ x: figure(person.recentAttended, 0), n: figure(person.recentExpected, 0) })}`}
      className="inline-flex gap-[3px]"
    >
      {indexes.map((i) => {
        const mark = person.marks[i];
        const event = view.past[i];
        if (mark !== '1' && mark !== '0') return <span key={event.eventId} aria-hidden="true" className="h-3 w-3" />;
        return (
          <button
            key={event.eventId}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-mark={mark}
            className={cn(
              'group relative h-3 w-3 rounded-[2px] focus:outline-none hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-secondary focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring',
              mark === '1' ? 'bg-signal-green' : 'border border-signal-red/50 bg-pill-red',
            )}
          >
            <span className="pointer-events-none absolute left-1/2 top-[17px] z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-secondary px-2 py-1.5 text-left text-xs text-secondary-contrast shadow-lg group-hover:block group-focus:block">
              {t.squareDate({ title: event.title, date: formatShortDay(event.startsOn, {}, language) })}
              <b className="block">{mark === '1' ? t.hadir : t.tidakHadir}</b>
            </span>
          </button>
        );
      })}
    </span>
  );
}

/** *Terakhir hadir*: the event and its short date, red when more than three events have passed since; *Belum pernah*. */
function LastCell({ view, person, order }: { view: Kehadiran; person: KehadiranPerson; order: ReadonlyMap<string, number> }) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const index = person.lastEventId === null ? undefined : order.get(person.lastEventId);
  const event = index === undefined ? null : view.past[index];
  return (
    <span className={cn('block min-w-0 text-sm', person.stale ? 'text-signal-red' : 'text-navy')} data-stale={person.stale || undefined}>
      <span className="block truncate">{event ? event.title : t.never}</span>
      {event && <span className="block text-xs text-muted">{formatShortDay(event.startsOn, {}, language)}</span>}
    </span>
  );
}

/** *Hadir*: *"2 dari 12 event"* with a thin bar in the share's colour. */
function HadirCell({ person, wide = false }: { person: KehadiranPerson; wide?: boolean }) {
  const t = useMessages(eventAnalyticsMessages);
  const figure = useFigureText();
  return (
    <span className={cn('flex flex-col gap-1', wide ? 'w-full' : 'w-24')}>
      <span className="whitespace-nowrap text-sm text-muted">
        <b className="text-md font-extrabold text-navy">{figure(person.attended, 0)}</b> {t.ofEvents({ n: figure(person.expected, 0) })}
      </span>
      <ThinBar pct={person.pct} tone={person.tone} className="max-w-[9rem]" />
    </span>
  );
}

/** WhatsApp for a member who came to under half the events they were expected at. */
function Wa({ person }: { person: KehadiranPerson }) {
  if (!person.underHalf) return null;
  return <MemberContactButtons membershipId={person.membershipId} name={person.name} phone={person.phone} channels={['whatsapp']} size={36} />;
}
