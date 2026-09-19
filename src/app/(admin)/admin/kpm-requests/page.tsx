'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, ErrorBanner, Field, FieldRow, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  approveKpmRequest,
  declineKpmRequest,
  readKpmRequests,
  type KpmRequestRow,
} from '@/lib/admin';

/**
 * KPMs pending approval (`Superadmin.html:322-333`).
 *
 * The prototype's table is **read-only** — four columns, an alert-red `Pending` pill, and
 * no action anywhere: no approve, no decline, no reason, no drawer. So every control here
 * is ours, and it is registered as such. The interaction follows the leader-side pending
 * row (`User_Management_Section.html:891-908`), which is the nearest thing the prototype
 * does specify: Decline secondary, Approve primary, decided inline rather than in a modal.
 *
 * **Approving asks for the office code.** It has to be unique within the company and
 * nobody outside the platform can know what is free, which is why the prototype's `KPM
 * name` column is a branch name and the number is ours to issue.
 */
export default function KpmRequestsPage() {
  const [rows, setRows] = useState<KpmRequestRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setRows(await readKpmRequests());
    } catch (err) {
      setError(toDisplayError(err));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: KpmRequestRow, how: 'approve' | 'decline') {
    setBusy(row.requestId);
    setError(null);
    try {
      const next =
        how === 'approve'
          ? await approveKpmRequest(row.requestId, code[row.requestId] ?? '')
          : await declineKpmRequest(row.requestId, reason[row.requestId] || undefined);
      setRows(next);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  const pending = rows?.filter((r) => r.status === 'pending') ?? [];
  const decided = rows?.filter((r) => r.status !== 'pending') ?? [];

  return (
    <Page
      title="KPMs pending approval"
      subtitle="New registrations, awaiting Superadmin sign-off"
    >
      {error && <ErrorBanner {...error} />}

      {rows === null && !error && (
        <SkeletonCards count={3} label="Loading registrations…" className="mb-3" />
      )}

      {rows && pending.length === 0 && (
        <Card>
          <EmptyState title="Nobody is waiting for an office." />
        </Card>
      )}

      {pending.map((row) => (
        <Card key={row.requestId} className="mb-3">
          <div className="flex flex-wrap items-start gap-4">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-md font-bold text-navy">
                {row.branchName}
              </span>
              <span className="block text-sm text-muted">
                {row.companyName} · asked by <strong>{row.requestedByName}</strong> (proposed KPM
                Owner) · {row.requestedByEmail}
              </span>
              {row.note && <span className="mt-1 block text-md text-navy">{row.note}</span>}
            </span>
            <StatusPill status="alert" label="Pending" />
          </div>

          <FieldRow className="mt-3">
            <Field label="KPM code" htmlFor={`code-${row.requestId}`} className="w-32">
              <TextInput
                id={`code-${row.requestId}`}
                inputMode="numeric"
                placeholder="0629"
                value={code[row.requestId] ?? ''}
                onChange={(e) => setCode({ ...code, [row.requestId]: e.target.value })}
              />
            </Field>
            <FieldRow.Actions>
              <Button
                disabled={busy !== null || !(code[row.requestId] ?? '').trim()}
                onClick={() => void decide(row, 'approve')}
              >
                {busy === row.requestId ? 'Approving…' : 'Approve'}
              </Button>
            </FieldRow.Actions>
            <Field label="Why not?" htmlFor={`why-${row.requestId}`} className="min-w-[16rem] flex-1">
              <TextInput
                id={`why-${row.requestId}`}
                placeholder="Sent back to whoever asked"
                value={reason[row.requestId] ?? ''}
                onChange={(e) => setReason({ ...reason, [row.requestId]: e.target.value })}
              />
            </Field>
            <FieldRow.Actions>
              <Button
                variant="danger"
                disabled={busy !== null}
                onClick={() => void decide(row, 'decline')}
              >
                Decline
              </Button>
            </FieldRow.Actions>
          </FieldRow>
          {/* Approving provisions an office and hands somebody the keys to it, so the
              button says what it will do before it does it. */}
          <p className="mt-2 text-sm text-muted">
            Approving creates the office and makes {row.requestedByName} its Owner.
          </p>
        </Card>
      ))}

      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 font-display text-lg font-bold text-navy">Already decided</h2>
          <DataTable
            caption="Decided registrations"
            columns={['KPM name', 'Company', 'Requested by', 'Status']}
          >
            {decided.map((row) => (
              <Row key={row.requestId}>
                <Cell className="font-semibold">{row.branchName}</Cell>
                <Cell className="text-muted">{row.companyName}</Cell>
                <Cell className="text-muted">
                  {row.requestedByName} (proposed KPM Owner)
                  {row.reason && <span className="block text-sm">{row.reason}</span>}
                </Cell>
                <Cell>
                  <StatusPill
                    status={row.status === 'approved' ? 'success' : 'neutral'}
                    label={row.status === 'approved' ? 'Approved' : 'Declined'}
                  />
                </Cell>
              </Row>
            ))}
          </DataTable>
        </>
      )}
    </Page>
  );
}
