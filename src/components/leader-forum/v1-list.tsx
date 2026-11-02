'use client';

import Link from 'next/link';
import { useId } from 'react';
import { Avatar } from '@/components/ui/person-row';
import { LineIcon } from '@/components/ui/line-icon';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import {
  dateBlock, filterMeetings, rungShort, taggedLeaders, type MeetingCard, type MeetingFilter,
} from '@/lib/leader-meetings';

const FILTERS: readonly MeetingFilter[] = ['all', 'upcoming', 'past'];

/**
 * **The Strategic Leader Forum's list on a phone, in the field shell** (UI V1, 2026-10-30; UI-110; `kpm-mobile` 1):
 * *Semua | Akan datang | Sudah lewat* as one segmented control; under *Semua* the meetings grouped *Akan datang n* and
 * *Sudah lewat n*; **each meeting the Event card** — the date block, *Strategic Check-in — #14*, the tagged leaders as
 * an avatar stack and *3 Core Leaders*, the open items as a tinted pill (*4 item belum selesai*, green *Semua selesai*)
 * — **the whole card the link**, no *Buka*.
 */
export function V1ForumList({
  meetings, filter, onFilter, create,
}: {
  meetings: readonly MeetingCard[];
  filter: MeetingFilter;
  onFilter: (filter: MeetingFilter) => void;
  /** *+ Rapat baru*, for who may start one (`can.create`). */
  create: React.ReactNode;
}) {
  const t = useMessages(forumMessages);
  const shown = filterMeetings([...meetings], filter);
  const groups: { key: 'upcoming' | 'past'; items: MeetingCard[] }[] = filter === 'all'
    ? [
      { key: 'upcoming', items: shown.filter((m) => m.state === 'upcoming') },
      { key: 'past', items: shown.filter((m) => m.state === 'completed') },
    ].filter((g) => g.items.length > 0) as { key: 'upcoming' | 'past'; items: MeetingCard[] }[]
    : [{ key: filter, items: shown }];

  return (
    <div className="min-w-0" data-v1-forum-list="">
      <div role="group" aria-label={t.filters.all} className="flex h-11 rounded-pill bg-card p-[3px]">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => onFilter(f)}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-pill px-2 text-base font-semibold',
              filter === f ? 'bg-navy text-white' : 'text-muted hover:text-navy',
            )}
          >
            {t.filters[f]}
          </button>
        ))}
      </div>
      {create && <div className="mt-3">{create}</div>}

      {meetings.length === 0 ? (
        <p className="mt-3 rounded-lg bg-card px-4 py-10 text-center text-base text-muted">{t.noMeetings}</p>
      ) : shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-base text-muted">{t.noMatch}</p>
      ) : groups.map((group) => (
        <Group key={group.key} label={filter === 'all' ? t.filters[group.key] : null} items={group.items} />
      ))}
    </div>
  );
}

function Group({ label, items }: { label: string | null; items: MeetingCard[] }) {
  const headId = useId();
  return (
    <section aria-labelledby={label ? headId : undefined} className="mt-3.5">
      {label && (
        <h2 id={headId} className="mx-0.5 mb-1.5 flex items-baseline gap-1.5 text-md font-bold text-navy">
          {label}
          <span className="text-sm font-semibold text-muted">{items.length}</span>
        </h2>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((meeting) => <Card key={meeting.id} meeting={meeting} />)}
      </ul>
    </section>
  );
}

function Card({ meeting }: { meeting: MeetingCard }) {
  const t = useMessages(forumMessages);
  const figures = useFigureLanguage();
  const titleId = useId();
  const block = dateBlock(meeting.date, figures);
  const leaders = taggedLeaders(meeting.editors);
  const open = meeting.openItems;
  return (
    <li>
      <Link
        href={`/leader-meetings/${encodeURIComponent(meeting.id)}`}
        aria-labelledby={titleId}
        className="flex items-center gap-2.5 rounded-lg bg-card px-3 py-2.5 lg:hover:bg-hover-row"
        data-v1-meeting={meeting.id}
      >
        <span aria-hidden="true" className="flex h-[52px] w-12 shrink-0 flex-col items-center justify-center rounded-row bg-hover-row leading-tight">
          <span className="text-lg font-bold text-navy">{block.day}</span>
          <span className="text-xs font-bold uppercase text-amber-ink">{block.month}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span id={titleId} className="block break-words text-md font-bold leading-snug text-ink">{meeting.title}</span>
          {leaders.length > 0 && (
            <span className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <span className="flex" aria-hidden="true">
                {leaders.map((person) => (
                  <Avatar
                    key={person.membershipId}
                    name={person.name}
                    photoUrl={person.photoUrl ?? null}
                    seed={person.membershipId}
                    size={26}
                    className="-ml-[7px] border-2 border-card first:ml-0"
                  />
                ))}
              </span>
              <span className="sr-only">{leaders.map((p) => `${p.name} (${rungShort(p.rung)})`).join(', ')}: </span>
              {t.v1.coreLeaders({ n: meeting.editors.coreLeaderCount })}
            </span>
          )}
          <span className="mt-1 flex">
            {open === 0
              ? <TonePill tone="green">{t.allClear}</TonePill>
              : <TonePill tone="amber">{t.v1.openPill({ n: open })}</TonePill>}
          </span>
        </span>
        <LineIcon name="chevronRight" className="h-[18px] w-[18px] shrink-0 text-signal-grey" />
      </Link>
    </li>
  );
}
