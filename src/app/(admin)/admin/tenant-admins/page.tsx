'use client';

import { Suspense, useEffect, useState } from 'react';
import { ProductDataChanges } from '@/components/admin/product-data-changes';
import { ProductDataGrantDialog } from '@/components/admin/product-data-grant-dialog';
import { Page } from '@/components/page';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { NavIcon } from '@/components/ui/nav-icon';
import { RouteTabs } from '@/components/ui/route-tabs';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast, Toast } from '@/components/ui/toast';
import { TonePill } from '@/components/ui/tone-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { productDataAccessMessages } from '@/i18n/messages/product-data-access';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { insurersOf, listCompanies, readTenantAdmins, type PlatformAdminRow } from '@/lib/admin';
import {
  readProductDataGrants, type GrantCompany, type ProductDataGrantRow,
} from '@/lib/product-data-grants';
import { useMediaQuery } from '@/lib/use-media-query';
import { useQuery } from '@/lib/use-query';

/** The two tabs, in the query (the route registry's `?tab=`): the people when absent. */
const PEOPLE_TAB = '/admin/tenant-admins';
const CHANGES_TAB = '/admin/tenant-admins?tab=changes';

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
 * **Office administration stays read-only here, and that is the design.** Granting and revoking it stay inside the
 * office, where the Owner does them: `kpm_admin:grant` names no tenant grantee but the Owner, and an Admin who tries is
 * told the Owner reserved it. A platform screen that could hand it out would route around a decision the office owns.
 *
 * ***Kelola data produk* is given here** (P19.15-T4 AC-2; ADR-0260 §4, the placement): it is not office administration
 * but leave to keep an **insurer's** data, the platform's to give, and the people it may go to are exactly this page's —
 * every KPM Owner and KPM Admin. So each row carries a key (an icon in the *Access* column the page already has, the
 * smallest footprint, ADR-0062) opening the switch and the insurers to tick, and a held grant reads as one more pill
 * there. ***Perubahan oleh pengelola*** is the page's second tab (`?tab=changes`), as *All members* has two.
 *
 * **Below 1024px one row per person** (P19.2-T2 AC-1; UI-126: no sideways scroll): the name, *email · office* under it,
 * when the access was granted — or that it came with the office — and the *Owner* / *Admin* pills and the key on the
 * right. From 1024px the table.
 */
export default function TenantAdminsPage() {
  const t = useMessages(adminOfficesMessages).admins;
  return (
    <Page title={t.title}>
      {/* `useSearchParams` needs a boundary (`lib/use-query.ts`). */}
      <Suspense fallback={null}>
        <FromAddress />
      </Suspense>
    </Page>
  );
}

function FromAddress() {
  const p = useMessages(productDataAccessMessages).changes;
  const query = useQuery();
  const changes = query.tab === 'changes';
  return (
    <>
      <RouteTabs
        label={p.caption}
        activeHref={changes ? CHANGES_TAB : PEOPLE_TAB}
        tabs={[{ href: PEOPLE_TAB, label: p.people }, { href: CHANGES_TAB, label: p.tab }]}
      />
      {changes ? <ProductDataChanges /> : <People />}
    </>
  );
}

function People() {
  const t = useMessages(adminOfficesMessages).admins;
  const g = useMessages(productDataAccessMessages).grants;
  const figures = useFigureLanguage();
  const COLUMNS = [t.columns.who, t.columns.office, t.columns.access, t.columns.granted];
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const { toast, show } = useToast();
  const [rows, setRows] = useState<PlatformAdminRow[] | null>(null);
  const [grants, setGrants] = useState<Map<string, ProductDataGrantRow>>(new Map());
  const [insurers, setInsurers] = useState<GrantCompany[] | null>(null);
  const [editing, setEditing] = useState<PlatformAdminRow | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void readTenantAdmins()
      .then(setRows)
      .catch((err) => {
        setError(toDisplayError(err));
        setRows([]);
      });
    void readProductDataGrants()
      .then((list) => setGrants(new Map(list.map((row) => [row.userId, row]))))
      .catch((err) => setError(toDisplayError(err)));
    void listCompanies()
      .then((all) => setInsurers(insurersOf(all).map((c) => ({ companyId: c._id, name: c.name }))))
      .catch(() => setInsurers([]));
  }, []);

  /** The grant's pill and the key that opens it, in the *Access* cell and on the row's right. */
  const access = (r: PlatformAdminRow) => {
    const grant = grants.get(r.userId);
    return (
      <>
        {r.isOwner && <StatusPill status="success" label={t.owner} />}
        {r.isAdmin && <StatusPill status="neutral" label={t.admin} />}
        {grant && (
          <TonePill tone={grant.holds ? 'blue' : 'grey'}>
            <span title={grant.holds ? undefined : g.dormant}>
              {g.pill({ companies: grant.companies.map((c) => c.name).join(', ') })}
              {/* Grey and said, never colour alone: a grant on record that holds nothing today (ADR-0260 §2). */}
              {!grant.holds && <span className="sr-only">{`: ${g.dormant}`}</span>}
            </span>
          </TonePill>
        )}
        <Button
          variant="icon"
          className="h-11 w-11 lg:h-9 lg:w-9"
          aria-haspopup="dialog"
          aria-label={g.open({ name: r.fullName })}
          title={g.title}
          onClick={() => setEditing(r)}
        >
          <NavIcon name="document" className="h-5 w-5" />
        </Button>
      </>
    );
  };

  return (
    <>
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
          {belowLaptop ? (
            <ListCard label={t.caption}>
              {rows.map((r) => (
                <ListRow
                  key={r.membershipId}
                  data-row={r.membershipId}
                  title={r.fullName}
                  meta={`${r.email} · ${r.kpmLabel}`}
                  note={(
                    <span className="text-muted">
                      {r.grantedAt
                        ? <>{t.columns.granted} <time dateTime={r.grantedAt}>{formatOfficeDay(r.grantedAt, OFFICE_TIME_ZONE, figures)}</time></>
                        : t.withOffice}
                    </span>
                  )}
                  trailing={<span className="flex flex-wrap items-center justify-end gap-1">{access(r)}</span>}
                />
              ))}
            </ListCard>
          ) : (
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
                  <span className="flex flex-wrap items-center gap-2">{access(r)}</span>
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
          )}
        </>
      )}

      {editing && (
        <ProductDataGrantDialog
          open
          person={{ userId: editing.userId, fullName: editing.fullName }}
          grant={grants.get(editing.userId) ?? null}
          insurers={insurers}
          onClose={() => setEditing(null)}
          onSaved={(row, message) => {
            setGrants((now) => {
              const next = new Map(now);
              if (row) next.set(row.userId, row);
              else next.delete(editing.userId);
              return next;
            });
            setEditing(null);
            show(message);
          }}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}
