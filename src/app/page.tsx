'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/field';
import { RoleBadge } from '@/components/ui/role-badge';
import { readTenant, type Kpm } from '@/lib/admin';
import { useSession } from '@/lib/session';

/**
 * The landing. It has no content of its own — it sends each person to the surface that
 * is actually theirs, which is the only thing a shared root URL can honestly do in a
 * product with three role families.
 */
export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();

  const isTenantAdmin = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/login');
    else if (me.user.platformRole === 'super_admin') router.replace('/admin');
    else if (!isTenantAdmin) router.replace('/profile');
  }, [loading, me, isTenantAdmin, router]);

  if (loading || !me || !isTenantAdmin) {
    return (
      <p role="status" className="px-5 py-10 text-md text-muted">
        Loading…
      </p>
    );
  }

  return <OwnerLanding />;
}

/**
 * What a KPM Owner sees on their first sign-in.
 *
 * The full Overview — production, compliance, the leader forum — arrives in Phase 14
 * with the data that feeds it. What can be shown truthfully today is the office itself
 * and the configuration provisioning seeded for it, which is exactly what an Owner
 * needs to confirm on day one: that their office exists and its defaults are in place.
 * Showing an Overview shell full of zeroes instead would read as "your office has no
 * production", which is a different and false statement.
 */
function OwnerLanding() {
  const { me } = useSession();
  const [kpm, setKpm] = useState<Kpm | null>(null);
  const [failed, setFailed] = useState(false);

  const kpmId = me?.membership?.kpmId;

  useEffect(() => {
    if (!kpmId) return;
    void readTenant(kpmId).then(setKpm).catch(() => setFailed(true));
  }, [kpmId]);

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="font-display text-3xl font-bold text-navy">
        {kpm ? `${kpm.code} · ${kpm.branchName}` : 'Your office'}
      </h1>
      <p className="mt-1 text-md text-muted">
        Signed in as {me?.user.preferredName ?? me?.user.fullName}.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">You</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-md text-navy">
            {me?.membership && <RoleBadge role={me.membership.hierarchyRole} />}
            <span>{me?.membership?.isKpmOwner ? 'KPM Owner' : 'KPM Admin'}</span>
            <span className="text-muted">· {me?.permissions.length} permissions</span>
          </div>
          <Link href="/profile" className="mt-3 inline-block text-md text-navy underline">
            Your account
          </Link>
        </Card>

        {failed && (
          <Card>
            <p className="text-md text-alert">Your office profile could not be loaded.</p>
          </Card>
        )}

        {kpm && (
          <Card>
            <h2 className="font-display text-lg font-bold text-navy">Seeded configuration</h2>
            <p className="mt-1 text-md text-muted">
              Copied from the platform defaults when your office was provisioned. You take
              these over from Phase 4.
            </p>
            <dl className="mt-3 grid grid-cols-[14rem_1fr] gap-y-1.5 text-md">
              <dt className="text-muted">Time zone</dt>
              <dd className="text-navy">{kpm.timezone}</dd>
              <dt className="text-muted">Currency</dt>
              <dd className="text-navy">{kpm.currency}</dd>
              {Object.entries(kpm.settings ?? {}).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-navy">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>
    </main>
  );
}
