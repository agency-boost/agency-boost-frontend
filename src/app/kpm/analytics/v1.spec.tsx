import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, renderInIndonesian, renderInLayout, resetLanguage, stubFetch } from '@test/harness';
import { analyticsView, CORE_LEADER_ME, OWNER_ME, SHELL_STUBS } from '@test/kpm-analytics-fixtures';
import { complianceView } from '@test/kpm-compliance-fixtures';
import KpmAnalyticsCompliancePage from './compliance/page';
import KpmAnalyticsLayout from './layout';
import KpmAnalyticsPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/kpm/analytics', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.search = '';
  nav.pathname = '/kpm/analytics';
  atWidth(375);
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/** The last six months, one of them never uploaded: the hatched bar (`kpm-mobile` 2). */
const MONTHLY = [
  { month: '2026-04', apeMinor: 174 * 1e8 }, { month: '2026-05', apeMinor: 174 * 1e8 }, { month: '2026-06', apeMinor: 174 * 1e8 },
  { month: '2026-07', apeMinor: 271 * 1e8 }, { month: '2026-08', apeMinor: null }, { month: '2026-09', apeMinor: 462 * 1e8 },
];

function overview(me = CORE_LEADER_ME) {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /kpm/analytics': { body: analyticsView('this_month', { monthly: MONTHLY }) } });
  renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsPage />, { me });
  return stub;
}

function compliance(me = CORE_LEADER_ME) {
  nav.pathname = '/kpm/analytics/compliance';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /kpm/analytics/compliance': { body: complianceView('training') } });
  renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsCompliancePage />, { me });
  return stub;
}

