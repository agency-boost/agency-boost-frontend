import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
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
  objectionTheySay: 'Pensiun masih lama.',
  objectionYouSay: 'Pilihan pensiun paling terjangkau.',
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

/** Open a product for editing and hand back the panel it opened. */
async function open(name: string) {
  const row = (await screen.findByText(name)).closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  return row;
}

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

    expect(await screen.findByText('PRUMapan')).toBeInTheDocument();
    const row = (await screen.findByText('PRUMapan')).closest('li')!;
    expect(within(row).getByText('PRUMapan')).toBeInTheDocument();
    expect(within(row).getByText('Conventional')).toBeInTheDocument();
    expect(within(row).getByText('Life')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByText('Active by default')).toBeInTheDocument();
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

  it('opens the seven attack-plan fields the Owner’s own override modal names', async () => {
    render();
    const row = await open('PRUMapan');

    const labels = [
      '0 · Good fit for', '1 · Opening line', '2 · Lead with these benefits', '3 · Full script',
      '4a · If they push back — they say', '4b · If they push back — you say', '5 · Next action',
    ];
    for (const label of labels) expect(within(row).getByLabelText(label)).toBeInTheDocument();

    // **In the modal's own order.** They were rendered 0, 1, 3, 4a, 4b, 5, 2 — the numbers are
    // the reader's map through the script, and one out of place reads as a form that lost a field.
    const onScreen = within(row).getAllByText(/^[0-9]+[ab]? · /).map((el) => el.textContent);
    expect(onScreen).toEqual(labels);
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

    // Seven budget bands, not five: the scale of the copy the ERD records.
    expect(within(row).getAllByRole('checkbox', { name: /Rp/ })).toHaveLength(6);
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
      // A comma or a point (ADR-0167 §1, P18.95-T1 AC-3): *12,5* is twelve and a half per cent.
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
    expect(await within(row).findByText('Withdrawn')).toBeInTheDocument();
  });

  it('offers Reopen, and never a delete', async () => {
    render([product({ lifecycle: 'closed_to_new_business' })]);
    const row = await open('PRUMapan');

    expect(within(row).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('sends the whole shelf when a row moves, so two people cannot interleave', async () => {
    const stub = render(undefined, {
      '/admin/companies/c1/products/reorder': { body: [SECOND, product()] },
    });
    await screen.findByText('PRUMapan');

    const row = (await screen.findByText('PRUMapan')).closest('li')!;
    // The handle is the keyboard path as well as the grab affordance: focus it, press ↓.
    within(row).getByRole('button', { name: /^Reorder PRUMapan\./ }).focus();
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
