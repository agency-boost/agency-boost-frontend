'use client';

import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { cn } from '@/lib/cn';
import { potensiBadgeOf, type Lead, type LeadType } from '@/lib/leads';

/**
 * **The *Potensi* switch** (P19.1-T2 AC-5; UI-153 items 1–2; ADR-0193 §1): the lead's commitment for the office's month —
 * the same saved field the old *Closing / Rekrut bulan ini* box wrote — labelled by the lead's type: ***Potensi closing
 * bulan ini*** on a Sales lead, ***Potensi rekrut bulan ini*** on a Recruit lead.
 *
 * - **`card`, the lead sheet's** (the owner, 3 Nov): one slim 44px card between *Status* and *Tindakan berikutnya* — a
 *   26px target icon, the label, the switch on the right; navy when on, grey-blue with a dashed border when off; no
 *   sub-line, nothing orange (orange is status). **The whole card is the switch** (`role="switch"`), never a checkbox
 *   and never a status option.
 * - **`small`, the leads table's *BULAN INI* cell** (AC-8): the same switch, small, with its label beside it.
 *
 * Its colours are tokens (`tokens.md`, *November 2026 tokens*): off `switch-off` with the `switch-off-edge` dashed border
 * and track — the stop-motion's paler border and track miss 3:1 (a *Fix*); on `navy`, the track `info`, the thumb white.
 */
export function PotensiSwitch({
  type, checked, onChange, disabled = false, size = 'card', label, id,
}: {
  type: LeadType;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Read-only — a finalized session's lock, a save in flight. Held with `aria-disabled`, so the focus stays. */
  disabled?: boolean;
  size?: 'card' | 'small';
  /** The accessible name where the visible words are not enough — a table cell's, scoped to its row. */
  label?: string;
  id?: string;
}) {
  const t = useMessages(leadsMessages).potensi;
  const words = type === 'recruitment' ? t.recruitment : t.sales;
  const toggle = () => { if (!disabled) onChange(!checked); };

  if (size === 'small') {
    return (
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={toggle}
        data-potensi-switch="small"
        className={cn('flex min-h-8 items-center gap-1.5 text-left text-xs leading-tight', checked ? 'text-navy' : 'text-muted')}
      >
        <Track checked={checked} small />
        <span>{words}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={toggle}
      data-potensi-switch="card"
      className={cn(
        'flex h-11 w-full items-center gap-2.5 rounded-row px-2.5 text-left',
        checked ? 'border border-secondary bg-secondary' : 'border border-dashed border-switch-off-edge bg-switch-off',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full',
          checked ? 'bg-secondary-hover text-secondary-contrast' : 'bg-card text-navy',
        )}
      >
        <LineIcon name="target" className="h-4 w-4" />
      </span>
      <span className={cn('min-w-0 flex-1 text-[15px] font-bold', checked ? 'text-secondary-contrast' : 'text-navy')}>{words}</span>
      <Track checked={checked} />
    </button>
  );
}

/** The track and its thumb: on `info` with the thumb right, off `switch-off-edge` with the thumb left. */
function Track({ checked, small = false }: { checked: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-block shrink-0 rounded-pill',
        small ? 'h-[18px] w-8' : 'h-6 w-[42px]',
        checked ? 'bg-info' : 'bg-switch-off-edge',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] rounded-full bg-white shadow-sm transition-[left] motion-reduce:transition-none',
          small ? 'h-3 w-3' : 'h-[18px] w-[18px]',
          checked ? (small ? 'left-[17px]' : 'left-[21px]') : 'left-[3px]',
        )}
      />
    </span>
  );
}

/**
 * **The avatar's ✓ badge** (P19.1-T2 AC-8; UI-153 item 5; Q-3): a 17px disc with a 2px white ring on the avatar's
 * top-right — **yellow ✓** while the lead is switched on this month and open, **green ✓** once that switched-on lead was
 * marked *Berhasil* this month, nothing when it is off. The card's height and layout do not move. The two discs differ
 * too little to be told apart by colour (1.4.1), so each is named, and its name is its tooltip; the yellow one's ✓ is
 * navy, a white one would miss 3:1 (a *Fix*, `tokens.md`).
 */
export function PotensiBadge({ lead, className }: { lead: Pick<Lead, 'thisMonth' | 'closedThisMonth' | 'outcome'>; className?: string }) {
  const t = useMessages(leadsMessages).potensi;
  const badge = potensiBadgeOf(lead);
  if (!badge) return null;
  const name = badge === 'won' ? t.badgeWon : t.badge;
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      data-potensi-badge={badge}
      className={cn(
        'absolute -right-1 -top-[3px] z-[1] flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white',
        badge === 'won' ? 'bg-badge-won text-white' : 'bg-badge-potensi text-navy',
        className,
      )}
    >
      <LineIcon name="check" className="h-[10px] w-[10px] [stroke-width:3]" />
    </span>
  );
}
