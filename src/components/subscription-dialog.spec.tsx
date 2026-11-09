import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, stubFetch } from '@test/harness';
import type { TenantRow } from '@/lib/admin';
import { SubscriptionDialog } from './subscription-dialog';

const ROW = {
  _id: 'kpm-1', companyId: 'co-1', companyName: 'Prudential', code: '0417',
  branchName: 'BSD City Branch', address: null, contactPhone: null,
  ownerUserId: 'u-owner', ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z',
  settings: {},
  subscription: {
    startDate: '2026-01-06', endDate: '2027-01-05', pricePerLeaderMinor: 350_000_00, currency: 'IDR',
    maxLeaders: 10, keepActiveAfterEnd: false,
  },
  leadersUsed: 6, subscriptionState: 'active',
} as unknown as TenantRow;

const refused = (field: string, message: string) => ({
  status: 400,
  body: { error: { code: 'VALIDATION_FAILED', message, details: { field }, requestId: 'r' } },
});

/**
 * **Each refusal under its field, in rupiah** (P13.2 exit review). The bounds are the API's, and its
 * refusal now names the field and speaks rupiah: it used to answer from the DTO first, *"pricePerLeader
 * Minor must not be greater than 10000000000"*, with no field the dialog could place.
 */
describe('SubscriptionDialog: the API’s refusals (P13.2 exit review)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['pricePerLeaderMinor', 'Price per leader per month', 'The price per leader must be from Rp 0 to Rp 100.000.000 a month.'],
    ['maxLeaders', 'Maximum leaders', 'The leader limit must be a whole number from 1 to 10.000, or empty for no limit.'],
  ])('shows a refusal of %s under its own field, and no banner', async (field, label, message) => {
    stubFetch({ 'PATCH /admin/tenants/kpm-1/subscription': refused(field, message) });
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    const input = within(dialog).getByLabelText(label);
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(within(dialog).getAllByRole('alert')).toHaveLength(1);
    expect(dialog).not.toHaveTextContent(/pricePerLeaderMinor|maxLeaders|\bsen\b/);
  });
});

/*
 * **The subscription's cost** (P18.5-T3 AC-2, ADR-0157 §6): beside the price per leader, the whole quota's month, the
 * duration and the cost over it, worked out as the fields are typed; *—* naming what is missing where a line cannot be.
 */
describe('SubscriptionDialog: the subscription’s cost (P18.5-T3)', () => {
  /** The value beside a term of the cost list. */
  const line = (dialog: HTMLElement, term: string | RegExp) =>
    within(dialog).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

  it('AC-2 shows the month for the whole quota, the duration and the cost over it', () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    expect(line(dialog, 'Per month for 10 leaders')).toBe('IDR 3,500,000');
    expect(line(dialog, 'Duration')).toBe('12 months');
    expect(line(dialog, 'Over the duration')).toBe('IDR 42,000,000');
  });

  it('AC-2 recomputes as the fields change', async () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    const max = within(dialog).getByLabelText('Maximum leaders');
    await userEvent.clear(max);
    await userEvent.type(max, '13');
    expect(line(dialog, 'Per month for 13 leaders')).toBe('IDR 4,550,000');
    const end = within(dialog).getByLabelText('End date');
    await userEvent.clear(end);
    await userEvent.type(end, '2026-03-20');
    expect(line(dialog, 'Duration')).toBe('3 months');
    expect(line(dialog, 'Over the duration')).toBe('IDR 13,650,000');
  });

  it('AC-2 reads — naming what is missing: no limit, no price, no dates', async () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    await userEvent.clear(within(dialog).getByLabelText('Maximum leaders'));
    expect(line(dialog, 'Per month')).toBe('— no maximum leaders');
    expect(line(dialog, 'Over the duration')).toBe('— no maximum leaders');
    await userEvent.clear(within(dialog).getByLabelText('Price per leader per month'));
    expect(line(dialog, 'Per month')).toBe('— no price per leader and no maximum leaders');
    await userEvent.clear(within(dialog).getByLabelText('Start date'));
    await userEvent.clear(within(dialog).getByLabelText('End date'));
    expect(line(dialog, 'Duration')).toBe('— no start and end dates');
    expect(line(dialog, 'Over the duration')).toBe('— no price per leader and no maximum leaders and no start and end dates');
  });

  it('P18.5-T2 says a limit below the count demotes nobody, and that each new leader past it waits for AgencyBoost', async () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    const max = within(dialog).getByLabelText('Maximum leaders');
    await userEvent.clear(max);
    await userEvent.type(max, '4');
    expect(dialog).toHaveTextContent("each new AB or AAB past 4 waits for AgencyBoost's approval");
  });
});

