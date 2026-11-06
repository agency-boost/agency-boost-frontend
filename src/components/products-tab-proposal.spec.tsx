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
  planOptions: [{ name: 'Gold', highlights: [{ label: 'Kamar', value: 'Rp 1,5 jt' }], popular: true }],
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
      { name: 'Gold', highlights: [{ label: 'Kamar', value: 'Rp 1,5 jt' }], popular: true },
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

  it('P19.7-T1 AC-7 offers no premium calculation and no rate table', async () => {
    mount();
    const section = await open();
    expect(section.queryByText(/Hitung premi|rate table|tabel tarif/i)).not.toBeInTheDocument();
  });

  it('P19.7-T1 AC-3 speaks Indonesian: Perlu dicek, Tanya-jawab, the syariah sentence', async () => {
    mount([product()], true);
    const section = await open();
    expect(section.getAllByText('Perlu dicek').length).toBeGreaterThan(0);
    expect(section.getByRole('heading', { name: 'Tanya-jawab' })).toBeInTheDocument();
    expect(section.getByText('Isi hanya jika versi syariah tidak ada sebagai produk tersendiri.')).toBeInTheDocument();
  });
});
