'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useEffect, useId, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { supportSessionMessages } from '@/i18n/messages/support-session';
import { readTenant, startImpersonation, type ImpersonationPurpose } from '@/lib/admin';
import { setAccessToken, setImpersonating, toDisplayError } from '@/lib/api-client';
import { useSession } from '@/lib/session';

const MAX_MINUTES = 60;

/**
 * The two reasons to start a session (ADR-0162), in the order the office's *Open as Owner* puts them: the
 * one it opens with first. Each hint is the whole of what that kind may do (the catalogue's words).
 */
const PURPOSES: readonly ImpersonationPurpose[] = ['setup', 'support'];

/** Who the session acts as, when the office it was opened from names them (`?kpmId=`). */
interface Person {
  name: string;
  office: { code: string; branch: string };
}

/**
 * Starting a support session as someone else.
 *
 * Deliberately a screen and not a button in a list: a reason is mandatory, it is
 * recorded permanently, and the consequences are worth reading once before agreeing to
 * them.
 */
export default function ImpersonatePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  return (
    // `useSearchParams` needs a boundary: *Open as Owner* says what the session is for in the address.
    <Suspense fallback={null}>
      <StartSession userId={userId} />
    </Suspense>
  );
}

function StartSession({ userId }: { userId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const t = useMessages(supportSessionMessages).start;
  const { reload } = useSession();
  const fromOffice = search.get('kpmId');
  const [purpose, setPurpose] = useState<ImpersonationPurpose>(
    search.get('purpose') === 'setup' ? 'setup' : 'support',
  );
  const [person, setPerson] = useState<Person | null>(null);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(String(MAX_MINUTES));
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  /*
   * **The person, by name** (ADR-0162 §1), read from the office the button was on — its Owner, when that is
   * who this is. An address naming somebody else, or an office that cannot be read, keeps the id: the
   * screen never guesses who it is about.
   */
  useEffect(() => {
    if (!fromOffice) return;
    let live = true;
    readTenant(encodeURIComponent(fromOffice))
      .then((kpm) => {
        if (live && kpm.ownerUserId === userId && kpm.ownerName) {
          setPerson({ name: kpm.ownerName, office: { code: kpm.code, branch: kpm.branchName } });
        }
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [fromOffice, userId]);

  const duration = Number(minutes);
  const badDuration = !Number.isInteger(duration) || duration < 1 || duration > MAX_MINUTES;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await startImpersonation(userId, reason.trim(), duration, purpose);
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
    <Page title={t.title} subtitle={t.subtitle}>
      <Card className="max-w-xl">
        <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-md text-muted">
          <li>
            {t.recorded({
              strong: (words) => <strong>{words}</strong>,
              who: person
                ? t.ownerOf({ name: <strong className="text-navy">{person.name}</strong>, office: t.office(person.office) })
                : <code className="text-sm">{userId}</code>,
            })}
          </li>
          <li>{t.timeBoxed({ max: MAX_MINUTES })}</li>
          <li>{t.endsOnReload}</li>
          <li>{t.noSuperAdmin}</li>
          <li>{t.notified({ strong: (words) => <strong>{words}</strong> })}</li>
        </ul>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-navy">{t.purpose}</legend>
            {PURPOSES.map((value) => (
              <label key={value} className="flex items-start gap-2 text-md text-navy">
                <input
                  type="radio"
                  name={`${id}-purpose`}
                  value={value}
                  checked={purpose === value}
                  onChange={() => setPurpose(value)}
                  className="mt-1 accent-navy"
                  aria-describedby={`${id}-${value}-hint`}
                />
                <span>
                  {value === 'setup' ? t.setup : t.support}
                  <span id={`${id}-${value}-hint`} className="block text-sm text-muted">
                    {value === 'setup' ? t.setupHint : t.supportHint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <Field label={t.reason} htmlFor="reason" hint={t.reasonHint}>
            <TextInput
              id="reason"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>

          <Field
            label={t.duration}
            htmlFor="minutes"
            error={badDuration ? t.between({ max: MAX_MINUTES }) : undefined}
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
              {busy ? t.starting : t.submit}
            </Button>
            <ButtonLink
              href={fromOffice ? `/admin/tenants/${encodeURIComponent(fromOffice)}` : '/admin/tenants'}
              variant="secondary"
            >
              {t.cancel}
            </ButtonLink>
          </div>
        </form>
      </Card>
    </Page>
  );
}
