import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import DataProdukPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/data-produk',
  useSearchParams: () => new URLSearchParams(''),
}));

/*
 * The company *Proposal* tab is D1's screen (P19.15-T1, T4 AC-1), pinned in its own specs; here it stands as what this
 * page hands it — which company, and whether in full.
 */
vi.mock('@/components/proposal-data/proposal-data-screen', () => ({
  ProposalDataScreen: ({ companyId, canManage }: { companyId: string; canManage: boolean }) => (
    <section aria-label="Proposal tab" data-company={companyId} data-manage={String(canManage)} />
  ),
}));

const membership = {
  membershipId: 'mem-maya', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const, status: 'active' as const,
  isKpmOwner: false, isKpmAdmin: true, directCount: 0,
};
const HOLDER = makeMe({ membership, permissions: ['member:read_profile', 'product_data:read', 'product_data:manage'], productDataCompanyIds: ['co-pru', 'co-manu'] });
const OWNER = makeMe({ membership: { ...membership, isKpmAdmin: false, isKpmOwner: true }, permissions: ['member:read_profile', 'product_data:read'] });

const PRU = { companyId: 'co-pru', name: 'Prudential', canManage: true, own: true };
const MANU = { companyId: 'co-manu', name: 'Manulife', canManage: true, own: false };
const screenOf = () => screen.getByRole('region', { name: 'Proposal tab' });

/**
 * **P19.15-T4 AC-2, AC-3 — *Data produk*** (`/kpm/data-produk`; ADR-0260 §5): the company *Proposal* tab for each
 * insurer the reader may open, as `GET /product-data/companies` answers — a holder's ticked insurers in full, chosen
 * with chips; an Owner's own company read-only; and the session read again when the grant moved since it was read.
 */
describe('P19.15-T4 Data produk', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.15-T4 AC-2 a holder: a chip per insurer, her own first, each opening its tab in full', async () => {
    stubFetch({ '/product-data/companies': { body: { items: [PRU, MANU] } } });
    renderWithSession(<DataProdukPage />, { me: HOLDER });
    expect(await screen.findByRole('heading', { name: 'Product data' })).toBeInTheDocument();
    await waitFor(() => expect(screenOf()).toHaveAttribute('data-company', 'co-pru'));
    expect(screenOf()).toHaveAttribute('data-manage', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Manulife' }));
    expect(screenOf()).toHaveAttribute('data-company', 'co-manu');
    expect(screen.getByRole('button', { name: 'Manulife' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('P19.15-T4 AC-2 a holder whose own company is not ticked: its chip says it is only looked at', async () => {
    stubFetch({ '/product-data/companies': { body: { items: [{ ...PRU, canManage: false }, MANU] } } });
    renderWithSession(<DataProdukPage />, { me: { ...HOLDER, productDataCompanyIds: ['co-manu'] } });
    expect(await screen.findByRole('button', { name: 'Prudential · View only' })).toBeInTheDocument();
    expect(screenOf()).toHaveAttribute('data-manage', 'false');
  });

  it('P19.15-T4 AC-3 an Owner without it: their company alone, read-only, no chips', async () => {
    const reload = vi.fn(async () => undefined);
    stubFetch({ '/product-data/companies': { body: { items: [{ ...PRU, canManage: false }] } } });
    renderWithSession(<DataProdukPage />, { me: OWNER, reload });
    await waitFor(() => expect(screenOf()).toHaveAttribute('data-manage', 'false'));
    expect(screen.queryByRole('group', { name: 'Insurer' })).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('P19.15-T4 AC-2 a grant removed since the session was read: the page reads the session again, so the menu follows', async () => {
    const reload = vi.fn(async () => undefined);
    stubFetch({ '/product-data/companies': { body: { items: [{ ...PRU, canManage: false }] } } });
    renderWithSession(<DataProdukPage />, { me: HOLDER, reload });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('P19.15-T4 AC-2 says so when there is nothing to show, and shows the server\'s refusal', async () => {
    stubFetch({ '/product-data/companies': { body: { items: [] } } });
    renderWithSession(<DataProdukPage />, { me: OWNER });
    expect(await screen.findByText('There is no insurer\'s product data to show.')).toBeInTheDocument();

    vi.unstubAllGlobals();
    stubFetch({ '/product-data/companies': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } } });
    renderWithSession(<DataProdukPage />, { me: OWNER });
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
  });

  it.each([375, 1280])('P19.15-T4 AC-2 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    stubFetch({ '/product-data/companies': { body: { items: [PRU, MANU] } } });
    renderWithSession(<DataProdukPage />, { me: HOLDER });
    await screen.findByRole('button', { name: 'Manulife' });
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
