'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, FieldRow, TextInput } from '@/components/ui/field';
import { rungShort } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  approveLeaderLimitRequest, declineLeaderLimitRequest, LEADER_LIMIT_QUEUE_CHANGED, readLeaderLimitQueue,
  requestedChange, type LeaderLimitRequestRow,
} from '@/lib/leader-limit-requests';

const STATUS_WORD: Record<LeaderLimitRequestRow['status'], string> = {
  pending: 'Pending', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled',
};

/** The office as the console names it everywhere: *KPM 0603 · Tangerang Branch*. */
const officeOf = (row: LeaderLimitRequestRow) => `KPM ${row.kpmCode} · ${row.kpmBranchName}`;

/** *13 / 10*, or the count alone for an office with no limit any more. */
const countOf = (row: Pick<LeaderLimitRequestRow, 'leadersUsed' | 'maxLeaders'>, used = row.leadersUsed) =>
  row.maxLeaders === null ? String(used) : `${used} / ${row.maxLeaders}`;

/**
 * **Leaders past the limit** (ADR-0157 §3, the client's request of 2026-10-26): an office that would add a leader
 * beyond the limit AgencyBoost set asks, and the Super Admin decides here.
 *
 * **No prototype draws it.** `Superadmin.html` has no queue for this, so the screen is built in the idiom of its
 * nearest neighbour, *KPMs pending approval* (`/admin/kpm-requests`): pending first as cards, Approve primary and
 * Decline with its reason inline, then the decided list as a table. Approving carries the change out past the limit
 * — the quota does not move — so each card says what approving makes the office's count.
 *
 * A request that no longer applies — the member moved, left, or was let in some other way — is refused by the server
 * and closed as declined; the queue is re-read so the card goes, and the refusal says why.
 */
export default function LeaderLimitRequestsPage() {
  const [rows, setRows] = useState<LeaderLimitRequestRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setRows(await readLeaderLimitQueue());
    } catch (err) {
      setError(toDisplayError(err));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: LeaderLimitRequestRow, how: 'approve' | 'decline') {
    setBusy(row.requestId);
    setError(null);
    try {
      setRows(how === 'approve'
        ? await approveLeaderLimitRequest(row.requestId)
        : await declineLeaderLimitRequest(row.requestId, (reason[row.requestId] ?? '').trim()));
    } catch (err) {
      setError(toDisplayError(err));
      // Stale, or decided in another tab: the server has closed it, so the queue is read again.
      await load();
    } finally {
      setBusy(null);
      window.dispatchEvent(new Event(LEADER_LIMIT_QUEUE_CHANGED));
    }
  }

  const pending = rows?.filter((r) => r.status === 'pending') ?? [];
  const decided = rows?.filter((r) => r.status !== 'pending') ?? [];
  // The badge's name (P18.95-T9 AC-1): *Agent → AAB*.
  const label = (code: string) => rungShort(code);

  return (
    <Page
      title="Leaders past the limit"
      subtitle="Offices asking to add a leader beyond their limit, awaiting AgencyBoost's approval"
      permission="leader_limit_request:decide"
    >
      {error && <ErrorBanner {...error} />}

      {rows === null && !error && (
        <SkeletonCards count={3} label="Loading requests…" className="mb-3" />
      )}

      {rows && pending.length === 0 && (
        <Card>
          <EmptyState title="No office is waiting to add a leader past its limit." />
        </Card>
      )}

      {pending.map((row) => (
        <Card key={row.requestId} className="mb-3">
          <div className="flex flex-wrap items-start gap-4">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-md font-bold text-navy">
                {row.subjectName} · {requestedChange(row, label)}
              </span>
              <span className="block text-sm text-muted">
                {officeOf(row)} · asked by <strong>{row.requestedByName}</strong> · leaders {countOf(row)}
              </span>
              {row.reason && <span className="mt-1 block text-md text-navy">{row.reason}</span>}
            </span>
            <StatusPill status="alert" label="Pending" />
          </div>

          <FieldRow className="mt-3">
            <FieldRow.Actions>
              <Button disabled={busy !== null} onClick={() => void decide(row, 'approve')}>
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
                disabled={busy !== null || !(reason[row.requestId] ?? '').trim()}
                onClick={() => void decide(row, 'decline')}
              >
                Decline
              </Button>
            </FieldRow.Actions>
          </FieldRow>
          {/* Approving makes a leader past the limit, so the card says what it does to the count first. */}
          <p className="mt-2 text-sm text-muted">
            Approving makes the change now, past the limit: the office&apos;s leaders become{' '}
            {countOf(row, row.leadersUsed + 1)}. The limit does not change.
          </p>
        </Card>
      ))}

      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 font-display text-lg font-bold text-navy">Already decided</h2>
          <DataTable
            caption="Decided requests"
            columns={['Member', 'Office', 'Change', 'Requested by', 'Status']}
          >
            {decided.map((row) => (
              <Row key={row.requestId}>
                <Cell className="font-semibold">{row.subjectName}</Cell>
                <Cell className="text-muted">{officeOf(row)}</Cell>
                <Cell className="text-muted">{requestedChange(row, label)}</Cell>
                <Cell className="text-muted">
                  {row.requestedByName}
                  {row.declineReason && <span className="block text-sm">{row.declineReason}</span>}
                </Cell>
                <Cell>
                  <StatusPill
                    status={row.status === 'approved' ? 'success' : 'neutral'}
                    label={STATUS_WORD[row.status]}
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
