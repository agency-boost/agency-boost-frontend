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

/**
 * The last six months, one of them never uploaded. *UI-109's Overview on a phone* is `page.spec.tsx`'s since P19.3-T3,
 * which draws the Leader list at every size; this file keeps UI-109's Compliance and the tabs.
 */
const MONTHLY = [
  { month: '2026-04', apeMinor: 174 * 1e8 }, { month: '2026-05', apeMinor: 174 * 1e8 }, { month: '2026-06', apeMinor: 174 * 1e8 },
  { month: '2026-07', apeMinor: 271 * 1e8 }, { month: '2026-08', apeMinor: null }, { month: '2026-09', apeMinor: 462 * 1e8 },
];

function compliance(me = CORE_LEADER_ME) {
  nav.pathname = '/kpm/analytics/compliance';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /kpm/analytics/compliance': { body: complianceView('training') } });
  renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsCompliancePage />, { me });
  return stub;
}

describe('UI-109 KPM Analytics on a phone in the field shell', () => {
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

  it('UI-109 the tab reads Compliance in Indonesian too', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /kpm/analytics': { body: analyticsView('this_month', { monthly: MONTHLY }) } });
    renderInIndonesian(<KpmAnalyticsLayout><KpmAnalyticsPage /></KpmAnalyticsLayout>, { me: CORE_LEADER_ME });
    const segments = await screen.findByRole('navigation', { name: 'KPM Analytics' });
    expect(within(segments).getByRole('link', { name: 'Compliance' })).toBeInTheDocument();
    expect(await screen.findByText('6 bulan')).toBeInTheDocument();
  });

  it('P19.3-T3 AC-14 the Owner on a phone and a tablet reads UI-109’s Compliance too, the campaign override kept', async () => {
    for (const width of [375, 768]) {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
      atWidth(width);
      nav.pathname = '/kpm/analytics/compliance';
      nav.search = 'category=campaigns&item=PERSISTENCY_PUSH';
      stubFetch({ ...SHELL_STUBS, 'GET /kpm/analytics/compliance': { body: complianceView('campaigns', 'PERSISTENCY_PUSH') } });
      renderInLayout(KpmAnalyticsLayout, <KpmAnalyticsCompliancePage />, { me: OWNER_ME });
      const list = await screen.findByRole('list', { name: 'By AB' });
      expect(document.querySelector('[data-v1-compliance]')).not.toBeNull();
      expect(screen.queryAllByRole('region')).toHaveLength(0);
      for (const section of [...list.querySelectorAll('[data-v1-section]')]) {
        const toggle = within(section as HTMLElement).getAllByRole('button')[0];
        if (toggle.getAttribute('aria-expanded') === 'false') await userEvent.click(toggle);
      }
      // P18.3-T2's override stays the Owner's: the *Achieved* cell's control on Rina's line.
      const rina = document.querySelector('[data-row="mem-rina"]') as HTMLElement;
      expect(within(rina).getByRole('button', { name: /Rina Agustina/ })).toBeInTheDocument();
    }
  });
});
