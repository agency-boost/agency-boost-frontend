import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { OBJECTIONS_MAX } from '@/lib/admin';
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
  id: 'p1', companyId: 'c1', code: 'SOFI', name: 'SOFI Critical Infinity', tagline: 'Proteksi penyakit kritis',
  channel: 'conventional', category: 'ci', kind: 'base', attachesTo: [], currencies: ['IDR'],
  primaryNeeds: ['ci'], eligibleAgeBands: [2], eligibleBudgetBands: [2], benefits: ['Santunan'],
  differentiator: 'Terjangkau.', bestFor: 'Keluarga muda',
  defaultAttackPlan: {
    goodFit: 'Keluarga muda', opening: 'Halo.', benefits: ['Santunan'], fullScript: 'Halo.',
    objections: [{ objection: 'Mahal.', answer: 'Bisa disesuaikan.' }], nextAction: 'Siapkan ilustrasi.',
  },
  commissionSchedule: [], lifecycle: 'active', replacedByProductId: null, activeByDefault: true, sortOrder: 1,
  version: 3,
  ...over,
});
const SOFI = product();
const QSMART = product({ id: 'p2', code: 'QSMART', name: 'Q Smart Life New Gen', sortOrder: 2 });
const RIDER = product({
  id: 'p3', code: 'CI_COVERAGE_PLUS', name: 'CI Coverage+ Insurance', sortOrder: 3, kind: 'rider', attachesTo: ['p1', 'p2'],
});
const ORPHAN = product({ id: 'p4', code: 'SEQUIS_ACCIDENT', name: 'Sequis Accident Rider', sortOrder: 4, kind: 'rider' });
const WITHDRAWN = product({ id: 'p5', code: 'PGB', name: 'PRULink Generasi Baru', sortOrder: 5, lifecycle: 'withdrawn' });
const SHELF = [SOFI, QSMART, RIDER, ORPHAN, WITHDRAWN];

function mount(rows: unknown[] = SHELF, extra: Record<string, unknown> = {}, indonesian = false) {
  const stub = stubFetch({ '/admin/companies/c1/products': { body: rows }, ...extra });
  (indonesian ? renderInIndonesian : renderWithSession)(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
  return stub;
}
/**
 * A product's row (P19.2-T2 AC-2; UI-131): the laptop's table row at jsdom's width — its target named by the product —
 * and the sheet or side panel the row opens.
 */
const rowOf = async (name: string) => (await screen.findByRole('button', { name })).closest('tr, li') as HTMLElement;
const open = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog', { name });
};
/** The products the list shows, in its order: each row's target. */
const shown = () => Array.from(document.querySelectorAll('[data-row-main]')).map((el) => el.textContent);
const patched = (stub: ReturnType<typeof stubFetch>) =>
  JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)) as Record<string, unknown>;

/**
 * **P19.4-T4 — the company's *Produk* tab: riders, currencies, objection cards, withdrawn products** (ADR-0209; the
 * riders spec's admin screen; the 11-03 handover's B1-1, B1-3, B1-4, B1-5).
 */
