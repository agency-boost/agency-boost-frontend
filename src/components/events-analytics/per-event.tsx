'use client';

import dynamic from 'next/dynamic';
import { Fragment, useState, type ReactNode } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { PersonName } from '@/components/advanced-analytics/shared';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { cn } from '@/lib/cn';
import {
  eventPeople, FIRST_ROWS, whatsAppShareHref,
  type Kehadiran, type KehadiranPerson, type PastEventRow, type UpcomingEventRow,
} from '@/lib/event-analytics';
import { formatCalendarDay, formatWeekday } from '@/lib/format';
import { whatsAppHref } from '@/lib/phone-number';
import { usePhone } from '@/lib/use-phone';
import {
  AvatarStack, BlockHead, NoDataLine, SeeAll, ThinBar, toneText, useFigureText, usePercentText, WhatsAppLink,
} from './parts';

/** The roll call in a dialog, loaded the first time *Catat kehadiran* is pressed. */
const RollCallDialog = dynamic(() => import('./roll-call-dialog').then((m) => m.RollCallDialog), { ssr: false });

type Selected = { kind: 'past'; index: number } | { kind: 'upcoming'; index: number } | null;

/** *Kam, 20 Nov 2026* — the weekday, then the day, in the reader's figures. */
function useEventDate(): (day: string) => string {
  const language = useFigureLanguage();
  return (day) => `${formatWeekday(day, language)}, ${formatCalendarDay(day, language)}`;
}

/** *Hari ini* · *Besok* · *n hari lagi*, a capital first letter (`DATA-DEFINITIONS.md`, *Dates and numbers*). */
function useDaysWord(): (days: number) => string {
  const t = useMessages(eventAnalyticsMessages);
  const figure = useFigureText();
  return (days) => (days <= 0 ? t.today : days === 1 ? t.tomorrow : t.inDays({ n: figure(days, 0) }));
}

/**
 * ***Per event*** (P19.25-T1 AC-3; ADR-0281 §2, §3): ***Akan datang*** — the office's events not yet ended, soonest
 * first, each with its type and date, *Besok* / *n hari lagi*, and WhatsApp to remind everyone — then ***Sudah lewat***,
 * newest first: the share hadir, *hadir n/30* and a bar, six and *Lihat semua (n)*. **Tapping a row never scrolls the
 * page**: on a tablet and a laptop its detail fills the column beside the list, which stays in view (sticky); on a phone
 * it opens right under the row.
 */
