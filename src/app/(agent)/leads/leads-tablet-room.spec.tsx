import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import LeadsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

const AGENT = makeMe({ permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'] });

const PIPELINES = [
  { pipeline: 'sales', statuses: [
    { id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
    { id: 's2', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 2, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
  ] },
  { pipeline: 'recruitment', statuses: [
    { id: 'r1', pipeline: 'recruitment', code: 'NOT_APPROACHED', label: 'Not approached', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
  ] },
];
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });
const LEAD = {
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Sekar Arum', contact: { phone: '0812-1100-2200', email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, committedMonths: [], lastEditedBy: null, remarks: null,
  nextActionDate: '2099-11-02', nextActionNote: null, outcome: null, source: null,
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 1, flags: [], overdueDays: null,
};

afterEach(() => vi.unstubAllGlobals());

/**
 * **Nothing under the + button on a tablet** (P19.1-T1 AC-5, ADR-0196; UI-124: *the orange + button covers the last
 * visible card's WhatsApp button*; `leads-tablet-desktop` screen 2). The button is 56px tall and stands 16px above the
 * tab bar's room; the list ends at least its height and 16px higher than the page's own room under it.
 */
describe('P19.1-T1 AC-5 /leads at 768px (UI-124)', () => {
  const open = async (px: number) => {
    atWidth(px);
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
      '/kpm/org-levels': { body: [] },
      'outcome=won': { body: page([]) },
      'outcome=lost': { body: page([]) },
      'outcome=open': { body: page([LEAD]) },
    });
    renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
    return screen.findByRole('button', { name: 'Add lead' });
  };

  it('P19.1-T1 AC-5 the list keeps the + button’s height and 16px clear under its last card', async () => {
    const add = await open(768);
    // The button: 56px (`h-14`), fixed 16px above the tab bar's room.
    expect(add).toHaveClass('fixed', 'h-14');
    expect(add.className).toContain('bottom-[calc(var(--tab-bar-space)+1rem)]');
    const room = document.querySelector('[data-leads-room]') as HTMLElement;
    expect(room).toContainElement(await screen.findByRole('list', { name: 'Your leads' }));
    // 72px = the button's 56px + 16px, on top of the page's own room for the bar.
    expect(wears(room, 768).split(' ')).toContain('pb-[4.5rem]');
  });

  it('P19.1-T1 AC-7 a phone and a laptop are as they were', async () => {
    await open(375);
    const room = document.querySelector('[data-leads-room]') as HTMLElement;
    expect(wears(room, 375)).toBe('');
    expect(wears(room, 1024)).toBe('');
  });

  it('P19.1-T1 AC-1 titles the page Leads at every size, the phone’s title', async () => {
    await open(768);
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Leads Management' })).not.toBeInTheDocument();
  });
});
