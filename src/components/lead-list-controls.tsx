'use client';

import type { ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { cn } from '@/lib/cn';
import type { LeadTypeChip } from '@/lib/leads';

/*
 * **`/leads`' search pill and type chips** (UI-105), drawn by its compact list (`LeadsList`) and, since P19.16-T4 AC-2,
 * by a coachee's *Leads* tab (`CoacheeLeadsTab`), so the two lists of leads look the same. Moved out of `leads-list.tsx`
 * as they were written there, so `/leads` is drawn to the byte as before.
 */

/**
 * The search pill, *Cari nama lead* — the whole pill the field's target, the focus ring on the pill — and what stands
 * beside it in the row: `/leads`' round filter button, or nothing.
 */
export function LeadSearch({ value, onChange, filter }: {
  value: string;
  onChange: (next: string) => void;
  /** Beside the pill: `/leads`' filter button. */
  filter?: ReactNode;
}) {
  const t = useMessages(leadsMessages);
  return (
    <div role="search" className="flex gap-2" aria-label={t.searchAndFilter}>
      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-pill bg-card px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-focus-ring">
        <LineIcon name="search" className="h-[18px] w-[18px] shrink-0" />
        <span className="sr-only">{t.list.search}</span>
        <input
          type="search"
          value={value}
          placeholder={t.list.search}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-signal-grey"
        />
      </label>
      {filter}
    </div>
  );
}

/** The type chips, *Semua 67 · Sales 58 · Recruit 9*: the chosen one navy, each with its count once the leads are read. */
export function LeadTypeChips({ chip, onChip, counts, counted }: {
  chip: LeadTypeChip;
  onChip: (chip: LeadTypeChip) => void;
  counts: Record<LeadTypeChip, number>;
  /** The leads are read: until then the counts are blank, never a 0 that is not one. */
  counted: boolean;
}) {
  const t = useMessages(leadsMessages);
  const typeName = (type: LeadTypeChip) => (type === 'all' ? t.list.all : t.types[type]);
  return (
    <div role="group" aria-label={t.list.chips} className="my-2.5 flex gap-1.5">
      {(['all', 'sales', 'recruitment'] as const).map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={chip === type}
          aria-label={t.list.chipSaid({ label: typeName(type), n: counts[type] })}
          onClick={() => onChip(type)}
          className={cn(
            // Already a header control — 13px / 600 / 44px (P19.8-T1 AC-1; R6, MOB UI-171: *Semua · Sales · Recruit*, ok) —
            // and written as it was, so the phone's list is drawn to the byte as before (`HEADER_CONTROL`'s three in it).
            'flex min-h-11 items-center gap-1.5 rounded-pill px-3.5 text-base font-semibold',
            chip === type ? 'bg-secondary text-secondary-contrast' : 'bg-card text-navy hover:bg-hover-row',
          )}
        >
          {typeName(type)}
          <span className={cn('text-xs font-semibold', chip === type ? 'text-secondary-muted' : 'text-muted')}>
            {counted ? counts[type] : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
