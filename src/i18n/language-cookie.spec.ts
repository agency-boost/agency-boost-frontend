import { afterEach, describe, expect, it, vi } from 'vitest';
import { languageCookie } from '@test/harness';
import { LANGUAGE_COOKIE } from './language';
import { languageCookieFor, readLanguageCookie, writeLanguageCookie } from './language-cookie';

/**
 * **P18.98-T2 AC-5: the language cookie** (ADR-0179 §2). `ab_lang` holds `id` or `en`, lasts a year, is
 * `SameSite=Lax`, and is not `HttpOnly`, because the page reads it before it paints (`pre-paint.ts`).
 */
describe('P18.98-T2 AC-5 the language cookie', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC-5 is set for the whole site, for a year, SameSite=Lax, and never HttpOnly: the page reads it', () => {
    const set = languageCookieFor('en', false);

    expect(set).toBe('ab_lang=en; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(set).not.toMatch(/HttpOnly/i);
  });

  it('AC-5 is Secure wherever the page is served over HTTPS', () => {
    expect(languageCookieFor('id', true)).toBe('ab_lang=id; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
  });

  it('AC-5 is written where the page can read it again, and read back as one of the two languages', () => {
    writeLanguageCookie('id');
    expect(languageCookie()).toBe('id');
    expect(readLanguageCookie()).toBe('id');

    writeLanguageCookie('en');
    expect(languageCookie()).toBe('en');
    expect(readLanguageCookie()).toBe('en');
  });

  it.each([
    ['no cookie', null],
    ['a language the app does not speak', 'fr'],
    ['a malformed value', '%E0%A4%A'],
  ])('reads %s as no language', (_, value) => {
    if (value !== null) document.cookie = `${LANGUAGE_COOKIE}=${value}; Path=/`;
    expect(readLanguageCookie()).toBeNull();
  });

  it('never stops a choice when the browser refuses cookies: the screen switches all the same', () => {
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('cookies are switched off');
    });
    expect(() => writeLanguageCookie('en')).not.toThrow();
  });
});
