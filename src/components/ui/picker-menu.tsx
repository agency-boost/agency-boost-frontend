'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { HEADER_BUTTON } from './header-control';
import { LineIcon } from './line-icon';

/** One choice: what it stands for, and its words — in the menu, and on the button while it is chosen. */
export interface PickerOption<V extends string = string> {
  readonly value: V;
  readonly label: string;
}

/**
 * **A labelled run of choices** — the ratio card's *PER ORANG* over every person of the Group (MOB UI-184). The label is
 * a small grey line in the menu, never a choice; a screen reader hears it as the group's name.
 */
export interface PickerGroup<V extends string = string> {
  readonly group: string;
  readonly options: readonly PickerOption<V>[];
}

export type PickerItem<V extends string = string> = PickerOption<V> | PickerGroup<V>;

const isGroup = <V extends string>(item: PickerItem<V>): item is PickerGroup<V> => 'options' in item;

/** Every choice in the menu's order, the groups' opened out. */
export function pickerOptions<V extends string>(items: readonly PickerItem<V>[]): PickerOption<V>[] {
  return items.flatMap((item) => (isGroup(item) ? [...item.options] : [item]));
}

/** Room kept between the menu and the screen's sides: the page's 16px gutters (ADR-0227 §2). */
const GUTTER_PX = 16;
/** Room kept above and below it, against the screen's top, its foot or the tab bar. */
const EDGE_PX = 8;
/** Between the button and the menu (the mockups' 6px). */
const GAP_PX = 6;
/** The tallest the menu grows before it scrolls inside itself: six and a half 44px rows and the card's padding. */
const MAX_HEIGHT_PX = 300;
/** The least it shrinks to where the screen has little room: three rows. */
const MIN_HEIGHT_PX = 144;

/**
 * **A picker: a button that opens a small menu right under it** (P19.8-T1 AC-2; R6, D-38; ADR-0227 §2; MOB UI-171).
 * The Calendar's view (*Agenda · 3 Hari · Week · Month*), the Unit Dashboard's period and *Potensi* month, the ratio
 * card's *Unit · Group · PER ORANG · each person*.
 *
 * **Never the phone's native select, never a bottom sheet, at any size.** A native select under 16px makes an iPhone
 * zoom the page (R1), and the owner chose 13px for every header control and *"a dropdown, not a bottom sheet"*. This is
 * not a form field, so nothing zooms.
 *
 * - **The button** is a header control (`HEADER_BUTTON`: 13px, 600, 44px, a white pill): the chosen option's words and
 *   a ⌄. Its accessible name is the picker's `label` and then the value — *"Tampilan Agenda"* — so the words a reader
 *   sees are in the name a voice command uses (WCAG 2.5.3).
 * - **The menu** is a white card under the button, its left edge on the button's (`align="end"`: its right edge), kept
 *   inside the 16px gutters and over the tab bar; **above the button when the screen has no room below**. Rows 44px,
 *   13px / 600; the chosen one on the grey of a row with a ✓; optional group labels; a list longer than 300px scrolls
 *   inside the card. On a phone a light shade lies over the page behind it, as the mockups draw.
 * - **Closing.** A tap outside — on the shade — or Escape closes it and **the focus returns to the button**; Tab closes
 *   it from the button, and moves on. Choosing closes it, focus on the button, and then tells the caller.
 * - **Keyboard and screen reader** (the WAI-ARIA *select-only* pattern, its popup a `listbox`): the button says it opens
 *   a list (`aria-haspopup="listbox"`, `aria-expanded`); ↓, ↑, Enter or Space open it on the chosen option; in it ↑ ↓
 *   Home End move, a letter jumps to the next choice starting with it, Enter and Space choose. Each option says whether
 *   it is the chosen one (`aria-selected`).
 *
 * **Placed against the window, not the page** (as `ActionMenu`): a card that scrolls one way clips the other, and a
 * menu fixed to the screen is never cut off by the box its button sits in. It follows the button while the page
 * scrolls.
 */
