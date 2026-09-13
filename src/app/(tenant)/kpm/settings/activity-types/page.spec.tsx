import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
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

describe('the office activity taxonomy (P4-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('groups the types into the cards the prototype draws', async () => {
    render();
    const heading = await screen.findByRole('heading', { name: 'Selling' });
    const card = heading.closest('div')!.parentElement!;
    expect(within(card).getByText(/2 items/)).toBeInTheDocument();
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
  });

  it('shows the code beside every row, because it is the part that does not move', async () => {
    /*
     * The prototype numbers its items 1–12 and binds its ratio formulas to those numbers.
     * Here the number is position and the code is identity — so the code is on screen,
     * next to the number that is about to change when somebody reorders.
     */
    render();
    expect(await screen.findByText('SELL_SUBMISSION')).toBeInTheDocument();
    expect(screen.getByText('SELLING')).toBeInTheDocument();
  });

  it('sends every id in the new order when one row moves', async () => {
    // Not a single move: two people dragging at once would otherwise interleave into an
    // order neither asked for.
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Submission polis up' }));

    const call = calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({ ids: ['t1', 't0'] });
  });

  it('cannot move the first row up or the last row down', async () => {
    render();
    await screen.findByText('Submission polis');
    expect(screen.getByRole('button', { name: 'Move Presentasi penjualan up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Submission polis down' })).toBeDisabled();
  });

  it('archives rather than deletes, and says so on the control', async () => {
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    const call = calls.find((c) => c.init.method === 'DELETE')!;
    expect(call.url).toContain('/kpm/settings/activity-types/t0');
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

    const call = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(call.init.body as string)).toMatchObject({
      // Upper-cased as it is typed, so what is sent is what the person saw.
      code: 'SELL_REFERRAL', categoryCode: 'SELLING', label: 'Referral masuk',
    });
  });

  it('never offers to change a code, only a label', async () => {
    // A published code is what every activity log, ratio formula and goal target holds.
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('shows an agent the taxonomy and none of the controls', async () => {
    // The API refuses them too — this is convenience, not control.
    render(AGENT);
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('surfaces a refusal rather than appearing to succeed', async () => {
    const { calls } = render();
    await screen.findByText('Submission polis');
    void calls;
    stubFetch({
      '/kpm/settings/activity-types': { body: TAXONOMY },
      '/kpm/settings/activity-types/t0': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Nothing to change.', requestId: 'r-1' } },
      },
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing to change.');
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

      const patch = calls.find((c) => c.init.method === 'PATCH')!;
      expect(JSON.parse(patch.init.body as string)).toEqual({ appliesToOrgLevelCodes: ['AB'] });
    });

    it('adds a section, wiring a client function that had no caller since P4-T1', async () => {
      const { calls } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add a section' }));
      await userEvent.type(screen.getByLabelText('Code'), 'referrals');
      await userEvent.type(screen.getByLabelText('Name'), 'Referrals');
      await userEvent.click(screen.getByRole('button', { name: 'Add the section' }));

      const post = calls.find((c) => c.url.includes('activity-categories') && c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toMatchObject({
        code: 'REFERRALS', label: 'Referrals',
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

      const post = calls.find((c) => c.url.includes('activity-types') && c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toMatchObject({
        description: 'dari nasabah lama',
      });
    });

    it('shows the code while editing, and still offers no way to change it', async () => {
      /*
       * `ReadOnlyField` is a `<dl>`, not a labelled control — which is why the assertion
       * below still holds. A disabled input would read as "not right now"; this is never.
       */
      render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);

      expect(screen.getByText('SELL_PRESENTATION')).toBeInTheDocument();
      expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Label')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('sends the description with the label on an edit', async () => {
      const { calls } = render();
      await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
      await userEvent.type(screen.getByLabelText('Description'), 'telepon, WhatsApp');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      const patch = calls.find((c) => c.init.method === 'PATCH')!;
      expect(JSON.parse(patch.init.body as string)).toMatchObject({
        description: 'telepon, WhatsApp',
      });
    });
  });

  describe('drag to reorder (P4-T18)', () => {
    /** `userEvent` has no drag API, so the HTML5 events go in by hand. */
    const dataTransfer = () => ({ effectAllowed: '', setData: vi.fn(), getData: vi.fn() });

    it('sends the whole list, spliced, when a row is dropped on another', async () => {
      const { calls } = render();
      await screen.findByText('Submission polis');

      const handles = screen.getAllByText('⠿');
      const rows = screen.getAllByRole('listitem');
      // Drag the second type onto the first.
      fireEvent.dragStart(handles[handles.length - 1], { dataTransfer: dataTransfer() });
      fireEvent.dragOver(rows[0], { dataTransfer: dataTransfer() });
      fireEvent.drop(rows[0], { dataTransfer: dataTransfer() });

      const patch = calls.find((c) => c.url.includes('activity-types/reorder'))!;
      expect(JSON.parse(patch.init.body as string)).toEqual({ ids: ['t1', 't0'] });
    });

    it('keeps the ↑↓ buttons, because native drag reaches neither keyboard nor touch', async () => {
      render();
      await screen.findByText('Submission polis');
      expect(screen.getByRole('button', { name: 'Move Submission polis up' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Move Presentasi penjualan down' })).toBeInTheDocument();
    });

    it('offers no handle to a reader who cannot write', async () => {
      render(AGENT);
      await screen.findByText('Submission polis');
      expect(screen.queryByText('⠿')).not.toBeInTheDocument();
    });
  });
});
