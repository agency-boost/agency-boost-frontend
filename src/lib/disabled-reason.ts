import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { uiMessages } from '@/i18n/messages/ui';

/**
 * **Why a form's one button is held, said under it** (P18.95-T7 AC-3; the client's UI review of 2026-10-26, UI-030).
 * *Create account* on `/register` and *Change password* on `/profile` were drawn disabled with nothing to say why, and
 * on a phone the field still empty was a screen away. The hint names what is missing, in the fields' own labels, or
 * what is wrong where a field says so already; `null` while there is nothing to say — the button is live, or busy.
 *
 * Only words: each form decides what it waits for, as it decided before, and the server refuses what it would refuse
 * whatever the hint says. **In the words' `language`**, last (P18.98-T4, the shared pieces: `uiMessages.stillNeeded`),
 * English when none is passed; the labels and `fix` are the form's, in the same language.
 */
export function heldBecause({
  missing,
  fix,
}: {
  /** The labels of the fields still empty, in the form's order. */
  missing: readonly string[];
  /** What to fix where nothing is missing but a field says it is wrong — its own error stays under it. */
  fix?: string | null;
}, language: Language = SOURCE_LANGUAGE): string | null {
  if (missing.length > 0) return messagesIn(uiMessages, language).stillNeeded({ fields: missing });
  return fix ?? null;
}
