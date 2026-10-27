'use client';

import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SEGMENT_PHONE, SEGMENT_WRAP_PHONE, SEGMENTS_PHONE } from '@/components/ui/phone';
import { useTabRow } from '@/components/ui/use-tab-row';

export interface SegmentedTab {
  readonly id: string;
  readonly label: string;
}

/**
 * Two or three ways of doing the same thing, side by side, one of them on.
 *
 * The prototype's `.segmented` (`Overall.html:644-649`, markup `:2865-2868`): a full-width track on
 * `--warm-base` with a 3px inset, and the active segment a navy pill. It declares `role="tablist"`
 * itself, which is the right choice and more than the markup delivers — its buttons are not reachable
 * by arrow key and nothing names the panel they control.
 *
 * **Why this is not a `<select>`.** The goal screen shipped one, and a dropdown hides the alternative
 * behind a click: an agent who thinks in take-home pay rather than in APE cannot see the product has a
 * mode for them. Two visible segments answer *what are my options*, which is why the prototype draws
 * it this way.
 *
 * **It renders its own panel**, from `children(activeId)`. Panels could have been the caller's, but
 * then the caller owns the ids, and an `aria-controls` naming an element that is not in the document
 * is an axe violation the caller discovers as an unattributed screen-level failure. Here the wiring
 * cannot come apart: exactly one panel exists and exactly one tab points at it.
 *
 * **Keyboard**: one tab stop for the whole group via a roving `tabIndex`, ← / → between segments as
 * WAI-ARIA requires, Home and End to the ends.
 *
 * **Not `RouteTabs`.** That one changes the URL, so it is links in a `nav` with `aria-current`. A
 * `role="tab"` promises a panel in the same document, and a route change has none.
 *
 * **On a phone a segment never breaks its words over two lines** (ADR-0167; UI-013): the segments share
 * the track while their words fit, and when they do not the track scrolls sideways, fading on the side
 * that has more, with the selected one in view. Below 768px only (`phone.ts`, `use-tab-row.ts`).
 *
 * **Two options are the exception** (`phoneLayout="wrap"`, P18.95-T5 AC-7): a choice between two must show
 * both, so the halves stay equal and a label wraps inside its own (`SEGMENT_WRAP_PHONE`) rather than the track
 * scrolling one of them out of sight — *Calculate from savings target* on `/goals` at 375px.
 */
export function Segmented({
  label,
  tabs,
  active,
  onSelect,
  children,
  className,
  phoneLayout = 'scroll',
}: {
  /** Names the group for a screen reader — *"How you want to set it"*. */
  label: string;
  tabs: readonly SegmentedTab[];
  active: string;
  onSelect: (id: string) => void;
  /** The active panel's contents. Called with the active tab's id. */
  children: (activeId: string) => ReactNode;
  className?: string;
  /**
   * Below 768px: `scroll`, a row that scrolls when its words do not fit (the default), or `wrap`, equal halves whose
   * words wrap inside them — for two options, which must both be seen (P18.95-T5 AC-7).
   */
  phoneLayout?: 'scroll' | 'wrap';
}) {
  const group = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabId = (id: string) => `${group}-${id}-tab`;
  const panelId = `${group}-panel`;
  const row = useTabRow<HTMLDivElement>(active);

  const go = (to: number) => {
    const next = tabs[(to + tabs.length) % tabs.length];
    onSelect(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <>
      <div
        ref={row.ref}
        role="tablist"
        aria-label={label}
        data-fade={row.fade}
        className={cn('flex w-full rounded-lg border border-hairline bg-base p-[3px]', phoneLayout === 'scroll' && SEGMENTS_PHONE, className)}
      >
        {tabs.map((tab, i) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={on}
              aria-controls={on ? panelId : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') go(i + 1);
                else if (e.key === 'ArrowLeft') go(i - 1);
                else if (e.key === 'Home') go(0);
                else if (e.key === 'End') go(tabs.length - 1);
                else return;
                e.preventDefault();
              }}
              className={cn(
                'flex-1 rounded-md px-2.5 py-2 text-base font-semibold transition-colors',
                phoneLayout === 'scroll' ? SEGMENT_PHONE : SEGMENT_WRAP_PHONE,
                on ? 'bg-navy text-card' : 'text-muted hover:text-navy',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(active)} className="mt-3.5">
        {children(active)}
      </div>
    </>
  );
}
