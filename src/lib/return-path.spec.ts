import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { destinationAfterSignIn, returnPathFrom, signInPathFrom } from './return-path';
import type { Me } from './session';

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

describe('a reader who signed out themselves (2026-10-11)', () => {
  it('is sent to plain sign-in from any page: they are leaving, not on their way back', () => {
    expect(signInPathFrom({ pathname: '/kpm/analytics/compliance', search: '?category=training' }, { signedOut: true }))
      .toBe('/login');
    expect(signInPathFrom({ pathname: '/leader-meetings/shared/abc', search: '' }, { signedOut: true })).toBe('/login');
  });

  it('an involuntary end still carries the page: an expired session, a link opened signed out', () => {
    expect(signInPathFrom({ pathname: '/kpm/analytics/compliance', search: '' }, { signedOut: false }))
      .toBe('/login?next=%2Fkpm%2Fanalytics%2Fcompliance');
  });
});

describe('where the person who just signed in goes (2026-10-11)', () => {
  const member = (over: Partial<NonNullable<Me['membership']>>, permissions: string[]) => makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
    permissions,
  });
  const owner = member({ isKpmOwner: true, directCount: 3 }, ['member:read_profile', 'kpm_analytics:read', 'kpm_overview:read']);
  const agent = member({}, ['member:read_profile', 'leader_meeting:read_shared_link']);
  const leader = member({ directCount: 2 }, ['member:read_profile', 'unit_dashboard:read']);
  const COMPLIANCE = '?next=%2Fkpm%2Fanalytics%2Fcompliance%3Fcategory%3Dtraining%23units';

  it('back to next when they can open it, query and hash kept', () => {
    expect(destinationAfterSignIn(COMPLIANCE, owner)).toBe('/kpm/analytics/compliance?category=training#units');
    expect(destinationAfterSignIn('?next=%2Fleader-meetings%2Fshared%2Fabc', agent)).toBe('/leader-meetings/shared/abc');
  });

  it('to their own landing when they cannot: the reported case, an Agent or a leader after the Owner', () => {
    expect(destinationAfterSignIn(COMPLIANCE, agent)).toBe('/activity/log');
    expect(destinationAfterSignIn(COMPLIANCE, leader)).toBe('/unit/dashboard');
  });

  it('to their own landing with no next, an unsafe one, or one that is no page', () => {
    expect(destinationAfterSignIn('', owner)).toBe('/kpm/overview');
    expect(destinationAfterSignIn('?next=%2F', owner)).toBe('/kpm/overview');
    expect(destinationAfterSignIn('?next=%2F%2Fevil.test%2Fkpm%2Foverview', owner)).toBe('/kpm/overview');
    expect(destinationAfterSignIn('?next=%2Fnope', agent)).toBe('/activity/log');
  });

  it('to sign in when the session could not be read after all', () => {
    expect(destinationAfterSignIn(COMPLIANCE, null)).toBe('/login');
  });
});
