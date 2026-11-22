import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import ActivityTypesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activity-types',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-9', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read'],
});

const type = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis',
  description: null, appliesToOrgLevelCodes: [], displayOrder: 2, version: 1,
  status: 'active', ...over,
});

const TAXONOMY = [{
  id: 'c1', code: 'SELLING', label: 'Selling', description: null,
  appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
  types: [
    type({ id: 't0', code: 'SELL_PRESENTATION', label: 'Presentasi penjualan', displayOrder: 1 }),
    type(),
  ],
}];

/** The client's three cards (mockup f13): Leads Generation and Selling for everyone, Recruitment for leaders. */
const THREE = [
  {
    id: 'c0', code: 'LEADS_GENERATION', label: 'Leads Generation', description: null,
    appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
    types: [
      type({ id: 'l1', code: 'LEADS_ACTIVITY', categoryCode: 'LEADS_GENERATION', label: 'Melakukan aktivitas leads generation', displayOrder: 1 }),
      type({ id: 'l2', code: 'LEADS_NEW', categoryCode: 'LEADS_GENERATION', label: 'Mendapatkan calon prospek baru', displayOrder: 2 }),
      type({ id: 'l3', code: 'SET_APPOINTMENT', categoryCode: 'LEADS_GENERATION', label: 'Set appointment', displayOrder: 3 }),
    ],
  },
  TAXONOMY[0],
  {
    id: 'c2', code: 'RECRUITMENT', label: 'Recruitment', description: null,
    appliesToOrgLevelCodes: ['AB', 'AAB'], displayOrder: 3, version: 1, status: 'active',
    types: [
      type({ id: 'r1', code: 'REC_PRESENTATION', categoryCode: 'RECRUITMENT', label: 'Presentasi rekrut', displayOrder: 1 }),
      type({ id: 'r2', code: 'REC_NPA', categoryCode: 'RECRUITMENT', label: 'Proses NPA', displayOrder: 2 }),
    ],
  },
];

