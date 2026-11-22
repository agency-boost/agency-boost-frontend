'use client';

import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { ButtonLink, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import type { ApiError } from '@/lib/api-client';
import type { MapaChange, PeerStatus, PersonRef, Tone } from '@/lib/advanced-analytics-page';
import { cn } from '@/lib/cn';
import { formatMonth, formatNumber } from '@/lib/format';

/**
 * **The page's shared pieces** (P19.5-T3, P19.22; ADR-0275): the person's name as every list writes it, the colours a
 * figure is drawn in by its progress, the change ▲/▼, the month picker, the line beside it, and the states. Each is
 * drawn the same wherever it appears, on the four tabs and in the forum that shows two of them.
 */

/** A progress colour's words-and-tint (`DESIGN-RULES.md`, *Status colours*), as a tile or a pill draws it. */
export const TONE_TILE: Record<Tone, string> = {
  green: 'bg-pill-green text-pill-green-ink',
  yellow: 'bg-pill-amber text-pill-amber-ink',
  red: 'bg-pill-red text-pill-red-ink',
};

/** A progress colour's outline, for a tappable pill: white, the colour's words and edge. */
export const TONE_OUTLINE: Record<Tone, string> = {
  green: 'border-signal-green text-pill-green-ink',
  yellow: 'border-pill-amber-ink text-pill-amber-ink',
  red: 'border-signal-red text-pill-red-ink',
};

/** A progress colour's bar fill. */
export const TONE_BAR: Record<Tone, string> = {
  green: 'bg-signal-green',
  yellow: 'bg-pill-amber-ink',
  red: 'bg-signal-red',
};

/** A thin bar, filled to `pct` (capped at 100), in its colour — navy when there is none. Decorative: the figure is beside it. */
export function ProgressBar({ pct, tone, className, track = 'bg-divider' }: { pct: number | null; tone: Tone | null; className?: string; track?: string }) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <span aria-hidden="true" className={cn('block h-1.5 w-full overflow-hidden rounded-pill', track, className)}>
      <span className={cn('block h-full rounded-pill', tone ? TONE_BAR[tone] : 'bg-secondary')} style={{ width: `${width}%` }} />
    </span>
  );
}

/** *AB* / *AAB*, small bold orange text right before the name (the brief's *Naming rule*); an agent has none. */
export function RoleLabel({ role, className }: { role: string; className?: string }) {
  const t = useMessages(advancedAnalyticsPageMessages).role;
  if (role !== 'ab' && role !== 'aab') return null;
  return (
    <span data-role-label={role} className={cn('mr-1 shrink-0 text-sm font-extrabold text-primary-ink', className)}>
      {role === 'ab' ? t.ab : t.aab}
    </span>
  );
}

/**
 * **A person as every list writes them** (`DESIGN-RULES.md`, *Names*): the photo — initials with none — then the orange
 * role label and the NAME in capitals, black; a second line under it when given. Never cut on a phone: it wraps.
 */
export function PersonName({
  person, meta, size = 32, className, nameClassName,
}: {
  person: Pick<PersonRef, 'membershipId' | 'name' | 'photoUrl' | 'role'>;
  meta?: ReactNode;
  size?: number;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={person.name} photoUrl={person.photoUrl} seed={person.membershipId} size={size} />
      <span className="min-w-0">
        <span className={cn('flex min-w-0 items-baseline font-bold uppercase text-ink', nameClassName)}>
          <RoleLabel role={person.role} />
          <span className="min-w-0 break-words md:truncate">{person.name}</span>
        </span>
        {meta !== undefined && meta !== null && <span className="block text-sm text-muted">{meta}</span>}
      </span>
    </span>
  );
}

