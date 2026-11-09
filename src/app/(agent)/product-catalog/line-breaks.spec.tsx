import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch } from '@test/harness';
import { product, RINA_ME, SHELF, SHELL_STUBS } from '@test/sales-tools-fixtures';
import ProductCatalogLayout from './layout';
import ProductDrawerPage from './[productCode]/page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => nav,
  usePathname: () => '/product-catalog/PRUMAPAN',
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
}));

const STANDS_OUT = 'Premi tetap.\nUang kembali di akhir.';

/**
 * **The catalog's drawer shows what sets a product apart on the lines the company typed** (P19-T6 AC-1; the 11-03
 * handover's B1-2): *Details*' paragraph is `whitespace-pre-line`, and its text arrives as stored.
 */
describe('P19-T6 AC-1 the drawer’s Details on several lines', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T6 AC-1 draws what sets the product apart with its line breaks', async () => {
    stubFetch({
      ...SHELL_STUBS,
      'GET /product-catalog': { body: { products: SHELF } },
      'GET /product-catalog/PRUMAPAN': { body: product({ differentiator: STANDS_OUT }) },
    });
    renderInLayout(
      AgentLayout,
      <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRUMAPAN' })} /></ProductCatalogLayout>,
      { me: RINA_ME },
    );

    const box = await screen.findByRole('dialog', { name: 'PRUMapan' });
    const paragraph = Array.from(within(box).getAllByText(/Premi tetap\./))
      .map((el) => el.closest('p'))
      .find((p) => p?.textContent === STANDS_OUT);
    expect(paragraph).toBeDefined();
    expect(paragraph).toHaveClass('whitespace-pre-line');
  });
});
