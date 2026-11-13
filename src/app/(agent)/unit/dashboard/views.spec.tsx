import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { activities, AGUS_ME, dashboard, RATIOS, SARI_UNIT } from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView, UnitInformal } from '@/lib/unit-dashboard';
import UnitBelowPage from './[membershipId]/page';
import UnitDashboardPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const ALL_THREE = { offered: ['direct', 'informal', 'downline'], default: 'direct' } as const;
const KEY = 'ab.unit.scope.mem-agus';

/** The Owner on her own dashboard: `member:tag_group`, the office's grant. */
const OWNER_ME = makeMe({
  ...AGUS_ME,
  membership: { ...AGUS_ME.membership!, isKpmOwner: true },
  permissions: [...AGUS_ME.permissions, 'member:tag_group', 'unit_dashboard:read_potensi'],
});
const LEADER_ME = makeMe({ ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'unit_dashboard:read_potensi'] });

const INFORMAL: UnitInformal = {
  groups: [{ groupId: 'g-top', name: 'Top Producers 2026' }],
  absNotInGroup: 3,
  abs: [
    { membershipId: 'mem-maya', name: 'Maya Halim' },
    { membershipId: 'mem-satria', name: 'Satria Nugraha' },
    { membershipId: 'mem-yosef', name: 'Yosef Tambunan' },
  ],
  canTag: true,
};

/** The dashboard as the server answers a view: the one answered, those offered, and the line in *Grup informal*. */
const viewed = (scope: UnitDashboardView['scope'], over: Partial<UnitDashboardView> = {}) =>
  dashboard({ scope, scopes: { ...ALL_THREE, offered: [...ALL_THREE.offered] }, informal: scope === 'informal' ? INFORMAL : null, ...over });

/** Each read answered as the view it asked for — `direct` without one. */
const byScope: StubReply = ({ url }) => {
  const scope = (new URL(url).searchParams.get('scope') ?? 'direct') as UnitDashboardView['scope'];
  return { body: viewed(scope) };
};

const POTENSI = {
  month: '2026-10', currentMonth: '2026-10', today: '2026-10-08',
  head: { membershipId: 'mem-agus', name: 'Agus Santoso', isReader: true },
  tiles: { aa: 0, rekrut: 0, potensi: { aa: 0, rekrut: 0 } },
  units: [{
    kind: 'direct', leader: { membershipId: 'mem-agus', name: 'Agus Santoso', rung: { code: 'AB', label: 'AB' } },
    people: [{
      membershipId: 'mem-agus', name: 'Agus Santoso', photoUrl: null, rung: { code: 'AB', label: 'AB' }, isLeader: true,
      isReader: true, opens: true, aa: { potensi: 0, aa: false, switched: 0 }, rekrut: { potensi: 0, rekrut: 0, switched: 0 },
    }],
    totals: { aa: { potensi: 0, aa: 0, switchedPeople: 0, switchedPeopleAa: 0 }, rekrut: { potensi: 0, rekrut: 0, switchedPeople: 0, switchedPeopleRekrut: 0 } },
  }, {
    kind: 'unled', leader: null,
    people: [{
      membershipId: 'mem-nora', name: 'Nora Siregar', photoUrl: null, rung: { code: 'AGENT', label: 'Agent' }, isLeader: false,
      isReader: false, opens: false, aa: { potensi: 0, aa: false, switched: 0 }, rekrut: { potensi: 0, rekrut: 0, switched: 0 },
    }],
    totals: { aa: { potensi: 0, aa: 0, switchedPeople: 0, switchedPeopleAa: 0 }, rekrut: { potensi: 0, rekrut: 0, switchedPeople: 0, switchedPeopleRekrut: 0 } },
  }],
  scope: 'downline', scopes: { offered: ['direct', 'informal', 'downline'], default: 'downline' }, informal: null,
};

function render(
  { me = LEADER_ME, search = '', routes = {} }: { me?: ReturnType<typeof makeMe>; search?: string; routes?: Record<string, StubReply | StubReply[]> } = {},
) {
  nav.search = search;
  const stub = stubFetch({
    'GET /unit/dashboard': byScope, '/activity/ratios': { body: RATIOS },
    'GET /unit/dashboard/activities': { body: activities() }, 'GET /unit/dashboard/potensi': { body: POTENSI }, ...routes,
  });
  renderWithSession(<UnitDashboardPage />, { me });
  return stub;
}
const reads = (calls: { url: string }[]) => calls.map((c) => c.url).filter((u) => /\/unit\/dashboard(\?|$)/.test(u));
const picker = () => screen.queryByRole('button', { name: /^View / });

/**
 * **The Unit Dashboard's three views** (P19.12-T6; the client's message of 11 November 2026, items 5 and 7; ADR-0249):
 * the picker beside the period on *Overview* and the month on *Potensi*, never on *Aktivitas*; only the views offered,
 * hidden with one; the address's choice, then the browser's for the reader's own dashboard, then the server's default;
 * *Grup informal*'s line and *+ Tambah ke grup*.
 */
