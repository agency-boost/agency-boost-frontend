'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { ownerInviteMessages } from '@/i18n/messages/owner-invite';
import { toDisplayError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { OwnerInviteBlocked, OwnerInviteNoNumber, openOwnerWhatsAppInvite } from '@/lib/owner-invite';

/**
 * ***Kirim undangan* — the KPM Owner's invitation by WhatsApp** (P19.23-T2 AC-3; ADR-0277; OD-420; the mockup's *Owner
 * belum diundang · Kirim undangan* and *Buat KPM & undang owner*). One press opens the Super Admin's own WhatsApp with
 * the Owner's number and the message carrying a one-time link (`openOwnerWhatsAppInvite`); nothing is sent by the app.
 *
 * Wherever the console names an Owner who has not signed in — *KPM baru*'s confirmation, the KPM card's warning line,
 * the Dashboard's *Perlu tindakan* row, the KPM page's *Owner & admin* card. Busy while the link is asked for; a
 * refusal said under it in the reader's words (the browser's blocked window, a number WhatsApp cannot open, the API's
 * own sentence), and a toast once WhatsApp is open. At least 40px tall; full width where the caller asks
 * (`className="w-full"` on a phone, §12).
 */
export function OwnerWhatsAppInviteButton({
  kpmId,
  ownerName,
  label,
  variant = 'primary',
  className,
  onSent,
}: {
  kpmId: string;
  /** Who is being invited, for the button's accessible name; the label alone without it. */
  ownerName?: string;
  /** The words on the button; *Kirim undangan* when absent. */
  label?: string;
  /** `primary` — the orange action; `outline` — the row's quieter button, as the Dashboard's *Perlu tindakan* draws it. */
  variant?: 'primary' | 'outline';
  className?: string;
  /** Told once WhatsApp is open with the message — the caller may read the KPM again (*Diundang*). */
  onSent?: () => void;
}) {
  const t = useMessages(ownerInviteMessages);
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const invitation = await openOwnerWhatsAppInvite(kpmId);
      show(t.sent({ name: invitation.ownerName }));
      onSent?.();
    } catch (err) {
      if (err instanceof OwnerInviteBlocked) setError(t.blocked);
      else if (err instanceof OwnerInviteNoNumber) setError(t.noNumber({ name: err.ownerName }));
      else setError(toDisplayError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const words = label ?? t.button;
  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      <Button
        variant={variant === 'outline' ? 'secondary' : 'primary'}
        onClick={() => void invite()}
        disabled={busy}
        aria-busy={busy || undefined}
        // The visible words first, then who (WCAG 2.5.3) — only while they are *Kirim undangan* itself.
        aria-label={ownerName && !label && !busy ? t.buttonFor({ name: ownerName }) : undefined}
        data-owner-whatsapp-invite={kpmId}
        className="w-full gap-1.5"
      >
        <NavIcon name="whatsapp" className="h-[18px] w-[18px]" />
        {busy ? t.sending : words}
      </Button>
      {error && <span role="alert" className="text-sm text-alert">{error}</span>}
      <Toast toast={toast} />
    </span>
  );
}