export function PerEvent({ view, initialEvent, onRecorded }: { view: Kehadiran; initialEvent?: string; onRecorded: () => void }) {
  const t = useMessages(eventAnalyticsMessages);
  const phone = usePhone();
  const pct = usePercentText();
  const figure = useFigureText();
  const date = useEventDate();
  const daysWord = useDaysWord();
  const language = useFigureLanguage();
  const initialPast = initialEvent ? view.past.findIndex((e) => e.eventId === initialEvent) : -1;
  const [selected, setSelected] = useState<Selected>(initialPast >= 0 ? { kind: 'past', index: initialPast } : null);
  const [allPast, setAllPast] = useState(initialPast >= FIRST_ROWS);
  const [recording, setRecording] = useState<PastEventRow | null>(null);

  // A tablet and a laptop always show a detail: the one chosen, or the newest past event.
  const shown: Selected = selected ?? (phone ? null : view.past.length > 0 ? { kind: 'past', index: 0 } : view.upcoming.length > 0 ? { kind: 'upcoming', index: 0 } : null);
  const isOn = (kind: 'past' | 'upcoming', index: number) => shown?.kind === kind && shown.index === index;
  const toggle = (kind: 'past' | 'upcoming', index: number) =>
    setSelected((s) => (phone && s?.kind === kind && s.index === index ? null : { kind, index }));

  const detail = shown === null ? null : shown.kind === 'past'
    ? <PastDetail view={view} index={shown.index} onRecord={view.canRecord ? setRecording : undefined} />
    : <UpcomingDetail view={view} event={view.upcoming[shown.index]} />;
  const under = (kind: 'past' | 'upcoming', index: number) => (phone && isOn(kind, index) ? (
    <div data-detail-under="" className="border-t border-divider bg-base px-3 py-3">{detail}</div>
  ) : null);

  const pastShown = allPast ? view.past : view.past.slice(0, FIRST_ROWS);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="min-w-0">
        {view.upcoming.length > 0 && (
          <>
            <BlockHead>{t.upcoming}</BlockHead>
            <ul className="overflow-hidden rounded-card bg-card" data-list="upcoming">
              {view.upcoming.map((e, i) => (
                <li key={e.eventId} className="border-b border-divider last:border-b-0">
                  <div className={cn('relative flex items-center gap-3 px-3.5 py-2.5', isOn('upcoming', i) && 'bg-today before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[""]')}>
                    <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-row bg-secondary-50 text-navy">
                      <LineIcon name="calendar" className="h-5 w-5" />
                    </span>
                    <button
                      type="button"
                      aria-pressed={isOn('upcoming', i)}
                      onClick={() => toggle('upcoming', i)}
                      className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="block truncate font-bold text-ink">{e.title}</span>
                      <span className="block truncate text-sm text-muted">{`${e.type.label} · ${date(e.startsOn)}`}</span>
                    </button>
                    <span className="shrink-0 rounded-pill bg-secondary-50 px-2.5 py-1 text-sm font-bold text-navy">{daysWord(e.daysUntil)}</span>
                    <WhatsAppLink
                      size={30}
                      label={t.remindAll({ title: e.title })}
                      href={whatsAppShareHref(t.remindAllText({ title: e.title, date: date(e.startsOn) }))}
                    />
                  </div>
                  {under('upcoming', i)}
                </li>
              ))}
            </ul>
          </>
        )}

        <BlockHead>{t.past}</BlockHead>
        <div className="overflow-hidden rounded-card bg-card" data-list="past">
          {view.past.length === 0 ? <NoDataLine /> : (
            <ul>
              {pastShown.map((e, i) => (
                <li key={e.eventId} className="border-b border-divider last:border-b-0">
                  <div className={cn('relative px-4 py-3', isOn('past', i) && 'bg-today before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[""]')}>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-pressed={isOn('past', i)}
                        onClick={() => toggle('past', i)}
                        className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
                      >
                        <span className="block truncate font-bold text-ink">{e.title}</span>
                        <span className="block truncate text-sm text-muted">{`${e.type.label} · ${formatCalendarDay(e.startsOn, language)}`}</span>
                      </button>
                      {e.figure ? (
                        <>
                          <span className={cn('w-14 shrink-0 text-right text-xl font-extrabold tabular-nums', toneText(e.figure.tone))}>{pct(e.figure.pct)}</span>
                          <span className="w-14 shrink-0 text-right text-sm text-muted">
                            {t.came}
                            <span className="block text-md font-bold tabular-nums text-navy">{`${figure(e.figure.hadir, 0)}/${figure(e.figure.expected, 0)}`}</span>
                          </span>
                        </>
                      ) : (
                        <span className="shrink-0 rounded-pill bg-pill-grey px-2.5 py-1 text-sm font-semibold text-pill-grey-ink">{t.notRecorded}</span>
                      )}
                    </div>
                    {e.figure && <ThinBar pct={e.figure.pct} tone={e.figure.tone} className="mt-2" />}
                  </div>
                  {under('past', i)}
                </li>
              ))}
            </ul>
          )}
          {view.past.length > FIRST_ROWS && <SeeAll n={view.past.length} open={allPast} onToggle={() => setAllPast((v) => !v)} />}
        </div>
      </div>

      {!phone && (
        <aside data-detail="" className="min-w-0 md:sticky md:top-4">
          {detail}
        </aside>
      )}

      {recording && (
        <RollCallDialog
          eventId={recording.eventId}
          title={recording.title}
          onClose={() => setRecording(null)}
          onSaved={onRecorded}
        />
      )}
    </div>
  );
}

