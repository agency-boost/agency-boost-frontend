import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import ActivityRatioPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/activity/ratio',
}));

const AGENT = makeMe({ permissions: ['activity_log:read_raw', 'activity_ratios:read'] });

const term = (code: string, label: string, displayOrder: number) => ({ code, label, displayOrder });
const rate = (over: Record<string, unknown>) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent',
  benchmark: 0.15, tag: { code: 'SELLING', label: 'Selling' }, sides: null,
  numerator: [term('SELL_SUBMISSION', 'Submission polis', 6)],
  denominator: [term('SELL_PRESENTATION', 'Presentasi penjualan', 4), term('SELL_FOLLOWUP', 'Follow up penjualan', 5)],
  purpose: 'Mengukur tingkat konversi aktivitas selling menjadi submission', divergesFromStandard: false,
  value: 0.0909, share: null, numeratorCount: 1, denominatorCount: 11, status: 'alert',
  ...over,
});
const balance = (over: Record<string, unknown> = {}) => rate({
  code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points',
  benchmark: 30, tag: { code: null, label: 'Balance' }, sides: { numerator: 'Selling', denominator: 'Recruitment' },
  numerator: [term('SELL_PRESENTATION', 'Presentasi penjualan', 4)],
  denominator: [term('RECRUIT_PRESENTATION', 'Proses pendaftaran kode agen', 7)],
  purpose: 'Memantau keseimbangan fokus antara aktivitas selling dan recruitment',
  value: 24.4, share: 62.2, status: 'success', ...over,
});
const view = (ratios: unknown[]) => ({ membershipId: 'm-1', from: '2026-08-30', to: '2026-09-28', days: 30, ratios });

const AGENT_VIEW = view([
  rate({}),
  rate({
    code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3,
    tag: { code: 'LEADS_GENERATION', label: 'Leads Generation' }, value: 0.375, status: 'success',
  }),
  rate({
    code: 'MEETING_PER_APPROACH', label: 'Meeting per approach', displayUnit: 'decimal', benchmark: 1.5,
    tag: { code: 'LEADS_GENERATION', label: 'Leads Generation' }, value: null, status: 'neutral',
  }),
]);

const card = async (name: string) => (await screen.findByRole('article', { name }));

