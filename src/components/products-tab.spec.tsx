import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { ProductsTab } from './products-tab';

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['product_catalog:crud', 'commission_rates:read'],
});

const plan = (over: Record<string, unknown> = {}) => ({
  goodFit: 'Sandwich-generation professionals',
  opening: 'Menyiapkan dana pensiun memang tidak mudah.',
  benefits: ['Dana Mapan tiap tahun dari usia 55'],
  fullScript: 'Menyiapkan dana pensiun memang tidak mudah. Boleh saya siapkan ilustrasinya?',
  objections: [{ objection: 'Pensiun masih lama.', answer: 'Pilihan pensiun paling terjangkau.' }],
  nextAction: 'Boleh saya siapkan ilustrasinya?',
  ...over,
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
  differentiator: 'Pilihan pensiun paling terjangkau.',
  bestFor: 'Sandwich-generation professionals',
  defaultAttackPlan: plan(),
  commissionSchedule: [],
  lifecycle: 'active',
  replacedByProductId: null,
  activeByDefault: true,
  sortOrder: 1,
  version: 1,
  ...over,
});

const SECOND = product({
  id: 'p2', code: 'PRUSMART_PLAN', name: 'PRUSmart Plan', sortOrder: 2, activeByDefault: false,
});

function render(rows: unknown[] = [product(), SECOND], extra: Record<string, unknown> = {}) {
  const stub = stubFetch({ '/admin/companies/c1/products': { body: rows }, ...extra });
  renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
  return stub;
}

/**
 * Open a product from its row and hand back the sheet or side panel it opened (P19.2-T2 AC-2; UI-131: *row tap opens the
 * edit sheet / side panel*). The row's target is named by the product, and the sheet by its title.
 */
async function open(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog', { name });
}

/** A product's row: the laptop's table row (jsdom's width, as every spec here but the AC-2 ones), or a phone's line. */
const rowOf = async (name: string) => (await screen.findByRole('button', { name })).closest('tr, li') as HTMLElement;

/**
 * The Company template's Products tab (P5-T4, ADR-0033).
 *
 * The thing worth pinning here is what this tab does **not** have: a draft and a version. Every
 * other tab edits a preset copied into an office; this one edits the live catalog, and a Publish
 * button on it would promise something that does not happen.
 */
