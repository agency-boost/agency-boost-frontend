import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, digestAt, makeMe, renderWithSession, stubFetch, wears, type StubReply } from '@test/harness';
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

    describe('P18.95-T1 AC-5 — the switch says it is saved, beside it', () => {
      /** The save confirmation in the switch's own row: the nearest ancestor with a status for a child. */
      const besides = (el: HTMLElement) => {
        for (let box = el.parentElement; box; box = box.parentElement) {
          const own = [...box.children].find((c) => c.getAttribute('role') === 'status');
          if (own) return own as HTMLElement;
          if (box.tagName === 'LI') break;
        }
        return null;
      };
      const lateOn = [
        { ...withLate[0], statuses: withLate[0].statuses.map((s) => (s.id === 's0' ? { ...s, isLateStage: true } : s)) },
        withLate[1],
      ];
      const PATCH = 'PATCH /kpm/settings/lead-statuses/s0/late-stage';
      /** Nothing waiting to publish: the bar draws nothing, so the screen's one alert is the write's. */
      const PUBLISHED = { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } };
      const sends = (stub: ReturnType<typeof stubFetch>) =>
        stub.calls.filter((c) => c.url.includes('/s0/late-stage')).map((c) => JSON.parse(String(c.init.body)));

      it('P18.95-T1 AC-5: says Saved ✓ beside the switch once it is kept, and beside no other', async () => {
        stubFetch({
          '/kpm/settings/lead-statuses': [{ body: withLate }, { body: lateOn }],
          '/kpm/settings/publish-state': PUBLISHED,
          [PATCH]: { body: lateOn[0].statuses[0] },
        });
        renderWithSession(<LeadStatusesPage />, { me: OWNER });
        await screen.findByText('Not yet approached');
        const [first, second] = screen.getAllByRole('switch', { name: 'Expected to close' });

        await userEvent.click(first);

        await waitFor(() => expect(besides(first)).toHaveTextContent('Saved ✓'));
        expect(besides(first)).toHaveClass('text-success');
        expect(first).toBeChecked();
        expect(besides(second)).toBeNull();
        expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
      });

      it('P18.95-T1 AC-5: a refused switch says Couldn’t save — retry, and the retry sends the same value again', async () => {
        const stub = stubFetch({
          '/kpm/settings/lead-statuses': [{ body: withLate }, { body: lateOn }],
          '/kpm/settings/publish-state': PUBLISHED,
          [PATCH]: [
            { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
            { body: lateOn[0].statuses[0] },
          ],
        });
        renderWithSession(<LeadStatusesPage />, { me: OWNER });
        await screen.findByText('Not yet approached');
        const toggle = screen.getAllByRole('switch', { name: 'Expected to close' })[0];
        await userEvent.click(toggle);

        const retry = await screen.findByRole('button', { name: "Couldn't save — retry: Expected to close, Not yet approached" });
        expect(besides(toggle)).toContainElement(retry);
        // The reason stays in the banner above the ladder, where it always was; the switch still shows what is kept.
        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
        expect(toggle).not.toBeChecked();

        await userEvent.click(retry);

        await waitFor(() => expect(sends(stub)).toEqual([{ isLateStage: true }, { isLateStage: true }]));
        await waitFor(() => expect(besides(toggle)).toHaveTextContent('Saved ✓'));
        expect(toggle).toBeChecked();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
      });
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

/**
 * **A stage's controls on a phone** (P18.97-T7 AC-3, ADR-0178 §5; the client's KPM Owner review of 2026-10-27,
 * UI-035: each row's *Edit · Expected to close · Make this close the pipeline · Archive* reached 449px on a 375px
 * screen, and the page scrolled sideways). Below 768px the three actions sit behind one ⋮ and the switch has a line of
 * its own; at 768px and wider the row is as it was — the client's *Don't change* for a desktop.
 */
describe('P18.97-T7 AC-3 a stage’s controls on a phone (UI-035)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const LADDER = [
    {
      pipeline: 'sales',
      statuses: [
        stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
        stage({ isLateStage: true }),
        stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true }),
        stage({ id: 's3', code: 'DORMANT', label: 'Dormant', rank: 4, status: 'archived' }),
      ],
    },
    PIPELINES[1],
  ];

  /** The ladder's markup on the build before P18.97-T7, archived stages hidden and shown, from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<'active' | 'archived', Record<768 | 1280, string>> = {
    active: {
      768: '5bc104c5d10240d1052ed4479586d62e6d0dd380893e6ded8051a3bbf85756f5',
      1280: '5bc104c5d10240d1052ed4479586d62e6d0dd380893e6ded8051a3bbf85756f5',
    },
    archived: {
      768: 'aac62291c23921ddda07a603dcc1bc4f413b6f8ed7c24f8ff112b63f2ac66fc4',
      1280: 'aac62291c23921ddda07a603dcc1bc4f413b6f8ed7c24f8ff112b63f2ac66fc4',
    },
  };

  it.each([768, 1280] as const)('P18.97-T7 AC-3 at %ipx draws every stage as it was, to the byte', async (px) => {
    atWidth(px);
    stubFetch({ '/kpm/settings/lead-statuses': { body: LADDER } });
    const { container } = renderWithSession(<LeadStatusesPage />, { me: OWNER });
    await screen.findByText('Paid and issued');
    // The pipeline's card: its heading, the switch's sentence, every stage, and *Add a sales stage*.
    expect(digestAt(container.querySelector('ol')!.parentElement!, px)).toBe(BEFORE_T7.active[px]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await screen.findByText('Dormant');
    expect(digestAt(container.querySelector('ol')!.parentElement!, px)).toBe(BEFORE_T7.archived[px]);
  });
  const onAPhone = (px = 375, routes: Record<string, unknown> = {}) => {
    atWidth(px);
    const stub = stubFetch({ '/kpm/settings/lead-statuses': { body: LADDER }, ...routes });
    renderWithSession(<LeadStatusesPage />, { me: OWNER });
    return stub;
  };
  const rowOf = (label: string) => screen.getByText(label, { selector: 'p' }).closest('li')!;
  const menuOf = (label: string) => screen.getByRole('button', { name: `Actions for ${label}` });
  const items = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

  it.each([375, 767])('P18.97-T7 AC-3 at %ipx puts a stage’s three actions behind one ⋮ and its switch on a line of its own', async (px) => {
    onAPhone(px);
    await screen.findByText('Paid and issued');
    const follow = rowOf('Follow-up');
    // No inline action on the row: they are the menu's.
    for (const name of ['Edit', 'Make this close the pipeline', 'Archive']) {
      expect(within(follow).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    await userEvent.click(within(follow).getByRole('button', { name: 'Actions for Follow-up' }));
    // The ⠿'s two moves first since P18.97-T8 F3 (below), then the row's three.
    expect(items()).toEqual(['Move up', 'Move down', 'Edit', 'Make this close the pipeline', 'Archive']);
    await userEvent.keyboard('{Escape}');
    expect(menuOf('Follow-up')).toHaveFocus();

    // The switch, its name and its state as on the row from 768px, on a line under the stage's name.
    const toggle = within(follow).getByRole('switch', { name: 'Expected to close' });
    expect(toggle).toBeChecked();
    const line = toggle.closest('div')!;
    expect(line.parentElement).toContainElement(within(follow).getByText('Follow-up', { selector: 'p' }));
    // A 44 × 44px target there: the line 44px tall, the input a 44px square on the track.
    expect(wears(toggle, px).split(' ')).toEqual(expect.arrayContaining(['h-11', 'w-11']));
    expect(wears(toggle.parentElement!.parentElement!, px).split(' ')).toContain('min-h-11');
  });

  it('P18.97-T7 AC-3 offers the stage that closes the pipeline Edit, and Archive held with its reason, and no switch', async () => {
    onAPhone();
    await screen.findByText('Paid and issued');
    const paid = rowOf('Paid and issued');
    expect(within(paid).queryByRole('switch')).not.toBeInTheDocument();
    await userEvent.click(menuOf('Paid and issued'));
    expect(items()).toEqual(['Move up', 'Move down', 'Edit', 'ArchiveMake another stage close the pipeline first.']);
    const archive = screen.getByRole('menuitem', { name: 'Archive' });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    expect(archive).toHaveAccessibleDescription('Make another stage close the pipeline first.');
  });

  it('P18.97-T7 AC-3 makes a stage close the pipeline and archives one from the menu, through the routes the row uses', async () => {
    const { calls } = onAPhone(375, {
      'POST /kpm/settings/lead-statuses/s1/terminal': { body: LADDER[0] },
      'DELETE /kpm/settings/lead-statuses/s0': { body: stage({ id: 's0', status: 'archived' }) },
    });
    await screen.findByText('Paid and issued');
    await userEvent.click(menuOf('Follow-up'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Make this close the pipeline' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/kpm/settings/lead-statuses/s1/terminal') && c.init.method === 'POST')).toBe(true));
    await userEvent.click(menuOf('Not yet approached'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/kpm/settings/lead-statuses/s0') && c.init.method === 'DELETE')).toBe(true));
  });

  it('P18.97-T7 AC-3 opens Edit from the menu on the label’s field, and gives the ⋮ the focus back when it closes', async () => {
    onAPhone();
    await screen.findByText('Paid and issued');
    await userEvent.click(menuOf('Follow-up'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const field = await screen.findByLabelText('Label');
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveValue('Follow-up');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(menuOf('Follow-up')).toHaveFocus());
  });

  it('P18.97-T7 AC-3 restores an archived stage from its menu', async () => {
    const { calls } = onAPhone(375, { 'POST /kpm/settings/lead-statuses/s3/restore': { body: stage({ id: 's3' }) } });
    await screen.findByText('Paid and issued');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await userEvent.click(menuOf('Dormant'));
    expect(items()).toEqual(['Move up', 'Move down', 'Edit', 'Restore']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/s3/restore'))).toBe(true));
  });

  it('P18.97-T7 AC-3 at 768px keeps the row’s own words and no ⋮', async () => {
    atWidth(768);
    stubFetch({ '/kpm/settings/lead-statuses': { body: LADDER } });
    renderWithSession(<LeadStatusesPage />, { me: OWNER });
    await screen.findByText('Paid and issued');
    expect(screen.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument();
    expect(within(rowOf('Follow-up')).getByRole('button', { name: 'Make this close the pipeline' })).toBeInTheDocument();
  });
});

/**
 * **A phone moves a stage from its ⋮** (P18.97-T8 F3, parity F-257; ADR-0178 §5's ↑ and ↓ for a list reordered by
 * drag). The production build's walk found the ⠿ all a phone had: a drag never starts on a touch screen, its ↑ ↓ keys
 * need a keyboard, and it is 10 × 20px. Below 768px a stage's ⋮ offers *Move up* and *Move down* — `ReorderArrows`'
 * words — through the reorder call the ⠿ makes; from 768px the row is as it was (T7's digests above).
 */
