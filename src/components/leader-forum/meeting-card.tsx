import Link from 'next/link';
import { useId } from 'react';
import { buttonClass } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import {
  coreLeadersTagged, dateBlock, FORUM_COPY, initialsOf, openItemsNoun, rungShort, stateLabel, taggedLeaders,
  type ForumPerson, type MeetingCard,
} from '@/lib/leader-meetings';

/**
 * **A meeting on the list** (`meetingCardHtml`, `:2588-2611`): the date block, grey once *Completed*; the
 * title; *"{date} · Upcoming · {n} core leaders tagged"*, singular for one (F-186); the initials of those same
 * people — every editor tagged but the Owner — overlapping, each named; the open items or *All clear*; and ***Open***.
 *
 * **The whole card is one link to the meeting** (P18.97-T2 AC-2, I-497; the client's UI-015, who found only *Open*
 * would open it): one keyboard stop, named by the title and described by its line, *Open* kept as the visible cue —
 * a word now, not a link inside the link. The prototype's card opens on a click anywhere (`:2631-2635`). On a phone
 * the right-hand side wraps under the title instead of pushing the card wider (flow doc §2.10).
 */
export function MeetingCardRow({ meeting }: { meeting: MeetingCard }) {
  const titleId = useId();
  const lineId = useId();
  const past = meeting.state === 'completed';
  const block = dateBlock(meeting.date);
  const open = meeting.openItems;
  return (
    <li>
      <Link
        href={`/leader-meetings/${encodeURIComponent(meeting.id)}`}
        aria-labelledby={titleId}
        aria-describedby={lineId}
        className={cn(
          'group flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-lg border border-hairline bg-card px-[18px] py-4',
          // Not dimmed once past, as `.is-past` dims it to 85% (`:623`): *All clear*'s green would fall to
          // 4.47:1, under 4.5:1, and the grey line to 4.57:1. The grey date block says it alone.
          'transition-shadow hover:shadow-modal motion-reduce:transition-none',
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center rounded-[10px] text-white',
            past ? 'bg-muted' : 'bg-navy',
          )}
        >
          {/* The month at 65% white on navy (`:629`); full white on the grey, where 65% would not read. */}
          <span className={cn('text-2xs font-bold uppercase tracking-wide', past ? 'text-white' : 'text-white/[0.65]')}>
            {block.month}
          </span>
          <span className="text-xl font-extrabold leading-tight">{block.day}</span>
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={titleId} className="mb-[3px] break-words text-md font-bold text-navy">{meeting.title}</h2>
          <p id={lineId} className="text-sm text-muted">
            {formatShortDay(meeting.date, { year: true })} · {stateLabel(meeting.state)} · {coreLeadersTagged(meeting.editors.coreLeaderCount)}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-[14px]">
          <AvatarStack people={taggedLeaders(meeting.editors)} />
          <p className="whitespace-nowrap text-sm text-muted">
            {open === 0
              ? <strong className="text-success">{FORUM_COPY.allClear}</strong>
              : <><strong className="text-alert">{open}</strong> {openItemsNoun(open)}</>}
          </p>
          {/* The visible cue, `.lm-btn-secondary.lm-btn-sm` (`:606`, `:610`): navy outline, small — the card is the link. */}
          <span
            aria-hidden="true"
            className={buttonClass(
              'secondary',
              'h-auto rounded-[7px] border-[1.5px] border-navy bg-transparent px-[13px] py-[7px] text-sm group-hover:bg-navy/5',
            )}
          >
            {FORUM_COPY.open}
          </span>
        </div>
      </Link>
    </li>
  );
}

/** The tagged editors' initials, overlapping (`.avatar-stack`, `:635-640`), each named *"{name} ({rung})"* on hover. */
function AvatarStack({ people }: { people: ForumPerson[] }) {
  if (people.length === 0) return null;
  return (
    <div className="flex">
      {people.map((person) => {
        const name = `${person.name} (${rungShort(person.rung)})`;
        return (
          <span
            key={person.membershipId}
            role="img"
            aria-label={name}
            title={name}
            className="-ml-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-card bg-navy-soft text-2xs font-bold text-white first:ml-0"
          >
            {initialsOf(person.name)}
          </span>
        );
      })}
    </div>
  );
}
