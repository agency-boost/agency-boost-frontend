import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** One place, so `FieldRow.Actions`'s spacer is the same height as a label by construction. */
const LABEL_CLASS = 'text-sm font-semibold text-navy';

/**
 * Fields laid out across a row, lining up whether or not they carry a hint.
 *
 * **The row is `items-start`, and that is the whole fix.** It was `items-end`, which lined the
 * inputs up only by accident: the hint used to sit *between* label and input, so every field was
 * the same height. Moving the hint below the control — which is where it belongs — took the
 * accident away, and a hinted field started riding up while its neighbour sat low.
 *
 * Top-aligning makes it structural instead: every field starts with a label, so labels line up and
 * inputs line up, and a hint hangs below its own field pushing nothing.
 */
export function FieldRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-wrap items-start gap-3', className)}>{children}</div>;
}

/**
 * The buttons that belong to a {@link FieldRow} — Add and Cancel, Save and Cancel.
 *
 * **A button has no label, so top-aligning would put it level with the labels rather than with
 * the inputs.** The spacer is an empty element carrying the label's own classes, so it is exactly
 * a label tall — by construction, not by a measured offset that a change to the type scale would
 * silently break.
 */
FieldRow.Actions = function FieldRowActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span aria-hidden="true" className={LABEL_CLASS}>&nbsp;</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
};

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  /**
   * Usually a string. `ReactNode` because a label may carry a badge — *Months left this year* with
   * an `auto` chip beside it (`Overall.html:2913`) — and a badge inside the `<label>` is how the
   * prototype does it and how it stays on the same line as the words it qualifies.
   */
  label: React.ReactNode;
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
      <label htmlFor={htmlFor} className={LABEL_CLASS}>
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
 * The stable code of the row being edited — shown, and not changeable.
 *
 * **`readOnly`, not `disabled`, and the difference is the whole point.** A disabled input leaves
 * the tab order and most screen readers skip it, so the reader who most needs to be told *"this is
 * the identity and you cannot change it"* would be told nothing at all. `readOnly` looks the same
 * greyed, announces as read-only, and — the part that matters in practice — can be **selected and
 * copied**, which is one of the two reasons to put a code on a screen.
 *
 * This replaces `ReadOnlyField` for codes. `ReadOnlyField` stays for the platform facts it was
 * built for — a tenant's time zone, its currency, its owner — which are not form fields at all.
 */
