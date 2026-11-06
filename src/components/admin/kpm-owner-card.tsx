'use client';

import { useState } from 'react';
import { Button, ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/status-pill';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminKpmOwnerMessages } from '@/i18n/messages/admin-kpm-owner';
import { resendOwnerInvitation, type OwnerState, type TenantRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { dayInZone, formatShortDay } from '@/lib/format';
import { whatsAppLink } from '@/lib/phone-number';
import { useCan } from '@/lib/session';

/**
 * *Aktif · Diundang · Belum diundang* (ADR-0212 §2), each a pill with its words — the colour is never the only cue — in
 * the mockup's paints: green, amber, grey (`superadmin-kpm-setup-2026-11-02.html`, `ownerChip`).
 */
function OwnerStatePill({ state, label }: { state: Exclude<OwnerState, 'none'>; label: string }) {
  if (state === 'invited') return <StatusPill status="watch" label={label} />;
  return <StatusPill status={state === 'active' ? 'success' : 'neutral'} label={label} />;
}

/**
 * **The Owner's card on a KPM's *Ringkasan*** (P19.4-T3 AC-9; ADR-0212 §2–§4; the setup spec's A2, the mockup's `vKpm`
 * *Ringkasan*): who runs the KPM, where their invitation stands, and what the Super Admin can do about it.
 *
 * - **The Owner** — or the one named with no email (`pendingOwner`) — with ***Aktif · Diundang · Belum diundang***,
 *   their **WhatsApp number** as a link that opens the Super Admin's own WhatsApp to it with nothing composed (the D-22
 *   idiom; the product sends nothing by it, ADR-0212 §4), their email, and when the invitation went.
 * - ***Kirim ulang undangan*** while the Owner has not signed in: `POST /admin/tenants/:id/owner/invitation`, a new
 *   link by email and the old revoked; the API refuses one with nobody to send it to, and its refusal is shown here.
 * - ***Ganti pemilik*** (*Tetapkan pemilik* with none) — `/admin/tenants/[kpmId]/owner`, which also gives a pending
 *   Owner their email; and ***Buka sebagai Owner***, which only looks (ADR-0206), for an active KPM with an Owner.
 *
 * Gated for convenience by the grants the API checks (`kpm:assign_owner`, `impersonation:start`); the API refuses
 * anybody else. `onChanged` is told the KPM as the resend answered it, so the page redraws from the server's word.
 */
export function KpmOwnerCard({ kpm, onChanged }: { kpm: TenantRow; onChanged: (next: TenantRow) => void | Promise<void> }) {
  const t = useMessages(adminKpmOwnerMessages).card;
  const figures = useFigureLanguage();
  // The shell's toast inside a shell; outside one (a spec), the card's own slot.
  const { toast, show } = useToast();
  const canAssign = useCan('kpm:assign_owner');
  const canImpersonate = useCan('impersonation:start');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const name = kpm.ownerName ?? kpm.pendingOwner?.fullName ?? null;
  const state = kpm.ownerState === 'none' ? null : kpm.ownerState;
  const chat = whatsAppLink(kpm.ownerPhone);
  const canResend = canAssign && Boolean(kpm.ownerUserId) && kpm.ownerState !== 'active';

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const next = await resendOwnerInvitation(kpm._id);
      show(t.resent);
      await onChanged(next);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-owner-card="">
      <h2 className="font-display text-lg font-bold text-navy">{t.title}</h2>
      {error && <div className="mt-2"><ErrorBanner {...error} /></div>}
      {name ? (
        <div className="mt-2 flex flex-col gap-1 text-md text-navy">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{name}</span>
            {state && <OwnerStatePill state={state} label={t.state[state]} />}
          </p>
          {kpm.ownerPhone && (
            <p className="text-sm text-muted">
              {chat ? (
                <a href={chat} target="_blank" rel="noreferrer" className="underline" aria-label={t.whatsapp({ name })}>
                  {kpm.ownerPhone}
                </a>
              ) : kpm.ownerPhone}
            </p>
          )}
          {kpm.ownerEmail && <p className="break-all text-sm text-muted">{kpm.ownerEmail}</p>}
          {kpm.ownerState === 'invited' && kpm.ownerInvitedAt && (
            <p className="text-sm text-muted">
              {t.invitedOn({
                date: formatShortDay(dayInZone(kpm.timezone, new Date(kpm.ownerInvitedAt)), { year: true }, figures),
              })}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-md text-alert">{t.noOwner}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canResend && (
          <Button variant="secondary" disabled={busy} onClick={() => void resend()}>
            {busy ? t.resending : t.resend}
          </Button>
        )}
        {canAssign && (
          <ButtonLink href={`/admin/tenants/${kpm._id}/owner`} variant="secondary">
            {kpm.ownerUserId ? t.change : t.assign}
          </ButtonLink>
        )}
        {/* A session as the Owner, *Hanya melihat* and nothing else (P19.4-T2; ADR-0206 §3): only into an active KPM. */}
        {canImpersonate && kpm.ownerUserId && kpm.status === 'active' && (
          <ButtonLink href={`/admin/impersonate/${kpm.ownerUserId}?kpmId=${kpm._id}`} variant="secondary">
            {t.openAsOwner}
          </ButtonLink>
        )}
      </div>
      <Toast toast={toast} />
    </Card>
  );
}
