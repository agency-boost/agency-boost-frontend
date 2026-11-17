import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import CompanyProposalPage from '@/app/(admin)/admin/companies/[companyId]/proposal/page';
import DataProdukPage from '@/app/(tenant)/kpm/data-produk/page';
import { productDataMessages } from '@/i18n/messages/product-data';
import { productDataAccessMessages } from '@/i18n/messages/product-data-access';
import { productDataIntakeMessages } from '@/i18n/messages/product-data-intake';
import type { ProductDataOverview, ProductDataRow } from '@/lib/product-data';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/co-1/proposal',
  useSearchParams: () => new URLSearchParams(''),
}));

const row = (over: Partial<ProductDataRow> = {}): ProductDataRow => ({
  productId: 'p-pcb', code: 'PRUCRITICAL_BENEFIT_88', name: 'PCB88', category: 'ci', isSyariah: false, calcType: 'up_premium',
  lifecycle: 'active', status: 'ready', checkReasons: [],
  table: { state: 'active', id: 't-1', version: 1, effectiveFrom: '2026-04-01', effectiveTo: null, gapCount: 0, scheduledFrom: '2026-12-12' },
  illustration: { state: 'none', blocks: 0 }, ...over,
});

const overview = (canManage: boolean): ProductDataOverview => ({
  company: { id: 'co-1', name: 'Prudential' }, canManage,
  counters: { check: 1, manual: 1, ready: 1, withdrawn: 0 },
  lastUpdated: { at: '2026-11-12T03:00:00.000Z', by: { id: 'u-1', name: 'Sari Admin' } },
  products: [
    row({ productId: 'p-cinta', code: 'PRUCINTA', name: 'PRUCinta', status: 'check', checkReasons: ['gaps'], table: { state: 'gaps', id: 't-9', version: 1, effectiveFrom: '2026-07-01', effectiveTo: null, gapCount: 3, scheduledFrom: null } }),
    row({ productId: 'p-anug', code: 'PRUANUGERAH_SYARIAH', name: 'PRU Anugerah Syariah', isSyariah: true, status: 'manual', table: { state: 'none', id: null, version: null, effectiveFrom: null, effectiveTo: null, gapCount: 0, scheduledFrom: null }, illustration: { state: 'published', blocks: 3 } }),
    row(),
  ],
});

const ENGLISH = englishOnly(productDataMessages, productDataAccessMessages, productDataIntakeMessages);

/**
 * **P18.10-T7 AC-1 for the two pages of P19.15: the company *Proposal* tab and *Data produk*, read in Indonesian.** Both
 * mount `ProposalDataScreen`; each is rendered whole — its frame, its counters, its rows, *Unggah file* — and read for
 * English of ours left on the screen.
 */
describe('P19.15 the product data pages in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.15-T1 /admin/companies/[companyId]/proposal: the Super Admin’s tab, in full', async () => {
    stubFetch({
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential' }] },
      '/product-data/companies/co-1/products': { body: overview(true) },
      '/product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [] } },
    });
    const me = makeMe({ membership: null, permissions: ['product_data:read', 'product_data:manage'] });
    renderInIndonesian(<CompanyProposalPage params={routeParams({ companyId: 'co-1' })} />, { me });
    expect(await screen.findByText('PRUCinta')).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it('P19.15-T4 /kpm/data-produk: a holder of Kelola data produk, the insurer’s tab in full', async () => {
    stubFetch({
      'GET /product-data/companies/co-1/products': { body: overview(true) },
      '/product-data/companies/co-1/intakes': { body: { aiReading: false, intakes: [] } },
      'GET /product-data/companies': { body: { items: [{ companyId: 'co-1', name: 'Prudential', canManage: true, own: true }] } },
    });
    const me = makeMe({
      membership: {
        membershipId: 'mem-maya', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: true, directCount: 0,
      },
      permissions: ['member:read_profile', 'product_data:read', 'product_data:manage'],
      productDataCompanyIds: ['co-1'],
    });
    renderInIndonesian(<DataProdukPage />, { me });
    expect(await screen.findByText('PRUCinta')).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });
});
