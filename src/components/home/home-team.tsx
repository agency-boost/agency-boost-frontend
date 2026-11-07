'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import { LineIcon } from '@/components/ui/line-icon';
import { PersonRow } from '@/components/ui/person-row';
import { SectionHead } from '@/components/ui/section-title';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import {
  FIRST_AGENT_HREF, firstNameOf, HOME_TEAM_SHOWN, logLink, reportedOn, TEAM_REPORT_ALL_HREF, teamIn,
  type HomeScope, type HomeTeamPerson,
} from '@/lib/home';
import { useCan } from '@/lib/session';

/**
 * ***Laporan aktivitas tim*** (UI-101, D-22 as updated; P19.8-T2 AC-8, AC-9; ADR-0228 §6; MOB UI-165, UI-166): **every
 * leader's, by role** — one row per person in the reader's *Unit* or *Group*, the reader left out, with yesterday's and
 * today's activity and a WhatsApp reminder. *Laporan tim* until the owner's copy change of 7 November, at every size.
 *
 * - **The order is the server's** (`GET /home`: nobody-reported first, then not today, then the rest), filtered to the
 *   chosen scope; **five shown, then *Semua ›***, which opens the Unit Dashboard's *Aktivitas* tab
 *   (`/unit/dashboard?tab=activities`, OD-278's default) where it opened the rest in place.
 * - **A day**: the orange count where they reported, a **grey ✕** where not — its name *Belum lapor* — where a two-line
 *   *Belum lapor* pill wrapped twice a row. A saved day of nothing is a ✕ too (ADR-0042), as the pill was.
 * - **The row** (the mockup's grid): avatar 32 · the name, **never cut** — two lines on a phone (`PersonRow`, P19.8-T1
 *   AC-5) — 13px / 700 · the two 52px days · the 36px WhatsApp, 10px apart: about 107px of name at 375px.
 * - **Nobody in the chosen scope**: the card holds one line, ***Tambah agent pertama →***, to New Hires, where *+ Tambah
 *   agent* is (MOB UI-166: the next step lives here, never in a tile).
 * - **The reminder** (`MemberContactButtons`, WhatsApp only), unchanged (D-22): *Halo {first name} 👋 Aktivitas hari ini
 *   belum diisi …* — *kemarin & hari ini* when they reported neither day — with the link to today's Log Activity, signed
 *   by the reader's first name. **No number**: *Isi nomor WhatsApp*, saved on their account; a reader who may not save
 *   one (`member:update_phone`, the AB's and the AAB's) gets no button on a row with none.
 */
export function HomeTeam({
  team, leaderName, className,
}: { team: readonly HomeTeamPerson[]; leaderName: string; className?: string }) {
  const t = useMessages(homeMessages).team;
  const [scope, setScope] = useState<HomeScope>('unit');
  const [phones, setPhones] = useState<Record<string, string>>({});
  const people = useMemo(() => teamIn(team, scope), [team, scope]);
  const shown = people.slice(0, HOME_TEAM_SHOWN);
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const leader = firstNameOf(leaderName);
  // Saving somebody's number is an AB's and an AAB's, for their downline (`member:update_phone`): a leader on another
  // rung reminds those whose number is on file, and is offered no sheet the API would refuse.
  const canSavePhone = useCan('member:update_phone');

  return (
    <section data-home-team="" aria-labelledby="home-team" className={className}>
      <SectionHead id="home-team" title={t.heading}>
        <ScopePill
          label={t.scopeLabel}
          value={scope}
          onChange={setScope}
          options={[{ id: 'unit', label: t.unit }, { id: 'group', label: t.group }]}
        />
      </SectionHead>
      <div className="overflow-hidden rounded-lg bg-card">
        {people.length === 0 ? (
          <p className="px-3.5 py-3 text-center">
            <Link
              href={FIRST_AGENT_HREF}
              data-first-agent=""
              className="inline-flex min-h-11 items-center text-base font-semibold text-primary-ink hover:underline"
            >
              {t.firstAgent}
            </Link>
          </p>
        ) : (
          <>
            <div aria-hidden="true" className="flex items-center justify-end gap-2.5 px-3 pt-2 text-sm text-muted">
              <span className="w-[3.25rem] text-center">{t.yesterday}</span>
              <span className="w-[3.25rem] text-center">{t.today}</span>
              <span className="w-9" />
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
                      height={60}
                      avatarSize={32}
                      className="gap-2.5 rounded-none bg-transparent py-1.5 lg:hover:bg-transparent"
                      nameClassName="text-md max-md:text-base md:max-lg:text-md lg:text-md"
                      trailing={(
                        <div className="flex shrink-0 items-center gap-2.5">
                          <DayCell label={t.yesterdayLong} count={person.yesterday} notReported={t.notReported} />
                          <DayCell label={t.today} count={person.today} notReported={t.notReported} />
                          {(canSavePhone || phones[person.membershipId] || person.phone) ? (
                            // A 36px circle in a 36px column; its 44px target reaches 4px into the 10px gap either side.
                            <span className="-mx-1 flex">
                            <MemberContactButtons
                              membershipId={person.membershipId}
                              name={person.name}
                              phone={phones[person.membershipId] ?? person.phone}
                              channels={['whatsapp']}
                              size={36}
                              whatsAppText={t.reminder({ name: firstNameOf(person.name), both, link: logLink(host), leader })}
                              onSaved={(stored) => setPhones((was) => ({ ...was, [person.membershipId]: stored }))}
                            />
                            </span>
                          ) : <span className="w-9" aria-hidden="true" />}
                        </div>
                      )}
                    />
                  </li>
                );
              })}
            </ul>
            {people.length > HOME_TEAM_SHOWN && (
              <Link
                href={TEAM_REPORT_ALL_HREF}
                data-team-all=""
                aria-label={t.allLabel({ n: people.length })}
                className="flex min-h-11 w-full items-center justify-center gap-0.5 border-t border-divider text-md font-semibold text-muted hover:text-navy"
              >
                {t.all}
                <LineIcon name="chevronRight" className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * **One day's cell, 52px** (MOB UI-165, D-22): the orange count on its tint where they reported, a ~20px grey ✕ named
 * *Belum lapor* where not; each named for a screen reader by its day.
 */
function DayCell({ label, count, notReported }: { label: string; count: number | null; notReported: string }) {
  const figures = useFigureLanguage();
  const logged = reportedOn(count);
  return (
    <span className="flex w-[3.25rem] justify-center">
      <span className="sr-only">{label}: </span>
      {logged ? (
        <span
          data-logged="true"
          className="inline-flex h-7 min-w-[2.125rem] items-center justify-center rounded-pill bg-primary-50 px-2 text-md font-bold tabular-nums text-primary-deep"
        >
          {formatNumber(count!, {}, figures)}
        </span>
      ) : (
        <span data-logged="false" role="img" aria-label={notReported} className="flex h-7 items-center justify-center text-signal-grey">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
      )}
    </span>
  );
}

/**
 * *Unit | Group*: two toggle buttons, one pressed, on white (the Unit Dashboard's pill, UI-001) — a header control, 13px /
 * 600 / 44px at every size (P19.8-T1 AC-1; MOB UI-171, ADR-0227 §1), where it was 12px and 32px tall on a laptop.
 */
function ScopePill({
  label, value, onChange, options,
}: {
  label: string; value: HomeScope; onChange: (next: HomeScope) => void;
  options: readonly { id: HomeScope; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-pill bg-card">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            HEADER_CONTROL,
            'whitespace-nowrap rounded-pill px-3.5',
            value === option.id ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
