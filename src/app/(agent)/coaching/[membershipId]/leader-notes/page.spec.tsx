import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import type { Me } from '@/lib/session';
import { atWidth, makeMe, renderInLayout, routeParams, stubFetch, wears, type StubReply } from '@test/harness';
import CoachingPersonLayout from '../layout';
import CoacheeLeaderNotesTab from './page';

const nav = vi.hoisted(() => ({ pathname: '/coaching/mem-rina/leader-notes', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
}));

const PERMISSIONS = [
  'coaching_session:read', 'coaching_profile:read', 'coaching_profile:update', 'leader_notes:read', 'leader_notes:write',
];
const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: PERMISSIONS,
});
const withPermissions = (permissions: string[]): Me => ({ ...LEADER, permissions });

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
};

const row = (code: string, label: string, displayOrder: number, status: 'active' | 'archived' = 'active') => ({
  code, label, displayOrder, status,
});
const stage = (code: string, label: string, n: number, required: string[], displayOrder = n) => ({
  ...row(code, label, displayOrder), stageOrder: n, requiredMilestoneCodes: required,
});

/** The company's defaults (`capability.ts`), in the prototype's words (`Overall.html:11192-11259`). */
const M1 = 'SELLS_INDEPENDENTLY';
const M2 = 'SELLS_OUTSIDE_NETWORK';
const M3 = 'RECRUITS_QUALITY';
const M4 = 'DEVELOPS_TO_INDEPENDENT';
const M5 = 'DEVELOPS_TO_PRODUCTIVE';
const STAGES = [
  stage('COMPETENT_PRODUCER', 'Competent Producer', 1, [M1]),
  stage('INDEPENDENT_PRODUCER', 'Independent Producer', 2, [M1, M2]),
  stage('PRODUCTIVE_TEAM_BUILDER', 'Productive Team Builder', 3, [M1, M2, M3, M4]),
  stage('TRANSFORMATIVE_TEAM_BUILDER', 'Transformative Team Builder', 4, [M1, M2, M3, M4, M5]),
];
const MILESTONES = [
  row(M1, 'Sells policies independently', 1),
  row(M2, 'Sells outside direct network', 2),
  row(M3, 'Recruits quality agents', 3),
  row(M4, 'Develops downline agent to Independent Producer', 4),
  row(M5, 'Develops downline leader to Productive Team Builder', 5),
];
const grid = (code: string, label: string, displayOrder: number, requiresDownline: boolean, items: string[][]) => ({
  ...row(code, label, displayOrder), requiresDownline,
  items: items.map(([c, l], i) => row(c, l, i + 1)),
});
const GRIDS = [
  grid('PERSONAL_SELLING', 'Personal selling', 1, false, [
    ['LEADS_GEN', 'Leads generation consistency'], ['APPROACH', 'Approach & appointment setting'],
    ['FACT_FINDING', 'Fact finding & needs ID'], ['PRODUCT_ADVISORY', 'Product advisory & knowledge'],
    ['PRESENTATION', 'Presentation'], ['OBJECTION_HANDLING', 'Objection handling & closing'], ['AFTER_SALES', 'After-sales service'],
  ]),
  grid('RECRUITMENT', 'Recruitment', 2, false, [
    ['CANDIDATE_LEADS_GEN', 'Candidate leads generation'], ['FILTERING', 'Filtering potential candidates'],
    ['RECRUIT_APPROACH', 'Approaching'], ['PROFILING', 'Profiling (motivation / hot button)'],
    ['PITCHING', 'Pitching the business opportunity'], ['RECRUIT_CLOSING', 'Closing recruitment & FLC accompaniment'],
  ]),
  grid('DEVELOPING_DOWNLINE_AGENT', 'Developing downline agent', 3, true, [
    ['AGENT_VISIBILITY', "Visibility into each agent's progress & goals"], ['AGENT_TRACKING', 'Consistent activity tracking & 1-on-1 check-ins'],
  ]),
  grid('DEVELOPING_DOWNLINE_LEADER', 'Developing downline leader', 4, true, [
    ['LEADER_VISIBILITY', "Visibility into each leader's & their team's progress"], ['LEADER_TIME', 'Allocating time for team building'],
  ]),
];
const CATALOG = { stages: STAGES, milestones: MILESTONES, grids: GRIDS };
/** The prototype's mock ticks for Rina (`Overall.html:11198`, `:11231-11239`): every selling skill but one. */
const SELLING = ['LEADS_GEN', 'APPROACH', 'FACT_FINDING', 'PRODUCT_ADVISORY', 'PRESENTATION', 'AFTER_SALES'];

const profile = (over: Record<string, unknown> = {}) => ({
  catalog: CATALOG, milestoneCodes: [M1, M2], skillCodes: SELLING, stageCode: 'INDEPENDENT_PRODUCER', version: 3,
  updatedAt: '2026-09-30T03:00:00.000Z', updatedBy: { membershipId: 'mem-agus', name: 'Agus Santoso' }, ...over,
});

const NOTES = {
  mine: { noteId: 'n-1', text: 'Strong closer — ready for a bigger book next quarter.', version: 2, updatedAt: '2026-09-30T03:00:00.000Z' },
  others: [{
    noteId: 'n-2', author: { membershipId: 'mem-wilson', name: 'Wilson Tanoto' },
    text: 'Keep an eye on her sales load.', updatedAt: '2026-09-29T03:00:00.000Z',
  }],
};

