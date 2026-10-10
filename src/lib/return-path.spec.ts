import { describe, expect, it } from 'vitest';
import { returnPathFrom, signInPathFrom } from './return-path';

describe('where sign-in returns to (P18.1-T3 AC-2)', () => {
  it('returns to the page that sent the reader to sign in, its query and hash kept', () => {
    expect(returnPathFrom('?next=%2Fleader-meetings%2Fshared%2Fabc')).toBe('/leader-meetings/shared/abc');
    expect(returnPathFrom('?next=/leader-meetings')).toBe('/leader-meetings');
    expect(returnPathFrom('?next=%2Fkpm%2Fanalytics%3Fperiod%3Dprevious_month%23units'))
      .toBe('/kpm/analytics?period=previous_month#units');
  });

  it('falls back to / with no next, an empty one, or one that is not a path in this app', () => {
    expect(returnPathFrom('')).toBe('/');
    expect(returnPathFrom('?next=')).toBe('/');
    expect(returnPathFrom('?next=https://evil.test/x')).toBe('/');
    expect(returnPathFrom('?next=//evil.test/x')).toBe('/');
    expect(returnPathFrom('?next=leader-meetings')).toBe('/');
  });

  it('refuses what the URL parser would turn into another host: a backslash, a tab, a line break', () => {
    // Each of these passes a "starts with / and not //" check, and each resolves to evil.test in a browser.
    for (const sneaky of ['%2F%5Cevil.test', '%2F%09%2Fevil.test', '%2F%0A%2Fevil.test', '%2F%0D%2Fevil.test', '%2F%00%2Fevil.test', '%2F..%2F%2Fevil.test', '%2F.%2F%2Fevil.test']) {
      expect(returnPathFrom(`?next=${sneaky}`)).toBe('/');
    }
  });
});

describe('where a signed-out reader is sent (P18.1-T3 AC-2)', () => {
  it('to sign in, carrying the page they were on', () => {
    expect(signInPathFrom({ pathname: '/kpm/analytics', search: '?period=previous_month' }))
      .toBe('/login?next=%2Fkpm%2Fanalytics%3Fperiod%3Dprevious_month');
    expect(returnPathFrom('?next=%2Fkpm%2Fanalytics%3Fperiod%3Dprevious_month')).toBe('/kpm/analytics?period=previous_month');
  });

  it('to plain sign-in from the home page or the sign-in page itself', () => {
    expect(signInPathFrom({ pathname: '/', search: '' })).toBe('/login');
    expect(signInPathFrom({ pathname: '/login', search: '?next=%2Fx' })).toBe('/login');
  });
});
