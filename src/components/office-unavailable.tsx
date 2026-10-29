'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui/field';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { pageFrameMessages } from '@/i18n/messages/page-frame';
import type { ApiError } from '@/lib/api-client';
import { formatCalendarDay } from '@/lib/format';

/**
 * **The page for an office its member cannot use** (ADR-0112 §4, P13.2-T3 AC-9; parity *Fill*, L-01).
 *
 * Rendered by `SessionProvider` **in place of the whole app**, at whatever address was opened — it is
 * not a route — when a request is answered `403` with `TENANT_SUBSCRIPTION_ENDED`, `TENANT_SUSPENDED` or
 * `TENANT_ARCHIVED`. It names the office, from the refusal's own details, and says what happened: for
 * an ended subscription the day it ended and that the reader should contact AgencyBoost; for a
 * suspended or archived office the server's sentence, which is worded to be true for the Owner too.
 *
 * **Sign out, and nothing else.** No navigation: every link would meet the same refusal. The heading
 * takes the focus, so a screen reader starts at what happened rather than at the top of a page it never
 * asked for. No prototype draws this state; it is built in the sign-in screen's idiom — the wordmark, one
 * card, the primary button.
 *
 * **Inside a support session it offers *End support session* instead** (P13.2 exit review): the reader
 * is a Super Admin acting as a member of the office, and signing out would revoke the Super Admin's own
 * sign-in while leaving the session live, with no record that it ended. The one button ends the session
 * and gives them their console back; the heading names *this* office, which is not theirs.
 */
export function OfficeUnavailable({
  error,
  onSignOut,
  onEndSupportSession,
}: {
  error: ApiError;
  onSignOut: () => Promise<void> | void;
  /** Set only inside a support session: the button ends the session instead of signing out. */
  onEndSupportSession?: () => Promise<void> | void;
}) {
  const t = useMessages(pageFrameMessages).office;
  const figures = useFigureLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    heading.current?.focus();
  }, [error.code]);

  const details = (error.details ?? {}) as { endDate?: string | null; kpmCode?: string; branch?: string };
  const office = details.kpmCode
    ? `${kept('KPM')} ${details.kpmCode}${details.branch ? ` · ${details.branch}` : ''}`
    : null;
  const ended = error.code === 'TENANT_SUBSCRIPTION_ENDED';
  const support = Boolean(onEndSupportSession);
  const title = t.title({
    kind: ended ? 'ended' : error.code === 'TENANT_SUSPENDED' ? 'suspended' : 'archived',
    support,
  });

  async function leave() {
    setLeaving(true);
    try {
      await (onEndSupportSession ?? onSignOut)();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <p className="font-display text-3xl font-bold text-navy">{kept('AgencyBoost')}</p>
      <Card className="mt-6">
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-display text-xl font-bold text-navy outline-none"
          data-code={error.code}
        >
          {title}
        </h1>
        {office && <p className="mt-1 text-md font-semibold text-navy">{office}</p>}
        {ended ? (
          <p className="mt-3 text-md text-navy">
            {details.endDate ? t.endedOn({ date: formatCalendarDay(details.endDate, figures) }) : t.ended}
          </p>
        ) : (
          <p className="mt-3 text-md text-navy">{error.message}</p>
        )}
        <p className="mt-3 text-sm text-muted">
          {t.nothingDeleted}
        </p>
        <Button className="mt-5 w-full" onClick={() => void leave()} disabled={leaving}>
          {support
            ? (leaving ? t.ending : t.endSupport)
            : (leaving ? t.signingOut : t.signOut)}
        </Button>
      </Card>
    </main>
  );
}
