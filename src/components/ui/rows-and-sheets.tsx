'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ActionMenu, type ActionMenuItem } from './action-menu';
import { Button } from './field';
import { LineIcon } from './line-icon';
import { Modal } from './modal';
import { TippedGlyph } from './tipped-glyph';
import { useMessages } from '@/i18n/language-provider';
import { adminLayoutMessages } from '@/i18n/messages/admin-layout';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';

/*
 * **`/admin`'s rows, sheets and pills** (P19.2-T2; UI-126, UI-133, UI-134, UI-135; `admin-mobile` and
 * `admin-desktop-2026-11-02`): the console's few shapes, built once and drawn by every `/admin` page — the ⋯ on a row,
 * the *+* on a title row, a choice drawn as rows rather than a native `<select>`, a pill that opens such a choice, an ⓘ,
 * and the add sheet with its pinned *Batal / Tambah*.
 *
 * **44px below 1024px** (UI-135: *≥ 44px on mobile and tablet*), whatever shell draws the page: each class here says so
 * itself, rather than leaning on the field shell's `touch.ts`, which holds only inside that shell's frame.
 *
 * **Shared primitives, not a route's** (P19.2-T2, 2026-11-06): built for `/admin`, and drawn as well by `products-tab.tsx`,
 * which a component must not reach into `app/` for — so they live here, beside `list-rows.tsx`, with no change to what they
 * draw or do. Their words are still the `admin-layout` area's.
 */

/** A target's 44px below 1024px, its content centred (UI-135). */
export const ADMIN_TARGET = 'max-lg:min-h-11 max-lg:min-w-11 max-lg:justify-center';

/**
 * **⋯ on a row** (UI-126: *⋯ (Ubah · Tangguhkan)*; UI-135: *row actions move into ⋯*): the shared `ActionMenu`, its
 * glyph the mockup's ⋯ and its button 44px below 1024px. An item that asks first opens its own confirmation.
 */
export function RowMenu({ name, items }: { name: string; items: readonly ActionMenuItem[] }) {
  const t = useMessages(adminLayoutMessages);
  return <ActionMenu label={t.actionsFor({ name })} items={items} glyph="⋯" triggerClassName={ADMIN_TARGET} />;
}

/**
 * **The title row's add button** (UI-133): a 40px round *+* on a phone, named by its words; *+ Tambah perusahaan* — a
 * pill with its words — from 768px. It opens the page's add sheet; nothing is open until it is pressed.
 */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  const phone = useMediaQuery('phone');
  if (phone) {
    return (
      <Button
        aria-label={label}
        aria-haspopup="dialog"
        onClick={onClick}
        className="h-10 w-10 shrink-0 rounded-pill p-0 max-lg:h-11 max-lg:w-11"
      >
        <LineIcon name="plus" className="h-5 w-5" />
      </Button>
    );
  }
  return (
    <Button aria-haspopup="dialog" onClick={onClick} className="gap-1.5 rounded-pill max-lg:h-11">
      <LineIcon name="plus" className="h-4 w-4" />
      {label}
    </Button>
  );
}

/** One option of a choice: its key, its words, and a line under them where it needs one. */
export interface ChoiceOption<K extends string = string> {
  readonly key: K;
  readonly label: string;
  readonly hint?: string;
}

/**
 * **Choice rows** (UI-134: *choice rows (radio cards) inside the sheet for 2–5 options*; `admin-mobile` screen 7's
 * *Mulai dari*): one 48px card per option, the chosen one ringed amber with its dot filled. A real `radiogroup` — the
 * arrows move between them — named by its label, which the form shows above it. **An option's line under its words is
 * its description**, not part of its name, as a select's hint was the select's (`aria-describedby`).
 */
