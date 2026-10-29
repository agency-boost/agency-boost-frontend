'use client';

import { useCallback, useContext } from 'react';
import { api } from '@/lib/api-client';
import { SessionContext } from '@/lib/session';
import type { Language } from './language';
import { useLanguageChoice } from './language-provider';

/** **Saves the reader's language on their account**: `PATCH /auth/me` with `locale` alone (P18.98-T2 AC-1). */
export async function saveAccountLanguage(language: Language): Promise<void> {
  await api('/auth/me', { method: 'PATCH', body: { locale: language } });
}

/**
 * **Choosing a language, as the switch and *Your account* do** (ADR-0179 §2; P18.98-T2 AC-2, AC-3, AC-4).
 *
 * The screen changes at once and the browser keeps it (`choose`: the cookie, the API's next request). Then, **signed in
 * and not in a support session**, the account is told too, so the choice follows the person to every device. Answers
 * whether everything it had to save landed — the cookie alone, signed out or in a support session, always does — which
 * *Your account* shows as *Saving… → Saved ✓* or *Couldn't save — retry* (OD-200).
 *
 * **The session is not read again afterwards.** `PATCH /auth/me` answers the account as it now is, and replacing the
 * session with it would hand every screen a new `me`: *Your details* refills its boxes from it, and would drop what
 * somebody had typed (AC-3). Nothing on a screen reads `user.locale`; the language is the provider's.
 *
 * **In a support session it writes the support person's browser only**: the person's account is theirs, and the API
 * refuses the write there anyway (`403 PERM_DENIED`, ADR-0162 §4).
 */
export function useChooseLanguage(): (language: Language) => Promise<boolean> {
  const { choose } = useLanguageChoice();
  const me = useContext(SessionContext)?.me ?? null;
  const toAccount = me !== null && !me.isImpersonating;

  return useCallback(async (language: Language) => {
    choose(language);
    if (!toAccount) return true;
    try {
      await saveAccountLanguage(language);
      return true;
    } catch {
      return false;
    }
  }, [choose, toAccount]);
}