/** The company's ladder, junior first — what the applies-to control offers. */
const LADDER = [
  { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
  { orgLevelId: 'l2', companyId: 'co-1', code: 'AAB', label: 'AAB', displayOrder: 2, status: 'active', archivedAt: null },
  { orgLevelId: 'l3', companyId: 'co-1', code: 'AB', label: 'AB', displayOrder: 3, status: 'active', archivedAt: null },
];

const QUIET = { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null };

function render(me = OWNER, body: unknown = TAXONOMY) {
  const stub = stubFetch({
    '/kpm/settings/activity-types': { body },
    '/kpm/config': { body: { activity: body, ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: LADDER },
    '/kpm/settings/publish-state': { body: QUIET },
  });
  const view = renderWithSession(
    <TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>,
    { me },
  );
  return { ...stub, container: view.container };
}

/** Press Save and read the batch that went out (P4-T19). */
async function saved(calls: { url: string; init: RequestInit }[]) {
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
  return JSON.parse(post.init.body as string).ops as Record<string, unknown>[];
}

/** Open a ⋯ by its name (*Actions for Selling*) and choose one of its items. */
async function choose(name: string, item: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await userEvent.click(within(screen.getByRole('menu', { name: `Actions for ${name}` })).getByRole('menuitem', { name: item }));
}

const card = (name: string) => screen.getByRole('region', { name });
const rowOf = (label: string) => screen.getByText(label).closest('li')!;
const handleFor = (label: string) => screen.getByRole('button', { name: new RegExp(`^Reorder ${label}`) });

describe('P19.21-T3 AC-1 Activity types as the client’s 19 November cards', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-1 draws a white card per category with “n activities · for who”, activities numbered in each card', async () => {
    render(OWNER, THREE);
    await screen.findByText('Proses NPA');
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'))).toHaveLength(3);
    expect(within(card('Leads Generation')).getByText('3 activities · for Everyone')).toBeInTheDocument();
    expect(within(card('Recruitment')).getByText('2 activities · for AB · AAB')).toBeInTheDocument();
    const numbers = (name: string) => Array.from(card(name).querySelectorAll('[data-number]')).map((n) => n.textContent);
    expect(numbers('Leads Generation')).toEqual(['1', '2', '3']);
    expect(numbers('Selling')).toEqual(['1', '2']);
    expect(numbers('Recruitment')).toEqual(['1', '2']);
  });

  it('P19.21-T3 AC-1 puts Activity binding and + Add category in the toolbar, + Add activity at each card’s foot', async () => {
    render(OWNER, THREE);
    await screen.findByText('Proses NPA');
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
    for (const name of ['Leads Generation', 'Selling', 'Recruitment']) {
      const add = within(card(name)).getByRole('button', { name: `Add activity to ${name}` });
      // WCAG 2.5.3: the accessible name begins with the words on the line.
      expect(add).toHaveTextContent('Add activity');
    }
  });

  it('P19.21-T3 AC-1 gives every category and every activity one ⋯ with Rename, Change who it is for and Archive', async () => {
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Selling' }));
    const menu = screen.getByRole('menu', { name: 'Actions for Selling' });
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Rename', 'Change who it is for', 'Archive']);
    expect(within(menu).getByRole('menuitem', { name: 'Archive' })).toHaveAccessibleDescription('Archives the section and everything in it.');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Submission polis' }));
    expect(within(screen.getByRole('menu', { name: 'Actions for Submission polis' })).getAllByRole('menuitem')
      .map((m) => m.textContent)).toEqual(['Rename', 'Archive']);
  });

  it('P19.21-T3 AC-1 draws the legend under the cards: drag, ⋯, and the archived switch', async () => {
    render();
    await screen.findByText('Submission polis');
    expect(screen.getByText('Drag ⠿ to change the order')).toBeInTheDocument();
    expect(screen.getByText('⋯ = rename, who it is for, archive')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show archived' })).not.toBeChecked();
  });

  it('P19.21-T3 AC-1 shows a reader the cards and none of the controls — no ⋯, no ⠿, no add, no legend but the switch', async () => {
    // The API refuses them too (`activity.tenancy.spec.ts`) — this is convenience, not control.
    render(AGENT);
    await screen.findByText('Submission polis');
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
    expect(screen.queryByText('⠿')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add activity to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add category' })).toBeNull();
    expect(screen.queryByText('Drag ⠿ to change the order')).toBeNull();
    expect(screen.getByText('2 activities · for Everyone')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show archived' })).toBeInTheDocument();
  });

  it('P19.21-T3 AC-1 is clean under axe with the cards populated and a ⋯ open', async () => {
    const { container } = render(OWNER, THREE);
    await screen.findByText('Proses NPA');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Selling' }));
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  it('P19.21-T3 AC-1 an office with no category says so in the page’s layout', async () => {
    render(OWNER, []);
    expect(await screen.findByText('No activity types yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
  });

  it('P19.21-T3 AC-1 a failed read says why, through the screen’s banner', async () => {
    stubFetch({
      '/kpm/settings/activity-types': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something broke.', requestId: 'r-0' } } },
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: LADDER },
      '/kpm/settings/publish-state': { body: QUIET },
    });
    renderWithSession(<TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>, { me: OWNER });
    expect((await screen.findAllByRole('alert')).some((a) => a.textContent?.includes('Something broke.'))).toBe(true);
  });
});

describe('the office activity taxonomy (P4-T1), inside the 19 November card', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('what is staged is what is shown (P4-T19)', () => {
    it('shows an archived type as archived before anything is saved', async () => {
      render();
      await choose('Submission polis', 'Archive');
      const row = rowOf('Submission polis');
      expect(within(row).getByText('Archived — not saved yet')).toBeInTheDocument();
      expect(within(row).getByText(/archived/)).toBeInTheDocument();
    });

    it('draws a type that does not exist yet, in the card it was added to and no other', async () => {
      render(OWNER, THREE);
      await userEvent.click(await screen.findByRole('button', { name: 'Add activity to Selling' }));
      await userEvent.type(screen.getByLabelText('Code'), 'SELL_REFERRAL');
      await userEvent.type(screen.getByLabelText('Label'), 'Referral masuk');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(screen.getAllByText('Referral masuk')).toHaveLength(1);
      expect(within(card('Selling')).getByText('Added — not saved yet')).toBeInTheDocument();
      expect(within(card('Selling')).getByText('3 activities · for Everyone')).toBeInTheDocument();
      expect(within(card('Recruitment')).getByText('2 activities · for AB · AAB')).toBeInTheDocument();
    });

    it('takes one row back without discarding every other staged change', async () => {
      render();
      await choose('Submission polis', 'Archive');
      await userEvent.click(within(rowOf('Submission polis')).getByRole('button', { name: 'Undo' }));
      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
    });

    it('holds everything until Save changes, says how much is held, and saving is not publishing', async () => {
      const { calls } = render();
      await choose('Presentasi penjualan', 'Archive');
      await userEvent.click(screen.getByRole('button', { name: 'Add category' }));
      await userEvent.type(screen.getByLabelText('Code'), 'REFERRALS');
      await userEvent.type(screen.getByLabelText('Name'), 'Referrals');
      await userEvent.click(screen.getByRole('button', { name: 'Add the section' }));

      expect(screen.getByText(/2 changes not saved yet/)).toBeInTheDocument();
      expect(screen.getByText(/publishing to agents is a separate step/)).toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/kpm/settings/changes'))).toBe(false);
      expect(await saved(calls)).toEqual([
        { op: 'type.archive', id: 't0', expectedVersion: 1 },
        expect.objectContaining({ op: 'category.create', body: expect.objectContaining({ code: 'REFERRALS', label: 'Referrals' }) }),
      ]);
    });

    it('discards without sending', async () => {
      const { calls } = render();
      await choose('Presentasi penjualan', 'Archive');
      await userEvent.click(screen.getByRole('button', { name: 'Discard them' }));
      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/kpm/settings/changes'))).toBe(false);
    });
  });

  describe('where the code is shown (P4-T24, parity I-64)', () => {
    it('keeps codes out of the cards, and shows the code read-only in the type’s sheet', async () => {
      render();
      await screen.findByText('Submission polis');
      expect(screen.queryByText('SELL_SUBMISSION')).not.toBeInTheDocument();
      await choose('Submission polis', 'Rename');
      const sheet = await screen.findByRole('dialog', { name: 'Submission polis' });
      const code = within(sheet).getByLabelText('Code');
      expect(code).toHaveValue('SELL_SUBMISSION');
      expect(code).toHaveAttribute('readonly');
      expect(code).not.toBeDisabled();
    });

    it('asks for the code while creating, because that is the one moment it is set', async () => {
      render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add activity to Selling' }));
      expect(screen.getByLabelText('Code')).toBeEnabled();
    });
  });

  it('always reads the archived rows, and filters for display; an archived row gets no number and a way back', async () => {
    const { calls } = render(OWNER, [{
      ...TAXONOMY[0],
      types: [
        type({ id: 't0', code: 'A', label: 'First', displayOrder: 1 }),
        type({ id: 't9', code: 'SELL_OLD', label: 'Retired', status: 'archived', displayOrder: 2 }),
        type({ id: 't2', code: 'C', label: 'Third', displayOrder: 3 }),
      ],
    }]);
    await screen.findByText('First');
    const reads = calls.filter((c) => c.url.includes('activity-types'));
    expect(reads).toHaveLength(1);
    expect(reads[0].url).toContain('includeArchived=true');
    expect(screen.queryByText('Retired')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(screen.getByText('Retired')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('activity-types'))).toHaveLength(1);
    const numbers = Array.from(document.querySelectorAll('[data-number]')).map((n) => n.textContent);
    expect(numbers).toEqual(['1', '–', '2']);
    // Counted over the live rows only.
    expect(screen.getByText('2 activities · for Everyone')).toBeInTheDocument();
    await choose('Retired', 'Restore');
    expect(within(rowOf('Retired')).getByText(/Restored — not saved yet/)).toBeInTheDocument();
  });

  it('sends a new type under the category it was added to, with its description and short name', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Add activity to Selling' }));
    await userEvent.type(screen.getByLabelText('Code'), 'sell_referral');
    await userEvent.type(screen.getByLabelText('Label'), 'Meminta referensi dari nasabah lama');
    await userEvent.type(screen.getByLabelText('Short name'), 'Referensi');
    await userEvent.type(screen.getByLabelText('Description'), 'dari nasabah lama');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await saved(calls))[0]).toMatchObject({
      op: 'type.create',
      body: {
        code: 'SELL_REFERRAL', categoryCode: 'SELLING', label: 'Meminta referensi dari nasabah lama',
        shortLabel: 'Referensi', description: 'dari nasabah lama',
      },
    });
  });

  it('P19.8-T4 AC-5 the type’s sheet holds the short name under the name, sends a change, and null when cleared', async () => {
    const { calls } = render(OWNER, [{
      ...TAXONOMY[0],
      types: [
        type({ id: 't0', code: 'SELL_PRESENTATION', label: 'Presentasi penjualan', shortLabel: 'Presentasi', displayOrder: 1 }),
        type({ shortLabel: 'Submission polis' }),
      ],
    }]);
    await choose('Presentasi penjualan', 'Rename');
    let sheet = await screen.findByRole('dialog', { name: 'Presentasi penjualan' });
    const field = within(sheet).getByLabelText('Short name');
    expect(field).toHaveValue('Presentasi');
    expect(field).toHaveAttribute('maxlength', '20');
    const labels = within(sheet).getAllByRole('textbox').map((box) => box.id.replace(/-t0$|-type-code-SELL_PRESENTATION$/, ''));
    expect(labels).toEqual(['code', 'label', 'short-label', 'description']);
    await userEvent.clear(field);
    await userEvent.type(within(sheet).getByLabelText('Description'), 'telepon, WhatsApp');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

    await choose('Submission polis', 'Rename');
    sheet = await screen.findByRole('dialog', { name: 'Submission polis' });
    // Held to the server's 20: *Submission polis baru* would be 21.
    await userEvent.type(within(sheet).getByLabelText('Short name'), ' baru');
    expect(within(sheet).getByLabelText('Short name')).toHaveValue('Submission polis bar');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

    expect(await saved(calls)).toEqual([
      expect.objectContaining({
        op: 'type.update', id: 't0', expectedVersion: 1,
        body: expect.objectContaining({ label: 'Presentasi penjualan', shortLabel: null, description: 'telepon, WhatsApp' }),
      }),
      expect.objectContaining({ op: 'type.update', id: 't1', body: expect.objectContaining({ shortLabel: 'Submission polis bar' }) }),
    ]);
  });

  it('P13.2-T6 AC-3 says plainly that a cascade type cannot be archived, without the batch’s bookkeeping', async () => {
    render();
    await screen.findByText('Submission polis');
    stubFetch({
      '/kpm/settings/activity-types': { body: TAXONOMY },
      '/kpm/settings/publish-state': { body: QUIET },
      '/kpm/settings/changes': {
        status: 409,
        body: {
          error: {
            code: 'ACTIVITY_TYPE_BOUND',
            message: 'Change 1 (type.archive): “Submission polis” cannot be archived: the summary and the goal plan count it as Submission polis. A Super Admin can bind another activity in its place first. You can rename it, describe it, reorder it or move it to another section.',
            requestId: 'r-2',
            details: { codes: ['SELL_SUBMISSION'], roles: ['Submission polis'] },
          },
        },
      },
    });
    await choose('Submission polis', 'Archive');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const shown = (await screen.findAllByRole('alert')).find((a) => a.textContent?.includes('cannot be archived'))!;
    expect(shown).toHaveTextContent(/^“Submission polis” cannot be archived: the summary and the goal plan count it/);
    expect(shown.textContent).not.toContain('Change 1');
  });

  describe('reordering (P4-T18)', () => {
    const dataTransfer = () => ({ effectAllowed: '', setData: vi.fn(), getData: vi.fn(), setDragImage: vi.fn() });

    it('the ⠿ is the keyboard path: ↑ sends every id in the new order, and nothing at an end', async () => {
      const { calls } = render();
      await screen.findByText('Submission polis');
      expect(handleFor('Submission polis')).toHaveAccessibleName(/Press the up or down arrow/);
      fireEvent.keyDown(handleFor('Presentasi penjualan'), { key: 'ArrowUp' });
      expect(calls.some((c) => c.url.includes('reorder'))).toBe(false);
      fireEvent.keyDown(handleFor('Submission polis'), { key: 'ArrowUp' });
      const call = calls.find((c) => c.url.includes('activity-types/reorder'))!;
      expect(JSON.parse(call.init.body as string)).toEqual({ ids: ['t1', 't0'] });
      // Immediately: a drag that did nothing visible would be worse than one more write.
      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
    });

    it('sends the whole list, spliced, when a row is dropped on another', async () => {
      const { calls } = render();
      await screen.findByText('Submission polis');
      fireEvent.dragStart(handleFor('Submission polis'), { dataTransfer: dataTransfer() });
      fireEvent.dragOver(rowOf('Presentasi penjualan'), { dataTransfer: dataTransfer() });
      fireEvent.drop(rowOf('Presentasi penjualan'), { dataTransfer: dataTransfer() });
      const patch = calls.find((c) => c.url.includes('activity-types/reorder'))!;
      expect(JSON.parse(patch.init.body as string)).toEqual({ ids: ['t1', 't0'] });
    });

    it('moves a category by its ⠿, the whole list sent', async () => {
      const { calls } = render(OWNER, THREE);
      await screen.findByText('Proses NPA');
      fireEvent.keyDown(handleFor('Recruitment'), { key: 'ArrowUp' });
      const call = calls.find((c) => c.url.includes('activity-categories/reorder'))!;
      expect(JSON.parse(call.init.body as string)).toEqual({ ids: ['c0', 'c2', 'c1'] });
    });
  });

  describe('a category’s ⋯ (P4-T18, P10.1-T5, P19.21-T3 AC-1)', () => {
    it('reads an empty applicability as Everyone, and names rungs by their company labels', async () => {
      render(OWNER, [{ ...TAXONOMY[0], appliesToOrgLevelCodes: ['AB', 'AAB'] }]);
      expect(await screen.findByText('2 activities · for AB · AAB')).toBeInTheDocument();
    });

    it('Change who it is for opens the rungs under the head, takes the focus, saves only them, and gives the ⋯ the focus back', async () => {
      const { calls } = render();
      await choose('Selling', 'Change who it is for');
      expect(screen.getByLabelText('Agent')).toHaveFocus();
      await userEvent.click(screen.getByLabelText('AB'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('button', { name: 'Actions for Selling' })).toHaveFocus();
      expect((await saved(calls))[0]).toMatchObject({
        op: 'category.update', id: 'c1', expectedVersion: 1, body: { appliesToOrgLevelCodes: ['AB'] },
      });
    });

    it('Rename opens the name, description and summary tile under the head; Cancel gives the ⋯ the focus back', async () => {
      render(OWNER, [{ ...TAXONOMY[0], summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling' }]);
      await choose('Selling', 'Rename');
      expect(screen.getByLabelText('Name')).toHaveFocus();
      expect(screen.getByLabelText('Summary tile')).toHaveValue('Selling');
      expect(screen.getByLabelText('Summary tile')).toHaveAccessibleDescription(
        'Sections with the same tile are counted together. Empty gives it a tile of its own.',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Actions for Selling' })).toHaveFocus();
    });

    it('AC-5 (ADR-0064): a rename joins a tile by its name, both fields written', async () => {
      const GROUPED = [
        { ...TAXONOMY[0], summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling' },
        {
          id: 'c2', code: 'REFERRALS', label: 'Referrals', description: null, appliesToOrgLevelCodes: [],
          displayOrder: 2, version: 3, status: 'active', summaryGroupCode: null, summaryGroupLabel: null, types: [],
        },
      ];
      const { calls } = render(OWNER, GROUPED);
      await choose('Referrals', 'Rename');
      await userEvent.type(screen.getByLabelText('Summary tile'), 'selling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(within(card('Referrals')).getByText('Edited — not saved yet')).toBeInTheDocument();
      expect((await saved(calls))[0]).toMatchObject({
        op: 'category.update', id: 'c2', expectedVersion: 3,
        body: { label: 'Referrals', summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling' },
      });
    });

    it('AC-5 (OD-101): refuses another name for a tile the section has to itself, at the field', async () => {
      const { calls } = render(OWNER, [{ ...TAXONOMY[0], summaryGroupCode: null, summaryGroupLabel: null }, {
        id: 'c2', code: 'REFERRALS', label: 'Referrals', description: null, appliesToOrgLevelCodes: [],
        displayOrder: 2, version: 3, status: 'active', summaryGroupCode: null, summaryGroupLabel: null, types: [],
      }]);
      await choose('Selling', 'Rename');
      const field = screen.getByLabelText('Summary tile');
      await userEvent.type(field, 'Penjualan');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(field).toHaveAccessibleDescription(expect.stringContaining('A section with a tile of its own shows its own name.'));
      expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
    });

    it('Archive stages the archive; an archived category’s ⋯ offers Restore in its place', async () => {
      const { calls } = render(OWNER, [TAXONOMY[0], {
        id: 'c2', code: 'RECRUITING', label: 'Recruiting', description: null, appliesToOrgLevelCodes: ['AB'],
        displayOrder: 2, version: 3, status: 'archived', types: [],
      }]);
      await choose('Selling', 'Archive');
      await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
      await choose('Recruiting', 'Restore');
      expect(await saved(calls)).toEqual([
        { op: 'category.archive', id: 'c1', expectedVersion: 1 },
        { op: 'category.restore', id: 'c2', expectedVersion: 3 },
      ]);
    });
  });

  describe('the activity binding (P18.6-T2, P19.4-T3)', () => {
    const READER = makeMe({ ...OWNER, permissions: [...OWNER.permissions, 'activity_binding:read'] });

    it('P18.6-T2 AC-3 marks each bound type with the stage it counts as, on its row', async () => {
      stubFetch({
        '/kpm/settings/activity-types': { body: TAXONOMY },
        '/kpm/settings/activity-binding': {
          body: {
            leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'],
            version: 1, updatedAt: null,
          },
        },
        '/kpm/config': { body: { activity: TAXONOMY, ratios: [], leadPipelines: [], version: 1 } },
        '/kpm/org-levels': { body: LADDER },
        '/kpm/settings/publish-state': { body: QUIET },
      });
      renderWithSession(<TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>, { me: READER });
      const meeting = await screen.findByText('Counts as: Sales meeting');
      expect(meeting).toHaveAttribute('title', expect.stringContaining('count this as Sales meeting'));
      expect(meeting.closest('p')).toHaveTextContent('Presentasi penjualanCounts as: Sales meeting');
      expect(screen.getByText('Counts as: Submission polis')).toBeInTheDocument();
    });

    it('P18.6-T2 AC-3 asks nothing of a reader without the permission', async () => {
      const { calls } = render(AGENT);
      await screen.findByText('Submission polis');
      expect(calls.some((c) => c.url.includes('/kpm/settings/activity-binding'))).toBe(false);
    });
  });
});

describe('P19.2-T3 the activity types on a phone and a tablet (UI-141, UI-142)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-1 at 375px keeps the cards in one column with the same content, ↑ ↓ beside a category’s ⠿', async () => {
    atWidth(375);
    const { calls } = render(OWNER, THREE);
    await screen.findByText('Proses NPA');
    expect(screen.getByText('3 activities · for Everyone')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Move Recruitment up' }));
    expect(calls.some((c) => c.url.includes('reorder'))).toBe(true);
  });

  it('P19.2-T3 AC-3 at 375px a type’s sheet carries ↑ ↓, which move it through the same reorder', async () => {
    atWidth(375);
    const { calls } = render();
    await choose('Submission polis', 'Rename');
    const sheet = await screen.findByRole('dialog', { name: 'Submission polis' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Move Submission polis up' }));
    const call = calls.find((c) => c.url.includes('activity-types/reorder'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({ ids: ['t1', 't0'] });
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx finds no target under 44px, with an item staged and the archived shown', async (px) => {
    atWidth(px);
    stubFetch({
      '/kpm/settings/activity-types': { body: TAXONOMY },
      '/kpm/config': { body: { activity: TAXONOMY, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: LADDER },
      '/kpm/settings/publish-state': { body: QUIET },
    });
    const { container } = renderWithSession(
      <div data-surface="v1"><TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider></div>,
      { me: OWNER },
    );
    await screen.findByText('Submission polis');
    await choose('Submission polis', 'Archive');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(smallTargets(container, px)).toEqual([]);
  });

  it('P19.2-T3 AC-4 draws Show archived as a 44px switch row below 1024px, and the checkbox it was from 1024px', async () => {
    atWidth(375);
    render();
    const box = await screen.findByRole('checkbox', { name: 'Show archived' });
    const label = box.closest('label')!;
    expect(wears(label, 375).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'relative', "after:content-['']"]));
    expect(wears(label, 1024)).toBe('flex items-center gap-2 text-sm text-muted');
  });
});