describe('Activity Ratios (P10-T2, P10-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, AC-6: says it is the last 30 days — which days — and never that the benchmarks are placeholders', async () => {
    const { calls } = stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    expect(await screen.findByText(/Calculated on the/)).toHaveTextContent(
      'Calculated on the last 30 days of activity · Aug 30 – Sep 28, 2026.',
    );
    expect(screen.queryByText(/placeholders/)).not.toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/activity/ratios'))!.url).toMatch(/\/activity\/ratios$/);
  });

  it('AC-3: writes each value as its benchmark is written, with its status in words', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const ssr = await card('Selling success rate');
    expect(ssr).toHaveTextContent('9.1%');
    expect(ssr).toHaveTextContent('Benchmark: 15.0%');
    expect(within(ssr).getByText('Below benchmark')).toBeInTheDocument();
    expect(within(ssr).getByText('Selling')).toBeInTheDocument();

    const lpa = await card('Leads per activity');
    expect(lpa).toHaveTextContent('0.38');
    expect(lpa).toHaveTextContent('Benchmark: 0.30');
    expect(within(lpa).getByText('On track')).toBeInTheDocument();
  });

  it('AC-2: shows not enough data as a dash and says so, with the benchmark still there', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const mpa = await card('Meeting per approach');
    expect(mpa).toHaveTextContent('–');
    expect(within(mpa).getByText('Not enough data')).toBeInTheDocument();
    expect(mpa).toHaveTextContent('Benchmark: 1.50');
    expect(mpa).not.toHaveTextContent('0.00');
  });

  it('P10-T3 AC-4: draws only what the server sends — an agent’s three, no balance to show as failed', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('article', { name: 'Selling vs Recruitment' })).not.toBeInTheDocument();
  });

  it('P13.1-T6 AC-1, AC-2: draws two selling and three recruiting as 40% · 60%, the marker nearer Recruitment', async () => {
    stubFetch({ '/activity/ratios': { body: view([balance({ value: -20, share: 40, numeratorCount: 2, denominatorCount: 3 })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const scale = await card('Selling vs Recruitment');
    expect(scale).toHaveTextContent('More Selling');
    expect(scale).toHaveTextContent('More Recruitment');
    expect(scale).toHaveTextContent('40% Selling · 60% Recruitment · On track');
    expect(scale).toHaveTextContent('On track while each side is between 35% and 65%.');
    // 60% of the way from Selling's end: past the middle, toward Recruitment.
    expect(within(scale).getByTestId('balance-marker').style.left).toBe('60%');
    // The client's request: no 100% / 0% / 100% ticks, and no figure on the marker.
    expect(within(scale).getByTestId('balance-marker')).toBeEmptyDOMElement();
    expect(within(scale).queryByText('0%')).not.toBeInTheDocument();
    expect(within(scale).queryByText('100%')).not.toBeInTheDocument();
    expect(scale).not.toHaveTextContent(/points/);
  });

  it('P13.1-T6 AC-1: leans the other way, and an even split reads 50% · 50%', async () => {
    const { mock } = stubFetch({ '/activity/ratios': { body: view([balance({ value: 24.4, share: 62.2 })]) } });
    const { unmount } = renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const leaning = await card('Selling vs Recruitment');
    expect(leaning).toHaveTextContent('62% Selling · 38% Recruitment · On track');
    expect(within(leaning).getByTestId('balance-marker').style.left).toBe('37.8%');
    unmount();
    mock.mockClear();

    stubFetch({ '/activity/ratios': { body: view([balance({ value: 0.4975, share: 50.25, status: 'success' })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await card('Selling vs Recruitment')).toHaveTextContent('50% Selling · 50% Recruitment · On track');
  });

  it('P13.1-T6 AC-3: says not enough data for nothing on either side, and draws no marker', async () => {
    stubFetch({ '/activity/ratios': { body: view([balance({ value: null, share: null, status: 'neutral', numeratorCount: 0, denominatorCount: 0 })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const scale = await card('Selling vs Recruitment');
    expect(scale).toHaveTextContent('Not enough data yet.');
    expect(scale).toHaveTextContent('On track while each side is between 35% and 65%.');
    expect(within(scale).queryByTestId('balance-marker')).not.toBeInTheDocument();
  });

  it('P13.1-T6 AC-5: never writes a miss as a split that reads as on track, nor a rate that does', async () => {
    stubFetch({ '/activity/ratios': { body: view([
      balance({ value: 30.43, share: 65.2, status: 'alert' }),
      rate({ code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3, value: 8 / 27, status: 'alert' }),
    ]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await card('Selling vs Recruitment')).toHaveTextContent('65.2% Selling · 34.8% Recruitment · Below benchmark');
    expect(await card('Leads per activity')).toHaveTextContent('0.296');
  });

  it('P13.1-T6 AC-6: names an office’s own balance by its sections, and a side with none as Side A or B', async () => {
    const { mock } = stubFetch({ '/activity/ratios': { body: view([balance({
      code: 'LEADS_VS_SELLING', label: 'Prospecting vs Selling', sides: { numerator: 'Leads Generation', denominator: 'Selling' },
      value: 50, share: 75, status: 'alert',
    })]) } });
    const { unmount } = renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const own = await card('Prospecting vs Selling');
    expect(own).toHaveTextContent('More Leads Generation');
    expect(own).toHaveTextContent('75% Leads Generation · 25% Selling · Below benchmark');
    unmount();
    mock.mockClear();

    stubFetch({ '/activity/ratios': { body: view([balance({ sides: { numerator: 'Selling', denominator: null } })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await card('Selling vs Recruitment')).toHaveTextContent('62% Selling · 38% Side B · On track');
  });

  it('AC-5: explains a ratio on request — the office’s formula by number and name, and what it measures', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const ssr = await card('Selling success rate');

    await userEvent.click(within(ssr).getByText('What is this ratio?'));

    expect(within(ssr).getByText('Submission polis, divided by Presentasi penjualan plus Follow up penjualan')).toBeInTheDocument();
    expect(within(ssr).getByText('6 — Submission polis')).toBeInTheDocument();
    expect(within(ssr).getByText('Mengukur tingkat konversi aktivitas selling menjadi submission')).toBeInTheDocument();
  });

  it('AC-5: says when the office has set its own formula, and gives no platform sentence for it', async () => {
    stubFetch({ '/activity/ratios': { body: view([rate({ divergesFromStandard: true, purpose: null })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const ssr = await card('Selling success rate');

    await userEvent.click(within(ssr).getByText('What is this ratio?'));

    expect(within(ssr).getByText('Your office has set its own formula for this ratio.')).toBeInTheDocument();
    expect(within(ssr).queryByText(/Mengukur/)).not.toBeInTheDocument();
  });

  it('says so when the office has no ratios for this role', async () => {
    stubFetch({ '/activity/ratios': { body: view([]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await screen.findByText(/Your office has no ratios for your role yet/)).toBeInTheDocument();
  });

  it('waits in the shape of cards, and says so when it fails', async () => {
    stubFetch({ '/activity/ratios': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
