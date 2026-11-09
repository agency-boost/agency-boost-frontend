import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { ProductsTab } from './products-tab';

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['product_catalog:crud', 'commission_rates:read'],
});

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  companyId: 'c1',
  code: 'PRUMAPAN',
  name: 'PRUMapan',
  tagline: 'Proteksi jiwa dengan manfaat pensiun',
  channel: 'conventional',
  category: 'life',
  kind: 'base',
  attachesTo: [],
  currencies: ['IDR'],
  primaryNeeds: ['retirement'],
  eligibleAgeBands: [1, 2, 3],
  eligibleBudgetBands: [1, 2, 3],
  benefits: ['Dana Mapan tiap tahun dari usia 55'],
  differentiator: 'Premi tetap.\nUang kembali di akhir.',
  bestFor: 'Sandwich-generation professionals',
  defaultAttackPlan: {
    goodFit: 'Sandwich-generation professionals',
    opening: 'Menyiapkan dana pensiun memang tidak mudah.',
    benefits: ['Dana Mapan tiap tahun dari usia 55'],
    fullScript: 'Paragraf satu.\n\nParagraf dua.',
    // One card since P19.4-T4 (ADR-0209 §9), each side on as many lines as typed.
    objections: [{ objection: '1. "Mahal"\n2. "Nanti saja"', answer: '1. Mulai Rp 300 rb.\n2. Risiko tidak menunggu.' }],
    nextAction: 'Boleh saya siapkan ilustrasinya?',
  },
  commissionSchedule: [],
  lifecycle: 'active',
  replacedByProductId: null,
  activeByDefault: true,
  sortOrder: 1,
  version: 4,
  ...over,
});

const STALE = {
  status: 409,
  body: {
    error: {
      code: 'VERSION_CONFLICT',
      message: 'This record changed since you loaded it. Reload and try again.',
      details: { expectedVersion: 4, actualVersion: 5 },
      requestId: 'r-409',
    },
  },
};

/** A product opened from its row: the sheet or side panel it opens (P19.2-T2 AC-2; UI-131), in either language. */
async function open(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog', { name });
}

const patched = (calls: { init: RequestInit }[]) =>
  JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')!.init.body));

/**
 * **The Products tab's three faults** (P19-T6 AC-1, AC-2, AC-4; the 11-03 handover's B1-2 and B1-10): what is typed on
 * several lines goes as typed, a save names the version it was opened at and says so when somebody saved first, and
 * no two fields of the form share an id.
 */
describe('P19-T6 the Products tab’s faults', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-4: one id per field', () => {
    it('P19-T6 AC-4 gives every field of the product form its own id — Manfaat and Tekankan manfaat no longer share one', async () => {
      stubFetch({ '/admin/companies/c1/products': { body: [product()] } });
      renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');

      const ids = Array.from(row.querySelectorAll('[id]')).map((el) => el.id);
      const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(twice).toEqual([]);
      expect(ids).toEqual(expect.arrayContaining(['benefits-p1', 'plan-benefits-p1']));
    });

    it('P19-T6 AC-4 names each benefits list by its own label, so each label reaches its own textarea', async () => {
      stubFetch({ '/admin/companies/c1/products': { body: [product()] } });
      renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');

      const product_ = within(row).getByRole('textbox', { name: /^Benefits/ });
      const plan = within(row).getByRole('textbox', { name: /Lead with these benefits/ });
      expect(product_).not.toBe(plan);
      expect(product_.id).toBe('benefits-p1');
      expect(plan.id).toBe('plan-benefits-p1');
      // Every other plan field moved with it: still labelled, still its own.
      for (const name of [/Opening line/, /Full script/, /they say/, /you say/, /Next action/]) {
        expect(within(row).getByRole('textbox', { name }).id).toMatch(/^plan-/);
      }
    });
  });

  describe('AC-1: line breaks go as typed', () => {
    it('P19-T6 AC-1 shows the stored line breaks in the form and sends them back as they are', async () => {
      const stub = stubFetch({
        '/admin/companies/c1/products': { body: [product()] },
        'PATCH /admin/companies/c1/products/p1': { body: product({ version: 5 }) },
      });
      renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');

      const youSay = within(row).getByRole('textbox', { name: /you say/ });
      expect(youSay).toHaveValue('1. Mulai Rp 300 rb.\n2. Risiko tidak menunggu.');
      await userEvent.type(youSay, '{enter}3. Bisa dicicil.');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      const body = patched(stub.calls);
      expect(body.defaultAttackPlan.objections[0].answer).toBe('1. Mulai Rp 300 rb.\n2. Risiko tidak menunggu.\n3. Bisa dicicil.');
      expect(body.defaultAttackPlan.fullScript).toBe('Paragraf satu.\n\nParagraf dua.');
      expect(body.differentiator).toBe('Premi tetap.\nUang kembali di akhir.');
    });
  });

  describe('AC-2: a save names the version it was opened at', () => {
    it('P19-T6 AC-2 sends the version the card was read at', async () => {
      const stub = stubFetch({
        '/admin/companies/c1/products': { body: [product()] },
        'PATCH /admin/companies/c1/products/p1': { body: product({ version: 5 }) },
      });
      renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(patched(stub.calls)).toMatchObject({ expectedVersion: 4 });
      // A save that lands closes the editor — its sheet — as before.
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Save product' })).not.toBeInTheDocument());
    });

    it('P19-T6 AC-2 says somebody saved first, keeps what was typed, and reloads on Reload', async () => {
      const stub = stubFetch({
        '/admin/companies/c1/products': [
          { body: [product()] },
          { body: [product({ name: 'PRUMapan Baru', version: 5 })] },
        ],
        'PATCH /admin/companies/c1/products/p1': STALE,
      });
      renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');
      const name = within(row).getByRole('textbox', { name: 'Name' });
      await userEvent.clear(name);
      await userEvent.type(name, 'Nama saya');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Someone else changed this product after you opened it, so your changes were not saved.',
      );
      // What was typed is still there to copy.
      expect(within(row).getByRole('textbox', { name: 'Name' })).toHaveValue('Nama saya');

      await userEvent.click(within(alert).getByRole('button', { name: 'Reload' }));
      // The shelf read again, and the sheet closed: the row says what is stored now.
      expect(await screen.findByRole('button', { name: 'PRUMapan Baru' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save product' })).not.toBeInTheDocument();
      expect(stub.calls.filter((c) => (c.init.method ?? 'GET') === 'GET')).toHaveLength(2);
    });

    it('P19-T6 AC-2 says it in Indonesian', async () => {
      stubFetch({
        '/admin/companies/c1/products': { body: [product()] },
        'PATCH /admin/companies/c1/products/p1': STALE,
      });
      renderInIndonesian(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');
      await userEvent.click(within(row).getByRole('button', { name: 'Simpan produk' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Orang lain mengubah produk ini setelah Anda membukanya');
      expect(within(alert).getByRole('button', { name: 'Muat ulang' })).toBeInTheDocument();
    });

    it('P19-T6 AC-2 keeps any other refusal in the API’s words, with no Reload', async () => {
      stubFetch({
        '/admin/companies/c1/products': { body: [product()] },
        'PATCH /admin/companies/c1/products/p1': {
          status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'name must be shorter', requestId: 'r-1' } },
        },
      });
      renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
      const row = await open('PRUMapan');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('name must be shorter');
      expect(within(alert).queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    });
  });
});
