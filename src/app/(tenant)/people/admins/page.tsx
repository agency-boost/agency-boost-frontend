'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select } from '@/components/ui/field';
import { CONTROL_PHONE } from '@/components/ui/phone';
import { RoleBadge } from '@/components/ui/role-badge';
import { CardField, CardFields, RowCard, RowCards } from '@/components/ui/row-cards';
import { SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { displayName } from '@/lib/display-name';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatOfficeMonth } from '@/lib/format';
import {
  grantAdmin,
  listAdmins,
  readOrgTree,
  revokeAdmin,
  type DelegatedAdmin,
} from '@/lib/org';
import { usePhone } from '@/lib/use-phone';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */
const COLUMNS = ['Name', 'Role', 'Admin since', 'Granted by', { label: 'Actions', visuallyHidden: true }] as const;

/**
 * Manage KPM Admins (`KPM_Owner.html:1987-1997`).
 *
 * The prototype's version is two static rows and two `alert()` calls, so almost all of
 * this is ours to design: who can be granted, what a grant records, and what revoking
 * says before it happens.
 *
 * **Admin rights are orthogonal to hierarchy role.** Both of the prototype's own seeded
 * admins are ABs, and this screen says the role beside the name so that stays visible
 * rather than becoming a surprise.
 *
 * The screen is Owner-only, but the API is not symmetrical: an Admin may *read* the list
 * and is refused the writes with `PERM_OWNER_ONLY`. Knowing who else administers the
 * office is not a power; handing it out is.
 *
 * **Below 768px the list is a card per admin** (P18.97-T7 AC-1, ADR-0178 §4; the client's UI-034: the table, 425px on
 * a 375px screen): `usePhone`, asked where the screen mounts, before the list answers. From 768px the table it was.
 */