describe('P19.4-T4 the Produk tab', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-9 the riders spec’s admin screen', () => {
    it('P19.4-T4 AC-9 chips over the list: All · Base products · Riders, each pressed when on', async () => {
      mount();
      await rowOf('SOFI Critical Infinity');
      const chips = screen.getByRole('group', { name: 'Kind' });
      expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Base products', 'Riders']);
      expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(within(chips).getByRole('button', { name: 'Riders' }));
      expect(shown()).toEqual(['CI Coverage+ Insurance', 'Sequis Accident Rider']);
      await userEvent.click(within(chips).getByRole('button', { name: 'Base products' }));
      expect(shown()).toEqual(['SOFI Critical Infinity', 'Q Smart Life New Gen']);
    });

    it('P19.4-T4 AC-9 a rider’s row: the chip Rider and "For: <its bases>"', async () => {
      mount();
      const row = await rowOf('CI Coverage+ Insurance');
      // The chip on the row; the kind's switch is in the product's sheet since P19.2-T2 AC-2 (UI-131's one-line row).
      expect(within(row).getAllByText('Rider').find((el) => el.tagName === 'SPAN')).toHaveAttribute('data-tone', 'navy');
      expect(within(row).getByText('For: SOFI Critical Infinity, Q Smart Life New Gen')).toBeInTheDocument();
      // A base carries neither.
      const base = await rowOf('SOFI Critical Infinity');
      expect(within(base).queryByText(/^For:/)).not.toBeInTheDocument();
    });

    it('P19.4-T4 AC-6 a rider no active base offers says so on its row', async () => {
      mount();
      const row = await rowOf('Sequis Accident Rider');
      expect(within(row).getByText('This rider is not attached to any active product')).toBeInTheDocument();
      expect(within(await rowOf('CI Coverage+ Insurance')).queryByText(/not attached/)).not.toBeInTheDocument();
    });

    it('P19.4-T4 AC-9 each product’s kind switch, in the sheet its row opens; Rider opens "Can be added to", empty refused at the field', async () => {
      const stub = mount(SHELF, { 'PATCH /admin/companies/c1/products/p2': { body: { ...QSMART, kind: 'rider', attachesTo: ['p1'] } } });
      // Moved from the row into its sheet by P19.2-T2 AC-2 (UI-131): one tap from the row, the sheet's first control.
      const row = await open('Q Smart Life New Gen');
      const kind = within(row).getByRole('group', { name: 'Kind of Q Smart Life New Gen' });
      expect(within(kind).getByRole('button', { name: 'Base product' })).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(within(kind).getByRole('button', { name: 'Rider' }));
      expect(within(kind).getByRole('button', { name: 'Rider' })).toHaveAttribute('aria-pressed', 'true');
      const picker = within(row).getByRole('group', { name: 'Can be added to' });
      // The company's active bases, never a rider, never itself.
      expect(within(picker).getAllByRole('checkbox').map((c) => c.closest('label')!.textContent)).toEqual(['SOFI Critical Infinity']);
      expect(within(row).getByRole('alert')).toHaveTextContent('Choose at least one base product');
      // A rider's own attack plan is not edited (OD-262).
      expect(within(row).queryByLabelText('0 · Good fit for')).not.toBeInTheDocument();

      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(false);

      await userEvent.click(within(picker).getByRole('checkbox', { name: 'SOFI Critical Infinity' }));
      expect(within(row).queryByText('Choose at least one base product')).not.toBeInTheDocument();
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      const body = patched(stub);
      expect(body).toMatchObject({ kind: 'rider', attachesTo: ['p1'], expectedVersion: 3 });
      expect(body).not.toHaveProperty('defaultAttackPlan');
    });

    it('P19.4-T4 AC-9 a base’s editor: "Riders available: …", each a link to the rider', async () => {
      mount();
      const row = await open('SOFI Critical Infinity');
      expect(within(row).getByText('Riders available:')).toBeInTheDocument();
      await userEvent.click(within(row).getByRole('button', { name: 'Open CI Coverage+ Insurance' }));
      // The sheet now holds the rider.
      const rider = await screen.findByRole('dialog', { name: 'CI Coverage+ Insurance' });
      expect(within(rider).getByRole('group', { name: 'Can be added to' })).toBeInTheDocument();
      expect(within(rider).getByRole('checkbox', { name: 'SOFI Critical Infinity' })).toBeChecked();
    });

    it('P19.4-T4 AC-4 a save that changes nothing about the kind sends neither the kind nor the bases', async () => {
      const stub = mount(SHELF, { 'PATCH /admin/companies/c1/products/p3': { body: RIDER } });
      const row = await open('CI Coverage+ Insurance');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(patched(stub)).not.toHaveProperty('kind');
      expect(patched(stub)).not.toHaveProperty('attachesTo');
    });

    it('P19.4-T4 AC-9 says it in the riders spec’s own Indonesian', async () => {
      mount(SHELF, {}, true);
      const row = await rowOf('CI Coverage+ Insurance');
      expect(screen.getByRole('group', { name: 'Jenis' }).textContent).toBe('SemuaProduk dasarRider');
      expect(within(row).getByText('Untuk: SOFI Critical Infinity, Q Smart Life New Gen')).toBeInTheDocument();
      expect(within(await rowOf('Sequis Accident Rider')).getByText('Rider ini tidak terpasang ke produk aktif mana pun'))
        .toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Tampilkan ditarik' })).not.toBeChecked();
      const base = await open('Q Smart Life New Gen');
      await userEvent.click(within(within(base).getByRole('group', { name: 'Jenis Q Smart Life New Gen' }))
        .getByRole('button', { name: 'Rider' }));
      expect(within(base).getByRole('group', { name: 'Bisa ditambahkan ke' })).toBeInTheDocument();
      expect(within(base).getByRole('alert')).toHaveTextContent('Pilih minimal satu produk dasar');
      await userEvent.click(within(base).getByRole('button', { name: 'Tutup' }));
      const sofi = await open('SOFI Critical Infinity');
      expect(within(sofi).getByText('Rider yang tersedia:')).toBeInTheDocument();
    });
  });

  describe('AC-1 the objection cards (B1-1)', () => {
    it('P19.4-T4 AC-1 adds a card with "+ Add objection", removes one, and sends every card in order', async () => {
      const stub = mount([SOFI], { 'PATCH /admin/companies/c1/products/p1': { body: SOFI } });
      const row = await open('SOFI Critical Infinity');

      await userEvent.click(within(row).getByRole('button', { name: '+ Add objection' }));
      await userEvent.type(within(row).getByLabelText('Objection 2 — they say'), 'Nanti saja.');
      await userEvent.type(within(row).getByLabelText('Objection 2 — you say'), 'Makin awal{enter}makin ringan.');
      await userEvent.click(within(row).getByRole('button', { name: '+ Add objection' }));
      await userEvent.type(within(row).getByLabelText('Objection 3 — they say'), 'Sudah punya.');
      await userEvent.click(within(row).getByRole('button', { name: 'Remove objection 1' }));
      // A card left blank is not sent.
      await userEvent.click(within(row).getByRole('button', { name: '+ Add objection' }));
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect((patched(stub).defaultAttackPlan as { objections: unknown }).objections).toEqual([
        { objection: 'Nanti saja.', answer: 'Makin awal\nmakin ringan.' },
        { objection: 'Sudah punya.', answer: '' },
      ]);
    });

    it(`P19.4-T4 AC-1 stops adding at ${OBJECTIONS_MAX}, and says why`, async () => {
      const full = Array.from({ length: OBJECTIONS_MAX }, (_, i) => ({ objection: `O${i}`, answer: 'A' }));
      mount([product({ defaultAttackPlan: { ...SOFI.defaultAttackPlan, objections: full } })]);
      const row = await open('SOFI Critical Infinity');
      const add = within(row).getByRole('button', { name: '+ Add objection' });
      expect(add).toBeDisabled();
      expect(add).toHaveAccessibleDescription(`A product holds at most ${OBJECTIONS_MAX} objections.`);
    });
  });

  describe('AC-12 currencies (B1-4)', () => {
    it('P19.4-T4 AC-12 shows the codes on the row, and sends the currencies chosen, at least one', async () => {
      const stub = mount([product({ currencies: ['IDR', 'USD'] })], {
        'PATCH /admin/companies/c1/products/p1': { body: SOFI },
      });
      // On the row (P19.4-T4 AC-12), where it is more than the platform's IDR (P19.2-T2 AC-2's one-line row).
      expect(within(await rowOf('SOFI Critical Infinity')).getByText('IDR + USD')).toBeInTheDocument();
      const row = await open('SOFI Critical Infinity');
      const box = within(row).getByRole('group', { name: 'Currency' });
      await userEvent.click(within(box).getByRole('checkbox', { name: 'IDR' }));
      await userEvent.click(within(box).getByRole('checkbox', { name: 'USD' }));
      expect(within(box).getByRole('alert')).toHaveTextContent('Choose at least one currency.');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(false);

      await userEvent.click(within(box).getByRole('checkbox', { name: 'USD' }));
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(patched(stub).currencies).toEqual(['USD']);
    });
  });

  describe('AC-13 withdrawn products: hidden, and deleted when nothing names them (B1-5)', () => {
    it('P19.4-T4 AC-13 hides a withdrawn product until "Show withdrawn"', async () => {
      mount();
      await rowOf('SOFI Critical Infinity');
      expect(screen.queryByText('PRULink Generasi Baru')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Show withdrawn' }));
      expect(await rowOf('PRULink Generasi Baru')).toBeInTheDocument();
    });

    it('P19.4-T4 AC-13 deletes a withdrawn product after a question, and takes it off the list', async () => {
      const stub = mount(SHELF, { 'DELETE /admin/companies/c1/products/p5': { status: 204 } });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Show withdrawn' }));
      const row = await open('PRULink Generasi Baru');
      // The question takes the sheet's place.
      await userEvent.click(within(row).getByRole('button', { name: 'Delete' }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Delete PRULink Generasi Baru? It leaves this list for good, and its code is never used again.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete product' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'DELETE' && c.url.endsWith('/products/p5'))).toBe(true));
      await waitFor(() => expect(screen.queryByText('PRULink Generasi Baru')).not.toBeInTheDocument());
    });

    it('P19.4-T4 AC-13 a product something names is refused, and the screen says why', async () => {
      mount(SHELF, {
        'DELETE /admin/companies/c1/products/p5': {
          status: 409,
          body: {
            error: {
              code: 'PRODUCT_IN_USE', requestId: 'r-1',
              message: 'PRULink Generasi Baru cannot be deleted: 2 KPMs sell it. It stays withdrawn.',
              details: { references: { activations: 2, scriptApprovals: 0, riders: 0 } },
            },
          },
        },
      });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Show withdrawn' }));
      const row = await open('PRULink Generasi Baru');
      await userEvent.click(within(row).getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete product' }));

      expect(await screen.findByText('PRULink Generasi Baru cannot be deleted: 2 KPMs sell it. It stays withdrawn.'))
        .toBeInTheDocument();
      expect(await rowOf('PRULink Generasi Baru')).toBeInTheDocument();
    });

    it('P19.4-T4 AC-13 offers no delete on a product still on sale', async () => {
      mount();
      const row = await open('SOFI Critical Infinity');
      expect(within(row).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });
});