describe('P18.97-T8 F3 a stage moves from its ⋮ on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  const LADDER = [
    {
      pipeline: 'sales',
      statuses: [
        stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
        stage(),
        stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true }),
        stage({ id: 's3', code: 'DORMANT', label: 'Dormant', rank: 4, status: 'archived' }),
      ],
    },
    PIPELINES[1],
  ];
  /** The ladder as the server answers it once `ids` is its order: the same stages, ranked again. */
  const reordered = (ids: string[]) => [
    { ...LADDER[0], statuses: ids.map((id, at) => ({ ...LADDER[0].statuses.find((s) => s.id === id)!, rank: at + 1 })) },
    LADDER[1],
  ];
  const REORDER = 'PATCH /kpm/settings/lead-statuses/reorder';
  const onAPhone = (px = 375, routes: Record<string, StubReply | StubReply[]> = {}) => {
    atWidth(px);
    const stub = stubFetch({ '/kpm/settings/lead-statuses': { body: LADDER }, [REORDER]: { body: LADDER[0] }, ...routes });
    const { container } = renderWithSession(<LeadStatusesPage />, { me: OWNER });
    return { ...stub, container };
  };
  /** What each reorder sent, in order. */
  const reorders = (calls: { url: string; init: RequestInit }[]) => calls
    .filter((c) => c.url.endsWith('/kpm/settings/lead-statuses/reorder') && c.init.method === 'PATCH')
    .map((c) => JSON.parse(String(c.init.body)));
  /** The stages in the order the ladder draws them. */
  const order = (container: HTMLElement) => [...container.querySelectorAll('ol > li')].map((li) => li.querySelector('p')!.firstChild!.textContent);
  const menuOf = (label: string) => screen.getByRole('button', { name: `Actions for ${label}` });
  const item = (name: string) => screen.getByRole('menuitem', { name });
  const items = () => screen.getAllByRole('menuitem').map((it) => it.textContent);
  const held = (name: string) => item(name).getAttribute('aria-disabled') === 'true';

  it.each([375, 767])('P18.97-T8 F3 at %ipx a stage’s ⋮ offers Move up and Move down first, held at the ends of the stages in view', async (px) => {
    onAPhone(px);
    await screen.findByText('Paid and issued');
    await userEvent.click(menuOf('Not yet approached'));
    expect(items()).toEqual(['Move up', 'Move down', 'Edit', 'Make this close the pipeline', 'Archive']);
    expect([held('Move up'), held('Move down')]).toEqual([true, false]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(menuOf('Follow-up'));
    expect([held('Move up'), held('Move down')]).toEqual([false, false]);
    await userEvent.keyboard('{Escape}');
    // Dormant is archived and out of view, so the stage that closes the pipeline is the last one there is to pass.
    await userEvent.click(menuOf('Paid and issued'));
    expect([held('Move up'), held('Move down')]).toEqual([false, true]);
    await userEvent.keyboard('{Escape}');

    // With the archived shown, Dormant is the end.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Dormant' }));
    expect([held('Move up'), held('Move down')]).toEqual([false, true]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(menuOf('Paid and issued'));
    expect([held('Move up'), held('Move down')]).toEqual([false, false]);
  });

  it('P18.97-T8 F3 Move down saves the whole pipeline, archived included, through the reorder call; the ladder is read again in its new order', async () => {
    const after = reordered(['s1', 's0', 's2', 's3']);
    const { calls, container } = onAPhone(375, {
      '/kpm/settings/lead-statuses': [{ body: LADDER }, { body: after }],
      [REORDER]: { body: after[0] },
    });
    await screen.findByText('Paid and issued');
    expect(order(container)).toEqual(['Not yet approached', 'Follow-up', 'Paid and issued']);
    await userEvent.click(menuOf('Not yet approached'));
    await userEvent.click(item('Move down'));
    await waitFor(() => expect(order(container)).toEqual(['Follow-up', 'Not yet approached', 'Paid and issued']));
    expect(reorders(calls)).toEqual([{ pipeline: 'sales', ids: ['s1', 's0', 's2', 's3'] }]);
  });

  it('P18.97-T8 F3 the moved stage’s ⋮ keeps the focus once its row has its new place, the menu closed', async () => {
    const after = reordered(['s1', 's0', 's2', 's3']);
    const { container } = onAPhone(375, { '/kpm/settings/lead-statuses': [{ body: LADDER }, { body: after }], [REORDER]: { body: after[0] } });
    await screen.findByText('Paid and issued');
    await userEvent.click(menuOf('Not yet approached'));
    await userEvent.click(item('Move down'));
    await waitFor(() => expect(order(container)[1]).toBe('Not yet approached'));
    await waitFor(() => expect(menuOf('Not yet approached')).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('P18.97-T8 F3 Move up sends what the ⠿’s ↑ key sends: the same endpoint, the same order', async () => {
    const { calls } = onAPhone(375);
    await screen.findByText('Paid and issued');
    fireEvent.keyDown(handleFor('Follow-up'), { key: 'ArrowUp' });
    await waitFor(() => expect(reorders(calls)).toHaveLength(1));
    // The ladder read again, and nothing held: the ⠿ is live once more.
    await waitFor(() => expect(handleFor('Follow-up')).toBeEnabled());
    await userEvent.click(menuOf('Follow-up'));
    await userEvent.click(item('Move up'));
    await waitFor(() => expect(reorders(calls)).toHaveLength(2));
    const [byHandle, byMenu] = reorders(calls);
    expect(byMenu).toEqual(byHandle);
    expect(byMenu).toEqual({ pipeline: 'sales', ids: ['s1', 's0', 's2', 's3'] });
  });

  it('P18.97-T8 F3 at an end Move up does nothing: no call, the menu open on it', async () => {
    const { calls } = onAPhone(375);
    await screen.findByText('Paid and issued');
    await userEvent.click(menuOf('Not yet approached'));
    await userEvent.click(item('Move up'));
    expect(reorders(calls)).toEqual([]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(item('Move up')).toHaveFocus();
  });

  it('P18.97-T8 F3 while a move is out both moves are held on every stage, as the row’s other actions are', async () => {
    let release!: () => void;
    const gate = new Promise<void>((open) => { release = open; });
    const { calls, mock } = onAPhone(375);
    const answer = mock.getMockImplementation()!;
    mock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/reorder')) await gate;
      return answer(url, init);
    });
    await screen.findByText('Paid and issued');
    await userEvent.click(menuOf('Follow-up'));
    await userEvent.click(item('Move down'));
    await userEvent.click(menuOf('Not yet approached'));
    expect([held('Move up'), held('Move down')]).toEqual([true, true]);
    await userEvent.click(item('Move down'));
    await userEvent.keyboard('{Escape}');
    release();
    await waitFor(() => expect(handleFor('Follow-up')).toBeEnabled());
    // The one move, and not the one asked while it was out.
    expect(reorders(calls)).toEqual([{ pipeline: 'sales', ids: ['s0', 's2', 's1', 's3'] }]);
  });
});