describe('the Products tab', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the company’s catalog and shows each product with its identity and state', async () => {
    render();

    const row = await rowOf('PRUMapan');
    expect(within(row).getByText('PRUMapan')).toBeInTheDocument();
    expect(within(row).getByText('Conventional')).toBeInTheDocument();
    expect(within(row).getByText('Life')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    // *Active by default* is the laptop table's *Default in a new office* column since P19.2-T2 AC-2 (UI-131).
    const byDefault = screen.getAllByRole('columnheader').findIndex((h) => h.textContent === 'Default in a new office');
    expect(within(row).getAllByRole('cell')[byDefault]).toHaveTextContent('Yes');
    expect(within(await rowOf('PRUSmart Plan')).getAllByRole('cell')[byDefault]).toHaveTextContent('–');
  });

  it('says the catalog is live, and offers no draft and no publish', async () => {
    render();
    await screen.findByText('PRUMapan');

    expect(screen.getByText('This catalog is live.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
  });

  it('counts the shelf, and what a new office would start selling', async () => {
    render();
    await screen.findByText('PRUMapan');

    // One of the two is `activeByDefault`, which is what an office sells before it has an opinion.
    expect(screen.getByText(/2 products · 2 active · 1 active by default/)).toBeInTheDocument();
  });

  it('shows the code read-only when a product is opened, because a code never changes', async () => {
    render();
    const row = await open('PRUMapan');

    expect(within(row).getByText('Code')).toBeInTheDocument();
    expect(within(row).getByText(/it never changes/i)).toBeInTheDocument();
    expect(within(row).getByLabelText('Code')).toHaveAttribute('readonly');
  });

  it('opens the attack-plan fields the Owner’s own override modal names, the objections as cards', async () => {
    render();
    const row = await open('PRUMapan');

    const labels = ['0 · Good fit for', '1 · Opening line', '2 · Lead with these benefits', '3 · Full script', '5 · Next action'];
    for (const label of labels) expect(within(row).getByLabelText(label)).toBeInTheDocument();
    // *4* is the cards since P19.4-T4 (AC-1): one card here, its two sides.
    expect(within(row).getByRole('group', { name: '4 · If they push back' })).toBeInTheDocument();
    expect(within(row).getByLabelText('Objection 1 — they say')).toHaveValue('Pensiun masih lama.');

    // **In the modal's own order.** They were rendered 0, 1, 3, 4a, 4b, 5, 2 — the numbers are
    // the reader's map through the script, and one out of place reads as a form that lost a field.
    const onScreen = within(row).getAllByText(/^[0-9]+ · /).map((el) => el.textContent);
    expect(onScreen).toEqual([...labels.slice(0, 4), '4 · If they push back', '5 · Next action']);
  });

  it('saves the whole product, turning each typed line into one benefit', async () => {
    const stub = render(undefined, {
      '/admin/companies/c1/products/p1': { body: product({ name: 'PRUMapan Plus' }) },
    });
    const row = await open('PRUMapan');

    await userEvent.clear(within(row).getByLabelText('Name'));
    await userEvent.type(within(row).getByLabelText('Name'), 'PRUMapan Plus');
    await userEvent.clear(within(row).getByLabelText('Benefits'));
    await userEvent.type(within(row).getByLabelText('Benefits'), 'Satu{enter}Dua');
    await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

    const sent = stub.calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(String(sent.init.body))).toMatchObject({
      name: 'PRUMapan Plus',
      benefits: ['Satu', 'Dua'],
    });
    // And never the identity: the API refuses it, and the screen does not ask.
    expect(JSON.parse(String(sent.init.body))).not.toHaveProperty('code');
  });

  it('sends the bands and needs the fit check will read, and the by-default flag', async () => {
    const stub = render(undefined, {
      '/admin/companies/c1/products/p1': { body: product() },
    });
    const row = await open('PRUMapan');

    // Seven budget bands, not five: the scale of the copy the ERD records — in the reader's figures since P18.10-T6,
    // English here as every spec reads (*< Rp 500 rb* in Indonesian).
    // The six sums only — the *Currency* box's *IDR* is a code, not a band (P19.4-T4 AC-12).
    expect(within(row).getAllByRole('checkbox', { name: /IDR\s/ })).toHaveLength(6);
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Lump-sum' }));
    await userEvent.click(within(row).getByRole('checkbox', { name: '65+' }));
    await userEvent.click(within(row).getByRole('checkbox', { name: 'health' }));
    await userEvent.click(within(row).getByRole('checkbox', { name: /Active by default/ }));
    await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)))
      .toMatchObject({
        eligibleBudgetBands: [1, 2, 3, 7],
        eligibleAgeBands: [1, 2, 3, 5],
        primaryNeeds: ['retirement', 'health'],
        activeByDefault: false,
      });
  });

  it('says what the bands are for, and not when: no phase in the copy (P10.1-T2)', async () => {
    render();
    const row = await open('PRUMapan');

    // It ended by naming the phase that builds the fit check — our schedule, which a Super
    // Admin can do nothing with (ADR-0062 §3), and the wrong phase once the roadmap moved.
    const fits = within(row).getByRole('group', { name: 'Who it fits' });
    expect(within(fits).getByText('What the fit check scores a prospect against.')).toBeInTheDocument();
    expect(fits).not.toHaveTextContent(/phase/i);
  });

  it('says the commission is not set rather than showing a figure nobody stated', async () => {
    render();
    const row = await open('PRUMapan');

    // The prototype falls back to a fabricated 40% / 20% (parity F-15).
    expect(within(row).getByText(/Not set\./)).toBeInTheDocument();
    expect(within(row).queryByText('40.0%')).not.toBeInTheDocument();
  });

  describe('the commission schedule editor (OD-135)', () => {
    it('lays the schedule out as the drawer reads it, Y1 first, as percentages', async () => {
      // `0.07 * 100` is `7.000000000000001`: what was typed as 7 reads back as 7.
      render([product({ commissionSchedule: [{ year: 1, rate: 0.4 }, { year: 2, rate: 0.07 }] })]);
      const row = await open('PRUMapan');

      const table = within(row).getByRole('table', { name: 'Commission rate' });
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Year', 'Rate (%)']);
      expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Y1', 'Y2']);
      expect(within(row).getByLabelText('Rate for year 1')).toHaveValue('40');
      expect(within(row).getByLabelText('Rate for year 2')).toHaveValue('7');
    });

    it('adds a year at the end and sends the whole schedule as proportions with the product', async () => {
      const stub = render(undefined, {
        '/admin/companies/c1/products/p1': { body: product() },
      });
      const row = await open('PRUMapan');

      await userEvent.click(within(row).getByRole('button', { name: '+ Add year' }));
      await userEvent.type(within(row).getByLabelText('Rate for year 1'), '30');
      await userEvent.click(within(row).getByRole('button', { name: '+ Add year' }));
      // A comma or a point (ADR-0167 §1, P18.7-T1 AC-3): *12,5* is twelve and a half per cent.
      await userEvent.type(within(row).getByLabelText('Rate for year 2'), '12,5');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)).commissionSchedule)
        .toEqual([{ year: 1, rate: 0.3 }, { year: 2, rate: 0.125 }]);
    });

    it('removes only the last year, so the years never skip one', async () => {
      const stub = render([product({
        commissionSchedule: [{ year: 1, rate: 0.4 }, { year: 2, rate: 0.2 }, { year: 3, rate: 0.1 }],
      })], { '/admin/companies/c1/products/p1': { body: product() } });
      const row = await open('PRUMapan');

      expect(within(row).queryByRole('button', { name: 'Remove year 1' })).not.toBeInTheDocument();
      await userEvent.click(within(row).getByRole('button', { name: 'Remove year 3' }));
      await userEvent.click(within(row).getByRole('button', { name: 'Remove year 2' }));
      await userEvent.click(within(row).getByRole('button', { name: 'Remove year 1' }));
      // Empty again is *not set*, and saving says so to the API with an empty list.
      expect(within(row).getByText(/Not set\./)).toBeInTheDocument();
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)).commissionSchedule)
        .toEqual([]);
    });

    it('refuses a rate outside 0–100% at the field, and saves nothing', async () => {
      const stub = render([product({ commissionSchedule: [{ year: 1, rate: 0.4 }] })]);
      const row = await open('PRUMapan');

      await userEvent.clear(within(row).getByLabelText('Rate for year 1'));
      await userEvent.type(within(row).getByLabelText('Rate for year 1'), '120');

      expect(within(row).getByText('Enter a rate from 0 to 100.')).toBeInTheDocument();
      expect(within(row).getByLabelText('Rate for year 1')).toHaveAttribute('aria-invalid', 'true');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    });

    it('P14 exit review: refuses more than two decimal places — what the drawer prints is what is stored', async () => {
      const stub = render([product({ commissionSchedule: [{ year: 1, rate: 0.4 }] })], {
        '/admin/companies/c1/products/p1': { body: product() },
      });
      const row = await open('PRUMapan');
      const field = within(row).getByLabelText('Rate for year 1');

      await userEvent.clear(field);
      await userEvent.type(field, '12.345');
      expect(within(row).getByText('Use at most two decimal places.')).toBeInTheDocument();
      await userEvent.clear(field);
      await userEvent.type(field, '12,345');
      expect(within(row).getByText('Use at most two decimal places.')).toBeInTheDocument();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(false);

      // Two places are the drawer's own precision (`formatRate`): saved, as 0.1234.
      await userEvent.clear(field);
      await userEvent.type(field, '12.34');
      expect(within(row).queryByText('Use at most two decimal places.')).not.toBeInTheDocument();
      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)).commissionSchedule;
      expect(sent).toHaveLength(1);
      expect(sent[0].rate).toBeCloseTo(0.1234, 10);
    });

    it('P14 exit review: stops adding years at the API’s fiftieth, and says why', async () => {
      const fifty = Array.from({ length: 50 }, (_, i) => ({ year: i + 1, rate: 0.01 }));
      render([product({ commissionSchedule: fifty.slice(0, 49) })]);
      const row = await open('PRUMapan');

      const add = within(row).getByRole('button', { name: '+ Add year' });
      expect(add).toBeEnabled();
      expect(within(row).queryByText('A schedule covers at most 50 years.')).not.toBeInTheDocument();

      await userEvent.click(add);
      expect(within(row).getByLabelText('Rate for year 50')).toBeInTheDocument();
      expect(add).toBeDisabled();
      expect(add).toHaveAccessibleDescription('A schedule covers at most 50 years.');

      // Removing the last year opens it again.
      await userEvent.click(within(row).getByRole('button', { name: 'Remove year 50' }));
      expect(add).toBeEnabled();
      expect(within(row).queryByText('A schedule covers at most 50 years.')).not.toBeInTheDocument();
    });

    it('waits for a save before calling a new, empty year unfinished', async () => {
      const stub = render();
      const row = await open('PRUMapan');

      await userEvent.click(within(row).getByRole('button', { name: '+ Add year' }));
      expect(within(row).queryByRole('alert')).not.toBeInTheDocument();

      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));
      expect(within(row).getByText('Enter a rate from 0 to 100.')).toBeInTheDocument();
      expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    });

    it('shows the API’s refusal in its own words', async () => {
      render([product({ commissionSchedule: [{ year: 1, rate: 0.4 }] })], {
        '/admin/companies/c1/products/p1': {
          status: 400,
          body: { error: { code: 'VALIDATION_FAILED', message: 'A commission schedule is a rate for each policy year from year 1, with no year missing and none twice. This one has year 2.' } },
        },
      });
      const row = await open('PRUMapan');

      await userEvent.click(within(row).getByRole('button', { name: 'Save product' }));

      expect(await screen.findByText(/with no year missing and none twice/)).toBeInTheDocument();
    });
  });

  it('says nothing about commission at all to a reader who is not shown rates', async () => {
    const without = product();
    delete (without as Record<string, unknown>).commissionSchedule;
    render([without]);
    const row = await open('PRUMapan');

    expect(within(row).getByText('You are not shown commission rates.')).toBeInTheDocument();
  });

  it('moves a product along its lifecycle through named controls, not a dropdown', async () => {
    const stub = render(undefined, {
      '/admin/companies/c1/products/p1/withdraw': {
        body: product({ lifecycle: 'withdrawn', replacedByProductId: 'p2' }),
      },
    });
    const row = await open('PRUMapan');

    await userEvent.selectOptions(
      within(row).getByLabelText('Replaced by'), 'p2',
    );
    await userEvent.click(within(row).getByRole('button', { name: 'Withdraw' }));

    const sent = stub.calls.find((c) => c.url.includes('/withdraw'))!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ replacedByProductId: 'p2' });
    // Hidden once withdrawn (P19.4-T4 AC-13), and there behind *Show withdrawn*.
    // Its sheet goes with its row.
    await waitFor(() => expect(screen.queryByText('PRUMapan')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show withdrawn' }));
    expect(within(await rowOf('PRUMapan')).getByText('Withdrawn')).toBeInTheDocument();
  });

  it('offers Reopen on a product in run-off, and no delete: only a withdrawn product is deleted', async () => {
    render([product({ lifecycle: 'closed_to_new_business' })]);
    const row = await open('PRUMapan');

    expect(within(row).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('sends the whole shelf when a row moves, so two people cannot interleave', async () => {
    const stub = render(undefined, {
      '/admin/companies/c1/products/reorder': { body: [SECOND, product()] },
    });
    await rowOf('PRUMapan');

    // In *Change order* since P19.2-T2 AC-2 (UI-131: *reordering only in an "Ubah urutan" mode*). The handle is the
    // keyboard path as well as the grab affordance: focus it, press ↓.
    await userEvent.click(screen.getByRole('button', { name: 'Change order' }));
    screen.getByRole('button', { name: /^Reorder PRUMapan\./ }).focus();
    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/reorder'))).toBe(true));
    const sent = stub.calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ productIds: ['p2', 'p1'] });
  });

  it('fills the code in from the name, and refuses one the company already uses', async () => {
    render();
    await screen.findByText('PRUMapan');
    await userEvent.click(screen.getByRole('button', { name: 'Add a product' }));

    await userEvent.type(screen.getByLabelText('Name'), 'PRUCinta');
    expect(screen.getByLabelText('Code')).toHaveValue('PRUCINTA');

    await userEvent.clear(screen.getByLabelText('Code'));
    await userEvent.type(screen.getByLabelText('Code'), 'PRUMAPAN');
    expect(screen.getByText('This company already has a product with this code.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('adds a product and puts it on the shelf', async () => {
    const stub = render(undefined, {});
    await screen.findByText('PRUMapan');
    await userEvent.click(screen.getByRole('button', { name: 'Add a product' }));
    await userEvent.type(screen.getByLabelText('Name'), 'PRUCinta');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const sent = stub.calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(sent.init.body))).toEqual({
      code: 'PRUCINTA', name: 'PRUCinta', channel: 'conventional', category: 'life',
    });
  });

  it('adds a Syariah product under the category chosen, and cancels without asking', async () => {
    const stub = render(undefined, {});
    await screen.findByText('PRUMapan');
    await userEvent.click(screen.getByRole('button', { name: 'Add a product' }));
    await userEvent.type(screen.getByLabelText('Name'), 'PRUCinta Syariah');
    await userEvent.selectOptions(screen.getByLabelText('Channel'), 'syariah');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'education');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body)))
      .toMatchObject({ channel: 'syariah', category: 'education' });

    await userEvent.click(screen.getByRole('button', { name: 'Add a product' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('says so and offers a retry when the catalog cannot be read', async () => {
    render(undefined, {});
    vi.unstubAllGlobals();
    stubFetch({ '/admin/companies/c1/products': { status: 500, body: { message: 'Boom' } } });
    renderWithSession(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });

    expect(await screen.findByText(/Could not read this company’s catalog/))
      .toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' })[0]).toBeInTheDocument();
  });

  it('says a company with no products has none, without pretending it failed', async () => {
    render([]);

    expect(await screen.findByText(/This company has no products yet/)).toBeInTheDocument();
  });
});

