import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';
import { adminTemplateProductsMessages } from '@/i18n/messages/admin-template-products';
import { PRUDENTIAL, SUPER_ADMIN } from '@test/kpm-template-fixtures';
import CompanyProductsPage from './page';
import ProductDetailsPage from './details/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/products',
}));

const plan = { goodFit: '', opening: '', benefits: [], fullScript: '', objections: [], nextAction: '' };
const product = (id: string, code: string, name: string, category: string, over: Record<string, unknown> = {}) => ({
  id, companyId: 'c1', code, name, tagline: `${name} tagline`, channel: 'conventional', category, kind: 'base',
  attachesTo: [], currencies: ['IDR'], primaryNeeds: [], eligibleAgeBands: [], eligibleBudgetBands: [], benefits: [],
  differentiator: '', bestFor: '', defaultAttackPlan: plan, lifecycle: 'active', replacedByProductId: null,
  activeByDefault: true, sortOrder: 1, version: 1, ...over,
});
const PRODUCTS = [
  product('p1', 'PRUMAPAN', 'PRUMapan', 'life'),
  product('p2', 'PRUSEHAT', 'PRUSehat', 'health'),
  product('p3', 'PRUCINTA', 'PRUCinta', 'life', { channel: 'syariah' }),
  product('p4', 'OLD', 'Old product', 'life', { lifecycle: 'withdrawn' }),
];
const state = (id: string, s: string, draft: unknown = null) => ({
  id, code: '', name: '', state: s, draft, releasedTo: null, firstPublishedAt: null, alsoFits: [], brochure: null,
});

function render(extra: Record<string, unknown> = {}) {
  stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/products': { body: PRODUCTS },
    '/admin/companies/c1/products/drafts': { body: [state('p1', 'published'), state('p2', 'draft', { name: 'PRUSehat Plus' }), state('p3', 'published')] },
    ...extra,
  } as never);
  renderInIndonesian(<CompanyProductsPage params={routeParams({ companyId: 'c1' })} />, { me: { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'product_catalog:crud'] } });
}

/**
 * **P19.23-T4 AC-3 — *Produk & proposal*** (ADR-0278 §4; frame 30): the catalogue per category with the cards agents
 * see, *Draf* on a product whose edits wait, *Tabel premi*, *+ Produk baru*.
 */
