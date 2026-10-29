import { isLanguage, LANGUAGE_COOKIE, LANGUAGE_COOKIE_MAX_AGE, type Language } from './language';

/**
 * **The browser's language, kept for a year** (ADR-0179 §2; P18.98-T2 AC-5).
 *
 * `ab_lang=id` or `ab_lang=en`: the whole site (`Path=/`), a year (`Max-Age`), `SameSite=Lax`, and **not `HttpOnly`**,
 * because the page itself reads it before it paints (`pre-paint.ts`). `Secure` wherever the page is served over HTTPS.
 * It holds a language and nothing else — nothing about who is signed in — so script reading it is harmless.
 *
 * Written whenever the reader chooses (the switch, *Language* on *Your account*), signed in or not, and at sign-in when
 * the account's saved language wins over it. Never written for an account with no choice: the browser keeps its own.
 */
export function writeLanguageCookie(language: Language): void {
  try {
    document.cookie = languageCookieFor(language, window.location.protocol === 'https:');
  } catch {
    // A browser that refuses cookies: the screen still switches, and the choice lasts as long as the page.
  }
}

/** The cookie as it is set — what `writeLanguageCookie` hands the browser, over HTTPS (`secure`) or not. */
export function languageCookieFor(language: Language, secure: boolean): string {
  return `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The language the cookie holds, or `null` for none, or for a value that is not one of the two. */
export function readLanguageCookie(): Language | null {
  try {
    const found = new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]*)`).exec(document.cookie);
    const value = found ? decodeURIComponent(found[1]) : null;
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}
