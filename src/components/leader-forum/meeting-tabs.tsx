'use client';

import { useId, useRef } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import type { MeetingView } from '@/lib/leader-meetings';
import { ActionItems } from './action-items';
import { Agenda } from './agenda';
import { Scorecard } from './scorecard';
import { V1Overview } from './v1-meeting';
import { V1Actions, V1Agenda } from './v1-minutes';

export type MeetingTab = 'overview' | 'agenda' | 'actions';
const TABS: readonly MeetingTab[] = ['overview', 'agenda', 'actions'];

/**
 * **The three tabs** (`.detail-tabs`, `:2728-2732`): *Overview & Stats* first and open when a meeting opens,
 * then *Agenda* and *Action Items*. A tab list whose selected tab is announced (I-255), where the prototype's
 * buttons carry no state: one stop for the keyboard, ← and → between them, Home and End to the ends.
 *
 * **All three panels stay mounted**, the two not selected `hidden`. A tab keeps its own record of the writes it
 * has in flight, item by item; unmounting it on a switch threw that away, and a second write made quickly after
 * coming back went out at the version it had first read and met a 409 against the reader's own write.
 *
 * **On a phone the strip scrolls inside its own box** rather than wrapping *Action Items* to a second line, as a
 * table does; the page never scrolls sideways. Neither strip nor panel is printed: the print layout stands in for
 * both (`:756-765`).
 */
export function MeetingTabs({
  meeting,
  active,
  onSelect,
  v1 = false,
}: {
  meeting: MeetingView;
  active: MeetingTab;
  onSelect: (tab: MeetingTab) => void;
  /**
   * **UI V1 on a phone in the field shell** (UI-110; `kpm-mobile` 4–6): *Overview | Agenda | Action Items* as one
   * segmented control, and the three panels as the owner drew them (`v1-meeting.tsx`, `v1-minutes.tsx`).
   */
  v1?: boolean;
}) {
  const t = useMessages(forumMessages);
  const group = useId();
  const refs = useRef<Partial<Record<MeetingTab, HTMLButtonElement | null>>>({});
  const go = (to: number) => {
    const next = TABS[(to + TABS.length) % TABS.length];
    onSelect(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="min-w-0 print:hidden">
      {/* The hairline is the box's; the strip sits over it, so the selected tab's amber covers it as `:675` draws it. */}
      <div className={v1 ? 'mt-3' : 'mb-5 border-b border-hairline'}>
        <div
          role="tablist"
          aria-label={meeting.title}
          className={v1 ? 'flex h-11 rounded-pill bg-card p-[3px]' : '-mb-px flex gap-x-[26px] overflow-x-auto whitespace-nowrap'}
        >
          {TABS.map((tab, i) => {
            const on = tab === active;
            return (
              <button
                key={tab}
                ref={(el) => { refs.current[tab] = el; }}
                type="button"
                role="tab"
                id={`${group}-${tab}`}
                aria-selected={on}
                aria-controls={`${group}-${tab}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(tab)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') go(i + 1);
                  else if (e.key === 'ArrowLeft') go(i - 1);
                  else if (e.key === 'Home') go(0);
                  else if (e.key === 'End') go(TABS.length - 1);
                  else return;
                  e.preventDefault();
                }}
                className={v1
                  ? cn(
                    'flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-pill px-2 text-base font-semibold',
                    on ? 'bg-navy text-white' : 'text-muted hover:text-navy',
                  )
                  : cn(
                    'shrink-0 border-b-2 px-1 py-2.5 text-md font-semibold',
                    on ? 'border-amber text-navy' : 'border-transparent text-muted hover:text-navy',
                  )}
              >
                {v1 && tab === 'overview' ? t.v1.overviewTab : t.tabs[tab]}
              </button>
            );
          })}
        </div>
      </div>
      {TABS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={`${group}-${tab}-panel`}
          aria-labelledby={`${group}-${tab}`}
          hidden={tab !== active}
          className="min-w-0"
        >
          {tab === 'overview' && (v1 ? <V1Overview meeting={meeting} /> : <Scorecard meeting={meeting} />)}
          {tab === 'agenda' && (v1 ? <V1Agenda meeting={meeting} /> : <Agenda meeting={meeting} />)}
          {tab === 'actions' && (v1 ? <V1Actions meeting={meeting} /> : <ActionItems meeting={meeting} />)}
        </div>
      ))}
    </div>
  );
}
