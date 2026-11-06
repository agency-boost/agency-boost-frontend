'use client';

import { kept } from '@/i18n/kept';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { membersMessages } from '@/i18n/messages/members';
import { ListCard } from '@/components/ui/list-rows';
import { PersonRow } from '@/components/ui/person-row';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { TonePill } from '@/components/ui/tone-pill';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { formatCalendarDay, formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { daysAgoWords } from '@/lib/kpm-overview';
import type { Member } from '@/lib/org';

/**
 * **What *within 7 days* is, for the last-activity pill** (UI-140: *last-activity pill, orange within 7 days, grey
 * older*): the office's rolling week, `PERIOD.ROLLING_7D_DAYS` — seven days ending today, so a last log 0 to 6 days ago
 * is inside it. **A frontend copy, held to the backend's** by `member-rows.spec.ts`, which reads
 * `backend/src/domain/constants/index.ts` and fails when the two differ — `OFFICE_TIME_ZONE`'s exception (invariant §7;
 * `metrics-and-definitions.md`, *TENANT_TIMEZONE_DEFAULT has one frontend copy*). The days themselves are the server's,
 * counted in the office's calendar.
 */
export const RECENT_ACTIVITY_DAYS = 7;

/** Inside the office's rolling week: a log today is 0 days ago, the week's first day 6. */
export const loggedRecently = (days: number | null | undefined): boolean =>
  typeof days === 'number' && days < RECENT_ACTIVITY_DAYS;

/** A leader's first name, for *ke Wilson* (UI-140: *ke <leader first name>*). */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/**
 * **The roster as the shared person rows, on a phone and a tablet** (P19.2-T3 AC-2; UI-140, `kpm-owner-mobile` screen
 * 4): one 56px row per member in the roster's order — the avatar, the NAME in capitals, *kode · peran · ke <leader's
 * first name>* (*Owner* or *Admin* in place of the leader for the office's Owner and its Admins), the last-activity
 * pill and a ›. **The whole row opens the member's page**, where everything the table's other columns said is read
 * and the *Core Leader* tag is set (*Tags*). ADR-0178 §4's card below 768px, and the sideways table from 768 to
 * 1023px, become this row; from 1024px the table is as it was.
 *
 * - **Directory:** *Bergabung kembali* beside the name of somebody who left and came back, as the table's status
 *   cell says it (P18.9-T4 AC-3), so a *Removed* row holding her earlier membership is not read as a contradiction.
 * - **Removed:** the day they left, a grey pill, in place of the activity; *Bergabung kembali {date}* in place of
 *   their leader on the membership they left.
 */
export function MemberRows({ members, removed }: { members: readonly Member[]; removed: boolean }) {
  const t = useMessages(membersMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const ladder = useLadder();

  /** *Owner*, *Admin*, *ke Wilson*, or nothing for somebody who reports to nobody. */
  const reach = (m: Member) => {
    if (m.isKpmOwner) return kept('Owner');
    if (m.isKpmAdmin) return kept('Admin');
    return m.leaderName ? t.roster.under({ name: firstName(m.leaderName) }) : null;
  };

  return (
    <ListCard label={removed ? t.roster.removedCaption : t.roster.caption}>
      {members.map((m) => {
        const parts = [m.agentCode, rungShort(m.orgLevelCode ?? m.role, ladder)];
        const rejoined = m.rejoinedOn
          ? <time dateTime={m.rejoinedOn}>{formatCalendarDay(m.rejoinedOn, figures)}</time>
          : null;
        const meta = (
          <span className="truncate">
            {parts.join(' · ')}
            {removed && rejoined
              ? <> · {t.roster.rejoinedOn({ date: rejoined })}</>
              : reach(m) && ` · ${reach(m)}`}
          </span>
        );
        return (
          <li key={m.membershipId} data-row={m.membershipId}>
            <PersonRow
              name={displayName(m)}
              seed={m.membershipId}
              href={`/people/members/${m.membershipId}`}
              chevron
              meta={meta}
              badge={!removed && m.rejoinedOn ? <TonePill tone="grey">{t.roster.rejoined}</TonePill> : undefined}
              trailing={removed
                ? m.removedAt
                  ? (
                    <TonePill tone="grey">
                      <span className="sr-only">{t.roster.columns.removed} </span>
                      <time dateTime={m.removedAt}>{formatOfficeDay(m.removedAt, OFFICE_TIME_ZONE, figures)}</time>
                    </TonePill>
                  )
                  : undefined
                : <LastActivity member={m} language={language} label={t.roster.columns.lastActivity} />}
              className="rounded-none"
            />
          </li>
        );
      })}
    </ListCard>
  );
}

/**
 * **The last-activity pill** (UI-140): *Hari ini*, *n hari lalu* or *Belum pernah* — the table's own words for the
 * column, from the server's days. **Orange within the office's rolling week, grey older** or never: the accent's 8%
 * tint with `amber-ink` words, the pair `a11y.spec.tsx` pins above 4.5:1 for the calendar's today (an amber tint any
 * darker misses), and the grey status pill. A row the server sent without the figure draws nothing, as the table's
 * dash. The column's name is read before the words, so a screen reader hears *Last activity, 3 days ago*.
 */
function LastActivity({
  member, language, label,
}: {
  member: Member;
  language: ReturnType<typeof useLanguage>;
  label: string;
}) {
  if (member.lastActivityDays === undefined) return null;
  const words = daysAgoWords(member.lastActivityDays, language);
  const recent = loggedRecently(member.lastActivityDays);
  return (
    <span
      data-recent={recent ? 'true' : 'false'}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-5',
        recent ? 'bg-primary/[0.08] text-primary-ink' : 'bg-pill-grey text-pill-grey-ink',
      )}
    >
      <span className="sr-only">{label}: </span>
      {member.lastActivityOn ? <time dateTime={member.lastActivityOn}>{words}</time> : words}
    </span>
  );
}
