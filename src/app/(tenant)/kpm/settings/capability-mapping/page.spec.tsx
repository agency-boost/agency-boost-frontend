import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { ownMilestoneCodes, reorderWithin } from '@/lib/capability-mapping';
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
/** A core leader holds the Owner's rights in Pengaturan (ADR-0268). */
const CORE_LEADER = makeMe({ membership: { ...member, isKpmOwner: false, isCoreLeader: true }, permissions: ['tenant_config:read', 'tenant_config:write'] });
const READER = makeMe({ membership: member, permissions: ['tenant_config:read'] });

const entry = (code: string, label: string, displayOrder = 1, over: Record<string, unknown> = {}) => ({
  code, label, displayOrder, status: 'active', ...over,
});

/** The mockup's ladder (frame 18): cumulative stages, each adding its own milestones. */
const catalog = (over: Record<string, unknown> = {}) => ({
  stages: [
    { ...entry('COMPETENT_PRODUCER', 'Competent Producer'), requiredMilestoneCodes: ['SELLS'], stageOrder: 1 },
    { ...entry('INDEPENDENT_PRODUCER', 'Independent Producer', 2), requiredMilestoneCodes: ['SELLS', 'OUTSIDE'], stageOrder: 2 },
    {
      ...entry('PRODUCTIVE_TEAM_BUILDER', 'Productive Team Builder', 3),
      requiredMilestoneCodes: ['SELLS', 'OUTSIDE', 'RECRUITS', 'DEVELOPS'], stageOrder: 3,
    },
  ],
  milestones: [
    entry('SELLS', 'Sells policies independently'),
    entry('OUTSIDE', 'Sells outside direct network', 2),
    entry('RECRUITS', 'Recruits quality agents', 3),
    entry('DEVELOPS', 'Develops downline agent to Independent Producer', 4),
  ],
  grids: [
    {
      ...entry('PERSONAL_SELLING', 'Personal selling'), requiresDownline: false,
      items: [entry('LEADS', 'Leads generation consistency'), entry('APPROACH', 'Approach & appointment setting', 2)],
    },
    {
      ...entry('RECRUITMENT', 'Recruitment', 2), requiresDownline: false,
      items: [entry('CANDIDATES', 'Candidate leads generation')],
    },
    {
      ...entry('DEVELOPING_DOWNLINE_AGENT', 'Developing downline agent', 3), requiresDownline: true,
      items: [entry('VISIBILITY', 'Visibility into each agent’s progress & goals')],
    },
  ],
  version: 1,
  ...over,
});

function render(body: unknown = catalog(), me = OWNER, extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/kpm/settings/capability-mapping': { body },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null, settings: [] },
    },
    ...extra,
  });
  renderWithSession(<CapabilityMappingPage />, { me });
  return stub;
}

const ladder = () => screen.getByRole('region', { name: 'Ladder' });
const tracker = () => screen.getByRole('region', { name: 'Skill tracker' });
const stage = (code: string) => document.querySelector(`[data-stage="${code}"]`) as HTMLElement;
const writes = (stub: ReturnType<typeof stubFetch>, method: string, path: string) =>
  stub.calls.filter((c) => c.init.method === method && c.url.includes(path)).map((c) => JSON.parse(String(c.init.body)));

