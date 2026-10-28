'use client';

import { useState } from 'react';
import { InviteShare } from '@/components/invite-share';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError } from '@/lib/api-client';
import { CONFIRMED } from '@/lib/confirmations';
import { formatCalendarDay } from '@/lib/format';
import {
  askedFor, cancelInvite, resendInvite, type InviteView, type RequestedTransferView, type SharedInvite,
} from '@/lib/invites';
import { usePhone } from '@/lib/use-phone';

/** The section's words (ADR-0170 §2, §4): the client's *Invited, waiting to join*, *Resend*, *Cancel invite*. */
export const WAITING_COPY = {
  heading: 'Waiting to join',
  invited: 'Invited, waiting to join',
  expired: 'Invite expired',
  transfer: 'Transfer requested',
  resend: 'Resend',
  resending: 'Resending…',
  cancelInvite: 'Cancel invite',
  keep: 'Keep it',
  cancelAsk: (name: string) => `Cancel the invite for ${name}? Its link stops working.`,
  joinDate: (day: string) => `Join date ${formatCalendarDay(day)}`,
  intoUnit: (leader: string) => `Into ${leader}’s unit`,
  officeDecides: 'The office decides',
  done: 'Done',
  shareTitle: (name: string) => `Invite ${name}`,
} as const;

/**
 * **Waiting to join** on `/new-hires` (P18.96-T3 AC-2, AC-3; ADR-0170 §2, §4): the people a leader has added who are
 * not in the unit yet — each invite, *Invited, waiting to join* or *Invite expired*, with **Resend** and **Cancel
 * invite**, and each transfer the leader asked for, *Transfer requested*, which the office decides — by the name and
 * code the leader typed, and nothing of the unit the person is in now, which the server does not send (the P18.96 exit
 * review, M3). Nothing here counts
 * anywhere: an invite is no membership, and a transfer moves nobody until it is approved. Drawn only when somebody is
 * waiting.
 *
 * *Resend* gives a new link and 14 days more, and shows the share step again — the link is never kept, so it cannot
 * be shown otherwise. *Cancel invite* asks first.
 */
export function WaitingToJoin({
  invites, transfers, reader, onInvites, onToast,
}: {
  invites: InviteView[];
  transfers: RequestedTransferView[];
  /** The reader's membership, to name a unit only when it is somebody else's. */
  reader: string | null | undefined;
  /** The invites as they now stand, from what the server answered. */
  onInvites: (update: (list: InviteView[]) => InviteView[]) => void;
  onToast: (message: string) => void;
}) {
  const phone = usePhone();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [cancelling, setCancelling] = useState<InviteView | null>(null);
  const [shared, setShared] = useState<SharedInvite | null>(null);

  if (invites.length === 0 && transfers.length === 0) return null;

  async function resend(invite: InviteView) {
    setBusy(invite.inviteId);
    setError(null);
    try {
      const next = await resendInvite(invite.inviteId);
      onInvites((list) => list.map((i) => (i.inviteId === invite.inviteId ? next.invite : i)));
      setShared(next);
    } catch (err) {
      setError({ id: invite.inviteId, message: toDisplayError(err).message });
    } finally {
      setBusy(null);
    }
  }

  async function cancel(invite: InviteView) {
    setCancelling(null);
    setBusy(invite.inviteId);
    setError(null);
    try {
      const next = await cancelInvite(invite.inviteId);
      onInvites(() => next.invites);
      onToast(CONFIRMED.inviteCancelled);
    } catch (err) {
      setError({ id: invite.inviteId, message: toDisplayError(err).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="waiting-to-join" className="mb-4 rounded-lg border border-hairline bg-card px-6 py-[22px] max-md:px-4">
      <h2 id="waiting-to-join" className="mb-1 font-display text-md font-bold text-navy">{WAITING_COPY.heading}</h2>
      <ul role="list" aria-labelledby="waiting-to-join">
        {invites.map((invite) => (
          <li key={invite.inviteId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-3 last:border-b-0">
            <div className="min-w-0 flex-1 basis-56">
              <p className="flex flex-wrap items-center gap-2 text-md font-semibold text-navy">
                <span className="break-words">{invite.fullName}</span>
                <StatusPill
                  status={invite.status === 'expired' ? 'alert' : 'neutral'}
                  label={invite.status === 'expired' ? WAITING_COPY.expired : WAITING_COPY.invited}
                />
              </p>
              <p className="text-sm text-muted">
                {invite.agentCode} · {WAITING_COPY.joinDate(invite.joinDate)}
                {invite.leader.membershipId !== reader && <> · {WAITING_COPY.intoUnit(invite.leader.name)}</>}
              </p>
              {error?.id === invite.inviteId && <p role="alert" className="mt-1 text-xs font-semibold text-alert">{error.message}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy !== null} onClick={() => void resend(invite)}>
                {busy === invite.inviteId ? WAITING_COPY.resending : WAITING_COPY.resend}
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => setCancelling(invite)}>
                {WAITING_COPY.cancelInvite}
              </Button>
            </div>
          </li>
        ))}
        {transfers.map((transfer) => (
          <li key={transfer.transferId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-md font-semibold text-navy">
                <span className="break-words">{askedFor(transfer)}</span>
                <StatusPill status="neutral" label={WAITING_COPY.transfer} />
              </p>
              <p className="text-sm text-muted">
                {transfer.agentCode}
                {transfer.to.membershipId !== reader && <> · {WAITING_COPY.intoUnit(transfer.to.name)}</>}
                {' · '}{WAITING_COPY.officeDecides}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={cancelling !== null}
        message={cancelling ? WAITING_COPY.cancelAsk(cancelling.fullName) : ''}
        confirmLabel={WAITING_COPY.cancelInvite}
        cancelLabel={WAITING_COPY.keep}
        tone="danger"
        onConfirm={() => { if (cancelling) void cancel(cancelling); }}
        onCancel={() => setCancelling(null)}
      />
      <Modal
        open={shared !== null}
        title={shared ? WAITING_COPY.shareTitle(shared.invite.fullName) : ''}
        onClose={() => setShared(null)}
        placement={phone ? 'sheet' : 'center'}
        className="max-w-[30rem]"
        footer={<Button onClick={() => setShared(null)}>{WAITING_COPY.done}</Button>}
      >
        {shared && <InviteShare {...shared} />}
      </Modal>
    </section>
  );
}
