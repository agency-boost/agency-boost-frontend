import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The language switch's own words** (P18.98-T2; ADR-0179 §2): the *ID | EN* switch in every shell's header, on the
 * phone's bar and on the six public pages (`components/language-switch.tsx`), and *Language* on *Your account*.
 *
 * **Not here: the options' names.** *ID* and *EN* are the languages' codes, and *Bahasa Indonesia* and *English* each
 * language's name for itself (`LANGUAGE_NAMES`, `i18n/language.ts`): the same whatever the screen's language, as a
 * language picker writes them, each drawn with its own `lang`.
 *
 * *Language* → *Bahasa* is not in the approved glossary: it is in the glossary for approval's §B.10, for the product
 * owner, before the switch goes live (`LANGUAGE_LIVE`).
 *
 * @moved components/language-switch.tsx
 * @moved components/language-field.tsx
 * @moved components/public-title.tsx
 */
const en = {
  /** The switch's group, as a screen reader names it — *Language, group* — and the field on *Your account* (§B.10). */
  language: 'Language',
};

const id: MessagesOf<typeof en> = {
  language: 'Bahasa',
};

export const languageMessages = defineMessages({ en, id });
