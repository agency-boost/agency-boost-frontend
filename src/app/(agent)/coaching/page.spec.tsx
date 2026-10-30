import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import type { RosterRow, RosterStatus } from '@/lib/coaching';
import AgentLayout from '../layout';
import CoachingRosterPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
}));

/** An AB who leads two agents' worth of people and two units. */
const LEADER = makeMe({
  membership: {
    membershipId: 'mem-jordan', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 5,
  },
  permissions: ['coaching_session:read'],
});

const AGENT_RUNG = { code: 'AGENT', label: 'Agent' };
const AAB_RUNG = { code: 'AAB', label: 'Associate Agency Builder' };

function person(
  membershipId: string,
  name: string,
  days: number | null,
  status: RosterStatus,
  over: Partial<RosterRow> & { overdue?: boolean; coach?: string | null } = {},
): RosterRow {
  const { overdue = false, coach = 'Jordan Pratama', ...rest } = over;
  return {
    membershipId,
    name,
    rung: AGENT_RUNG,
    depth: 1,
    lastOneOnOne: days === null ? null : {
      days,
      date: '2026-09-20',
      overdue,
      coach: coach === null ? null : { membershipId: `coach-${coach}`, name: coach },
    },
    status,
    ...rest,
  };
}

/**
 * The prototype's roster (`Overall.html:10602-10618`) as the server sends it, with one level the
 * prototype never draws: a head nested inside Sri Lestari's unit, with a member of their own.
 */
const ROSTER = {
  today: '2026-10-02',
  overdueAfterDays: 7,
  directAgents: [
    person('mem-rina', 'Rina Wijaya', 5, 'watch_closely'),
    person('mem-fajar', 'Fajar Hidayat', 12, 'needs_attention', { overdue: true }),
    person('mem-melati', 'Melati Putri', null, 'no_goal_set'),
  ],
  units: [
    {
      head: person('mem-dimas', 'Dimas Aditya', 3, 'watch_closely', { rung: AAB_RUNG }),
      members: [
        person('mem-yuni', 'Yuni Sartika', 20, 'on_track', { depth: 2, overdue: true, coach: 'Dimas Aditya' }),
        person('mem-bayu', 'Bayu Kurniawan', null, 'needs_attention', { depth: 2 }),
      ],
    },
    {
      head: person('mem-sri', 'Sri Lestari', 0, 'on_track', { rung: AAB_RUNG }),
      members: [
        person('mem-agus', 'Agus Santoso', 1, 'watch_closely', { depth: 2, coach: 'Sri Lestari' }),
        person('mem-wulan', 'Wulan Sari', 9, 'on_track', { depth: 2, rung: AAB_RUNG, overdue: true, coach: null }),
        person('mem-tono', 'Tono Saputra', 2, 'no_goal_set', { depth: 3, coach: 'Wulan Sari' }),
      ],
    },
  ],
};

const EVERYONE = [
  'Rina Wijaya', 'Fajar Hidayat', 'Melati Putri', 'Dimas Aditya', 'Yuni Sartika', 'Bayu Kurniawan',
  'Sri Lestari', 'Agus Santoso', 'Wulan Sari', 'Tono Saputra',
];

const render = (body: unknown = ROSTER, me = LEADER) => {
  const stub = stubFetch({ '/coaching/coachees': { body } });
  renderWithSession(<CoachingRosterPage />, { me });
  return stub;
};

/** A person's row: the row's link is their name, stretched over the row (`PersonRow`). */
const linkOf = (name: string) => screen.getByRole('link', { name });
const rowOf = (name: string) => linkOf(name).closest('[data-person-row]') as HTMLElement;
/** Everyone, in the order the page draws them. */
const order = () => screen.getAllByRole('link').filter((a) => a.hasAttribute('data-row-main')).map((a) => a.textContent);

