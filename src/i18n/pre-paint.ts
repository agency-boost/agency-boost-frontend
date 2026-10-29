import { LANGUAGE_COOKIE, LANGUAGE_PENDING, LANGUAGES } from './language';

/**
 * **The reader's language, before the body is parsed** (ADR-0179 §2, §8; P18.98-T1 AC-3, AC-4).
 *
 * Every page but the dynamic ones is prerendered once, in `LANGUAGE_UNCHOSEN`, so the HTML cannot know who reads it;
 * reading the cookie in the root layout instead (`cookies()`) would make every route dynamic. So the root layout runs
 * this inline, first thing in `<head>`: it reads the language cookie (`ab_lang`, written from P18.98-T2) and, where
 * the reader's language is not the page's, **writes it on `<html lang>` and holds the page back**
 * (`LANGUAGE_PENDING`; `globals.css` hides it) until `LanguageProvider` has rendered the page in theirs, before the
 * first paint after hydration. A reader whose language is the page's — everybody, until T2 writes a cookie — pays
 * nothing.
 *
 * **Sent as its own source** (`PRE_PAINT_SCRIPT`), so it reads nothing outside itself: everything arrives as an
 * argument. A malformed cookie or a refused `document.cookie` leaves the page as prerendered.
 */
export function applyLanguageBeforePaint(cookieName: string, pending: string, languages: readonly string[]): void {
  try {
    const root = document.documentElement;
    const found = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`).exec(document.cookie);
    const chosen = found ? decodeURIComponent(found[1]) : '';
    if (languages.indexOf(chosen) < 0 || chosen === root.lang) return;
    root.setAttribute(pending, '');
    root.lang = chosen;
  } catch {
    // Never a reason for a page not to show: the prerendered language stands.
  }
}

/** The inline script the root layout puts first in `<head>`: the function above, called with the app's names. */
export const PRE_PAINT_SCRIPT = `(${applyLanguageBeforePaint.toString()})(${JSON.stringify(LANGUAGE_COOKIE)},${JSON.stringify(LANGUAGE_PENDING)},${JSON.stringify(LANGUAGES)});`;
