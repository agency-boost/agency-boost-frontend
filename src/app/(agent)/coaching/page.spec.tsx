import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import type { RosterRow, RosterStatus } from '@/lib/coaching';
import { PHONE_QUERY } from '@/lib/use-phone';
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

/** The name cell of a person's own row: a coach's name appears again under *Last Coached By*. */
const nameCell = (name: string) => screen.getAllByText(name).map((el) => el.closest('th')).find(Boolean)!;
/** The roster row a person stands in. */
const rowOf = (name: string) => nameCell(name).closest('tr')!;

describe('Coaching Session — the roster (P11-T6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('P11-T6 AC-1 offers the reader’s own coaching, opening /coaching/me', async () => {
    render();
    expect(await screen.findByRole('heading', { level: 1, name: 'Coaching Session' })).toBeInTheDocument();
    expect(screen.getByText('Your own coaching')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toHaveAttribute('href', '/coaching/me');
  });

  it('P11-T6 AC-1 offers it while the roster is still on its way, and when it fails', async () => {
    // The card is the reader's own, and needs nothing the roster read brings.
    stubFetch({ '/coaching/coachees': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Down.', requestId: 'req-9' } } } });
    renderWithSession(<CoachingRosterPage />, { me: LEADER });
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading everyone you coach…');
    expect(await screen.findByRole('alert')).toHaveTextContent('Down.');
    expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR · req-9');
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
  });

  it('P11-T6 AC-2 heads the table Name · Last 1:1 · Last Coached By · Status, and names the action column for a screen reader', async () => {
    render();
    const table = await screen.findByRole('table', { name: 'Everyone you coach' });
    const headings = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headings).toEqual(['Name', 'Last 1:1', 'Last Coached By', 'Status', 'Actions']);
    // The fifth is empty on screen, as the prototype's is.
    expect(within(table).getByRole('columnheader', { name: 'Actions' }).querySelector('.sr-only')).not.toBeNull();
  });

  it('P11-T6 AC-2 groups the direct agents, counted, then the AAB units, each head before their team', async () => {
    render();
    await screen.findByRole('table');
    const groups = screen.getAllByRole('rowheader').filter((th) => th.getAttribute('colspan') === '5');
    expect(groups.map((g) => g.textContent)).toEqual(['Your direct agents · 3', 'AAB units']);

    // Everyone in the order the server sends: the tree order, names A to Z within a level.
    const names = screen.getAllByRole('row').slice(1)
      .map((tr) => tr.querySelector('span.font-semibold')?.textContent)
      .filter((n): n is string => Boolean(n) && EVERYONE.includes(n!));
    expect(names).toEqual(EVERYONE);
  });

  it('P11-T6 AC-2 badges each unit’s head with their rung, on its tinted row, and names the unit for a screen reader', async () => {
    render();
    await screen.findByRole('table');
    for (const head of ['Dimas Aditya', 'Sri Lestari']) {
      const row = rowOf(head);
      expect(within(row).getByText('AAB')).toBeInTheDocument();
      expect(row.className).toContain('bg-navy-soft/[0.045]');
      // The head names the rest of its `<tbody>`: its team.
      expect(nameCell(head)).toHaveAttribute('scope', 'rowgroup');
    }
    // A direct agent is a row of their own, unbadged and untinted.
    const rina = rowOf('Rina Wijaya');
    expect(within(rina).queryByText('AGENT')).not.toBeInTheDocument();
    expect(rina.className).not.toContain('bg-navy-soft');
    expect(nameCell('Rina Wijaya')).toHaveAttribute('scope', 'row');
  });

  it('P11-T6 AC-2 nests each unit’s members behind ↳, one step further in for every level', async () => {
    render();
    await screen.findByRole('table');
    const indent = (name: string) => (nameCell(name).firstElementChild as HTMLElement).style.paddingLeft;

    // The prototype's 26px for a unit's member, and a nested unit's member 26px further still.
    expect(indent('Dimas Aditya')).toBe('');
    expect(indent('Yuni Sartika')).toBe('26px');
    expect(indent('Wulan Sari')).toBe('26px');
    expect(indent('Tono Saputra')).toBe('52px');
    expect(within(rowOf('Tono Saputra')).getByText('↳')).toHaveAttribute('aria-hidden', 'true');
    expect(within(rowOf('Dimas Aditya')).queryByText('↳')).not.toBeInTheDocument();
    // A head nested inside a unit wears their rung too; their members do not.
    expect(within(rowOf('Wulan Sari')).getByText('AAB')).toBeInTheDocument();
    expect(within(rowOf('Tono Saputra')).queryByText('AAB')).not.toBeInTheDocument();
  });

  it('P11-T6 AC-2 draws a unit head with nobody beneath them as the head alone', async () => {
    render({ ...ROSTER, directAgents: [], units: [{ head: ROSTER.units[0].head, members: [] }] });
    await screen.findByRole('table');
    expect(rowOf('Dimas Aditya')).toBeInTheDocument();
    expect(screen.queryByText('↳')).not.toBeInTheDocument();
  });

  it('P11-T6 AC-2 leaves out a group with nobody in it, rather than heading nothing', async () => {
    render({ ...ROSTER, units: [] });
    await screen.findByRole('table');
    expect(screen.getByText('Your direct agents')).toBeInTheDocument();
    expect(screen.queryByText('AAB units')).not.toBeInTheDocument();
  });

  it('P11-T6 AC-2 leaves out the direct agents when there are none', async () => {
    render({ ...ROSTER, directAgents: [] });
    await screen.findByRole('table');
    expect(screen.queryByText('Your direct agents')).not.toBeInTheDocument();
    expect(screen.getByText('AAB units')).toBeInTheDocument();
  });

  it('P11-T6 AC-3 words Last 1:1 as the prototype does, red when there is none or it is overdue', async () => {
    render();
    await screen.findByRole('table');
    const lastOf = (name: string) => rowOf(name).querySelectorAll('td')[0].firstElementChild as HTMLElement;

    expect(lastOf('Melati Putri')).toHaveTextContent('No 1:1 yet');
    expect(lastOf('Melati Putri').className).toContain('text-alert');
    expect(lastOf('Sri Lestari')).toHaveTextContent('Today');
    expect(lastOf('Sri Lestari').className).toContain('text-success');
    expect(lastOf('Agus Santoso')).toHaveTextContent(/^1 day ago$/);
    expect(lastOf('Rina Wijaya')).toHaveTextContent(/^5 days ago$/);
    expect(lastOf('Rina Wijaya').className).toContain('text-success');
    // Overdue is the server's verdict, said in visible words as well as in red (P18.8-T15 AC-7): it was told to a
    // screen reader alone, and on a phone the hidden *, overdue* wrapped onto a line of its own.
    expect(lastOf('Fajar Hidayat')).toHaveTextContent(/^12 days ago · overdue$/);
    expect(lastOf('Fajar Hidayat').querySelector('.sr-only')).toBeNull();
    expect(lastOf('Fajar Hidayat').className).toContain('text-alert');
  });

  it('P11-T6 AC-3 takes overdue from the server and does no date arithmetic of its own', async () => {
    // The browser's clock is a year off and the office's threshold is 30 days: 20 days ago and not
    // overdue stays green, whatever the prototype's hardcoded 7 or this clock would say.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-10-02T00:00:00Z'));
    render({
      ...ROSTER,
      overdueAfterDays: 30,
      directAgents: [person('mem-rina', 'Rina Wijaya', 20, 'on_track', { overdue: false })],
      units: [],
    });
    const cell = (await screen.findByText('20 days ago')).closest('span')!;
    expect(cell.className).toContain('text-success');
    expect(cell).not.toHaveTextContent('overdue');
  });

  it('P11-T6 AC-3 names who led the last 1:1, or a dash', async () => {
    render();
    await screen.findByRole('table');
    const coachOf = (name: string) => rowOf(name).querySelectorAll('td')[1];
    expect(coachOf('Rina Wijaya')).toHaveTextContent('Jordan Pratama');
    expect(coachOf('Yuni Sartika')).toHaveTextContent('Dimas Aditya');
    // Never coached, and coached by somebody whose membership is gone: both a dash.
    expect(coachOf('Melati Putri')).toHaveTextContent(/^—$/);
    expect(coachOf('Wulan Sari')).toHaveTextContent(/^—$/);
  });

  it('P11-T6 AC-4 shows each status in its pill: On track, Watch closely, Needs attention, No goal set', async () => {
    render();
    await screen.findByRole('table');
    const pillOf = (name: string) => rowOf(name).querySelectorAll('td')[2].firstElementChild as HTMLElement;

    expect(pillOf('Yuni Sartika')).toHaveTextContent('On track');
    expect(pillOf('Yuni Sartika').className).toContain('text-success');
    expect(pillOf('Rina Wijaya')).toHaveTextContent('Watch closely');
    expect(pillOf('Rina Wijaya').className).toContain('bg-amber/15');
    expect(pillOf('Fajar Hidayat')).toHaveTextContent('Needs attention');
    expect(pillOf('Fajar Hidayat').className).toContain('text-alert');
    // ADR-0080: a member with no target is never Watch closely, and never styled as failing.
    expect(pillOf('Melati Putri')).toHaveTextContent('No goal set');
    expect(pillOf('Melati Putri').className).toContain('text-muted');
  });

  it('P11-T6 AC-5 puts Coaching → on every row, opening that person’s Coaching Session tab', async () => {
    render();
    await screen.findByRole('table');
    const links = screen.getAllByRole('link', { name: 'Coaching' });
    expect(links).toHaveLength(EVERYONE.length);
    expect(within(rowOf('Tono Saputra')).getByRole('link', { name: 'Coaching' }))
      .toHaveAttribute('href', '/coaching/mem-tono/session');
    expect(within(rowOf('Dimas Aditya')).getByRole('link', { name: 'Coaching' }))
      .toHaveAttribute('href', '/coaching/mem-dimas/session');
    // The arrow is the label's, and not part of its name.
    expect(within(links[0]).getByText('→')).toHaveAttribute('aria-hidden', 'true');
  });

  /*
   * The link is `inline-flex`, which makes every loose run of text in it a flex item of its own, and a
   * flex item drops the space at its end: the button was drawn *Coaching→*, 0px between the word and
   * the arrow. jsdom lays nothing out, so this pins the structure that keeps the space: one element
   * holding the whole label, and no text loose beside it.
   */
  it('P11-T6 AC-5 draws Coaching → with its space, the label one run of text inside the flex link', async () => {
    render();
    await screen.findByRole('table');
    for (const link of screen.getAllByRole('link', { name: 'Coaching' })) {
      const loose = [...link.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
      expect(loose).toEqual([]);
      expect(link.children).toHaveLength(1);
      expect(link.children[0].tagName).toBe('SPAN');
      expect(link.children[0].textContent).toBe('Coaching →');
    }
  });

  it('P11-T6 AC-6 draws verdicts and dates, never an activity count, even if one arrived', async () => {
    const leaky = {
      ...ROSTER,
      directAgents: [{ ...ROSTER.directAgents[0], activityCount: 4321, presentations: 8765 }],
      units: [],
    };
    render(leaky);
    await screen.findByText('Rina Wijaya');
    const row = rowOf('Rina Wijaya');
    expect(row).not.toHaveTextContent('4321');
    expect(row).not.toHaveTextContent('8765');
    // The only figure on a row is the days since its last 1:1.
    expect(row.textContent!.match(/\d+/g)).toEqual(['5']);
  });

  it('asks for the roster once, with no scope of its own', async () => {
    const { calls } = render();
    await screen.findByRole('table');
    expect(calls.map((c) => c.url)).toEqual(['http://api.test/api/v1/coaching/coachees']);
  });

  it('says so in one line when there is nobody to coach (L-01)', async () => {
    render({ ...ROSTER, directAgents: [], units: [] });
    expect(await screen.findByText('No one to coach yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The reader's own coaching is still there.
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
  });

  it('shows the shell’s permission-denied state to a reader without the grant, naming no permission code', () => {
    const { calls } = render(ROSTER, makeMe({ permissions: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(screen.getByRole('alert').textContent).not.toMatch(/[a-z_]+:[a-z_]+/);
    expect(screen.queryByText('Your own coaching')).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('sits inside the agent shell, with Coaching session the current item', async () => {
    stubFetch({
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/notifications': { body: { items: [], unread: 0 } },
      '/coaching/coachees': { body: ROSTER },
    });
    renderInLayout(AgentLayout, <CoachingRosterPage />, { me: LEADER });
    await screen.findByRole('table');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Coaching session' })).toHaveAttribute('aria-current', 'page');
  });
});

/*
 * **The roster as cards below 768px** (P18.95-T3 AC-3, ADR-0167 §6; the client's UI review of 2026-10-26, UI-011:
 * *Coaching →* and *Status* off the screen to the right, *No 1:1 yet* on three lines). The phone is `matchMedia`
 * answering `usePhone`'s query; every spec above is the table a tablet and a desktop keep.
 */
describe('P18.95-T3 — the roster as cards on a phone', () => {
  const onPhone = (matches = true) => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: matches && query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
  })));
  /** A person's card: the list item their name stands in. */
  const cardOf = (name: string) => screen.getAllByText(name).map((el) => el.closest('li')).find((li) => li?.querySelector('p span')?.textContent === name)!;
  const cards = () => screen.findByRole('list', { name: 'Your direct agents' });

  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T3 AC-3 draws a card per person below 768px, in the table’s groups and order, and no table', async () => {
    onPhone();
    render();
    await cards();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Everyone you coach' })).toHaveClass('sr-only');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Your direct agents · 3', 'AAB units']);
    expect(screen.getAllByRole('list').map((l) => l.getAttribute('aria-label')))
      .toEqual(['Your direct agents', 'Dimas Aditya’s unit', 'Sri Lestari’s unit']);
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('p span')!.textContent);
    expect(names).toEqual(EVERYONE);
    // A unit's head keeps its badge and tint; a member one step in, a head inside a unit one more.
    expect(within(cardOf('Dimas Aditya')).getByText('AAB')).toBeInTheDocument();
    expect(cardOf('Dimas Aditya')).toHaveClass('bg-navy-soft/[0.045]');
    expect(within(cardOf('Wulan Sari')).getByText('AAB')).toBeInTheDocument();
    expect(within(cardOf('Agus Santoso')).queryByText('AGENT')).not.toBeInTheDocument();
    expect(cardOf('Rina Wijaya').style.paddingLeft).toBe('');
    expect(cardOf('Yuni Sartika').style.paddingLeft).toBe('28px');
    expect(cardOf('Tono Saputra').style.paddingLeft).toBe('40px');
  });

  it('P18.95-T3 AC-3 says on a card what the row says: the status, Last 1:1 on its own line, and who held it', async () => {
    // The row's cells, as a tablet draws them …
    render();
    await screen.findByRole('table');
    const row = rowOf('Fajar Hidayat');
    const [last, coach, status] = [...row.querySelectorAll('td')].map((td) => td.textContent);
    cleanup();

    // … and the same words on the phone's card.
    onPhone();
    render();
    await cards();
    const fajar = cardOf('Fajar Hidayat');
    expect(fajar).toHaveTextContent(last!);
    expect(fajar).toHaveTextContent(`by ${coach}`);
    expect(fajar).toHaveTextContent(status!);
    expect(last).toBe('12 days ago · overdue');
    expect(within(fajar).getByText('12 days ago · overdue')).toHaveClass('text-alert');
    expect(within(fajar).getByText('Needs attention')).toHaveClass('text-alert');
    // *Last 1:1* under its label, the value on a line the width of the card (UI-011: three lines in the cell).
    expect(within(fajar).getByText('Last 1:1').tagName).toBe('DT');
    const none = cardOf('Melati Putri');
    expect(none).toHaveTextContent('Last 1:1No 1:1 yet');
    expect(none).not.toHaveTextContent('by ');
    expect(within(none).getByText('No goal set')).toHaveClass('text-muted');
    // Coached by somebody whose membership is gone: no *by* line, as the table's dash says.
    expect(cardOf('Wulan Sari')).not.toHaveTextContent('by ');
  });

  it('P18.95-T3 AC-3 puts Coaching → across every card, the row’s own link, a 44px target', async () => {
    onPhone();
    render();
    await cards();
    const links = screen.getAllByRole('link', { name: 'Coaching' });
    expect(links).toHaveLength(EVERYONE.length);
    const tono = within(cardOf('Tono Saputra')).getByRole('link', { name: 'Coaching' });
    expect(tono).toHaveAttribute('href', '/coaching/mem-tono/session');
    expect(tono).toHaveClass('w-full', 'min-h-11', 'justify-center');
    expect(tono.children).toHaveLength(1);
    expect(tono.children[0].textContent).toBe('Coaching →');
  });

  it('P18.95-T3 AC-3 never draws the table first on a phone: the width is asked before the roster answers', async () => {
    onPhone();
    expect(await drewATable(async () => {
      render();
      await cards();
    })).toBe(false);
  });

  it('P18.95-T3 AC-3 keeps the table at 768px and wider', async () => {
    onPhone(false);
    render();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your direct agents' })).not.toBeInTheDocument();
  });
});

/** Whether a `<table>` was ever put on the page while `run` waited: a phone's first paint must already be its cards. */
async function drewATable(run: () => Promise<unknown>) {
  let seen = false;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('table') || node.querySelector('table'))) seen = true;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  await run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  observer.disconnect();
  return seen;
}
