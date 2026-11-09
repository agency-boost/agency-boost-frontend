import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The support session's banner** (P18.10-T6; `components/impersonation-banner.tsx`; ADR-0206; `nfr/security-and-privacy.md`,
 * *Impersonation*): drawn above every family's screens while a Super Admin acts as somebody, so it is its own small
 * area, the only words of the console in every route's chunk. **It says the session only looks** (P19.4-T2; UI-151):
 * the setup session's sentence and the elevated session's are retired with them (ADR-0206 §3).
 *
 * **Its reader is the Super Admin**, in their own chosen language — never the office's, never the person's: a support
 * session follows no account's `users.locale` (`LanguageProvider`'s `follow`, P18.10-T2 AC-2), so the screens beneath
 * read in the support person's language too.
 *
 * **English is the source**; the Indonesian the approved glossary's (*Hanya melihat*, UI-151; a person *dia*, §B.0
 * rule 8). The person's name is as stored.
 *
 * @moved components/impersonation-banner.tsx
 */
const en = {
  actingAs: ({ name }: { name: string }) => `You are acting as ${name}.`,
  lookOnly: 'This is a view-only session: you can look, and nothing can be changed.',
  recorded: 'Everything you do is recorded against you as well.',
  ending: 'Ending…',
  stop: 'Stop acting as them',
};

const id: MessagesOf<typeof en> = {
  actingAs: ({ name }) => `Anda bertindak sebagai ${name}.`,
  lookOnly: 'Ini sesi hanya melihat: Anda dapat melihat, dan tidak ada yang bisa diubah.',
  recorded: 'Semua yang Anda lakukan juga dicatat atas nama Anda.',
  ending: 'Mengakhiri…',
  stop: 'Berhenti bertindak sebagai dia',
};

export const supportBannerMessages = defineMessages({ en, id });
