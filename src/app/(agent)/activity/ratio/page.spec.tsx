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
  benchmark: 0.3, tag: { code: 'SELLING', label: 'Selling' }, sides: null,
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
  denominator: [term('RECRUIT_PRESENTATION', 'Melakukan presentasi recruitment', 7)],
  purpose: 'Memantau keseimbangan fokus antara aktivitas selling dan recruitment',
  value: 24.4, share: 62.2, status: 'success', ...over,
});
const view = (ratios: unknown[]) => ({ membershipId: 'm-1', from: '2026-08-30', to: '2026-09-28', days: 30, ratios });

/** The seed's three for an agent, at the client's benchmarks (ADR-0160 §2), each with data enough to read. */
const AGENT_VIEW = view([
  rate({}),
  rate({
    code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 1,
    tag: { code: 'LEADS_GENERATION', label: 'Leads Generation' }, value: 1.375, status: 'success',
  }),
  rate({
    code: 'MEETING_PER_APPROACH', label: 'Set appointment to meeting', displayUnit: 'percent', benchmark: 0.5,
    tag: { code: 'LEADS_GENERATION', label: 'Leads Generation' }, value: 0.4, numeratorCount: 4, denominatorCount: 10,
    status: 'alert',
  }),
]);

/** The same three, the last with nothing under it: `value: null` is the API's *not enough data* (`ratios.md`). */
const THIN_VIEW = view([
  ...AGENT_VIEW.ratios.slice(0, 2),
  rate({
    code: 'MEETING_PER_APPROACH', label: 'Set appointment to meeting', displayUnit: 'percent', benchmark: 0.5,
    tag: { code: 'LEADS_GENERATION', label: 'Leads Generation' }, value: null, numeratorCount: 0, denominatorCount: 0,
    status: 'neutral',
  }),
]);

const card = async (name: string) => (await screen.findByRole('article', { name }));