export function CodeField({
  id,
  value,
  reason,
  className,
}: {
  id: string;
  value: string;
  /** Why it cannot change. Not optional: a greyed field with no explanation reads as broken. */
  reason: string;
  className?: string;
}) {
  return (
    <Field label="Code" htmlFor={id} hint={reason} className={className}>
      <TextInput id={id} value={value} readOnly className="bg-base text-muted" />
    </Field>
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

/**
 * How much room a control takes, and whether it looks like a control at rest.
 *
 * `default` is a form field: a 40px box you can see. **`cell` is a table cell you can type into** —
 * transparent until you touch it, revealing a hairline on hover and an amber ring on focus
 * (`Overall.html:453-467`). `components-and-patterns.md` has specified that treatment for the data
 * table since Phase 1; there was no way to express it, so the leads screen shipped 40px boxes in every
 * cell of every row and the table read as a form rather than as a list.
 *
 * The border is present at both densities and only *coloured* differently, so nothing reflows when a
 * cell is hovered — a transparent border that becomes visible costs no layout, one that appears does.
 */
const DENSITY = {
  default: 'h-10 rounded-md border bg-card px-3 text-base',
  cell:
    'w-full rounded-sm border bg-transparent px-1.5 py-[3px] text-base leading-tight '
    + 'hover:border-hairline focus:border-amber focus:bg-card focus:ring-1 focus:ring-amber',
} as const;

/** `cell` starts transparent; `default` shows its hairline at rest. */
const DENSITY_REST = { default: 'border-hairline', cell: 'border-transparent' } as const;

export type Density = keyof typeof DENSITY;

function controlClass(density: Density, invalid?: boolean) {
  return cn(DENSITY[density], 'text-navy', invalid ? 'border-alert' : DENSITY_REST[density]);
}

/**
 * A number field grows no spinner, and a wheel over it scrolls the page instead of the value.
 *
 * The arrows are a 12px target nobody aims for on purpose, and they cost far more than they give: a
 * focused `type="number"` treats a scroll as an **increment**, so somebody reading down a form with the
 * case-size field still focused changes it without touching it — and the field they changed is off
 * screen by the time it happens.
 *
 * Blurring on wheel rather than preventing it: React attaches `wheel` passively at the root, so
 * `preventDefault()` there does nothing. Losing focus is also the honest outcome — the reader has
 * moved on from the field.
 */
const NUMBER_INPUT = '[appearance:textfield] '
  + '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

export function TextInput({
  className,
  invalid,
  density = 'default',
  prefix,
  suffix,
  onWheel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  density?: Density;
  /** `Rp` before the number. */
  prefix?: React.ReactNode;
  /** `%`, `months` after it. */
  suffix?: React.ReactNode;
} ) {
  const numeric = props.type === 'number';
  const input = (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      onWheel={numeric
        ? (e) => { e.currentTarget.blur(); onWheel?.(e); }
        : onWheel}
      className={cn(
        controlClass(density, invalid),
        numeric && NUMBER_INPUT,
        (prefix || suffix) && AFFIXED_INPUT,
        /*
         * **Pad the side that has no affix.** The affix supplies the gap on its own side, and a
         * field with only a suffix — `30 %`, `3.2 months` — had the number hard against the left
         * border with nothing between them. The prototype's input carries no padding because both
         * its fields happen to have an affix on the side the text starts from; ours do not.
         */
        (prefix || suffix) && !prefix && 'pl-3',
        (prefix || suffix) && !suffix && 'pr-3',
        (prefix || suffix) ? undefined : className,
      )}
    />
  );

  /**
   * **The wrapper exists only when there is an affix**, and that is load-bearing rather than tidy:
   * `ui.spec.tsx` reaches a `FieldRow` by walking up from the labelled control, and an
   * unconditional wrapper lands that walk one level short — failing in a test about row alignment,
   * nowhere near the change that caused it.
   */
  if (!prefix && !suffix) return input;

  return (
    <span
      className={cn(
        'inline-flex h-10 items-center overflow-hidden rounded-md border-[1.5px] bg-card',
        invalid ? 'border-alert' : 'border-hairline',
        // The same weight the global rule gives a bare input — 2px amber, offset by one — so nothing
        // is lost by moving the indicator out here.
        'focus-within:border-amber focus-within:ring-2 focus-within:ring-amber focus-within:ring-offset-1',
        className,
      )}
    >
      {prefix ? <span aria-hidden="true" className={AFFIX}>{prefix}</span> : null}
      {input}
      {suffix ? <span aria-hidden="true" className={AFFIX}>{suffix}</span> : null}
    </span>
  );
}

/**
 * `Rp` and `%` inside the box, as the prototype's `.input-affix` has them
 * (`Overall.html:669-682`).
 *
 * **Not appended to the label.** *"Annual APE target (Rp)"* makes the unit part of the question's
 * name, which is what a screen reader then reads back, and it leaves the field itself saying nothing
 * about what it wants. Inside the box the unit is where the number goes.
 *
 * `aria-hidden`, because the label already names the field and the unit is either implied by it or
 * carried by the hint. A screen reader announcing "Rp" as a second unnamed thing beside the input is
 * noise.
 */
const AFFIX = 'shrink-0 select-none px-3 text-base font-semibold text-muted';
/**
 * Inside the group the input owns no border, no ground and **no focus ring of its own**.
 *
 * `globals.css` puts a 2px amber outline on every `:focus-visible`, and the group draws the same ring
 * on `focus-within` — so focusing an affixed field drew two, one around the number and one around the
 * number *and* its unit. It read as two fields stacked on each other, which is what it was.
 *
 * Suppressing the inner outline is not the defect that rule guards against: the replacement is larger
 * and more visible than what it replaces, and it surrounds the whole control rather than half of it.
 */
const AFFIXED_INPUT = 'h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-base text-navy '
  + 'focus:outline-none focus-visible:outline-none focus:ring-0';

export function Select({
  className,
  invalid,
  density = 'default',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; density?: Density }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(controlClass(density, invalid), className)}
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

/**
 * A switch, in the prototype's own shape (`KPM_Owner.html:435-441`).
 *
 * **One control, not a badge and a button.** The module list showed a *Published* badge beside an
 * *Unpublish* button, which is two things answering one question — and whichever a reader trusted,
 * the other one contradicted it. A switch's state **is** the answer.
 *
 * A real `<input type="checkbox" role="switch">` rather than a styled `<button>`: the checkbox
 * carries checked-ness to assistive technology on its own, and `role="switch"` is what makes it
 * announce as *on* / *off* rather than *checked*. The visible track is a sibling the input drives
 * through `peer-checked`, so the control a pointer hits and the control a screen reader reads are
 * the same element.
 *
 * **The label never changes with the state.** *Published* stays *Published* whether it is on or
 * off; a name that flipped to *Draft* would announce as a different control appearing.
 */
export function Switch({
  id,
  label,
  checked,
  disabled,
  onChange,
  describedBy,
  className,
}: {
  id: string;
  /** Stays the same in both states — it names the control, not the state. */
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  describedBy?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 rounded-pill bg-hairline transition-colors',
            'peer-checked:bg-success peer-disabled:opacity-40',
            // The amber ring the project keeps, moved onto the visible track because the input
            // itself is transparent.
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-amber',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-[3px] h-4 w-4 rounded-full bg-card shadow-sm transition-transform',
            'peer-checked:translate-x-4 peer-disabled:opacity-40',
          )}
        />
      </span>
      <label htmlFor={id} className={cn(LABEL_CLASS, disabled && 'opacity-40')}>{label}</label>
    </span>
  );
}