export default function AdminsPage() {
  const [admins, setAdmins] = useState<DelegatedAdmin[] | null>(null);
  const [candidates, setCandidates] = useState<{ membershipId: string; fullName: string }[]>([]);
  const [granting, setGranting] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<DelegatedAdmin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const phone = usePhone();

  /*
   * **A read that lands after the page is gone is dropped**, as `TenantConfigProvider`'s is: on CI one arrived after
   * the spec's environment was torn down and `setAdmins` threw *"window is not defined"*, failing a run whose every
   * test had passed (2026-10-27). Set in the effect, so React's development remount leaves it true.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [delegated, office] = await Promise.all([listAdmins(), readOrgTree()]);
      if (!mounted.current) return;
      setAdmins(delegated);
      /*
       * **Only the office's active members other than the reader and its admins** (P18.97-T4 AC-5, ADR-0176 §5; the
       * client's UI-026: the list offered Wilson, who was reading it). The tree is the office's active memberships, so
       * a removed one is never offered and a member who came back is offered once, by the membership she holds now;
       * the server refuses a removed one (`404`) and a pending one (`422`) whatever this offers.
       */
      const already = new Set(delegated.map((a) => a.membershipId));
      setCandidates(
        office.nodes
          .filter((n) => !n.isSelf && !already.has(n.membershipId))
          .map((n) => ({ membershipId: n.membershipId, fullName: displayName(n) }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
    } catch (err) {
      if (!mounted.current) return;
      setError(toDisplayError(err));
      setAdmins([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(run: () => Promise<DelegatedAdmin[]>) {
    setBusy(true);
    setError(null);
    try {
      setAdmins(await run());
      setGranting(null);
      setRevoking(null);
      // The candidate list is now one shorter, or one longer.
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Manage KPM Admins"
      subtitle="Who has delegated admin access to this KPM"
      permission="kpm_admin:grant"
    >
      {error && <ErrorBanner {...error} />}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* The client's one line for the paragraph it replaces, at every size (P18.97-T4 AC-5; the grey-text table, UI-026). */}
        <p className="max-w-2xl text-md text-muted">Admins can do everything except manage admins.</p>
        <Field label="Grant admin access to" htmlFor="grant-to" className="min-w-56">
          <Select
            id="grant-to"
            value={granting ?? ''}
            disabled={busy || candidates.length === 0}
            onChange={(e) => setGranting(e.target.value || null)}
          >
            <option value="">Choose somebody</option>
            {candidates.map((c) => (
              <option key={c.membershipId} value={c.membershipId}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          disabled={busy || granting === null}
          onClick={() => void act(() => grantAdmin(granting as string))}
        >
          {busy ? 'Granting…' : 'Grant access'}
        </Button>
      </div>

      {revoking && (
        <div className="mb-4 rounded-md border border-alert bg-base p-4">
          <h2 className="font-display text-md font-bold text-navy">
            Take {revoking.fullName}&apos;s admin access away?
          </h2>
          <p className="mt-1 text-md text-navy">
            They keep their place in the office and their unit — this only takes away what they can
            configure and report on. You can grant it again at any time.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void act(() => revokeAdmin(revoking.membershipId))}
            >
              {busy ? 'Revoking…' : 'Revoke access'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setRevoking(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {admins === null && !error && (phone
        ? <SkeletonCards count={2} label="Loading KPM Admins…" />
        : <SkeletonTable caption="KPM Admins" columns={COLUMNS} rows={3} />)}

      {admins?.length === 0 && !error && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState title="Nobody administers this office but you. Grant access above to delegate it." />
        </div>
      )}

      {admins && admins.length > 0 && (
        <>
          <p className="mb-2 text-md text-muted">
            {admins.length} {admins.length === 1 ? 'KPM Admin' : 'KPM Admins'}, delegated by you
          </p>
          {phone ? (
            <AdminCards admins={admins} busy={busy} onRevoke={setRevoking} />
          ) : (
          <DataTable
            caption="KPM Admins"
            columns={COLUMNS}
          >
            {admins.map((admin) => (
              <Row key={admin.membershipId}>
                <Cell className="font-semibold">
                  {admin.fullName}
                  <span className="block text-sm font-normal text-muted">{admin.agentCode}</span>
                </Cell>
                <Cell>
                  <RoleBadge role={admin.role} />
                </Cell>
                <Cell className="whitespace-nowrap text-muted">
                  {admin.grantedAt ? (
                    <time dateTime={admin.grantedAt}>
                      {formatOfficeMonth(admin.grantedAt)}
                    </time>
                  ) : (
                    '—'
                  )}
                </Cell>
                <Cell className="text-muted">{admin.grantedByName ?? '—'}</Cell>
                <Cell>
                  {admin.canRevoke ? (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => setRevoking(admin)}
                    >
                      Revoke
                    </Button>
                  ) : (
                    // The Owner's own access comes from being the Owner, not a grant.
                    <span className="text-sm text-muted">Yours</span>
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
          )}
        </>
      )}
    </Page>
  );
}

/**
 * **The admins as cards** (P18.97-T7 AC-1, ADR-0178 §4; UI-034), in the table's order and words through the shared card
 * pieces (`components/ui/row-cards.tsx`): the name with the rung's badge after it, the agent code under it, then
 * *Admin since* and *Granted by* each under its heading (a — is not drawn), and the row's one action across the card —
 * *Revoke*, 44px tall on a phone, asking first as the table's does — or *Yours* for the Owner's own access.
 */
function AdminCards({
  admins, busy, onRevoke,
}: {
  admins: DelegatedAdmin[];
  busy: boolean;
  onRevoke: (admin: DelegatedAdmin) => void;
}) {
  return (
    <RowCards label="KPM Admins">
      {admins.map((admin) => (
        <RowCard key={admin.membershipId} data-row={admin.membershipId}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 break-words text-md font-semibold text-navy">{admin.fullName}</span>
            <RoleBadge role={admin.role} />
          </p>
          <p className="text-sm text-muted">{admin.agentCode}</p>
          {(admin.grantedAt || admin.grantedByName) && (
            <CardFields>
              {admin.grantedAt && (
                <CardField label="Admin since">
                  <time dateTime={admin.grantedAt} className="text-muted">{formatOfficeMonth(admin.grantedAt)}</time>
                </CardField>
              )}
              {admin.grantedByName && (
                <CardField label="Granted by"><span className="text-muted">{admin.grantedByName}</span></CardField>
              )}
            </CardFields>
          )}
          <div className="mt-3">
            {admin.canRevoke ? (
              <Button variant="danger" disabled={busy} className={cn('w-full', CONTROL_PHONE)} onClick={() => onRevoke(admin)}>
                Revoke
                <span className="sr-only"> {admin.fullName}&apos;s admin access</span>
              </Button>
            ) : (
              // The Owner's own access comes from being the Owner, not a grant.
              <span className="text-sm text-muted">Yours</span>
            )}
          </div>
        </RowCard>
      ))}
    </RowCards>
  );
}
