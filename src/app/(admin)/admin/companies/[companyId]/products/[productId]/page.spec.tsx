import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';
import { PRUDENTIAL, SUPER_ADMIN } from '@test/kpm-template-fixtures';
import ProductPage from './page';

const SA = { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'product_catalog:crud'] };

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/products/p2',
}));

const plan = {
  goodFit: 'Nasabah yang ingin perlindungan kesehatan', opening: 'Bapak/Ibu ingin asuransi kesehatan',
  benefits: ['8 pilihan plan'], fullScript: 'Script', objections: [{ objection: 'Mahal', answer: 'Mulai Rp200 ribu' }],
  nextAction: 'Buat ilustrasi',
};
const product = (id: string, code: string, name: string, over: Record<string, unknown> = {}) => ({
  id, companyId: 'c1', code, name, tagline: 'Asuransi kesehatan as-billed', channel: 'conventional', category: 'health',
  kind: 'base', attachesTo: [], currencies: ['IDR'], primaryNeeds: [], eligibleAgeBands: [], eligibleBudgetBands: [],
  benefits: [], differentiator: '', bestFor: '', defaultAttackPlan: plan, lifecycle: 'active', replacedByProductId: null,
  activeByDefault: true, sortOrder: 1, version: 1,
  proposalFields: [{ key: 'age', label: 'Usia masuk' }, { key: 'plan', label: 'Plan / kamar' }], ...over,
});
const draftOf = (s: string, draft: unknown = null) => ({
  id: 'p2', code: 'PRUSEHAT', name: 'PRUSehat', state: s, draft, releasedTo: null, firstPublishedAt: null,
  alsoFits: [], brochure: { label: 'brosur-prusehat.pdf' },
});

function render(s = 'published', extra: Record<string, unknown> = {}) {
  const sent: unknown[] = [];
  stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/products': { body: [product('p2', 'PRUSEHAT', 'PRUSehat'), product('p3', 'PRUWELL_HEALTH', 'PRUWell Health')] },
    'GET /admin/companies/c1/products/drafts': { body: [draftOf(s)] },
    'PUT /admin/companies/c1/products/p2/draft': ({ body }: { body: unknown }) => { sent.push(body); return { body: draftOf('draft', body) }; },
    ...extra,
  } as never);
  renderInIndonesian(<ProductPage params={routeParams({ companyId: 'c1', productId: 'p2' })} />, { me: SA });
  return sent;
}

/**
 * **P19.23-T4 AC-3 — one product** (ADR-0278 §4; frames 31–34): *Info produk*, the *Sales attack plan* with *Ubah* on
 * each part and *Juga sesuai*, *Proposal & premi*; changes saved as a draft, *Terbitkan…* to the publish tab.
 */
describe('P19.23-T4 AC-3 a product', () => {
  afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

  it('P19.23-T4 AC-3 Info produk saves only what changed as the draft, and says it is a draft', async () => {
    atWidth(1024);
    const sent = render();
    expect(await screen.findByText('Kesehatan · Konvensional')).toBeInTheDocument();
    expect(screen.getByText('brosur-prusehat.pdf')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Simpan draf' });
    expect(save).toBeDisabled();
    expect(screen.queryByText('Draf · belum diterbitkan')).toBeNull();
    await userEvent.clear(screen.getByLabelText('Nama produk'));
    await userEvent.type(screen.getByLabelText('Nama produk'), 'PRUSehat Plus');
    expect(screen.getByText('Draf · belum diterbitkan')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Mata uang'), 'both');
    await userEvent.click(save);
    await vi.waitFor(() => expect(sent).toEqual([{ name: 'PRUSehat Plus', currencies: ['IDR', 'USD'] }]));
    expect(screen.getByText(/Perubahan disimpan sebagai draf template/)).toBeInTheDocument();
  });

  it('P19.23-T4 AC-3 the Sales attack plan: each part with Ubah, and Juga sesuai by code', async () => {
    atWidth(390);
    const sent = render();
    await userEvent.click(await screen.findByRole('tab', { name: 'Sales attack plan' }));
    for (const title of ['Cocok untuk', 'Kalimat pembuka', 'Tekankan manfaat berikut', 'Script lengkap — cara menyampaikannya', 'Jika ada keberatan', 'Tindakan berikutnya', 'Juga sesuai']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    const opening = screen.getByRole('heading', { name: 'Kalimat pembuka' }).closest('section')!;
    await userEvent.click(within(opening).getByRole('button', { name: /Ubah/ }));
    await userEvent.clear(within(opening).getByRole('textbox', { name: 'Kalimat pembuka' }));
    await userEvent.type(within(opening).getByRole('textbox', { name: 'Kalimat pembuka' }), 'Halo');
    const also = screen.getByRole('heading', { name: 'Juga sesuai' }).closest('section')!;
    await userEvent.click(within(also).getByRole('button', { name: /Ubah/ }));
    await userEvent.click(within(also).getByRole('checkbox', { name: 'PRUWell Health' }));
    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan...' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c1/publish'));
    expect(sent).toEqual([{ defaultAttackPlan: { ...plan, opening: 'Halo' }, alsoFits: ['PRUWELL_HEALTH'] }]);
  });

  it('P19.23-T4 AC-3 Proposal & premi lists the columns in order and opens the premium table', async () => {
    render('unpublished');
    expect(await screen.findByText('Draf · belum diterbitkan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Proposal & premi' }));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(expect.arrayContaining(['1Usia masuk', '2Plan / kamar']));
    expect(screen.getByRole('link', { name: /Tabel premi · ganti file/ })).toHaveAttribute('href', '/admin/companies/c1/proposal');
  });

  it('P19.23-T4 AC-3 says the API’s refusal of a draft, and a product that is not the company’s', async () => {
    render('published', {
      'PUT /admin/companies/c1/products/p2/draft': { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Ubah minimal satu isian.' } } },
    });
    await userEvent.type(await screen.findByLabelText('Deskripsi singkat (kartu katalog)'), ' x');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan draf' }));
    expect(await screen.findByText('Ubah minimal satu isian.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL] }, '/admin/companies/c1/products': { body: [] }, '/admin/companies/c1/products/drafts': { body: [] },
    });
    renderInIndonesian(<ProductPage params={routeParams({ companyId: 'c1', productId: 'nope' })} />, { me: SA });
    expect(await screen.findByText('Produk ini bukan milik perusahaan ini.')).toBeInTheDocument();
  });

  it('P19.23-T4 AC-3 passes axe on each tab', async () => {
    atWidth(1280);
    render();
    await screen.findByText('Kesehatan · Konvensional');
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    for (const tab of ['Info produk', 'Sales attack plan', 'Proposal & premi']) {
      await userEvent.click(screen.getByRole('tab', { name: tab }));
      expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
    }
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the product’s page is left on any tab', async () => {
    atWidth(1280);
    render();
    await screen.findByText('Kesehatan · Konvensional');
    for (const tab of ['Info produk', 'Sales attack plan', 'Proposal & premi']) {
      await userEvent.click(screen.getByRole('tab', { name: tab }));
      expect(englishShown(document.body, englishOnly(adminCompaniesConsoleMessages)), tab).toEqual([]);
    }
  });
});
