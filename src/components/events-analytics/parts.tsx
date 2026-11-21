'use client';

import { useId, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { cn } from '@/lib/cn';
import type { EventPersonRef, KehadiranTone } from '@/lib/event-analytics';
import { STACK_AVATARS } from '@/lib/event-analytics';
import { formatNumber } from '@/lib/format';

/*
 * **The Event tab's small pieces** (P19.25-T1, T2; ADR-0281): the pill switch, a share's colours, the thin bar, the
 * avatar stack, *Lihat semua (n)* and the round WhatsApp link. Every colour a token (`DESIGN-RULES.md`, *Status
 * colours*); every number arrives from the server and is only written here.
 */

/** A share's words on white: green, yellow, red (`DESIGN-RULES.md`). */
export const TONE_TEXT: Record<KehadiranTone, string> = {
  green: 'text-signal-green',
  yellow: 'text-pill-amber-ink',
  red: 'text-signal-red',
};

/** A share's tint and words, for a tile or a pill. */
export const TONE_FILL: Record<KehadiranTone, string> = {
  green: 'bg-pill-green text-pill-green-ink',
  yellow: 'bg-pill-amber text-pill-amber-ink',
  red: 'bg-pill-red text-pill-red-ink',
};

/** A share's bar. */
export const TONE_BAR: Record<KehadiranTone, string> = {
  green: 'bg-signal-green',
  yellow: 'bg-pill-amber-ink',
  red: 'bg-signal-red',
};

export const toneText = (tone: KehadiranTone | null) => (tone ? TONE_TEXT[tone] : 'text-muted');

/** A thin bar filled to `pct` in the share's colour. Decorative: the figure is always beside it. */
export function ThinBar({ pct, tone, className, track = 'bg-divider' }: {
  pct: number | null; tone: KehadiranTone | null; className?: string; track?: string;
}) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <span aria-hidden="true" className={cn('block h-1.5 w-full overflow-hidden rounded-pill', track, className)}>
      <span className={cn('block h-full rounded-pill', tone ? TONE_BAR[tone] : 'bg-secondary')} style={{ width: `${width}%` }} />
    </span>
  );
}

/** A whole percent written in the reader's figures: *59%*; *–* with none. */
export function usePercentText(): (pct: number | null) => string {
  const language = useFigureLanguage();
  return (pct) => (pct === null ? '–' : `${formatNumber(pct, {}, language)}%`);
}

/** A count or an average written in the reader's figures: *7,1*, *18*; *–* with none. */
export function useFigureText(): (value: number | null, maxDecimals?: number) => string {
  const language = useFigureLanguage();
  return (value, maxDecimals = 1) => (value === null ? '–' : formatNumber(value, { maxDecimals }, language));
}

/**
 * **The pill switch** — *Kehadiran | Feedback*, *Per event | Per group | Per orang* (the mockup's `.seg`): a white pill,
 * the chosen one navy. Tabs over a panel the caller renders under it, named by `panelId`.
 */
export function PillTabs<T extends string>({ label, tabs, active, onSelect, panelId, className }: {
  label: string;
  tabs: readonly { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
  panelId: string;
  className?: string;
}) {
  const base = useId();
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex shrink-0 rounded-pill bg-card p-1', className)}>
      {tabs.map((tab, i) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${base}-${tab.id}`}
            aria-selected={on}
            aria-controls={on ? panelId : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => {
              const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
              if (to === null) return;
              e.preventDefault();
              const next = tabs[(to + tabs.length) % tabs.length];
              onSelect(next.id);
              document.getElementById(`${base}-${next.id}`)?.focus();
            }}
            className={cn(
              'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3.5 text-md font-semibold',
              on ? 'bg-secondary text-secondary-contrast' : 'text-ink lg:hover:bg-hover-row',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** A block's heading, navy and bold, with its one short note on the right. */
export function BlockHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between gap-3 first:mt-0">
      <h3 className="text-md font-bold text-navy">{children}</h3>
      {aside && <span className="text-sm text-muted">{aside}</span>}
    </div>
  );
}

/** *Lihat semua (n) ›* — or, open, *Tampilkan lebih sedikit*. */
export function SeeAll({ n, open, onToggle }: { n: number; open: boolean; onToggle: () => void }) {
  const t = useMessages(eventAnalyticsMessages);
  const figure = useFigureText();
  return (
    <div className="border-t border-divider px-4 text-center">
      <button type="button" aria-expanded={open} onClick={onToggle} className="min-h-11 text-sm font-bold text-navy">
        {open ? t.showLess : t.seeAll({ n: figure(n, 0) })}
      </button>
    </div>
  );
}

/** Photos side by side, overlapping — the first `STACK_AVATARS`, then *+n*. Each person is named for a screen reader. */
export function AvatarStack({ people }: { people: readonly EventPersonRef[] }) {
  const t = useMessages(eventAnalyticsMessages);
  const figure = useFigureText();
  const shown = people.slice(0, STACK_AVATARS);
  const rest = people.length - shown.length;
  return (
    <ul className="mt-2 flex flex-wrap items-center" aria-label={people.map((p) => p.name).join(', ')}>
      {shown.map((p) => (
        <li key={p.membershipId} className="-mr-1.5 rounded-full ring-2 ring-card">
          <Avatar name={p.name} photoUrl={p.photoUrl} seed={p.membershipId} size={30} />
        </li>
      ))}
      {rest > 0 && (
        <li className="ml-2.5 inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-pill bg-pill-grey px-2 text-sm font-bold text-ink">
          <span aria-hidden="true">{t.more({ n: figure(rest, 0) })}</span>
          <span className="sr-only">{t.moreLabel({ n: figure(rest, 0) })}</span>
        </li>
      )}
    </ul>
  );
}

/** The round green WhatsApp link: a person's chat, or a share to a chat the reader picks. */
export function WhatsAppLink({ href, label, size = 36 }: { href: string; label: string; size?: 30 | 36 }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="relative z-[1] inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
    >
      <span className={cn('inline-flex items-center justify-center rounded-full bg-whatsapp text-white', size === 30 ? 'h-[30px] w-[30px]' : 'h-9 w-9')}>
        <LineIcon name="whatsapp" className="h-[18px] w-[18px]" />
      </span>
    </a>
  );
}

/** A section with nothing to show yet: the layout stays, with *Belum ada data* (PERMISSIONS.md, *Principles*). */
export function NoDataLine() {
  const t = useMessages(eventAnalyticsMessages);
  return <p data-no-data="" className="px-4 py-6 text-center text-md text-muted">{t.noData}</p>;
}
