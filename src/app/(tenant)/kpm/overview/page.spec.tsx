import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { complianceView, overviewView, performanceView, trainingSelected } from './overview-fixtures';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const READ = ['member:read_profile', 'kpm_overview:read', 'ab_group_target:read', 'ab_group_target:write', 'member:tag_group'];

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: READ,
});

/** A core leader (★): the Owner's reads in KPM, the whole office here (ADR-0268 §1). */
const CORE_LEADER = makeMe({
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3, isCoreLeader: true,
  } as never,
  permissions: READ,
});

/** An AB in the field: no `kpm_overview:read`. */
const FIELD_AB = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['member:read_profile'],
});

function render(me = OWNER, routes: Record<string, StubReply | StubReply[]> = {}, language: 'en' | 'id' = 'en') {
  const stub = stubFetch({
    '/kpm/overview': { body: overviewView() },
    '/kpm/overview/performance': { body: performanceView() },
    '/kpm/overview/compliance': { body: complianceView() },
    ...routes,
  });
  (language === 'id' ? renderInIndonesian : renderWithSession)(<KpmOverviewPage />, { me });
  return stub;
}

const loaded = () => screen.findByRole('region', { name: /usage|Pemakaian AgencyBoost/ });
const region = (name: RegExp) => screen.getByRole('region', { name });

