import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE, figureLanguage, isLanguage, LANGUAGE_COOKIE, LANGUAGE_COOKIE_MAX_AGE, LANGUAGE_LIVE, LANGUAGE_NAMES,
  LANGUAGE_PENDING, LANGUAGE_UNCHOSEN, LANGUAGES, SOURCE_LANGUAGE, unchosenLanguage,
} from './language';

/**
 * **P18.98-T1: the languages, and which one a reader reads** (ADR-0179 §1, §2). `LANGUAGES` and `DEFAULT_LANGUAGE`
 * are read against the backend's own module by `contract.spec.ts`; these pin the frontend's own three.
 */
describe('P18.98-T1 the languages', () => {
  it('AC-1 speaks Bahasa Indonesia and English, Indonesian by default', () => {
    expect([...LANGUAGES]).toEqual(['id', 'en']);
    expect(DEFAULT_LANGUAGE).toBe('id');
  });

  it('AC-1 takes English as the catalogue’s source: its keys, and what a spec reads unless it asks', () => {
    expect(SOURCE_LANGUAGE).toBe('en');
  });

  /*
   * *Changed 2026-10-29 (P18.98-T2):* T2 built the way back, and holds it behind `LANGUAGE_LIVE` until P18.98-T4's exit
   * (below), so a reader who has chosen nothing still reads English: `LANGUAGE_UNCHOSEN` follows the constant.
   */
  it('AC-3 gives a reader who has chosen nothing English until the switch goes live: nobody reads Indonesian unasked', () => {
    expect(LANGUAGE_UNCHOSEN).toBe('en');
    expect(LANGUAGE_UNCHOSEN).toBe(unchosenLanguage(LANGUAGE_LIVE));
  });

  it('AC-3 names the cookie T2 writes, and the attribute that holds a page back for its language', () => {
    expect(LANGUAGE_COOKIE).toBe('ab_lang');
    expect(LANGUAGE_PENDING).toBe('data-lang-pending');
  });

  it('reads a language only from one of the two codes', () => {
    expect(isLanguage('id')).toBe(true);
    expect(isLanguage('en')).toBe(true);
    for (const other of ['fr', 'ID', 'id-ID', 'en-US', '', null, undefined, 1]) expect(isLanguage(other)).toBe(false);
  });
});

/**
 * **P18.98-T2: one constant turns the switch and the Indonesian default on together** (ADR-0179's dated note of
 * 2026-10-29). They go live at P18.98-T4's exit, when the Owner's and the AB's screens read Indonesian; until then no
 * reader is offered a page that is mostly English words under `lang="id"`. **Flipping it is a decision, not a fix**:
 * this spec fails the day it changes, and the change comes with T4's exit and the phase file's note.
 */
describe('P18.98-T2 the live constant', () => {
  it('AC-3 holds the switch back until the Owner’s and the AB’s screens read Indonesian (T4’s exit)', () => {
    expect(LANGUAGE_LIVE).toBe(false);
  });

  it('AC-3 gives a reader who has chosen nothing Indonesian once live, and English until then', () => {
    expect(unchosenLanguage(true)).toBe(DEFAULT_LANGUAGE);
    expect(unchosenLanguage(true)).toBe('id');
    expect(unchosenLanguage(false)).toBe(SOURCE_LANGUAGE);
  });

  it('AC-5 keeps the cookie a year', () => {
    expect(LANGUAGE_COOKIE_MAX_AGE).toBe(31_536_000);
    expect(LANGUAGE_COOKIE_MAX_AGE).toBe(365 * 24 * 60 * 60);
  });

  it('AC-4 names each language in its own words, the same whatever the screen is in', () => {
    expect(LANGUAGE_NAMES).toEqual({ id: 'Bahasa Indonesia', en: 'English' });
    expect(Object.keys(LANGUAGE_NAMES)).toEqual([...LANGUAGES]);
  });
});

/**
 * **P18.98-T3 figures: the language a figure is written in** (ADR-0174, ADR-0179 §1, §6). The reader's chosen
 * language, and with no choice `DEFAULT_LANGUAGE` — whether or not the switch is live — so that until it is, a reader
 * with no choice reads every figure in Indonesian, as before the phase, beside English words; never a wired screen's
 * *IDR 5.8B* beside an unwired one's *Rp 5,8 M* (the client's UI-019).
 */
describe('P18.98-T3 figures the rule', () => {
  it('P18.98-T3 figures are written in the language the reader chose, and in DEFAULT_LANGUAGE, Indonesian, with none', () => {
    expect(figureLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(figureLanguage(null)).toBe('id');
    for (const chosen of LANGUAGES) expect(figureLanguage(chosen)).toBe(chosen);
  });

  it('P18.98-T3 figures wait for no switch: with no choice, words follow LANGUAGE_LIVE and figures do not', () => {
    // Not live: English words, Indonesian figures — the product as it was before the phase.
    expect(unchosenLanguage(false)).toBe('en');
    expect(figureLanguage(null)).toBe('id');
    expect(LANGUAGE_UNCHOSEN).toBe(unchosenLanguage(LANGUAGE_LIVE));
    expect(figureLanguage(null)).not.toBe(LANGUAGE_UNCHOSEN);
  });

  it('P18.98-T3 figures agree with the words once live, in every state: none chosen, or either language chosen', () => {
    expect(figureLanguage(null)).toBe(unchosenLanguage(true));
    // A choice is the words' language and the figures', live or not.
    for (const chosen of LANGUAGES) expect(figureLanguage(chosen)).toBe(chosen);
  });
});