/** One person on a detail's list: photo, label, NAME, a grey line, and what sits on the right. */
function PersonLine({ person, meta, trailing }: { person: KehadiranPerson; meta: ReactNode; trailing?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-divider px-4 py-1.5 last:border-b-0">
      <PersonName person={person} size={28} meta={meta} />
      {trailing}
    </li>
  );
}

/**
 * **A past event's detail** (P19.25-T1 AC-3): *"<event> · 80% hadir"*; ***Tidak hadir · n*** — each with their photo,
 * *"hadir x dari n event"* and WhatsApp, four and *Lihat semua (n)* — and ***Hadir · n*** as an avatar stack. An event
 * whose roll call has not been taken says so; whoever may take it finds *Catat kehadiran ›*.
 */
function PastDetail({ view, index, onRecord }: { view: Kehadiran; index: number; onRecord?: (event: PastEventRow) => void }) {
  const t = useMessages(eventAnalyticsMessages);
  const pct = usePercentText();
  const figure = useFigureText();
  const [all, setAll] = useState(false);
  const event = view.past[index];
  if (!event) return null;
  const record = onRecord && (
    <div className="border-t border-divider px-4 text-center">
      <button type="button" onClick={() => onRecord(event)} className="min-h-11 text-sm font-bold text-navy">
        {event.recorded ? t.changeRecord : t.record}
      </button>
    </div>
  );
  if (!event.figure) {
    return (
      <section aria-label={event.title}>
        <BlockHead>{event.title}</BlockHead>
        <div className="overflow-hidden rounded-card bg-card">
          <p className="px-4 py-4 text-md text-muted">{t.notRecordedNote}</p>
          {record}
        </div>
      </section>
    );
  }
  const { hadir, tidak } = eventPeople(view, index);
  const shown = all ? tidak : tidak.slice(0, 4);
  return (
    <section aria-label={event.title}>
      <BlockHead>{t.detailTitle({ title: event.title, pct: pct(event.figure.pct) })}</BlockHead>
      <div className="overflow-hidden rounded-card bg-card">
        <h4 className="px-4 pb-1 pt-3 text-md font-bold text-ink">{t.absentTitle({ n: figure(tidak.length, 0) })}</h4>
        <ul>
          {shown.map((p) => (
            <PersonLine
              key={p.membershipId}
              person={p}
              meta={t.attendedOf({ x: figure(p.attended, 0), n: figure(p.expected, 0) })}
              trailing={p.current && (
                <MemberContactButtons
                  membershipId={p.membershipId}
                  name={p.name}
                  phone={p.phone}
                  channels={['whatsapp']}
                  size={36}
                  whatsAppText={t.missedText({ name: p.name, title: event.title })}
                />
              )}
            />
          ))}
        </ul>
        {tidak.length > 4 && <SeeAll n={tidak.length} open={all} onToggle={() => setAll((v) => !v)} />}
        <div className="border-t border-divider px-4 py-3">
          <h4 className="text-md font-bold text-ink">{t.presentTitle({ n: figure(hadir.length, 0) })}</h4>
          {hadir.length > 0 && <AvatarStack people={hadir} />}
        </div>
        {record}
      </div>
    </section>
  );
}

/**
 * **A planned event's detail** (P19.25-T1 AC-3; ADR-0281 §2): the answers to its invitation — ***Akan ikut · Tidak ikut ·
 * Belum jawab*** as three tiles — then *Belum jawab · n* with ***Ingatkan n orang*** (each by WhatsApp, from the reader's
 * own, OD-359) and the people, *Akan ikut* as an avatar stack, and *Tidak ikut* with the reason each gave.
 */
