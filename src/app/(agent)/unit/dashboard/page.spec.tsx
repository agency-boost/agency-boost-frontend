import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import UnitDashboardPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/unit/dashboard',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-aab', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
});

/**
 * A leader's roster is a sign until it is built (P10.1-T2, the client's request of 2026-10-01). Its
 * nav item is *Upcoming*, so only a typed URL lands here; what it must be is the prototype's title, the
 * state heard first, and a signpost to what a leader can already do for their unit.
 */
describe('Unit Dashboard, a sign', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is titled as the prototype titles it, with the prototype’s empty sub-line', () => {
    // `Overall.html:10410`: `dashboard: { title: 'Unit Dashboard', sub: '' }`, the nav item's name too.
    stubFetch({});
    renderWithSession(<UnitDashboardPage />, { me: LEADER });

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(/^Unit Dashboard$/);
    expect(title.nextElementSibling).toBeNull();
  });

  it('is a region named by the pill and what will be there, with no figure and no call', () => {
    const { calls } = stubFetch({});
    const { container } = renderWithSession(<UnitDashboardPage />, { me: LEADER });

    const sign = screen.getByRole('region', { name: /^Upcoming Everyone in your unit in one table/ });
    expect(within(sign).getByRole('heading', { level: 2 })).toHaveTextContent(/^Everyone in your unit/);
    expect(container.textContent).not.toMatch(/\d|phase/i);
    expect(calls).toEqual([]);
  });

  it('sends a leader on to what works for their unit today', () => {
    stubFetch({});
    renderWithSession(<UnitDashboardPage />, { me: LEADER });

    expect(screen.getByRole('link', { name: 'Group tree' })).toHaveAttribute('href', '/group-tree');
    expect(screen.getByRole('link', { name: 'Leads management' })).toHaveAttribute('href', '/leads');
    expect(screen.getByRole('link', { name: 'Pending Requests' })).toHaveAttribute('href', '/user-management/pending');
  });
});
