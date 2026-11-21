import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import LeadStatusesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/lead-statuses',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const AGENT = makeMe({
  membership: { ...membership, orgLevelCode: 'AGENT', hierarchyRole: 'agent' as const, isKpmOwner: false },
  permissions: ['tenant_config:read'],
});

const stage = (over: Record<string, unknown> = {}) => ({
  id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 2,
  isTerminal: false, isLateStage: false, version: 1, status: 'active', ...over,
});

/** The client's sales pipeline (mockup f15): five stages, two expected to close, the last one closing. */
const MOCKUP = [
  {
    pipeline: 'sales',
    statuses: [
      stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
      stage({ id: 's1', code: 'FOLLOW_UP', label: 'Follow-up', rank: 2 }),
      stage({ id: 's2', code: 'POLICY_SUBMITTED', label: 'Policy submitted', rank: 3, isLateStage: true }),
      stage({ id: 's3', code: 'APPROVED_NOT_PAID', label: 'Approved, not paid', rank: 4, isLateStage: true }),
      stage({ id: 's4', code: 'POLICY_ISSUED', label: 'Policy issued', rank: 5, isTerminal: true }),
      stage({ id: 's5', code: 'DORMANT', label: 'Dormant', rank: null, status: 'archived' }),
    ],
  },
  { pipeline: 'recruitment', statuses: [stage({ id: 'r0', pipeline: 'recruitment', code: 'JOINED', label: 'Joined', rank: 1, isTerminal: true })] },
];

const QUIET = { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } };

function render(me = OWNER, body: unknown = MOCKUP, routes: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({ '/kpm/settings/lead-statuses': { body }, '/kpm/settings/publish-state': QUIET, ...routes });
  const view = renderWithSession(<LeadStatusesPage />, { me });
  return { ...stub, container: view.container };
}

const rowOf = (label: string): HTMLElement => [...document.querySelectorAll<HTMLElement>('[data-stage]')]
  .find((li) => li.querySelector('p')?.textContent?.endsWith(label))!;
const menuOf = (label: string) => screen.getByRole('button', { name: `Actions for ${label}` });
const items = () => screen.getAllByRole('menuitem').map((it) => it.textContent);
const item = (name: string) => screen.getByRole('menuitem', { name });
const held = (name: string) => item(name).getAttribute('aria-disabled') === 'true';
async function choose(label: string, name: string) {
  await userEvent.click(menuOf(label));
  await userEvent.click(item(name));
}

describe('P19.21-T3 AC-2 Lead statuses as the client’s 19 November card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-2 draws the ordered pipeline as numbered rows with their tags, and the legend under the card', async () => {
    render();
    await screen.findByText('5. Policy issued');
    const rows = [...document.querySelectorAll('[data-stage]')].map((li) => li.querySelector('p')!.textContent);
    expect(rows).toEqual(['1. Not yet approached', '2. Follow-up', '3. Policy submitted', '4. Approved, not paid', '5. Policy issued']);
    const tags = (label: string) => within(rowOf(label)).queryAllByText(/^(Expected to close|Open|Closes)$/).map((t) => t.textContent);
    expect(tags('Not yet approached')).toEqual(['Open']);
    expect(tags('Policy submitted')).toEqual(['Expected to close', 'Open']);
    expect(tags('Policy issued')).toEqual(['Closes']);
    expect(screen.getByText('Order = the pipeline’s flow')).toBeInTheDocument();
    expect(screen.getByText('Expected to close is counted on the KPM Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add status to Sales' })).toHaveTextContent('Add status');
    // The code stays off the list: a lead holds it.
    expect(screen.queryByText('POLICY_ISSUED')).not.toBeInTheDocument();
  });

  it('P19.21-T3 AC-2 one ⋯ per stage at every width: moves, Rename, the flag, the closer, Archive', async () => {
    atWidth(1280);
    render();
    await screen.findByText('5. Policy issued');
    await userEvent.click(menuOf('Follow-up'));
    expect(items()).toEqual([
      'Move up', 'Move down', 'Rename', 'Count as Expected to close', 'Make this close the pipeline', 'Archive',
    ]);
    await userEvent.keyboard('{Escape}');
    expect(menuOf('Follow-up')).toHaveFocus();
    await userEvent.click(menuOf('Policy submitted'));
    expect(items()).toContain('Stop counting as Expected to close');
    await userEvent.keyboard('{Escape}');
    // The stage that closes the pipeline: no flag, no closer, Archive held with its reason.
    await userEvent.click(menuOf('Policy issued'));
    expect(items()).toEqual(['Move up', 'Move down', 'Rename', 'ArchiveMake another stage close the pipeline first.']);
    expect(held('Archive')).toBe(true);
    expect(item('Archive')).toHaveAccessibleDescription(/Make another stage close the pipeline first\./);
  });

  it('P19.21-T3 AC-2 shows a reader the pipeline and its tags, and none of the controls', async () => {
    render(AGENT);
    await screen.findByText('5. Policy issued');
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add status/ })).toBeNull();
    expect(screen.queryByText('⠿')).toBeNull();
    // The two tagged stages; the legend says the term inside its own sentence.
    expect(screen.getAllByText('Expected to close')).toHaveLength(2);
  });

  it('P19.21-T3 AC-2 is clean under axe, populated, with a ⋯ open', async () => {
    const { container } = render();
    await screen.findByText('5. Policy issued');
    await userEvent.click(menuOf('Follow-up'));
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  it('P13.2-T6 AC-8 an empty pipeline says so in its card, and offers its first stage', async () => {
    render(OWNER, [{ pipeline: 'sales', statuses: [] }, { pipeline: 'recruitment', statuses: [] }]);
    expect(await screen.findByText('No stages yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add status to Sales' })).toBeEnabled();
  });

  it('a failed read says why, through the screen’s banner', async () => {
    stubFetch({
      '/kpm/settings/lead-statuses': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something broke.', requestId: 'r-0' } } },
      '/kpm/settings/publish-state': QUIET,
    });
    renderWithSession(<LeadStatusesPage />, { me: OWNER });
    expect((await screen.findAllByRole('alert')).some((a) => a.textContent?.includes('Something broke.'))).toBe(true);
  });
});

