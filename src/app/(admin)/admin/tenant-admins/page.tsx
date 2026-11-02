'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { readTenantAdmins, type PlatformAdminRow } from '@/lib/admin';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */

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
  const t = useMessages(adminOfficesMessages).admins;
  const figures = useFigureLanguage();
  const COLUMNS = [t.columns.who, t.columns.office, t.columns.access, t.columns.granted];
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
    <Page
      title={t.title}
      subtitle={t.subtitle}
    >
      {error && <ErrorBanner {...error} />}

      {rows === null && !error && (
        <SkeletonTable caption={t.caption} columns={COLUMNS} rows={4} />
      )}

      {rows && rows.length === 0 && !error && (
        <Card>
          <EmptyState title={t.empty} />
        </Card>
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="mb-3 text-md text-muted">{t.line}</p>
          <DataTable
            caption={t.caption}
            columns={COLUMNS}
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
                    {r.isOwner && <StatusPill status="success" label={t.owner} />}
                    {r.isAdmin && <StatusPill status="neutral" label={t.admin} />}
                  </span>
                </Cell>
                <Cell className="text-muted">
                  {r.grantedAt ? (
                    <time dateTime={r.grantedAt}>
                      {formatOfficeDay(r.grantedAt, OFFICE_TIME_ZONE, figures)}
                    </time>
                  ) : (
                    // An Owner's rights arrive with the office, not from a grant, so
                    // there is no date. A blank would read as missing data.
                    <span className="text-sm">{t.withOffice}</span>
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </>
      )}
    </Page>
  );
}
