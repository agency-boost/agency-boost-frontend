'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readTenantAdmins, type PlatformAdminRow } from '@/lib/admin';

/**
 * KPM Owners & Admins (`Superadmin.html:196`).
 *
 * One of the nine destinations the prototype declares and enables none of, so the label
 * and its place in the nav are the only things it specifies — the surface is ours, and
 * registered.
 *
 * **Read-only, and that is the design.** Granting and revoking office administration stay
 * inside the office, where the Owner does them: `kpm_admin:grant` names no tenant grantee
 * but the Owner, and an Admin who tries is told the Owner reserved it. A platform screen
 * that could hand it out would route around a decision the office owns. This answers a
 * different question — *who can act inside our tenants* — which nothing else could give
 * without opening every office in turn.
 */
export default function TenantAdminsPage() {
  const [rows, setRows] = useState<PlatformAdminRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void readTenantAdmins()
      .then(setRows)
      .catch((err) => {
        setError(toDisplayError(err));
        setRows([]);
      });
  }, []);

  return (
    <AdminShell
      title="KPM Owners & Admins"
      subtitle="Everybody who can administer an office, across every office"
    >
      {error && <ErrorBanner {...error} />}

      {rows === null && !error && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {rows && rows.length === 0 && !error && (
        <Card>
          <EmptyState title="No office has an administrator yet." />
        </Card>
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="mb-3 text-md text-muted">
            Granting and revoking happen inside the office, by its Owner. This is a view, not a
            control.
          </p>
          <DataTable
            caption="Office administrators"
            columns={['Who', 'Office', 'Access', 'Granted']}
          >
            {rows.map((r) => (
              <Row key={r.membershipId}>
                <Cell className="font-semibold">
                  {r.fullName}
                  <span className="block text-sm font-normal text-muted">{r.email}</span>
                </Cell>
                <Cell className="text-muted">{r.kpmLabel}</Cell>
                <Cell>
                  <span className="flex flex-wrap gap-2">
                    {r.isOwner && <StatusPill status="success" label="Owner" />}
                    {r.isAdmin && <StatusPill status="neutral" label="Admin" />}
                  </span>
                </Cell>
                <Cell className="text-muted">
                  {r.grantedAt ? (
                    <time dateTime={r.grantedAt}>
                      {new Date(r.grantedAt).toLocaleDateString('en-GB')}
                    </time>
                  ) : (
                    // An Owner's rights arrive with the office, not from a grant, so
                    // there is no date. A blank would read as missing data.
                    <span className="text-sm">With the office</span>
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </>
      )}
    </AdminShell>
  );
}
