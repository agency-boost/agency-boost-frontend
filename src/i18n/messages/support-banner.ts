import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The support session's banner** (P18.98-T6; `components/impersonation-banner.tsx`; ADR-0162; `nfr/security-and-privacy.md`,
 * *Impersonation*): drawn above every family's screens while a Super Admin acts as somebody, so it is its own small
 * area, the only words of the console in every route's chunk.
 *
 * **Its reader is the Super Admin**, in their own chosen language — never the office's, never the person's: a support
 * session follows no account's `users.locale` (`LanguageProvider`'s `follow`, P18.98-T2 AC-2), so the screens beneath
 * read in the support person's language too.
 *
 * **English is the source**, byte for byte as before; the Indonesian the approved glossary's (*sesi penyiapan*, §B.10;
 * a person *dia*, §B.0 rule 8). *Super Admin* and *KPM* kept (§A). The person's name is as stored.
 *
 * @moved components/impersonation-banner.tsx
 */
const en = {
  actingAs: ({ name }: { name: string }) => `You are acting as ${name}.`,
  canWrite: 'This session can make changes. It was approved by a second Super Admin.',
  setup: 'This is a setup session: you can change the office’s settings, import people and upload production files, and nothing else.',
  lookOnly: 'You can look but not change anything — a second Super Admin has to approve that.',
  recorded: 'Everything you do is recorded against you as well.',
  ending: 'Ending…',
  stop: 'Stop acting as them',
};

const id: MessagesOf<typeof en> = {
  actingAs: ({ name }) => `Anda bertindak sebagai ${name}.`,
  canWrite: `Sesi ini dapat mengubah data. Sesi ini disetujui oleh ${kept('Super Admin')} kedua.`,
  setup: `Ini sesi penyiapan: Anda dapat mengubah pengaturan ${kept('KPM')}, mengimpor orang, dan mengunggah file produksi, dan tidak lebih.`,
  lookOnly: `Anda dapat melihat tetapi tidak dapat mengubah apa pun — ${kept('Super Admin')} kedua harus menyetujuinya.`,
  recorded: 'Semua yang Anda lakukan juga dicatat atas nama Anda.',
  ending: 'Mengakhiri…',
  stop: 'Berhenti bertindak sebagai dia',
};

export const supportBannerMessages = defineMessages({ en, id });
