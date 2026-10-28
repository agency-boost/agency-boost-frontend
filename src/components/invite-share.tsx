'use client';

import { CopyableValue } from '@/components/ui/copyable-value';
import { buttonClass } from '@/components/ui/field';
import { InviteQr } from '@/components/ui/invite-qr';
import { CONFIRMED } from '@/lib/confirmations';
import { formatOfficeDay } from '@/lib/format';
import { inviteWhatsAppLink, type SharedInvite } from '@/lib/invites';

/** The share step's words (P18.96-T3 AC-2): ours, no prototype draws an invite to one person. */
export const SHARE_COPY = {
  shareOnWhatsApp: 'Share on WhatsApp',
  copyLink: 'Copy link',
  linkLabel: 'Invite link',
  ready: (name: string, until: string) => `The invite for ${name} is ready. The link works until ${until}, once.`,
  signIn: (name: string) => `${name} already has an account, so the link asks them to sign in and accept.`,
  noNumber: 'That number is not one WhatsApp can open. Copy the link and send it another way.',
} as const;

/**
 * **An invite's three ways out** (P18.96-T3 AC-2, ADR-0170 §2): *Share on WhatsApp* — the invitee's chat with the
 * message and the link filled in — *Copy link*, and a QR of the same link, the leader code panel's own pieces
 * (`/user-management/add`). Shown once, in the answer that made the token: *+ Add agent* and *Resend*. The link is
 * never shown again, because only its hash is kept.
 */
export function InviteShare({ invite, link }: SharedInvite) {
  const whatsApp = inviteWhatsAppLink(invite.phone, invite.fullName, link);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-md text-navy">{SHARE_COPY.ready(invite.fullName, formatOfficeDay(invite.expiresAt))}</p>
      {invite.existingAccount && <p className="text-md text-muted">{SHARE_COPY.signIn(invite.fullName)}</p>}
      {whatsApp ? (
        <a href={whatsApp} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'self-start')}>
          {SHARE_COPY.shareOnWhatsApp}
        </a>
      ) : (
        <p role="status" className="text-md text-muted">{SHARE_COPY.noNumber}</p>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <CopyableValue label={SHARE_COPY.linkLabel} value={link} action={SHARE_COPY.copyLink} border="dashed" copied={CONFIRMED.linkCopied} />
        </div>
        <InviteQr url={link} />
      </div>
    </div>
  );
}