/*
 * **The plan** (P19.4-T3 AC-10; ADR-0211 §1): *Paket*, *6 bulan* or *Tahunan*. Choosing one proposes the end date — the
 * start plus the plan, less a day — and both dates stay editable; it is saved with the other five.
 */
describe('SubscriptionDialog: the plan (P19.4-T3 AC-10)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('P19.4-T3 AC-10 opens on the office’s plan, and choosing one proposes the end date from the start', async () => {
    render(<SubscriptionDialog row={{ ...ROW, subscription: { ...ROW.subscription!, plan: 'annual' } }} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    const plan = within(dialog).getByLabelText('Plan');
    expect(plan).toHaveValue('annual');
    await userEvent.selectOptions(plan, '6 months');
    // 6 January and six months ends on 5 July, a day before the half-year.
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2026-07-05');
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-01-06');
    // Still editable: the proposal is a starting point.
    const end = within(dialog).getByLabelText('End date');
    await userEvent.clear(end);
    await userEvent.type(end, '2026-08-31');
    expect(end).toHaveValue('2026-08-31');
  });

  it('P19.4-T3 AC-10 with no start date, the plan starts on the office’s today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 01:30 on 6 November in Jakarta, still the 5th in UTC.
    vi.setSystemTime(new Date('2026-11-05T18:30:00Z'));
    const bare = { ...ROW, subscription: null } as unknown as TenantRow;
    render(<SubscriptionDialog row={bare} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Plan'), 'Annual');
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-11-06');
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2027-11-05');
  });

  it('P19.4-T3 AC-10 saves the plan with the other fields, and none as null', async () => {
    const { calls } = stubFetch({ 'PATCH /admin/tenants/kpm-1/subscription': { body: ROW } });
    const onSaved = vi.fn();
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={onSaved} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    expect(within(dialog).getByLabelText('Plan')).toHaveValue('');
    await userEvent.selectOptions(within(dialog).getByLabelText('Plan'), 'Annual');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      startDate: '2026-01-06', endDate: '2027-01-05', pricePerLeaderMinor: 350_000_00, maxLeaders: 10,
      keepActiveAfterEnd: false, plan: 'annual',
    });
  });
});

/*
 * **P19.2-T2 AC-4 — no native select below 1024px** (UI-134: *choice rows (radio cards) inside the sheet for 2–5
 * options*): *Paket*'s three — none, *6 bulan*, *Tahunan* — as choice rows on a phone and a tablet, its hint still its
 * description; the laptop keeps its select. What a choice does is the same either way.
 */
describe('SubscriptionDialog: P19.2-T2 the plan below 1024px (UI-134)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx draws Plan as three choice rows, no select, and a choice proposes the end date', async (px) => {
    atWidth(px);
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    const plan = await within(dialog).findByRole('radiogroup', { name: 'Plan' });
    expect(document.querySelector('select')).toBeNull();
    expect(within(plan).getAllByRole('radio').map((r) => r.textContent)).toEqual(['No plan', '6 months', 'Annual']);
    expect(within(plan).getByRole('radio', { name: 'No plan' })).toBeChecked();
    expect(plan).toHaveAccessibleDescription(expect.stringContaining('Choosing a plan proposes the end date'));
    await userEvent.click(within(plan).getByRole('radio', { name: '6 months' }));
    expect(within(plan).getByRole('radio', { name: '6 months' })).toBeChecked();
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2026-07-05');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx saves the plan chosen from the rows, as the select did', async (px) => {
    atWidth(px);
    const { calls } = stubFetch({ 'PATCH /admin/tenants/kpm-1/subscription': { body: ROW } });
    const onSaved = vi.fn();
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={onSaved} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    await userEvent.click(await within(dialog).findByRole('radio', { name: 'Annual' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ plan: 'annual', endDate: '2027-01-05' });
  });

  it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx keeps the select, as the ticket allows a laptop', async (px) => {
    atWidth(px);
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    expect(within(dialog).getByLabelText('Plan').tagName).toBe('SELECT');
    expect(within(dialog).queryByRole('radiogroup')).toBeNull();
  });

  it.each([375, 1280])('P19.2-T2 AC-4 at %ipx the dialog has no axe violations', async (px) => {
    atWidth(px);
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole('dialog', { name: 'Edit subscription' });
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
