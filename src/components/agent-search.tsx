'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { agentHref, searchAgents, type AgentHit } from '@/lib/agent-search';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/use-debounced';

/**
 * **Search agent: the agent picker** (UI V1, UI-012; D-14) — the desktop sidebar's *Search agent*, the Unit Dashboard's
 * title-row pill on a phone (O-13), and the picker Coaching, Calendar and lead filtering reuse.
 *
 * - **A pill field** with a magnifier, an **orange outline when focused**; 40px, 16px text on a phone so iOS does not
 *   zoom.
 * - **A list under it**: each person's NAME in capitals on the left and their agent code on the right, filtered by
 *   name or agent code as the reader types (`GET /members/search`, debounced) — only the people the reader may see,
 *   never the reader. Opened on focus with the first of them.
 * - **Picking somebody opens their agent dashboard**, `/coaching/{id}/summary` — or the caller's `onPick` instead.
 * - **The combobox pattern**: ↓ ↑ move through the list, Enter picks, Escape closes it and then clears the field; a
 *   screen reader hears the list's size and the option in focus.
 */
export function AgentSearch({
  onPick,
  autoFocus = false,
  className,
}: {
  /** In place of opening the dashboard: Calendar's *Pick who to coach*, a lead filter. */
  onPick?: (hit: AgentHit) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const router = useRouter();
  const listId = useId();
  const inputId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<AgentHit[] | null>(null);
  const [active, setActive] = useState(-1);
  const asked = useDebounced(q);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setHits(null);
    searchAgents(asked)
      .then((answer) => {
        if (!live) return;
        setHits(answer.members);
        setActive(answer.members.length > 0 ? 0 : -1);
      })
      .catch(() => { if (live) setHits([]); });
    return () => { live = false; };
  }, [asked, open]);

  // A tap or a click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const pick = (hit: AgentHit) => {
    setOpen(false);
    setQ('');
    if (onPick) onPick(hit);
    else router.push(agentHref(hit.membershipId));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = hits?.length ?? 0;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (count > 0) setActive((i) => (i + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (count > 0) setActive((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (open && hits && active >= 0 && hits[active]) {
        e.preventDefault();
        pick(hits[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) setOpen(false);
      else setQ('');
    }
  };

  const optionId = (i: number) => `${listId}-option-${i}`;
  const expanded = open && hits !== null;

  return (
    <div ref={box} data-agent-search="" className={cn('relative', className)}>
      <label htmlFor={inputId} className="sr-only">{t.search.label}</label>
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-pill border border-line bg-card pl-3 pr-2 text-muted',
          'focus-within:border-amber focus-within:ring-2 focus-within:ring-amber',
        )}
      >
        <LineIcon name="search" className="h-[18px] w-[18px]" />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          placeholder={t.search.label}
          autoComplete="off"
          // The caller's explicit choice: a picker opened on purpose, as a dialog's only field.
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A field still focused after a pick opens again on a tap.
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.search.results}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg bg-card py-1 shadow-modal"
        >
          {hits.length === 0 ? (
            <li role="presentation" className="px-4 py-3 text-base text-muted">{t.search.none}</li>
          ) : hits.map((hit, i) => (
            <li
              key={hit.membershipId}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(hit)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2',
                i === active ? 'bg-hover-row' : 'bg-card',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-md font-bold uppercase tracking-[0.2px] text-ink">{hit.fullName}</span>
              {hit.agentCode && <span className="shrink-0 text-base tabular-nums text-signal-grey">{hit.agentCode}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && hits === null && <span role="status" className="sr-only">{t.search.searching}</span>}
    </div>
  );
}