export function Textarea({
  className,
  invalid,
  density = 'default',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  density?: Density;
  /** React 19 passes a ref as an ordinary prop; `AutoGrowTextarea` measures the element. */
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        density === 'default'
          ? cn('min-h-20 rounded-md border bg-card px-3 py-2 text-base text-navy',
              invalid ? 'border-alert' : 'border-hairline')
          : cn(controlClass(density, invalid), 'resize-none overflow-hidden leading-snug'),
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
  /**
   * A glyph in a table row: `✓ ✕ 🗑` (`Overall.html:489-498`).
   *
   * Grey at rest like the inline variants and for the same reason, with the **hover** carrying the
   * meaning — green where it succeeds, red where it does not. Pass `tone` to say which; the glyph and
   * its `aria-label` are the caller's.
   *
   * Used where a row has three or more actions and their words would be wider than the data. Two
   * actions stay text (`inline`): an icon is only a saving once there are enough of them to crowd.
   */
  icon: 'text-muted',
} as const;

/** Hover tint and colour for `variant="icon"`, which is grey until you reach for it. */
const ICON_TONE = {
  success: 'hover:bg-success/[0.12] hover:text-success',
  alert: 'hover:bg-alert/10 hover:text-alert',
  neutral: 'hover:bg-navy/[0.08] hover:text-navy',
} as const;

/** The three that are not a 40px box, so `Button` picks the right base. */
const INLINE_VARIANTS = new Set(['inline', 'inlineDanger']);
/** 19×19 in the prototype; 28px here, because 19px is not a tap target on a phone. */
const ICON_BASE =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-sm leading-none';

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
  tone = 'neutral',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANT;
  /** `variant="icon"` only: which way the hover reads. */
  tone?: keyof typeof ICON_TONE;
  /** React 19 passes a ref as an ordinary prop; `Dialog` moves focus onto its buttons. */
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const base =
    variant === 'icon' ? ICON_BASE : INLINE_VARIANTS.has(variant) ? INLINE_BASE : BUTTON_BASE;
  return (
    <button
      type={type}
      {...props}
      className={cn(
        base,
        'disabled:cursor-not-allowed',
        // 40% everywhere, except the icon button, where the prototype uses 30% (`:497`) — a row of
        // three glyphs needs the unavailable one to recede further than a lone button does.
        variant === 'icon' ? 'disabled:opacity-30' : 'disabled:opacity-40',
        BUTTON_VARIANT[variant],
        variant === 'icon' && ICON_TONE[tone],
        variant === 'icon' && 'disabled:hover:bg-transparent disabled:hover:text-muted',
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

/**
 * `compact` is the prototype's own card: `padding:16px 20px` (`Overall.html:635`), snapped to the
 * spacing scale. `default` is the roomier `--space-6` this product uses for a form.
 *
 * **A prop rather than `className="px-5 py-4"`**, because `twMerge` does not drop `p-6` when a caller
 * adds `px`/`py` — the two do not fully overlap — so the card would carry three padding utilities and
 * which one won would depend on the order Tailwind happens to emit them in.
 */
const CARD_PADDING = { default: 'p-6', compact: 'px-5 py-4' } as const;

export function Card({
  children,
  className,
  density = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { density?: keyof typeof CARD_PADDING }) {
  return (
    <div
      {...props}
      className={cn('rounded-lg border border-hairline bg-card', CARD_PADDING[density], className)}
    >
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