export function ChoiceRows<K extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  disabled = false,
  'aria-describedby': describedBy,
}: {
  label?: string;
  labelledBy?: string;
  /** The choice's hint and its error, as a `Field` links them to a select (the subscription's *Paket*). */
  'aria-describedby'?: string;
  options: readonly ChoiceOption<K>[];
  value: K;
  onChange: (key: K) => void;
  disabled?: boolean;
}) {
  const move = (event: React.KeyboardEvent, at: number) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = options[(at + step + options.length) % options.length];
    onChange(next.key);
    const group = (event.currentTarget as HTMLElement).parentElement;
    (group?.querySelector<HTMLElement>(`[data-choice="${next.key}"]`))?.focus();
  };
  const base = useId();
  /** With nothing chosen yet — a role still to map — the first option takes the keyboard, as a radio group's does. */
  const none = !options.some((o) => o.key === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex flex-col gap-1.5"
    >
      {options.map((option, at) => {
        const on = option.key === value;
        const id = `${base}-${option.key}`;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-labelledby={`${id}-label`}
            aria-describedby={option.hint ? `${id}-hint` : undefined}
            data-choice={option.key}
            tabIndex={on || (none && at === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.key)}
            onKeyDown={(e) => move(e, at)}
            className={cn(
              'flex min-h-12 items-center gap-3 rounded-row px-3 text-left text-md text-ink disabled:opacity-40',
              on ? 'bg-primary/[0.12] font-semibold ring-[1.5px] ring-inset ring-primary' : 'bg-hover-row',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill border-2',
                on ? 'border-primary' : 'border-signal-grey',
              )}
            >
              {on && <span className="h-2 w-2 rounded-pill bg-primary" />}
            </span>
            <span className="min-w-0 flex-1">
              <span id={`${id}-label`} className="block">{option.label}</span>
              {option.hint && <span id={`${id}-hint`} className="block text-sm font-normal text-muted">{option.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * **A select's field, drawn as choice rows** (P19.2-T2 AC-4; UI-134: *choice rows for 2–5 options*): the label a `Field`
 * would draw, the rows naming themselves by it, and the hint and the error under them, linked as a `Field` links them to
 * a select. For a field below 1024px whose laptop keeps its select — *Paket*, a KPM's *Status*, a survey's *Jadwal*.
 */
export function ChoiceField<K extends string>({
  id,
  label,
  hint,
  error,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: {
  /** The field's own id: its label's, hint's and error's are made from it. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  options: readonly ChoiceOption<K>[];
  value: K;
  onChange: (key: K) => void;
  disabled?: boolean;
  className?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p id={`${id}-label`} className="text-sm font-semibold text-navy">{label}</p>
      <ChoiceRows
        labelledBy={`${id}-label`}
        aria-describedby={describedBy}
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-alert">{error}</p>}
    </div>
  );
}

/**
 * **A pill that opens a choice** (UI-134: *a pill that opens a sheet for long lists (company, Cakupan)*; UI-132's
 * *Cakupan · Perusahaan · Tindakan · Pelaku · Tanggal*): the pill says what is chosen — or the filter's name, while
 * nothing narrows it — with a ⌄, navy once it narrows something; a tap opens the sheet of choice rows, and a choice
 * closes it. 44px below 1024px, 36px from it, as the chips beside it.
 *
 * **`value`** (`admin-mobile` screen 4's leader tier, *Bukan leader ⌄*): a value rather than a filter — the pill always
 * says the choice, on the quiet ground, never navy. Its accessible name is *what: the choice* either way.
 */
export function ChoicePill<K extends string>({
  name,
  options,
  value,
  onChange,
  narrows,
  shows = 'filter',
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: {
  /** The filter's name: the pill's words while nothing is chosen, and the sheet's title. */
  name: string;
  options: readonly ChoiceOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Whether the choice narrows anything: the pill is navy then. */
  narrows: boolean;
  /** `'value'`: the pill says the choice, quiet, whatever it is — a rung's tier rather than a filter. */
  shows?: 'filter' | 'value';
  disabled?: boolean;
  /** Inside a `Field`: the label's `htmlFor`, and the hint and the error the field links to it. */
  id?: string;
  'aria-describedby'?: string;
  className?: string;
}) {
  const t = useMessages(adminLayoutMessages);
  const ui = useMessages(uiV1Messages);
  const [open, setOpen] = useState(false);
  const phone = useMediaQuery('phone');
  const chosen = options.find((o) => o.key === value);
  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-label={`${name}: ${chosen?.label ?? name}`}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-11 max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-3 text-base font-semibold disabled:opacity-40 lg:min-h-9 lg:px-3.5',
          shows === 'value' ? 'bg-hover-row text-navy'
            : narrows ? 'bg-secondary text-secondary-contrast' : 'bg-card text-pill-grey-ink hover:bg-hover-row',
          className,
        )}
      >
        <span className="truncate">{shows === 'value' || narrows ? chosen?.label ?? name : name}</span>
        <LineIcon name="chevronDown" className="h-4 w-4 shrink-0" />
      </button>
      <Modal
        open={open}
        title={t.choose({ what: name })}
        onClose={() => setOpen(false)}
        placement={phone ? 'sheet' : 'center'}
        handle={phone}
        closeLabel={ui.close}
      >
        <div className="pb-2">
          <ChoiceRows
            label={name}
            options={options}
            value={value}
            onChange={(key) => {
              onChange(key);
              setOpen(false);
            }}
          />
        </div>
      </Modal>
    </>
  );
}

/** **ⓘ** (UI-136: *behind ⓘ*): the shared `TippedGlyph`, its words the explanation as it was written. */
export function InfoTip({ about, tip, className }: { about: string; tip: string; className?: string }) {
  const t = useMessages(adminLayoutMessages);
  return (
    <TippedGlyph glyph="ⓘ" name={t.about({ what: about })} tip={tip} align="fit" className={cn('align-middle', className)} />
  );
}

/**
 * **The add sheet** (UI-133: *a bottom sheet (mobile) or centred modal (tablet, desktop) with pinned Batal / Tambah*;
 * D-01): a form inside the shared `Modal` — a sheet with its handle below 768px, centred from it — whose *Batal* and main
 * button stay at its foot while the fields scroll. **The main button is enabled**: a field left empty says so, inline,
 * when it is pressed. Esc, ✕ and the backdrop close it without saving.
 */
export function AddSheet({
  open,
  title,
  submitLabel,
  busy = false,
  wide = false,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  /** A long form — *KPM baru*'s three steps — gets the old page card's width from 768px rather than 30rem. */
  wide?: boolean;
  /** The main button's words — *Tambah perusahaan*; the busy words while it saves. */
  submitLabel: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
}) {
  const t = useMessages(adminLayoutMessages);
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const formId = useId();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      className={phone ? undefined : wide ? 'max-w-2xl' : 'max-w-[30rem]'}
      footer={(
        <div className="flex justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" onClick={onClose} className="max-lg:h-11">{t.cancel}</Button>
          <Button type="submit" form={formId} disabled={busy} className="max-lg:h-11">{submitLabel}</Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pb-2">
        {children}
      </form>
    </Modal>
  );
}
