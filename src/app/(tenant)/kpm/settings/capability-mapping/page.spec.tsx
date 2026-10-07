import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import CapabilityMappingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/capability-mapping',
}));

const member = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership: member, permissions: ['tenant_config:read', 'tenant_config:write'] });
const READER = makeMe({ membership: member, permissions: ['tenant_config:read'] });

const entry = (code: string, label: string, over: Record<string, unknown> = {}) => ({
  code, label, displayOrder: 1, status: 'active', ...over,
});

const catalog = (over: Record<string, unknown> = {}) => ({
  stages: [
    { ...entry('COMPETENT_PRODUCER', 'Competent Producer'), requiredMilestoneCodes: ['SELLS_INDEPENDENTLY'], stageOrder: 1 },
    { ...entry('INDEPENDENT_PRODUCER', 'Independent Producer', { displayOrder: 2 }), requiredMilestoneCodes: ['SELLS_INDEPENDENTLY', 'SELLS_OUTSIDE_NETWORK'], stageOrder: 2 },
  ],
  milestones: [
    entry('SELLS_INDEPENDENTLY', 'Sells policies independently'),
    entry('SELLS_OUTSIDE_NETWORK', 'Sells outside direct network', { displayOrder: 2 }),
  ],
  grids: [
    {
      ...entry('PERSONAL_SELLING', 'Personal selling'),
      requiresDownline: false,
      items: [entry('APPROACH', 'Approach & appointment setting')],
    },
    {
      ...entry('DEVELOPING_DOWNLINE_AGENT', 'Developing downline agent', { displayOrder: 2 }),
      requiresDownline: true,
      items: [entry('AGENT_VISIBILITY', "Visibility into each agent's progress & goals")],
    },
  ],
  version: 1,
  ...over,
});

/**
 * `tab` names which half to open (client feedback, 2026-09-24).
 *
 * The screen is two subtabs now, the same two the Company template has: **Ladder** is what a
 * stage *is*, **Skills** is what somebody is assessed *against*. Most of these tests act on a
 * grid item, so they open `#skills`.
 */
function render(body: unknown = catalog(), me = OWNER, tab: '#ladder' | '#skills' = '#skills') {
  window.location.hash = tab;
  const stub = stubFetch({
    '/kpm/settings/capability-mapping': { body },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  });
  renderWithSession(<CapabilityMappingPage />, { me });
  return stub;
}

/**
 * The office's capability catalog (P5-T8, ADR-0025).
 *
 * What this screen has to make visible is the fix itself: **every row has a code, and renaming does
 * not touch it.** Two of the prototype's four grids have no codes at all, so a tick there is bound
 * to the label and correcting a typo orphans every assessment that used it.
 */
