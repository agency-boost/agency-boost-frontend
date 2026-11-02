'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { requestsMessages } from '@/i18n/messages/requests';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { approveTransfer, declineTransfer, readTransferQueue, type TransferView } from '@/lib/invites';

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
  // The section's words (ADR-0170 §4; `i18n/messages/requests.ts`): ours, no prototype draws a transfer.
  const copy = useMessages(requestsMessages).transfers;
  const figures = useFigureLanguage();
  const columns = [copy.columns.who, copy.columns.move, copy.columns.askedBy, { label: copy.columns.actions, visuallyHidden: true as const }];
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
      show(action === 'approve' ? copy.approved({ name: row.member.name, to: row.to.name }) : copy.declined);
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
      <h2 id="transfer-requests" className="font-display text-lg font-bold text-navy">{copy.heading}</h2>
      <p className="mb-3 mt-1 text-md text-muted">{copy.line}</p>
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      {rows.length > 0 && (
        <DataTable caption={copy.caption} columns={columns}>
          {rows.map((row) => (
            <Row key={row.transferId}>
              <Cell className="font-semibold">
                {row.member.name}
                <span className="block text-sm font-normal text-muted">
                  {row.member.agentCode}
                  {typedOtherwise(row) && <> · {copy.typedAs({ name: row.requestedName! })}</>}
                </span>
              </Cell>
              <Cell className="text-muted">{copy.move({ from: row.from?.name ?? null, to: row.to.name })}</Cell>
              <Cell className="text-muted">
                {`${row.requestedBy.name}, ${formatOfficeDay(row.requestedAt, OFFICE_TIME_ZONE, figures)}`}
              </Cell>
              <Cell>
                {declining === row.transferId ? (
                  <div className="flex flex-col gap-2">
                    <Field label={copy.why} htmlFor={`transfer-reason-${row.transferId}`} hint={copy.whyHint}>
                      <TextInput id={`transfer-reason-${row.transferId}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                    <span className="flex flex-wrap gap-2">
                      <Button variant="danger" disabled={busy} onClick={() => void decide(row, 'decline')}>{copy.decline}</Button>
                      <Button variant="secondary" disabled={busy} onClick={() => { setDeclining(null); setReason(''); }}>
                        {copy.cancel}
                      </Button>
                    </span>
                  </div>
                ) : (
                  <span className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => setApproving(row)}>{copy.approve}</Button>
                    <Button variant="danger" disabled={busy} onClick={() => setDeclining(row.transferId)}>{copy.decline}</Button>
                  </span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
      <Dialog
        open={approving !== null}
        message={approving ? copy.confirm({ name: approving.member.name, to: approving.to.name }) : ''}
        confirmLabel={copy.confirmLabel}
        cancelLabel={copy.cancel}
        onConfirm={() => { if (approving) void decide(approving, 'approve'); }}
        onCancel={() => setApproving(null)}
      />
      <Toast toast={toast} />
    </section>
  );
}
