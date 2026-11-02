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

/** A ratio's row in the shared card (`RatioCard`, UI-053), by its code. */
const row = async (code: string) => {
  await screen.findByRole('region', { name: 'Ratio · last 30 days' });
  return document.querySelector(`[data-ratio="${code}"]`) as HTMLElement;
};

/**
 * **Activity › Ratio, UI V1** (UI-106, UI-053; O-3): the shared ratio card, exactly as Personal Summary and the Unit
 * Dashboard draw it. The old page's cards — a card per ratio, its pill, its benchmark sentence, the balance's track and
 * advice — went with it; `ratio-card.spec.tsx` pins the card, `ratio-balance.spec.ts` and `ratio-format.spec.ts` the
 * figures it writes.
 */
describe('Activity Ratios (P10-T2, P10-T3; UI V1, UI-106)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-106 reads the reader’s own last 30 days, and draws the shared card: its header, the bar, each ratio a row', async () => {
    const { calls } = stubFetch({ '/activity/ratios': { body: view([balance(), ...AGENT_VIEW.ratios]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const card = await screen.findByRole('region', { name: 'Ratio · last 30 days' });
    expect(card).toHaveAttribute('data-ratio-card');
    expect(card.querySelector('[data-split-bar]')).toHaveAccessibleName('Selling 62% · Recruitment 38%');
    expect([...card.querySelectorAll('[data-ratio]')].map((r) => r.getAttribute('data-ratio')))
      .toEqual(['SELLING_SUCCESS_RATE', 'LEADS_PER_ACTIVITY', 'MEETING_PER_APPROACH']);
    // No per-ratio cards, pills or benchmark sentence (UI-106).
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText(/Benchmark/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Below benchmark|On track/)).not.toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/activity/ratios'))!.url).toMatch(/\/activity\/ratios$/);
  });

  it('UI-106, UI-080 writes each value whole, against Target X, green or red as the server judged it', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const ssr = await row('SELLING_SUCCESS_RATE');
    expect(ssr).toHaveTextContent('Selling success rate');
    expect(ssr).toHaveTextContent('Target 30%');
    expect(ssr.querySelector('[data-status]')).toHaveTextContent('9%');
    expect(ssr.querySelector('[data-status]')).toHaveAttribute('data-status', 'alert');
    // *Leads per activity* is not a percentage: two places (UI-080).
    expect((await row('LEADS_PER_ACTIVITY')).querySelector('[data-status]')).toHaveTextContent('1.38');
  });

  it('UI-106 always shows every ratio: one with too little data reads –, said as Not enough data', async () => {
    stubFetch({ '/activity/ratios': { body: THIN_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const thin = await row('MEETING_PER_APPROACH');
    expect(thin).toHaveTextContent('Set appointment to meeting');
    expect(thin.querySelector('[data-status]')).toHaveAttribute('data-status', 'none');
    expect(thin.querySelector('[data-status]')).toHaveTextContent('–Not enough data');
  });

  it('UI-106 shows the bar and all four rows for a reader with no selling or recruitment data, as /summary does', async () => {
    const empty = { value: null, share: null, status: 'neutral', numeratorCount: 0, denominatorCount: 0 };
    stubFetch({ '/activity/ratios': { body: view([
      balance(empty),
      rate(empty),
      rate({ ...empty, code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate' }),
      rate({ ...empty, code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 1 }),
      rate({ ...empty, code: 'MEETING_PER_APPROACH', label: 'Set appointment to meeting', benchmark: 0.5 }),
    ]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const card = await screen.findByRole('region', { name: 'Ratio · last 30 days' });
    expect(card.querySelector('[data-split-bar]')).toHaveAccessibleName('Selling · Recruitment: Not enough data');
    expect(card.querySelectorAll('[data-ratio]')).toHaveLength(4);
    for (const value of card.querySelectorAll('[data-status]')) expect(value).toHaveAttribute('data-status', 'none');
  });

  it('UI-106 explains a ratio behind a tap on its row: what it measures, and its formula in the office’s words', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });

    const ssr = await row('SELLING_SUCCESS_RATE');
    const button = within(ssr).getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(ssr).toHaveTextContent('What is this ratio?');
    expect(ssr).toHaveTextContent('Mengukur tingkat konversi aktivitas selling menjadi submission');
    expect(ssr).toHaveTextContent('Submission polis, divided by Presentasi penjualan plus Follow up penjualan');
    // By name, never by the item numbers the log no longer draws.
    expect(ssr).not.toHaveTextContent(/\b[456]\b/);
    await userEvent.click(button);
    expect(ssr).not.toHaveTextContent('What is this ratio?');
  });

  it('UI-106 says when the office has set its own formula', async () => {
    stubFetch({ '/activity/ratios': { body: view([rate({ divergesFromStandard: true, purpose: null })]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const ssr = await row('SELLING_SUCCESS_RATE');
    await userEvent.click(within(ssr).getByRole('button'));
    expect(ssr).toHaveTextContent('Your office has set its own formula for this ratio.');
  });

  it('P18.95-T7 AC-1 keeps the sub-line from 768px and draws it nowhere on a phone (grey text row 25)', async () => {
    stubFetch({ '/activity/ratios': { body: AGENT_VIEW } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    await row('SELLING_SUCCESS_RATE');
    expect(screen.getByText('How your activity is converting.')).toHaveClass('max-md:hidden');
  });

  it('says so when the office has no ratios for this role', async () => {
    stubFetch({ '/activity/ratios': { body: view([]) } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    expect(await screen.findByText('No ratio applies here yet.')).toBeInTheDocument();
  });

  it('waits in the card’s shape, and says so in it when the read fails', async () => {
    stubFetch({ '/activity/ratios': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } } });
    renderWithSession(<ActivityRatioPage />, { me: AGENT });
    const failed = await screen.findByText('Something went wrong.');
    expect(failed.closest('[data-ratio-card]')).not.toBeNull();
  });
});
