import { afterEach, describe, expect, it } from 'vitest';
import { LANGUAGE_COOKIE, LANGUAGE_PENDING, LANGUAGES } from './language';
import { applyLanguageBeforePaint, PRE_PAINT_SCRIPT } from './pre-paint';

const root = document.documentElement;

/** A cookie on the page, as the browser would hand it to the script. Each test clears its own. */
function cookie(value: string) {
  document.cookie = `${LANGUAGE_COOKIE}=${value}; path=/`;
}

/** The two ways it runs: the function, and the inline script the root layout sends — the same source. */
const RUNS = [
  ['the function', () => applyLanguageBeforePaint(LANGUAGE_COOKIE, LANGUAGE_PENDING, LANGUAGES)],
  // What the browser does with the inline script's text.
  ['the inline script the root layout sends', () => new Function(PRE_PAINT_SCRIPT)()],
] as const;

/**
 * **P18.98-T1 AC-3, AC-4: the language before the body is parsed.** The page is prerendered in one language; the
 * script reads the reader's from the cookie, writes it on `<html lang>`, and holds the page back while it is not the
 * page's, for `LanguageProvider` to write the page in it before the first paint.
 */
describe.each(RUNS)('P18.98-T1 the pre-paint read, by %s', (_, run) => {
  afterEach(() => {
    document.cookie = `${LANGUAGE_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    root.lang = '';
    root.removeAttribute(LANGUAGE_PENDING);
  });

  it('AC-3 takes the cookie’s language, and holds the page back when it is not the page’s', () => {
    root.lang = 'en';
    cookie('id');

    run();

    expect(root.lang).toBe('id');
    expect(root.hasAttribute(LANGUAGE_PENDING)).toBe(true);
  });

  it('AC-3 holds nothing back when the cookie’s language is the page’s', () => {
    root.lang = 'en';
    cookie('en');

    run();

    expect(root.lang).toBe('en');
    expect(root.hasAttribute(LANGUAGE_PENDING)).toBe(false);
  });

  it.each([
    ['no cookie', null],
    ['a language the app does not speak', 'fr'],
    ['a code in another case', 'ID'],
    ['a region’s form', 'id-ID'],
    ['a malformed value', '%E0%A4%A'],
  ])('AC-3 leaves the prerendered page as it is with %s', (_, value) => {
    root.lang = 'en';
    if (value !== null) cookie(value);

    run();

    expect(root.lang).toBe('en');
    expect(root.hasAttribute(LANGUAGE_PENDING)).toBe(false);
  });

  it('reads its own cookie, not one whose name ends the same', () => {
    root.lang = 'en';
    document.cookie = `x${LANGUAGE_COOKIE}=id; path=/`;

    run();

    expect(root.lang).toBe('en');
    document.cookie = `x${LANGUAGE_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});

describe('P18.98-T1 the inline script', () => {
  it('AC-3 calls the function with the app’s own cookie, attribute and languages, reading nothing else', () => {
    expect(PRE_PAINT_SCRIPT.startsWith('(')).toBe(true);
    expect(PRE_PAINT_SCRIPT).toContain(JSON.stringify(LANGUAGE_COOKIE));
    expect(PRE_PAINT_SCRIPT).toContain(JSON.stringify(LANGUAGE_PENDING));
    expect(PRE_PAINT_SCRIPT).toContain(JSON.stringify(LANGUAGES));
  });
});