describe('Coaching Session — the roster (P11-T6; UI V1, UI-033, UI-034)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('UI-033, UI-034 offers the reader’s own coaching as a pill on the title row, the card gone', async () => {
    render();
    const title = await screen.findByRole('heading', { level: 1, name: 'Coaching Session' });
    const pill = screen.getByRole('link', { name: 'My Coaching Notes' });
    expect(pill).toHaveAttribute('href', '/coaching/me');
    expect(pill).toHaveClass('rounded-pill', 'border-amber', 'min-h-11');
    expect(title.closest('[data-title-row], div')?.parentElement).toContainElement(pill);
    expect(screen.queryByText('Your own coaching')).not.toBeInTheDocument();
  });

  it('P11-T6 AC-1 offers it while the roster is still on its way, and when it fails', async () => {
    stubFetch({ '/coaching/coachees': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Down.', requestId: 'req-9' } } } });
    renderWithSession(<CoachingRosterPage />, { me: LEADER });
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading everyone you coach…');
    expect(await screen.findByRole('alert')).toHaveTextContent('Down.');
    expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR · req-9');
  });

  it('UI-033 groups the direct agents, counted, then the AAB units, each head before their team, under 36px bands', async () => {
    render();
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    const direct = screen.getByRole('heading', { level: 3, name: 'Your direct agents · 3' });
    expect(direct).toHaveClass('min-h-9');
    expect(screen.getByRole('heading', { level: 3, name: 'AAB units' })).toBeInTheDocument();
    expect(order()).toEqual(EVERYONE);
  });

  it('UI-033 one 60px row per person, the whole row a link to their Coaching Session with a ›, no orange button', async () => {
    render();
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    for (const name of EVERYONE) {
      const id = linkOf(name).getAttribute('href');
      expect(id).toMatch(/^\/coaching\/mem-[a-z]+\/session$/);
      expect(rowOf(name)).toHaveClass('min-h-[3.75rem]');
      // The ›, a line icon.
      expect(rowOf(name).querySelector(':scope > svg')).not.toBeNull();
    }
    expect(linkOf('Rina Wijaya')).toHaveAttribute('href', '/coaching/mem-rina/session');
    expect(screen.queryByRole('link', { name: /Coaching →/ })).not.toBeInTheDocument();
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });

  it('UI-111 a person with a saved photo shows it on their row; a person without one shows their initials', async () => {
    const photo = 'https://cdn.test/user/u-rina/avatar/a.jpg?sig=abc';
    render({ ...ROSTER, directAgents: [{ ...ROSTER.directAgents[0], photoUrl: photo }, ...ROSTER.directAgents.slice(1)] });
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(rowOf('Rina Wijaya').querySelector('img')).toHaveAttribute('src', photo);
    expect(rowOf('Fajar Hidayat').querySelector('img')).toBeNull();
    expect(rowOf('Fajar Hidayat')).toHaveTextContent(/^FH/);
  });

  it('UI-033 draws each AAB’s people as a tree at every size: indented under the head, a level further for a nested AAB, no ↳', async () => {
    render();
    await screen.findByRole('link', { name: 'Sri Lestari' });
    const team = screen.getByRole('list', { name: 'Sri Lestari’s unit' });
    expect(within(team).getAllByRole('link').filter((a) => a.hasAttribute('data-row-main')).map((a) => a.textContent))
      .toEqual(['Agus Santoso', 'Wulan Sari', 'Tono Saputra']);
    // Wulan heads a unit of her own inside Sri's: Tono sits one level further in, under her.
    const wulans = screen.getByRole('list', { name: 'Wulan Sari’s unit' });
    expect(within(wulans).getByRole('link', { name: 'Tono Saputra' })).toBeInTheDocument();
    expect(team).toContainElement(wulans);
    for (const node of team.querySelectorAll(':scope > [data-tree-node]')) expect(node).toHaveClass('[--elbow:1.875rem]');
    expect(document.body.textContent).not.toContain('↳');
    // A head with nobody beneath them is the head alone.
    expect(screen.queryByRole('list', { name: 'Rina Wijaya’s unit' })).not.toBeInTheDocument();
  });

  it('UI-033 badges a unit’s head with their rung in a grey pill, never a dot', async () => {
    render();
    await screen.findByRole('link', { name: 'Dimas Aditya' });
    expect(within(rowOf('Dimas Aditya')).getByText('AAB')).toHaveAttribute('data-tone', 'grey');
    expect(within(rowOf('Wulan Sari')).getByText('AAB')).toBeInTheDocument();
    expect(within(rowOf('Rina Wijaya')).queryByText('AAB')).not.toBeInTheDocument();
  });

  it('P11-T6 AC-2 leaves out a group with nobody in it, and the direct agents when there are none', async () => {
    render({ ...ROSTER, units: [] });
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(screen.queryByRole('heading', { name: 'AAB units' })).not.toBeInTheDocument();
    cleanup();
    vi.unstubAllGlobals();
    render({ ...ROSTER, directAgents: [] });
    await screen.findByRole('link', { name: 'Dimas Aditya' });
    expect(screen.queryByRole('heading', { name: /Your direct agents/ })).not.toBeInTheDocument();
  });

  it('UI-033 the phone’s line: Last 1:1 and who held it by first name, grey — No 1:1 yet grey too — red only when overdue, in words', async () => {
    render();
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    const line = (name: string) => rowOf(name).querySelector('[data-roster-line]') as HTMLElement;
    expect(line('Rina Wijaya')).toHaveTextContent('5 days ago · by Jordan');
    expect(line('Rina Wijaya')).toHaveClass('text-signal-grey', 'md:hidden');
    expect(line('Melati Putri')).toHaveTextContent(/^No 1:1 yet$/);
    expect(line('Melati Putri')).toHaveClass('text-signal-grey');
    expect(line('Melati Putri')).not.toHaveClass('text-signal-red');
    expect(line('Fajar Hidayat')).toHaveTextContent('12 days ago · overdue · by Jordan');
    expect(line('Fajar Hidayat')).toHaveClass('text-signal-red');
    expect(line('Wulan Sari')).toHaveTextContent(/^9 days ago · overdue$/);
  });

  it('UI-034 from 768px: the columns under a header, every word 12px or more, who held it in full or a dash', async () => {
    render();
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    const header = screen.getByText('Last Coached By').parentElement!;
    expect(header).toHaveAttribute('aria-hidden', 'true');
    expect(header).toHaveClass('max-md:hidden', 'text-xs');
    expect(within(header).getAllByText(/.+/).map((el) => el.textContent)).toEqual(['Name', 'Last 1:1', 'Last Coached By', 'Status']);
    expect(rowOf('Rina Wijaya')).toHaveTextContent('Last Coached By: Jordan Pratama');
    expect(rowOf('Wulan Sari')).toHaveTextContent('Last Coached By: —');
    // Nothing on the page below 12px: no 11px, no 10px.
    expect(document.body.innerHTML).not.toMatch(/text-\[(10|11)px\]|text-\[0\.6875rem\]/);
  });

  it('P11-T6 AC-3 takes overdue from the server and does no date arithmetic of its own', async () => {
    vi.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z'), toFake: ['Date'] });
    render({ ...ROSTER, directAgents: [person('mem-rina', 'Rina Wijaya', 5, 'watch_closely')], units: [] });
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(rowOf('Rina Wijaya')).toHaveTextContent('5 days ago');
    expect(rowOf('Rina Wijaya')).not.toHaveTextContent('overdue');
  });

  it('UI-005 shows each status in its tinted pill: On track green, Watch closely amber, Needs attention red, No goal set grey', async () => {
    render();
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(within(rowOf('Sri Lestari')).getByText('On track')).toHaveAttribute('data-tone', 'green');
    expect(within(rowOf('Rina Wijaya')).getByText('Watch closely')).toHaveAttribute('data-tone', 'amber');
    expect(within(rowOf('Fajar Hidayat')).getByText('Needs attention')).toHaveAttribute('data-tone', 'red');
    expect(within(rowOf('Melati Putri')).getByText('No goal set')).toHaveAttribute('data-tone', 'grey');
  });

  it('P11-T6 AC-6 draws verdicts and dates, never an activity count, even if one arrived', async () => {
    render({ ...ROSTER, directAgents: [{ ...person('mem-rina', 'Rina Wijaya', 5, 'watch_closely'), activityCount: 4321 } as RosterRow], units: [] });
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(rowOf('Rina Wijaya')).not.toHaveTextContent('4321');
  });

  it('asks for the roster once, with no scope of its own', async () => {
    const { calls } = render();
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(calls.map((c) => c.url)).toEqual(['http://api.test/api/v1/coaching/coachees']);
  });

  it('says so in one line when there is nobody to coach (L-01)', async () => {
    render({ ...ROSTER, directAgents: [], units: [] });
    expect(await screen.findByText('No one to coach yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
  });

  it('shows the shell’s permission-denied state to a reader without the grant, naming no permission code', () => {
    const { calls } = render(ROSTER, makeMe({ permissions: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(screen.getByRole('alert').textContent).not.toMatch(/[a-z_]+:[a-z_]+/);
    expect(screen.queryByRole('link', { name: 'My Coaching Notes' })).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('sits inside the agent shell, with Coaching the current item', async () => {
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/notifications': { body: { items: [], unread: 0 } },
      '/coaching/coachees': { body: ROSTER },
    });
    renderInLayout(AgentLayout, <CoachingRosterPage />, { me: LEADER });
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Coaching' })).toHaveAttribute('aria-current', 'page');
  });
});
