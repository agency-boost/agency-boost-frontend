'use client';

import { useEffect, useState } from 'react';
import { ComingInPhase } from '@/components/coming-in-phase';
import { TenantShell } from '@/components/tenant-shell';
import { Card, ErrorBanner } from '@/components/ui/field';
import { readTenant, type Kpm } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';

/**
 * Where a KPM Owner and a KPM Admin land.
 *
 * Half of it is real and half is a sign, and they are visibly different. The office and
 * the settings provisioning seeded for it are read from the API — that is what an Owner
 * needs to confirm on day one, that their office exists and its defaults are in place.
 * The analytics arrive in Phase 14 with the data that feeds them, and until then the
 * screen says so rather than showing a shell full of zeroes, which would read as "your
 * office has no production".
 */
export default function KpmOverviewPage() {
  return (
    <TenantShell title="Overview" subtitle="Your office at a glance.">
      <Office />
    </TenantShell>
  );
}

function Office() {
  const { me } = useSession();
  const [kpm, setKpm] = useState<Kpm | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const kpmId = me?.membership?.kpmId;

  useEffect(() => {
    if (!kpmId) return;
    void readTenant(kpmId)
      .then(setKpm)
      .catch((err) => setError(toDisplayError(err)));
  }, [kpmId]);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner {...error} />}

      {kpm && (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">
            {kpm.code} · {kpm.branchName}
          </h2>
          <dl className="mt-3 grid grid-cols-[14rem_1fr] gap-y-1.5 text-md">
            <dt className="text-muted">Time zone</dt>
            <dd className="text-navy">{kpm.timezone}</dd>
            <dt className="text-muted">Currency</dt>
            <dd className="text-navy">{kpm.currency}</dd>
          </dl>
          <p className="mt-3 text-sm text-muted">
            Every &ldquo;today&rdquo;, &ldquo;this week&rdquo; and &ldquo;this month&rdquo; in this
            office is worked out in its own time zone, not in yours and not in the server&apos;s.
          </p>
        </Card>
      )}

      {kpm && (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Seeded configuration</h2>
          <p className="mt-1 text-md text-muted">
            Copied from the platform defaults when your office was set up. You take these over in
            Phase 4.
          </p>
          <dl className="mt-3 grid grid-cols-[14rem_1fr] gap-y-1.5 text-md">
            {Object.entries(kpm.settings ?? {}).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted">{key}</dt>
                <dd className="text-navy">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <ComingInPhase
        phase={14}
        what="Composition, engagement, coaching coverage, recruitment and production for the whole office, on one screen."
        elsewhere={[
          {
            href: '/people/members',
            label: 'All members',
            detail: 'The roster: who is here, their role, and who they report to.',
          },
          {
            href: '/profile',
            label: 'Your account',
            detail: 'Your name, pronoun and password.',
          },
        ]}
      />
    </div>
  );
}
