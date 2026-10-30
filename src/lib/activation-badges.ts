import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { activationMessages } from '@/i18n/messages/activation';

/*
 * **The checklist link's badge, apart from the activation client** (P18.99-T16, the bundle): the Super Admin's
 * template editor draws it, and taking it from `lib/activation.ts` loaded that module and New Hires' catalogue in both
 * languages onto `/admin/companies/[companyId]/template`, past its 200 kB budget. `lib/activation.ts` re-exports both.
 */

const wordsIn = (language: Language) => messagesIn(activationMessages, language);

/** What a badge says: its face, its accessible name and its tooltip. */
export interface BadgeWords {
  glyph: string;
  name: string;
  tip: string;
}

/**
 * **The link badge's words, in `language`** (P18.98-T4): ***Auto*** for a link that completes its item (T4 AC-4), its
 * tooltip and the end of its name the registry's sentence as the server sends it — on the hire's rows, the leader's,
 * and the office's checklist settings (P13-T3 AC-1, parity I-80). Its caller passes `useLanguage()`; English when
 * given none.
 */
export function autoBadge(completesWhen: string, language: Language = SOURCE_LANGUAGE): BadgeWords {
  const t = wordsIn(language);
  return { glyph: t.auto, name: t.autoName({ completesWhen }), tip: t.autoTip({ completesWhen }) };
}

/** ***Ticked by hand***: a link that does not complete its item — whether, never when (P13-T3 AC-1, parity I-80). */
export function byHandBadge(language: Language = SOURCE_LANGUAGE): BadgeWords {
  const t = wordsIn(language);
  return { glyph: t.byHand, name: t.byHandName, tip: t.byHandTip };
}
