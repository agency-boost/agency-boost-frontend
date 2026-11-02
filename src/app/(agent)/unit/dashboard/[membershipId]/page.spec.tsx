import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { AGUS_ME, RATIOS, SARI_UNIT } from '@test/unit-dashboard-fixtures';
import AgentLayout from '../../../layout';
import UnitBelowPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => '/unit/dashboard/mem-sari',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

function render(reply: StubReply | StubReply[] = { body: SARI_UNIT }, me = AGUS_ME, period?: string) {
  const stub = stubFetch({ 'GET /unit/dashboard': reply, '/activity/ratios': { body: RATIOS } });
  nav.search = new URLSearchParams(period ? { period } : {}).toString();
  renderWithSession(<UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />, { me });
  return stub;
}

const NOT_FOUND = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-404' } } };

/**
 * A unit below the reader (P15-T4 AC-2): Agus opens Sari's from the Group tree. The same screen over
 * `?for=`, titled for whose unit it is, its head named rather than *You*.
 */
describe('a unit below the reader (P15-T4 AC-2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.replace.mockClear();
  });

  it('P15-T4 AC-2 reads that leader’s unit with for, and titles it {name}’s Unit Dashboard', async () => {
    const { calls } = render();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/^Sari Wulandari’s Unit Dashboard$/);
    expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=month&for=mem-sari');
  });

  it('P15-T4 AC-2 reads This month when the address carries no query', async () => {
    const { calls } = stubFetch({ 'GET /unit/dashboard': { body: SARI_UNIT } });
    renderWithSession(<UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />, { me: AGUS_ME });
    await screen.findByRole('table');
    expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=month&for=mem-sari');
  });

  it('P15-T4 AC-2, UI-009, UI-011 names the head’s row and groups for them, never You; a row opens the person, ‹ back here', async () => {
    render();
    await screen.findByRole('table', { name: 'Your team’s roster' });
    expect(screen.queryByText(/^You \(/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sari Wulandari’s Unit · 4' })).toHaveAttribute('aria-expanded', 'true');
    const head = screen.getByRole('link', { name: 'Sari Wulandari' });
    expect(head).toHaveAttribute('href', '/coaching/mem-sari/summary?from=%2Funit%2Fdashboard%2Fmem-sari');
    expect(screen.queryByText(/^Your Unit/)).not.toBeInTheDocument();
  });

  it('P15-T4 AC-2: a unit outside the reader’s own downline names its people without links to coaching tabs', async () => {
    // An Owner or an Admin reads any leader's unit (own-kpm); somebody they do not coach has no coaching tab
    // to open, so the server says `coached: false` and the row's figures are plain text.
    type Group = { head: { coached: boolean }; members: { coached: boolean }[]; units: Group[] };
    const uncoach = <T extends { coached: boolean }>(row: T): T => ({ ...row, coached: false });
    const group = (g: Group): Group => ({ ...g, head: uncoach(g.head), members: g.members.map(uncoach), units: g.units.map(group) });
    const outside = {
      ...SARI_UNIT,
      yourUnit: { ...SARI_UNIT.yourUnit, rows: SARI_UNIT.yourUnit.rows.map(uncoach) },
      units: (SARI_UNIT.units as unknown as Group[]).map(group),
    };
    render({ body: outside });
    await screen.findByRole('table', { name: 'Your team’s roster' });
    expect(screen.getByText('Sari Wulandari')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sari Wulandari' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Your team’s roster' })).queryAllByRole('link')).toHaveLength(0);
  });

  it('P15-T4 AC-2, UI-003 counts the unit’s team in its chips — direct, then AAB — and its recruitment Unit / AAB', async () => {
    render();
    await screen.findByRole('table');
    const tile = (label: string) => screen.getByText(label).closest('[data-stat-tile]')!;
    expect(tile('Your team')).toHaveTextContent('6agents4 direct2 AAB');
    expect(tile('Recruitment October')).toHaveTextContent('1candidateUnit 1AAB 0');
    expect(screen.queryByText(/including you/)).not.toBeInTheDocument();
  });

  it('P15-T4 AC-2 names the dialog’s first group for the head', async () => {
    render();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Update production' }));
    const dialog = screen.getByRole('dialog', { name: 'Update production' });
    expect(within(dialog).getByRole('rowheader', { name: 'Sari Wulandari’s direct agents' })).toBeInTheDocument();
    expect(within(dialog).getByRole('rowheader', { name: 'Wulan Sari’s unit' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Your direct agents')).not.toBeInTheDocument();
  });

  it('P15-T4 AC-2 keeps the period on a unit below, and its switch reads that unit again', async () => {
    const { calls } = render([{ body: { ...SARI_UNIT, period: 'year' } }, { body: SARI_UNIT }], AGUS_ME, 'year');
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Period' }), 'month');
    // UI V1: the address carries the period only when it is not the first, *Bulan ini*.
    expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard/mem-sari', { scroll: false });
    await screen.findByRole('table');
    expect(calls.map((c) => c.url)).toEqual([
      'http://api.test/api/v1/unit/dashboard?period=year&for=mem-sari',
      'http://api.test/api/v1/unit/dashboard?period=month&for=mem-sari',
    ]);
  });

  it('P15-T4 AC-2 and AC-5 answer a unit the reader cannot open with the not-found state, telling nothing of who exists', async () => {
    render(NOT_FOUND);
    expect(await screen.findByText('This isn’t a unit you can open.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Unit Dashboard$/);
    expect(screen.getByRole('link', { name: 'Your Unit Dashboard' })).toHaveAttribute('href', '/unit/dashboard');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Period' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Sari|office|KPM|reports to|tagged to|untagged|unassigned/);
  });

  it('P15-T4 AC-2 shows another failure as an error with a retry, under the screen’s own title', async () => {
    const { calls } = render([
      { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-1' } } },
      { body: SARI_UNIT },
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Unit Dashboard$/);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sari Wulandari’s Unit Dashboard' })).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it('P15-T4 AC-5 refuses a reader without the grant, asking for nothing', () => {
    const { calls } = render({ body: SARI_UNIT }, makeMe({ permissions: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(calls).toHaveLength(0);
  });

  it('P15-T4 AC-5 lets a read-only support session read it, with no Update production', async () => {
    render({ body: SARI_UNIT }, makeMe({ ...AGUS_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'Root' }));
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
  });

  it('P15-T4 AC-2 keeps Unit dashboard the current item in the shell', async () => {
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/notifications': { body: { items: [], unread: 0 } },
      'GET /unit/dashboard': { body: SARI_UNIT },
    });
    renderInLayout(AgentLayout, <UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} />, { me: AGUS_ME });
    await screen.findByRole('table');
    const main = screen.getByRole('navigation', { name: 'Main' });
    // The field shell's sidebar since UI V1 (UI-004): *Unit Dashboard*.
    expect(within(main).getByRole('link', { name: 'Unit Dashboard' })).toHaveAttribute('aria-current', 'page');
  });
});
