import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import RatioBenchmarksPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/ratio-benchmarks',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const AGENT = makeMe({
  membership: { ...membership, hierarchyRole: 'agent' as const, isKpmOwner: false },
  permissions: ['tenant_config:read'],
});

const RATIOS = [
  {
    id: 'r1', code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate',
    numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION', 'SELL_FOLLOWUP'],
    benchmark: 0.15, comparison: 'gte', displayOrder: 1, version: 1, status: 'active',
  },
  {
    id: 'r2', code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment',
    numerator: ['SELL_SUBMISSION'], denominator: ['RECRUIT_AGENT_CODE'],
    benchmark: 30, comparison: 'band', displayOrder: 2, version: 1, status: 'active',
  },
];

const TAXONOMY = [{
  id: 'c1', code: 'SELLING', label: 'Selling', displayOrder: 1, version: 1, status: 'active',
  types: [
    { id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: null, displayOrder: 1, version: 1, status: 'active' },
    { id: 't2', code: 'SELL_PRESENTATION', categoryCode: 'SELLING', label: 'Presentasi penjualan', description: null, displayOrder: 2, version: 1, status: 'active' },
  ],
}];

function render(me = OWNER) {
  const stub = stubFetch({
    '/kpm/settings/ratio-benchmarks': { body: RATIOS },
    '/kpm/settings/activity-types': { body: TAXONOMY },
  });
  renderWithSession(<RatioBenchmarksPage />, { me });
  return stub;
}

describe('the office ratio benchmarks (P4-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a formula as the activity types it counts, not as numbers', async () => {
    /*
     * The prototype writes these as `6 / (4+5)` — item numbers, which are unreadable and
     * break the moment somebody reorders the taxonomy. Labels, with the code underneath.
     */
    render();
    const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
      .closest('div')!.parentElement!;
    expect(within(card).getByText('Submission polis')).toBeInTheDocument();
    expect(within(card).getByText('Presentasi penjualan')).toBeInTheDocument();
    expect(within(card).getByText('SELL_SUBMISSION')).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/\b6 \/ \(4\+5\)/);
  });

  it('shows a code with no label exactly once, not twice', async () => {
    /*
     * A ratio can name a type the office has since archived, and the code is already
     * rendered beside the label. Falling back to the code printed the same string twice
     * on precisely the rows an Owner most needs to read clearly.
     */
    render();
    expect(await screen.findAllByText('SELL_FOLLOWUP')).toHaveLength(1);
  });

  it('reads a gte benchmark and a band benchmark differently', async () => {
    render();
    expect(await screen.findByText(/On track at or above/)).toBeInTheDocument();
    expect(screen.getByText(/On track within/)).toBeInTheDocument();
    expect(screen.getByText('points')).toBeInTheDocument();
  });

  it('sends only the benchmark when the benchmark changes', async () => {
    // Nothing on this screen changes what is counted — only what counts as good.
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Change the benchmark' }))[0]);
    const input = screen.getByLabelText('Benchmark');
    await userEvent.clear(input);
    await userEvent.type(input, '0.25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const call = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(call.init.body as string)).toEqual({ benchmark: 0.25 });
  });

  it('shows an agent the ratios and none of the controls', async () => {
    render(AGENT);
    expect(await screen.findByText('Selling success rate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change the benchmark' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });
});