describe('the office lead pipelines (P4-T3), inside the 19 November card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows one ladder at a time, and both are reachable', async () => {
    render();
    await screen.findByText('5. Policy issued');
    expect(screen.queryByText('1. Joined')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Recruitment' }));
    expect(await screen.findByText('1. Joined')).toBeInTheDocument();
    expect(screen.queryByText('5. Policy issued')).not.toBeInTheDocument();
  });

  describe('Expected to close (ADR-0043; P18.7-T1 AC-5)', () => {
    const PATCH = 'PATCH /kpm/settings/lead-statuses/s1/late-stage';
    const lateOn = [
      { ...MOCKUP[0], statuses: MOCKUP[0].statuses.map((st) => (st.id === 's1' ? { ...st, isLateStage: true } : st)) },
      MOCKUP[1],
    ];
    const sends = (calls: { url: string; init: RequestInit }[]) =>
      calls.filter((c) => c.url.includes('/s1/late-stage')).map((c) => JSON.parse(String(c.init.body)));

    it('counts a stage from its ⋯, sending a real boolean, and says Saved ✓ beside its tags', async () => {
      const { calls } = render(OWNER, MOCKUP, {
        '/kpm/settings/lead-statuses': [{ body: MOCKUP }, { body: lateOn }],
        [PATCH]: { body: lateOn[0].statuses[1] },
      });
      await screen.findByText('2. Follow-up');
      await choose('Follow-up', 'Count as Expected to close');
      await waitFor(() => expect(within(rowOf('Follow-up')).getByText('Saved ✓')).toBeInTheDocument());
      expect(sends(calls)).toEqual([{ isLateStage: true }]);
      expect(within(rowOf('Follow-up')).getByText('Expected to close')).toBeInTheDocument();
      expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
    });

    it('stops counting one, because an untick is as much a decision as a tick', async () => {
      const { calls } = render(OWNER, MOCKUP, { 'PATCH /kpm/settings/lead-statuses/s2/late-stage': { body: MOCKUP[0].statuses[2] } });
      await screen.findByText('3. Policy submitted');
      await choose('Policy submitted', 'Stop counting as Expected to close');
      const sent = calls.find((c) => c.url.includes('/s2/late-stage'))!;
      expect(JSON.parse(String(sent.init.body))).toEqual({ isLateStage: false });
    });

    it('a refused flag says Couldn’t save — retry beside its tags, and the retry sends the same value again', async () => {
      const { calls } = render(OWNER, MOCKUP, {
        '/kpm/settings/lead-statuses': [{ body: MOCKUP }, { body: lateOn }],
        [PATCH]: [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
          { body: lateOn[0].statuses[1] },
        ],
      });
      await screen.findByText('2. Follow-up');
      await choose('Follow-up', 'Count as Expected to close');
      const retry = await screen.findByRole('button', { name: "Couldn't save — retry: Expected to close, Follow-up" });
      expect(rowOf('Follow-up')).toContainElement(retry);
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(retry);
      await waitFor(() => expect(sends(calls)).toEqual([{ isLateStage: true }, { isLateStage: true }]));
      await waitFor(() => expect(within(rowOf('Follow-up')).getByText('Saved ✓')).toBeInTheDocument());
    });
  });

  it('Rename opens the stage’s sheet: the code read-only, the name; Save renames and the ⋯ has the focus back', async () => {
    const { calls } = render(OWNER, MOCKUP, { 'PATCH /kpm/settings/lead-statuses/s1': { body: MOCKUP[0].statuses[1] } });
    await screen.findByText('2. Follow-up');
    await choose('Follow-up', 'Rename');
    const sheet = await screen.findByRole('dialog', { name: 'Follow-up' });
    expect(within(sheet).getByLabelText('Code')).toHaveValue('FOLLOW_UP');
    expect(within(sheet).getByLabelText('Code')).toHaveAttribute('readonly');
    await userEvent.clear(within(sheet).getByLabelText('Label'));
    await userEvent.type(within(sheet).getByLabelText('Label'), 'Follow up');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const sent = calls.find((c) => c.url.endsWith('/lead-statuses/s1') && c.init.method === 'PATCH')!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ label: 'Follow up' });
    await waitFor(() => expect(menuOf('Follow-up')).toHaveFocus());
  });

  it('makes a stage close the pipeline and archives one from the ⋯, through the routes the row used', async () => {
    const { calls } = render(OWNER, MOCKUP, {
      'POST /kpm/settings/lead-statuses/s1/terminal': { body: MOCKUP[0] },
      'DELETE /kpm/settings/lead-statuses/s0': { body: MOCKUP[0].statuses[0] },
    });
    await screen.findByText('2. Follow-up');
    await choose('Follow-up', 'Make this close the pipeline');
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/s1/terminal'))).toBe(true));
    await choose('Not yet approached', 'Archive');
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/lead-statuses/s0') && c.init.method === 'DELETE')).toBe(true));
  });

  it('restores an archived stage from its ⋯, shown with the archived switch', async () => {
    const { calls } = render(OWNER, MOCKUP, { 'POST /kpm/settings/lead-statuses/s5/restore': { body: MOCKUP[0].statuses[5] } });
    await screen.findByText('2. Follow-up');
    expect(screen.queryByText('Dormant')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(within(rowOf('Dormant')).getByText('archived')).toBeInTheDocument();
    await choose('Dormant', 'Restore');
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/s5/restore'))).toBe(true));
  });

  it('sends the whole pipeline, archived included, when a stage moves by its ⠿ or its ⋯', async () => {
    const { calls } = render();
    await screen.findByText('2. Follow-up');
    fireEvent.keyDown(screen.getByRole('button', { name: /^Reorder Follow-up/ }), { key: 'ArrowUp' });
    await waitFor(() => expect(calls.some((c) => c.url.includes('/reorder'))).toBe(true));
    const first = calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(first.init.body as string)).toEqual({ pipeline: 'sales', ids: ['s1', 's0', 's2', 's3', 's4', 's5'] });
  });

  it('P18.9-T8 F3 holds Move up and Move down at the ends of the stages in view', async () => {
    atWidth(375);
    render();
    await screen.findByText('2. Follow-up');
    await userEvent.click(menuOf('Not yet approached'));
    expect([held('Move up'), held('Move down')]).toEqual([true, false]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(menuOf('Policy issued'));
    expect([held('Move up'), held('Move down')]).toEqual([false, true]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await userEvent.click(menuOf('Policy issued'));
    expect([held('Move up'), held('Move down')]).toEqual([false, false]);
  });

  it('adds a stage to the pipeline it was added under', async () => {
    const { calls } = render(OWNER, MOCKUP, { 'POST /kpm/settings/lead-statuses': { body: MOCKUP[1].statuses[0] } });
    await userEvent.click(await screen.findByRole('link', { name: 'Recruitment' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add status to Recruitment' }));
    await userEvent.type(screen.getByLabelText('Code'), 'aaji_pending');
    await userEvent.type(screen.getByLabelText('Label'), 'AAJI pending');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const call = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(call.init.body as string)).toEqual({ pipeline: 'recruitment', code: 'AAJI_PENDING', label: 'AAJI pending' });
  });
});

describe('P19.2-T3 AC-4 the lead statuses’ targets (UI-142)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx finds no target under 44px, with the archived shown', async (px) => {
    atWidth(px);
    stubFetch({ '/kpm/settings/lead-statuses': { body: MOCKUP }, '/kpm/settings/publish-state': QUIET });
    const { container } = renderWithSession(<div data-surface="v1"><LeadStatusesPage /></div>, { me: OWNER });
    await screen.findByText('2. Follow-up');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(smallTargets(container, px)).toEqual([]);
  });
});
