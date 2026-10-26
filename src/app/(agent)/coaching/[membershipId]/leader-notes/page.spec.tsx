import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import type { Me } from '@/lib/session';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
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

describe('the Leader Notes tab (P11-T9)', () => {
  beforeEach(() => {
    nav.pathname = '/coaching/mem-rina/leader-notes';
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('Capability mapping', () => {
    it('P11-T9 AC-1 draws the ladder in display order, numbered, each stage with its milestones, tagged with the server’s stage', async () => {
      const { calls } = show();
      const mapping = await card('Capability mapping');

      expect(tagOf(mapping)).toHaveTextContent(/^Current: Independent Producer$/);
      const stages = within(mapping).getAllByRole('listitem');
      expect(stages.map((s) => s.querySelector('[aria-hidden="true"]')?.textContent)).toEqual(['1', '2', '3', '4']);
      expect(within(mapping).getAllByRole('group').map((g) => g.getAttribute('aria-labelledby') && g.previousElementSibling?.textContent))
        .toEqual(['Competent Producer', 'Independent Producer', 'Productive Team Builder', 'Transformative Team Builder']);
      // The highlighted stage is the server's, with the prototype's badge on it alone.
      expect(within(mapping).getAllByText('Current stage')).toHaveLength(1);
      expect(within(stages[1]).getByText('Current stage')).toBeInTheDocument();
      expect(stages[1].className).toContain('border-amber');
      expect(stages[0].className).not.toContain('border-amber');

      // Ticked by code: a milestone is one tick, in every stage that lists it.
      const independently = within(mapping).getAllByRole('checkbox', { name: 'Sells policies independently' });
      expect(independently).toHaveLength(4);
      independently.forEach((box) => expect(box).toBeChecked());
      expect(within(mapping).getAllByRole('checkbox', { name: 'Sells outside direct network' })).toHaveLength(3);
      const quality = within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' });
      expect(quality).toHaveLength(2);
      quality.forEach((box) => expect(box).not.toBeChecked());
      expect(within(stages[3]).getAllByRole('checkbox')).toHaveLength(5);
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(1);
    });

    it('P11-T9 AC-1 ticks a milestone in every stage that lists it, saves the whole set pinned, and shows the stage the server answers', async () => {
      const { calls } = show({ 'PUT /coaching/coachees/mem-rina/profile': echoProfile('PRODUCTIVE_TEAM_BUILDER') });
      const mapping = await card('Capability mapping');

      await userEvent.click(within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0]);

      within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' }).forEach((box) => expect(box).toBeChecked());
      await toastSays('Capability mapping updated.');
      const [put] = sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile');
      expect(bodyOf(put)).toEqual({ version: 3, milestoneCodes: [M1, M2, M3], skillCodes: SELLING });
      // Not worked out here: the server's answer, though one of the stage's milestones is still unticked.
      expect(tagOf(mapping)).toHaveTextContent(/^Current: Productive Team Builder$/);
      expect(within(within(mapping).getAllByRole('listitem')[2]).getByText('Current stage')).toBeInTheDocument();

      // The next save carries the version this one answered.
      await userEvent.click(within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[1]);
      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(2));
      expect(bodyOf(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')[1])).toEqual({ version: 4, milestoneCodes: [M1, M2], skillCodes: SELLING });
    });

    it('P11-T9 AC-1 tags Not yet at the most junior stage, by seniority not position, with no Current stage below the first', async () => {
      // The office drew the ladder top rung first; the junior stage is still the one named.
      const reversed = STAGES.map((s) => ({ ...s, displayOrder: 5 - s.stageOrder }));
      show({ 'GET /coaching/coachees/mem-rina/profile': { body: profile({ catalog: { ...CATALOG, stages: reversed }, milestoneCodes: [], stageCode: null }) } });
      const mapping = await card('Capability mapping');

      expect(tagOf(mapping)).toHaveTextContent(/^Not yet at Competent Producer$/);
      expect(within(mapping).queryByText('Current stage')).not.toBeInTheDocument();
      expect(within(mapping).getAllByRole('listitem')[0]).toHaveTextContent(/^1Transformative Team Builder/);
    });

    it('P11-T9 AC-1 saves one at a time: a tick made while a save is out goes in the next, at the version that one answered', async () => {
      const { calls } = show();
      const mapping = await card('Capability mapping');

      fireEvent.click(within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0]);
      fireEvent.click(within(mapping).getByRole('checkbox', { name: 'Develops downline leader to Productive Team Builder' }));

      await waitFor(() => expect(sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile')).toHaveLength(2));
      const [first, second] = sent(calls, 'PUT', '/coaching/coachees/mem-rina/profile').map(bodyOf);
      expect(first).toEqual({ version: 3, milestoneCodes: [M1, M2, M3], skillCodes: SELLING });
      expect(second).toEqual({ version: 4, milestoneCodes: [M1, M2, M3, M5], skillCodes: SELLING });
    });

    it('P11-T9 AC-1 a save another coach moved past reads the profile again and says so in one line', async () => {
      const { calls } = show({
        'PUT /coaching/coachees/mem-rina/profile': refused(409, 'VERSION_CONFLICT', 'Somebody saved first.'),
        'GET /coaching/coachees/mem-rina/profile': [
          { body: profile() },
          { body: profile({ version: 7, milestoneCodes: [M1, M2, M3, M4, M5], stageCode: 'TRANSFORMATIVE_TEAM_BUILDER' }) },
        ],
      });
      const mapping = await card('Capability mapping');

      await userEvent.click(within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0]);

      expect(await screen.findByText('The capability mapping was changed somewhere else, so it has been read again.')).toHaveAttribute('role', 'status');
      const fresh = await card('Capability mapping');
      expect(tagOf(fresh)).toHaveTextContent(/^Current: Transformative Team Builder$/);
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(2);
      expect(screen.queryByText('Somebody saved first.')).not.toBeInTheDocument();
      expect(screen.queryByText('Capability mapping updated.')).not.toBeInTheDocument();
    });

    it('P11-T9 AC-1 sends nothing more for a tick undone and done again while a save is out, and says it once', async () => {
      const { calls } = show();
      const mapping = await card('Capability mapping');
      const quality = () => within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0];

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
      await userEvent.click(within(await card('Capability mapping')).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0]);
      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    });

    it('draws no tag for a ladder with no stage to name', async () => {
      show({ 'GET /coaching/coachees/mem-rina/profile': { body: profile({ catalog: { ...CATALOG, stages: [] }, stageCode: null }) } });
      const mapping = await card('Capability mapping');
      expect(tagOf(mapping)).toBeNull();
      expect(within(mapping).queryAllByRole('listitem')).toHaveLength(0);
    });

    // An office started Empty had one until ADR-0116 (2026-10-08) gave it the platform ladder; kept for one made before.
    it('P13.2-T6 AC-8: says an empty catalog is empty on both cards', async () => {
      show({
        'GET /coaching/coachees/mem-rina/profile': {
          body: profile({ catalog: { ...CATALOG, stages: [], milestones: [], grids: [] }, milestoneCodes: [], skillCodes: [], stageCode: null }),
        },
      });
      expect(within(await card('Capability mapping')).getByText('Your office has not set up its capability stages yet.'))
        .toBeInTheDocument();
      expect(within(await card('Skill tracker')).getByText('Your office has not set up its skill grids yet.'))
        .toBeInTheDocument();
    });

    it('shows any other refused save above the cards, and puts the boxes back as the server holds them', async () => {
      show({ 'PUT /coaching/coachees/mem-rina/profile': refused(400, 'VALIDATION_FAILED', 'A code the catalog does not hold.') });
      const mapping = await card('Capability mapping');

      await userEvent.click(within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0]);

      expect(await screen.findByRole('alert')).toHaveTextContent('A code the catalog does not hold.');
      within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' }).forEach((box) => expect(box).not.toBeChecked());
      expect(screen.queryByText('Capability mapping updated.')).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5: a tick says Saved ✓ under its own box, in the stage it was ticked in, and keeps its toast', async () => {
      show();
      const mapping = await card('Capability mapping');
      const box = within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0];
      await userEvent.click(box);

      const said = await within(mapping).findByText('Saved ✓');
      expect(said).toHaveAttribute('role', 'status');
      expect(box.closest('label')!.nextElementSibling).toBe(said);
      // Not in the label: the box's name stays its words.
      expect(box).toHaveAccessibleName('Recruits quality agents');
      expect(within(mapping).getAllByText('Saved ✓')).toHaveLength(1);
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
      const mapping = await card('Capability mapping');
      await userEvent.click(within(mapping).getAllByRole('checkbox', { name: 'Recruits quality agents' })[0]);

      expect(await screen.findByText('The capability mapping was changed somewhere else, so it has been read again.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('locks every box for a reader who may read the profile and not tick it', async () => {
      show({}, withPermissions(PERMISSIONS.filter((p) => p !== 'coaching_profile:update')));
      const mapping = await card('Capability mapping');
      within(mapping).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
      within(await card('Skill tracker')).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
    });

    it('shows a failed profile read in its place, and the notes still read', async () => {
      show({ 'GET /coaching/coachees/mem-rina/profile': refused(500, 'INTERNAL_ERROR', 'Something broke') });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
      expect(await card('Personal notes')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Capability mapping' })).not.toBeInTheDocument();
    });

    it('shows a skeleton while the profile and the notes are read', async () => {
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

  describe('Skill tracker', () => {
    it('P11-T9 AC-2 draws the four sections in the prototype’s words, its items by code, a ticked one bold', async () => {
      show();
      const tracker = await card('Skill tracker');

      const sections = within(tracker).getAllByRole('group');
      expect(sections.map((s) => s.firstElementChild?.textContent))
        .toEqual(['Personal selling', 'Recruitment', 'Developing downline agent', 'Developing downline leader']);
      const leads = within(tracker).getByRole('checkbox', { name: 'Leads generation consistency' });
      expect(leads).toBeChecked();
      expect(leads.closest('label')!.className).toContain('font-semibold');
      const objection = within(tracker).getByRole('checkbox', { name: 'Objection handling & closing' });
      expect(objection).not.toBeChecked();
      expect(objection.closest('label')!.className).not.toContain('font-semibold');
      expect(within(sections[1]).getAllByRole('checkbox')).toHaveLength(6);
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

    it('P11-T9 AC-2 disables both downline sections for somebody with nobody below, in her pronoun', async () => {
      show();
      const tracker = await card('Skill tracker');
      const [, , agents, leaders] = within(tracker).getAllByRole('group');

      expect(agents).toHaveAccessibleDescription('Not applicable — she has no agents under her yet.');
      expect(leaders).toHaveAccessibleDescription('Not applicable — she has no downline leaders yet.');
      within(agents).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
      within(leaders).getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled());
      expect(agents.firstElementChild!.className).toContain('text-muted/50');
    });

    it('P11-T9 AC-2 opens the agent section once somebody is below, and says they have no downline leaders yet, in their pronoun', async () => {
      show({ 'GET /coaching/coachees/mem-rina': { body: { ...RINA, pronoun: 'they', downline: { members: 2, leaders: 0 } } } });
      const tracker = await card('Skill tracker');
      const [, , agents, leaders] = within(tracker).getAllByRole('group');

      expect(agents).not.toHaveAccessibleDescription();
      within(agents).getAllByRole('checkbox').forEach((box) => expect(box).toBeEnabled());
      expect(leaders).toHaveAccessibleDescription('Not applicable — they have no downline leaders yet.');
    });

    it('P11-T9 AC-2 opens both for a leader of leaders, with no note', async () => {
      show({ 'GET /coaching/coachees/mem-rina': { body: { ...RINA, pronoun: 'he', downline: { members: 6, leaders: 1 } } } });
      const tracker = await card('Skill tracker');
      expect(within(tracker).queryByText(/Not applicable/)).not.toBeInTheDocument();
      within(tracker).getAllByRole('checkbox').forEach((box) => expect(box).toBeEnabled());
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

    it('P11-T9 AC-3 still draws what a profile ticked and the office archived, marked and locked; what it never ticked is not drawn', async () => {
      show({ 'GET /coaching/coachees/mem-rina/profile': { body: archived() } });
      const tracker = await card('Skill tracker');

      const cold = within(tracker).getByRole('checkbox', { name: 'Cold calling Archived' });
      expect(cold).toBeChecked();
      expect(cold).toBeDisabled();
      expect(within(tracker).queryByText('Door to door')).not.toBeInTheDocument();
      // A section archived is drawn while it holds a tick, locked; one holding none is not.
      const leaders = within(tracker).getByRole('group', { name: 'Developing downline leader Archived' });
      expect(within(leaders).getByRole('checkbox', { name: 'Allocating time for team building' })).toBeChecked();
      expect(within(tracker).queryByText('Mentoring')).not.toBeInTheDocument();
      // A milestone archived and ticked, in every stage that lists it.
      const outside = within(await card('Capability mapping')).getAllByRole('checkbox', { name: 'Sells outside direct network Archived' });
      expect(outside).toHaveLength(3);
      outside.forEach((box) => { expect(box).toBeChecked(); expect(box).toBeDisabled(); });
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

  describe('Personal notes', () => {
    it('P11-T9 AC-4 shows the reader’s own note in the prototype’s card, tagged Leader-only, never shown to {name}', async () => {
      show();
      const notes = await card('Personal notes');

      expect(tagOf(notes)).toHaveTextContent(/^Leader-only, never shown to Rina Wijaya$/);
      expect(within(notes).getByRole('textbox', { name: 'Personal notes' })).toHaveValue(NOTES.mine.text);
      expect(within(notes).getByRole('button', { name: 'Save notes' })).toBeEnabled();
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
    it('P11-T9 AC-5 Agent view hides the tab, moves the reader to Personal Summary, and drops what the tab read: nothing is kept', async () => {
      const { calls } = show();
      await card('Personal notes from Wilson Tanoto');
      expect(screen.getByDisplayValue(NOTES.mine.text)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Agent view' }));

      expect(nav.replace).toHaveBeenCalledWith('/coaching/mem-rina/summary');
      expect(screen.queryByRole('link', { name: 'Leader Notes' })).not.toBeInTheDocument();
      // Unmounted: no note's words, no tick and no stage anywhere in the page, on screen or in a field.
      expect(screen.queryByDisplayValue(NOTES.mine.text)).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/Strong closer|Keep an eye|Capability mapping|Independent Producer|Leader-only/);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

      // Back to Leader view on the same address: the tab reads both again — nothing was cached.
      await userEvent.click(screen.getByRole('button', { name: 'Leader view' }));
      await card('Personal notes from Wilson Tanoto');
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/profile')).toHaveLength(2);
      expect(sent(calls, 'GET', '/coaching/coachees/mem-rina/leader-notes')).toHaveLength(2);
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