describe('P19.12-T6 the Unit Dashboard’s views', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    try { window.localStorage.clear(); } catch { /* none */ }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('P19.12-T6 AC-2 the picker beside the period, the views the server offers in order; a choice reads it, into the address and kept', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'View Direct group' }));
    const menu = screen.getByRole('listbox', { name: 'View' });
    expect(within(menu).getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim()))
      .toEqual(['Direct group', 'Informal group', 'All downline']);
    await userEvent.click(within(menu).getByRole('option', { name: 'All downline' }));
    expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard?scope=downline', { scroll: false });
    await waitFor(() => expect(reads(calls)).toContain('http://api.test/api/v1/unit/dashboard?period=month&scope=downline'));
    expect(window.localStorage.getItem(KEY)).toBe('downline');
  });

  it('P19.12-T6 AC-2 one view offered — an AAB with no AB below — draws no picker', async () => {
    render({ routes: { 'GET /unit/dashboard': { body: dashboard() } } });
    await screen.findByRole('table', { name: 'Your team’s roster' });
    expect(picker()).toBeNull();
  });

  it('P19.12-T6 AC-2 only the views offered: the Admin above nobody is offered two', async () => {
    render({ routes: { 'GET /unit/dashboard': { body: viewed('downline', { scopes: { offered: ['informal', 'downline'], default: 'downline' } }) } } });
    await userEvent.click(await screen.findByRole('button', { name: 'View All downline' }));
    expect(within(screen.getByRole('listbox', { name: 'View' })).getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim()))
      .toEqual(['Informal group', 'All downline']);
  });

  it('P19.12-T6 AC-3 the address first: ?scope= is read even with another view kept', async () => {
    window.localStorage.setItem(KEY, 'informal');
    const { calls } = render({ search: 'scope=downline' });
    await screen.findByRole('button', { name: 'View All downline' });
    expect(reads(calls)).toEqual(['http://api.test/api/v1/unit/dashboard?period=month&scope=downline']);
  });

  it('P19.12-T6 AC-3 then the view last chosen on this browser, then the server’s default', async () => {
    window.localStorage.setItem(KEY, 'informal');
    const kept = render();
    await screen.findByRole('button', { name: 'View Informal group' });
    expect(reads(kept.calls)).toEqual(['http://api.test/api/v1/unit/dashboard?period=month&scope=informal']);
  });

  it('P19.12-T6 AC-3 nothing kept: no view asked for — the server’s default', async () => {
    const { calls } = render();
    await screen.findByRole('button', { name: 'View Direct group' });
    expect(reads(calls)).toEqual(['http://api.test/api/v1/unit/dashboard?period=month']);
  });

  it('P19.12-T6 AC-3 storage refused (a private window): the default, and a choice still reads', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'View Direct group' }));
    await userEvent.click(within(screen.getByRole('listbox', { name: 'View' })).getByRole('option', { name: 'Informal group' }));
    await waitFor(() => expect(reads(calls)).toContain('http://api.test/api/v1/unit/dashboard?period=month&scope=informal'));
  });

  it('P19.12-T6 AC-3 a view of another leader’s unit neither reads nor writes the reader’s kept view', async () => {
    window.localStorage.setItem(KEY, 'informal');
    nav.search = '';
    const { calls } = stubFetch({
      'GET /unit/dashboard': { body: { ...SARI_UNIT, scope: 'direct', scopes: { offered: ['direct', 'downline'], default: 'direct' } } },
      '/activity/ratios': { body: RATIOS },
    });
    renderWithSession(<UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />, { me: LEADER_ME });
    await userEvent.click(await screen.findByRole('button', { name: 'View Direct group' }));
    expect(reads(calls)).toEqual(['http://api.test/api/v1/unit/dashboard?period=month&for=mem-sari']);
    await userEvent.click(within(screen.getByRole('listbox', { name: 'View' })).getByRole('option', { name: 'All downline' }));
    expect(window.localStorage.getItem(KEY)).toBe('informal');
  });

  it('P19.12-T6 AC-2 on Potensi the picker sits beside the month; on Aktivitas there is none', async () => {
    render({ search: 'tab=potensi' });
    await screen.findByRole('radiogroup', { name: 'Active Agent or Rekrut' });
    const view = screen.getByRole('button', { name: 'View All downline' });
    expect(view.parentElement).toContainElement(screen.getByRole('button', { name: /^Month / }));
    // The office-wide view's people with no leader: their own card, last.
    expect(screen.getByRole('region', { name: 'No leader yet' })).toHaveTextContent('Nora Siregar');
    await userEvent.click(screen.getByRole('tab', { name: 'Activities' }));
    await screen.findByRole('table', { name: 'Activities · Unit' });
    expect(picker()).toBeNull();
  });

  it('P19.12-T6 AC-1 Tim Anda’s chips: an AB below is its own chip, never in AAB', async () => {
    render({
      routes: {
        'GET /unit/dashboard': {
          body: viewed('downline', {
            tiles: {
              ...dashboard().tiles,
              team: { total: 29, direct: 1, units: 4, underUnits: 24, aab: 0, ab: 28, newHires: 0 },
              potentialActive: { count: 5, of: 29, unit: { count: 1, of: 1 }, aab: { count: 0, of: 0 }, ab: { count: 4, of: 28 } },
              potentialRecruits: { yourUnit: 0, aabs: 0, abs: 2 },
            },
          }),
        },
      },
    });
    await screen.findByRole('table', { name: 'Your team’s roster' });
    const tiles = document.querySelector('[data-unit-tiles]')!;
    // Tim Anda: 1 direct · 0 AAB · 28 AB; Active Agent: … · AB 4/28; Recruitment: … · AB 2.
    expect(tiles).toHaveTextContent('1 direct');
    expect(tiles).toHaveTextContent('0 AAB');
    expect(tiles).toHaveTextContent('28 AB');
    expect(tiles).toHaveTextContent('AB 4/28');
    expect(tiles).toHaveTextContent('AB 2');
  });

  describe('AC-4 Grup informal’s line, and + Add to group', () => {
    it('P19.12-T6 AC-4 a leader reads the line, and is offered no add — the API refuses them too', async () => {
      render({ search: 'scope=informal', routes: { 'GET /unit/dashboard': { body: viewed('informal', { informal: { ...INFORMAL, abs: null, canTag: false } }) } } });
      expect(await screen.findByText('3 AB below you are not in a group yet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '+ Add to group' })).toBeNull();
    });

    it('P19.12-T6 AC-4 the Owner adds two of them to the group in place: one request, a toast, the dashboard read again', async () => {
      const added = { groupId: 'g-top', name: 'Top Producers 2026', added: 2, memberCount: 4 };
      const { calls } = render({
        me: OWNER_ME, search: 'scope=informal',
        routes: { 'POST /members/groups/g-top/members': { body: added } },
      });
      await userEvent.click(await screen.findByRole('button', { name: '+ Add to group' }));
      const sheet = await screen.findByRole('dialog', { name: 'Add to group' });
      expect(within(sheet).getByText('Top Producers 2026')).toBeInTheDocument();
      expect(within(sheet).getByRole('button', { name: 'Add' })).toBeDisabled();
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Maya Halim' }));
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Yosef Tambunan' }));
      const results = await axe(sheet, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations.map((v) => v.id)).toEqual([]);
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add 2' }));
      expect(await screen.findByText('2 AB added to Top Producers 2026')).toBeInTheDocument();
      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(post.url).toBe('http://api.test/api/v1/members/groups/g-top/members');
      expect(JSON.parse(post.init.body as string)).toEqual({ membershipIds: ['mem-maya', 'mem-yosef'] });
      await waitFor(() => expect(reads(calls).length).toBe(2));
    });

    it('P19.12-T6 AC-4 a head with no group yet: adding makes “Group {first name}”, then tags into it', async () => {
      const { calls } = render({
        me: OWNER_ME, search: 'scope=informal',
        routes: {
          'GET /unit/dashboard': { body: viewed('informal', { informal: { ...INFORMAL, groups: [] } }) },
          'POST /members/groups/g-new/members': { body: { groupId: 'g-new', name: 'Group Agus', added: 1, memberCount: 1 } },
          'POST /members/groups': { body: [{ groupId: 'g-new', name: 'Group Agus', ownerMembershipId: 'mem-agus', ownerName: 'Agus Santoso', ownerHasLeft: false, memberCount: 0 }] },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: '+ Add to group' }));
      const sheet = await screen.findByRole('dialog', { name: 'Add to group' });
      expect(within(sheet).getByText('Agus Santoso has no group yet. Adding makes one: “Group Agus”.')).toBeInTheDocument();
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Satria Nugraha' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add 1' }));
      await screen.findByText('1 AB added to Group Agus');
      const posts = calls.filter((c) => c.init.method === 'POST');
      expect(posts.map((c) => c.url)).toEqual([
        'http://api.test/api/v1/members/groups', 'http://api.test/api/v1/members/groups/g-new/members',
      ]);
      expect(JSON.parse(posts[0].init.body as string)).toEqual({ name: 'Group Agus', ownerMembershipId: 'mem-agus' });
    });

    it('P19.12-T6 AC-4 a refusal stays in the sheet, nothing claimed', async () => {
      render({
        me: OWNER_ME, search: 'scope=informal',
        routes: { 'POST /members/groups/g-top/members': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Group not found.' } } } },
      });
      await userEvent.click(await screen.findByRole('button', { name: '+ Add to group' }));
      const sheet = await screen.findByRole('dialog', { name: 'Add to group' });
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Maya Halim' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add 1' }));
      expect(await within(sheet).findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText(/added to/)).toBeNull();
    });
  });
});