describe('UI-109 KPM Analytics on a phone in the field shell', () => {
  it('UI-109 the tabs are one segmented control, Overview | Compliance, and the sub-line is gone', async () => {
    overview();
    const segments = await screen.findByRole('navigation', { name: 'KPM Analytics' });
    expect(segments).toHaveAttribute('data-route-segments');
    expect(within(segments).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(segments).getByRole('link', { name: 'Compliance' })).toHaveAttribute('href', '/kpm/analytics/compliance');
    // Not drawn below 768px (the class that removes it there); the console's readers keep theirs.
    expect(screen.getByText('Unit comparisons, club qualification, and trends')).toHaveClass('max-md:hidden');
  });

  it('UI-109 Overview: Unit comparison with its period pill, six tiles in two columns, one row per AB, the six-month bars', async () => {
    overview();
    const v1 = await waitFor(() => {
      const el = document.querySelector('[data-v1-overview]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(within(v1).getByRole('heading', { name: 'Unit comparison' })).toBeInTheDocument();
    expect(within(v1).getByRole('combobox', { name: 'Period' })).toHaveValue('this_month');
    expect(v1.querySelectorAll('[data-stat-tile]')).toHaveLength(6);
    expect(within(v1).getByText('Manpower')).toBeInTheDocument();
    expect(within(v1).getByText('ABs meeting MOC')).toBeInTheDocument();
    const rows = within(within(v1).getByRole('list', { name: 'By AB' })).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    // No table, and no footnote under the chart.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/combined APE — whole group/)).not.toBeInTheDocument();
  });

  it('UI-109 an AB row: the APE % in its status colour, the APE, the people, the club pill and a green MOC pill when met', async () => {
    overview();
    const list = await screen.findByRole('list', { name: 'By AB' });
    const hendra = within(list).getAllByRole('listitem')[0];
    expect(hendra).toHaveTextContent('Hendra Wibowo');
    expect(hendra).toHaveTextContent('31 people');
    expect(within(hendra).getByText('Star Club')).toBeInTheDocument();
    const moc = within(hendra).getByRole('button', { name: /MOC requirements met for Hendra Wibowo/ });
    expect(moc.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'green');
  });

  it('UI-109 a Core Leader’s own row opens their unit; another AB’s row leads nowhere rather than to a refusal', async () => {
    overview();
    const list = await screen.findByRole('list', { name: 'By AB' });
    const rows = within(list).getAllByRole('listitem');
    const linked = rows.filter((row) => within(row).queryByRole('link'));
    // The fixture's reader's own agency is the one marked *You*: it alone opens, at the reader's own Unit Dashboard.
    expect(linked).toHaveLength(1);
    expect(within(linked[0]).getByText('You')).toBeInTheDocument();
    expect(within(linked[0]).getByRole('link')).toHaveAttribute('href', '/unit/dashboard');
  });

  it('UI-109 the MOC pill opens the requirements', async () => {
    overview();
    await userEvent.click(await screen.findByRole('button', { name: /MOC requirements met for Hendra Wibowo/ }));
    expect(await screen.findByRole('dialog', { name: /Hendra Wibowo — Maintenance of Contract/ })).toBeInTheDocument();
  });

  it('UI-109 the six bars: the latest in the accent, a month with no upload hatched and –, no footnote', async () => {
    overview();
    const bars = await waitFor(() => {
      const el = document.querySelector('[data-v1-bars]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const kinds = [...bars.querySelectorAll('[data-bar]')].map((b) => b.getAttribute('data-bar'));
    expect(kinds).toEqual(['month', 'month', 'month', 'month', 'none', 'latest']);
    expect(bars).toHaveTextContent('–');
    expect(within(bars).getByText(/2026: not uploaded$/)).toBeInTheDocument();
  });

  it('UI-109 Compliance: the six tiles three across and the one module picker on the first screen', async () => {
    compliance();
    const v1 = await waitFor(() => {
      const el = document.querySelector('[data-v1-compliance]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const tiles = within(within(v1).getByRole('group')).getAllByRole('button');
    expect(tiles.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Training3\s*\/ 11$/), expect.stringMatching(/^Goal Setting8\s*\/ 11$/), expect.stringContaining('Activity Mgmt'),
      expect.stringContaining('Activation'), expect.stringContaining('Events'), expect.stringContaining('Campaigns'),
    ]);
    expect(tiles[0]).toHaveAttribute('aria-pressed', 'true');
    // 3 of 11 is below half: red. 8 of 11 is 73%: the accent.
    expect(tiles[0].querySelector('[data-bar-tone]')).toHaveAttribute('data-bar-tone', 'red');
    expect(tiles[1].querySelector('[data-bar-tone]')).toHaveAttribute('data-bar-tone', 'accent');
    const picker = v1.querySelector('[data-module-picker]') as HTMLElement;
    expect(picker).toHaveTextContent('Training module');
    expect(picker).toHaveTextContent('Building Your Prospect List');
    // One picker, not three chip rows.
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('UI-109 the picker chooses a module inside its sheet, category › skill › module', async () => {
    compliance();
    await userEvent.click(await screen.findByRole('button', { name: /Training module/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Training module' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Closing Techniques That Work' }));
    expect(nav.replace).toHaveBeenCalledWith('/kpm/analytics/compliance?category=training&item=CLOSING_TECHNIQUES', { scroll: false });
  });

  it('UI-109 opening an AB shows its units and people with the three status pills and the day done', async () => {
    compliance();
    await screen.findByRole('list', { name: 'By AB' });
    // The reader's own agency starts open.
    const hendra = document.querySelector('[data-v1-section="mem-hendra"]') as HTMLElement;
    expect(within(hendra).getByRole('button', { name: /Hendra Wibowo/ })).toHaveAttribute('aria-expanded', 'true');
    expect(hendra).toHaveTextContent('Unit Ika Wirawan · AAB');
    const rows = [...hendra.querySelectorAll('[data-row]')] as HTMLElement[];
    const pillOf = (name: string) => rows.find((r) => r.textContent?.includes(name))!.querySelector('[data-tone]');
    expect(pillOf('Hendra Wibowo')).toHaveAttribute('data-tone', 'green');
    expect(pillOf('Hendra Wibowo')).toHaveTextContent('Completed');
    expect(pillOf('Rina Agustina')).toHaveAttribute('data-tone', 'amber');
    expect(pillOf('Rina Agustina')).toHaveTextContent('In progress');
    expect(pillOf('Dedy')).toHaveAttribute('data-tone', 'grey');
    expect(within(rows[0]).getByText('Personal')).toBeInTheDocument();

    const maya = document.querySelector('[data-v1-section="mem-maya"]') as HTMLElement;
    const toggle = within(maya).getByRole('button', { name: /Maya Halim/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(maya.querySelectorAll('[data-row]').length).toBeGreaterThan(0);
  });

  it('UI-109 the sort pill reverses the ABs: needs attention first, then on track first', async () => {
    compliance();
    const list = await screen.findByRole('list', { name: 'By AB' });
    const order = () => [...list.querySelectorAll('[data-v1-section]')].map((s) => s.getAttribute('data-v1-section'));
    const first = order();
    await userEvent.click(screen.getByRole('button', { name: 'Needs attention first' }));
    expect(screen.getByRole('button', { name: 'On track first' })).toBeInTheDocument();
    expect(order()).not.toEqual(first);
  });

  it('UI-109 the Owner on a phone keeps the office console’s Overview: the cards, not the field’s compact rows', async () => {
    overview(OWNER_ME);
    await screen.findAllByText('Hendra Wibowo');
    expect(document.querySelector('[data-v1-overview]')).toBeNull();
    expect(document.querySelector('[data-route-segments]')).toBeNull();
  });

  it('UI-109 the tab reads Compliance in Indonesian too, and the Overview’s own words are Indonesian', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /kpm/analytics': { body: analyticsView('this_month', { monthly: MONTHLY }) } });
    renderInIndonesian(<KpmAnalyticsLayout><KpmAnalyticsPage /></KpmAnalyticsLayout>, { me: CORE_LEADER_ME });
    const segments = await screen.findByRole('navigation', { name: 'KPM Analytics' });
    expect(within(segments).getByRole('link', { name: 'Compliance' })).toBeInTheDocument();
    expect(await screen.findByText('31 orang', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Anda')).toBeInTheDocument();
    expect(screen.getByText('6 bulan')).toBeInTheDocument();
  });
});
