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

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md px-4 text-md font-semibold',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary'
          ? 'bg-amber text-navy hover:bg-amber-dark'
          : 'border border-hairline bg-card text-navy',
        className,
      )}
    />
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