function UpcomingDetail({ view, event }: { view: Kehadiran; event: UpcomingEventRow | undefined }) {
  const t = useMessages(eventAnalyticsMessages);
  const figure = useFigureText();
  const date = useEventDate();
  const daysWord = useDaysWord();
  const [all, setAll] = useState(false);
  const [reminding, setReminding] = useState(false);
  if (!event) return null;
  const byId = new Map(view.people.map((p) => [p.membershipId, p]));
  const people = (ids: readonly string[]) => ids.map((id) => byId.get(id)).filter((p): p is KehadiranPerson => p !== undefined);
  const pending = people(event.pending);
  const going = people(event.going);
  const declined = event.declined.map((d) => ({ person: byId.get(d.membershipId), reason: d.reason }))
    .filter((d): d is { person: KehadiranPerson; reason: string | null } => d.person !== undefined);
  const shown = all ? pending : pending.slice(0, 3);
  const recentLine = (p: KehadiranPerson) => t.attendedRecentOf({ x: figure(p.recentAttended, 0), n: figure(p.recentExpected, 0) });
  const tiles: [string, number, string][] = [
    ['going', going.length, 'bg-pill-green text-pill-green-ink'],
    ['declined', declined.length, 'bg-pill-red text-pill-red-ink'],
    ['pending', pending.length, 'bg-pill-grey text-navy'],
  ];
  return (
    <section aria-label={event.title}>
      <BlockHead>{`${event.title} · ${daysWord(event.daysUntil)}`}</BlockHead>
      <div className="overflow-hidden rounded-card bg-card">
        <div className="px-4 pt-3">
          <ul className="grid grid-cols-3 gap-2">
            {tiles.map(([key, n, tone]) => (
              <li key={key} data-answer={key} className={cn('rounded-row px-3 py-2', tone)}>
                <span className="block text-xl font-extrabold tabular-nums">{figure(n, 0)}</span>
                <span className="block text-sm font-semibold">{t[key as 'going' | 'declined' | 'pending']}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 pb-2 text-sm text-muted">{`${event.type.label} · ${date(event.startsOn)}`}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-divider px-4 py-1.5">
          <h4 className="text-md font-bold text-ink">{t.pendingTitle({ n: figure(pending.length, 0) })}</h4>
          {pending.length > 0 && (
            <button
              type="button"
              onClick={() => setReminding(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-whatsapp px-3.5 text-sm font-bold text-white"
            >
              <LineIcon name="whatsapp" className="h-4 w-4" />
              {t.remindN({ n: figure(pending.length, 0) })}
            </button>
          )}
        </div>
        <ul>
          {shown.map((p) => (
            <PersonLine
              key={p.membershipId}
              person={p}
              meta={recentLine(p)}
              trailing={(
                <MemberContactButtons
                  membershipId={p.membershipId}
                  name={p.name}
                  phone={p.phone}
                  channels={['whatsapp']}
                  size={36}
                  whatsAppText={t.inviteText({ name: p.name, title: event.title, date: date(event.startsOn) })}
                />
              )}
            />
          ))}
        </ul>
        {pending.length > 3 && <SeeAll n={pending.length} open={all} onToggle={() => setAll((v) => !v)} />}
        <div className="border-t border-divider px-4 py-3">
          <h4 className="text-md font-bold text-ink">{t.goingTitle({ n: figure(going.length, 0) })}</h4>
          {going.length > 0 && <AvatarStack people={going} />}
        </div>
        <div className="border-t border-divider">
          <h4 className="px-4 pb-1 pt-3 text-md font-bold text-ink">{t.declinedTitle({ n: figure(declined.length, 0) })}</h4>
          <ul>
            {declined.map(({ person, reason }) => (
              <PersonLine
                key={person.membershipId}
                person={person}
                meta={recentLine(person)}
                trailing={<span className="max-w-[45%] text-right text-sm text-muted">{reason ?? t.noReason}</span>}
              />
            ))}
          </ul>
        </div>
      </div>
      {reminding && (
        <ResponsiveSheet open title={t.remindTitle({ title: event.title })} onClose={() => setReminding(false)}>
          <ul className="divide-y divide-divider">
            {pending.map((p) => {
              const href = whatsAppHref(p.phone, t.inviteText({ name: p.name, title: event.title, date: date(event.startsOn) }));
              return (
                <Fragment key={p.membershipId}>
                  <li className="flex items-center justify-between gap-3 py-2">
                    <PersonName person={p} size={32} meta={recentLine(p)} />
                    {href
                      ? <WhatsAppLink href={href} label={t.remindWhatsApp({ name: p.name })} />
                      : <span className="shrink-0 text-sm text-muted">{t.noPhone}</span>}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </ResponsiveSheet>
      )}
    </section>
  );
}
