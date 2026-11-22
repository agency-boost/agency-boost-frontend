'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { cn } from '@/lib/cn';

export interface Choice<V extends string> {
  value: V;
  /** What it says, and its accessible name. */
  label: string;
  /** Drawn before the label: an avatar, a dot. Decorative. */
  lead?: ReactNode;
}

/**
 * **A small menu of choices behind a button that shows the chosen one** (P19.22-T8 AC-3, AC-4): an action item's state
 * (*Belum ⌄*), a PIC (a photo and a first name). The button keeps the look its caller gives it — a coloured pill, a
 * person — and says what it is for (`label`) beside what it shows; the menu opens under it, inside the screen, with each
 * choice a `menuitemradio`, the chosen one checked. Arrow keys move, Enter or Space choose, Escape closes and gives the
 * focus back.
 */
export function ChoiceMenu<V extends string>({
  label,
  value,
  choices,
  onChoose,
  disabled = false,
  align = 'start',
  className,
  children,
}: {
  /** The button's accessible name: *Status Aktifkan 3 agent*. */
  label: string;
  value: V | null;
  choices: readonly Choice<V>[];
  onChoose: (value: V) => void;
  disabled?: boolean;
  /** Which edge of the button the menu lines up with. */
  align?: 'start' | 'end';
  /** The button's classes: its pill, its tint. */
  className?: string;
  /** What the button shows. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];

  useEffect(() => {
    if (!open) return undefined;
    const all = items();
    (all.find((b) => b.getAttribute('aria-checked') === 'true') ?? all[0])?.focus();
    function outside(event: Event) {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || menu.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function onMenuKey(event: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') all[(at + 1) % all.length]?.focus();
    else if (event.key === 'ArrowUp') all[(at - 1 + all.length) % all.length]?.focus();
    else if (event.key === 'Home') all[0]?.focus();
    else if (event.key === 'End') all[all.length - 1]?.focus();
    else if (event.key === 'Escape' || event.key === 'Tab') close();
    else return;
    event.preventDefault();
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((now) => !now)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn('inline-flex min-h-11 items-center gap-1.5 disabled:cursor-default', className)}
      >
        {children}
        {!disabled && <LineIcon name="chevronDown" className="h-3.5 w-3.5 shrink-0" />}
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={cn(
            'absolute top-full z-30 mt-1 max-h-72 min-w-44 overflow-y-auto rounded-lg border border-card-edge bg-card p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="menuitemradio"
              aria-checked={choice.value === value}
              onClick={() => {
                close();
                if (choice.value !== value) onChoose(choice.value);
              }}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-md text-ink hover:bg-hover-row focus-visible:bg-hover-row',
                choice.value === value && 'font-semibold',
              )}
            >
              {choice.lead}
              <span className="min-w-0 flex-1 truncate">{choice.label}</span>
              {choice.value === value && <LineIcon name="check" className="h-4 w-4 shrink-0 text-navy" />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
