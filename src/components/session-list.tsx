'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { listSessions, logoutEverywhere, revokeSession, type Session } from '@/lib/sessions';
import { useSignOut } from '@/lib/use-sign-out';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { accountMessages } from '@/i18n/messages/account';

/**
 * A device name a person would recognise, out of a user agent string.
 *
 * Deliberately coarse. The goal is *"is that my phone?"*, not an inventory — and a full
 * UA string on screen is the kind of thing that makes somebody close the page rather than
 * act on it. Unknown stays unknown: a wrong guess is worse than none when the question is
 * whether to sign a device out.
 *
 * In the reader's words' language, its last parameter (English when none is passed); a browser's and a system's names
 * are their own in both.
 */
export function describeDevice(userAgent: string | null, language: Language = SOURCE_LANGUAGE): string {
  const t = messagesIn(accountMessages, language).sessions;
  if (!userAgent) return t.unknownDevice;
  const platform = /Android/i.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent) ? t.iPhoneOrIPad
      : /Macintosh/i.test(userAgent) ? 'Mac'
        : /Windows/i.test(userAgent) ? 'Windows'
          : /Linux/i.test(userAgent) ? 'Linux'
            : null;
  const browser = /Edg\//i.test(userAgent) ? 'Edge'
    : /Chrome\//i.test(userAgent) ? 'Chrome'
      : /Firefox\//i.test(userAgent) ? 'Firefox'
        : /Safari\//i.test(userAgent) ? 'Safari'
          : null;
  if (!platform && !browser) return t.unknownDevice;
  return browser && platform ? t.browserOn({ browser, platform }) : (browser ?? platform)!;
}

/** When a session was last used: a moment in the figures' language, or the words' *unknown*. */
function when(iso: string | null, unknown: string, figures: Language): string {
  if (!iso) return unknown;
  return formatDateTime(iso, undefined, figures) || unknown;
}

/**
 * Where you are signed in, and how to stop being (P4-T13).
 *
 * **The current session is marked and cannot be revoked from here.** Signing yourself out
 * of the seat you are sitting in works, but it reads as a bug — the page reloads into a
 * login screen and nothing said it would. *Sign out* in the header already does that, and
 * says so.
 */
export function SessionList({ bare = false }: {
  /**
   * **In *Profil saya*'s sheet** (UI V1, UI-111): the sheet's title is the heading, so the list draws no card and no
   * heading of its own — the line, the rows and *Keluar dari semua perangkat* as they are.
   */
  bare?: boolean;
} = {}) {
  const { signOut } = useSignOut();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useMessages(accountMessages).sessions;
  const language = useLanguage();
  const figures = useFigureLanguage();

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const Box = bare ? 'div' : Card;
  return (
    <Box>
      {!bare && <h2 className="font-display text-lg font-bold text-navy">{t.heading}</h2>}
      <p className={bare ? 'text-md text-muted' : 'mt-1 text-md text-muted'}>{t.line}</p>

      {error && <ErrorBanner {...error} />}

      {sessions === null ? (
        <SkeletonText lines={3} className="mt-3" />
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-hairline">
          {sessions.map((session) => (
            <li key={session.sessionId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-md text-navy">
                  {describeDevice(session.userAgent, language)}
                  {session.current && (
                    <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-sm font-semibold text-navy">
                      {t.thisDevice}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {t.lastUsed({ address: session.ip ?? t.unknownAddress, when: when(session.lastUsedAt, t.unknownWhen, figures) })}
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
                  {t.signOutOne}
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
          {t.signOutEverywhere}
        </Button>
        <p className="mt-2 text-sm text-muted">
          {/* The client's words for the lost device (P18.95-T7 AC-5; UI-030), at every size. */}
          {t.everywhereLine}
        </p>
      </div>
    </Box>
  );
}
