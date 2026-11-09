import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import CompaniesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company:crud'],
});

const PRUDENTIAL = {
  _id: 'co-1', name: 'Prudential', slug: 'prudential',
  defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta', status: 'active',
  usesPlatformDefaults: true, kind: 'insurer',
};
const MANULIFE = { ...PRUDENTIAL, _id: 'co-2', name: 'Manulife', slug: 'manulife' };

/** The Template library (ADR-0164), as migration 0037 makes it in every environment. */
const TEMPLATE = {
  _id: '000000000000000000000001', name: 'Template', slug: 'template',
  defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta', status: 'active',
  usesPlatformDefaults: true, kind: 'template',
};

/** `GET /admin/overview`, whose companies carry the counts the list reads (one count for both pages). */
const OVERVIEW = {
  tiles: { companies: 2, kpms: 3, totalMembers: 41, agencyBuilders: 4 },
  attention: [],
  companies: [
    { companyId: 'co-1', name: 'Prudential', initials: 'PR', kpmCount: 2, memberCount: 38, ladder: ['Agent', 'AAB', 'AB'] },
    { companyId: 'co-2', name: 'Manulife', initials: 'MA', kpmCount: 1, memberCount: 3, ladder: ['Agent', 'BP', 'SBP'] },
  ],
};

const section = (publishedVersion: number | null, hasDraft: boolean) => ({ publishedVersion, hasDraft });
/** A company's templates: its default, two of its sections waiting to be published. */
const TEMPLATES = [{
  id: 'tpl-1', companyId: 'co-1', name: 'Prudential template', isDefault: true, status: 'active', archivedAt: null,
  origin: { kind: 'empty' }, publishedVersions: {}, officeCount: 2, createdAt: '2026-10-01', updatedAt: '2026-11-02',
  sections: {
    activity_taxonomy: section(3, true), ratio_set: section(1, false), lead_pipeline: section(1, true),
    activation_checklist: section(1, false), training_taxonomy: section(1, false), capability_ladder: section(1, false),
    event_types: section(1, false), recruitment_playbook: section(1, false), advanced_analytics: section(1, false),
  },
}];

const show = (body: unknown[] = [PRUDENTIAL], extra: Record<string, unknown> = {}) => {
  const stub = stubFetch({ '/admin/companies': { body }, ...extra });
  renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });
  return stub;
};

/** *+ Tambah perusahaan* on the title row, and the sheet it opens (P19.2-T2 AC-3). */
async function openAdd() {
  await userEvent.click(await screen.findByRole('button', { name: 'Add company' }));
  return screen.findByRole('dialog', { name: 'Add a company' });
}

/** ⋯ on a company's row or table row, and one of its items. */
async function choose(company: string, item: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${company}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: item }));
}

const posts = (stub: ReturnType<typeof stubFetch>) => stub.calls.filter((c) => c.init?.method === 'POST');
const patches = (stub: ReturnType<typeof stubFetch>) => stub.calls.filter((c) => c.init?.method === 'PATCH');

