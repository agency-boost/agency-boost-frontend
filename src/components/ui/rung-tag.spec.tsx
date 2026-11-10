import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SEEDED_LADDER } from '@/components/ui/role-badge';
import type { OrgLevel } from '@/lib/tenant-config-cache';
import { isLeaderRung, RungTag } from './rung-tag';

/**
 * **P19.11-T6 AC-4 — one rule for the level tag** (UX-16, UXQ10): `RungTag` is drawn for a leader's rung alone, and
 * `isLeaderRung` decides it from the company's ladder — its leader tier (ADR-0156 §2) — never from the word *Agent*.
 */
const COMPANY: OrgLevel[] = [
  { orgLevelId: 'l-bp', companyId: 'c-1', code: 'BP', label: 'Business Partner', displayOrder: 1, leaderTier: null, status: 'active' },
  { orgLevelId: 'l-abp', companyId: 'c-1', code: 'ABP', label: 'Associate BP', displayOrder: 2, leaderTier: 'associate', status: 'active' },
  { orgLevelId: 'l-sbp', companyId: 'c-1', code: 'SBP', label: 'Senior BP', displayOrder: 3, leaderTier: 'senior', status: 'active' },
];

describe('P19.11-T6 AC-4 isLeaderRung', () => {
  it.each([
    ['AB', true], ['AAB', true], ['AGENT', false],
  ])('P19.11-T6 AC-4 on the seeded ladder %s is a leader’s rung: %s', (code, leader) => {
    expect(isLeaderRung({ code }, SEEDED_LADDER)).toBe(leader);
  });

  it.each([
    ['SBP', true], ['ABP', true], ['BP', false],
  ])('P19.11-T6 AC-4 on a company’s own ladder %s reads by its leader tier: %s', (code, leader) => {
    expect(isLeaderRung({ code }, COMPANY)).toBe(leader);
  });

  it('P19.11-T6 AC-4 a code is matched whatever its case', () => {
    expect(isLeaderRung({ code: 'aab' }, SEEDED_LADDER)).toBe(true);
    expect(isLeaderRung({ code: 'sbp' }, COMPANY)).toBe(true);
  });

  it('P19.11-T6 AC-4 a rung missing from the ladder reads by its code, as classOfRung reads one from before the tier', () => {
    expect(isLeaderRung({ code: 'AB' }, COMPANY)).toBe(true);
    expect(isLeaderRung({ code: 'AAB' }, [])).toBe(true);
    expect(isLeaderRung({ code: 'AGENT' }, COMPANY)).toBe(false);
    expect(isLeaderRung({ code: 'XYZ' }, COMPANY)).toBe(false);
  });

  it('P19.11-T6 AC-4 a rung on the ladder with no tier recorded reads by its code too', () => {
    const untiered: OrgLevel[] = [{ orgLevelId: 'x', companyId: 'c', code: 'AAB', label: 'AAB', displayOrder: 1, status: 'active' }];
    expect(isLeaderRung({ code: 'AAB' }, untiered)).toBe(true);
  });
});

describe('P19.11-T6 RungTag', () => {
  it('P19.11-T6 AC-4 prints the company’s short name on navy, by its code', () => {
    render(<RungTag rung={{ code: 'SBP', label: 'Senior BP' }} className="mr-1.5" />);
    const tag = screen.getByText('SBP');
    expect(tag).toHaveAttribute('data-rung-tag', 'SBP');
    expect(tag).toHaveClass('bg-secondary', 'text-secondary-contrast', 'normal-case', 'mr-1.5');
  });
});
