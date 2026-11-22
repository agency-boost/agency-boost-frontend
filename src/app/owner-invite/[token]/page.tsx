'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { RoleShell } from '@/components/role-shell';
import { Button, ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { ownerInviteMessages } from '@/i18n/messages/owner-invite';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { acceptOwnerInvite, readOwnerInvite, type OwnerInviteBanner } from '@/lib/owner-invite';
import { signInPathFrom } from '@/lib/return-path';
import { useSession } from '@/lib/session';

/**
 * **The KPM Owner's claim link** (`/owner-invite/[token]`; P19.23-T2 AC-3; ADR-0277; OD-420): what the Super Admin's
 * WhatsApp message carries to an Owner named with no email. The banner first — the KPM, its company, who it is for, until
 * when — read before anybody signs in. **Signed out**: *Masuk*, which comes back here, and *Daftar* for a person with no
 * account yet (registration does not carry the link, so the page says to open it again once signed up and verified).
 * **Signed in**: *Terima & jadi owner*, which makes the account the KPM's Owner and opens KPM Overview. Every refusal is
 * the server's own sentence — a dead link, another company's account, an unverified address — and a refusal before the
 * link is spent leaves it working.
 */
export default function OwnerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { me, loading, reload } = useSession();
  const t = useMessages(ownerInviteMessages).page;
  const figures = useFigureLanguage();
  const [banner, setBanner] = useState<OwnerInviteBanner | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    readOwnerInvite(token)
      .then((read) => { if (live) setBanner(read); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptOwnerInvite(token);
      // The session now holds the Owner's membership, so the office's pages are theirs.
      await reload();
      router.replace('/kpm/overview');
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  const here = { pathname: `/owner-invite/${encodeURIComponent(token)}`, search: '' };
  return (
    <RoleShell title={t.title} allowSignedOut>
      <Card className="max-w-xl">
        {error && <ErrorBanner {...error} />}
        {!banner && !error && <Skeleton label={t.checking}><SkeletonText lines={3} /></Skeleton>}
        {banner && (
          <div>
            <div className="rounded-md border-l-4 border-l-primary bg-base p-3">
              <p className="font-display text-lg font-bold text-navy">{t.kpm({ kpm: banner.kpmName, company: banner.companyName })}</p>
              <p className="mt-1 text-md font-semibold uppercase text-navy">{t.forName({ name: banner.ownerName })}</p>
              <p className="mt-1 text-md text-muted">{t.explain}</p>
              <p className="mt-1 text-sm text-muted">
                {t.expires({ date: formatOfficeDay(banner.expiresAt, OFFICE_TIME_ZONE, figures) })}
              </p>
            </div>
            {!loading && !me ? (
              <div className="mt-4">
                <p className="text-md text-navy">{t.signedOut}</p>
                <ButtonLink href={signInPathFrom(here)} className="mt-3 w-full sm:w-auto">{t.signIn}</ButtonLink>
                <p className="mt-3 text-sm text-muted">
                  {t.noAccount}{' '}
                  <Link href="/register" className="font-semibold text-navy underline">{t.register}</Link>
                </p>
                <p className="mt-1 text-sm text-muted">{t.afterRegister}</p>
              </div>
            ) : (
              <div className="mt-4">
                {me && <p className="text-md text-navy">{t.signedInAs({ name: me.user.fullName })}</p>}
                <Button className="mt-3 w-full sm:w-auto" disabled={busy || loading} onClick={() => void accept()}>
                  {busy ? t.accepting : t.accept}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </RoleShell>
  );
}
