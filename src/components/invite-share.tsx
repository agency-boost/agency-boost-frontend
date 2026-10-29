'use client';

import { CopyableValue } from '@/components/ui/copyable-value';
import { buttonClass } from '@/components/ui/field';
import { InviteQr } from '@/components/ui/invite-qr';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { inviteWhatsAppLink, type SharedInvite } from '@/lib/invites';

/**
 * **An invite's three ways out** (P18.96-T3 AC-2, ADR-0170 §2): *Share on WhatsApp* — the invitee's chat with the
 * message and the link filled in — *Copy link*, and a QR of the same link, the leader code panel's own pieces
 * (`/user-management/add`). Shown once, in the answer that made the token: *+ Add agent* and *Resend*. The link is
 * never shown again, because only its hash is kept.
 *
 * **Its words are the catalogue's** (`add-agent.ts`' `share`; P18.98-T4), the day the link stops working written in
 * the figures' language. **The WhatsApp message is the invitee's**, in Bahasa Indonesia whatever the reader's screen
 * (`inviteMessage`).
 */
export function InviteShare({ invite, link }: SharedInvite) {
  const t = useMessages(addAgentMessages).share;
  const confirmed = useMessages(confirmationMessages);
  const figures = useFigureLanguage();
  const whatsApp = inviteWhatsAppLink(invite.phone, invite.fullName, link);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-md text-navy">
        {t.ready({ name: invite.fullName, until: formatOfficeDay(invite.expiresAt, OFFICE_TIME_ZONE, figures) })}
      </p>
      {invite.existingAccount && <p className="text-md text-muted">{t.signIn({ name: invite.fullName })}</p>}
      {whatsApp ? (
        <a href={whatsApp} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'self-start')}>
          {t.shareOnWhatsApp}
        </a>
      ) : (
        <p role="status" className="text-md text-muted">{t.noNumber}</p>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <CopyableValue label={t.linkLabel} value={link} action={t.copyLink} border="dashed" copied={confirmed.linkCopied} />
        </div>
        <InviteQr url={link} />
      </div>
    </div>
  );
}
