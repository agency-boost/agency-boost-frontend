import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import type { OverviewRecruitment } from '@/lib/kpm-overview';
import { Recruitment } from './recruitment';

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm_overview:read'],
});

const recruitment = (closedLastMonth: number | null): OverviewRecruitment => ({
  expectedToClose: 3, pipelineNow: 12, closedLastMonth, target: null, targetMonth: '2026-11',
});

/** The tile that holds a value: *Recruitment last month*'s label (P19.3-T2, its name since T1's AC-3), then its figure. */
const lastMonthTile = () => screen.getByText('Recruitment last month').parentElement!;

describe('the Overview’s Recruitment last month (P19.3-T1 AC-3; ADR-0200 §5, D2)', () => {
  it('P19.3-T1 AC-3 draws the upload’s figure for last month, nought included', () => {
    renderWithSession(<Recruitment recruitment={recruitment(4)} month="2026-11" />, { me: OWNER });
    expect(lastMonthTile()).toHaveTextContent('4');
    renderWithSession(<Recruitment recruitment={recruitment(0)} month="2026-11" />, { me: OWNER });
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('P19.3-T1 AC-3 a month not uploaded reads –, never a blank and never 0', () => {
    renderWithSession(<Recruitment recruitment={recruitment(null)} month="2026-11" />, { me: OWNER });
    expect(lastMonthTile()).toHaveTextContent('–');
    expect(lastMonthTile()).not.toHaveTextContent('0');
  });
});