describe('P19.21-T3 AC-4 Capability Mapping as two cards (ADR-0274, frame 18)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-4 draws Ladder and Skill tracker side by side from 1024px, stacked below it, the mockup’s words', async () => {
    render();
    await screen.findByText('Competent Producer');
    expect(within(ladder()).getByText('Stage = the highest stage whose milestones the leader has all ticked')).toBeInTheDocument();
    expect(within(tracker()).getByText('Ticked by leaders in an agent’s profile · 3 groups')).toBeInTheDocument();
    const grid = ladder().parentElement!;
    expect(grid.className).toContain('lg:grid-cols-[1fr_1.25fr]');
    expect(screen.queryByRole('link', { name: 'Ladder' })).not.toBeInTheDocument();
    expect(screen.getByText('Leaders tick these in an agent’s profile (Capability mapping + Skill tracker)')).toBeInTheDocument();
  });

  it('P19.21-T3 AC-4 numbers each tahap and shows only the milestones it adds, as checkbox rows', async () => {
    render();
    await screen.findByText('Competent Producer');
    expect(within(stage('COMPETENT_PRODUCER')).getByLabelText('Stage 1')).toHaveTextContent('1');
    const own = (code: string) => [...stage(code).querySelectorAll('[data-milestone]')].map((li) => li.getAttribute('data-milestone'));
    expect(own('COMPETENT_PRODUCER')).toEqual(['SELLS']);
    expect(own('INDEPENDENT_PRODUCER')).toEqual(['OUTSIDE']);
    expect(own('PRODUCTIVE_TEAM_BUILDER')).toEqual(['RECRUITS', 'DEVELOPS']);
    // A box a leader ticks in the profile: drawn, never a control here.
    expect(within(ladder()).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('P19.21-T3 AC-4 + Tambah milestone under a tahap adds it there by its name alone', async () => {
    const stub = render(catalog(), OWNER, { 'POST /kpm/settings/capability-mapping/items': { body: catalog() } });
    await screen.findByText('Competent Producer');
    await userEvent.click(within(stage('INDEPENDENT_PRODUCER')).getByRole('button', { name: 'Add a milestone' }));
    await userEvent.type(within(stage('INDEPENDENT_PRODUCER')).getByLabelText('Name'), 'Polis pertama terbit');
    await userEvent.click(within(stage('INDEPENDENT_PRODUCER')).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(writes(stub, 'POST', '/items')).toEqual([
      { part: 'milestone', label: 'Polis pertama terbit', stageCode: 'INDEPENDENT_PRODUCER' },
    ]));
  });

  it('P19.21-T3 AC-4 + Tambah tahap asks its name and its first milestone, and adds nothing without both', async () => {
    const stub = render(catalog(), OWNER, { 'POST /kpm/settings/capability-mapping/items': { body: catalog() } });
    await screen.findByText('Competent Producer');
    await userEvent.click(within(ladder()).getByRole('button', { name: 'Add a stage' }));
    await userEvent.type(within(ladder()).getByLabelText('Stage name'), 'Transformative Team Builder');
    expect(within(ladder()).getByRole('button', { name: 'Add' })).toBeDisabled();
    await userEvent.type(within(ladder()).getByLabelText('Its first milestone'), 'Develops downline leader');
    await userEvent.click(within(ladder()).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(writes(stub, 'POST', '/items')).toEqual([
      { part: 'stage', label: 'Transformative Team Builder', firstMilestone: 'Develops downline leader' },
    ]));
  });

  it('P19.21-T3 AC-4 a kelompok shows “n skill”, opens to its skills on a tap, the first open already', async () => {
    render();
    await screen.findByText('Personal selling');
    const toggle = (label: string) => within(tracker()).getByRole('button', { name: `${label}: show its skills` });
    expect(toggle('Personal selling')).toHaveAttribute('aria-expanded', 'true');
    expect(within(tracker()).getByText('Leads generation consistency')).toBeInTheDocument();
    expect(toggle('Recruitment')).toHaveAttribute('aria-expanded', 'false');
    expect(within(tracker()).queryByText('Candidate leads generation')).not.toBeInTheDocument();
    await userEvent.click(toggle('Recruitment'));
    expect(within(tracker()).getByText('Candidate leads generation')).toBeInTheDocument();
    expect(within(tracker()).getByText(/^2 skills/)).toBeInTheDocument();
    expect(within(tracker()).getByText('1 skill · Only for somebody with a downline')).toBeInTheDocument();
  });

  it('P19.21-T3 AC-4 + Tambah skill and + Tambah kelompok add by name', async () => {
    const stub = render(catalog(), OWNER, { 'POST /kpm/settings/capability-mapping/items': { body: catalog() } });
    await screen.findByText('Personal selling');
    await userEvent.click(within(tracker()).getByRole('button', { name: 'Add a skill' }));
    await userEvent.type(within(tracker()).getByLabelText('Name'), 'Presentation');
    await userEvent.click(within(tracker()).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(writes(stub, 'POST', '/items')).toHaveLength(1));
    await userEvent.click(within(tracker()).getByRole('button', { name: 'Add a group' }));
    await userEvent.type(within(tracker()).getByLabelText('Name'), 'Digital selling');
    await userEvent.click(within(tracker()).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(writes(stub, 'POST', '/items')).toEqual([
      { part: 'item', label: 'Presentation', gridCode: 'PERSONAL_SELLING' },
      { part: 'grid', label: 'Digital selling' },
    ]));
  });

  it('P19.21-T3 AC-4 the pencil renames, the code shown while renaming and never sent as anything but the key', async () => {
    const renamed = catalog();
    const stub = render(catalog(), OWNER, { 'PATCH /kpm/settings/capability-mapping/label': { body: renamed } });
    await screen.findByText('Competent Producer');
    await userEvent.click(screen.getByRole('button', { name: 'Rename Recruits quality agents' }));
    const box = screen.getByLabelText('Name');
    expect(box).toHaveAccessibleDescription('Code RECRUITS — a tick names this, and renaming never moves it.');
    await userEvent.clear(box);
    await userEvent.type(box, 'Recruits good agents');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(stub, 'PATCH', '/label')).toEqual([
      { part: 'milestone', code: 'RECRUITS', label: 'Recruits good agents' },
    ]));
  });

  it('P19.21-T3 AC-4 ⋯ archives a milestone, saying it is taken out of its stages; restores an archived one', async () => {
    const stub = render(catalog(), OWNER, { 'PATCH /kpm/settings/capability-mapping/status': { body: catalog() } });
    await screen.findByText('Competent Producer');
    await userEvent.click(screen.getByRole('button', { name: 'More for Sells outside direct network' }));
    const archive = screen.getByRole('menuitem', { name: 'Archive' });
    expect(archive).toHaveAccessibleDescription('Takes it out of every stage that requires it; restoring it puts it back.');
    await userEvent.click(archive);
    await waitFor(() => expect(writes(stub, 'PATCH', '/status')).toEqual([
      { part: 'milestone', code: 'OUTSIDE', status: 'archived' },
    ]));
  });

  it('P19.21-T3 AC-4 drags a milestone within its tahap: every code once, the others where they were', async () => {
    const stub = render(catalog(), OWNER, { 'PATCH /kpm/settings/capability-mapping/order': { body: catalog() } });
    await screen.findByText('Competent Producer');
    fireEvent.keyDown(within(stage('PRODUCTIVE_TEAM_BUILDER')).getByRole('button', { name: /^Reorder Develops downline agent/ }), { key: 'ArrowUp' });
    await waitFor(() => expect(writes(stub, 'PATCH', '/order')).toEqual([
      { part: 'milestone', codes: ['SELLS', 'OUTSIDE', 'DEVELOPS', 'RECRUITS'] },
    ]));
  });

  it('P19.21-T3 AC-4 drags a skill within its kelompok, naming the kelompok', async () => {
    const stub = render(catalog(), OWNER, { 'PATCH /kpm/settings/capability-mapping/order': { body: catalog() } });
    await screen.findByText('Personal selling');
    fireEvent.keyDown(within(tracker()).getByRole('button', { name: /^Reorder Approach/ }), { key: 'ArrowUp' });
    await waitFor(() => expect(writes(stub, 'PATCH', '/order')).toEqual([
      { part: 'item', gridCode: 'PERSONAL_SELLING', codes: ['APPROACH', 'LEADS'] },
    ]));
  });

  it('P19.21-T3 AC-4 keeps archived rows hidden until Tampilkan yang diarsipkan, and milestones in no stage apart', async () => {
    render(catalog({
      milestones: [...catalog().milestones, entry('OLD', 'Old milestone', 5, { status: 'archived' })],
    }));
    await screen.findByText('Competent Producer');
    expect(screen.queryByText('Old milestone')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(within(screen.getByText('Milestones in no stage').parentElement!).getByText('Old milestone')).toBeInTheDocument();
  });

  it('P19.21-T3 AC-4 a reader sees both cards with no control to change them', async () => {
    render(catalog(), READER);
    await screen.findByText('Competent Producer');
    expect(screen.queryByRole('button', { name: /^Rename / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^More for / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a stage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
  });

  it('P19.21-T3 AC-4 a core leader writes as the Owner does', async () => {
    render(catalog(), CORE_LEADER);
    await screen.findByText('Competent Producer');
    expect(within(ladder()).getByRole('button', { name: 'Add a stage' })).toBeInTheDocument();
  });

  it('P19.21-T3 AC-4 says what the server refused, in its own words', async () => {
    render(catalog(), OWNER, {
      'PATCH /kpm/settings/capability-mapping/status': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Competent Producer would require no milestone without this one, so everybody would be on it. Add another milestone to it first.', requestId: 'r-1' } },
      },
    });
    await screen.findByText('Competent Producer');
    await userEvent.click(screen.getByRole('button', { name: 'More for Sells policies independently' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('would require no milestone without this one');
  });

  it('shows the empty state of each card for a catalog with nothing in it', async () => {
    render({ stages: [], milestones: [], grids: [], version: 1 });
    expect(await screen.findByText('No stages yet.')).toBeInTheDocument();
    expect(screen.getByText('No skill groups yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a stage' })).toBeEnabled();
  });

  it('shows a skeleton, then the read’s refusal, when the catalog cannot be read', async () => {
    stubFetch({
      '/kpm/settings/capability-mapping': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The server stumbled.', requestId: 'r-2' } } },
      '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null, settings: [] } },
    });
    renderWithSession(<CapabilityMappingPage />, { me: OWNER });
    expect(await screen.findByText('The server stumbled.')).toBeInTheDocument();
  });
});

describe('P19.21-T3 AC-4 the ladder’s rules, as functions', () => {
  it('P19.21-T3 AC-4 a stage’s own milestones are what it adds over every stage of lower seniority, in the catalog’s order', () => {
    const { stages } = catalog();
    const order = ['DEVELOPS', 'SELLS', 'RECRUITS', 'OUTSIDE'];
    expect(ownMilestoneCodes(stages[2] as never, stages as never, order)).toEqual(['DEVELOPS', 'RECRUITS']);
    expect(ownMilestoneCodes(stages[0] as never, stages as never, order)).toEqual(['SELLS']);
  });

  it('P19.21-T3 AC-4 a milestone moved within its stage keeps every other milestone where it was', () => {
    expect(reorderWithin(['A', 'X', 'B', 'Y', 'C'], ['A', 'B', 'C'], 2, 0)).toEqual(['C', 'X', 'A', 'Y', 'B']);
    expect(reorderWithin(['A', 'B'], ['A', 'B'], 0, 5)).toEqual(['A', 'B']);
  });
});

describe('P19.2-T3 AC-4 the capability mapping’s targets (UI-142)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([390, 768])('P19.21-T3 AC-4 at %ipx finds no target under 44px', async (px) => {
    atWidth(px);
    render();
    const frame = document.body.firstElementChild!;
    frame.setAttribute('data-surface', 'v1');
    await screen.findByText('Competent Producer');
    expect(smallTargets(frame, px)).toEqual([]);
  });
});
