import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { plan, product, RINA_ME, SHELF, SHELL_STUBS } from '@test/sales-tools-fixtures';
import ProductCatalogLayout from '@/app/(agent)/product-catalog/layout';
import ProductDrawerPage from '@/app/(agent)/product-catalog/[productCode]/page';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import AttackPlanPage from './page';

const nav = vi.hoisted(() => ({
  push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/attack-plan', search: '',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));
beforeEach(() => { nav.search = ''; nav.pathname = '/attack-plan'; });

type Routes = Record<string, StubReply | StubReply[]>;

/** *PRUMapan* with the demo's rider on it, as the seed attaches it (`sales-tools-fixture.ts`). */
const WITH_RIDER = product({
  riders: [{ code: 'PRUPERSONAL_ACCIDENT_D_D_PLUS', name: 'PRUPersonal Accident D&D Plus' }],
  currencies: ['IDR', 'USD'],
});

function drawer(routes: Routes = {}) {
  nav.pathname = '/product-catalog/PRUMAPAN';
  stubFetch({
    ...SHELL_STUBS, 'GET /product-catalog': { body: { products: SHELF } },
    'GET /product-catalog/PRUMAPAN': { body: WITH_RIDER }, ...routes,
  });
  renderInLayout(
    AgentLayout,
    <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRUMAPAN' })} /></ProductCatalogLayout>,
    { me: RINA_ME },
  );
}

function thePlan() {
  nav.search = new URLSearchParams({ need: 'retirement', age: '2', budget: '2' }).toString();
  stubFetch({
    ...SHELL_STUBS, 'GET /attack-plan': { body: plan({ product: WITH_RIDER }) },
    'GET /product-catalog': { body: { products: SHELF } },
  });
  renderInLayout(AgentLayout, <AttackPlanPage />, { me: RINA_ME });
}

/**
 * **P19.4-T4 AC-5 — an agent meets a rider only inside a base** (the riders spec's rule 3; ADR-0209 §3): *"Bisa
 * ditambah: <rider names>"* in the product's detail and in the Sales Attack Plan, laptop and phone; and AC-12, the
 * currency on the product's tags.
 */
describe('P19.4-T4 "Bisa ditambah" and the currency, where an agent reads a product', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T4 AC-5 the drawer says "Can be added:" and the rider’s name under the base', async () => {
    drawer();
    const box = await screen.findByRole('dialog', { name: 'PRUMapan' });
    expect(within(box).getByText('Can be added:').closest('[data-part="riders"]'))
      .toHaveTextContent('Can be added: PRUPersonal Accident D&D Plus');
    // AC-12: the codes beside the channel.
    expect(within(box).getByLabelText('Sold in IDR + USD')).toHaveTextContent('IDR + USD');
  });

  it('P19.4-T4 AC-5 says it in the riders spec’s own Indonesian: "Bisa ditambah:"', () => {
    expect(productCatalogMessages.id.canBeAdded).toBe('Bisa ditambah:');
  });

  it('P19.4-T4 AC-5 a base with no rider says nothing about riders', async () => {
    drawer({ 'GET /product-catalog/PRUMAPAN': { body: product() } });
    const box = await screen.findByRole('dialog', { name: 'PRUMapan' });
    expect(within(box).queryByText('Can be added:')).not.toBeInTheDocument();
  });

  it('P19.4-T4 AC-5 the Sales Attack Plan shows it under the product it recommends', async () => {
    atWidth(1280);
    thePlan();
    const line = (await screen.findByText('Can be added:')).closest('[data-part="riders"]');
    expect(line).toHaveTextContent('Can be added: PRUPersonal Accident D&D Plus');
    // Never a pick of its own: not among the alternatives.
    expect(screen.queryByRole('button', { name: 'PRUPersonal Accident D&D Plus' })).not.toBeInTheDocument();
  });

  it('P19.4-T4 AC-5 on a phone too', async () => {
    atWidth(375);
    thePlan();
    const line = (await screen.findByText('Can be added:')).closest('[data-part="riders"]');
    expect(line).toHaveTextContent('Can be added: PRUPersonal Accident D&D Plus');
  });
});
