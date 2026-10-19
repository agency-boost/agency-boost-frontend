import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
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

const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
      stage(),
      stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true }),
    ],
  },
  { pipeline: 'recruitment', statuses: [stage({ id: 'r0', pipeline: 'recruitment', code: 'NOT_APPROACHED', label: 'Not approached', rank: 1, isTerminal: true })] },
];

function render(me = OWNER, body: unknown = PIPELINES) {
  const stub = stubFetch({ '/kpm/settings/lead-statuses': { body } });
  renderWithSession(<LeadStatusesPage />, { me });
  return stub;
}

/** The handle does both jobs now — the ↑↓ buttons it replaced were the old keyboard path. */
const handleFor = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^Reorder ${label}`) });

describe('the office lead pipelines (P4-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P13.2-T6 AC-8: an empty pipeline says so, and offers its first stage', async () => {
    // An office started Empty (ADR-0115 §1): both pipelines, each with no stage.
    render(OWNER, [{ pipeline: 'sales', statuses: [] }, { pipeline: 'recruitment', statuses: [] }]);
    expect(await screen.findByText('No stages yet.')).toBeInTheDocument();
    expect(screen.getByText(/^0 statuses/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add a .* stage$/ })).toBeEnabled();
  });

  it('shows one ladder at a time, and both are reachable', async () => {
    /*
     * Subtabs since the prototype alignment pass (`KPM_Owner.html:1492-1495`). Stacked,
     * the two ladders read as one eleven-stage list on a narrow screen — and the
     * prototype's own hint, *order determines the pipeline stage sequence*, is then a
     * sentence about an order that does not exist.
     */
    render();
    expect(await screen.findByText('Paid and issued')).toBeInTheDocument();
    expect(screen.queryByText('Not approached')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Recruitment' }));
    expect(await screen.findByText('Not approached')).toBeInTheDocument();
    expect(screen.queryByText('Paid and issued')).not.toBeInTheDocument();
  });

  it('sends every stage to a reorder, including the archived ones', async () => {
    /*
     * `LeadStatusService.reorder` counts every status in the pipeline, archived included.
     * The screen used to read only the visible ones, so one archived stage returned
     * `400 Send every sales status, once each` for ever. The step also skips hidden rows:
     * swapping with a row the reader cannot see is a button that appears to do nothing.
     */
    const { calls } = render(OWNER, [
      {
        pipeline: 'sales',
        statuses: [
          stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
          stage({ id: 'sx', code: 'OLD', label: 'Retired', rank: 2, status: 'archived' }),
          stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true }),
        ],
      },
      { pipeline: 'recruitment', statuses: [stage({ id: 'r0', pipeline: 'recruitment' })] },
    ]);

    await screen.findByText('Not yet approached');
    expect(screen.queryByText('Retired')).not.toBeInTheDocument();

    fireEvent.keyDown(handleFor('Paid and issued'), { key: 'ArrowUp' });

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    const { ids } = JSON.parse(patch.init.body as string);
    // All three, archived included — and the visible pair swapped around it.
    expect(ids).toEqual(['s2', 'sx', 's0']);
  });

  it('counts the stages of the tab it is on, the way the prototype does', async () => {
    render();
    expect(await screen.findByText(/statuses — order determines the pipeline stage sequence/))
      .toBeInTheDocument();
  });

  it('badges every stage, not only the one that closes', async () => {
    // An unbadged row reads as one whose state failed to load, and Open is what most
    // stages actually are.
    render();
    await screen.findByText('Paid and issued');
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
  });

  it('marks the stage that closes a pipeline, rather than leaving it implied', async () => {
    /*
     * The prototype gates *mark successful* on the last element of a hardcoded array, so
     * adding a stage after the end would silently move the gate. Here it is a badge on
     * one stage, and moving it is a deliberate act.
     */
    render();
    // One per pipeline, and only the tab in view renders — so one here, one after the
    // tab switch above.
    expect(await screen.findAllByText('Closes the pipeline')).toHaveLength(1);
  });

  describe('the stages a lead is expected to close from (ADR-0043)', () => {
    /*
     * OD-12's second half, and the only thing that decides what the KPM Overview's
     * *Expected to close* tile counts. Before this flag the tile had no source at all and
     * the metric registry recorded it as uncomputable.
     */
    const withLate = [
      {
        pipeline: 'sales',
        statuses: [
          stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
          stage({ id: 's1', code: 'POLICY_SUBMITTED', label: 'Policy submitted', rank: 2, isLateStage: true }),
          stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true }),
        ],
      },
      { pipeline: 'recruitment', statuses: [] },
    ];

    it('shows the flag as a switch, on the stages that can carry it', async () => {
      render(OWNER, withLate);

      expect(await screen.findByText('Policy submitted')).toBeInTheDocument();
      const switches = screen.getAllByRole('switch', { name: 'Expected to close' });
      // Two open stages carry one each; the stage that closes the pipeline carries none.
      expect(switches).toHaveLength(2);
      expect(switches[0]).not.toBeChecked();
      expect(switches[1]).toBeChecked();
    });

    it('does not offer it on the stage that closes the pipeline', async () => {
      // A lead sitting there has already closed, so the server refuses it — and a control
      // that only ever produces a 400 is worse than no control.
      render(OWNER, withLate);
      await screen.findByText('Paid and issued');

      const rows = screen.getAllByRole('listitem');
      const closing = rows.find((li) => li.textContent?.includes('Paid and issued'))!;
      expect(closing.querySelector('[role="switch"]')).toBeNull();
    });

    it('ticks one, sending a real boolean', async () => {
      const stub = render(OWNER, withLate);
      await screen.findByText('Not yet approached');

      await userEvent.click(screen.getAllByRole('switch', { name: 'Expected to close' })[0]);

      const sent = stub.calls.find((c) => String(c.url).includes('/late-stage'));
      expect(String(sent?.url)).toContain('/lead-statuses/s0/late-stage');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ isLateStage: true });
    });

    it('unticks one, because an untick is as much a decision as a tick', async () => {
      const stub = render(OWNER, withLate);
      await screen.findByText('Policy submitted');

      await userEvent.click(screen.getAllByRole('switch', { name: 'Expected to close' })[1]);

      const sent = stub.calls.find((c) => String(c.url).includes('/late-stage'));
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ isLateStage: false });
    });

    it('tells the reader what the flag is for, once per ladder', async () => {
      render(OWNER, withLate);

      const hint = await screen.findByText(/Switch on the stages a lead is usually close to/);
      // The Overview's tile is not built (P10.1-T2): the sentence says it will count them, and no
      // longer that it does.
      expect(hint).toHaveTextContent(/will count as Expected to close on the KPM Overview\.$/);
      expect(hint).not.toHaveTextContent(/Overview counts/);
    });

    it('shows a reader who cannot write a badge, and never both', async () => {
      // A badge beside a switch is two controls answering one question, and whichever one
      // the reader trusts the other contradicts.
      render(AGENT, withLate);

      expect(await screen.findByText('Expected to close')).toBeInTheDocument();
      expect(screen.queryByRole('switch')).toBeNull();
    });
  });

  describe('where the code is shown (P4-T24, parity I-64)', () => {
    it('keeps codes out of the ladder by default', async () => {
      render();
      await screen.findByText('Paid and issued');

      expect(screen.queryByText('PAID_AND_ISSUED')).not.toBeInTheDocument();
    });


    it('shows the code, not editable, inside the edit panel', async () => {
      // A lead holds the code, so it is the thing a reader needs while renaming a stage —
      // and the thing they must not be able to change.
      render();
      await screen.findByText('Paid and issued');
      await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
    });
  });

  it('will not archive the stage that closes a pipeline', async () => {
    // Leads would have no way to be marked successful, and the leads screen would not say
    // why the tick stopped working. The server refuses it too.
    render();
    await screen.findByText('Paid and issued');
    const archives = screen.getAllByRole('button', { name: 'Archive' });
    // The terminal stage is the third row of sales; its Archive is disabled.
    expect(archives[2]).toBeDisabled();
    expect(archives[0]).toBeEnabled();
  });

  it('offers to move the closing stage only to one that is not already it', async () => {
    render();
    await screen.findByText('Paid and issued');
    expect(screen.getAllByRole('button', { name: 'Make this close the pipeline' }))
      .toHaveLength(2);
  });

  it('sends the whole pipeline when a stage moves, and only that pipeline', async () => {
    const { calls } = render();
    await screen.findByText('Follow-up');
    fireEvent.keyDown(handleFor('Follow-up'), { key: 'ArrowUp' });

    const call = calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({
      pipeline: 'sales', ids: ['s1', 's0', 's2'],
    });
  });

  it('adds a stage to the pipeline it was added under', async () => {
    const { calls } = render();
    // Only the tab in view renders its Add button, so the pipeline a new stage lands in
    // is the one on screen — which is the point of the assertion below.
    await userEvent.click(await screen.findByRole('link', { name: 'Recruitment' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add a recruitment stage' }));
    await userEvent.type(screen.getByLabelText('Code'), 'aaji_pending');
    await userEvent.type(screen.getByLabelText('Label'), 'AAJI pending');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const call = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(call.init.body as string)).toEqual({
      pipeline: 'recruitment', code: 'AAJI_PENDING', label: 'AAJI pending',
    });
  });

  it('never offers to change a code', async () => {
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveAttribute('readonly');
  });

  it('shows an agent the ladders and none of the controls', async () => {
    render(AGENT);
    expect(await screen.findByText('Paid and issued')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add a/ })).toBeNull();
  });
});