/** ▲/▼ and the change — in % of the earlier figure, or *poin* for a percentage — green up, red down; *—* with none. */
export function ChangeText({ change, className }: { change: MapaChange; className?: string }) {
  const t = useMessages(advancedAnalyticsPageMessages).change;
  const language = useFigureLanguage();
  if (change.value === null) return <span className={cn('text-muted', className)}>—</span>;
  const magnitude = formatNumber(Math.abs(change.value), {}, language);
  const text = change.kind === 'points'
    ? t.points({ n: `${change.value > 0 ? '+' : change.value < 0 ? '-' : ''}${magnitude}` })
    : `${magnitude}%`;
  const up = change.value >= 0;
  return (
    <span className={cn('whitespace-nowrap font-semibold tabular-nums', up ? 'text-signal-green' : 'text-signal-red', className)}>
      <span aria-hidden="true">{up ? '▲ ' : '▼ '}</span>
      <span className="sr-only">{up ? t.up({ value: text }) : t.down({ value: text })}</span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

/**
 * **The month picker** (*Oktober 2026 ⌄*): a native select in the page's pill, so it opens inside the screen on every
 * device; its label for a screen reader.
 */
export function MonthPicker({
  id, label, months, value, onChange, format = (m) => m,
}: {
  id: string;
  label: string;
  months: readonly string[];
  value: string;
  onChange: (month: string) => void;
  format?: (month: string) => string;
}) {
  return (
    <span className="relative inline-flex">
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-pill border border-hairline bg-card pl-4 pr-9 text-md font-semibold text-ink"
      >
        {months.map((m) => <option key={m} value={m}>{format(m)}</option>)}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink">⌄</span>
    </span>
  );
}

/** The month as the pickers write it: *Okt 2026*. */
export function useMonthText(): (month: string) => string {
  const language = useFigureLanguage();
  return (month) => formatMonth(month, language);
}

/**
 * **The row above a tab**: its controls on the left, its one short grey note on the right — under them on a phone
 * (`DESIGN-RULES.md`: *at most one short grey note line*).
 */
export function TabControls({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {note && <p className="text-sm text-muted md:text-right">{note}</p>}
    </div>
  );
}

/** A block's heading: navy, bold, the one line above its card. */
export function BlockTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 id={id} className="text-md font-bold text-navy">{children}</h2>
      {aside}
    </div>
  );
}

const STATUS_TONE: Record<PeerStatus, PillTone> = { above: 'green', in_line: 'amber', below: 'red' };

/**
 * **The peer-status chip** (P19.22-T4 AC-1): green *Di atas peers*, yellow *Sejajar*, red *Di bawah peers* — coloured
 * by the template's band now. `null` draws no chip — too few peers, or this KPM's value incomplete. The words are always
 * on it: colour is never the only cue.
 */
export function PeerStatusChip({ status }: { status: PeerStatus | null }) {
  const t = useMessages(advancedAnalyticsPageMessages).quant;
  if (status === null) return null;
  const words = status === 'above' ? t.above : status === 'in_line' ? t.inLine : t.below;
  return <TonePill tone={STATUS_TONE[status]}>{words}</TonePill>;
}

/** A section waiting on its read: a skeleton shaped like a card of rows. */
export function SectionLoading() {
  const t = useMessages(advancedAnalyticsPageMessages);
  return (
    <Skeleton label={t.loading}>
      <div className="space-y-3"><SkeletonBar className="h-16" /><SkeletonBar className="h-40" /></div>
    </Skeleton>
  );
}

/** A section's read refused or lost: the shared banner, its words the server's. */
export function SectionError({ error }: { error: ApiError }) {
  return <ErrorBanner {...error} />;
}

/**
 * ***Belum ada data*** **with one next step** (P19.5-T3 AC-1; D-37): the layout stays, with *0* or *–*, and this line
 * under it. Whoever may upload is sent to Data upload; anybody else gets no step.
 */
export function NoData({ canUpload }: { canUpload: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  return (
    <div data-no-data="" className="flex flex-wrap items-center justify-center gap-3 px-4 py-4 text-center text-md text-muted">
      <span>{t.noData}</span>
      {canUpload && <ButtonLink href="/kpm/data-upload" variant="secondary">{t.upload}</ButtonLink>}
    </div>
  );
}
