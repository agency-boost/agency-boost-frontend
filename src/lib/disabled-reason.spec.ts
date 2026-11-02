import { describe, expect, it } from 'vitest';
import { heldBecause } from './disabled-reason';

/** P18.95-T7 AC-3 (UI-030): a held button says why, under it. */
describe('heldBecause', () => {
  it('P18.95-T7 AC-3 names what is still empty, in the fields’ own words and order', () => {
    expect(heldBecause({ missing: ['Email'] })).toBe('Still needed: Email.');
    expect(heldBecause({ missing: ['Full name', 'Email'] })).toBe('Still needed: Full name and Email.');
    expect(heldBecause({ missing: ['Full name', 'Gender', 'Email'] })).toBe('Still needed: Full name, Gender and Email.');
  });

  it('P18.95-T7 AC-3 says what to fix once nothing is missing, and nothing when nothing holds it', () => {
    expect(heldBecause({ missing: [], fix: 'Fix the password above.' })).toBe('Fix the password above.');
    expect(heldBecause({ missing: ['Email'], fix: 'Fix the password above.' })).toBe('Still needed: Email.');
    expect(heldBecause({ missing: [] })).toBeNull();
    expect(heldBecause({ missing: [], fix: null })).toBeNull();
  });
});
