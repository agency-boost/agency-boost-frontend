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
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-navy">
        {label}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
      {/* Announced to assistive technology, not just coloured red. */}
      {error && (
        <p role="alert" className="text-xs font-semibold text-alert">
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

const BUTTON_BASE =
  'inline-flex h-10 items-center justify-center rounded-md px-4 text-md font-semibold';
const BUTTON_VARIANT = {
  primary: 'bg-amber text-navy hover:bg-amber-dark',
  secondary: 'border border-hairline bg-card text-navy',
  // The prototype's `.btn-danger` (`Overall.html:2244-2245`): transparent, with an
  // alert-red border and alert-red text. Deliberately quieter than the primary — a
  // destructive action should not be the most inviting thing on the card.
  danger: 'border-[1.5px] border-alert bg-transparent text-alert hover:bg-alert/5',
} as const;

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <button
      {...props}
      className={cn(
        BUTTON_BASE,
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
  children,
}: {
  href: string;
  variant?: 'primary' | 'secondary';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-hairline bg-card p-6', className)}>{children}</div>
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
