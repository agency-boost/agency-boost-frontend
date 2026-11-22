import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { PROPOSAL_LIMITS, type ProposalField } from '@/lib/admin';
import { ProductsTab } from './products-tab';

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['product_catalog:crud', 'commission_rates:read'],
});

const field = (over: Partial<ProposalField>): ProposalField => ({
  key: 'plan', label: 'Plan', labelSyariah: null, type: 'chips', options: [], default: null, quickAmounts: [],
  minMinor: null, showOnPdf: true, showOnSummary: false, paymentYears: false, plan: false, currency: false, draft: false,
  ...over,
});
const PLAN = field({
  key: 'plan', label: 'Plan', options: ['Silver', 'Gold'].map((label) => ({ label, years: null, currency: null })),
  default: 'Gold', plan: true, showOnSummary: true, draft: true,
});
const UP = field({ key: 'up', label: 'Uang pertanggungan', type: 'money', quickAmounts: [100_000_000_00] });

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1', companyId: 'c1', code: 'PRUWELL_MEDICAL', name: 'PRUWell Medical', tagline: '', channel: 'conventional',
  category: 'health', kind: 'base', attachesTo: [], currencies: ['IDR'], primaryNeeds: ['health'], eligibleAgeBands: [2],
  eligibleBudgetBands: [2], benefits: [], differentiator: '', bestFor: '',
  defaultAttackPlan: { goodFit: '', opening: '', benefits: [], fullScript: '', objections: [], nextAction: '' },
  commissionSchedule: [], lifecycle: 'active', replacedByProductId: null, activeByDefault: true, sortOrder: 1, version: 3,
  proposalFields: [PLAN, UP],
  planOptions: [{ name: 'Gold', highlights: [{ label: 'Kamar', value: 'Rp 1,5 Jt' }], popular: true }],
  faq: [{ question: 'Ada masa tunggu?', answer: 'Ya, 30 hari.' }],
  pdfDetail: [], syariahName: null, defaultInsured: null, proposalTypeLabel: null,
  ...over,
});

function mount(rows: unknown[] = [product()], indonesian = false) {
  const stub = stubFetch({
    '/admin/companies/c1/products': { body: rows },
    'PATCH /admin/companies/c1/products/p1': ({ body }: { body: unknown }) => ({ body: { ...product(), ...(body as object), version: 4 } }),
  } as Parameters<typeof stubFetch>[0]);
  (indonesian ? renderInIndonesian : renderWithSession)(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
  return stub;
}
/** The product opened from its row (P19.2-T2 AC-2; UI-131): the *Proposal* section of the sheet it opens. */
const openSheet = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog', { name });
};
const open = async (name = 'PRUWell Medical') =>
  within((await openSheet(name)).querySelector('[data-proposal-editor]') as HTMLElement);
const patched = (stub: ReturnType<typeof stubFetch>) =>
  JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)) as Record<string, unknown>;
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save product' }));

/**
 * **P19.7-T1 AC-3 (Acc. 8) — the Super Admin's *Proposal* section on *Produk***: the fields, the plans, the FAQ and the
 * detail blocks, each added, edited, removed and moved with ↑ / ↓, saved with the product; *Perlu dicek* on a draft
 * field; nothing sent when the section did not change.
 */
