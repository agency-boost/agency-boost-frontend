import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  /*
   * The hint is **linked**, not merely printed beside the field.
   *
   * It rendered as a loose `<p>`, so a screen reader announced the label and stopped —
   * every *"Permanent once saved"*, every *"The server checks this too"* was invisible to
   * the readers most likely to need it. Cloning the control is the only way to attach it
   * without making every caller remember an id.
   */
  const described = React.isValidElement(children) && describedBy
    ? React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
      'aria-describedby': describedBy,
    })
    : children;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-navy">
        {label}
      </label>
      {described}
      {/*
       * **Below the control, never between it and the label.**
       *
       * Two fields side by side, one hinted and one not, put their inputs on different lines —
       * the hinted one pushed down by the height of its own hint. The client's report was that
       * the rows looked broken, and they were: the only thing holding them apart was guidance
       * that belongs *after* the thing it describes anyway.
       *
       * `aria-describedby` is id-based, so nothing announced changes. Hint before error keeps
       * the visual order matching the `describedBy` string built above.
       */}
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {/* Announced to assistive technology, not just coloured red. */}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A value the form shows but nobody can change.
 *
 * Not a disabled `TextInput`: a disabled control says *not available right now*, and
 * these are permanent v1 product decisions — a KPM's time zone and its currency. It is
 * not a `Field` either, because a `<label>` with nothing to label is a lie to a screen
 * reader; this is a `<dl>` row, which is what the office detail screen already uses for
 * the same two values.
 *
 * The reason is not optional. A value shown with no control and no explanation reads as
 * a field that failed to load.
 */
export function ReadOnlyField({
  label,
  value,
  reason,
  className,
}: {
  label: string;
  value: string;
  reason: string;
  className?: string;
}) {
  return (
    <dl className={cn('flex flex-col gap-1 rounded-md border border-hairline bg-base p-3', className)}>
      <dt className="text-sm font-semibold text-navy">{label}</dt>
      <dd className="text-md text-navy">{value}</dd>
      <dd className="text-xs text-muted">{reason}</dd>
    </dl>
  );
}

export function TextInput({
  className,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 rounded-md border bg-card px-3 text-base text-navy',
        invalid ? 'border-alert' : 'border-hairline',
        className,
      )}
    />
  );
}

export function Select({
  className,
  invalid,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 rounded-md border bg-card px-3 text-base text-navy',
        invalid ? 'border-alert' : 'border-hairline',
        className,
      )}
    />
  );
}

/**
 * A colour, picked or typed.
 *
 * **Both halves, and neither is decoration.** A native `<input type="color">` opens the operating
 * system's picker, which is the point — the field used to ask for *"a hash and six hex digits"* and
 * most people do not think in hex. But that picker is a dialog a screen reader cannot drive, and it
 * is no way to paste a brand colour somebody was handed, so the text input stays and the two are
 * kept in step.
 *
 * The swatch is `aria-hidden` and carries no label of its own: it would otherwise announce as a
 * second, unnamed control for the same value.
 */
export function ColorInput({
  id,
  value,
  disabled,
  onChange,
  className,
  'aria-describedby': describedBy,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  /**
   * Forwarded to the **text** input, not kept on the wrapper.
   *
   * `Field` attaches the hint by cloning its single child, and this component's single child is
   * a `<div>` — so without this the description would land on a `<div>` nothing announces, and
   * the hint would be linked to nothing. The swatch is `aria-hidden`, so the text input is the
   * one control here that a description can belong to.
   */
  'aria-describedby'?: string;
}) {
  /*
   * The picker has no empty state — it falls back to black — so an unset colour shows the card's
   * own surface rather than claiming a value nobody chose.
   *
   * The literal is the **value of a form control**, not a style: `<input type="color">` takes a
   * hex string and cannot be handed a CSS variable. It is `--color-card` written out, and the
   * token lint cannot tell the two uses apart.
   */
  // eslint-disable-next-line no-restricted-syntax
  const UNSET = '#ffffff';
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : UNSET;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        type="color"
        aria-hidden="true"
        tabIndex={-1}
        value={swatch}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-hairline bg-card p-1 disabled:cursor-not-allowed"
      />
      <TextInput
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1"
      />
    </div>
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-20 rounded-md border bg-card px-3 py-2 text-base text-navy',
        invalid ? 'border-alert' : 'border-hairline',
        className,
      )}
    />
  );
}

/** A button shaped like a button. Not for the two inline variants, which are text. */
const BUTTON_BASE =
  'inline-flex h-10 items-center justify-center rounded-md px-4 text-md font-semibold';
