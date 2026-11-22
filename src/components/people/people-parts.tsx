'use client';

import type { ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { classOfRung, rungShort, useLadder } from '@/components/ui/role-badge';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { kept } from '@/i18n/kept';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { memberSheetMessages } from '@/i18n/messages/member-sheet';
import { cn } from '@/lib/cn';
import { daysAgoWords } from '@/lib/kpm-overview';
import type { HierarchyRole } from '@/lib/org';
import type { RecencyStatus } from '@/lib/people';

/**
 * **A 44px tap area round a small control** (UI-142: no target under 44px; WCAG 2.5.8): an invisible square centred on
 * it takes the tap, as an ⓘ's does (`TAP_AREA`) — the chip, the pencil and the name keep the size the mockups draw.
 */
export const HIT_AFTER = "after:absolute after:left-1/2 after:top-1/2 after:h-[max(100%,2.75rem)] "
  + "after:w-[max(100%,2.75rem)] after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";
/** `HIT_AFTER` on a control that is not positioned already. */
export const HIT_AREA = `relative ${HIT_AFTER}`;

/*
 * **People's naming rule and its two pills** (P19.20; `DESIGN-RULES.md`, *Names*; ADR-0273 §2): one place for what All
 * members, the member sheet, the Org tree, KPM admins and Import people draw beside a person.
 */

/**
 * **AB / AAB in small bold orange, right before the NAME in capitals, and ★ for a core leader** (`DESIGN-RULES.md`): the
 * company's own short name for the rung (`rungShort`), never a grey pill; an Agent has no label and no gap. The orange is
 * the accent's ink (`text-primary-ink`, 4.9:1), the shade small text may use (parity I-1081). The ★ carries its words for
 * a screen reader — colour and glyph are never the only cue.
 */
export function PersonName({
  name,
  role,
  rungCode,
  coreLeader = false,
  muted = false,
  className,
}: {
  name: string;
  role: HierarchyRole;
  /** The rung's ladder code, when known: the company's short name for it. */
  rungCode?: string;
  coreLeader?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const t = useMessages(memberSheetMessages);
  const ladder = useLadder();
  const code = rungCode ?? role.toUpperCase();
  const level = ladder.find((l) => l.code === code.toUpperCase());
  const leads = classOfRung(level ?? { code }) !== 'agent';
  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1.5', className)}>
      {leads && (
        <span className={cn('shrink-0 text-xs font-extrabold', muted ? 'text-muted' : 'text-primary-ink')}>
          {rungShort(code, ladder)}
        </span>
      )}
      <span className={cn('min-w-0 truncate font-bold uppercase tracking-[0.2px]', muted ? 'text-muted' : 'text-ink')}>{name}</span>
      {coreLeader && (
        <span className={cn('shrink-0', muted ? 'text-muted' : 'text-primary-ink')}>
          <span aria-hidden="true">★</span>
          <span className="sr-only">{t.coreLeader}</span>
        </span>
      )}
    </span>
  );
}

/** **One small navy chip, *Owner* or *Admin*, on the second line beside the agent code** (`DESIGN-RULES.md`). */
export function StewardChip({ owner, admin }: { owner?: boolean; admin?: boolean }) {
  if (!owner && !admin) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-pill bg-pill-blue px-1.5 text-2xs font-bold leading-4 text-pill-blue-ink">
      {owner ? kept('Owner') : kept('Admin')}
    </span>
  );
}

const RECENCY_TONE: Record<RecencyStatus, PillTone> = { recent: 'green', lapsed: 'amber', never: 'red' };

/**
 * **A coloured pill for *Aktivitas terakhir* and *Coaching terakhir*** (P19.20-T1 AC-2): *Hari ini*, *n hari lalu*,
 * *Belum pernah* — red never, yellow after 14 days, green otherwise, **the server's bucket** (`lastActivityStatus`,
 * `lastCoachedStatus`; ADR-0267 §4, §5), never a threshold of the page's own. The column's name is read first.
 */
export function RecencyPill({ days, status, label }: { days: number | null | undefined; status?: RecencyStatus; label: string }) {
  const language = useLanguage();
  if (days === undefined || !status) return null;
  return (
    <TonePill tone={RECENCY_TONE[status]}>
      <span className="sr-only">{label}: </span>
      {daysAgoWords(days, language)}
    </TonePill>
  );
}

/**
 * **The group chip** (P19.20-T1 AC-2; the brief's *Group* column): an AB's group in an orange chip that opens the Group
 * dialog, a dashed *Tanpa group* when none; an AAB's or an agent's grey and locked, *ikut AB …* under it. Long names end
 * in "…". `onOpen` makes an AB's chip a button; without it (a reader who changes no group) the chip only reads.
 */
export function GroupChip({
  name,
  locked = false,
  onOpen,
  label,
  className,
}: {
  /** The group's name, or `null` — *Tanpa group*. */
  name: string | null;
  /** An AAB or an agent: they follow their AB. */
  locked?: boolean;
  onOpen?: () => void;
  /** The control's accessible name: *Ubah group untuk …*. */
  label?: string;
  className?: string;
}) {
  const t = useMessages(memberSheetMessages);
  const body: ReactNode = (
    <>
      {locked && <LineIcon name="lock" className="h-3.5 w-3.5" />}
      <span className="min-w-0 truncate">{name ?? t.noGroup}</span>
    </>
  );
  const look = cn(
    'inline-flex h-7 max-w-full items-center gap-1 rounded-pill px-2.5 text-xs font-semibold',
    locked
      ? 'bg-pill-grey text-pill-grey-ink'
      : name === null
        ? 'border border-dashed border-line text-muted'
        : 'border border-primary/40 bg-primary/[0.08] text-primary-ink',
    className,
  );
  if (onOpen && !locked) {
    return (
      <button type="button" onClick={onOpen} aria-label={label} title={name ?? undefined} className={cn(look, HIT_AREA, 'hover:bg-primary/[0.14]')}>
        {body}
      </button>
    );
  }
  return <span className={look} title={name ?? undefined}>{body}</span>;
}
