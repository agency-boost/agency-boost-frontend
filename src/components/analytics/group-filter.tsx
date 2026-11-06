'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { cn } from '@/lib/cn';
import type { AnalyticsGroup } from '@/lib/kpm-analytics';

/**
 * ***Seluruh KPM ⌄*** — **the custom-group filter** (UI-152 phase 2, the KPM Overview flow report's R5 and case 13;
 * OD-258, ADR-0204 §4; `kpm-leaders-mobile` screen 2): a light pill beside the period pill, on both tabs. It opens
 * ***Lihat untuk***: *Seluruh KPM* with its people, each of the office's custom groups (*Grup · n orang*), and *Atur grup
 * di All members ›* for a reader who may manage them. Picking one re-reads the tab over that group's people — the
 * address carries it (`?group=`) — and the pill then reads the group's name.
 *
 * A group grants nothing (P3-T9 AC-1): the reader reads the whole office already. The server names the groups and
 * counts their people; this draws them.
 */
export function GroupFilter({
  groups, group, officePeople, manages, onChoose,
}: {
  groups: readonly AnalyticsGroup[];
  group: AnalyticsGroup | null;
  officePeople: number;
  /** The reader may manage the office's groups (the Owner, an Admin): *Atur grup di All members ›*. */
  manages: boolean;
  onChoose: (groupId: string | null) => void;
}) {
  const t = useMessages(kpmAnalyticsMessages).groupFilter;
  const [open, setOpen] = useState(false);
  const label = group?.name ?? t.whole;
  const choose = (id: string | null) => {
    setOpen(false);
    if (id !== (group?.groupId ?? null)) onChoose(id);
  };
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t.pillName({ name: label })}
        onClick={() => setOpen(true)}
        data-group-filter=""
        className="flex min-h-11 max-w-full shrink-0 items-center gap-1.5 rounded-pill bg-card px-3.5 text-base font-semibold text-navy lg:min-h-10"
      >
        <LineIcon name="usersGroup" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ResponsiveSheet open={open} title={t.viewFor} onClose={() => setOpen(false)}>
        <div role="radiogroup" aria-label={t.viewFor} className="flex flex-col">
          <Option on={group === null} title={t.whole} sub={t.people({ n: officePeople })} onChoose={() => choose(null)} />
          {groups.map((g) => (
            <Option
              key={g.groupId}
              on={group?.groupId === g.groupId}
              title={g.name}
              sub={t.group({ n: g.memberCount })}
              onChoose={() => choose(g.groupId)}
            />
          ))}
        </div>
        {manages && (
          <Link
            href="/people/members?tab=groups"
            className="mt-1 flex min-h-11 items-center gap-2.5 rounded-row px-1 text-base font-semibold text-navy hover:bg-hover-row"
          >
            <LineIcon name="userPlus" className="h-5 w-5 shrink-0 text-primary-ink" />
            <span className="min-w-0 flex-1">{t.manage}</span>
            <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-signal-grey" />
          </Link>
        )}
      </ResponsiveSheet>
    </>
  );
}

/** One choice: a radio of 44px and more, its name and its people beneath. */
function Option({ on, title, sub, onChoose }: { on: boolean; title: string; sub: string; onChoose: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onChoose}
      className="flex min-h-14 items-center gap-3 border-b border-divider px-1 text-left last:border-b-0"
    >
      <span
        aria-hidden="true"
        className={cn('h-5 w-5 shrink-0 rounded-full border-2', on ? 'border-secondary bg-card ring-[3px] ring-inset ring-secondary' : 'border-line')}
      />
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{sub}</span>
      </span>
    </button>
  );
}