/**
 * A row's own action: text, not a box (`KPM_Owner.html:289-292`).
 *
 * Still a real `<button>` — only the paint changes, so the focus ring, the keyboard and the
 * accessible role all stay. `inline-flex` with no height or padding so it sits on the text
 * baseline of the row it belongs to.
 */
const INLINE_BASE = 'inline-flex items-center rounded-sm text-sm font-semibold';
const BUTTON_VARIANT = {
  /*
   * Navy with white text, as `.btn-add` has it (`KPM_Owner.html:225`).
   *
   * **This was `bg-amber text-navy`, and `tokens.md` justified that by saying the prototypes
   * do it.** They do not: every amber button in every prototype file sets `color:#fff`. The
   * screens this product actually implements — the Owner's settings — have no `.btn-primary`
   * rule at all; their page-level primary is `.btn-add`, and it is navy.
   *
   * `Overall.html:2244` does define an amber `.btn-primary`, and diverging from it is
   * deliberate: white on amber is 2.2:1 and fails AA, and two primary colours on one product
   * is a rule nobody can apply. White on navy is 13:1. Registered in `prototype-parity.md`.
   */
  primary: 'bg-navy text-white hover:bg-navy-soft',
  secondary: 'border border-hairline bg-card text-navy',
  // The prototype's `.btn-danger` (`Overall.html:2244-2245`): transparent, with an
  // alert-red border and alert-red text. Deliberately quieter than the primary — a
  // destructive action should not be the most inviting thing on the card.
  danger: 'border-[1.5px] border-alert bg-transparent text-alert hover:bg-alert/5',
  /** Edit, Restore, Use the company's — the row's own actions. */
  inline: 'text-muted underline-offset-2 hover:text-navy hover:underline',
  /**
   * Archive, Remove — **grey at rest**, red only on hover, exactly as `.cfg-actions a.danger`
   * has it. A row of permanently red links reads as a list of warnings.
   */
  inlineDanger: 'text-muted underline-offset-2 hover:text-alert hover:underline',
} as const;

/** The two that are text rather than a box, so `Button` picks the right base. */
const INLINE_VARIANTS = new Set(['inline', 'inlineDanger']);

/**
 * `type="button"` by default, which is **not** what a bare `<button>` does.
 *
 * HTML defaults a button inside a form to `submit`, so every Cancel on this project's
 * inline panels was submitting the form it was cancelling. The worst of them was the
 * Cancel on the member-removal form: somebody who typed the confirmation word, thought
 * better of it and pressed **Cancel** removed the person. The add-a-ratio Cancel created
 * the ratio, and login's *resend verification* fired a second sign-in attempt.
 *
 * A component library's default should be the harmless one. Every button here that
 * genuinely submits already says `type="submit"` — all nineteen of them — so nothing
 * loses behaviour, and a caller can still override it.
 */
export function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANT;
}) {
  return (
    <button
      type={type}
      {...props}
      className={cn(
        INLINE_VARIANTS.has(variant) ? INLINE_BASE : BUTTON_BASE,
        'disabled:cursor-not-allowed disabled:opacity-40',
        BUTTON_VARIANT[variant],
        className,
      )}
    />
  );
}

/**
 * A link that looks like a button.
 *
 * Not `<Link><Button/></Link>`: interactive content inside an anchor is invalid, the
 * accessible name and activation behaviour both become ambiguous, and a screen reader
 * announces a control that is really navigation. If it navigates, it is a link.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  className,
  onClick,
  children,
}: {
  href: string;
  /** The same set `Button` offers — a link inside a row is a row action like any other. */
  variant?: keyof typeof BUTTON_VARIANT;
  className?: string;
  /**
   * For a link that may have to ask first — the training list holds unsaved edits that leaving
   * would discard, so opening a module checks before it goes. It is still a link: without a
   * reason to stop, it navigates, and it opens in a new tab like any other.
   */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        INLINE_VARIANTS.has(variant) ? INLINE_BASE : BUTTON_BASE,
        BUTTON_VARIANT[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('rounded-lg border border-hairline bg-card p-6', className)}>
      {children}
    </div>
  );
}

/** The standard way to render an ApiRequestError. Always shows the request id. */
export function ErrorBanner({ code, message, requestId }: { code: string; message: string; requestId?: string }) {
  return (
    <div role="alert" className="rounded-md border border-alert/30 bg-alert/5 p-3">
      <p className="text-md font-semibold text-alert">{message}</p>
      <p className="mt-1 text-2xs text-muted">
        {code}
        {requestId && requestId !== 'unknown' ? ` · ${requestId}` : ''}
      </p>
    </div>
  );
}
