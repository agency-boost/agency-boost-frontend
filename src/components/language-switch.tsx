'use client';

import { useChooseLanguage } from '@/i18n/choose-language';
import { LANGUAGE_NAMES, LANGUAGES } from '@/i18n/language';
import { useLanguage, useLanguageChoice, useMessages } from '@/i18n/language-provider';
import { languageMessages } from '@/i18n/messages/language';
import { cn } from '@/lib/cn';

/**
 * **The *ID | EN* switch** (ADR-0179 §2; P18.98-T2 AC-3; the product owner's UI-041 of 2026-10-27).
 *
 * - **Two options, *ID* and *EN*, each a 44 × 44 px target** at every size, as every target on a phone and a tablet.
 * - **A group named *Language*** (*Bahasa* in ID mode), **the current option pressed** (`aria-pressed`), so a screen
 *   reader says *Language, group — ID, toggle button, pressed*. Each option is its language's code, says its
 *   language's own name as its description (*Bahasa Indonesia*, *English*, `LANGUAGE_NAMES`) and carries its `lang`,
 *   so each is pronounced in its language (WCAG 3.1.2). Two buttons, not tabs or radios: Tab reaches each, and Enter
 *   or Space chooses, as the coaching *Leader view | Agent view* pair does.
 * - **Choosing changes the screen at once**, with no reload and no remount, so an open form keeps what was typed; the
 *   browser keeps it (the `ab_lang` cookie) and, signed in outside a support session, the account does
 *   (`useChooseLanguage`). Pressing the current one does nothing.
 *
 * **Drawn only while the switch is live** (`LANGUAGE_LIVE`, `useLanguageChoice().live`): nothing at all until then.
 *
 * Two tones: `bar`, light on the navy of the phone's bar, the current option amber as the avatar beside it is; `page`,
 * on the page's own ground — a shell's page header and the public pages — the current option navy, as the coaching
 * view switch's is. Its box is exactly the targets', 88 × 44 px, with its edge a ring that takes no room.
 */
export function LanguageSwitch({ tone, className }: { tone: 'bar' | 'page'; className?: string }) {
  const { live } = useLanguageChoice();
  const language = useLanguage();
  const choose = useChooseLanguage();
  const t = useMessages(languageMessages);
  if (!live) return null;

  return (
    <div
      role="group"
      aria-label={t.language}
      data-language-switch={tone}
      className={cn(
        'inline-flex shrink-0 rounded-md print:hidden',
        tone === 'bar' ? 'ring-1 ring-white/15' : 'bg-card ring-1 ring-hairline',
        className,
      )}
    >
      {LANGUAGES.map((code) => {
        const current = code === language;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={current}
            title={LANGUAGE_NAMES[code]}
            onClick={() => {
              if (!current) void choose(code);
            }}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-md text-sm font-bold tracking-wide',
              tone === 'bar'
                ? current ? 'bg-amber text-navy' : 'text-white/[0.78] hover:bg-white/[0.06] hover:text-white'
                : current ? 'bg-navy text-white' : 'text-muted hover:text-navy',
            )}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