describe('companies', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Moved 2026-11-06 (P19.2-T2 AC-1; UI-126): the currency and the time zone left the list's columns for the company's
  // *Pengaturan perusahaan* tab (`[companyId]/settings/page.spec.tsx`); what a new company's offices inherit is said in
  // the add sheet, as it was in the form.
  it('shows the defaults an office will inherit', async () => {
    show([PRUDENTIAL]);
    const sheet = await openAdd();
    expect(within(sheet).getByText('Offices inherit')).toBeInTheDocument();
    expect(within(sheet).getByText('IDR · Asia/Jakarta · id-ID')).toBeInTheDocument();
  });

  it('P3.1-T14 AC-7: fills the slug in from the name', async () => {
    show([]);
    const sheet = await openAdd();

    await userEvent.type(within(sheet).getByLabelText('Name'), 'Chubb Life & General');
    expect(within(sheet).getByLabelText('Slug')).toHaveValue('chubb-life-general');
  });

  it('P3.1-T14 AC-7: stops deriving the moment the slug is edited', async () => {
    // Without the latch a hand-made slug is silently overwritten by the next keystroke
    // in the name — which is the worst of both, since the field still looks editable.
    show([]);
    const sheet = await openAdd();

    await userEvent.type(within(sheet).getByLabelText('Name'), 'Prudential');
    await userEvent.clear(within(sheet).getByLabelText('Slug'));
    await userEvent.type(within(sheet).getByLabelText('Slug'), 'pru-id');
    await userEvent.type(within(sheet).getByLabelText('Name'), ' Indonesia');

    expect(within(sheet).getByLabelText('Slug')).toHaveValue('pru-id');
  });

  // The main button is enabled since P19.2-T2 AC-3 (UI-133): a slug the API would refuse is said as it is typed, and
  // pressing sends nothing — where it was a disabled button.
  it('rejects a slug the API would reject, before the round trip', async () => {
    const stub = show([]);
    const sheet = await openAdd();

    await userEvent.type(within(sheet).getByLabelText('Name'), 'Prudential');
    await userEvent.clear(within(sheet).getByLabelText('Slug'));
    await userEvent.type(within(sheet).getByLabelText('Slug'), 'Prudential Indonesia');
    expect(
      within(sheet).getByText('Lower-case letters and digits, separated by single hyphens.'),
    ).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add company' }));
    expect(posts(stub)).toEqual([]);
  });

  it('P3.1-T14: refuses a shape derivation never produces, matching the server', async () => {
    // `--a--` passed the old rule and no derived slug could ever be it. The two halves
    // now hold the same pattern, so the form cannot offer what the API will refuse.
    const stub = show([]);
    const sheet = await openAdd();

    await userEvent.type(within(sheet).getByLabelText('Name'), 'Prudential');
    await userEvent.clear(within(sheet).getByLabelText('Slug'));
    await userEvent.type(within(sheet).getByLabelText('Slug'), 'a--b');
    expect(within(sheet).getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add company' }));
    expect(posts(stub)).toEqual([]);
  });

  it('adds the new company to the list without a reload, kept in name order', async () => {
    show([{ ...PRUDENTIAL, _id: 'co-2', name: 'Zurich', slug: 'zurich' }], {
      'POST /admin/companies': { status: 201, body: PRUDENTIAL },
    });

    await screen.findByText('Zurich');
    let sheet = await openAdd();
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Prudential');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add company' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const rows = await screen.findAllByRole('row');
    expect(rows[1]).toHaveTextContent('Prudential');
    expect(rows[2]).toHaveTextContent('Zurich');
    // The sheet opens empty again — and so does the touched latch, or the next company's slug would
    // stop deriving for no reason the reader can see.
    sheet = await openAdd();
    expect(within(sheet).getByLabelText('Slug')).toHaveValue('');
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Allianz');
    expect(within(sheet).getByLabelText('Slug')).toHaveValue('allianz');
  });

  it('P3.1-T14 AC-7: puts a taken slug on the slug field, naming the incumbent', async () => {
    // This test used to stub a `CONFLICT` code the API could not produce — it passed
    // because it stubs fetch, while a real duplicate returned 500 INTERNAL_ERROR. The
    // code is real now, and so is the message.
    show([], {
      'POST /admin/companies': {
        status: 409,
        body: {
          error: {
            code: 'COMPANY_SLUG_TAKEN',
            message: 'The slug "prudential" already belongs to Prudential. Edit the slug to something unique.',
            requestId: 'req-8',
          },
        },
      },
    });
    const sheet = await openAdd();

    await userEvent.type(within(sheet).getByLabelText('Name'), 'Prudential');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add company' }));

    // On the field that caused it, not only in a banner above the form — and it names
    // the company they collided with, because the reader never chose the slug.
    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent('already belongs to Prudential');
    expect(within(sheet).getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
    // The sheet stays open on the refusal, with what was typed.
    expect(within(sheet).getByLabelText('Name')).toHaveValue('Prudential');
  });

  describe('changing a company that already exists', () => {
    // Moved 2026-11-06 (P19.2-T2 AC-1, AC-3; UI-126, UI-133): *Ubah* is in the row's ⋯ and opens the company sheet, where
    // it was two fields in the table's row.
    it('renames one, and changes its slug, from ⋯ › Edit', async () => {
      // Both are labels: every office points at its company by id and nothing stores the
      // slug, so unlike a config code neither is write-once.
      const stub = show([PRUDENTIAL], { 'PATCH /admin/companies/co-1': { body: { ...PRUDENTIAL, name: 'Prudential Indonesia' } } });
      await choose('Prudential', 'Edit');

      const sheet = await screen.findByRole('dialog', { name: 'Edit company' });
      const name = within(sheet).getByLabelText('Name');
      expect(within(sheet).getByLabelText('Slug')).toHaveAccessibleDescription(
        'Nothing stores it — every office points at the company by id.',
      );
      await userEvent.clear(name);
      await userEvent.type(name, 'Prudential Indonesia');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

      const sent = patches(stub)[0];
      expect(String(sent?.url)).toContain('/admin/companies/co-1');
      expect(JSON.parse(String(sent?.init?.body)))
        .toEqual({ name: 'Prudential Indonesia', slug: 'prudential' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(await screen.findByRole('link', { name: 'Prudential Indonesia' })).toBeInTheDocument();
    });

    it('will not save a slug the API would refuse', async () => {
      const stub = show();
      await choose('Prudential', 'Edit');

      const sheet = await screen.findByRole('dialog', { name: 'Edit company' });
      const slug = within(sheet).getByLabelText('Slug');
      await userEvent.clear(slug);
      await userEvent.type(slug, '--nope--');
      expect(slug).toHaveAccessibleDescription(expect.stringContaining('Lower-case letters and digits'));

      await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
      expect(patches(stub)).toEqual([]);
    });

    // *Tangguhkan* asks first since P19.2-T2 AC-1 (UI-126: *Tangguhkan asks first*); what it does is said on the item
    // before it is chosen, as the button's tooltip said it.
    it('suspends one, and says what that does before it is clicked', async () => {
      const stub = show([PRUDENTIAL], {
        '/admin/companies/co-1/status': { body: { ...PRUDENTIAL, status: 'suspended' } },
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Actions for Prudential' }));
      const suspend = screen.getByRole('menuitem', { name: 'Suspend' });
      expect(suspend).toHaveAttribute('title', expect.stringContaining('No new person'));
      await userEvent.click(suspend);
      expect(stub.calls.find((c) => String(c.url).includes('/status'))).toBeUndefined();

      const ask = await screen.findByRole('dialog', { name: /^Suspend Prudential\?/ });
      expect(ask).toHaveTextContent('Suspend Prudential? No new person and no new office attaches to it.');
      await userEvent.click(within(ask).getByRole('button', { name: 'Suspend' }));

      await waitFor(() => expect(stub.calls.find((c) => String(c.url).includes('/status'))).toBeDefined());
      const sent = stub.calls.find((c) => String(c.url).includes('/status'));
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ status: 'suspended' });
      expect(await screen.findByText('Suspended')).toBeInTheDocument();
    });

    it('P19.2-T2 AC-1 cancelling Tangguhkan’s question suspends nothing', async () => {
      const stub = show();
      await choose('Prudential', 'Suspend');
      const ask = await screen.findByRole('dialog', { name: /^Suspend Prudential\?/ });
      await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(patches(stub)).toEqual([]);
    });

    it('offers Reactivate, not Suspend, on one that is already suspended', async () => {
      const stub = show([{ ...PRUDENTIAL, status: 'suspended' }], {
        '/admin/companies/co-1/status': { body: PRUDENTIAL },
      });

      expect(await screen.findByText('Suspended')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Actions for Prudential' }));
      expect(screen.queryByRole('menuitem', { name: 'Suspend' })).toBeNull();
      // Reactivating asks nothing: it takes nothing away.
      await userEvent.click(screen.getByRole('menuitem', { name: 'Reactivate' }));
      await waitFor(() => expect(patches(stub)).toHaveLength(1));
      expect(JSON.parse(String(patches(stub)[0].init?.body))).toEqual({ status: 'active' });
    });

    it('says a refused status change on the page, where no sheet is open to say it', async () => {
      show([PRUDENTIAL], {
        '/admin/companies/co-1/status': {
          status: 403, body: { error: { code: 'FORBIDDEN', message: 'Not allowed.', requestId: 'req-9' } },
        },
      });
      await choose('Prudential', 'Suspend');
      await userEvent.click(within(await screen.findByRole('dialog', { name: /^Suspend Prudential\?/ })).getByRole('button', { name: 'Suspend' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed.');
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('says on the row when a company took none of the defaults', async () => {
      // Every template section comes up empty for it, and this is the only thing that explains why.
      show([{ ...PRUDENTIAL, usesPlatformDefaults: false }]);

      expect(await screen.findByText('Started blank')).toBeInTheDocument();
    });

    it.each([375, 1280])(
      'P19.4-T3 AC-12 at %ipx drops “Started blank” once the server says the default template has a published section',
      async (px) => {
        atWidth(px);
        show([
          { ...PRUDENTIAL, _id: 'co-manu', name: 'Manulife', slug: 'manulife', usesPlatformDefaults: false, startedBlank: false },
          { ...PRUDENTIAL, _id: 'co-new', name: 'Sejahtera', slug: 'sejahtera', usesPlatformDefaults: false, startedBlank: true },
        ]);

        // A table's row from 1024px, a list's row below it (P19.2-T2 AC-1).
        const rowOf = (el: HTMLElement) => el.closest('tr, [data-list-row]') as HTMLElement;
        const manulife = rowOf(await screen.findByRole('link', { name: /Manulife/ }));
        const fresh = rowOf(screen.getByRole('link', { name: /Sejahtera/ }));
        expect(within(manulife).queryByText('Started blank')).toBeNull();
        expect(within(fresh).getByText('Started blank')).toBeInTheDocument();
      },
    );

    it('ADR-0185 §1 shows the built-in templates as one card above the insurers, never a row among them', async () => {
      show([PRUDENTIAL, TEMPLATE]);

      const table = within(await screen.findByRole('table'));
      expect(table.queryByRole('row', { name: /^Template/ })).toBeNull();
      const card = screen.getByRole('link', { name: /AgencyBoost built-in templates/ });
      expect(card).toHaveAttribute('href', `/admin/companies/${TEMPLATE._id}`);
      expect(card).toHaveTextContent('Copied when a company or an office is created.');
      expect(screen.queryByText('Template library')).toBeNull();
    });

    it('ADR-0185 §2 opens a company’s page from its name, and has no hidden Company template link', async () => {
      show([PRUDENTIAL]);

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /Prudential/ });
      expect(within(row).getByRole('link', { name: 'Prudential' })).toHaveAttribute('href', '/admin/companies/co-1');
      expect(screen.queryByRole('link', { name: 'Company template' })).toBeNull();
      expect(screen.queryByRole('columnheader', { name: 'Company template' })).toBeNull();
    });

    it('draws no card where there is no library', async () => {
      show([PRUDENTIAL]);
      await screen.findByRole('table');
      expect(screen.queryByRole('link', { name: /AgencyBoost built-in templates/ })).toBeNull();
    });
  });

  describe('starting a company from nothing', () => {
    // *Mulai dari* is two choice rows since P19.2-T2 AC-4 (UI-134), where it was a native select; each row's line under
    // it is its description, as the select's hint was the select's.
    it('P18.6-T3 AC-4, ADR-0185 §1 starts from AgencyBoost built-in templates by default, and sends it as the defaults', async () => {
      const stub = show([PRUDENTIAL, TEMPLATE], {
        'POST /admin/companies': { body: { ...PRUDENTIAL, _id: 'co-2', name: 'Allianz Life', slug: 'allianz-life' } },
      });

      const sheet = await openAdd();
      const start = within(sheet).getByRole('radiogroup', { name: 'Start from' });
      const library = within(start).getByRole('radio', { name: 'AgencyBoost built-in templates' });
      expect(library).toHaveAttribute('aria-checked', 'true');
      expect(library).toHaveAccessibleDescription('A copy of them, with the products, carrier rules and playbook, ready to edit.');

      await userEvent.type(within(sheet).getByLabelText('Name'), 'Allianz Life');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add company' }));
      await waitFor(() => expect(posts(stub)).toHaveLength(1));
      expect(JSON.parse(String(posts(stub)[0].init?.body))).toMatchObject({ name: 'Allianz Life', usesPlatformDefaults: true });
    });

    it('ADR-0185 §1 never says AgencyBoost defaults — not even where no library exists', async () => {
      show([PRUDENTIAL]);

      await screen.findByRole('table');
      const sheet = await openAdd();
      expect(within(sheet).getByRole('radio', { name: 'AgencyBoost built-in templates' })).toHaveAttribute('aria-checked', 'true');
      expect(within(sheet).getByRole('radio', { name: 'Empty' })).toBeInTheDocument();
      expect(screen.queryByText(/AgencyBoost defaults/)).toBeNull();
    });

    it('sends the choice, so a blank company stays blank on every tab', async () => {
      /*
       * The eight template kinds are computed when a tab is opened rather than written at
       * creation, so declining has to be recorded on the company — otherwise the twelve
       * activity types turn up on the Activity types tab with no way to say they were not
       * wanted.
       */
      const stub = show([], { 'POST /admin/companies': { body: { ...PRUDENTIAL, _id: 'co-9', name: 'Blank Co', slug: 'blank-co' } } });
      const sheet = await openAdd();

      await userEvent.type(within(sheet).getByLabelText('Name'), 'Blank Co');
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Empty' }));
      expect(within(sheet).getByRole('radio', { name: 'Empty' })).toHaveAttribute('aria-checked', 'true');
      expect(within(sheet).getByText('Everything starts empty but the role ladder.')).toBeInTheDocument();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add company' }));

      await waitFor(() => expect(posts(stub)).toHaveLength(1));
      expect(JSON.parse(String(posts(stub)[0].init?.body))).toMatchObject({
        name: 'Blank Co', usesPlatformDefaults: false,
      });
    });
  });
});

/**
 * **P19.2-T2 — the companies list's layout** (UI-126, UI-133, UI-134, UI-135; `admin-mobile` screens 2 and 7,
 * `admin-desktop` screens 1 and 4): rows below 1024px, the table's new columns from it, the sheet, no native select, and
 * 44px targets.
 */
describe('P19.2-T2 the companies list (UI-126, UI-133)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const showAll = () => show([PRUDENTIAL, MANULIFE, TEMPLATE], {
    '/admin/overview': { body: OVERVIEW },
    '/admin/companies/co-1/templates': { body: TEMPLATES },
    '/admin/companies/co-2/templates': { body: [{ ...TEMPLATES[0], id: 'tpl-2', companyId: 'co-2', name: 'Manulife template', sections: {} }] },
  });

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx draws no table: one 56px row per company — NAME in caps, slug · n KPM, its state, ⋯', async (px) => {
    atWidth(px);
    showAll();

    const list = await screen.findByRole('list', { name: 'Companies' });
    expect(screen.queryByRole('table')).toBeNull();
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const [prudential, manulife] = rows;
    expect(wears(prudential, px)).toContain('min-h-14');
    const name = within(prudential).getByRole('link', { name: 'Prudential' });
    expect(name).toHaveAttribute('href', '/admin/companies/co-1');
    expect(wears(name, px)).toContain('uppercase');
    await waitFor(() => expect(prudential).toHaveTextContent('prudential · 2 KPM'));
    expect(manulife).toHaveTextContent('manulife · 1 KPM');
    expect(within(prudential).getByText('Active')).toBeInTheDocument();
    expect(within(prudential).getByRole('button', { name: 'Actions for Prudential' })).toHaveTextContent('⋯');
    // The library is the card above, never a row; its sentence is a laptop's (`admin-mobile` screen 2).
    expect(within(list).queryByText(/built-in/)).toBeNull();
    expect(wears(screen.getByText('Copied when a company or an office is created.'), px)).toContain('hidden');
  });

  it.each([375, 768, 1024, 1280])('P19.2-T2 AC-1 at %ipx ⋯ opens Edit · Suspend, and Suspend asks first', async (px) => {
    atWidth(px);
    const stub = showAll();
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Prudential' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit', 'Suspend']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Suspend' }));
    expect(await screen.findByRole('dialog', { name: /^Suspend Prudential\?/ })).toBeInTheDocument();
    expect(patches(stub)).toEqual([]);
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx the table’s columns are Name · Status · Default template · KPM · Members · ⋯', async (px) => {
    atWidth(px);
    showAll();

    const table = await screen.findByRole('table', { name: 'Companies' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Name', 'Status', 'Default template', 'KPM', 'Members', 'Actions']);
    const prudential = within(table).getByRole('row', { name: /Prudential/ });
    await waitFor(() => expect(prudential).toHaveTextContent('Prudential template'));
    // Two sections waiting, counted as the template's card counts them (ADR-0185 §3).
    expect(within(prudential).getByText('2 changes not published')).toBeInTheDocument();
    const cells = within(prudential).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent(/^2$/);
    expect(cells[4]).toHaveTextContent(/^38$/);
    const manulife = within(table).getByRole('row', { name: /Manulife/ });
    expect(manulife).toHaveTextContent('Manulife template');
    expect(within(manulife).queryByText(/not published/)).toBeNull();
    // The slug, the currency and the time zone are the company page's now (UI-126).
    expect(within(table).queryByText('prudential')).toBeNull();
    expect(within(table).queryByText('Asia/Jakarta')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Slug' })).toBeNull();
  });

  it('P19.2-T2 AC-1 a count or a template that cannot be read is a dash, and a row’s meta the slug alone — never a zero', async () => {
    show([PRUDENTIAL], {
      '/admin/overview': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } },
      '/admin/companies/co-1/templates': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } },
    });
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Prudential/ });
    await waitFor(() => expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('—'));
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('—');
    expect(within(row).getAllByRole('cell')[4]).toHaveTextContent('—');
  });

  it('P19.2-T2 AC-1 at 375px a row whose count cannot be read says its slug alone', async () => {
    atWidth(375);
    show([PRUDENTIAL]);
    const row = (await screen.findAllByRole('listitem'))[0];
    await waitFor(() => expect(row.querySelector('[data-row-main] + div')).toHaveTextContent(/^prudential$/));
  });

  it.each([375, 768, 1024, 1280])('P19.2-T2 AC-3 at %ipx shows no form until + is pressed, then a sheet with Cancel / Add company pinned', async (px) => {
    atWidth(px);
    const stub = showAll();
    await screen.findByText('Prudential');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Add a company' })).toBeNull();

    const add = screen.getByRole('button', { name: 'Add company' });
    expect(add).toHaveAttribute('aria-haspopup', 'dialog');
    // A round + on a phone, named by its words; the words on the pill from 768px.
    if (px < 768) expect(add).toHaveTextContent(/^$/);
    else expect(add).toHaveTextContent('Add company');
    await userEvent.click(add);

    const sheet = await screen.findByRole('dialog', { name: 'Add a company' });
    expect(sheet.closest('[data-placement]')).toHaveAttribute('data-placement', px < 768 ? 'sheet' : 'center');
    // The main button is enabled; a field left empty says so when it is pressed, and nothing is sent.
    const main = within(sheet).getByRole('button', { name: 'Add company' });
    expect(main).toBeEnabled();
    await userEvent.click(main);
    expect(within(sheet).getByLabelText('Name')).toHaveAccessibleDescription('Required.');
    expect(within(sheet).getByLabelText('Slug')).toHaveAccessibleDescription(expect.stringContaining('Required.'));
    expect(posts(stub)).toEqual([]);
    expect(within(sheet).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it.each(['Escape', 'close', 'cancel'] as const)('P19.2-T2 AC-3 %s closes the sheet without saving', async (how) => {
    const stub = showAll();
    const sheet = await openAdd();
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Allianz');
    if (how === 'Escape') await userEvent.keyboard('{Escape}');
    else if (how === 'close') await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    else await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posts(stub)).toEqual([]);
    // Opened again, it is empty: nothing typed was kept or saved.
    expect(within(await openAdd()).getByLabelText('Name')).toHaveValue('');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx draws no native select, on the page or in the sheet: Start from is two choice rows', async (px) => {
    atWidth(px);
    showAll();
    await screen.findByText('Prudential');
    expect(document.querySelector('select')).toBeNull();
    const sheet = await openAdd();
    expect(document.querySelector('select')).toBeNull();
    expect(within(within(sheet).getByRole('radiogroup', { name: 'Start from' })).getAllByRole('radio')
      .map((r) => r.getAttribute('aria-labelledby') && document.getElementById(r.getAttribute('aria-labelledby')!)?.textContent))
      .toEqual(['AgencyBoost built-in templates', 'Empty']);
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main, nor in the open sheet', async (px) => {
    atWidth(px);
    showAll();
    await screen.findByText('Prudential');
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
    const sheet = await openAdd();
    expect(smallTargets(sheet, px)).toEqual([]);
  });

  /*
   * **AC-10 — what stays** (the full report's *Don't change* /admin row): *16px inputs on mobile* — the sheet's fields are
   * the shared text inputs, which `globals.css` (*On a phone*) sets at 16px below 768px; and *short empty states* — the
   * list's own words, as they were.
   */
  it.each([375, 1280])('P19.2-T2 AC-10 at %ipx keeps the short empty state, and the sheet’s fields are text inputs the phone’s 16px reaches', async (px) => {
    atWidth(px);
    show([]);
    expect(await screen.findByText('No companies yet. Add one to start provisioning offices.')).toBeInTheDocument();
    const sheet = await openAdd();
    for (const field of within(sheet).getAllByRole('textbox')) {
      expect(field.tagName).toBe('INPUT');
      expect((field as HTMLInputElement).type).toBe('text');
    }
  });

  it.each([375, 1280])('P19.2-T2 AC-1 AC-3 at %ipx has no axe violations: the list, then the sheet open', async (px) => {
    atWidth(px);
    showAll();
    await screen.findByText('Prudential');
    const clean = async () => expect(
      (await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations,
    ).toEqual([]);
    await clean();
    await openAdd();
    await clean();
  });
});
