import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The invite's share block** (UI V1, Phase 18.99 T9; UI-084, UI-090 — and UI-024's *+ Tambah agent* modal on New
 * Hires, T6, which reuses it): a leader's code, *Salin tautan*, *Salin kode*, the QR and WhatsApp
 * (`components/invite-share-block.tsx`).
 *
 * **English is the source.** The Indonesian is the report's (Appendix A: *Kode leader*, *Tautan undangan* in sentence
 * case, *Salin tautan*, *Salin kode*, *QR*; the New Hires mockup's *Pindai untuk bergabung*) and the approved glossary's
 * (§B.1 *Salin tautan*); *QR* and *WhatsApp* read alike in both (§B.10, proposed). **Kept** (§A): *leader*. The code and
 * the link are shown as they are.
 *
 * @moved components/invite-share-block.tsx
 */
const en = {
  linkLabel: 'Invite link',
  codeLabel: 'Leader code',
  copyLink: 'Copy link',
  copyCode: 'Copy code',
  /** The QR button's words, and what it does for a screen reader. */
  qr: 'QR',
  showQr: 'Show the QR code',
  hideQr: 'Hide the QR code',
  /** The QR's sheet: its title, and the code under it. */
  scanToJoin: 'Scan to join',
  scanCode: ({ code }: { code: string }) => `Code ${code}`,
  /** The round green button. */
  whatsApp: 'Share the invite on WhatsApp',
  /** The modal's fourth button, under its icon. */
  whatsAppShort: 'WhatsApp',
};

const id: MessagesOf<typeof en> = {
  linkLabel: 'Tautan undangan',
  codeLabel: `Kode ${kept('leader')}`,
  copyLink: 'Salin tautan',
  copyCode: 'Salin kode',
  qr: 'QR',
  showQr: 'Tampilkan kode QR',
  hideQr: 'Sembunyikan kode QR',
  scanToJoin: 'Pindai untuk bergabung',
  scanCode: ({ code }) => `Kode ${code}`,
  whatsApp: 'Bagikan undangan lewat WhatsApp',
  whatsAppShort: 'WhatsApp',
};

export const inviteShareMessages = defineMessages({ en, id });
