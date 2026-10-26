'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SubscriptionDialog } from '@/components/subscription-dialog';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  leadersOver, leadersSaid, leadersWord, listTenants, tenantStatusTone, tenantStatusWord, type TenantRow,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { formatShortDay } from '@/lib/format';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */
/*
 * *End date* and *Leaders*, and a last column of one action, are the client's (ADR-0112 §2, P13.2-T3
 * AC-7): the subscription is entered *"directly from here"*. The action column has a name nobody sees,
 * so a screen reader moving by column is told what is in it.
 */
const COLUMNS: readonly Column[] = [
  'Code', 'Branch', 'Company', 'Owner', 'Status', 'End date', 'Leaders',
  { label: 'Subscription', visuallyHidden: true },
];

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  /** The office whose subscription is open in the dialog. */
  const [editing, setEditing] = useState<TenantRow | null>(null);
  /** What the dialog said it saved, for the row's own live region. */
  const [saved, setSaved] = useState<string>('');

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
                <StatusPill status={tenantStatusTone(t)} label={tenantStatusWord(t)} />
              </Cell>
              <Cell className="whitespace-nowrap">
                {t.subscription?.endDate ? formatShortDay(t.subscription.endDate, { year: true }) : '—'}
              </Cell>
              <Cell className="whitespace-nowrap">
                {/* ADR-0157 §4: past the limit — AgencyBoost approved leaders beyond it — the count reads above
                    it, and *3 over* says by how much in the warning paint. Said once, whole, to a screen reader. */}
                <span aria-hidden="true">
                  {leadersWord(t)}
                  {leadersOver(t) > 0 && (
                    <StatusPill status="watch" label={`${leadersOver(t)} over`} className="ml-2" />
                  )}
                </span>
                <span className="sr-only">{leadersSaid(t)}</span>
              </Cell>
              <Cell>
                <Button
                  variant="secondary"
                  className="whitespace-nowrap"
                  aria-label={`Edit subscription for KPM ${t.code} · ${t.branchName}`}
                  onClick={() => setEditing(t)}
                >
                  Edit subscription
                </Button>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <p role="status" className="sr-only">{saved}</p>

      {editing && (
        <SubscriptionDialog
          row={editing}
          open
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            // The answer is the row as this list reads it, so it is drawn from that, not re-read.
            setTenants((rows) => rows?.map((r) => (r._id === row._id ? row : r)) ?? rows);
            setSaved(`Subscription saved for KPM ${row.code}.`);
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}
