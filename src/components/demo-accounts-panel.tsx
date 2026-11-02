'use client';

import { useState } from 'react';
import { DEMO_ACCOUNTS, DEMO_GROUPS, showDemoAccounts, type DemoAccount } from '@/lib/demo-accounts';
import { useMessages } from '@/i18n/language-provider';
import { authMessages } from '@/i18n/messages/auth';

/**
 * The seeded accounts, on the sign-in screen, in development and staging only.
 *
 * Rendered as buttons rather than text to copy: the point is to remove the step, not to
 * shorten it. Choosing one fills both fields and signs in, so the values stay visible in
 * the form and a failure is diagnosable rather than magic.
 *
 * Grouped by office, and collapsed by default — there are fifteen of them, and an
 * unrolled list of fifteen pushes the actual sign-in form off a laptop screen.
 *
 * **Its own words are the catalogue's** (`messages/auth.tsx`, `demo`; P18.98-T4); **the accounts are not** — each one's
 * role, where it lands and its group stay in `lib/demo-accounts.ts`, folded out of every other build with the credentials
 * (ADR-0041): an area ships everywhere, so nothing of the seed goes into one. They read as the seed writes them.
 */
export function DemoAccountsPanel({
  onChoose,
  disabled,
}: {
  onChoose: (account: DemoAccount) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useMessages(authMessages).demo;

  if (!showDemoAccounts()) return null;

  return (
    <section
      aria-labelledby="demo-accounts-heading"
      className="mt-4 rounded-lg border border-dashed border-hairline bg-card p-4"
    >
      <h2 id="demo-accounts-heading" className="text-md font-semibold text-navy">
        {t.heading}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t.line({ code: (words) => <code className="text-xs">{words}</code> })}
      </p>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="demo-accounts-list"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="mt-3 text-md font-semibold text-navy underline"
      >
        {open ? t.hide : t.showAll({ n: DEMO_ACCOUNTS.length })}
      </button>

      {open && (
        <div id="demo-accounts-list" className="mt-3 flex flex-col gap-4">
          {DEMO_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                {group.label}
              </h3>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {group.accounts.map((account) => (
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
