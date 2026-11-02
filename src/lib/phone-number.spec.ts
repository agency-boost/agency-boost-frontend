import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  nationalDigits, normalisedPhone, PHONE_COUNTRY_PREFIX, PHONE_NATIONAL_DIGITS, phoneFieldValue, saveLeadPhone,
  saveMemberPhone, saveMyPhone,
} from './phone-number';

describe('the WhatsApp number (UI V1, UI-081, UI-101; D-22)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['0812-1100-2200', '+6281211002200'],
    ['+62 812 1100 2200', '+6281211002200'],
    ['812 1100 2200', '+6281211002200'],
    ['0062 812.1100.2200', '+6281211002200'],
    ['(0812) 1100 2200', '+6281211002200'],
    ['62812345678', '+62812345678'],
  ])('UI-081 strips a leading 0 / +62, spaces and dashes: %s is %s', (typed, stored) => {
    expect(normalisedPhone(typed)).toBe(stored);
  });

  it.each([
    ['12345678', '8 digits'],
    ['81234567890123', '14 digits'],
    ['0812-abc-2200', 'letters'],
    ['', 'nothing'],
  ])('UI-081 refuses %s (%s): the inline error', (typed) => {
    expect(nationalDigits(typed)).toBeNull();
    expect(normalisedPhone(typed)).toBeNull();
  });

  it('UI-081 9 to 13 digits after +62, the server’s bounds (backend `domain/constants/phone.ts`, metrics §B.28)', () => {
    expect(PHONE_NATIONAL_DIGITS).toEqual({ min: 9, max: 13 });
    expect(nationalDigits('812345678')).toBe('812345678');
    expect(nationalDigits('8123456789012')).toBe('8123456789012');
  });

  it('UI-081 a saved number fills the field after +62', () => {
    expect(phoneFieldValue('+6281211002200')).toBe('81211002200');
    expect(phoneFieldValue(null)).toBe('');
  });

  it('D-22 saves your own (PATCH /auth/me), a member’s (PUT /members/:id/phone) and a lead’s (PATCH /leads/:id)', async () => {
    const { calls } = stubFetch({
      'PATCH /auth/me': { body: {} },
      'PUT /members/m-1/phone': { body: { membershipId: 'm-1', phone: '+6281211002200' } },
      'PATCH /leads/l-1': { body: { id: 'l-1' } },
    });
    await saveMyPhone(null);
    await saveMemberPhone('m-1', '+6281211002200');
    await saveLeadPhone({ id: 'l-1', contact: { phone: null, email: 'a@b.test' }, version: 2 }, '+6281211002200');
    expect(calls.map((c) => [c.init.method, c.url.replace(/^.*\/api\/v1/, '')])).toEqual([
      ['PATCH', '/auth/me'],
      ['PUT', '/members/m-1/phone'],
      ['PATCH', '/leads/l-1'],
    ]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ phone: null });
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ contact: { phone: '+6281211002200', email: 'a@b.test' }, version: 2 });
  });
});

/**
 * **The mirror holds the server's values** (invariant §7): `PHONE_NATIONAL_DIGITS` and `PHONE_COUNTRY_PREFIX` re-declare
 * the backend's (`domain/constants/phone.ts`, metrics §B.28), so this reads that file from disk, as
 * `i18n/glossary.spec.ts` reads the metric registry, and fails the day one side moves without the other.
 */
describe('UI-081 the phone bounds mirror the backend constants', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'phone.ts'), 'utf8',
  );

  it('UI-081 PHONE_NATIONAL_DIGITS is the backend PHONE_NATIONAL_DIGITS', () => {
    const block = /export const PHONE_NATIONAL_DIGITS = \{([\s\S]*?)\} as const;/.exec(source)?.[1] ?? '';
    const min = /\bmin:\s*(\d+)/.exec(block)?.[1];
    const max = /\bmax:\s*(\d+)/.exec(block)?.[1];
    expect(min).toBeDefined();
    expect(max).toBeDefined();
    expect(PHONE_NATIONAL_DIGITS).toEqual({ min: Number(min), max: Number(max) });
  });

  it('UI-081 PHONE_COUNTRY_PREFIX is the backend PHONE_COUNTRY_PREFIX', () => {
    expect(/export const PHONE_COUNTRY_PREFIX = '([^']+)'/.exec(source)?.[1]).toBe(PHONE_COUNTRY_PREFIX);
  });
});