describe('P19.7-T1 AC-3 the Proposal section', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.7-T1 AC-3 shows the fields in order, each with its key, label, type and options, and marks a draft one', async () => {
    mount();
    const section = await open();
    expect(section.getByRole('heading', { name: 'Proposal', level: 3 })).toBeInTheDocument();
    const items = section.getAllByRole('listitem').filter((li) => li.hasAttribute('data-proposal-field'));
    expect(items.map((li) => li.getAttribute('data-proposal-field'))).toEqual(['plan', 'up']);
    // The pill beside the draft field's name, and its own box ticked; the other field has the box alone, unticked.
    expect(within(items[0]).getAllByText('To be checked')).toHaveLength(2);
    expect(within(items[0]).getByRole('checkbox', { name: 'To be checked' })).toBeChecked();
    expect(within(items[1]).getAllByText('To be checked')).toHaveLength(1);
    expect(within(items[1]).getByRole('checkbox', { name: 'To be checked' })).not.toBeChecked();
    expect(within(items[0]).getByRole('textbox', { name: 'Option 2' })).toHaveValue('Gold');
    expect(within(items[0]).getByRole('combobox', { name: 'Preselected' })).toHaveValue('Gold');
    expect(within(items[1]).getByRole('textbox', { name: 'Quick amounts (Rp, commas between)' })).toHaveValue('100000000');
  });

  it('P19.7-T1 AC-3 moves a field down with ↓ and sends the whole list in its new order', async () => {
    const stub = mount();
    const section = await open();
    await userEvent.click(section.getByRole('button', { name: 'Move field 1, Plan down' }));
    await save();
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const body = patched(stub);
    expect((body.proposalFields as ProposalField[]).map((f) => f.key)).toEqual(['up', 'plan']);
    expect(body).toMatchObject({ expectedVersion: 3, planOptions: [{ name: 'Gold' }] });
  });

  it('P19.7-T1 AC-3 adds a field, a plan, a question and a detail block, and removes one', async () => {
    const stub = mount();
    const section = await open();
    await userEvent.click(section.getByRole('button', { name: '+ Add field' }));
    const added = section.getAllByRole('listitem').filter((li) => li.hasAttribute('data-proposal-field'))[2];
    await userEvent.type(within(added).getByRole('textbox', { name: 'Key' }), 'saver');
    await userEvent.type(within(added).getByRole('textbox', { name: 'Label' }), 'Saver');
    await userEvent.type(within(added).getByRole('textbox', { name: 'Option 1' }), 'Tidak');
    await userEvent.selectOptions(within(added).getByRole('combobox', { name: 'Preselected' }), 'Tidak');
    await userEvent.click(section.getByRole('button', { name: '+ Add plan' }));
    await userEvent.click(section.getByRole('button', { name: '+ Add question' }));
    await userEvent.type(section.getByRole('textbox', { name: 'Question 2' }), 'Bisa di luar negeri?');
    await userEvent.type(section.getByRole('textbox', { name: 'Answer 2' }), 'Bisa, plan Asia.');
    await userEvent.click(section.getByRole('button', { name: 'Remove question 1' }));
    await userEvent.click(section.getByRole('button', { name: '+ Add block' }));
    await userEvent.type(section.getByRole('textbox', { name: 'Row 1, label' }), 'Meninggal dunia');
    await userEvent.type(section.getByRole('textbox', { name: 'Row 1, value' }), '200% × up');
    await userEvent.type(section.getByRole('textbox', { name: 'Source file' }), 'Ilustrasi.pdf');
    await save();
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const body = patched(stub);
    expect((body.proposalFields as ProposalField[])[2]).toMatchObject({ key: 'saver', type: 'chips', default: 'Tidak' });
    expect(body.planOptions).toEqual([
      { name: 'Gold', highlights: [{ label: 'Kamar', value: 'Rp 1,5 Jt' }], popular: true },
      { name: 'Silver', highlights: [{ label: '', value: '' }], popular: false },
    ]);
    expect(body.faq).toEqual([{ question: 'Bisa di luar negeri?', answer: 'Bisa, plan Asia.' }]);
    expect(body.pdfDetail).toEqual([{
      block: 'manfaat', rows: [{ label: 'Meninggal dunia', note: null, formula: '200% × up', text: null }],
      source: { file: 'Ilustrasi.pdf', page: 1, date: '' }, notGuaranteed: false,
    }]);
  });

  it('P19.7-T1 AC-3 sends nothing of the proposal when the section did not change', async () => {
    const stub = mount();
    await open();
    await save();
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(Object.keys(patched(stub))).not.toEqual(expect.arrayContaining(['proposalFields']));
    expect(patched(stub)).not.toHaveProperty('faq');
  });

  it('P19.7-T1 AC-3 says the API’s refusal, the path named, and keeps what was typed', async () => {
    const stub = stubFetch({
      '/admin/companies/c1/products': { body: [product()] },
      'PATCH /admin/companies/c1/products/p1': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: '`santunan` is not a money field of this product.', details: { field: 'pdfDetail[0].rows[0].formula' } } },
      },
    } as Parameters<typeof stubFetch>[0]);
    renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
    const section = await open();
    await userEvent.click(section.getByRole('button', { name: '+ Add block' }));
    await userEvent.type(section.getByRole('textbox', { name: 'Row 1, value' }), '2 × santunan');
    await save();
    expect(await screen.findByText('`santunan` is not a money field of this product.')).toBeInTheDocument();
    expect(section.getByRole('textbox', { name: 'Row 1, value' })).toHaveValue('2 × santunan');
    expect(stub.calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(1);
  });

  it('P19.7-T1 AC-3 stops adding at the API’s counts: eight fields', async () => {
    mount([product({ proposalFields: Array.from({ length: PROPOSAL_LIMITS.FIELDS }, (_, i) => field({ key: `m${i}`, type: 'money' })) })]);
    const section = await open();
    expect(section.getByRole('button', { name: '+ Add field' })).toBeDisabled();
  });

  it('P19.7-T1 AC-3 offers syariahName on a conventional product only, with ADR-0225 §3’s sentence', async () => {
    mount([product(), product({ id: 'p2', name: 'PRUWell Medical Syariah', channel: 'syariah', sortOrder: 2 })]);
    const conventional = await open();
    expect(conventional.getByRole('textbox', { name: 'Syariah name' })).toBeInTheDocument();
    expect(conventional.getByText('Fill in only if the syariah version is not a product of its own.')).toBeInTheDocument();
    const syariah = await open('PRUWell Medical Syariah');
    expect(syariah.queryByRole('textbox', { name: 'Syariah name' })).not.toBeInTheDocument();
  });

  it('P19.7-T1 AC-3 draws no Proposal section for a rider: it is never offered alone', async () => {
    mount([product({ kind: 'rider', attachesTo: [] })]);
    const sheet = await openSheet('PRUWell Medical');
    expect(sheet.querySelector('[data-proposal-editor]')).toBeNull();
  });

  it('P19.7-T1 AC-7 offers no premium calculation: no Hitung, and the premium table read as none', async () => {
    mount();
    const section = await open();
    expect(section.queryByText(/Hitung premi/i)).not.toBeInTheDocument();
    expect(section.queryByRole('button', { name: /calculate|hitung/i })).not.toBeInTheDocument();
    expect(section.getByText('None yet — the agent types the premium')).toBeInTheDocument();
  });

  it('P19.14-T2 AC-5 reads the catalogue’s calculation fields, read only: type, entry age, pay terms, Cara bayar, smoker, rule, limits, need', async () => {
    mount([product({
      calcType: 'up_premium', entryAge: { min: 1, max: 60 }, smokerRated: true, frequencies: ['monthly', 'annual'],
      payTerms: [
        { key: 'y5', label: '5 tahun', years: 5, toAge: null, single: false, maxEntryAge: 60, default: false },
        { key: 'y10', label: '10 tahun', years: 10, toAge: null, single: false, maxEntryAge: 60, default: true },
      ],
      planRule: null, upStep: 1_000_000_00, upMin: 100_000_000_00, upMax: null, premiumMin: null, premiumMax: null,
      rateTableId: null, needTag: 'CRITICAL_INCOME',
    })]);
    const section = await open();
    const calc = within(section.getByRole('region', { name: 'Calculation' }));
    const rows = Object.fromEntries(calc.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]));
    expect(rows).toEqual({
      'Calculation type': 'Sum assured ↔ premium',
      'Premium table': 'None yet — the agent types the premium',
      'Entry age': '1–60',
      'Payment terms': '5 tahun (to age 60) · 10 tahun (to age 60) ★',
      'Payment frequency': 'Monthly · Annually',
      Smoker: 'Priced differently for smokers',
      'Plan rule': '—',
      Limits: 'Sum assured IDR 100M – … · sum assured in steps of IDR 1M',
      'Need ticked': 'Income during critical illness',
    });
    // Read only: no control in it.
    expect(calc.queryAllByRole('button')).toEqual([]);
    expect(calc.queryAllByRole('textbox')).toEqual([]);
  });

  it('P19.15-T1 a product with a premium table says where its versions are, never the table’s id', async () => {
    mount([product({ calcType: 'up_premium', rateTableId: 'rt-6a1f' })]);
    const calc = within((await open()).getByRole('region', { name: 'Calculation' }));
    expect(calc.getByText('Set — its versions are on the company’s Proposal tab')).toBeInTheDocument();
    expect(calc.queryByText(/rt-6a1f/)).not.toBeInTheDocument();
  });

  it('P19.14-T2 AC-5 a product nobody filled reads manual, no limit, the four periodic frequencies', async () => {
    mount();
    const calc = within((await open()).getByRole('region', { name: 'Calculation' }));
    expect(calc.getByText('Typed by the agent')).toBeInTheDocument();
    expect(calc.getByText('No limit')).toBeInTheDocument();
    expect(calc.getByText('Monthly · Quarterly · Half-yearly · Annually')).toBeInTheDocument();
  });

  it('P19.14-T2 AC-3 a derived field is shown, marked automatic, with its values and its rule, never edited', async () => {
    const derived = field({
      key: 'plan', label: 'Plan', type: 'derived', plan: true,
      options: ['Bronze A', 'Gold'].map((label) => ({ label, years: null, currency: null })),
    });
    const wilayah = field({ key: 'wilayah', label: 'Wilayah', options: [{ label: 'Indonesia', years: null, currency: null }], default: 'Indonesia' });
    mount([product({
      proposalFields: [wilayah, derived], planOptions: [],
      planRule: { field: 'plan', rules: [{ when: { wilayah: 'Indonesia' }, value: 'Bronze A' }] },
    })]);
    const section = await open();
    const item = section.getAllByRole('listitem').find((li) => li.hasAttribute('data-derived'))!;
    expect(item).toHaveTextContent('Automatic');
    expect(item).toHaveTextContent('Worked out from the other fields by 1 rule.');
    expect(item).toHaveTextContent('Possible values: Bronze A · Gold');
    expect(within(item).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(item).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(within(section.getByRole('region', { name: 'Calculation' })).getByText('1 rule for plan')).toBeInTheDocument();
  });

  it('P19.14-T2 AC-5 the calculation block in Indonesian: Perhitungan, Cara hitung, Tabel tarif, Usia masuk, Masa bayar', async () => {
    mount([product({ payTerms: [{ key: 'y5', label: '5 tahun', years: 5, toAge: null, single: false, maxEntryAge: 60, default: true }] })], true);
    const calc = within((await open()).getByRole('region', { name: 'Perhitungan' }));
    for (const label of ['Cara hitung', 'Tabel tarif', 'Usia masuk', 'Masa bayar', 'Cara bayar', 'Merokok', 'Aturan plan', 'Batas', 'Kebutuhan']) {
      expect(calc.getByText(label)).toBeInTheDocument();
    }
    expect(calc.getByText('5 tahun (maks. usia 60) ★')).toBeInTheDocument();
    expect(calc.getByText('Belum ada — agen mengetik premi')).toBeInTheDocument();
  });

  it('P19.7-T1 AC-3 speaks Indonesian: Perlu dicek, Tanya-jawab, the syariah sentence', async () => {
    mount([product()], true);
    const section = await open();
    expect(section.getAllByText('Perlu dicek').length).toBeGreaterThan(0);
    expect(section.getByRole('heading', { name: 'Tanya-jawab' })).toBeInTheDocument();
    expect(section.getByText('Isi hanya jika versi syariah tidak ada sebagai produk tersendiri.')).toBeInTheDocument();
  });
});
