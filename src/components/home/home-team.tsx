'use client';

import { useMemo, useState } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { ActivityPill } from '@/components/ui/activity-pill';
import { LineIcon } from '@/components/ui/line-icon';
import { PersonRow } from '@/components/ui/person-row';
import { useMessages } from '@/i18n/language-provider';
import { useCan } from '@/lib/session';
import { homeMessages } from '@/i18n/messages/home';
import { cn } from '@/lib/cn';
import {
  firstNameOf, HOME_TEAM_SHOWN, logLink, reportedOn, teamIn, type HomeScope, type HomeTeamPerson,
} from '@/lib/home';
import { SectionHeading } from './home-actions';

/**
 * ***Laporan tim*** (UI-101, D-22; leaders only): one row per person in the reader's *Unit* or *Group* — the reader
 * left out — with yesterday's and today's activity pill (`ActivityPill`, the Group Tree's, the same count) and a
 * WhatsApp reminder.
 *
 * - **The order is the server's** (`GET /home`: nobody-reported first, then not today, then the rest), filtered to the
 *   chosen scope; **five shown, then *Semua ›*** opens the rest in place.
 * - **Rows of 56px that never scroll sideways**: avatar, NAME (one line, *…*), two 52px day cells, the 44px WhatsApp.
 * - **The reminder** (`MemberContactButtons`, WhatsApp only): *Halo {first name} 👋 Aktivitas hari ini belum diisi …* —
 *   *kemarin & hari ini* when they reported neither day — with the link to today's Log Activity, signed by the reader's
 *   first name. Shown for everybody, whether they logged or not. **No number**: *Isi nomor WhatsApp*, saved on their
 *   account (`PUT /members/:membershipId/phone`), and the next tap goes straight through. A reader who may not save a
 *   number (`member:update_phone`, the AB's and the AAB's) gets no button on a row with none.
 */
export function HomeTeam({
  team, leaderName, className,
}: { team: readonly HomeTeamPerson[]; leaderName: string; className?: string }) {
  const t = useMessages(homeMessages).team;
  const [scope, setScope] = useState<HomeScope>('unit');
  const [all, setAll] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const people = useMemo(() => teamIn(team, scope), [team, scope]);
  const shown = all ? people : people.slice(0, HOME_TEAM_SHOWN);
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const leader = firstNameOf(leaderName);
  // Saving somebody's number is an AB's and an AAB's, for their downline (`member:update_phone`): a leader on another
  // rung reminds those whose number is on file, and is offered no sheet the API would refuse.
  const canSavePhone = useCan('member:update_phone');

  return (
    <section data-home-team="" aria-labelledby="home-team" className={className}>
      <SectionHeading id="home-team" title={t.heading}>
        <ScopePill
          label={t.scopeLabel}
          value={scope}
          onChange={(next) => { setScope(next); setAll(false); }}
          options={[{ id: 'unit', label: t.unit }, { id: 'group', label: t.group }]}
        />
      </SectionHeading>
      <div className="overflow-hidden rounded-lg bg-card pb-0.5">
        {people.length === 0 ? (
          <p className="px-4 py-5 text-center text-md text-muted">{t.empty}</p>
        ) : (
          <>
            <div aria-hidden="true" className="flex items-center justify-end px-3 pt-2 text-xs text-muted">
              <span className="w-[3.25rem] text-center">{t.yesterday}</span>
              <span className="w-[3.25rem] text-center">{t.today}</span>
              <span className="w-11" />
            </div>
            <ul>
              {shown.map((person) => {
                const both = !reportedOn(person.yesterday) && !reportedOn(person.today);
                return (
                  <li key={person.membershipId} className="border-t border-divider first:border-t-0">
                    <PersonRow
                      name={person.name}
                      photoUrl={person.photoUrl}
                      seed={person.membershipId}
                      height={56}
                      className="gap-2 rounded-none bg-transparent lg:hover:bg-transparent"
                      nameClassName="text-md md:max-lg:text-md lg:text-md"
                      trailing={(
                        <div className="flex shrink-0 items-center">
                          <DayCell label={t.yesterdayLong} count={person.yesterday} />
                          <DayCell label={t.today} count={person.today} />
                          {(canSavePhone || phones[person.membershipId] || person.phone) ? (
                          <MemberContactButtons
                            membershipId={person.membershipId}
                            name={person.name}
                            phone={phones[person.membershipId] ?? person.phone}
                            channels={['whatsapp']}
                            size={36}
                            whatsAppText={t.reminder({ name: firstNameOf(person.name), both, link: logLink(host), leader })}
                            onSaved={(stored) => setPhones((was) => ({ ...was, [person.membershipId]: stored }))}
                          />
                          ) : <span className="w-11" aria-hidden="true" />}
                        </div>
                      )}
                    />
                  </li>
                );
              })}
            </ul>
            {!all && people.length > HOME_TEAM_SHOWN && (
              <button
                type="button"
                aria-expanded={false}
                aria-label={t.allLabel({ n: people.length })}
                onClick={() => setAll(true)}
                className="flex min-h-11 w-full items-center justify-center gap-0.5 border-t border-divider text-md font-semibold text-muted hover:text-navy lg:min-h-9"
              >
                {t.all}
                <LineIcon name="chevronRight" className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** One day's cell, 52px: the orange count or a two-line grey *Belum lapor*, named for a screen reader by its day. */
function DayCell({ label, count }: { label: string; count: number | null }) {
  return (
    <span className="flex w-[3.25rem] justify-center">
      <span className="sr-only">{label}: </span>
      <ActivityPill count={count} short stacked />
    </span>
  );
}

/** *Unit | Group*: two toggle buttons, one pressed, on white (the Unit Dashboard's pill, UI-001). */
function ScopePill({
  label, value, onChange, options,
}: {
  label: string; value: HomeScope; onChange: (next: HomeScope) => void;
  options: readonly { id: HomeScope; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-pill bg-card p-[3px]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'min-h-11 whitespace-nowrap rounded-pill px-3 text-sm font-semibold lg:min-h-8',
            value === option.id ? 'bg-navy text-white' : 'text-muted hover:text-navy',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
