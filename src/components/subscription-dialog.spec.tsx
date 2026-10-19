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
