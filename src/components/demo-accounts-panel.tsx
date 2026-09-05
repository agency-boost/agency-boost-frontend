'use client';

import { DEMO_ACCOUNTS, showDemoAccounts, type DemoAccount } from '@/lib/demo-accounts';

/**
 * The seeded accounts, on the sign-in screen, in development only.
 *
 * Rendered as a list of buttons rather than text to copy: the point is to remove the
 * step, not to shorten it. Choosing one fills both fields and signs in, so the values
 * stay visible in the form and a failure is diagnosable rather than magic.
 */
export function DemoAccountsPanel({
  onChoose,
  disabled,
}: {
  onChoose: (account: DemoAccount) => void;
  disabled?: boolean;
}) {
  if (!showDemoAccounts()) return null;

  return (
    <section
      aria-labelledby="demo-accounts-heading"
      className="mt-4 rounded-lg border border-dashed border-hairline bg-card p-4"
    >
      <h2 id="demo-accounts-heading" className="text-md font-semibold text-navy">
        Development accounts
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        Seeded by <code className="text-xs">pnpm seed:demo</code>. Choosing one fills the form
        and signs in. This panel appears in development only.
      </p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(account)}
              className="w-full rounded-md border border-hairline px-3 py-2 text-left hover:bg-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-md font-semibold text-navy">{account.role}</span>
                <span className="text-xs text-muted">{account.lands}</span>
              </span>
              <span className="mt-0.5 block font-mono text-xs text-muted">
                {account.email} · {account.password}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
