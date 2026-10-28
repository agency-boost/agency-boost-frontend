import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
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

/** The company's ladder, junior first — what the applies-to control offers. */
const LADDER = [
  { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
  { orgLevelId: 'l2', companyId: 'co-1', code: 'AAB', label: 'AAB', displayOrder: 2, status: 'active', archivedAt: null },
  { orgLevelId: 'l3', companyId: 'co-1', code: 'AB', label: 'AB', displayOrder: 3, status: 'active', archivedAt: null },
];

function render(me = OWNER, body: unknown = TAXONOMY) {
  const stub = stubFetch({
    '/kpm/settings/activity-types': { body },
    // The provider's two reads. The ladder belongs to the company (ADR-0012) and this
    // screen reads it rather than owning a copy, so the test supplies it the same way.
    '/kpm/config': { body: { activity: body, ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: LADDER },
  });
  renderWithSession(
    <TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>,
    { me },
  );
  return stub;
}

/** Press Save and read the batch that went out (P4-T19). */
async function saved(calls: { url: string; init: RequestInit }[]) {
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
  return JSON.parse(post.init.body as string).ops as Record<string, unknown>[];
}

describe('the office activity taxonomy (P4-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('what is staged is what is shown (P4-T19)', () => {
    /*
     * All eight of this screen's operations staged correctly and none of them appeared.
     * Archiving showed nothing; adding a type drew no row; the only evidence was a count
     * in a bar. The suite passed throughout, because every test read the request body.
     */
    it('shows an archived type as archived before anything is saved', async () => {
      render();
      const row = (await screen.findByText('Submission polis')).closest('li')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));

      expect(within(row).getByText('Archived — not saved yet')).toBeInTheDocument();
      expect(within(row).getByText(/archived/)).toBeInTheDocument();
    });

    it('draws a type that does not exist yet, so Add is not a button that does nothing', async () => {
      render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add to Selling' }));
      await userEvent.type(screen.getByLabelText('Code'), 'SELL_REFERRAL');
      await userEvent.type(screen.getByLabelText('Label'), 'Referral masuk');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      const row = screen.getByText('Referral masuk').closest('li')!;
      expect(within(row).getByText('Added — not saved yet')).toBeInTheDocument();
    });

    it('puts a new type in the section it was added to, and in no other', async () => {
      render(OWNER, [...TAXONOMY, {
        id: 'c2', code: 'RECRUITING', label: 'Recruiting', description: null,
        appliesToOrgLevelCodes: [], displayOrder: 2, version: 1, status: 'active', types: [],
      }]);
      await userEvent.click(await screen.findByRole('button', { name: 'Add to Selling' }));
      await userEvent.type(screen.getByLabelText('Code'), 'SELL_REFERRAL');
      await userEvent.type(screen.getByLabelText('Label'), 'Referral masuk');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(screen.getAllByText('Referral masuk')).toHaveLength(1);
      const other = screen.getByRole('heading', { name: 'Recruiting' })
        .closest('div')!.parentElement!;
      expect(within(other).getByText(/0 items/)).toBeInTheDocument();
    });

    it('counts the toolbar sentence off what is on screen', async () => {
      render();
      expect(await screen.findByText(/2 activity types across 1 categories/)).toBeInTheDocument();

      const row = screen.getByText('Submission polis').closest('li')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));

      // Described the saved taxonomy while the cards showed the staged one.
      expect(screen.getByText(/1 activity types across 1 categories/)).toBeInTheDocument();
    });

    it('takes one row back without discarding every other staged change', async () => {
      render();
      const row = (await screen.findByText('Submission polis')).closest('li')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));
      await userEvent.click(within(row).getByRole('button', { name: 'Undo' }));

      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
      expect(screen.queryByText(/change not saved/)).not.toBeInTheDocument();
    });
  });

  it('puts the section heading hard left whoever is reading', async () => {
    /*
     * The head had three children under `justify-between`, so the heading floated to the
     * middle — and the first child is behind `canWrite`, so **the heading moved depending
     * on the reader's permission**. The prototype's `.acttype-card-head` has two children.
     */
    render();
    const owner = (await screen.findByRole('heading', { name: 'Selling' })).parentElement!;
    expect(owner.className).not.toContain('justify-between');
    expect(owner.lastElementChild?.className).toContain('ml-auto');

    vi.unstubAllGlobals();
    render(AGENT);
    const agent = (await screen.findByRole('heading', { name: 'Selling' })).parentElement!;
    expect(agent.className).not.toContain('justify-between');
  });

  it('groups the types into the cards the prototype draws', async () => {
    render();
    const heading = await screen.findByRole('heading', { name: 'Selling' });
    const card = heading.closest('div')!.parentElement!;
    expect(within(card).getByText(/2 items/)).toBeInTheDocument();
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
  });

  describe('where the code is shown (P4-T24, parity I-64)', () => {
    /*
     * This reverses what I-64 registered. The code was under every row on the reasoning
     * that the prototype's numbers 1–12 are position and the code is identity, which is
     * still true — the number is still on screen and still about to change. What that
     * argument did not weigh is that the identity matters at the two moments a reader acts
     * on it, and is noise under all twelve rows the rest of the time.
     *
     * So: absent from the list, a field while creating, and read-only while editing —
     * **and no toggle**. The client asked for a minimal screen, and a checkbox that puts
     * the noise back is still a checkbox on every settings toolbar.
     */
    it('keeps codes out of the list, with nothing that puts them back', async () => {
      render();
      await screen.findByText('Submission polis');

      expect(screen.queryByText('SELL_SUBMISSION')).not.toBeInTheDocument();
      expect(screen.queryByText('SELLING')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Show codes' })).not.toBeInTheDocument();
    });

    it('still says a row is archived when codes are hidden', async () => {
      // The code and the archived note shared one line, so hiding the first hid the second.
      render(OWNER, [{
        ...TAXONOMY[0],
        types: [type({ status: 'archived' })],
      }]);
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));

      expect(screen.getByText('archived')).toBeInTheDocument();
    });

    it('shows the code, not editable, inside the edit panel', async () => {
      render();
      const row = (await screen.findByText('Submission polis')).closest('li')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));

      /*
       * A labelled field, read-only — **not disabled**. The old argument was that disabled
       * reads as *"not right now"* and this is never, which still holds; `readOnly` answers it
       * without leaving the tab order or refusing to be copied, and somebody quoting a code in
       * a support ticket has to be able to select it.
       */
      const code = within(row).getByLabelText('Code');
      expect(code).toHaveValue('SELL_SUBMISSION');
      expect(code).toHaveAttribute('readonly');
      expect(code).not.toBeDisabled();
    });

    it('asks for the code while creating, because that is the one moment it is set', async () => {
      render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add to Selling' }));

      expect(screen.getByLabelText('Code')).toBeEnabled();
    });
  });

  /** The handle is the keyboard path now — the ↑↓ buttons it replaced were the old one. */
  const handleFor = (label: string) =>
    screen.getByRole('button', { name: new RegExp(`^Reorder ${label}`) });

  it('sends every id in the new order when one row moves', async () => {
    // Not a single move: two people dragging at once would otherwise interleave into an
    // order neither asked for.
    const { calls } = render();
    await screen.findByText('Submission polis');
    fireEvent.keyDown(handleFor('Submission polis'), { key: 'ArrowUp' });

    const call = calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({ ids: ['t1', 't0'] });
  });

  it('does nothing at the ends of the list', async () => {
    const { calls } = render();
    await screen.findByText('Submission polis');
    // The handle replaced two disabled buttons with one that is a no-op at the edges —
    // fewer controls to read, and the same outcome.
    fireEvent.keyDown(handleFor('Presentasi penjualan'), { key: 'ArrowUp' });
    fireEvent.keyDown(handleFor('Submission polis'), { key: 'ArrowDown' });
    expect(calls.some((c) => c.url.includes('reorder'))).toBe(false);
  });

  it('archives rather than deletes, and says so on the control', async () => {
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    expect(await saved(calls)).toEqual([
      { op: 'type.archive', id: 't0', expectedVersion: 1 },
    ]);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('always reads the archived rows, and filters for display', async () => {
    /*
     * This asserted the opposite until the reorder defect was found, and the assertion
     * was the defect: reading only the visible rows sent a short list to a reorder
     * endpoint that counts every type the office has, so one archived type broke
     * reordering permanently. Reading once and filtering also makes the toggle free.
     */
    const { calls } = render(OWNER, [{
      ...TAXONOMY[0],
      types: [type(), type({ id: 't9', code: 'SELL_OLD', label: 'Retired', status: 'archived' })],
    }]);
    await screen.findByText('Submission polis');
    const reads = calls.filter((c) => c.url.includes('activity-types'));
    expect(reads.length).toBe(1);
    expect(reads[0].url).toContain('includeArchived=true');
    expect(screen.queryByText('Retired')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(screen.getByText('Retired')).toBeInTheDocument();
    // No second request: the rows were already here.
    expect(calls.filter((c) => c.url.includes('activity-types')).length).toBe(1);
  });

  it('counts only the active ones in the heading, whatever is shown', async () => {
    render(OWNER, [{
      ...TAXONOMY[0],
      types: [type(), type({ id: 't9', code: 'SELL_OLD', label: 'Retired', status: 'archived' })],
    }]);
    expect(await screen.findByText(/1 activity types across 1 categories/)).toBeInTheDocument();
  });

  it('offers an archived row a way back', async () => {
    render(OWNER, [{
      ...TAXONOMY[0],
      types: [type({ status: 'archived' })],
    }]);
    await userEvent.click(await screen.findByLabelText('Show archived'));
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('sends a new type under the category it was added to', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Add to Selling' }));
    await userEvent.type(screen.getByLabelText('Code'), 'sell_referral');
    await userEvent.type(screen.getByLabelText('Label'), 'Referral masuk');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await saved(calls))[0]).toMatchObject({
      op: 'type.create',
      // Upper-cased as it is typed, so what is sent is what the person saw.
      body: { code: 'SELL_REFERRAL', categoryCode: 'SELLING', label: 'Referral masuk' },
    });
  });

  it('never offers to change a code, only a label', async () => {
    // A published code is what every activity log, ratio formula and goal target holds. It is
    // on screen while editing — and read-only, so it can be read and copied and not typed into.
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
  });

  it('shows an agent the taxonomy and none of the controls', async () => {
    // The API refuses them too — this is convenience, not control.
    render(AGENT);
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('P13.2-T6 AC-3: says plainly that a cascade type cannot be archived, without the batch’s bookkeeping', async () => {
    render();
    await screen.findByText('Submission polis');
    stubFetch({
      '/kpm/settings/activity-types': { body: TAXONOMY },
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
      },
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
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const alerts = await screen.findAllByRole('alert');
    const shown = alerts.find((a) => a.textContent?.includes('cannot be archived'))!;
    expect(shown).toHaveTextContent(/^“Submission polis” cannot be archived: the summary and the goal plan count it/);
    expect(shown.textContent).not.toContain('Change 1');
    expect(shown.textContent).not.toContain('type.archive');
  });

  it('surfaces a refusal rather than appearing to succeed', async () => {
    const { calls } = render();
    await screen.findByText('Submission polis');
    void calls;
    stubFetch({
      '/kpm/settings/activity-types': { body: TAXONOMY },
      // Kept, so the publish bar stays quiet and the alert under test is the screen's.
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
      },
      '/kpm/settings/changes': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Nothing to change.', requestId: 'r-1' } },
      },
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    // The screen's banner, not the publish bar's — two alerts can be on screen, and they
    // are about different failures.
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('Nothing to change.'))).toBe(true);
  });

  describe('sections, and who they are for (P4-T18)', () => {
    it('reads an empty applicability as Everyone, never as a blank', async () => {
      render();
      await screen.findByRole('heading', { name: 'Selling' });
      expect(screen.getByText('Everyone')).toBeInTheDocument();
    });

    it('names the rungs by their company labels, not their codes', async () => {
      render(OWNER, [{ ...TAXONOMY[0], appliesToOrgLevelCodes: ['AB', 'AAB'] }]);
      expect(await screen.findByText('AB · AAB')).toBeInTheDocument();
    });

    it('sends only the rungs when the applicability changes', async () => {
      const { calls } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Change who it applies to' }));
      await userEvent.click(screen.getByLabelText('AB'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect((await saved(calls))[0]).toMatchObject({
        op: 'category.update', id: 'c1', expectedVersion: 1,
        body: { appliesToOrgLevelCodes: ['AB'] },
      });
    });

    it('adds a section, wiring a client function that had no caller since P4-T1', async () => {
      const { calls } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add a section' }));
      await userEvent.type(screen.getByLabelText('Code'), 'referrals');
      await userEvent.type(screen.getByLabelText('Name'), 'Referrals');
      await userEvent.click(screen.getByRole('button', { name: 'Add the section' }));

      expect((await saved(calls))[0]).toMatchObject({
        op: 'category.create', body: { code: 'REFERRALS', label: 'Referrals' },
      });
    });

    it('says archiving a section takes its contents, because it does', async () => {
      render();
      const button = await screen.findByRole('button', { name: 'Archive the section' });
      expect(button).toHaveAttribute('title', expect.stringContaining('everything in it'));
    });

    it('shows a reader without write permission none of the section controls', async () => {
      // Convenience, not control — `activity.tenancy.spec.ts` proves the API refuses too.
      render(AGENT);
      await screen.findByRole('heading', { name: 'Selling' });
      expect(screen.queryByRole('button', { name: 'Add a section' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Change who it applies to' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Archive the section' })).not.toBeInTheDocument();
      // But they can still read who it is for.
      expect(screen.getByText('Everyone')).toBeInTheDocument();
    });
  });

  describe('a type’s own fields (P4-T18)', () => {
    it('offers a description on the add form, which was sent and never typed', async () => {
      const { calls } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add to Selling' }));
      await userEvent.type(screen.getByLabelText('Code'), 'SELL_REFERRAL');
      await userEvent.type(screen.getByLabelText('Label'), 'Referral masuk');
      await userEvent.type(screen.getByLabelText('Description'), 'dari nasabah lama');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect((await saved(calls))[0]).toMatchObject({
        op: 'type.create', body: { description: 'dari nasabah lama' },
      });
    });

    it('shows the code while editing, and still offers no way to change it', async () => {
      // A labelled field like the others, and read-only. Not `disabled`, which would leave
      // the tab order and take the code out of reach of a screen reader and a copy.
      render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);

      expect(screen.getByLabelText('Code')).toHaveValue('SELL_PRESENTATION');
      expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Label')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('sends the description with the label on an edit', async () => {
      const { calls } = render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
      await userEvent.type(screen.getByLabelText('Description'), 'telepon, WhatsApp');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect((await saved(calls))[0]).toMatchObject({
        op: 'type.update', id: 't0', expectedVersion: 1,
        body: { description: 'telepon, WhatsApp' },
      });
    });
  });

  describe('drag to reorder (P4-T18)', () => {
    /** `userEvent` has no drag API, so the HTML5 events go in by hand. */
    // `setDragImage` too: the handle points it at the whole row, which is what stopped the
    // drag preview being six floating dots over a list that only dimmed.
    const dataTransfer = () => ({
      effectAllowed: '', setData: vi.fn(), getData: vi.fn(), setDragImage: vi.fn(),
    });

    it('sends the whole list, spliced, when a row is dropped on another', async () => {
      const { calls } = render();
      await screen.findByText('Submission polis');

      const rows = screen.getAllByRole('listitem');
      // Drag the second type onto the first, from its handle.
      fireEvent.dragStart(handleFor('Submission polis'), { dataTransfer: dataTransfer() });
      fireEvent.dragOver(rows[0], { dataTransfer: dataTransfer() });
      fireEvent.drop(rows[0], { dataTransfer: dataTransfer() });

      const patch = calls.find((c) => c.url.includes('activity-types/reorder'))!;
      expect(JSON.parse(patch.init.body as string)).toEqual({ ids: ['t1', 't0'] });
    });

    it('the handle is the keyboard path, because drag reaches neither keyboard nor touch', async () => {
      /*
       * The two ↑↓ buttons on every row are gone — the handle does both jobs, so a row
       * carries one control instead of three. What could not go is the keyboard path
       * itself: HTML5 drag fires for a pointer only, and half of this product is used on
       * a phone.
       */
      const { calls } = render();
      await screen.findByText('Submission polis');
      const handle = handleFor('Submission polis');
      expect(handle).toHaveAccessibleName(/Press the up or down arrow/);

      fireEvent.keyDown(handle, { key: 'ArrowUp' });
      const patch = calls.find((c) => c.url.includes('activity-types/reorder'))!;
      expect(JSON.parse(patch.init.body as string)).toEqual({ ids: ['t1', 't0'] });
    });

    it('offers no handle to a reader who cannot write', async () => {
      render(AGENT);
      await screen.findByText('Submission polis');
      expect(screen.queryByText('⠿')).not.toBeInTheDocument();
    });
  });

  describe('the summary tile (P10.1-T5 AC-5, ADR-0064)', () => {
    /** Two sections: Selling in its seeded tile, and one the office added, in none. */
    const GROUPED = [
      { ...TAXONOMY[0], summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling' },
      {
        id: 'c2', code: 'REFERRALS', label: 'Referrals', description: null,
        appliesToOrgLevelCodes: [], displayOrder: 2, version: 3, status: 'active',
        summaryGroupCode: null, summaryGroupLabel: null, types: [],
      },
    ];

    /** Open a section's existing edit and hand back its Summary tile field. */
    async function tileOf(name: string) {
      const card = (await screen.findByRole('heading', { name })).closest('[data-row]') as HTMLElement;
      await userEvent.click(within(card).getByRole('button', { name: 'Rename' }));
      return within(card).getByLabelText('Summary tile');
    }

    it('AC-5: is one field in the section’s existing edit, holding the tile it counts toward', async () => {
      render(OWNER, GROUPED);
      const field = await tileOf('Selling');

      expect(field).toHaveValue('Selling');
      expect(field).toHaveAccessibleDescription(
        'Sections with the same tile are counted together. Empty gives it a tile of its own.',
      );
      // No card of its own: it sits in the row with Name and Description.
      expect(field.closest('.flex-wrap')).toContainElement(screen.getByLabelText('Name'));
    });

    it('AC-5: reads empty for a section with a tile of its own', async () => {
      render(OWNER, GROUPED);
      expect(await tileOf('Referrals')).toHaveValue('');
    });

    it('AC-5: offers the tiles the office already has', async () => {
      render(OWNER, [...GROUPED, {
        ...GROUPED[1], id: 'c3', code: 'OLD', label: 'Old', status: 'archived',
        summaryGroupCode: 'LEGACY', summaryGroupLabel: 'Legacy',
      }]);
      const field = await tileOf('Referrals');

      const list = document.getElementById(field.getAttribute('list')!)!;
      // An archived section's tile is still a tile: it renders history, and the server compares it.
      expect([...list.querySelectorAll('option')].map((o) => o.value)).toEqual(['Selling', 'Legacy']);
    });

    it('AC-5: the write carries both fields, joining a tile by its name', async () => {
      const { calls } = render(OWNER, GROUPED);
      const field = await tileOf('Referrals');
      await userEvent.type(field, 'selling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect((await saved(calls))[0]).toMatchObject({
        op: 'category.update', id: 'c2', expectedVersion: 3,
        body: { label: 'Referrals', summaryGroupCode: 'SELLING', summaryGroupLabel: 'Selling' },
      });
    });

    it('AC-5 (OD-101): typing another section’s name stages both, in one tile under that name', async () => {
      // Selling has a tile of its own here: counting Referrals with it moves both into a new shared
      // tile named *Selling* — never a second *Selling* tile beside the first.
      const LONE = [{ ...GROUPED[0], summaryGroupCode: null, summaryGroupLabel: null }, GROUPED[1]];
      const { calls } = render(OWNER, LONE);
      await userEvent.type(await tileOf('Referrals'), 'selling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      const ops = await saved(calls);
      expect(ops).toHaveLength(2);
      const tiles = ops.map((op) => [op.id, (op.body as Record<string, unknown>).summaryGroupCode, (op.body as Record<string, unknown>).summaryGroupLabel]);
      expect(tiles).toEqual(expect.arrayContaining([
        ['c2', expect.any(String), 'Selling'],
        [GROUPED[0].id, expect.any(String), 'Selling'],
      ]));
      expect(tiles[0][1]).toBe(tiles[1][1]);
    });

    it('AC-5 (OD-101): refuses another name for a tile the section has to itself, at the field', async () => {
      const LONE = [{ ...GROUPED[0], summaryGroupCode: null, summaryGroupLabel: null }, GROUPED[1]];
      const { calls } = render(OWNER, LONE);
      const field = await tileOf('Selling');
      await userEvent.type(field, 'Penjualan');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(field).toHaveAccessibleDescription(expect.stringContaining('A section with a tile of its own shows its own name.'));
      expect(screen.queryByText(/change(s)? not saved yet/)).toBeNull();
      expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
    });

    it('AC-5: an emptied field writes both as null — a tile of its own', async () => {
      const { calls } = render(OWNER, GROUPED);
      await userEvent.clear(await tileOf('Selling'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      const [op] = await saved(calls);
      expect(op.body).toMatchObject({ summaryGroupCode: null, summaryGroupLabel: null });
      expect(Object.keys(op.body as object)).toEqual(
        expect.arrayContaining(['summaryGroupCode', 'summaryGroupLabel']),
      );
    });

    it('AC-5: shows a staged regrouping as an edit before anything is saved', async () => {
      render(OWNER, GROUPED);
      await userEvent.type(await tileOf('Referrals'), 'Selling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      const card = screen.getByRole('heading', { name: 'Referrals' }).closest('[data-row]') as HTMLElement;
      expect(within(card).getByText('Edited — not saved yet')).toBeInTheDocument();
    });

    it('AC-4: a group whose sections disagree on its label is refused, in the screen’s own banner', async () => {
      render(OWNER, GROUPED);
      await screen.findByRole('heading', { name: 'Selling' });
      stubFetch({
        '/kpm/settings/activity-types': { body: GROUPED },
        '/kpm/settings/publish-state': {
          body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
        },
        '/kpm/settings/changes': {
          status: 422,
          body: {
            error: {
              code: 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH',
              message: 'The sections in summary tile SELLING must share one label.',
              requestId: 'r-9',
              details: { summaryGroupCode: 'SELLING', labels: ['Selling', 'Sales'] },
            },
          },
        },
      });
      await userEvent.type(await tileOf('Referrals'), 'Selling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      const alerts = await screen.findAllByRole('alert');
      // In the reader's words, from the refusal's own details — not the server's sentence, whose op
      // prefix and upper-case tile code the screen never shows.
      const banner = alerts.find((a) => a.textContent?.includes('One summary tile, two names'));
      expect(banner).toHaveTextContent('One summary tile, two names: “Selling” and “Sales”. Give every section in it the same tile name.');
      expect(banner).not.toHaveTextContent('must share one label');
      expect(banner).toHaveTextContent('CONFIG_SUMMARY_GROUP_LABEL_MISMATCH · r-9');
      // Refused, so still held: nothing was written, and the edit can be corrected or undone.
      expect(screen.getByText(/1 change not saved yet/)).toBeInTheDocument();
    });

    it('a new section under a shared tile’s code is refused in the banner, naming the code (P10.1-T6)', async () => {
      render(OWNER, GROUPED);
      await screen.findByRole('heading', { name: 'Selling' });
      stubFetch({
        '/kpm/settings/activity-types': { body: GROUPED },
        '/kpm/settings/publish-state': {
          body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
        },
        '/kpm/settings/changes': {
          status: 422,
          body: {
            error: {
              code: 'CONFIG_SUMMARY_GROUP_CODE_TAKEN',
              message: 'Change 1 (category.create): SELLING is the code of the summary tile “Selling” …',
              requestId: 'r-10',
              details: { summaryGroupCode: 'SELLING', label: 'Selling' },
            },
          },
        },
      });
      await userEvent.click(screen.getByRole('button', { name: 'Add a section' }));
      await userEvent.type(screen.getByLabelText('Code'), 'selling');
      await userEvent.type(screen.getByLabelText('Name'), 'Selling again');
      await userEvent.click(screen.getByRole('button', { name: 'Add the section' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      const banner = (await screen.findAllByRole('alert')).find((a) => a.textContent?.includes('already the code'));
      expect(banner).toHaveTextContent('SELLING is already the code of the summary tile “Selling”. Give the section another code.');
      expect(banner).not.toHaveTextContent('Change 1');
      expect(screen.getByText(/1 change not saved yet/)).toBeInTheDocument();
    });

    it('AC-5: offers a reader without write permission no field at all', async () => {
      render(AGENT, GROUPED);
      await screen.findByRole('heading', { name: 'Selling' });

      expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
      expect(screen.queryByLabelText('Summary tile')).toBeNull();
    });
  });

  describe('staged edits (P4-T19)', () => {
    it('holds everything until Save changes, and says how much is held', async () => {
      const { calls } = render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
      await userEvent.click(await screen.findByRole('button', { name: 'Add a section' }));
      await userEvent.type(screen.getByLabelText('Code'), 'REFERRALS');
      await userEvent.type(screen.getByLabelText('Name'), 'Referrals');
      await userEvent.click(screen.getByRole('button', { name: 'Add the section' }));

      expect(screen.getByText(/2 changes not saved yet/)).toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/kpm/settings/changes'))).toBe(false);

      expect(await saved(calls)).toHaveLength(2);
    });

    it('says saving is not publishing, because they are different places', async () => {
      render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
      expect(screen.getByText(/publishing to agents is a separate step/)).toBeInTheDocument();
    });

    it('discards without sending', async () => {
      const { calls } = render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
      await userEvent.click(screen.getByRole('button', { name: 'Discard them' }));

      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/kpm/settings/changes'))).toBe(false);
    });

    it('reorders immediately, because a drag that did nothing visible would be worse', async () => {
      // It bumps no version and reaches nobody until publish, so holding it behind Save
      // would mean pressing ↑ and watching the row stay put.
      const { calls } = render();
      await screen.findByText('Submission polis');
    fireEvent.keyDown(handleFor('Submission polis'), { key: 'ArrowUp' });

      expect(calls.some((c) => c.url.includes('activity-types/reorder'))).toBe(true);
      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
    });
  });

  describe('the number beside a row (client feedback, 2026-09-24)', () => {
    /*
     * The badge painted `displayOrder`, which keeps counting through archived rows — so an
     * office that archived item 3 saw `1 2 4 5`. A number with a hole in it reads as a row
     * that failed to load rather than as one that was retired.
     */
    const numbers = () =>
      Array.from(document.querySelectorAll('li span[aria-hidden]'))
        .map((el) => el.textContent?.trim() ?? '')
        .filter((text) => /^\d+$/.test(text));

    it('counts the live rows and leaves no hole where an archived one was', async () => {
      render(OWNER, [{
        ...TAXONOMY[0],
        types: [
          type({ id: 't0', code: 'A', label: 'First', displayOrder: 1 }),
          type({ id: 't1', code: 'B', label: 'Second, retired', displayOrder: 2, status: 'archived' }),
          type({ id: 't2', code: 'C', label: 'Third', displayOrder: 3 }),
        ],
      }]);
      await screen.findByText('First');

      // Two live rows, numbered 1 and 2 — not 1 and 3.
      expect(numbers()).toEqual(['1', '2']);
    });

    it('gives an archived row no number at all, even when it is on screen', async () => {
      // Numbering it would put the gap back the moment archived rows were shown.
      render(OWNER, [{
        ...TAXONOMY[0],
        types: [
          type({ id: 't0', code: 'A', label: 'First', displayOrder: 1 }),
          type({ id: 't1', code: 'B', label: 'Second, retired', displayOrder: 2, status: 'archived' }),
          type({ id: 't2', code: 'C', label: 'Third', displayOrder: 3 }),
        ],
      }]);
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));

      expect(screen.getByText('Second, retired')).toBeInTheDocument();
      expect(numbers()).toEqual(['1', '2']);
    });

    it('runs the count through every section, as the prototype\u2019s 1\u201312 does', async () => {
      render(OWNER, [
        {
          ...TAXONOMY[0],
          types: [type({ id: 't0', code: 'A', label: 'First', displayOrder: 1 })],
        },
        {
          id: 'c2', code: 'RECRUITMENT', label: 'Recruitment', description: null,
          appliesToOrgLevelCodes: [], displayOrder: 2, version: 1, status: 'active',
          types: [type({ id: 't1', code: 'B', label: 'Second', displayOrder: 1 })],
        },
      ]);
      await screen.findByText('Second');

      // The second section's first row is 2, not 1: the badge is the office's, not the
      // section's.
      expect(numbers()).toEqual(['1', '2']);
    });
  });

  /*
   * P18.9-T2 AC-3 (ADR-0163): the Owner and the Admin read the office's activity binding here, read-only — the
   * role a bound type counts as, beside its name. The Super Admin keeps it.
   */
  describe('the activity binding, read-only (P18.9-T2)', () => {
    const READER = makeMe({ ...OWNER, permissions: [...OWNER.permissions, 'activity_binding:read'] });

    it('P18.9-T2 AC-3 marks each bound type with the role it counts as, and nothing else', async () => {
      const stub = stubFetch({
        '/kpm/settings/activity-types': { body: TAXONOMY },
        '/kpm/settings/activity-binding': {
          body: {
            leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'],
            version: 1, updatedAt: null,
          },
        },
        '/kpm/config': { body: { activity: TAXONOMY, ratios: [], leadPipelines: [], version: 1 } },
        '/kpm/org-levels': { body: LADDER },
      });
      renderWithSession(<TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>, { me: READER });

      // *Counts as:* since P18.97-T4 AC-1 (UI-022): the chip read the bare stage, and ran into the name.
      const meeting = await screen.findByText('Counts as: Sales meeting');
      expect(meeting).toHaveAttribute('title', expect.stringContaining('count this as Sales meeting'));
      expect(meeting.closest('p')).toHaveTextContent('Presentasi penjualanCounts as: Sales meeting');
      // The type's own name is Submission polis here: its name once, and the stage it counts as on the chip.
      expect(screen.getByText('Submission polis')).toBeInTheDocument();
      expect(screen.getByText('Counts as: Submission polis')).toBeInTheDocument();
      expect(stub.calls.some((c) => c.url.includes('/kpm/settings/activity-binding'))).toBe(true);
    });

    it('P18.9-T2 AC-3 asks nothing of a reader without the permission', async () => {
      const { calls } = render(AGENT);
      await screen.findByText('Submission polis');
      expect(calls.some((c) => c.url.includes('/kpm/settings/activity-binding'))).toBe(false);
      expect(screen.queryByText(/Sales meeting/)).not.toBeInTheDocument();
    });
  });
});

/**
 * **Below 1024px a section's actions sit behind one ⋮** (P18.97-T6 AC-3, ADR-0178 §2; the client's KPM Owner review of
 * 2026-10-27, UI-037: *Rename*, *Change who it applies to* and *Archive the section* wrapped to two rows on a phone and
 * three on a tablet). One `ActionMenu` per section, at the end of its *Applies to* line, with the menu's keys and words;
 * each item does what its link does. From 1024px the line is the three links it was, to the byte.
 */
describe('P18.97-T6 AC-3 below 1024px a section’s actions sit behind one ⋮', () => {
  afterEach(() => vi.unstubAllGlobals());

  const INLINE = ['Rename', 'Change who it applies to', 'Archive the section'];
  /** Selling, live; Recruiting, archived, for *Restore the section* in Archive's place. */
  const SECTIONS = [
    TAXONOMY[0],
    {
      id: 'c2', code: 'RECRUITING', label: 'Recruiting', description: null, appliesToOrgLevelCodes: ['AB'],
      displayOrder: 2, version: 3, status: 'archived', types: [],
    },
  ];
  /** A section's line under its heading: *Applies to*, and its actions. */
  const actionsLine = (id: string) => Array.from(document.querySelector(`[data-row="${id}"]`)!.children)
    .find((el) => el.textContent?.includes('Applies to')) as HTMLElement;
  const digest = (el: Element) => createHash('sha256').update(el.outerHTML).digest('hex');
  /**
   * The line's markup on the build before P18.97-T6 (frontend `68d8d61`), rendered from this fixture on 2026-10-28:
   * the live section's three links, and the archived one's with *Restore the section*.
   */
  const BEFORE_T6 = {
    c1: '72e4199fc88769cde57eb6b63dbbf33d2c3400a34f803df65934a9be6e649f20',
    c2: '140887d62384d30f766891d1fae5de72ff26809957da5c33fe751d90c4497936',
  };
  async function choose(section: string, item: string) {
    await userEvent.click(await screen.findByRole('button', { name: `Actions for ${section}` }));
    await userEvent.click(within(screen.getByRole('menu', { name: `Actions for ${section}` })).getByRole('menuitem', { name: item }));
  }

  it.each([767, 768, 1023])('P18.97-T6 AC-3 at %ipx draws one ⋮ per section, on its Applies to line, and none of the three links', async (px) => {
    atWidth(px);
    render(OWNER, SECTIONS);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));
    for (const [id, name] of [['c1', 'Selling'], ['c2', 'Recruiting']]) {
      const menu = within(actionsLine(id)).getByRole('button', { name: `Actions for ${name}` });
      expect(menu).toHaveAttribute('aria-haspopup', 'menu');
      expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(within(actionsLine(id)).getByText('Applies to')).toBeInTheDocument();
    }
    for (const name of [...INLINE, 'Restore the section']) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('P18.97-T6 AC-3 opens on its first item, in the links’ order and words, and Archive still says what it takes', async () => {
    atWidth(1023);
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Selling' }));
    const menu = within(screen.getByRole('menu', { name: 'Actions for Selling' }));
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(INLINE);
    expect(menu.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    expect(menu.getByRole('menuitem', { name: 'Archive the section' }))
      .toHaveAttribute('title', 'Archives the section and everything in it.');
  });

  it('P18.97-T6 AC-3 keeps the menu’s keys: Enter opens it, ↑ ↓ go round, Escape gives the focus back to ⋮', async () => {
    atWidth(768);
    render();
    const button = await screen.findByRole('button', { name: 'Actions for Selling' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    const menu = within(screen.getByRole('menu', { name: 'Actions for Selling' }));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(menu.getByRole('menuitem', { name: 'Change who it applies to' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(menu.getByRole('menuitem', { name: 'Archive the section' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('P18.97-T6 AC-3 Rename opens the section’s edit, as its link does', async () => {
    atWidth(768);
    render();
    await choose('Selling', 'Rename');
    expect(screen.getByLabelText('Name')).toHaveValue('Selling');
    expect(screen.getByLabelText('Summary tile')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Selling' })).toBeNull();
  });

  it('P18.97-T6 AC-3 Change who it applies to opens the rungs, and saves only them, as its link does', async () => {
    atWidth(1023);
    const { calls } = render();
    await choose('Selling', 'Change who it applies to');
    await userEvent.click(screen.getByLabelText('AB'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await saved(calls))[0]).toMatchObject({
      op: 'category.update', id: 'c1', expectedVersion: 1, body: { appliesToOrgLevelCodes: ['AB'] },
    });
  });

  it('P18.97-T6 AC-3 Archive the section stages the archive, as its link does', async () => {
    atWidth(767);
    const { calls } = render();
    await choose('Selling', 'Archive the section');
    expect((await saved(calls))[0]).toMatchObject({ op: 'category.archive', id: 'c1', expectedVersion: 1 });
  });

  it('P18.97-T6 AC-3 an archived section’s ⋮ offers Restore the section in Archive’s place', async () => {
    atWidth(900);
    const { calls } = render(OWNER, SECTIONS);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Recruiting' }));
    expect(within(screen.getByRole('menu', { name: 'Actions for Recruiting' })).getAllByRole('menuitem')
      .map((item) => item.textContent)).toEqual(['Rename', 'Change who it applies to', 'Restore the section']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore the section' }));
    expect((await saved(calls))[0]).toMatchObject({ op: 'category.restore', id: 'c2', expectedVersion: 3 });
  });

  it('P18.97-T6 AC-3 offers a reader who cannot write no ⋮, below 1024px as from it', async () => {
    atWidth(768);
    render(AGENT);
    await screen.findByRole('heading', { name: 'Selling' });
    expect(screen.queryByRole('button', { name: 'Actions for Selling' })).toBeNull();
    expect(screen.getByText('Everyone')).toBeInTheDocument();
  });

  it.each([1024, 1280])('P18.97-T6 AC-3 at %ipx the line is the three links it was, to the byte, and no ⋮', async (px) => {
    atWidth(px);
    render(OWNER, SECTIONS);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));
    await screen.findByRole('heading', { name: 'Recruiting' });
    expect(digest(actionsLine('c1'))).toBe(BEFORE_T6.c1);
    expect(digest(actionsLine('c2'))).toBe(BEFORE_T6.c2);
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
    for (const name of INLINE) expect(within(actionsLine('c1')).getByRole('button', { name })).toBeInTheDocument();
  });
});

/**
 * **A bound type's chip: *Counts as: {stage}*** (P18.97-T4 AC-1, ADR-0176 §3; the client's KPM Owner review of
 * 2026-10-27, UI-022: *"Set Appointment Set appointment"*, *"… existing nasabah Sales meeting"*). The chip is the stage
 * the office's activity binding counts the type as (ADR-0163 §3), not a name of the type, so it says so, on the quiet
 * chip of its own, apart from the name — the lead's reading, not the plan's *Short name*. The tooltip is unchanged.
 */
describe('P18.97-T4 AC-1 a bound type’s chip says the stage it counts as', () => {
  afterEach(() => vi.unstubAllGlobals());

  const READER = makeMe({ ...OWNER, permissions: [...OWNER.permissions, 'activity_binding:read'] });
  const SET_APPOINTMENT = TAXONOMY.map((c) => ({
    ...c,
    types: [...c.types, type({ id: 't9', code: 'LEADS_CONTACTED', label: 'Set Appointment', displayOrder: 3 })],
  }));

  function renderBound(body: unknown = SET_APPOINTMENT) {
    stubFetch({
      '/kpm/settings/activity-types': { body },
      '/kpm/settings/activity-binding': {
        body: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'], version: 1, updatedAt: null },
      },
      '/kpm/settings/publish-state': { body: { unpublished: 0, version: 1 } },
      '/kpm/config': { body: { activity: body, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: LADDER },
    });
    renderWithSession(<TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>, { me: READER });
  }

  it('P18.97-T4 AC-1 reads Counts as: {stage} for each of the three, and the name stays the name', async () => {
    renderBound();
    for (const [name, stage] of [
      ['Set Appointment', 'Set appointment'], ['Presentasi penjualan', 'Sales meeting'], ['Submission polis', 'Submission polis'],
    ]) {
      const chip = await screen.findByText(`Counts as: ${stage}`);
      // Its own element after the name, never run into it: the name's text is the name alone.
      const line = chip.closest('p')!;
      expect(line.firstChild!.textContent).toBe(name);
      expect(line).toHaveTextContent(`${name}Counts as: ${stage}`);
    }
  });

  it('P18.97-T4 AC-1 draws the chip as the prototype’s quiet activity chip, in sentence case, set apart by its own ground', async () => {
    renderBound();
    const chip = (await screen.findByText('Counts as: Sales meeting')).parentElement!;
    expect(chip).toHaveAttribute('data-tone', 'navy');
    expect(chip).toHaveClass('ml-2', 'normal-case', 'whitespace-nowrap');
    expect(chip).not.toHaveClass('uppercase');
  });

  it('P18.97-T4 AC-1 keeps the tooltip as it was, naming the stage and who changes it', async () => {
    renderBound();
    expect(await screen.findByText('Counts as: Set appointment')).toHaveAttribute(
      'title', 'The summary and the goal plan count this as Set appointment. A Super Admin changes which activities count.',
    );
  });

  it('P18.97-T4 AC-1 never calls the chip a short name, and an unbound type wears none', async () => {
    renderBound();
    await screen.findByText('Counts as: Sales meeting');
    expect(screen.queryByText(/Short name/)).toBeNull();
    expect(screen.getAllByText(/^Counts as: /)).toHaveLength(3);
  });
});

/**
 * **Opening a section's editor moves the focus into it, and closing it gives the focus back** (WCAG 2.4.3; P18.97-T4,
 * parity F-255). *Rename* and *Change who it applies to* replace their line with an editor — the inline links from
 * 1024px, the ⋮'s items below it (P18.97-T6 AC-3) — so the control chosen is gone the moment it is chosen. The focus
 * lands on the editor's first field, and Save or Cancel returns it to the link, or to the section's ⋮. The line's
 * markup from 1024px is the one T6 pinned (its digests above still pass).
 */
describe('P18.97-T4 F-255 a section’s editor takes the focus and gives it back', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function choose(section: string, item: string) {
    await userEvent.click(await screen.findByRole('button', { name: `Actions for ${section}` }));
    await userEvent.click(within(screen.getByRole('menu', { name: `Actions for ${section}` })).getByRole('menuitem', { name: item }));
  }

  it.each([1024, 1280])('P18.97-T4 F-255 at %ipx Rename moves the focus to Name, and Cancel back to Rename', async (px) => {
    atWidth(px);
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();
  });

  it('P18.97-T4 F-255 at 1280px Change who it applies to moves the focus to the first rung, and Save back to the link', async () => {
    atWidth(1280);
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Change who it applies to' }));
    expect(screen.getByLabelText('Agent')).toHaveFocus();
    await userEvent.click(screen.getByLabelText('AB'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Change who it applies to' })).toHaveFocus();
  });

  it('P18.97-T4 F-255 a rename refused at its field keeps the focus in the editor', async () => {
    atWidth(1280);
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    await userEvent.clear(screen.getByLabelText('Name'));
    // Save is held without a name; the editor stays, and so does the focus, on the field.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it.each([767, 768, 1023])('P18.97-T4 F-255 at %ipx Rename from ⋮ moves the focus to Name, and Cancel back to ⋮', async (px) => {
    atWidth(px);
    render();
    await choose('Selling', 'Rename');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Actions for Selling' })).toHaveFocus();
  });

  it('P18.97-T4 F-255 at 768px Change who it applies to from ⋮ moves the focus to the first rung, and Cancel back to ⋮', async () => {
    atWidth(768);
    render();
    await choose('Selling', 'Change who it applies to');
    expect(screen.getByLabelText('Agent')).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    expect(screen.getByLabelText('AAB')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Actions for Selling' })).toHaveFocus();
  });

  it('P18.97-T4 F-255 at 1023px a renamed section’s ⋮ takes the focus back under its new name', async () => {
    atWidth(1023);
    render();
    await choose('Selling', 'Rename');
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Sales');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Actions for Sales' })).toHaveFocus();
  });
});
