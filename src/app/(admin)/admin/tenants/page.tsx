'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { listTenants, TENANT_STATUS_LABEL, type Kpm } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */
const COLUMNS = ['Code', 'Branch', 'Company', 'Owner', 'Status'] as const;

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Kpm[] | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);

  // One request. The company name used to be joined here from a second call, which meant
  // a KPM whose company was missing from that list rendered a raw ObjectId in the column
  // — and cost a round trip to do it. The payload carries the name now.
  useEffect(() => {
    void listTenants()
      .then(setTenants)
      .catch((err) => {
        setError(toDisplayError(err));
        setTenants([]);
      });
  }, []);

  return (
    <Page
      title="All KPMs"
      subtitle="Every KPM on the platform. One exists only because somebody here created it."
      actions={
        <ButtonLink href="/admin/tenants/new">New office</ButtonLink>
      }
    >
      {error && <ErrorBanner {...error} />}

      {tenants === null && (
        <SkeletonTable caption="Offices on the platform" columns={COLUMNS} rows={5} />
      )}

      {tenants?.length === 0 && !error && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState
            title="No KPMs yet."
            action={
              <Link href="/admin/tenants/new" className="text-md text-navy underline">
                Create the first one
              </Link>
            }
          />
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <DataTable
          caption="Offices on the platform"
          columns={COLUMNS}
        >
          {tenants.map((t) => (
            <Row key={t._id}>
              <Cell className="font-semibold">
                <Link href={`/admin/tenants/${t._id}`} className="underline">
                  {t.code}
                </Link>
              </Cell>
              <Cell>{t.branchName}</Cell>
              <Cell>{t.companyName}</Cell>
              <Cell>
                {t.ownerName ? (
                  <>
                    <span className="block text-navy">{t.ownerName}</span>
                    {t.ownerEmail && (
                      <span className="block text-sm text-muted">{t.ownerEmail}</span>
                    )}
                  </>
                ) : (
                  <Link href={`/admin/tenants/${t._id}/owner`} className="text-alert underline">
                    Assign an owner
                  </Link>
                )}
              </Cell>
              <Cell>
                <StatusPill
                  status={t.status === 'active' ? 'success' : t.status === 'suspended' ? 'alert' : 'neutral'}
                  label={TENANT_STATUS_LABEL[t.status]}
                />
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </Page>
  );
}
