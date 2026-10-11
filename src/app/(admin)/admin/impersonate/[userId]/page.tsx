'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { startImpersonation } from '@/lib/admin';
import { setAccessToken, setImpersonating, toDisplayError } from '@/lib/api-client';
import { useSession } from '@/lib/session';

const MAX_MINUTES = 60;

/**
 * Starting a support session as someone else.
 *
 * Deliberately a screen and not a button in a list: a reason is mandatory, it is
 * recorded permanently, and the consequences are worth reading once before agreeing to
 * them.
 */
export default function ImpersonatePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const { reload } = useSession();
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(String(MAX_MINUTES));
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const duration = Number(minutes);
  const badDuration = !Number.isInteger(duration) || duration < 1 || duration > MAX_MINUTES;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await startImpersonation(userId, reason.trim(), duration);
      setAccessToken(accessToken);
      setImpersonating(true);
      await reload();
      // To the member's own landing, where their session starts (2026-10-11). The session is
      // theirs now, so this console's shell sends it there too (`RequireSession`'s `family`);
      // `/` forwards by the same `landingFor`, so whichever navigation lands last, both arrive
      // in the same place. It went to `/profile?session=<id>`, which the guard would race, and
      // whose `session` nothing ever read: the approval is reached at `/admin/impersonation/<id>`.
      router.push('/');
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <Page title="Act as another user" subtitle="Support access, permanently recorded.">
      <Card className="max-w-xl">
        <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-md text-muted">
          <li>
            Every action you take is recorded against <strong>both</strong> you and{' '}
            <code className="text-sm">{userId}</code>.
          </li>
          <li>The session is time-boxed and cannot exceed {MAX_MINUTES} minutes.</li>
          <li>
            It ends the moment you reload the page — impersonation is never restored from
            a cookie.
          </li>
          <li>Another Super Admin cannot be impersonated.</li>
          <li>
            <strong>You will be able to look and not change anything.</strong> A second
            Super Admin has to approve writing, and the office&apos;s Owner is told either
            way.
          </li>
          <li>
            The person you act as <strong>and</strong> their Owner are notified the moment
            it starts.
          </li>
        </ul>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          <Field label="Reason" htmlFor="reason" hint="Recorded in the audit log. Write what a colleague would need to understand this later.">
            <TextInput
              id="reason"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>

          <Field
            label="Duration (minutes)"
            htmlFor="minutes"
            error={badDuration ? `Between 1 and ${MAX_MINUTES}.` : undefined}
          >
            <TextInput
              id="minutes"
              type="number"
              min={1}
              max={MAX_MINUTES}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              invalid={badDuration}
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || badDuration || reason.trim().length < 3}>
              {busy ? 'Starting…' : 'Start session'}
            </Button>
            <ButtonLink href="/admin/tenants" variant="secondary">
                Cancel
              </ButtonLink>
          </div>
        </form>
      </Card>
    </Page>
  );
}