const refused = (status: number, code: string, message: string) => ({
  status, body: { error: { code, message, requestId: 'req-1' } },
});

/** A profile save that answers as the server does: the next version, and the stage it derived. */
const echoProfile = (stageCode: string | null = 'INDEPENDENT_PRODUCER'): StubReply => ({ body }) => ({
  body: { version: (body as { version: number }).version + 1, stageCode, updatedAt: '2026-10-02T03:00:00.000Z' },
});
const echoNote: StubReply = ({ body }) => ({
  body: { noteId: 'n-1', version: (body as { version: number }).version + 1, updatedAt: '2026-10-02T03:00:00.000Z' },
});

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me: Me = LEADER) => {
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    'GET /coaching/coachees/mem-rina': { body: RINA },
    'GET /coaching/coachees/mem-rina/profile': { body: profile() },
    'PUT /coaching/coachees/mem-rina/profile': echoProfile(),
    'GET /coaching/coachees/mem-rina/leader-notes': { body: NOTES },
    'PUT /coaching/coachees/mem-rina/leader-notes': echoNote,
    ...routes,
  });
  const view = renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeLeaderNotesTab /></CoachingPersonLayout>,
    { me },
  );
  return { ...stub, ...view };
};

const card = (name: string | RegExp) => screen.findByRole('region', { name });
const sent = (calls: { url: string; init: RequestInit }[], method: string, fragment: string) =>
  calls.filter((c) => (c.init.method ?? 'GET') === method && c.url.endsWith(fragment));
