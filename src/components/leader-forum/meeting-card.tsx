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
 * The whole card opens the meeting, as the prototype's does (`:2631-2635`), through *Open*, which is a link
 * to the meeting's own address and the card's only stop for the keyboard: its outline is stretched over the
 * card. On a phone the right-hand side wraps under the title instead of pushing the card wider (flow doc §2.10).
 */
export function MeetingCardRow({ meeting }: { meeting: MeetingCard }) {
  const titleId = useId();
  const past = meeting.state === 'completed';
  const block = dateBlock(meeting.date);
  const open = meeting.openItems;
  return (
    <li
      className={cn(
        'relative flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-lg border border-hairline bg-card px-[18px] py-4',
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
        <p className="text-sm text-muted">
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
        <Link
          href={`/leader-meetings/${encodeURIComponent(meeting.id)}`}
          aria-describedby={titleId}
          className={buttonClass(
            'secondary',
            // `.lm-btn-secondary.lm-btn-sm` (`:606`, `:610`): navy outline, small. The outline is stretched over the card.
            'h-auto rounded-[7px] border-[1.5px] border-navy bg-transparent px-[13px] py-[7px] text-sm after:absolute after:inset-0 after:rounded-lg after:content-[\'\']',
          )}
        >
          {FORUM_COPY.open}
        </Link>
      </div>
    </li>
  );
}

/** The tagged editors' initials, overlapping (`.avatar-stack`, `:635-640`), each named *"{name} ({rung})"*. */
function AvatarStack({ people }: { people: ForumPerson[] }) {
  if (people.length === 0) return null;
  return (
    // Above the stretched link, so each name shows on hover.
    <div className="relative z-[1] flex">
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
