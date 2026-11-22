'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Toast, useToast } from '@/components/ui/toast';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { membersMessages } from '@/i18n/messages/members';
import { requestsMessages } from '@/i18n/messages/requests';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { daysAgoWords } from '@/lib/kpm-overview';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import { approveTransfer, declineTransfer, readTransferQueue, type TransferView } from '@/lib/invites';
import { RED_FILL } from '@/components/people/member-actions';

/** Whole days from an instant to today, in the office's calendar. */
function daysSince(iso: string, today: string): number {
  const day = dayInZone(OFFICE_TIME_ZONE, new Date(iso));
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000));
}

/**
 * **Permintaan pindah unit, on *All members* › *Menunggu*** (P19.20-T1 AC-4; the People mockup's frame 11; ADR-0170 §4,
 * ADR-0247 §3): every move nobody has decided — oldest first, the whole team moving — for whoever decides them
 * (`member:transfer_approve`: the Owner, an Admin, a core leader for somebody below them). Each row: photo, the NAME ·
 * role · code; *"Diajukan {leader} · pindah dari {from} ke {to} · n hari lalu"*; *Tolak* and *Setujui*. *Setujui* asks once
 * — the whole unit moves — and *Tolak* asks why, as today's flow does, in a centred dialog; the leader who asked is told.
 *
 * `onCount` says how many wait, for *Menunggu*'s red count; nothing is drawn while none waits.
 */
export function TransferRequests({ onCount }: { onCount?: (n: number) => void }) {
  const copy = useMessages(requestsMessages).transfers;
  const t = useMessages(membersMessages).waiting;
  const language = useLanguage();
  const [rows, setRows] = useState<TransferView[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState<TransferView | null>(null);
  const [declining, setDeclining] = useState<TransferView | null>(null);
  const [reason, setReason] = useState('');
  const { toast, show } = useToast();
  const today = dayInZone(OFFICE_TIME_ZONE, new Date());

  const settle = useCallback((next: TransferView[]) => {
    // Oldest first (the mockup's *terlama dulu*).
    const sorted = [...next].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
    setRows(sorted);
    onCount?.(sorted.length);
  }, [onCount]);

  const load = useCallback(async () => {
    try {
      settle(await readTransferQueue());
    } catch (err) {
      setError(toDisplayError(err));
      setRows([]);
      onCount?.(0);
    }
  }, [settle, onCount]);
  useEffect(() => { void load(); }, [load]);

  async function decide(row: TransferView, action: 'approve' | 'decline') {
    setApproving(null);
    setBusy(true);
    setError(null);
    try {
      settle(action === 'approve' ? await approveTransfer(row.transferId) : await declineTransfer(row.transferId, reason.trim() || undefined));
      show(action === 'approve' ? copy.approved({ name: row.member.name, to: row.to.name }) : copy.declined);
      setDeclining(null);
      setReason('');
    } catch (err) {
      setError(toDisplayError(err));
      await readTransferQueue().then(settle).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!rows || (rows.length === 0 && !error)) return <Toast toast={toast} />;

  return (
    <section aria-labelledby="transfer-requests" className="mb-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="transfer-requests" className="font-display text-md font-bold text-navy">{t.movesTitle}</h2>
        <span className="text-sm text-muted">{t.movesNote}</span>
      </div>
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.transferId} data-transfer={row.transferId}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-card-edge bg-card px-4 py-3">
            <Avatar name={row.member.name} seed={row.member.membershipId} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-md">
                <span className="font-bold uppercase text-ink">{row.member.name}</span>
                <span className="text-muted"> · {row.member.agentCode}</span>
              </p>
              <p className="text-sm text-muted">
                {t.askedBy({ name: row.requestedBy.name.toUpperCase() })}
                {' · '}
                {t.move({ from: row.from?.name.toUpperCase() ?? null, to: row.to.name.toUpperCase() })}
                {' · '}
                {daysAgoWords(daysSince(row.requestedAt, today), language)}
              </p>
              {row.note && <p className="mt-0.5 text-sm italic text-muted">{copy.note({ note: row.note })}</p>}
            </div>
            <span className="flex shrink-0 gap-2">
              <Button variant="secondary" className="min-h-11 rounded-pill" disabled={busy} onClick={() => setDeclining(row)}>{t.decline}</Button>
              <Button className="min-h-11 rounded-pill" disabled={busy} onClick={() => setApproving(row)}>{t.approve}</Button>
            </span>
          </li>
        ))}
      </ul>
      <Dialog
        open={approving !== null}
        message={approving ? copy.confirm({ name: approving.member.name, to: approving.to.name }) : ''}
        confirmLabel={t.approve}
        cancelLabel={copy.cancel}
        onConfirm={() => { if (approving) void decide(approving, 'approve'); }}
        onCancel={() => setApproving(null)}
      />
      {declining && (
        <Modal
          open
          title={`${t.decline} · ${declining.member.name.toUpperCase()}`}
          onClose={() => { setDeclining(null); setReason(''); }}
          footer={(
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="min-h-11 w-full rounded-pill" onClick={() => { setDeclining(null); setReason(''); }}>{copy.cancel}</Button>
              <Button variant="secondary" className={cn('min-h-11 w-full rounded-pill', RED_FILL)} disabled={busy}
                onClick={() => void decide(declining, 'decline')}>{t.decline}</Button>
            </div>
          )}
        >
          <Field label={copy.why} htmlFor="transfer-reason" hint={copy.whyHint}>
            <TextInput id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </Modal>
      )}
      <Toast toast={toast} />
    </section>
  );
}
