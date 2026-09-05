'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink, ErrorBanner } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/status-pill';
import { listCompanies, listTenants, TENANT_STATUS_LABEL, type Company, type Kpm } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Kpm[] | null>(null);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [kpms, cos] = await Promise.all([listTenants(), listCompanies()]);
        setTenants(kpms);
        setCompanies(Object.fromEntries(cos.map((c: Company) => [c._id, c.name])));
      } catch (err) {
        setError(toDisplayError(err));
        setTenants([]);
      }
    })();
  }, []);

  return (
    <AdminShell
      title="Tenants"
      subtitle="Every office on the platform. An office exists only because someone here created it."
      actions={
        <ButtonLink href="/admin/tenants/new">New office</ButtonLink>
      }
    >
      {error && <ErrorBanner {...error} />}

      {tenants === null && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {tenants?.length === 0 && !error && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState
            title="No offices yet."
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
          columns={['Code', 'Branch', 'Principal', 'Owner', 'Status']}
        >
          {tenants.map((t) => (
            <Row key={t._id}>
              <Cell className="font-semibold">
                <Link href={`/admin/tenants/${t._id}`} className="underline">
                  {t.code}
                </Link>
              </Cell>
              <Cell>{t.branchName}</Cell>
              <Cell>{companies[t.companyId] ?? t.companyId}</Cell>
              <Cell>
                {t.ownerUserId ? (
                  <span className="text-muted">{t.ownerUserId}</span>
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
    </AdminShell>
  );
}