const bodyOf = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);
/** A toast says this, in the polite live region (`components-and-patterns.md`, *Toast*). */
const toastSays = async (message: string) => {
  const text = await screen.findByText(message);
  expect(text.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
};
/** The tag beside a card's title. */
const tagOf = (region: HTMLElement) => region.querySelector('h2')?.nextElementSibling;

/** The six words coaching's own strings never use (ADR-0084). */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

/** The tile's button, which opens the ladder (UI-035). */
const tileButton = () => screen.findByRole('button', { name: /^Capability mapping: / });
/** Open the ladder's sheet from the tile and answer it (UI-035). */
const openLadder = async () => {
  await userEvent.click(await tileButton());
  return screen.findByRole('dialog', { name: 'Capability mapping' });
};
const stagesIn = (sheet: HTMLElement) => within(sheet).getAllByRole('listitem');
const stepsOf = (tile: HTMLElement) => Array.from(tile.querySelectorAll('[data-progress-line] [data-step]')).map((s) => s.getAttribute('data-step'));

describe('the Capability mapping tab (P11-T9; UI V1, Phase 18.99 T10)', () => {
  beforeEach(() => {
    nav.pathname = '/coaching/mem-rina/leader-notes';
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('Capability mapping: the tile and its ladder (UI-035)', () => {
    it('UI-035 the tile shows only the current stage: the progress line, the stage, TAHAP SAAT INI — no criteria, no Current: pill', async () => {
      const { calls } = show();
      const tile = await card('Capability mapping');

      expect(stepsOf(tile)).toEqual(['done', 'current', 'next', 'next']);
      expect(within(tile).getByText('Independent Producer')).toBeInTheDocument();
      expect(within(tile).getByText('Current stage')).toHaveClass('uppercase');
      expect(within(tile).queryByRole('checkbox')).not.toBeInTheDocument();
      expect(tile.textContent).not.toMatch(/Current:/);
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(1);
    });

    it('UI-035 the whole tile is one button that opens the ladder in a sheet, and Escape closes it', async () => {
      show();
      const button = await tileButton();
      expect(button).toHaveAccessibleName('Capability mapping: Independent Producer. Show every stage.');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button.className).toContain('absolute inset-0');

      const sheet = await openLadder();
      expect(within(sheet).getByRole('heading', { name: 'Capability mapping' })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Capability mapping' })).not.toBeInTheDocument());
    });

    it('UI-035 each criterion appears once, under the stage that adds it; the current stage tinted with its pill', async () => {
      show();
      const sheet = await openLadder();

      const stages = stagesIn(sheet);
      expect(stages.map((s) => s.querySelector('[id]')?.textContent))
        .toEqual(['Competent Producer', 'Independent Producer', 'Productive Team Builder', 'Transformative Team Builder']);
      expect(stages.map((s) => within(s).queryAllByRole('checkbox').map((b) => b.getAttribute('aria-checked') ?? (b as HTMLInputElement).checked)))
        .toEqual([[true], [true], [false, false], [false]]);
      expect(within(sheet).getAllByRole('checkbox').map((b) => (b.closest('label') as HTMLElement).textContent)).toEqual([
        'Sells policies independently', 'Sells outside direct network', 'Recruits quality agents',
        'Develops downline agent to Independent Producer', 'Develops downline leader to Productive Team Builder',
      ]);
      expect(within(sheet).getAllByText('Current stage')).toHaveLength(1);
      expect(stages[1]).toHaveAttribute('data-current', 'true');
      expect(stages[1].firstElementChild!.className).toContain('bg-amber/10');
      expect(stages.map((s) => s.querySelector('[data-step]')?.getAttribute('data-step'))).toEqual(['done', 'current', 'next', 'next']);
    });

    it('UI-035 ticking a criterion in the sheet saves the whole set pinned, and the tile takes the stage the server answers', async () => {
      const { calls } = show({ 'PUT /coaching/coachees/mem-rina/profile': echoProfile('PRODUCTIVE_TEAM_BUILDER') });
      const sheet = await openLadder();

      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));

      expect(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' })).toBeChecked();
      await toastSays('Capability mapping updated.');
      const [put] = sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile');
      expect(bodyOf(put)).toEqual({ version: 3, milestoneCodes: [M1, M2, M3], skillCodes: SELLING });
      // Not worked out here: the server's answer, though one of the stage's milestones is still unticked.
      expect(within(stagesIn(sheet)[2]).getByText('Current stage')).toBeInTheDocument();
      const tile = await card('Capability mapping');
      expect(within(tile).getByText('Productive Team Builder')).toBeInTheDocument();
      expect(stepsOf(tile)).toEqual(['done', 'done', 'current', 'next']);

      // The next save carries the version this one answered.
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(2));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')[1])).toEqual({ version: 4, milestoneCodes: [M1, M2], skillCodes: SELLING });
    });

    it('P11-T9 AC-1 below the first stage the tile says Not yet at the most junior stage, by seniority not position, with no pill', async () => {
      // The office drew the ladder top rung first; the junior stage is still the one named.
      const reversed = STAGES.map((s) => ({ ...s, displayOrder: 5 - s.stageOrder }));
      show({ 'GET /coaching/coachees/mem-rina/profile': { body: profile({ catalog: { ...CATALOG, stages: reversed }, milestoneCodes: [], stageCode: null }) } });
      const tile = await card('Capability mapping');

      expect(within(tile).getByText('Not yet at Competent Producer')).toBeInTheDocument();
      expect(within(tile).queryByText('Current stage')).not.toBeInTheDocument();
      expect(stepsOf(tile)).toEqual(['next', 'next', 'next', 'next']);
      const sheet = await openLadder();
      const [first] = stagesIn(sheet);
      // Drawn first and numbered 1, the senior stage still adds only its own criterion.
      expect(first).toHaveTextContent(/^1Transformative Team Builder/);
      expect(within(first).getAllByRole('checkbox').map((b) => b.closest('label')!.textContent))
        .toEqual(['Develops downline leader to Productive Team Builder']);
    });

    it('P11-T9 AC-1 saves one at a time: a tick made while a save is out goes in the next, at the version that one answered', async () => {
      const { calls } = show();
      const sheet = await openLadder();

      fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));
      fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Develops downline leader to Productive Team Builder' }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(2));
      const [first, second] = sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile').map(bodyOf);
      expect(first).toEqual({ version: 3, milestoneCodes: [M1, M2, M3], skillCodes: SELLING });
      expect(second).toEqual({ version: 4, milestoneCodes: [M1, M2, M3, M5], skillCodes: SELLING });
    });

    it('P11-T9 AC-1 a save another coach moved past reads the profile again and says so in one line, in the sheet', async () => {
      const { calls } = show({
        'PUT /coaching/coachees/mem-rina/profile': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/coachees/mem-rina/profile': [
          { body: profile() },
          { body: profile({ version: 7, milestoneCodes: [M1, M2, M3, M4, M5], stageCode: 'TRANSFORMATIVE_TEAM_BUILDER' }) },
        ],
      });
      const sheet = await openLadder();

      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));

      expect(await within(sheet).findByText('The capability mapping was changed somewhere else, so it has been read again.')).toHaveAttribute('role', 'status');
      expect(within(await card('Capability mapping')).getByText('Transformative Team Builder')).toBeInTheDocument();
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(2);
      expect(screen.queryByText('Somebody saved first.')).not.toBeInTheDocument();
      expect(screen.queryByText('Capability mapping updated.')).not.toBeInTheDocument();
    });

    it('P11-T9 AC-1 sends nothing more for a tick undone and done again while a save is out, and says it once', async () => {
      const { calls } = show();
      const sheet = await openLadder();
      const quality = () => within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' });

      fireEvent.click(quality());
      fireEvent.click(quality());
      fireEvent.click(quality());

      await toastSays('Capability mapping updated.');
      expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(1);
    });

    it('shows a failed read after a conflict where the profile was', async () => {
      show({
        'PUT /coaching/coachees/mem-rina/profile': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/coachees/mem-rina/profile': [{ body: profile() }, refused(500, 'INTERNAL_ERROR', 'Something broke')],
      });
      const sheet = await openLadder();
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    });

    // An office started Empty had none until ADR-0116 (2026-10-08) gave it the platform ladder; kept for one made before.
    it('P13.2-T6 AC-8: says an empty catalog is empty on both cards, and the tile opens nothing', async () => {
      show({
        'GET /coaching/coachees/mem-rina/profile': {
          body: profile({ catalog: { ...CATALOG, stages: [], milestones: [], grids: [] }, milestoneCodes: [], skillCodes: [], stageCode: null }),
        },
      });
      const tile = await card('Capability mapping');
      expect(within(tile).getByText('Your office has not set up its capability stages yet.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Capability mapping: / })).not.toBeInTheDocument();
      expect(within(await card('Skill tracker')).getByText('Your office has not set up its skill grids yet.'))
        .toBeInTheDocument();
    });

    it('shows any other refused save in the sheet, and puts the boxes back as the server holds them', async () => {
      show({ 'PUT /coaching/coachees/mem-rina/profile': refused(400, 'VALIDATION_FAILED', 'A code the catalog does not hold.') });
      const sheet = await openLadder();

      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));

      expect(await within(sheet).findByRole('alert')).toHaveTextContent('A code the catalog does not hold.');
      expect(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' })).not.toBeChecked();
      expect(screen.queryByText('Capability mapping updated.')).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5: a tick says Saved ✓ beside its own box, and keeps its toast', async () => {
      show();
      const sheet = await openLadder();
      const box = within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' });
      await userEvent.click(box);

      const said = await within(sheet).findByText('Saved ✓');
      expect(said).toHaveAttribute('role', 'status');
      expect(box.closest('label')!.nextElementSibling).toBe(said);
      // Not in the label: the box's name stays its words.
      expect(box).toHaveAccessibleName('Recruits quality agents');
      expect(within(sheet).getAllByText('Saved ✓')).toHaveLength(1);
      await toastSays('Capability mapping updated.');
    });

    it('P18.95-T1 AC-5: a refused tick is put back and offers the retry, which ticks it again and saves it', async () => {
      const { calls } = show({
        'PUT /coaching/coachees/mem-rina/profile': [refused(500, 'INTERNAL_ERROR', 'Something went wrong.'), echoProfile()],
      });
      const tracker = await card('Skill tracker');
      await userEvent.click(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' }));
      const retry = await within(tracker).findByRole('button', { name: "Couldn't save — retry: Objection handling & closing" });
      expect(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' })).not.toBeChecked();

      await userEvent.click(retry);

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(2));
      const [first, second] = sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile').map(bodyOf);
      expect(second).toEqual(first);
      expect(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' })).toBeChecked();
      expect(await within(tracker).findByText('Saved ✓')).toBeInTheDocument();
    });

    it('P18.95-T1 AC-5: a save another coach moved past is read again, with nothing to retry', async () => {
      show({
        'PUT /coaching/coachees/mem-rina/profile': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/coachees/mem-rina/profile': [{ body: profile() }, { body: profile({ version: 4 }) }],
      });
      const sheet = await openLadder();
      await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Recruits quality agents' }));

      expect(await screen.findByText('The capability mapping was changed somewhere else, so it has been read again.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('locks every box for a reader who may read the profile and not tick it; the ladder still opens', async () => {
      show({}, withPermissions(PERMISSIONS.filter((p) => p !== 'coaching_profile:update')));
      within(await card('Skill tracker')).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
      const sheet = await openLadder();
      within(sheet).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
    });

    it('shows a failed profile read in its place, and the notes still read', async () => {
      show({ 'GET /coaching/coachees/mem-rina/profile': refused(500, 'INTERNAL_ERROR', 'Something broke') });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
      expect(await card('Personal notes')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Capability mapping' })).not.toBeInTheDocument();
    });

    it('UI-071 shows skeletons shaped like the tile, the tracker and the note while they are read', async () => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const { mock } = show();
      // Hold the tab's two reads until the skeletons have been seen; the person read goes through.
      const answer = mock.getMockImplementation()!;
      mock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (/\/(profile|leader-notes)$/.test(url)) await held;
        return answer(url, init);
      });

      expect(await screen.findByText('Loading the capability mapping…')).toBeInTheDocument();
      expect(screen.getByText('Loading the personal notes…')).toBeInTheDocument();
      release();
      expect(await card('Capability mapping')).toBeInTheDocument();
      expect(screen.queryByText('Loading the capability mapping…')).not.toBeInTheDocument();
    });
  });

  describe('Skill tracker (UI-036, UI-037)', () => {
    it('UI-036 is titled Skill tracker; from 1024px the sections that apply are open columns with their counts', async () => {
      show();
      const tracker = await card('Skill tracker');
      expect(tracker).toHaveAttribute('data-layout', 'columns');

      const sections = within(tracker).getAllByRole('group');
      expect(sections.map((s) => s.querySelector('h3')?.textContent))
        .toEqual(['Personal selling6/7', 'Recruitment0/6']);
      const leads = within(tracker).getByRole('checkbox', { name: 'Leads generation consistency' });
      expect(leads).toBeChecked();
      expect(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' })).not.toBeChecked();
      expect(within(sections[1]).getAllByRole('checkbox')).toHaveLength(6);
      expect(screen.queryByText('Pelacak skill')).not.toBeInTheDocument();
    });

    it('UI-036 from 1024px a section that does not apply is one row with its reason, in her pronoun', async () => {
      show();
      const tracker = await card('Skill tracker');
      const rows = Array.from(tracker.querySelectorAll('p[data-section]'));
      expect(rows.map((r) => r.textContent)).toEqual([
        'Developing downline agentNot applicable — she has no agents under her yet.',
        'Developing downline leaderNot applicable — she has no downline leaders yet.',
      ]);
      expect(rows[0].lastElementChild).toHaveClass('italic');
      expect(within(tracker).queryByRole('checkbox', { name: "Visibility into each agent's progress & goals" })).not.toBeInTheDocument();
    });

    it('P11-T9 AC-2 ticks a skill by its code and saves the whole set, with no toast', async () => {
      const { calls } = show();
      const tracker = await card('Skill tracker');

      await userEvent.click(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')[0]))
        .toEqual({ version: 3, milestoneCodes: [M1, M2], skillCodes: [...SELLING, 'OBJECTION_HANDLING'] });
      expect(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' })).toBeChecked();
      expect(screen.queryByText('Capability mapping updated.')).not.toBeInTheDocument();
    });

    it('P11-T9 AC-2 opens the agent section once somebody is below, and says they have no downline leaders yet, in their pronoun', async () => {
      show({ 'GET /coaching/coachees/mem-rina': { body: { ...RINA, pronoun: 'they', downline: { members: 2, leaders: 0 } } } });
      const tracker = await card('Skill tracker');
      const agents = within(tracker).getByRole('group', { name: 'Developing downline agent' });
      within(agents).getAllByRole('checkbox').forEach((box) => expect(box).toBeEnabled());
      expect(tracker.querySelector('p[data-section="DEVELOPING_DOWNLINE_LEADER"]'))
        .toHaveTextContent('Not applicable — they have no downline leaders yet.');
    });

    it('P11-T9 AC-2 opens both for a leader of leaders, with no note', async () => {
      show({ 'GET /coaching/coachees/mem-rina': { body: { ...RINA, pronoun: 'he', downline: { members: 6, leaders: 1 } } } });
      const tracker = await card('Skill tracker');
      expect(within(tracker).queryByText(/Not applicable/)).not.toBeInTheDocument();
      expect(within(tracker).getAllByRole('group')).toHaveLength(4);
      within(tracker).getAllByRole('checkbox').forEach((box) => expect(box).toBeEnabled());
    });

    describe('below 1024px: the accordion', () => {
      it('UI-036 each section a 44px row with its count, only the first incomplete one open', async () => {
        atWidth(375);
        show();
        const tracker = await card('Skill tracker');
        expect(tracker).toHaveAttribute('data-layout', 'accordion');

        const heads = within(tracker).getAllByRole('button', { expanded: undefined }).filter((b) => b.hasAttribute('aria-expanded'));
        expect(heads.map((b) => [b.textContent, b.getAttribute('aria-expanded')])).toEqual([
          ['Personal selling6/7', 'true'], ['Recruitment0/6', 'false'],
          ['Developing downline agentNot applicable', 'false'], ['Developing downline leaderNot applicable', 'false'],
        ]);
        heads.forEach((b) => expect(b).toHaveClass('min-h-11'));
        expect(within(tracker).getAllByRole('checkbox')).toHaveLength(7);

        await userEvent.click(heads[1]);
        expect(heads[1]).toHaveAttribute('aria-expanded', 'true');
        expect(within(tracker).getAllByRole('checkbox')).toHaveLength(13);
        await userEvent.click(heads[0]);
        expect(within(tracker).getAllByRole('checkbox')).toHaveLength(6);
      });

      it('UI-036 opens the first section still incomplete — Recruitment once selling is done', async () => {
        atWidth(768);
        show({
          'GET /coaching/coachees/mem-rina/profile': {
            body: profile({ skillCodes: [...SELLING, 'OBJECTION_HANDLING'] }),
          },
        });
        const tracker = await card('Skill tracker');
        expect(within(tracker).getByRole('button', { name: /^Personal selling/ })).toHaveAttribute('aria-expanded', 'false');
        expect(within(tracker).getByRole('button', { name: /^Recruitment/ })).toHaveAttribute('aria-expanded', 'true');
      });

      it('UI-036 a section that does not apply stays a grey row with Tidak berlaku, and opens onto its reason and the greyed list', async () => {
        atWidth(375);
        show();
        const tracker = await card('Skill tracker');
        const agentsRow = within(tracker).getByRole('button', { name: /^Developing downline agent/ });
        expect(within(agentsRow).getByText('Not applicable')).toHaveAttribute('data-tone', 'grey');
        expect(agentsRow).toHaveClass('text-signal-grey');

        await userEvent.click(agentsRow);
        const agents = within(tracker).getByRole('group', { name: 'Developing downline agent' });
        expect(within(agents).getByText('Not applicable — she has no agents under her yet.')).toBeInTheDocument();
        within(agents).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
        expect(within(agents).getAllByRole('checkbox')[0].closest('label')).toHaveClass('text-signal-grey');
      });
    });

    it('UI-037 every tick row is at least 44px below 1024px with a 22px box, 32px and 18px from 1024px; the label toggles it', async () => {
      atWidth(375);
      const { calls } = show();
      const tracker = await card('Skill tracker');
      const box = within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' });
      const row = box.closest('[data-tick-row]')!;
      const label = box.closest('label')!;
      for (const px of [375, 768]) {
        expect(wears(row, px)).toContain('min-h-11');
        expect(wears(label, px)).toContain('min-h-11');
        expect(wears(box, px)).toMatch(/h-\[22px\] w-\[22px\]/);
      }
      expect(wears(label, 1280)).toContain('min-h-8');
      expect(wears(box, 1280)).toMatch(/h-\[18px\] w-\[18px\]/);

      await userEvent.click(within(label).getByText('Objection handling & closing'));
      expect(box).toBeChecked();
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(1));
    });
  });

  describe('what the office has archived', () => {
    const archived = () => profile({
      catalog: {
        ...CATALOG,
        milestones: MILESTONES.map((m) => (m.code === M2 ? { ...m, status: 'archived' } : m)),
        grids: [
          {
            ...GRIDS[0],
            items: [
              ...GRIDS[0].items,
              row('COLD_CALLING', 'Cold calling', 8, 'archived'),
              row('DOOR_TO_DOOR', 'Door to door', 9, 'archived'),
            ],
          },
          GRIDS[1], GRIDS[2],
          { ...GRIDS[3], status: 'archived' },
          { ...grid('MENTORING', 'Mentoring', 5, false, [['MENTOR', 'Mentoring a peer']]), status: 'archived' },
        ],
      },
      skillCodes: [...SELLING, 'COLD_CALLING', 'LEADER_TIME'],
    });
    const LEADER_OF_LEADERS = { 'GET /coaching/coachees/mem-rina': { body: { ...RINA, downline: { members: 6, leaders: 1 } } } };

    it('P11-T9 AC-3 still draws what a profile ticked and the office archived, marked and locked; what it never ticked is not drawn', async () => {
      show({ ...LEADER_OF_LEADERS, 'GET /coaching/coachees/mem-rina/profile': { body: archived() } });
      const tracker = await card('Skill tracker');

      const cold = within(tracker).getByRole('checkbox', { name: 'Cold calling Archived' });
      expect(cold).toBeChecked();
      expect(cold).toBeDisabled();
      expect(within(tracker).queryByText('Door to door')).not.toBeInTheDocument();
      // A section archived is drawn while it holds a tick, locked; one holding none is not.
      const leaders = within(tracker).getByRole('group', { name: 'Developing downline leader Archived' });
      expect(within(leaders).getByRole('checkbox', { name: 'Allocating time for team building' })).toBeChecked();
      expect(within(leaders).getByRole('checkbox', { name: 'Allocating time for team building' })).toBeDisabled();
      expect(within(tracker).queryByText('Mentoring')).not.toBeInTheDocument();
      // A milestone archived and ticked: once, in the stage that adds it, locked.
      const sheet = await openLadder();
      const outside = within(sheet).getAllByRole('checkbox', { name: 'Sells outside direct network Archived' });
      expect(outside).toHaveLength(1);
      expect(outside[0]).toBeChecked();
      expect(outside[0]).toBeDisabled();
    });

    it('P11-T9 AC-3 keeps an archived tick in the save: nothing is dropped behind the reader’s back', async () => {
      const { calls } = show({ 'GET /coaching/coachees/mem-rina/profile': { body: archived() } });
      const tracker = await card('Skill tracker');

      await userEvent.click(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(1));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')[0]).skillCodes)
        .toEqual([...SELLING, 'COLD_CALLING', 'LEADER_TIME', 'OBJECTION_HANDLING']);
    });

    it('P11-T9 AC-3 an item archived since it was read is refused: read again, with the server’s words', async () => {
      const { calls } = show({
        'PUT /coaching/coachees/mem-rina/profile': refused(422, 'CONFIG_ARCHIVED', 'That item is no longer offered.'),
        'GET /coaching/coachees/mem-rina/profile': [{ body: profile() }, { body: archived() }],
      });
      const tracker = await card('Skill tracker');

      await userEvent.click(within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('That item is no longer offered.');
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(2);
      expect(await screen.findByRole('checkbox', { name: 'Cold calling Archived' })).toBeChecked();
    });
  });

  describe('Personal notes (UI-038, UI-039, UI-040)', () => {
    it('UI-038 the privacy line is an ⓘ after the Capability mapping title, and no longer on the note’s card', async () => {
      show();
      const tile = await card('Capability mapping');
      const info = within(tile).getByRole('button', { name: 'Leader-only, never shown to Rina Wijaya' });
      expect(info.closest('span')!.className).toContain('z-[1]');
      const notes = await card('Personal notes');
      expect(notes.textContent).not.toMatch(/Leader-only/);
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveValue(NOTES.mine.text);
      expect(within(notes).getByRole('button', { name: 'Save notes' })).toBeEnabled();
    });

    it('UI-039 typing says Not saved yet; saving says Saved ✓; undoing the change says Saved ✓ again', async () => {
      show();
      const notes = await card('Personal notes');
      const state = () => notes.querySelector('[data-state]')!;
      expect(state()).toHaveTextContent('Saved ✓');

      const box = within(notes).getByRole('textbox', { name: 'Personal notes' });
      await userEvent.type(box, '!');
      expect(state()).toHaveTextContent('Not saved yet');
      expect(state()).toHaveAttribute('data-state', 'unsaved');
      await userEvent.type(box, '{Backspace}');
      expect(state()).toHaveAttribute('data-state', 'saved');

      await userEvent.type(box, ' Watch for burnout.');
      await userEvent.click(within(notes).getByRole('button', { name: 'Save notes' }));
      await waitFor(() => expect(state()).toHaveAttribute('data-state', 'saved'));
      expect(state()).toHaveTextContent('Saved ✓');
    });

    it('UI-039 leaving with unsaved words asks first; staying keeps them', async () => {
      show();
      const notes = await card('Personal notes');
      await userEvent.type(within(notes).getByRole('textbox', { name: 'Personal notes' }), ' More.');
      const away = within(screen.getByRole('navigation', { name: 'Coaching' })).getAllByRole('link')
        .find((a) => !a.getAttribute('href')?.endsWith('/leader-notes'))!;
      await userEvent.click(away);
      const ask = await screen.findByRole('dialog');
      expect(ask).toHaveTextContent('You have changes that are not saved yet. Leave anyway?');
      await userEvent.click(within(ask).getByRole('button', { name: 'Stay' }));
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveValue(`${NOTES.mine.text} More.`);
    });

    it('UI-039 a reader with no note yet sees no Saved ✓ until they write one', async () => {
      show({ 'GET /coaching/coachees/mem-rina/leader-notes': { body: { mine: null, others: [] } } });
      const notes = await card('Personal notes');
      expect(notes.querySelector('[data-state]')).toBeNull();
      await userEvent.type(within(notes).getByRole('textbox', { name: 'Personal notes' }), 'First.');
      expect(notes.querySelector('[data-state]')).toHaveTextContent('Not saved yet');
    });

    it('UI-040 from 1024px two columns: the tile and the tracker left, the note right, 360px and sticky; the note last below', async () => {
      show();
      const notes = await card('Personal notes');
      const column = notes.closest('[data-note-column]')!;
      const grid = column.parentElement!;
      expect(wears(grid, 1280)).toContain('grid-cols-[minmax(0,1fr)_360px]');
      expect(wears(grid, 1024).split(' ')).toContain('grid');
      expect(wears(column, 1280).split(' ')).toContain('sticky');
      expect(wears(grid, 768)).not.toContain('grid-cols');
      expect(wears(within(notes).getByRole('textbox'), 1280)).toContain('min-h-[180px]');
      // The note comes after the tracker in the page, so below 1024px it is last.
      expect(column.previousElementSibling!.contains(screen.getByRole('region', { name: 'Skill tracker' }))).toBe(true);
    });

    it('P11-T9 AC-4 saves on Save notes and nothing else, pinned to the version it read, and toasts Personal notes saved.', async () => {
      const { calls } = show();
      const box = within(await card('Personal notes')).getByRole('textbox', { name: 'Personal notes' });

      await userEvent.type(box, ' Watch for burnout.');
      await userEvent.tab();
      // No autosave: typing and leaving the box write nothing.
      expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/leader-notes')).toHaveLength(0);

      await userEvent.click(screen.getByRole('button', { name: 'Save notes' }));
      await toastSays('Personal notes saved.');
      const text = `${NOTES.mine.text} Watch for burnout.`;
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/leader-notes')[0])).toEqual({ version: 2, text });

      await userEvent.click(screen.getByRole('button', { name: 'Save notes' }));
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/leader-notes')).toHaveLength(2));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/leader-notes')[1])).toEqual({ version: 3, text });
    });

    it('P11-T9 AC-4 writes a first note at version 0, and a blank one is allowed', async () => {
      const { calls } = show({ 'GET /coaching/coachees/mem-rina/leader-notes': { body: { mine: null, others: [] } } });
      const notes = await card('Personal notes');
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveValue('');
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveAttribute('maxLength', '4000');

      await userEvent.click(within(notes).getByRole('button', { name: 'Save notes' }));

      await toastSays('Personal notes saved.');
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/leader-notes')[0])).toEqual({ version: 0, text: '' });
    });

    it('P11-T9 AC-4 shows each note somebody below wrote, read-only, in the prototype’s card tagged From {author}', async () => {
      show();
      const theirs = await card('Personal notes from Wilson Tanoto');

      expect(tagOf(theirs)).toHaveTextContent(/^From Wilson Tanoto$/);
      expect(within(theirs).getByText('Keep an eye on her sales load.')).toBeInTheDocument();
      expect(within(theirs).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(theirs).queryByRole('button')).not.toBeInTheDocument();
    });

    it('a stale save reads the notes again and says so in one line', async () => {
      const { calls } = show({
        'PUT /coaching/coachees/mem-rina/leader-notes': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/coachees/mem-rina/leader-notes': [
          { body: NOTES },
          { body: { ...NOTES, mine: { ...NOTES.mine, text: 'Saved on the other device', version: 5 } } },
        ],
      });
      const notes = await card('Personal notes');
      await userEvent.click(within(notes).getByRole('button', { name: 'Save notes' }));

      expect(await within(notes).findByText('Your notes were changed somewhere else, so they have been read again.')).toHaveAttribute('role', 'status');
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveValue('Saved on the other device');
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/leader-notes')).toHaveLength(2);
      expect(screen.queryByText('Personal notes saved.')).not.toBeInTheDocument();
    });

    it('shows a failed read after a stale save in the notes’ place', async () => {
      show({
        'PUT /coaching/coachees/mem-rina/leader-notes': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/coachees/mem-rina/leader-notes': [{ body: NOTES }, refused(500, 'INTERNAL_ERROR', 'Something broke')],
      });
      await userEvent.click(within(await card('Personal notes')).getByRole('button', { name: 'Save notes' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
      expect(screen.queryByRole('textbox', { name: 'Personal notes' })).not.toBeInTheDocument();
    });

    it('shows any other refused save in the card, keeping what was typed', async () => {
      show({ 'PUT /coaching/coachees/mem-rina/leader-notes': refused(400, 'VALIDATION_FAILED', 'At most 4000 characters.') });
      const notes = await card('Personal notes');
      await userEvent.type(within(notes).getByRole('textbox', { name: 'Personal notes' }), '!');
      await userEvent.click(within(notes).getByRole('button', { name: 'Save notes' }));

      expect(await within(notes).findByRole('alert')).toHaveTextContent('At most 4000 characters.');
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveValue(`${NOTES.mine.text}!`);
      expect(notes.querySelector('[data-state]')).toHaveAttribute('data-state', 'unsaved');
    });

    it('a reader who may read and not write sees the note, read-only, and no Save notes', async () => {
      show({}, withPermissions(PERMISSIONS.filter((p) => p !== 'leader_notes:write')));
      const notes = await card('Personal notes');
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveAttribute('readonly');
      expect(within(notes).queryByRole('button', { name: 'Save notes' })).not.toBeInTheDocument();
    });

    it('shows a failed notes read in the notes’ place alone', async () => {
      show({ 'GET /coaching/coachees/mem-rina/leader-notes': refused(500, 'INTERNAL_ERROR', 'Something broke') });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
      expect(await card('Capability mapping')).toBeInTheDocument();
    });
  });

  describe('out of reach', () => {
    it('P11-T9 AC-5 a 404 on the notes is the shell’s not-found, with nothing of the person’s left on screen', async () => {
      show({ 'GET /coaching/coachees/mem-rina/leader-notes': refused(404, 'NOT_FOUND', 'Not found') });
      expect(await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Coaching' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Capability mapping' })).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/Rina Wijaya|NOT_FOUND/);
    });

    it('a 404 on the profile is the shell’s not-found too', async () => {
      show({ 'GET /coaching/coachees/mem-rina/profile': refused(404, 'NOT_FOUND', 'Not found') });
      expect(await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' })).toBeInTheDocument();
    });

    it('a 404 on a save is the shell’s not-found: the person moved out of reach while the tab was open', async () => {
      show({
        'PUT /coaching/coachees/mem-rina/profile': refused(404, 'NOT_FOUND', 'Not found'),
        'PUT /coaching/coachees/mem-rina/leader-notes': refused(404, 'NOT_FOUND', 'Not found'),
      });
      await userEvent.click(within(await card('Skill tracker')).getByRole('checkbox', { name: 'Presentation' }));
      expect(await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' })).toBeInTheDocument();
    });

    it('a 404 on a note save is the shell’s not-found', async () => {
      show({ 'PUT /coaching/coachees/mem-rina/leader-notes': refused(404, 'NOT_FOUND', 'Not found') });
      await userEvent.click(within(await card('Personal notes')).getByRole('button', { name: 'Save notes' }));
      expect(await screen.findByRole('heading', { name: 'This person isn’t someone you coach.' })).toBeInTheDocument();
    });

    it('is refused, reading nothing, to a reader without the profile’s permission', async () => {
      const { calls } = show({}, withPermissions(['coaching_session:read']));
      expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'coaching_profile:read');
      expect(calls.some((c) => c.url.includes('/profile') || c.url.includes('/leader-notes'))).toBe(false);
    });
  });

  describe('who sees a note (P11-T9 AC-5)', () => {
    it('P11-T9 AC-5 leaving the tab drops what it read: coming back reads both again, nothing was cached', async () => {
      const { calls, unmount } = show();
      await card('Personal notes from Wilson Tanoto');
      expect(screen.getByDisplayValue(NOTES.mine.text)).toBeInTheDocument();

      unmount();
      expect(document.body.textContent).not.toMatch(/Strong closer|Keep an eye|Independent Producer|Leader-only/);
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(1);

      const again = show();
      await card('Personal notes from Wilson Tanoto');
      expect(sent(again.calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(1);
      expect(sent(again.calls, 'GET', '/coaching/coachees/mem-rina/leader-notes')).toHaveLength(1);
    });

    it('P11-T9 AC-5 and AC-9 asks for no note and offers no Save notes in a support session, where neither note permission is the reader’s', async () => {
      const { calls } = show({}, withPermissions(PERMISSIONS.filter((p) => !p.startsWith('leader_notes:'))));
      await card('Capability mapping');
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/leader-notes')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Save notes' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /Personal notes/ })).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/Strong closer|Keep an eye/);
    });
  });

  it('UI-038 no text below 12px on the tab: no 10px or 11px class anywhere in it', async () => {
    show();
    await card('Personal notes from Wilson Tanoto');
    const sheet = await openLadder();
    for (const root of [screen.getByRole('main'), sheet]) {
      const classes = Array.from(root.querySelectorAll('[class]')).map((el) => el.getAttribute('class')).join(' ');
      expect(classes).not.toMatch(/text-\[(10|11)px\]|text-\[0\.6/);
    }
  });

  it('P11-T9 writes none of ADR-0084’s six words, no phase, and no code', async () => {
    show();
    await card('Personal notes from Wilson Tanoto');
    await card('Capability mapping');
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(SIX_WORDS);
    expect(main.textContent).not.toMatch(/\bphase\b/i);
    expect(main.textContent).not.toMatch(/mem-rina|INDEPENDENT_PRODUCER|SELLS_|LEADS_GEN|coaching_profile|leader_notes/);
  });
});
