'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Page } from '@/components/page';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
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
      title="Approve a support session to write"
      subtitle="A second Super Admin — never the one running it."
      permission="impersonation:elevate_to_write"
    >
      <Card className="max-w-xl">
        <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-md text-muted">
          <li>
            A support session can look at everything and change nothing until somebody
            approves this.
          </li>
          <li>
            <strong>You cannot approve your own session.</strong> If you started it, find a
            colleague.
          </li>
          <li>The office&apos;s Owner reads your name and your reason.</li>
        </ul>

        {done ? (
          <>
            <p role="status" className="text-md text-navy">
              Approved. That session can now make changes for the rest of its hour.
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => router.push('/admin')}>
              Back to the console
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && <ErrorBanner {...error} />}

            <Field
              label="Why is looking not enough?"
              htmlFor="reason"
              hint="The Owner of that office reads this. Name the thing that cannot be fixed from a screen."
              error={tooShort ? `At least ${MIN_REASON} characters.` : undefined}
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
              {busy ? 'Approving…' : 'Approve this session to write'}
            </Button>
          </form>
        )}
      </Card>
    </Page>
  );
}