describe('Activity Ratios (P10-T2, P10-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, AC-6: says it is the last 30 days — which days — and never that the benchmarks are placeholders', async () => {
    const { calls } = stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    expect(await screen.findByText(/Calculated on the/)).toHaveTextContent(
      'Calculated on the last 30 days of activity · 30 Agu – 28 Sep 2026.',
    );
    expect(screen.queryByText(/placeholders/)).not.toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/activity/ratios'))!.url).toMatch(/\/activity\/ratios$/);
  });

  it('P18.95-T7 AC-1 keeps the sub-line from 768px and draws it nowhere on a phone (grey text row 25)', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    await screen.findByText(/Calculated on the/);
    expect(screen.getByText('How your activity is converting.')).toHaveClass('max-md:hidden');
  });

  it('AC-3: writes each value as its benchmark is written, with its status in words', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const ssr = await card('Selling success rate');
    expect(ssr).toHaveTextContent('9,1%');
    expect(ssr).toHaveTextContent('Benchmark: 30,0%');
    expect(within(ssr).getByText('Below benchmark')).toBeInTheDocument();
    expect(within(ssr).getByText('Selling')).toBeInTheDocument();

    const lpa = await card('Leads per activity');
    expect(lpa).toHaveTextContent('1,38');
    expect(lpa).toHaveTextContent('Benchmark: 1,00');
    expect(within(lpa).getByText('On track')).toBeInTheDocument();
  });

  /*
   * **Was AC-2** (P10-T2): a ratio with nothing under it was a card of *–*, *Not enough data* and its benchmark.
   * The client asked for it to go (2026-10-26, UI-030): it is a card with nothing to read.
   */
  it('P18.95-T5 AC-6: leaves a ratio with too little data to read off the list, and draws the rest', async () => {
    stubFetch({ '/activity/ratios': { body: THIN_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    await card('Selling success rate');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('article', { name: 'Set appointment to meeting' })).not.toBeInTheDocument();
    expect(screen.queryByText('Not enough data')).not.toBeInTheDocument();
    expect(screen.queryByText(/Not enough activity/)).not.toBeInTheDocument();
  });

  it('P18.95-T5 AC-6: says so in its empty card when no ratio has data enough — not that the office has none', async () => {
    stubFetch({ '/activity/ratios': { body: view([
      THIN_VIEW.ratios[2],
      balance({ value: null, share: null, status: 'neutral', numeratorCount: 0, denominatorCount: 0 }),
    ]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    expect(await screen.findByText('Not enough activity in the last 30 days to work out your ratios yet.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText(/no ratios for your role/)).not.toBeInTheDocument();
  });

  it('P18.8-T9 AC-1: writes Set appointment to meeting as a percent, against 50%', async () => {
    // The name, the unit and the benchmark are the office's, as the server sends them; the screen writes them.
    stubFetch({
      '/activity/ratios': {
        body: view([rate({
          code: 'MEETING_PER_APPROACH', label: 'Set appointment to meeting', displayUnit: 'percent', benchmark: 0.5,
          tag: { code: 'LEADS_GENERATION', label: 'Leads Generation' }, value: 0.6, numeratorCount: 6, denominatorCount: 10,
          status: 'success',
        })]),
      },
    });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const mpa = await card('Set appointment to meeting');
    expect(mpa).toHaveTextContent('60,0%');
    expect(mpa).toHaveTextContent('Benchmark: 50,0%');
    expect(within(mpa).getByText('On track')).toBeInTheDocument();
    expect(screen.queryByText(/Meeting per approach/)).not.toBeInTheDocument();
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
    expect(scale).toHaveTextContent('40,0% Selling · 60,0% Recruitment · On track');
    expect(scale).toHaveTextContent('On track while each side is between 35,0% and 65,0%.');
    // 60% of the way from Selling's end: past the middle, toward Recruitment.
    expect(within(scale).getByTestId('balance-marker').style.left).toBe('60%');
    // The client's request: no 100% / 0% / 100% ticks, and no figure on the marker.
    expect(within(scale).getByTestId('balance-marker')).toBeEmptyDOMElement();
    expect(within(scale).queryByText('0%')).not.toBeInTheDocument();
    expect(within(scale).queryByText('100%')).not.toBeInTheDocument();
    expect(scale).not.toHaveTextContent(/points/);
  });

  it('P13.1-T6 AC-1: leans the other way, and a split reads to its tenth (ADR-0167 §1)', async () => {
    const { mock } = stubFetch({ '/activity/ratios': { body: view([balance({ value: 24.4, share: 62.2 })]) } });
    const { unmount } = renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const leaning = await card('Selling vs Recruitment');
    expect(leaning).toHaveTextContent('62,2% Selling · 37,8% Recruitment · On track');
    expect(within(leaning).getByTestId('balance-marker').style.left).toBe('37.8%');
    unmount();
    mock.mockClear();

    stubFetch({ '/activity/ratios': { body: view([balance({ value: 0.4975, share: 50.25, status: 'success' })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await card('Selling vs Recruitment')).toHaveTextContent('50,3% Selling · 49,7% Recruitment · On track');
  });

  /* **Was P13.1-T6 AC-3**: nothing on either side read *Not enough data yet.* with no marker; now it is not drawn. */
  it('P18.95-T5 AC-6: leaves a balance with nothing on either side off the list', async () => {
    stubFetch({ '/activity/ratios': { body: view([
      rate({}),
      balance({ value: null, share: null, status: 'neutral', numeratorCount: 0, denominatorCount: 0 }),
    ]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    await card('Selling success rate');
    expect(screen.queryByRole('article', { name: 'Selling vs Recruitment' })).not.toBeInTheDocument();
    expect(screen.queryByText('Not enough data yet.')).not.toBeInTheDocument();
  });

  it('P13.1-T6 AC-5: never writes a miss as a split that reads as on track, nor a rate that does', async () => {
    stubFetch({ '/activity/ratios': { body: view([
      balance({ value: 30.43, share: 65.2, status: 'alert' }),
      rate({ code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3, value: 8 / 27, status: 'alert' }),
    ]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    // Off the band it says what to do (P18.95-T5 AC-6), where it said *Below benchmark*.
    expect(await card('Selling vs Recruitment'))
      .toHaveTextContent('65,2% Selling · 34,8% Recruitment · Too much selling — aim for 35,0%–65,0%');
    expect(await card('Leads per activity')).toHaveTextContent('0,296');
  });

  it('P13.1-T6 AC-6: names an office’s own balance by its sections, and a side with none as Side A or B', async () => {
    const { mock } = stubFetch({ '/activity/ratios': { body: view([balance({
      code: 'LEADS_VS_SELLING', label: 'Prospecting vs Selling', sides: { numerator: 'Leads Generation', denominator: 'Selling' },
      value: 50, share: 75, status: 'alert',
    })]) } });
    const { unmount } = renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const own = await card('Prospecting vs Selling');
    expect(own).toHaveTextContent('More Leads Generation');
    expect(own).toHaveTextContent('75,0% Leads Generation · 25,0% Selling · Too much leads generation — aim for 35,0%–65,0%');
    unmount();
    mock.mockClear();

    stubFetch({ '/activity/ratios': { body: view([balance({ sides: { numerator: 'Selling', denominator: null } })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await card('Selling vs Recruitment')).toHaveTextContent('62,2% Selling · 37,8% Side B · On track');
  });

  describe('P18.95-T5 AC-6: the balance reads what to do (the client’s UI review, UI-030)', () => {
    it('P18.95-T5 AC-6: too much selling — the client’s example, 67 to 33', async () => {
      stubFetch({ '/activity/ratios': { body: view([balance({ value: 34, share: 67, status: 'alert' })]) } });
      renderWithSession(<ActivityRatioPage />, { me: AGENT });
      const scale = await card('Selling vs Recruitment');
      expect(scale).toHaveTextContent('67,0% Selling · 33,0% Recruitment · Too much selling — aim for 35,0%–65,0%');
      expect(scale).not.toHaveTextContent('Below benchmark');
    });

    it('P18.95-T5 AC-6: too much recruitment, the other way', async () => {
      stubFetch({ '/activity/ratios': { body: view([balance({ value: -50, share: 25, status: 'alert' })]) } });
      renderWithSession(<ActivityRatioPage />, { me: AGENT });
      expect(await card('Selling vs Recruitment'))
        .toHaveTextContent('25,0% Selling · 75,0% Recruitment · Too much recruitment — aim for 35,0%–65,0%');
    });

    it('P18.95-T5 AC-6: aims for the office’s own band — ±20 points is 40–60, never a literal 35–65', async () => {
      stubFetch({ '/activity/ratios': { body: view([balance({ benchmark: 20, value: 30, share: 65, status: 'alert' })]) } });
      renderWithSession(<ActivityRatioPage />, { me: AGENT });
      const scale = await card('Selling vs Recruitment');
      expect(scale).toHaveTextContent('Too much selling — aim for 40,0%–60,0%');
      expect(scale).toHaveTextContent('On track while each side is between 40,0% and 60,0%.');
    });

    it('P18.95-T5 AC-6: in the band, today’s words', async () => {
      stubFetch({ '/activity/ratios': { body: view([balance({ value: -20, share: 40, status: 'success' })]) } });
      renderWithSession(<ActivityRatioPage />, { me: AGENT });
      const scale = await card('Selling vs Recruitment');
      expect(scale).toHaveTextContent('40,0% Selling · 60,0% Recruitment · On track');
      expect(scale).not.toHaveTextContent('Too much');
    });
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