describe('P19.2-T2 AC-7 Produk’s long explanation (UI-136, Appendix A)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.2-T2 AC-7 is not drawn on a phone, and is behind ⓘ on a tablet and a laptop, its words unchanged', async () => {
    render();
    await screen.findByText('PRUMapan');

    const line = screen.getByText('This catalog is live.').parentElement!;
    expect(wears(line, 375)).toContain('hidden');
    expect(wears(line, 768)).not.toContain('hidden');
    expect(wears(line, 1280)).not.toContain('hidden');
    // The rest is the ⓘ's bubble: hidden until the ⓘ is pressed.
    expect(screen.getByText(/^It has no draft/)).not.toBeVisible();
    await userEvent.click(within(line).getByRole('button', { name: 'About this catalog' }));
    expect(screen.getByText(/^It has no draft/)).toBeVisible();
  });
});

/**
 * **Produk, one line per product** (P19.2-T2 AC-2; UI-131 — `admin-mobile` screen 3, `admin-desktop` screen 2): below
 * 1024px a 52px line per product (the name, the channel's pill, the status's pill, ›) under the search pill, the chips
 * *Semua n · Konvensional · Syariah* and the filter button; from 1024px a 52px table row (*# · Produk · Kanal · Kategori ·
 * Status · Default di KPM baru · ›*) under the search and the category chips. A row opens the product: a sheet below
 * 1024px, a side panel from it. Reordering only in *Ubah urutan*. The count line stays.
 */
