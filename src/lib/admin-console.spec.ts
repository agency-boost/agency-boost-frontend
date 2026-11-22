import { describe, expect, it } from 'vitest';
import { DASHBOARD } from '@test/console-fixtures';
import { countsFor, issueTarget, kpmInitials, needsAction, sumUsage, toneOf, wholePct } from './admin-console';

describe('P19.23 the console’s rules in the app (ADR-0277)', () => {
  const scale = DASHBOARD.scale;

  it('P19.23-T1 AC-4 the colour scale is the server’s: green from 80, yellow from 50, red below', () => {
    expect([100, 80, 79, 50, 49, 0].map((p) => toneOf(p, scale))).toEqual(['green', 'green', 'amber', 'amber', 'red', 'red']);
    // Read from the answer, never re-declared: a scale of 90 / 60 moves the pills with it.
    expect(toneOf(85, { greenFromPct: 90, yellowFromPct: 60 })).toBe('amber');
  });

  it('P19.23-T1 AC-4 Semua is Leader plus Agent; a company is its KPMs added up', () => {
    const bsd = DASHBOARD.kpms[0];
    expect(countsFor(bsd.usage, 'all')).toEqual({ members: 30, everUsed: 26, used14: 17, powerUsers: 6 });
    expect(countsFor(bsd.usage, 'leader')).toBe(bsd.usage.leader);
    expect(sumUsage(DASHBOARD.kpms.filter((k) => k.companyId === bsd.companyId)).leader.members).toBe(11);
  });

  it('P19.23-T1 AC-4 a share is whole, half up, and 0 of nobody', () => {
    expect(wholePct(17, 30)).toBe(57);
    expect(wholePct(1, 8)).toBe(13);
    expect(wholePct(0, 0)).toBe(0);
  });

  it('P19.23-T2 AC-1 Perlu tindakan: the four action issues, never a suspended KPM’s state', () => {
    expect(DASHBOARD.kpms.filter(needsAction).map((k) => k.code)).toEqual(['0555', '1234', '0701']);
  });

  it('P19.23-T1 AC-3 where each issue is acted on: an owner page inside the KPM, Langganan, or the invitation button', () => {
    expect(issueTarget('no_members')).toEqual({ inside: true, href: '/people/import' });
    expect(issueTarget('data_missing')).toEqual({ inside: true, href: '/kpm/data-upload' });
    expect(issueTarget('subscription_ended')).toEqual({ inside: false, href: '/admin/billing' });
    expect(issueTarget('owner_not_invited')).toBeNull();
  });

  it('P19.23-T2 AC-1 a KPM’s initials: the first letters of its first two words', () => {
    expect(kpmInitials('BSD City Branch')).toBe('BC');
    expect(kpmInitials('Magni')).toBe('M');
    expect(kpmInitials('  ')).toBe('?');
  });
});