describe('P19.23-T4 AC-3 the catalogue', () => {
  afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

  it('P19.23-T4 AC-3 draws the catalogue per category, a draft’s words over the published, withdrawn left off', async () => {
    atWidth(1024);
    render();
    expect(await screen.findByRole('button', { name: 'Semua 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Jiwa 2' })).toBeInTheDocument();
    const jiwa = screen.getByRole('region', { name: 'Jiwa' });
    // The heading's count, and the phone's section header's (P19.26-T4, drawn below 768px alone).
    expect(within(jiwa).getAllByText('2 produk')).toHaveLength(2);
    expect(screen.queryByText('Old product')).toBeNull();
    const sehat = document.querySelector('[data-product-card="PRUSEHAT"]') as HTMLElement;
    expect(within(sehat).getByText('PRUSehat Plus')).toBeInTheDocument();
    expect(within(sehat).getByText('Draf')).toBeInTheDocument();
    expect(within(sehat).getByRole('link', { name: /Ubah/ })).toHaveAttribute('href', '/admin/companies/c1/products/p2');
    expect(within(document.querySelector('[data-product-card="PRUCINTA"]') as HTMLElement).getByText('Syariah')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tabel premi/ })).toHaveAttribute('href', '/admin/companies/c1/proposal');

    await userEvent.click(screen.getByRole('button', { name: 'Kesehatan 1' }));
    expect(screen.queryByRole('region', { name: 'Jiwa' })).toBeNull();
  });

  /*
   * **P19.26-T4 (UI-216 (21 Nov)): the catalogue on a phone.** Each category a section that opens and closes with its
   * count; each product a 56px row — name, *Syariah* only when syariah, a currency only when not IDR, ›. From 768px the
   * cards, as before. jsdom applies no media query: the two layouts are asserted by their classes.
   */
  it('P19.26-T4 AC-1 AC-2 AC-3 on a phone: sections that open and close, 56px rows, Syariah and a currency only when they say something', async () => {
    atWidth(375);
    render({
      '/admin/companies/c1/products': {
        body: [...PRODUCTS.slice(0, 2), product('p3', 'PRUCINTA', 'PRUCinta', 'life', { channel: 'syariah', currencies: ['IDR', 'USD'] })],
      },
    });
    const section = await screen.findByRole('button', { name: /Jiwa.*2 produk/ });
    expect(section.closest('[data-product-section]')).toHaveClass('md:hidden');
    // The category chips are 44px tall on a phone (the walk of 2026-11-22: 40px); 40px from 768px as before.
    for (const chip of within(screen.getByRole('group', { name: /./ })).getAllByRole('button')) {
      expect(chip).toHaveClass('min-h-10', 'max-md:min-h-11');
    }
    // The cards are the tablet's and the laptop's.
    expect(document.querySelector('[data-product-card="PRUMAPAN"]')!.closest('ul')).toHaveClass('max-md:hidden');
    expect(section).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-product-row]')).toBeNull();

    await userEvent.click(section);
    expect(section).toHaveAttribute('aria-expanded', 'true');
    const mapan = document.querySelector('[data-product-row="PRUMAPAN"]') as HTMLElement;
    expect(mapan).toHaveClass('min-h-14');
    expect(within(mapan).getByRole('link')).toHaveAttribute('href', '/admin/companies/c1/products/p1');
    // Conventional and IDR: nothing beside the name.
    expect(within(mapan).queryByText('Konvensional')).toBeNull();
    expect(within(mapan).queryByText('IDR')).toBeNull();
    const cinta = document.querySelector('[data-product-row="PRUCINTA"]') as HTMLElement;
    expect(within(cinta).getByText('Syariah')).toBeInTheDocument();
    expect(within(cinta).getByText('USD')).toBeInTheDocument();
    expect(within(cinta).queryByText('IDR')).toBeNull();

    await userEvent.click(section);
    expect(document.querySelector('[data-product-row]')).toBeNull();
  });

  it('P19.23-T4 AC-3 + Produk baru makes a product no KPM has yet, and opens it', async () => {
    atWidth(390);
    const sent: unknown[] = [];
    render({
      'POST /admin/companies/c1/products/drafts': ({ body }: { body: unknown }) => { sent.push(body); return { status: 201, body: product('p9', 'PRUWELL', 'PRUWell', 'health') }; },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Produk baru/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Produk baru' });
    await userEvent.type(within(dialog).getByLabelText(/Kode produk/), 'pruwell_medical');
    await userEvent.type(within(dialog).getByLabelText('Nama produk'), 'PRUWell Medical');
    await userEvent.selectOptions(within(dialog).getByLabelText('Kategori'), 'health');
    await userEvent.click(screen.getByRole('button', { name: 'Buat produk' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c1/products/p9'));
    expect(sent).toEqual([{ code: 'PRUWELL_MEDICAL', name: 'PRUWell Medical', category: 'health', channel: 'conventional' }]);
  });

  it('P19.23-T4 AC-3 ⋯ opens the full editor, and discards a draft after asking', async () => {
    atWidth(1280);
    let discarded = false;
    render({ 'DELETE /admin/companies/c1/products/p2/draft': () => { discarded = true; return { body: state('p2', 'published') }; } });
    await screen.findByText('PRUSehat Plus');
    await userEvent.click(screen.getByRole('button', { name: /PRUSehat Plus: lainnya/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Hapus draf/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus draf' }));
    await vi.waitFor(() => expect(discarded).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: /PRUMapan: lainnya/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Detail lengkap/ }));
    expect(push).toHaveBeenCalledWith('/admin/companies/c1/products/details#PRUMAPAN');
  });

  it('P19.23-T4 AC-3 passes axe in its populated state', async () => {
    atWidth(1280);
    render();
    await screen.findByText('PRUSehat Plus');
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the catalogue’s own is left', async () => {
    atWidth(1280);
    render();
    await screen.findByText('PRUSehat Plus');
    expect(englishShown(document.body, englishOnly(adminCompaniesConsoleMessages))).toEqual([]);
  });

  it('P18.10-T7 AC-1 Detail lengkap, the full editor behind ⋯, in Indonesian: no English left', async () => {
    atWidth(1280);
    stubFetch({ '/admin/companies': { body: [PRUDENTIAL] }, '/admin/companies/c1/products': { body: PRODUCTS } } as never);
    renderInIndonesian(<ProductDetailsPage params={routeParams({ companyId: 'c1' })} />, {
      me: { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'product_catalog:crud'] },
    });
    await screen.findByRole('button', { name: 'PRUMapan' });
    const english = englishOnly(adminCompaniesConsoleMessages, adminTemplateProductsMessages).filter((w) => w !== 'Code');
    expect(englishShown(document.body, english)).toEqual([]);
  });
});