describe('KPM Overview, second version (P19.19)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('P19.19-T1 AC-1 is titled Overview over the office’s line, its one control the group filter, six sections in order', async () => {
    render();
    await loaded();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Overview$/);
    expect(screen.getByText('Prudential · KPM 0417 — BSD City Branch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Informal group/ })).toHaveTextContent('All groups');
    await screen.findByText('Total KPM');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      '1 · AgencyBoost usage', '2 · Usage per person', '3 · Coaching',
      '4 · Compliance', '5 · Performance vs target', '6 · Production, 6 months',
    ]);
    // Two columns: usage first on the left, compliance then results on the right.
    expect(document.querySelector('[data-column="left"]')!.querySelectorAll('section')).toHaveLength(3);
    expect(document.querySelector('[data-column="right"]')!.querySelectorAll('section')).toHaveLength(3);
  });

  it('P19.19-T1 AC-1 in Indonesian, the mockup’s words verbatim', async () => {
    render(OWNER, {}, 'id');
    await screen.findByRole('region', { name: '1 · Pemakaian AgencyBoost' });
    expect(screen.getByText('Sudah pakai AgencyBoost')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '1 · Pemakaian AgencyBoost' })).getByText('dari 5 anggota')).toBeInTheDocument();
    for (const words of ['2 · Pemakaian per orang', '3 · Coaching', '4 · Compliance', '5 · Performa vs target', '6 · Produksi 6 bulan']) {
      expect(screen.getByRole('heading', { name: words })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Belum pernah pakai').length).toBeGreaterThan(0);
    expect(screen.getByText('terendah dulu')).toBeInTheDocument();
    expect(await screen.findByText('Total KPM')).toBeInTheDocument();
  });

  it('P19.19-T1 AC-2 section 1: n of m members, Leader x/y and Agent x/y, then one row per informal group', async () => {
    render();
    await loaded();
    const usage = region(/AgencyBoost usage/);
    expect(within(usage).getByRole('group', { name: /3 of 5 members using AgencyBoost/ })).toBeInTheDocument();
    expect(within(usage).getByText('Leader 1/2 · Agent 1/2')).toBeInTheDocument();
    expect(within(usage).getByRole('button', { name: 'Show the page for No group' })).toBeInTheDocument();
  });

  it('P19.19-T1 AC-2 tapping a group row filters the whole page to it: each read asks for that group', async () => {
    const { calls } = render();
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Show the page for Top Producers 2026' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/overview?group=grp-top'))).toBe(true));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/overview/performance?group=grp-top'))).toBe(true));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/overview/compliance?group=grp-top'))).toBe(true));
  });

  it('P19.19-T1 AC-3 section 2 opens on Belum pernah pakai: who never used it, with their leader shown for the team', async () => {
    render();
    await loaded();
    const people = region(/Usage per person/);
    expect(within(people).getByRole('radio', { name: /Never used/ })).toHaveAttribute('aria-checked', 'true');
    const rows = [...people.querySelectorAll('[data-person]')].map((r) => [r.getAttribute('data-person'), r.getAttribute('data-in-team')]);
    // Agus is shown for his team (Dewi and Lukman), Dewi matches herself; Maya is in no row.
    expect(rows).toEqual([['mem-agus', '2'], ['mem-dewi', '0'], ['mem-lukman', '0']]);
    expect(within(people).getByText('2 in their team')).toBeInTheDocument();
    await userEvent.click(within(people).getByRole('radio', { name: /Used > 14 days ago/ }));
    expect([...people.querySelectorAll('[data-person]')].map((r) => r.getAttribute('data-person')))
      .toEqual(['mem-agus', 'mem-dewi', 'mem-wahyu']);
    expect(within(people).getByText('Used 18 days ago')).toBeInTheDocument();
  });

  it('P19.19-T1 AC-4 section 3 is coaching, with its own tiles', async () => {
    render();
    await loaded();
    const coaching = region(/^3 · Coaching$/);
    expect(within(coaching).getByRole('radio', { name: /Never coached/ })).toHaveAttribute('aria-checked', 'true');
    expect([...coaching.querySelectorAll('[data-person]')].map((r) => r.getAttribute('data-person'))).toEqual(['mem-agus']);
  });

  it('P19.19-T3 AC-2 section 4: seven cards in the server’s order, each in its colour and over its people', async () => {
    render();
    const compliance = await screen.findByRole('region', { name: /Compliance/ });
    await waitFor(() => expect(compliance.querySelectorAll('[data-card]')).toHaveLength(7));
    expect([...compliance.querySelectorAll('[data-card]')].map((c) => [c.getAttribute('data-card'), c.getAttribute('data-tone')])).toEqual([
      ['activity', 'red'], ['leads', 'amber'], ['events', 'amber'], ['activation', 'amber'], ['training', 'amber'],
      ['goals', 'green'], ['campaigns', 'grey'],
    ]);
    expect(within(compliance).getByRole('button', { name: /^Events: 50%, 2 of 4 invited/ })).toBeInTheDocument();
    expect(within(compliance).getByRole('button', { name: /^Activation: 50%, 1 of 2 new agents/ })).toBeInTheDocument();
    expect(within(compliance).getByRole('button', { name: /^Leads Mgmt: 40%, 2 of 5 members/ })).toBeInTheDocument();
  });

  it('P19.19-T3 AC-3 a card opens its list: “Training · 3 of 5 done”, per module, Not done first', async () => {
    const { calls } = render(OWNER, {
      '/kpm/overview/compliance?category=training': { body: trainingSelected() },
    });
    const compliance = await screen.findByRole('region', { name: /Compliance/ });
    await userEvent.click(await within(compliance).findByRole('button', { name: /^Training/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Training · 3 of 5 done' });
    expect(calls.some((c) => c.url.includes('/kpm/overview/compliance?category=training'))).toBe(true);
    expect(within(dialog).getByRole('button', { name: /Module: Building Your Prospect List/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Not done/ })).toHaveAttribute('aria-checked', 'true');
    expect([...dialog.querySelectorAll('[data-person]')].map((r) => r.getAttribute('data-person')))
      .toEqual(['mem-agus', 'mem-dewi', 'mem-lukman']);
  });

  it('P19.19-T2 AC-1, AC-2 section 5: its own month, › off on the office’s month; Total KPM, the group totals and each AB group', async () => {
    render();
    const performance = await screen.findByRole('region', { name: /Performance vs target/ });
    await within(performance).findByText('Total KPM');
    expect(within(performance).getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(within(performance).getByRole('button', { name: 'Previous month' })).toBeEnabled();
    expect(performance.querySelectorAll('[data-ab-group]')).toHaveLength(2);
    expect(within(performance).getAllByText('Goal not set').length).toBeGreaterThan(0);
  });

  it('P19.19-T2 AC-1 ‹ reads the month before', async () => {
    const { calls } = render();
    const performance = await screen.findByRole('region', { name: /Performance vs target/ });
    await userEvent.click(await within(performance).findByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/overview/performance?month=2026-10'))).toBe(true));
  });

  it('P19.19-T2 AC-3 the Active Agent and Rekrut tiles are controls that open the target dialog; APE is not', async () => {
    render(OWNER, { '/kpm/ab-group-targets': { body: performanceView() } });
    const performance = await screen.findByRole('region', { name: /Performance vs target/ });
    const row = await waitFor(() => performance.querySelector('[data-ab-group="mem-agus"]')!);
    expect(row.querySelectorAll('[data-target-tile]')).toHaveLength(2);
    expect(row.querySelector('[data-ape-tile]')!.tagName).toBe('DIV');
    await userEvent.click(within(row as HTMLElement).getByRole('button', { name: /^Active Agent of Agus Prasetyo/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('P19.19-T2 AC-4 a Group button per AB group opens the Group dialog', async () => {
    render(OWNER, { '/members/groups': { body: { groups: [], ungrouped: { abs: [], counts: {} }, unplaced: 0, canWrite: true } } });
    const performance = await screen.findByRole('region', { name: /Performance vs target/ });
    await userEvent.click(await within(performance).findByRole('button', { name: 'Group for Agus Prasetyo' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('P19.19-T3 AC-1 section 6: a bar per month, a month without an upload “–” over a stub, named under the chart', async () => {
    render();
    await loaded();
    const chart = region(/Production, 6 months/);
    expect(chart.querySelectorAll('[data-chart-month]')).toHaveLength(6);
    expect(chart.querySelectorAll('[data-stub]')).toHaveLength(2);
    expect(within(chart).getByText(/Aug.*not uploaded yet/)).toBeInTheDocument();
  });

  it('P19.19-T1 a core leader reads the same page', async () => {
    render(CORE_LEADER);
    await loaded();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Overview');
  });

  it('P19.19-T1 the states: an error with Try again; a KPM with nobody reads No data yet', async () => {
    render(OWNER, { '/kpm/overview': [{ status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-1' } } }, { body: overviewView() }] });
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await loaded();
    vi.unstubAllGlobals();
    render(OWNER, {
      '/kpm/overview': { body: overviewView({ people: [], groups: [], usage: { total: { used: 0, of: 0, pct: null }, leaders: { used: 0, of: 0, pct: null }, agents: { used: 0, of: 0, pct: null }, byGroup: [] } }) },
    });
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
  });

  it('P19.19-T1 a field AB without kpm_overview:read is not shown the page and sends no read', async () => {
    const { calls } = render(FIELD_AB);
    await waitFor(() => expect(screen.queryByRole('region', { name: /usage/ })).not.toBeInTheDocument());
    expect(calls.filter((c) => c.url.includes('/kpm/overview'))).toEqual([]);
  });

  it('P19.19 Pengaturan KPM shows only while something waits, and opens the hub', async () => {
    render(OWNER, { '/kpm/overview': { body: overviewView({ settings: { productsAwaiting: 2, checklistDraftVersion: null } }) } });
    await loaded();
    const card = document.querySelector('[data-settings-card]')!;
    expect(within(card as HTMLElement).getByRole('link')).toHaveAttribute('href', '/kpm/settings');
  });
});
