'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { listSessions, logoutEverywhere, revokeSession, type Session } from '@/lib/sessions';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * A device name a person would recognise, out of a user agent string.
 *
 * Deliberately coarse. The goal is *"is that my phone?"*, not an inventory — and a full
 * UA string on screen is the kind of thing that makes somebody close the page rather than
 * act on it. Unknown stays unknown: a wrong guess is worse than none when the question is
 * whether to sign a device out.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const platform = /Android/i.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent) ? 'iPhone or iPad'
      : /Macintosh/i.test(userAgent) ? 'Mac'
        : /Windows/i.test(userAgent) ? 'Windows'
          : /Linux/i.test(userAgent) ? 'Linux'
            : null;
  const browser = /Edg\//i.test(userAgent) ? 'Edge'
    : /Chrome\//i.test(userAgent) ? 'Chrome'
      : /Firefox\//i.test(userAgent) ? 'Firefox'
        : /Safari\//i.test(userAgent) ? 'Safari'
          : null;
  if (!platform && !browser) return 'Unknown device';
  return [browser, platform].filter(Boolean).join(' on ');
}

function when(iso: string | null): string {
  if (!iso) return 'unknown';
  return formatDateTime(iso) || 'unknown';
}

/**
 * Where you are signed in, and how to stop being (P4-T13).
 *
 * **The current session is marked and cannot be revoked from here.** Signing yourself out
 * of the seat you are sitting in works, but it reads as a bug — the page reloads into a
 * login screen and nothing said it would. *Sign out* in the header already does that, and
 * says so.
 */
export function SessionList() {
  const { signOut } = useSignOut();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">Where you are signed in</h2>
      <p className="mt-1 text-md text-muted">
        One row per device. If you do not recognise one, sign it out.
      </p>

      {error && <ErrorBanner {...error} />}

      {sessions === null ? (
        <SkeletonText lines={3} className="mt-3" />
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-hairline">
          {sessions.map((session) => (
            <li key={session.sessionId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-md text-navy">
                  {describeDevice(session.userAgent)}
                  {session.current && (
                    <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-sm font-semibold text-navy">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {session.ip ?? 'Unknown address'} · last used {when(session.lastUsedAt)}
                </p>
              </div>
              {!session.current && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await revokeSession(session.sessionId);
                      await load();
                    } catch (err) {
                      setError(toDisplayError(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Sign this one out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-hairline pt-4">
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await logoutEverywhere();
              // Every session is gone, this one included — so there is nothing to reload
              // into but the sign-in page. This tab's own session is then ended the way
              // every *Sign out* ends it (`useSignOut`): marked as the reader's own doing,
              // so neither the redirect nor the account screen's guard hands this page to
              // whoever signs in next (2026-10-11). It used to leave the session in memory
              // and go to `/login?signedOut=1`, a parameter the sign-in page never read.
              await signOut();
            } catch (err) {
              setError(toDisplayError(err));
              setBusy(false);
            }
          }}
        >
          Sign out everywhere
        </Button>
        <p className="mt-2 text-sm text-muted">
          Ends every session including this one. What to do if a device was lost.
        </p>
      </div>
    </Card>
  );
}
