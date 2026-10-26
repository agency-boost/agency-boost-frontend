import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
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
 * **The subscription's cost** (P18.8-T3 AC-2, ADR-0157 §6): beside the price per leader, the whole quota's month, the
 * duration and the cost over it, worked out as the fields are typed; *—* naming what is missing where a line cannot be.
 */
describe('SubscriptionDialog: the subscription’s cost (P18.8-T3)', () => {
  /** The value beside a term of the cost list. */
  const line = (dialog: HTMLElement, term: string | RegExp) =>
    within(dialog).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

  it('AC-2 shows the month for the whole quota, the duration and the cost over it', () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    expect(line(dialog, 'Per month for 10 leaders')).toBe('Rp 3.500.000');
    expect(line(dialog, 'Duration')).toBe('12 months');
    expect(line(dialog, 'Over the duration')).toBe('Rp 42.000.000');
  });

  it('AC-2 recomputes as the fields change', async () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    const max = within(dialog).getByLabelText('Maximum leaders');
    await userEvent.clear(max);
    await userEvent.type(max, '13');
    expect(line(dialog, 'Per month for 13 leaders')).toBe('Rp 4.550.000');
    const end = within(dialog).getByLabelText('End date');
    await userEvent.clear(end);
    await userEvent.type(end, '2026-03-20');
    expect(line(dialog, 'Duration')).toBe('3 months');
    expect(line(dialog, 'Over the duration')).toBe('Rp 13.650.000');
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

  it('P18.8-T2 says a limit below the count demotes nobody, and that each new leader past it waits for AgencyBoost', async () => {
    render(<SubscriptionDialog row={ROW} open onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
    const max = within(dialog).getByLabelText('Maximum leaders');
    await userEvent.clear(max);
    await userEvent.type(max, '4');
    expect(dialog).toHaveTextContent("each new AB or AAB past 4 waits for AgencyBoost's approval");
  });
});
