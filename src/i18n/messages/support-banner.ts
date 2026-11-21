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
  /**
   * *Changed 2026-11-20 (P19.23-T2 AC-7; ADR-0277; the owner mockups' view-as bar):* **"Viewing as NAME"**, the name
   * drawn after these words in the primary's colour, and the tag beside it — the three sentences it was are one line.
   */
  viewingAs: 'Viewing as',
  tag: 'View only · recorded in the audit log',
  ending: 'Ending…',
  stop: 'Done',
};

const id: MessagesOf<typeof en> = {
  viewingAs: 'Melihat sebagai',
  tag: 'Hanya melihat · tercatat di audit log',
  ending: 'Mengakhiri…',
  stop: 'Selesai',
};

export const supportBannerMessages = defineMessages({ en, id });
