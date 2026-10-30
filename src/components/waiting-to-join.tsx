'use client';

import { useState } from 'react';
import { InviteShare } from '@/components/invite-share';
import { ActionMenu } from '@/components/ui/action-menu';
import { destructiveLast, useDestructiveAction } from '@/components/ui/destructive-action';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TonePill } from '@/components/ui/tone-pill';
import { toDisplayError } from '@/lib/api-client';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { formatCalendarDay } from '@/lib/format';
import {
  askedFor, cancelInvite, resendInvite, type InviteView, type RequestedTransferView, type SharedInvite,
} from '@/lib/invites';
import { usePhone } from '@/lib/use-phone';

/**
 * **Waiting to join** on `/new-hires` (P18.96-T3 AC-2, AC-3; ADR-0170 §2, §4; **UI V1, UI-024**, D-24): the people a
 * leader has added who are not in the unit yet — each invite, *Diundang, menunggu bergabung* or *Undangan kedaluwarsa*,
 * and each transfer the leader asked for, *Pemindahan diajukan*, which the office decides — by the name and code the
 * leader typed, and nothing of the unit the person is in now, which the server does not send (the P18.96 exit review,
 * M3). Nothing here counts anywhere: an invite is no membership, and a transfer moves nobody until it is approved.
 *
 * **A list, not a card** (UI-024): behind the *Menunggu bergabung n ›* tile in a bottom sheet below 768px, in the
 * right column from it. **An invite's actions are in its ⋯** — *Kirim ulang*, then *Batalkan undangan*, last, red, and
 * asked about first (`useDestructiveAction`, D-06). *Kirim ulang* gives a new link and 14 days more and shows the share
 * step again — the link is never kept, so it cannot be shown otherwise.
 *
 * **Its words are the catalogue's** (`new-hires.ts`' `waiting`; P18.98-T4), a join date written in the figures' language.
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
  const t = useMessages(newHiresMessages).waiting;
  const confirmed = useMessages(confirmationMessages);
  const figures = useFigureLanguage();
  const phone = usePhone();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [target, setTarget] = useState<InviteView | null>(null);
  const [shared, setShared] = useState<SharedInvite | null>(null);
  const cancelling = useDestructiveAction({
    label: t.cancelInvite,
    message: target ? t.cancelAsk({ name: target.fullName }) : '',
    confirmLabel: t.cancelInvite,
    cancelLabel: t.keep,
    onConfirm: () => { if (target) void cancel(target); },
    disabled: busy !== null,
  });

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
    setBusy(invite.inviteId);
    setError(null);
    try {
      const next = await cancelInvite(invite.inviteId);
      onInvites(() => next.invites);
      onToast(confirmed.inviteCancelled);
    } catch (err) {
      setError({ id: invite.inviteId, message: toDisplayError(err).message });
    } finally {
      setBusy(null);
      setTarget(null);
    }
  }

  return (
    <>
      <ul role="list" aria-label={t.heading} className="flex flex-col">
        {invites.map((invite) => (
          <li key={invite.inviteId} className="flex items-center gap-2 border-b border-divider py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="break-words text-md font-bold uppercase text-ink">{invite.fullName}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <TonePill tone={invite.status === 'expired' ? 'red' : 'grey'}>
                  {invite.status === 'expired' ? t.expired : t.invited}
                </TonePill>
                <span>
                  {invite.agentCode} · {t.joinDate({ day: formatCalendarDay(invite.joinDate, figures) })}
                  {invite.leader.membershipId !== reader && <> · {t.intoUnit({ leader: invite.leader.name })}</>}
                </span>
              </p>
              {error?.id === invite.inviteId && <p role="alert" className="mt-1 text-xs font-semibold text-alert">{error.message}</p>}
            </div>
            <ActionMenu
              label={t.actionsFor({ name: invite.fullName })}
              inert={busy !== null}
              items={destructiveLast([
                { label: busy === invite.inviteId ? t.resending : t.resend, onSelect: () => void resend(invite) },
                { ...cancelling.item, onSelect: () => { setTarget(invite); cancelling.ask(); } },
              ])}
            />
          </li>
        ))}
        {transfers.map((transfer) => (
          <li key={transfer.transferId} className="border-b border-divider py-2.5 last:border-b-0">
            <p className="break-words text-md font-bold uppercase text-ink">{askedFor(transfer)}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <TonePill tone="grey">{t.transfer}</TonePill>
              <span>
                {transfer.agentCode}
                {transfer.to.membershipId !== reader && <> · {t.intoUnit({ leader: transfer.to.name })}</>}
                {' · '}{t.officeDecides}
              </span>
            </p>
          </li>
        ))}
      </ul>

      {cancelling.dialog}
      <Modal
        open={shared !== null}
        title={shared ? t.shareTitle({ name: shared.invite.fullName }) : ''}
        onClose={() => setShared(null)}
        placement={phone ? 'sheet' : 'center'}
        className="max-w-[30rem]"
        footer={<Button onClick={() => setShared(null)}>{t.done}</Button>}
      >
        {shared && <InviteShare {...shared} />}
      </Modal>
    </>
  );
}
