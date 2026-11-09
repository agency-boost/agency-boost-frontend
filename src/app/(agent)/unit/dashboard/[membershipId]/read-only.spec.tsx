import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import { AGUS_ME, SARI_UNIT } from '@test/unit-dashboard-fixtures';
import UnitBelowPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/unit/dashboard/mem-sari',
  useSearchParams: () => new URLSearchParams(''),
}));

/** The Owner, who holds every write the dashboard offers — and reads another leader's unit read-only. */
const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 5,
  },
  permissions: ['unit_dashboard:read', 'unit_dashboard:read_potensi', 'unit_dashboard:update_production', 'member:invite'],
});

/** As the server answers the Owner's `for=`: drawn as Sari sees it, read-only, no save offered. */
const READ_ONLY = { ...SARI_UNIT, readOnly: true, production: { ...SARI_UNIT.production, canUpdate: false } };

function open(body = READ_ONLY, me = OWNER) {
  atWidth(1280);
  const stub = stubFetch({ 'GET /unit/dashboard': { body }, 'PATCH /unit/dashboard/production': { body: { updated: 1, state: { revision: 8, locked: false } } } });
  renderWithSession(<UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />, { me });
  return stub;
}

/**
 * **A leader's Unit Dashboard, read-only for the Owner and an Admin** (P19.3-T3 AC-3; UI-152's Appendix D row): opened
 * from KPM Analytics' leader sheet in the same tab, drawn as that leader sees it, with no write control — and the
 * server refuses the save that names it (`kpm-analytics.leaders.int.spec.ts`).
 */
describe('P19.3-T3 AC-3 the office’s read-only Unit Dashboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.3-T3 AC-3 draws Sari’s unit as she sees it, with no Update production and no + Add agent', async () => {
    open();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Sari Wulandari’s Unit Dashboard');
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
  });

  it('P19.3-T3 AC-3 follows the server’s readOnly even where the grant would offer the writes', async () => {
    // `canUpdate` true from a server that has not caught up: `readOnly` still keeps the save off the screen.
    open({ ...SARI_UNIT, readOnly: true });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
  });

  it('P19.3-T3 AC-3 a leader on a unit below their own keeps their save, and sends whose unit it is (for)', async () => {
    const leader = makeMe({ ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'unit_dashboard:update_production'] });
    const { calls } = open({ ...SARI_UNIT, readOnly: false }, leader);
    await userEvent.click(await screen.findByRole('button', { name: 'Update production' }));
    const box = (await screen.findAllByRole('textbox'))[0];
    await userEvent.clear(box);
    await userEvent.type(box, '12000000');
    await userEvent.click(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init.body))).toMatchObject({ for: 'mem-sari' });
  });
});
