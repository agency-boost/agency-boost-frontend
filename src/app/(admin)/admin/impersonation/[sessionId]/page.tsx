'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Page } from '@/components/page';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useMessages } from '@/i18n/language-provider';
import { supportSessionMessages } from '@/i18n/messages/support-session';
import { elevateImpersonation } from '@/lib/admin';

const MIN_REASON = 10;

/**
 * Approving a support session to write (P4-T10, §3.13).
 *
 * **A different Super Admin from the one running it**, and the API refuses the session's
 * own starter. That is the control rather than a formality: an admin session can rewrite
 * the configuration every member of an office depends on, and the person best placed to
 * notice that is a bad idea is somebody other than the one having it.
 *
 * The reason is typed again rather than carried over. The approver is answering a
 * different question — not *why look at this office* but *why is looking not enough* —
 * and the office's Owner reads both.
 */
export default function ElevateSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const t = useMessages(supportSessionMessages).elevate;
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = reason.trim().length > 0 && reason.trim().length < MIN_REASON;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await elevateImpersonation(sessionId, reason.trim());
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
      permission="impersonation:elevate_to_write"
    >
      <Card className="max-w-xl">
        <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-md text-muted">
          <li>{t.looksOnly}</li>
          <li>{t.notYourOwn({ strong: (words) => <strong>{words}</strong> })}</li>
          <li>{t.ownerReads}</li>
        </ul>

        {done ? (
          <>
            <p role="status" className="text-md text-navy">
              {t.done}
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => router.push('/admin')}>
              {t.back}
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && <ErrorBanner {...error} />}

            <Field
              label={t.why}
              htmlFor="reason"
              hint={t.whyHint}
              error={tooShort ? t.atLeast({ min: MIN_REASON }) : undefined}
            >
              <TextInput
                id="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                invalid={tooShort}
              />
            </Field>

            <Button type="submit" disabled={busy || tooShort || reason.trim().length === 0}>
              {busy ? t.approving : t.submit}
            </Button>
          </form>
        )}
      </Card>
    </Page>
  );
}
