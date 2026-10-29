/**
 * **The two languages, and which one a reader reads** (ADR-0179 §1, §2, §8; P18.98-T1 AC-1, AC-3, AC-4).
 *
 * `LANGUAGES` and `DEFAULT_LANGUAGE` are the backend's (`backend/src/domain/constants/language.ts`), mirrored here and
 * read against it by `contract.spec.ts`, so the two cannot drift (invariant §7). Registered in
 * `metrics-and-definitions.md` §B.27.
 */
export const LANGUAGES = ['id', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** A person who has chosen no language reads Bahasa Indonesia (ADR-0179 §1) — live since 2026-10-29 (below). */
export const DEFAULT_LANGUAGE: Language = 'id';

/**
 * **The catalogue's source language: English.** Each module's English messages are the source of its keys, and its
 * Indonesian is typed against them (`catalogue.ts`). It is also what a screen reads **outside a `LanguageProvider`**,
 * which is every spec that does not ask for Indonesian (AC-5): the existing suites keep their assertions.
 */
export const SOURCE_LANGUAGE: Language = 'en';

/**
 * **Whether the language switch and the Indonesian default are live** — the one constant that turns ID mode on for
 * everybody (P18.98-T2; ADR-0179's dated notes of 2026-10-29). **`true` since P18.98-T4's exit (2026-10-29)**, flipped
 * with the backend's (`backend/src/domain/constants/language.ts`), whose `language.spec.ts` reads this one and fails when
 * they differ. The harness can still render either state for a spec (`test/harness.tsx`, `LanguageProvider live`).
 *
 * **Live**, the switch is drawn in every shell's header, on the phone's bar and on the six public pages, with
 * *Language* on *Your account*; a reader who has chosen nothing reads **Bahasa Indonesia**, words and figures; and a
 * choice — an account's saved `users.locale` or the browser's `ab_lang` cookie — is honoured, words and figures alike.
 *
 * **Before it went live** (`false`, P18.98-T2 to T4's exit) no switch and no *Language* were drawn, so nobody was
 * offered a half-translated screen; a reader who had chosen nothing read English words (`LANGUAGE_UNCHOSEN`) and
 * Indonesian figures (`figureLanguage`), every screen as it was before the phase; and a choice made outside the product
 * was honoured, which is how T4 to T6 checked their translations on staging. `unchosenLanguage(false)` still answers
 * that state, and its specs pin it.
 */
export const LANGUAGE_LIVE: boolean = true;

/** **The words a reader who has chosen nothing reads**: Bahasa Indonesia when the switch is live — as it is since
 * P18.98-T4's exit — and English when it is not. */
export function unchosenLanguage(live: boolean): Language {
  return live ? DEFAULT_LANGUAGE : SOURCE_LANGUAGE;
}

/**
 * **The language a figure is written in** — a date, a time, a number, a percentage, a sum (P18.98-T3; ADR-0174,
 * ADR-0179 §1, §6): **the reader's chosen language, and with no choice `DEFAULT_LANGUAGE`, Bahasa Indonesia — whether
 * or not the switch is live.** `chosen` is the language the reader chose, by the cookie, on the switch or on their
 * account, or `null` for none. It takes no `live`, because nothing about a figure waits for the switch.
 *
 * A reader's **words** with no choice are `unchosenLanguage(LANGUAGE_LIVE)`: Bahasa Indonesia, live since 2026-10-29.
 * **Live, the two agree in every state**: with no choice both are Indonesian, and with one both are the one chosen.
 * Before the release such a reader read English words and Indonesian figures — every screen as it was before the
 * phase, never a wired screen's *IDR 5.8B* beside an unwired one's *Rp 5,8 M* (the client's UI-019). A screen reads it through
 * `useFigureLanguage()` (`language-provider.tsx`).
 */
export function figureLanguage(chosen: Language | null): Language {
  return chosen ?? DEFAULT_LANGUAGE;
}

/**
 * **The words a reader who has chosen no language reads today: `unchosenLanguage(LANGUAGE_LIVE)` — Bahasa Indonesia**,
 * `'id'`, live since 2026-10-29.
 *
 * The product's default is Indonesian (`DEFAULT_LANGUAGE`), and it has been the answer here since the *ID | EN* switch
 * went live (above). Before then it was English, while the screens' words were still being moved, so nobody read
 * Indonesian words unless they chose them; their figures were Indonesian meanwhile (`figureLanguage`).
 *
 * It is also **the language the prerendered pages are written in**: the server renders in it, the first client render
 * matches it, and `<html lang>` starts from it (`app/layout.tsx`).
 */
export const LANGUAGE_UNCHOSEN: Language = unchosenLanguage(LANGUAGE_LIVE);

/**
 * **Each language by its own name** — *Bahasa Indonesia*, *English* — the same whatever the screen's language, as a
 * language picker writes them, so a reader finds their own whichever they are reading (an autonym). Drawn with its own
 * `lang`, so a screen reader says each in its language (WCAG 3.1.2). In the glossary for approval's §B.10.
 */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = { id: 'Bahasa Indonesia', en: 'English' };

/** Whether a value is one of the two languages — how a cookie, an attribute or a stored choice is read. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * **The language cookie** (ADR-0179 §2; P18.98-T2 AC-5, `language-cookie.ts` writes it): `id` or `en`, a year,
 * `SameSite=Lax`, not `HttpOnly`, because the page reads it before it paints (`pre-paint.ts`). It carries the language
 * where nobody is signed in, and to the next sign-in.
 */
export const LANGUAGE_COOKIE = 'ab_lang';

/** How long the cookie lasts: a year, in seconds (`Max-Age`). */
export const LANGUAGE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * **A page held back for its language**: set on `<html>` before the body is parsed when the reader's language is not
 * the one the page was prerendered in, and cleared by `LanguageProvider` once the page reads in theirs. `globals.css`
 * hides the page while it is set, so no word paints in the wrong language (AC-3).
 */
export const LANGUAGE_PENDING = 'data-lang-pending';
