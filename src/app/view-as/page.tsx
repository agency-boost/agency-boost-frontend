'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { viewAsMessages } from '@/i18n/messages/view-as';
import { setAccessToken, setImpersonating, toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { markViewAsWindow, redeemViewAs } from '@/lib/view-as';

/** Why the window could not take up its session, when the server was never asked. */
type Problem = 'noCode' | 'signedOut';

/**
 * ***Lihat sebagai*'s new window** (P19.23-T2 AC-7; ADR-0277): `/view-as#<code>`, opened by `openViewAsWindow`.
 *
 * 1. **The code leaves the address at once** — read from the fragment (never sent to a server), then the address is
 *    replaced with the bare path, so neither the history nor a copied link carries it.
 * 2. **The Super Admin first**: the session provider restores them from the refresh cookie, as in any tab.
 * 3. **The code, once** (`POST /admin/impersonate/handoff`), for the session's token — held in this window's memory
 *    alone, as a same-tab session's is (`setAccessToken`, `setImpersonating`), the session re-read, and then `/`, which
 *    forwards to the person's own landing (`landingFor`). The bar at the top says whose screens these are.
 *
 * **Chrome-less, and outside every family**, as `/choose-a-password` is: the window belongs to the Super Admin for a
 * moment and to the person after, and neither one's menu should be drawn around the moment between.
 */
export default function ViewAsPage() {
  const t = useMessages(viewAsMessages);
  const router = useRouter();
  const { me, loading, reload } = useSession();
  // Read once, on the first effect: the code is in this window's address and nowhere else.
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // One redemption per window, whatever re-renders: a second would be refused as used (React's development double
  // effect included).
  const asked = useRef(false);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '');
    let found: string | null = null;
    try {
      found = raw ? decodeURIComponent(raw) : null;
    } catch {
      found = null;
    }
    window.history.replaceState(null, '', window.location.pathname);
    setCode(found);
  }, []);

  useEffect(() => {
    if (code === undefined || loading || asked.current) return;
    if (code === null) {
      setProblem('noCode');
      return;
    }
    if (!me) {
      setProblem('signedOut');
      return;
    }
    asked.current = true;
    void (async () => {
      try {
        const { accessToken } = await redeemViewAs(code);
        setAccessToken(accessToken);
        setImpersonating(true);
        markViewAsWindow();
        await reload();
        router.replace('/');
      } catch (err) {
        setError(toDisplayError(err));
      }
    })();
  }, [code, loading, me, reload, router]);

  const failed = error !== null || problem !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="font-display text-title font-bold text-navy">{t.title}</h1>
      <Card className="mt-4">
        {failed ? (
          <div className="flex flex-col gap-4">
            {error && <ErrorBanner {...error} />}
            {problem && (
              <p role="alert" className="text-md text-ink">
                {problem === 'noCode' ? t.noCode : t.signedOut}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => window.close()} className="min-h-10 w-full">
                {t.close}
              </Button>
              <ButtonLink href="/admin/tenants" variant="secondary" className="min-h-10 w-full justify-center">
                {t.back}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div aria-busy="true" aria-live="polite" className="flex flex-col gap-3">
            <p className="text-md font-semibold text-navy">{t.opening}</p>
            <p className="text-md text-muted">{t.line}</p>
            <SkeletonText lines={2} />
          </div>
        )}
      </Card>
    </main>
  );
}