describe('the capability catalog screen', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });

  it('P13.2-T6 AC-8: an empty catalog says so on both halves, and offers the first milestone', async () => {
    // An office started Empty (ADR-0115 §1): an empty catalog, never the platform's ladder.
    const empty = { stages: [], milestones: [], grids: [], version: 1 };
    render(empty, OWNER, '#ladder');
    expect(await screen.findByText('No stages yet.')).toBeInTheDocument();
    expect(screen.getByText('No milestones yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Four stages/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a milestone' })).toBeEnabled();
    vi.unstubAllGlobals();

    render(empty, OWNER, '#skills');
    expect(await screen.findAllByText('No skill grids yet.')).not.toHaveLength(0);
  });

  it('is called Capability Mapping, with the template’s own two halves', async () => {
    // One name on both sides: an office had to learn that its *Skills & stages* was the Super
    // Admin's *Capability Mapping*, which is a thing nobody should have to be told.
    render(catalog(), OWNER, '#ladder');

    expect(await screen.findByRole('heading', { name: 'Capability Mapping', level: 1 }))
      .toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Capability Mapping sections' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent))
      .toEqual(['Ladder', 'Skills']);
  });

  it('keeps the ladder and the grids on their own halves', async () => {
    render(catalog(), OWNER, '#ladder');

    expect(await screen.findByRole('heading', { name: 'The ladder' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
    expect(screen.queryByText('Approach & appointment setting')).toBeNull();
  });

  it('gives every row a code, shown where a reader is acting on it', async () => {
    /*
     * **The claim is that every row *has* a stable code, not that every row paints one.** Two of
     * the prototype's four grids have no ids at all, so a tick there binds to the label and
     * correcting a typo orphans every assessment that used it — that defect is what the codes
     * fix, and it is fixed whether or not the list shows them.
     *
     * The client asked for the lists to stop showing them, so this asserts what is now true:
     * clean rows, and the code on the panel where renaming happens — which is the one moment a
     * reader needs to see that the identity is not what they are editing.
     */
    render();
    await screen.findByText('Approach & appointment setting');

    expect(screen.queryByText('APPROACH')).not.toBeInTheDocument();
    expect(screen.queryByText('SELLS_INDEPENDENTLY')).not.toBeInTheDocument();

    const row = screen.getByText('Approach & appointment setting').closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Rename' }));
    expect(screen.getByText(/Code APPROACH/)).toBeInTheDocument();
  });

  it('renames a row and never sends anything that could move its code', async () => {
    const stub = render();
    const row = (await screen.findByText('Approach & appointment setting')).closest('li')!;

    await userEvent.click(within(row).getByRole('button', { name: 'Rename' }));
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Approaching and booking');
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/label'))).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.url.includes('/label'))!.init.body));
    // The code goes along to *find* the row; the label is the only thing that changes.
    expect(sent).toEqual({
      part: 'item', code: 'APPROACH', label: 'Approaching and booking',
      gridCode: 'PERSONAL_SELLING',
    });
  });

  it('archives rather than deletes, and says what archiving keeps', async () => {
    const stub = render();
    const row = (await screen.findByText('Approach & appointment setting')).closest('li')!;

    const archive = within(row).getByRole('button', { name: 'Archive' });
    expect(archive).toHaveAttribute('title', expect.stringContaining('already tick it'));
    expect(within(row).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

    await userEvent.click(archive);
    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/status'))).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.url.includes('/status'))!.init.body)))
      .toMatchObject({ status: 'archived' });
  });

  it('says reordering the ladder moves nobody’s stage', async () => {
    // The prototype computes the stage from the array index, so tidying it moves everybody.
    render(catalog(), OWNER, '#ladder');

    expect(await screen.findByText(/reordering these changes where they sit on the page/))
      .toBeInTheDocument();
  });

  it('reorders by sending every code once, in the new order', async () => {
    const stub = render(catalog(), OWNER, '#ladder');
    await screen.findByText('Competent Producer');

    const row = screen.getByText('Competent Producer').closest('li')!;
    within(row).getByRole('button', { name: /^Reorder Competent Producer\./ }).focus();
    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/order'))).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.url.includes('/order'))!.init.body)))
      .toEqual({ part: 'stage', codes: ['INDEPENDENT_PRODUCER', 'COMPETENT_PRODUCER'] });
  });

  it('fills a new item’s code in from its name', async () => {
    render();
    await screen.findByText('Personal selling');

    const card = screen.getByText('Personal selling').closest('div')!.parentElement!;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an item' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Asking for referrals');

    expect(screen.getByLabelText('Code')).toHaveValue('ASKING_FOR_REFERRALS');
  });

  it('marks the grids that only apply to somebody with a downline', async () => {
    render();

    expect(await screen.findByText('Only for somebody with a downline')).toBeInTheDocument();
  });

  it('hides archived rows until asked', async () => {
    render(catalog({
      milestones: [entry('SELLS_INDEPENDENTLY', 'Sells policies independently', { status: 'archived' })],
    }), OWNER, '#ladder');
    await screen.findByRole('checkbox', { name: 'Show archived' });

    expect(screen.queryByText('Sells policies independently')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(await screen.findByText('Sells policies independently')).toBeInTheDocument();
  });

  it('shows a reader who cannot write the catalog without a control to change it', async () => {
    render(catalog(), READER);
    await screen.findByText('Approach & appointment setting');

    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a milestone' })).not.toBeInTheDocument();
  });

  it('says what the server refused, and keeps the row open to fix it', async () => {
    stubFetch({
      '/kpm/settings/capability-mapping/items': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'APPROACH is already used in this catalog.',
            requestId: 'r-1',
          },
        },
      },
      '/kpm/settings/capability-mapping': { body: catalog() },
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
      },
    });
    window.location.hash = '#skills';
    renderWithSession(<CapabilityMappingPage />, { me: OWNER });
    await screen.findByText('Personal selling');

    const card = screen.getByText('Personal selling').closest('div')!.parentElement!;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an item' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Approach');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already used in this catalog/);
    expect(screen.getByLabelText('Name')).toHaveValue('Approach');
  });
});
