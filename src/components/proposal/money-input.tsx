'use client';

import { useEffect, useRef, useState } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import { formatMoneyInFull, formatRupiahCompact, moneyPrefix, MINOR_UNITS_PER_MAJOR } from '@/lib/format';
import type { ProposalCurrency } from '@/lib/proposals';

/** How long a typed figure waits before it is saved; leaving the box saves at once. */
export const TYPED_SAVE_MS = 500;

/** What a box holds, in whole units of its currency: digits, or nothing. */
const textOf = (minor: number | null | undefined) =>
  minor === null || minor === undefined ? '' : String(Math.round(minor / MINOR_UNITS_PER_MAJOR));

/**
 * **A money field: the number keypad, the item's currency, and its quick amounts** (AC-7; the spec's *"number keypad
 * field, optional quick buttons (100 jt · 250 jt · 500 jt · 1 M)"*; ADR-0225 §2, §8).
 *
 * - **Whole units of the item's currency** are typed (`inputMode="numeric"`), stored as minor units — the server's
 *   `amountMinor`, a sen or a cent. A USD item's box says *USD*, and has no quick amounts: they are rupiah (§2).
 * - **Saved as it is typed**, half a second after the last digit, and at once on leaving the box — so nothing typed is
 *   lost (Acc. 18). A sum below the field's `minMinor` (*min 100 jt*) is not sent: the box says *Minimal …* under it, as
 *   the server would refuse it (`400`).
 * - **It keeps what was typed** when a save fails; it takes the server's figure again only while it is not being typed in.
 */
export function MoneyInput({
  id,
  labelledBy,
  currency,
  valueMinor,
  minMinor = null,
  quickAmounts = [],
  disabled = false,
  onCommit,
}: {
  id: string;
  labelledBy: string;
  currency: ProposalCurrency;
  valueMinor: number | null | undefined;
  minMinor?: number | null;
  quickAmounts?: readonly number[];
  disabled?: boolean;
  onCommit: (minor: number | null) => void;
}) {
  const t = useMessages(proposalMessages).panel;
  const figures = useFigureLanguage();
  const [text, setText] = useState(textOf(valueMinor));
  const typing = useRef(false);
  const sent = useRef<number | null>(valueMinor ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server's figure, whenever it changes and the reader is not typing over it.
  useEffect(() => {
    if (typing.current) return;
    setText(textOf(valueMinor));
    sent.current = valueMinor ?? null;
  }, [valueMinor]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const minorOf = (digits: string) => (digits === '' ? null : Number(digits) * MINOR_UNITS_PER_MAJOR);
  const belowMinimum = (minor: number | null) =>
    currency === 'IDR' && minMinor !== null && minor !== null && minor < minMinor;

  const commit = (digits: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const minor = minorOf(digits);
    if (belowMinimum(minor) || minor === sent.current) return;
    sent.current = minor;
    onCommit(minor);
  };

  const typed = minorOf(text);
  const low = belowMinimum(typed);
  const hintId = `${id}-min`;
  const quick = currency === 'IDR' ? quickAmounts : [];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex h-12 w-full items-center gap-1 rounded-pill bg-hover-row pl-4 pr-2',
          low && 'shadow-[inset_0_0_0_1.5px_var(--color-signal-red)]',
          disabled && 'opacity-40',
        )}
      >
        <span id={`${id}-currency`} className="shrink-0 text-md font-semibold text-muted">
          {currency === 'IDR' ? moneyPrefix(figures) : currency}
        </span>
        <input
          id={id}
          type="text"
          aria-labelledby={labelledBy}
          aria-describedby={[`${id}-currency`, low ? hintId : null].filter(Boolean).join(' ')}
          aria-invalid={low || undefined}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={15}
          disabled={disabled}
          value={text}
          onFocus={() => { typing.current = true; }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            setText(digits);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(digits), TYPED_SAVE_MS);
          }}
          onBlur={() => { typing.current = false; commit(text); }}
          className="h-12 min-w-0 flex-1 border-0 bg-transparent px-1 text-lg font-bold text-ink disabled:cursor-not-allowed"
        />
      </div>
      {low && minMinor !== null && (
        <p id={hintId} className="text-sm text-alert">{t.atLeast({ amount: formatMoneyInFull(minMinor, currency, figures) })}</p>
      )}
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quick.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={disabled}
              aria-pressed={typed === amount}
              onClick={() => { setText(textOf(amount)); commit(textOf(amount)); }}
              className={cn(
                'min-h-12 rounded-pill px-4 text-md font-semibold disabled:cursor-not-allowed disabled:opacity-40',
                typed === amount ? 'bg-secondary text-secondary-contrast' : 'bg-hover-row text-navy hover:bg-secondary/[0.08]',
              )}
            >
              {formatRupiahCompact(amount, {}, figures)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
