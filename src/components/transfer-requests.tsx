'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatOfficeDay } from '@/lib/format';
import { approveTransfer, declineTransfer, readTransferQueue, type TransferView } from '@/lib/invites';

/** The section's words (ADR-0170 §4): ours, no prototype draws a transfer. */
export const TRANSFER_COPY = {
  heading: 'Transfer requests',
  line: 'A leader added somebody who reports to another leader. Approving moves them, and everybody under them, with their history.',
  caption: 'Transfer requests, oldest first',
  move: (from: string | null, to: string) => (from ? `From ${from}’s unit to ${to}’s` : `To ${to}’s unit`),
  typedAs: (name: string) => `Added as ${name}`,
  asked: (by: string, day: string) => `${by}, ${day}`,
  approve: 'Approve',
  decline: 'Decline',
  cancel: 'Cancel',
  why: 'Why?',
  whyHint: 'Sent to the leader who asked.',
  confirm: (name: string, to: string) => `Move ${name} to ${to}’s unit? Everybody under them moves too.`,
  confirmLabel: 'Approve transfer',
  approved: (name: string, to: string) => `Transfer approved ✓ — ${name} is in ${to}’s unit now.`,
  declined: 'Transfer declined ✓',
} as const;

const COLUMNS = ['Who', 'Move', 'Asked by', { label: 'Actions', visuallyHidden: true }] as const;

/** The leader typed a name that is not the account's — compared as a person reads them, case and spacing aside. */
const typedOtherwise = (row: TransferView) => {
  const fold = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  return !!row.requestedName && fold(row.requestedName) !== fold(row.member.name);
};

/**
 * **Transfer requests, on *All Members* › *Pending*** (P18.96-T3 AC-3, ADR-0170 §4): every move a leader asked for that
 * nobody has decided, for the Owner and the Admins (`member:transfer_approve`). *Approve* asks first — it moves the
 * member and their whole unit — and *Decline* asks why, which the leader is sent. Drawn only while one waits: the
 * Pending tab's own population is the people who registered, and this is a second one beside it.
 *
 * **The name the leader typed** sits on the code's line, *Added as {name}*, where it is not the account's own (the
 * P18.96 exit review, M3): the leader who asked is shown only what they typed, so the decider is the one who can see a
 * code typed for the wrong person before approving it.
 */
export function TransferRequests() {
  const [rows, setRows] = useState<TransferView[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState<TransferView | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      setRows(await readTransferQueue());
    } catch (err) {
      setError(toDisplayError(err));
      setRows([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(row: TransferView, action: 'approve' | 'decline') {
    setApproving(null);
    setBusy(true);
    setError(null);
    try {
      // The server answers with the queue as it now stands, so two admins deciding at once see the truth.
      setRows(action === 'approve' ? await approveTransfer(row.transferId) : await declineTransfer(row.transferId, reason.trim() || undefined));
      show(action === 'approve' ? TRANSFER_COPY.approved(row.member.name, row.to.name) : TRANSFER_COPY.declined);
      setDeclining(null);
      setReason('');
    } catch (err) {
      setError(toDisplayError(err));
      await readTransferQueue().then(setRows).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!rows || (rows.length === 0 && !error)) return <Toast toast={toast} />;

  return (
    <section aria-labelledby="transfer-requests" className="mt-6">
      <h2 id="transfer-requests" className="font-display text-lg font-bold text-navy">{TRANSFER_COPY.heading}</h2>
      <p className="mb-3 mt-1 text-md text-muted">{TRANSFER_COPY.line}</p>
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      {rows.length > 0 && (
        <DataTable caption={TRANSFER_COPY.caption} columns={COLUMNS}>
          {rows.map((row) => (
            <Row key={row.transferId}>
              <Cell className="font-semibold">
                {row.member.name}
                <span className="block text-sm font-normal text-muted">
                  {row.member.agentCode}
                  {typedOtherwise(row) && <> · {TRANSFER_COPY.typedAs(row.requestedName!)}</>}
                </span>
              </Cell>
              <Cell className="text-muted">{TRANSFER_COPY.move(row.from?.name ?? null, row.to.name)}</Cell>
              <Cell className="text-muted">
                {TRANSFER_COPY.asked(row.requestedBy.name, formatOfficeDay(row.requestedAt))}
              </Cell>
              <Cell>
                {declining === row.transferId ? (
                  <div className="flex flex-col gap-2">
                    <Field label={TRANSFER_COPY.why} htmlFor={`transfer-reason-${row.transferId}`} hint={TRANSFER_COPY.whyHint}>
                      <TextInput id={`transfer-reason-${row.transferId}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                    <span className="flex flex-wrap gap-2">
                      <Button variant="danger" disabled={busy} onClick={() => void decide(row, 'decline')}>{TRANSFER_COPY.decline}</Button>
                      <Button variant="secondary" disabled={busy} onClick={() => { setDeclining(null); setReason(''); }}>
                        {TRANSFER_COPY.cancel}
                      </Button>
                    </span>
                  </div>
                ) : (
                  <span className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => setApproving(row)}>{TRANSFER_COPY.approve}</Button>
                    <Button variant="danger" disabled={busy} onClick={() => setDeclining(row.transferId)}>{TRANSFER_COPY.decline}</Button>
                  </span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
      <Dialog
        open={approving !== null}
        message={approving ? TRANSFER_COPY.confirm(approving.member.name, approving.to.name) : ''}
        confirmLabel={TRANSFER_COPY.confirmLabel}
        onConfirm={() => { if (approving) void decide(approving, 'approve'); }}
        onCancel={() => setApproving(null)}
      />
      <Toast toast={toast} />
    </section>
  );
}