describe('P19.2-T2 AC-2 Produk, one line per product (UI-131)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const SYARIAH = product({
    id: 'p3', code: 'PRUCINTA', name: 'PRUCinta', channel: 'syariah', category: 'health', sortOrder: 3, activeByDefault: false,
  });
  const WITHDRAWN = product({
    id: 'p4', code: 'PGB', name: 'PRULink Generasi Baru (PGB)', category: 'investment', lifecycle: 'withdrawn', sortOrder: 4,
  });
  const SHELF = [product(), SECOND, SYARIAH, WITHDRAWN];
  const lines = () => within(screen.getByRole('list', { name: 'Products' })).getAllByRole('listitem');
  const names = () => Array.from(document.querySelectorAll('[data-row-main]')).map((el) => el.textContent);

  it.each([375, 768])('P19.2-T2 AC-2 at %ipx draws a 52px line per product — the name, the channel, the status, › — and no table', async (px) => {
    atWidth(px);
    render(SHELF);
    await screen.findByRole('list', { name: 'Products' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Withdrawn hidden by default (P19.4-T4 AC-13), as before.
    expect(lines()).toHaveLength(3);
    for (const line of lines()) {
      expect(wears(line, px)).toContain('min-h-[3.25rem]');
      expect(wears(line, px)).not.toContain('min-h-14');
    }
    // One line: the name and the two pills, nothing else — the description and *Active by default* are in its sheet.
    const mapan = lines()[0];
    expect(mapan.textContent).toBe('PRUMapanConventionalActive');
    expect(within(mapan).getByRole('button', { name: 'PRUMapan' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(mapan).getByText('Conventional')).toHaveAttribute('data-tone', 'grey');
    expect(within(mapan).getByText('Active')).toHaveAttribute('data-tone', 'green');
    expect(within(lines()[2]).getByText('Syariah')).toHaveAttribute('data-tone', 'blue');

    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeInTheDocument();
    const chips = screen.getByRole('group', { name: 'Filter by channel' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All3', 'Conventional', 'Syariah']);
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute('aria-haspopup', 'dialog');
    // The laptop's kind toggle and box are in the filter sheet here.
    expect(screen.queryByRole('group', { name: 'Kind' })).not.toBeInTheDocument();
  });

  it('P19.2-T2 AC-2 at 375px narrows by the channel’s chips and by Search products, by name or by code', async () => {
    atWidth(375);
    render(SHELF);
    await screen.findByRole('list', { name: 'Products' });

    await userEvent.click(screen.getByRole('button', { name: 'Syariah' }));
    expect(names()).toEqual(['PRUCinta']);
    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(names()).toEqual(['PRUMapan', 'PRUSmart Plan', 'PRUCinta']);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'smart');
    expect(names()).toEqual(['PRUSmart Plan']);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search products' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'prucinta');
    expect(names()).toEqual(['PRUCinta']);
  });

  it('P19.2-T2 AC-2 at 375px opens the category sheet from the filter button — Life … Investment — with the kind and the withdrawn', async () => {
    atWidth(375);
    render(SHELF);
    await screen.findByRole('list', { name: 'Products' });

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const sheet = screen.getByRole('dialog', { name: 'Filter' });
    const categories = within(sheet).getByRole('radiogroup', { name: 'Category' });
    expect(within(categories).getAllByRole('radio').map((r) => r.textContent))
      .toEqual(['All', 'Life', 'Health', 'Critical illness', 'Education', 'Investment']);
    await userEvent.click(within(categories).getByRole('radio', { name: 'Health' }));
    // The riders spec's kinds (P19.4-T4 AC-9) and *Show withdrawn* (AC-13), in the same sheet below 1024px.
    expect(within(within(sheet).getByRole('radiogroup', { name: 'Kind' })).getAllByRole('radio').map((r) => r.textContent))
      .toEqual(['All', 'Base products', 'Riders']);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(names()).toEqual(['PRUCinta']);
    // The button says a filter is on.
    await userEvent.click(screen.getByRole('button', { name: 'Filter, a filter is on' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Filter' })).getByRole('radio', { name: 'Investment' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Filter' })).getByRole('checkbox', { name: 'Show withdrawn' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Filter' })).getByRole('button', { name: 'Close' }));
    expect(names()).toEqual(['PRULink Generasi Baru (PGB)']);
    expect(within(lines()[0]).getByText('Withdrawn')).toHaveAttribute('data-tone', 'red');
  });

  it.each([375, 768])('P19.2-T2 AC-2 at %ipx opens a product’s edit sheet from its row: the description and Active by default, saved as before', async (px) => {
    atWidth(px);
    const stub = render(SHELF, { 'PATCH /admin/companies/c1/products/p1': { body: product({ activeByDefault: false, version: 2 }) } });
    await userEvent.click(await screen.findByRole('button', { name: 'PRUMapan' }));

    const sheet = screen.getByRole('dialog', { name: 'PRUMapan' });
    expect(sheet.closest('[data-modal-root]')).toHaveAttribute('data-placement', 'drawer');
    expect(within(sheet).getByLabelText('Tagline')).toHaveValue('Proteksi jiwa dengan manfaat pensiun');
    expect(within(sheet).getByRole('group', { name: 'Kind of PRUMapan' })).toBeInTheDocument();
    const byDefault = within(sheet).getByRole('checkbox', { name: /Active by default/ });
    expect(byDefault).toBeChecked();
    await userEvent.click(byDefault);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)))
      .toMatchObject({ activeByDefault: false, expectedVersion: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'PRUMapan' })).not.toBeInTheDocument());
  });

  it.each([1024, 1280])('P19.2-T2 AC-2 at %ipx draws the table — # · Product · Channel · Category · Status · Default in a new office · › — under the search and the category chips', async (px) => {
    atWidth(px);
    render(SHELF);
    const table = await screen.findByRole('table', { name: 'Products' });

    expect(screen.queryByRole('list', { name: 'Products' })).not.toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['#', 'Product', 'Channel', 'Category', 'Status', 'Default in a new office', 'Open']);
    const [, first, , third] = within(table).getAllByRole('row');
    expect(within(first).getAllByRole('cell').map((c) => c.textContent))
      .toEqual(['1', 'PRUMapan', 'Conventional', 'Life', 'Active', 'Yes', '']);
    expect(within(third).getAllByRole('cell').map((c) => c.textContent))
      .toEqual(['3', 'PRUCinta', 'Syariah', 'Health', 'Active', '–', '']);
    expect(wears(first, px)).toContain('h-[3.25rem]');

    expect(screen.getByRole('searchbox', { name: 'Search products' })).toBeInTheDocument();
    const chips = screen.getByRole('group', { name: 'Filter by category' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['All3', 'Life', 'Health', 'Critical illness', 'Education', 'Investment']);
    await userEvent.click(within(chips).getByRole('button', { name: 'Health' }));
    expect(names()).toEqual(['PRUCinta']);
    // The channel's chips and the filter sheet are the phone's and the tablet's; the kind and the box stay here.
    expect(screen.queryByRole('group', { name: 'Filter by channel' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kind' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show withdrawn' })).toBeInTheDocument();
  });

  it.each([1024, 1280])('P19.2-T2 AC-2 at %ipx a row opens its side panel, and Escape closes it without saving', async (px) => {
    atWidth(px);
    const stub = render(SHELF);
    await userEvent.click(await screen.findByRole('button', { name: 'PRUSmart Plan' }));

    const panel = screen.getByRole('dialog', { name: 'PRUSmart Plan' });
    expect(panel.closest('[data-modal-root]')).toHaveAttribute('data-placement', 'drawer');
    expect(within(panel).getByRole('checkbox', { name: /Active by default/ })).not.toBeChecked();
    await userEvent.type(within(panel).getByLabelText('Name'), ' Baru');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'PRUSmart Plan' })).not.toBeInTheDocument();
    expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(false);
  });

  it.each([375, 768, 1024, 1280])('P19.2-T2 AC-2 at %ipx keeps the count line, and reorders only in Change order', async (px) => {
    atWidth(px);
    const stub = render(SHELF, { '/admin/companies/c1/products/reorder': { body: [SECOND, product(), SYARIAH, WITHDRAWN] } });
    await screen.findByRole('button', { name: 'PRUMapan' });

    expect(screen.getByText('4 products · 3 active · 2 active by default in a new office')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move PRUMapan down' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Change order' }));
    // The rows open nothing while the list is being reordered.
    expect(screen.queryByRole('button', { name: 'PRUMapan' })).not.toBeInTheDocument();
    if (px < 1024) {
      // ↑ and ↓ below 1024px, where a drag never starts.
      expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Move PRUMapan down' }));
    } else {
      screen.getByRole('button', { name: /^Reorder PRUMapan\./ }).focus();
      await userEvent.keyboard('{ArrowDown}');
    }
    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/reorder'))).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.url.includes('/reorder'))!.init.body)))
      .toEqual({ productIds: ['p2', 'p1', 'p3', 'p4'] });

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('button', { name: 'PRUMapan' })).toBeInTheDocument();
    expect(screen.getByText('4 products · 3 active · 2 active by default in a new office')).toBeInTheDocument();
  });

  it('P19.2-T2 AC-2 at 1280px drags a row onto another in Change order, and sends the whole shelf', async () => {
    atWidth(1280);
    const stub = render(SHELF, { '/admin/companies/c1/products/reorder': { body: [product(), SYARIAH, SECOND, WITHDRAWN] } });
    await screen.findByRole('button', { name: 'PRUMapan' });
    await userEvent.click(screen.getByRole('button', { name: 'Change order' }));

    const handle = screen.getByRole('button', { name: /^Reorder PRUCinta\./ });
    const onto = screen.getByRole('button', { name: /^Reorder PRUSmart Plan\./ }).closest('tr')!;
    fireEvent.dragStart(handle, { dataTransfer: { setDragImage: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(onto);
    fireEvent.drop(onto);

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/reorder'))).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.url.includes('/reorder'))!.init.body)))
      .toEqual({ productIds: ['p1', 'p3', 'p2', 'p4'] });
  });

  it('P19.2-T2 AC-2 fits 32 products in 2,000px at 375 with All: 32 lines of 52px under three 44px controls', async () => {
    atWidth(375);
    const shelf = Array.from({ length: 32 }, (_, i) => product({
      id: `p${i + 1}`, code: `P${i + 1}`, name: `Produk ${i + 1}`, sortOrder: i + 1, channel: i % 4 === 0 ? 'syariah' : 'conventional',
    }));
    render(shelf);
    await screen.findByRole('list', { name: 'Products' });

    expect(lines()).toHaveLength(32);
    // jsdom lays nothing out: the heights are the classes each box wears at 375 (T4's walk measures the pixels).
    const px = (el: Element) => {
      const token = wears(el, 375).split(' ').find((c) => /^(min-)?h-/.test(c)) ?? '';
      const step = /^(?:min-)?h-(\d+)$/.exec(token);
      if (step) return Number(step[1]) * 4;
      const rem = /^(?:min-)?h-\[(\d+(?:\.\d+)?)rem\]$/.exec(token);
      return rem ? Number(rem[1]) * 16 : NaN;
    };
    // Every line one line tall: no meta line under a plain IDR product.
    for (const line of lines()) {
      expect(px(line)).toBe(52);
      expect(line.querySelector('.mt-0\\.5')).toBeNull();
    }
    const controls = [
      screen.getByRole('searchbox', { name: 'Search products' }).closest('label')!,
      screen.getByRole('button', { name: 'Filter' }),
      screen.getByRole('button', { name: 'Change order' }),
    ];
    const above = controls.reduce((sum, el) => sum + px(el), 0) + 3 * 12;
    expect(32 * 52 + above).toBeLessThanOrEqual(2000);
  });
});

describe('P19.2-T2 AC-4 AC-5 Produk’s controls (UI-134, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx draws no native select on the list, nor in the add sheet: the channel and the category are choice rows', async (px) => {
    atWidth(px);
    const stub = render();
    await screen.findByRole('list', { name: 'Products' });
    expect(document.querySelector('select')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add a product' }));
    const sheet = screen.getByRole('dialog', { name: 'Add a product' });
    expect(document.querySelector('select')).toBeNull();
    await userEvent.type(within(sheet).getByLabelText('Name'), 'PRUCinta');
    await userEvent.click(within(within(sheet).getByRole('radiogroup', { name: 'Channel' })).getByRole('radio', { name: 'Syariah' }));
    const categories = within(sheet).getByRole('radiogroup', { name: 'Category' });
    expect(within(categories).getAllByRole('radio')).toHaveLength(5);
    await userEvent.click(within(categories).getByRole('radio', { name: 'Education' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }));

    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body)))
      .toEqual({ code: 'PRUCINTA', name: 'PRUCinta', channel: 'syariah', category: 'education' });
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px on the list, in Change order and in the filter sheet', async (px) => {
    atWidth(px);
    render([product(), SECOND, product({ id: 'p3', code: 'R', name: 'Rider Plus', kind: 'rider', attachesTo: ['p1'], sortOrder: 3 })]);
    // Inside the field shell's frame, as every `/admin` page is since P19.2-T1 (ADR-0197).
    const frame = document.body.firstElementChild!;
    frame.setAttribute('data-surface', 'v1');
    await screen.findByRole('list', { name: 'Products' });
    expect(smallTargets(frame, px)).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Change order' }));
    expect(smallTargets(frame, px)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(smallTargets(screen.getByRole('dialog', { name: 'Filter' }), px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-2 at %ipx has no axe violations: the list, the filter or the category chips, and a product opened', async (px) => {
    atWidth(px);
    render([product(), SECOND, product({ id: 'p3', code: 'R', name: 'Rider Plus', kind: 'rider', attachesTo: ['p1'], sortOrder: 3 })]);
    await screen.findByRole('button', { name: 'Rider Plus' });
    const clean = async () => expect(
      (await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations,
    ).toEqual([]);
    await clean();
    await userEvent.click(screen.getByRole('button', { name: 'PRUMapan' }));
    await screen.findByRole('dialog', { name: 'PRUMapan' });
    await clean();
  });
});