export function PickerMenu<V extends string>({
  label,
  value,
  options,
  onChange,
  buttonLabel,
  tone = 'card',
  align = 'start',
  disabled = false,
  className,
  id,
}: {
  /** Names the picker for a screen reader, before its value — *"Tampilan"*, *"Periode"*, *"Bulan"*. Not drawn. */
  label: string;
  /** The chosen option's value. */
  value: V;
  /** The choices, in the menu's order; a group draws its label above its own. */
  options: readonly PickerItem<V>[];
  /** Called with the new value once one is chosen — never for the one already chosen. */
  onChange: (value: V) => void;
  /** The button's words where they are not the chosen option's — a value no option holds. */
  buttonLabel?: string;
  /**
   * `card`: the white pill with a line, on the page's grey (the default). `on-secondary`: the white pill with no line,
   * on a card filled with the secondary colour — the ratio card's *Unit ⌄* (the mockup's `.rdd`).
   */
  tone?: 'card' | 'on-secondary';
  /** Which of the button's edges the menu lines up with: its left (`start`, the default) or its right (`end`). */
  align?: 'start' | 'end';
  disabled?: boolean;
  /** On the button: its width in a row — `flex-1`, `w-full`, `ml-auto`. */
  className?: string;
  /** The button's id. */
  id?: string;
}) {
  const [open, setOpen] = useState<null | 'chosen' | 'last'>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const typed = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const auto = useId();
  const buttonId = id ?? `${auto}-button`;
  const labelId = `${auto}-label`;
  const valueId = `${auto}-value`;
  const listId = `${auto}-list`;
  const optionId = (index: number) => `${auto}-option-${index}`;

  const flat = pickerOptions(options);
  const chosen = flat.find((option) => option.value === value);
  const shown = buttonLabel ?? chosen?.label ?? '';

  const rows = useCallback(
    () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])],
    [],
  );

  const close = useCallback((refocus: boolean) => {
    setOpen(null);
    if (refocus) trigger.current?.focus();
  }, []);

  /**
   * Under the button, or over it when the screen has more room above and too little below; never past the gutters, the
   * top edge or the tab bar. **Written to the element, not kept in state**, so the menu is never drawn once unplaced.
   */
  const place = useCallback(() => {
    const at = trigger.current?.getBoundingClientRect();
    const box = menu.current;
    if (!at || !box) return;
    const viewport = document.documentElement;
    const bar = document.querySelector('[data-tab-bar]')?.getBoundingClientRect();
    // The tab bar is drawn below 1024px; where it is not (`lg:hidden`), it has no height.
    const floor = bar && bar.height > 0 ? Math.min(bar.top, viewport.clientHeight) : viewport.clientHeight;
    box.style.minWidth = `${Math.round(at.width)}px`;
    box.style.maxHeight = '';
    const natural = Math.min(box.scrollHeight, MAX_HEIGHT_PX);
    const below = floor - at.bottom - GAP_PX - EDGE_PX;
    const above = at.top - GAP_PX - EDGE_PX;
    const up = natural > below && above > below;
    const room = Math.max(up ? above : below, 0);
    const height = Math.max(Math.min(natural, room), Math.min(natural, MIN_HEIGHT_PX));
    box.style.maxHeight = `${height}px`;
    box.style.top = `${up ? Math.max(EDGE_PX, at.top - GAP_PX - height) : at.bottom + GAP_PX}px`;
    const width = box.offsetWidth;
    const start = align === 'end' ? at.right - width : at.left;
    box.style.left = `${Math.max(GUTTER_PX, Math.min(start, viewport.clientWidth - GUTTER_PX - width))}px`;
  }, [align]);

  /** Focus on a row, and the menu's own scroll brought to it — the page never moves. */
  const reach = useCallback((row: HTMLElement | undefined) => {
    const list = menu.current;
    if (!row || !list) return;
    row.focus({ preventScroll: true });
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const all = rows();
    const at = all.findIndex((row) => row.getAttribute('aria-selected') === 'true');
    reach(at >= 0 ? all[at] : open === 'last' ? all[all.length - 1] : all[0]);
    // Only as it opens: a re-render while it is open must not pull the focus back to the chosen row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /*
     * Outside the button, the menu and the shade: a box drawn over the shade — a page's own stacking — took the press.
     * Where it is going is the reader's; the focus is theirs. The shade's own press is `onShade`.
     */
    function outside(event: Event) {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || menu.current?.contains(target) || shade.current?.contains(target)) return;
      setOpen(null);
    }
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  function choose(next: V) {
    close(true);
    if (next !== value) onChange(next);
  }

  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(event.key === 'ArrowUp' ? 'last' : 'chosen');
    }
  }

  /** A letter: the next choice after the focused one whose words start with what was typed in the last half second. */
  function jump(key: string, all: HTMLElement[], at: number) {
    const now = Date.now();
    const text = (now - typed.current.at < 500 ? typed.current.text : '') + key.toLocaleLowerCase();
    typed.current = { text, at: now };
    const from = text.length > 1 ? at : at + 1;
    for (let step = 0; step < all.length; step += 1) {
      const row = all[(from + step + all.length) % all.length];
      if ((row.textContent ?? '').trim().toLocaleLowerCase().startsWith(text)) {
        reach(row);
        return;
      }
    }
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const all = rows();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => {
      event.preventDefault();
      reach(all[Math.max(0, Math.min(all.length - 1, index))]);
    };
    switch (event.key) {
      case 'ArrowDown': return go(at + 1);
      case 'ArrowUp': return go(at - 1);
      case 'Home': return go(0);
      case 'End': return go(all.length - 1);
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const picked = flat[at];
        if (picked) choose(picked.value);
        return;
      }
      case 'Escape':
        // Its own: a dialog the picker sits in stays open.
        event.preventDefault();
        event.stopPropagation();
        return close(true);
      case 'Tab':
        // Back on the button before the browser moves on, so Tab goes to what follows it, not to the page's top.
        return close(true);
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          jump(event.key, all, at);
        }
    }
  }

  let index = -1;
  const row = (option: PickerOption<V>) => {
    index += 1;
    const on = option.value === value;
    return (
      <div
        key={option.value}
        id={optionId(index)}
        role="option"
        aria-selected={on}
        tabIndex={-1}
        data-picker-option=""
        onClick={() => choose(option.value)}
        className={cn(
          'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-base font-semibold',
          'leading-snug text-ink outline-none hover:bg-hover-row focus:bg-primary-50',
          // A focus ring for the keyboard as well as the tint: the ring is the app's, never removed (WCAG 2.4.7).
          'focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-2px] focus-visible:outline-focus-ring',
          on && 'bg-hover-row',
        )}
      >
        <span className="min-w-0 break-words">{option.label}</span>
        {on && <LineIcon name="check" className="h-[18px] w-[18px] text-primary-ink" />}
      </div>
    );
  };

  return (
    <>
      <span id={labelId} hidden>{label}</span>
      <button
        ref={trigger}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open !== null}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        data-picker-button=""
        onKeyDown={onTriggerKey}
        onClick={() => (open ? close(false) : setOpen('chosen'))}
        className={cn(
          HEADER_BUTTON,
          'justify-between',
          tone === 'on-secondary' && 'border-transparent text-navy',
          className,
        )}
      >
        <span id={valueId} className="min-w-0 truncate">{shown}</span>
        <LineIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/*
            * The shade (the mockups' `.shade`): over the page on a phone, clear from 768px. A press on it closes the menu
            * and nothing under it — it is the menu's outside — and the focus goes back to the button.
            */}
          <div
            ref={shade}
            aria-hidden="true"
            data-picker-shade=""
            className="fixed inset-0 z-[45] max-md:bg-ink/[0.12]"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => close(true)}
          />
          <div
            ref={menu}
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            tabIndex={-1}
            data-picker-menu=""
            onKeyDown={onMenuKey}
            className={cn(
              'fixed z-[45] w-max min-w-[10.5rem] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain',
              'rounded-row bg-card p-1.5 shadow-modal outline-none',
            )}
          >
            {options.map((item) => {
              if (!isGroup(item)) return row(item);
              const groupId = `${auto}-group-${item.group.replace(/\W+/g, '-')}`;
              return (
                <div key={`group:${item.group}`} role="group" aria-labelledby={groupId}>
                  <div
                    id={groupId}
                    data-picker-group=""
                    className="mt-1 border-t border-divider px-3 pb-1 pt-2 text-xs font-bold tracking-[0.04em] text-muted"
                  >
                    {item.group}
                  </div>
                  {item.options.map(row)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
