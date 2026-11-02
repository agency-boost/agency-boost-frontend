'use client';

import { Field, Select } from '@/components/ui/field';
import { InlineSaveField, useInlineSave } from '@/components/ui/inline-save-status';
import { useChooseLanguage } from '@/i18n/choose-language';
import { isLanguage, LANGUAGE_NAMES, LANGUAGES } from '@/i18n/language';
import { useLanguage, useLanguageChoice, useMessages } from '@/i18n/language-provider';
import { languageMessages } from '@/i18n/messages/language';

/**
 * ***Language* on *Your account*** (ADR-0179 §2; P18.98-T2 AC-4; the product owner's UI-041): *Bahasa Indonesia* or
 * *English*, **the same preference as the *ID | EN* switch** — it shows the language the screen is in, and choosing
 * goes through the same `useChooseLanguage`: the screen changes at once, the browser keeps it, the account saves it.
 *
 * **It saves by itself**, with the inline save's *Saving… → Saved ✓*, or *Couldn't save — retry*, which sends it again
 * (OD-200): the field has no button of its own, and *Save* under *Your details* is not for it.
 *
 * Each option is its language's own name, in its own `lang` (`LANGUAGE_NAMES`). **In a support session it is shown and
 * not offered**, as the rest of *Your details* is, with the same hint (`disabled`, `hint`): the person's language is
 * theirs (ADR-0162 §4), and the switch in the header changes the support person's own screen. **Nothing at all until
 * the switch is live** (`LANGUAGE_LIVE`).
 */
export function LanguageField({ disabled = false, hint }: { disabled?: boolean; hint?: string }) {
  const { live } = useLanguageChoice();
  const language = useLanguage();
  const choose = useChooseLanguage();
  const inline = useInlineSave();
  const t = useMessages(languageMessages);
  if (!live) return null;

  return (
    <InlineSaveField status={inline.statusOf('language')} label={t.language}>
      <Field label={t.language} htmlFor="language" hint={hint}>
        <Select
          id="language"
          value={language}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (isLanguage(next) && next !== language) void inline.save('language', () => choose(next));
          }}
        >
          {LANGUAGES.map((code) => (
            <option key={code} value={code} lang={code}>
              {LANGUAGE_NAMES[code]}
            </option>
          ))}
        </Select>
      </Field>
    </InlineSaveField>
  );
}
