import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InLanguage, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import type { ActivityRatio } from '@/lib/activity';
import { PersonalRatioCard, RatioCard } from './ratio-card';

const term = (code: string, label: string, displayOrder: number) => ({ code, label, displayOrder });
const rate = (over: Partial<ActivityRatio> = {}): ActivityRatio => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent',
  benchmark: 0.3, tag: { code: 'SELLING', label: 'Selling' }, sides: null,
  numerator: [term('SELL_SUBMISSION', 'Submission polis', 6)],
  denominator: [term('SELL_PRESENTATION', 'Sales meeting', 4)],
  purpose: null, divergesFromStandard: false,
  value: 0.296, share: null, numeratorCount: 8, denominatorCount: 27, status: 'alert',
  ...over,
});
const balance = (over: Partial<ActivityRatio> = {}) => rate({
  code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points',
  benchmark: 30, tag: null, sides: { numerator: 'Selling', denominator: 'Recruitment' },
  value: 16, share: 58, status: 'success', ...over,
});

/** The five, as the Unit Dashboard's mockup draws them (UI-001): the split, then four rows. */
const FIVE: ActivityRatio[] = [
  balance(),
  rate(),
  rate({ code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate', value: 0.333, status: 'success' }),
  rate({ code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 1, value: 0.23, status: 'alert' }),
  rate({ code: 'MEETING_PER_APPROACH', label: 'Set appointment to meeting', benchmark: 0.5, value: null, status: 'neutral' }),
];

const row = (code: string) => document.querySelector(`[data-ratio="${code}"]`) as HTMLElement;

describe('RatioCard (UI V1, UI-053; O-3 rows)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-053 one navy card, its header inside it: "Ratio · last 30 days", with the Unit | Group slot beside it', () => {
    render(<RatioCard ratios={FIVE} headerRight={<button type="button">Unit</button>} />);
    const card = document.querySelector('[data-ratio-card]')!;
    expect(card).toHaveClass('bg-navy', 'rounded-lg');
    expect(screen.getByRole('heading', { name: 'Ratio · last 30 days' })).toBeInTheDocument();
    expect(within(card as HTMLElement).getByRole('button', { name: 'Unit' })).toBeInTheDocument();
  });

  it('UI-053 every ratio is a row, also with no data, in the order the office set — the balance is the split bar', () => {
    render(<RatioCard ratios={FIVE} />);
    const rows = [...document.querySelectorAll('[data-ratio]')].map((el) => el.getAttribute('data-ratio'));
    expect(rows).toEqual(['SELLING_SUCCESS_RATE', 'RECRUITMENT_SUCCESS_RATE', 'LEADS_PER_ACTIVITY', 'MEETING_PER_APPROACH']);
    expect(document.querySelector('[data-ratio="SELLING_VS_RECRUITMENT"]')).toBeNull();
  });

  it('UI-053 / UI-080 a whole percentage, coloured on the unrounded value: 29,6% reads 30% and stays red under a 30% target', () => {
    render(<RatioCard ratios={FIVE} />);
    const value = within(row('SELLING_SUCCESS_RATE')).getByText('30%');
    expect(value).toHaveAttribute('data-status', 'alert');
    expect(value).toHaveClass('text-on-navy-red');
    expect(within(row('SELLING_SUCCESS_RATE')).getByText('Target 30%')).toHaveClass('text-on-navy-muted');
    expect(within(row('RECRUITMENT_SUCCESS_RATE')).getByText('33%')).toHaveClass('text-on-navy-green');
  });

  it('UI-053 Leads per activity keeps two places, "0,23" in Indonesian figures, "0.23" in English', () => {
    const { unmount } = renderInIndonesian(<RatioCard ratios={FIVE} />);
    expect(within(row('LEADS_PER_ACTIVITY')).getByText('0,23')).toBeInTheDocument();
    expect(within(row('LEADS_PER_ACTIVITY')).getByText('Target 1,00')).toBeInTheDocument();
    unmount();
    render(<InLanguage language="en"><RatioCard ratios={FIVE} /></InLanguage>);
    expect(within(row('LEADS_PER_ACTIVITY')).getByText('0.23')).toBeInTheDocument();
  });

  it('UI-053 "–" in lavender with too little data, heard as "Not enough data" — never 0, never hidden', () => {
    render(<RatioCard ratios={FIVE} />);
    const value = row('MEETING_PER_APPROACH').querySelector('[data-status]')!;
    expect(value).toHaveAttribute('data-status', 'none');
    expect(value).toHaveClass('text-on-navy-lavender');
    expect(value).toHaveTextContent('–Not enough data');
  });

  it('UI-053 the split bar: Selling 58% on the accent in navy words, Recruitment 42% on lavender in white, read whole', () => {
    render(<RatioCard ratios={FIVE} />);
    const bar = screen.getByRole('img', { name: 'Selling 58% · Recruitment 42%' });
    const [left, right] = bar.querySelectorAll(':scope > span:not([aria-hidden])');
    expect(left).toHaveClass('bg-amber');
    expect(right).toHaveClass('bg-lavender');
    expect(screen.getByText('Selling 58%')).toHaveClass('text-navy');
    expect(screen.getByText('Recruitment 42%')).toHaveClass('text-white');
    expect(screen.getByText('Selling vs Recruitment')).toBeInTheDocument();
  });

  it('UI-053 a side with nothing on it: the words sit on the other side, in its colour', () => {
    render(<RatioCard ratios={[balance({ share: 0, value: -100, status: 'alert' })]} />);
    expect(screen.getByText('Selling 0%')).toHaveClass('text-white');
  });

  it('UI-053 no pills, dots or verdict words on the card', () => {
    render(<RatioCard ratios={FIVE} />);
    const card = document.querySelector('[data-ratio-card]')!;
    expect(card.textContent).not.toMatch(/On track|Below|benchmark|Not enough data[A-Z]/);
    expect(card.querySelector('.rounded-full')).toBeNull();
  });

  it('UI-053 says what it is waiting for, and why there is nothing', () => {
    const { rerender } = render(<RatioCard ratios={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('Working out the ratios…');
    rerender(<RatioCard ratios={[]} />);
    expect(screen.getByText('No ratio applies here yet.')).toBeInTheDocument();
  });

  it('UI-053 in Indonesian: "Ratio · 30 hari terakhir", "Target", "Data belum cukup"; the office’s names as named', () => {
    renderInIndonesian(<RatioCard ratios={FIVE} />);
    expect(screen.getByRole('heading', { name: 'Ratio · 30 hari terakhir' })).toBeInTheDocument();
    expect(within(row('SELLING_SUCCESS_RATE')).getByText('Target 30%')).toBeInTheDocument();
    expect(within(row('SELLING_SUCCESS_RATE')).getByText('Selling success rate')).toBeInTheDocument();
    expect(row('MEETING_PER_APPROACH')).toHaveTextContent('Data belum cukup');
  });
});

describe('PersonalRatioCard (UI-053: the Ratio page’s own data)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-053 reads the reader’s own last 30 days from GET /activity/ratios, as the Ratio page does', async () => {
    const { calls } = stubFetch({ '/activity/ratios': { body: { membershipId: 'm-1', from: '2026-10-01', to: '2026-10-30', days: 30, ratios: FIVE } } });
    renderWithSession(<PersonalRatioCard />);
    expect(await screen.findByText('Selling 58%')).toBeInTheDocument();
    expect(calls[0].url).toMatch(/\/activity\/ratios$/);
  });

  it('UI-053 / UI-062 a coachee’s on the Coaching Session: ?for=, the server’s reach and audit', async () => {
    const { calls } = stubFetch({ '/activity/ratios': { body: { membershipId: 'm-9', from: '2026-10-01', to: '2026-10-30', days: 30, ratios: FIVE } } });
    renderWithSession(<InLanguage language="en"><PersonalRatioCard membershipId="m-9" /></InLanguage>);
    await screen.findByText('Recruitment 42%');
    expect(calls[0].url).toMatch(/\/activity\/ratios\?for=m-9$/);
  });

  it('UI-053 says so when the read fails', async () => {
    stubFetch({ '/activity/ratios': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Membership not found.' } } } });
    renderWithSession(<PersonalRatioCard membershipId="m-x" />);
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});
