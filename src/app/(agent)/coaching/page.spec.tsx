import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import type { Roster, RosterRow } from '@/lib/coaching';
import AgentLayout from '../layout';
import CoachingRosterPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
}));

/** Wilson, the KPM Owner and the root AB, reading the whole office (the 19 November review). */
const OWNER = makeMe({
  user: { ...makeMe().user, fullName: 'Wilson Tanoto' },
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['coaching_session:read', 'member:update_phone'],
});

const AB = { code: 'AB', label: 'AB' };
const AAB = { code: 'AAB', label: 'AAB' };
const AGENT = { code: 'AGENT', label: 'Agent' };

function person(membershipId: string, name: string, over: Partial<RosterRow> = {}): RosterRow {
  return {
    membershipId,
    name,
    photoUrl: null,
    rung: AGENT,
    depth: 2,
    lastOneOnOne: null,
    status: 'no_goal_set',
    coaching: { status: 'never', days: null, coach: null },
    phone: '+6281211002200',
    isReader: false,
    opens: true,
    ...over,
  };
}

const AGUS_COACH = { membershipId: 'mem-agus', name: 'Agus Prasetyo' };
const leader = (membershipId: string, name: string) => ({ membershipId, name, photoUrl: null });

/**
 * `coaching-owner-mobile` frames 1–3 as the server sends them: *Unit Anda* (Wilson alone), Agus's unit with an AAB who
 * leads nobody, two agents and an AAB's team, Satria's unit with a lapsed 1:1, and somebody with no leader.
 */
const ROSTER: Roster = {
  today: '2026-11-20',
  overdueAfterDays: 7,
  scope: 'downline',
  scopes: { offered: ['unit', 'direct', 'informal', 'downline'], default: 'downline' },
  total: 10,
  sections: [
    {
      key: 'own', kind: 'own', leader: leader('mem-wilson', 'Wilson Tanoto'), count: 1,
      rows: [person('mem-wilson', 'Wilson Tanoto', { rung: AB, depth: 0, isReader: true, phone: null })],
      teams: [],
    },
    {
      key: 'mem-agus', kind: 'unit', leader: leader('mem-agus', 'Agus Prasetyo'), count: 6,
      rows: [
        person('mem-agus', 'Agus Prasetyo', { rung: AB, depth: 1 }),
        person('mem-dewi', 'Dewi Lestari', { rung: AAB }),
        person('mem-hilmy', 'Hilmy', { coaching: { status: 'recent', days: 1, coach: AGUS_COACH }, phone: null }),
        person('mem-indah', 'Indah Permatasari', { coaching: { status: 'recent', days: 1, coach: AGUS_COACH } }),
      ],
      teams: [{
        key: 'mem-arief', leader: leader('mem-arief', 'Arief Hidayat'), count: 2,
        rows: [person('mem-arief', 'Arief Hidayat', { rung: AAB }), person('mem-novi', 'Novi Andriani', { depth: 3 })],
      }],
    },
    {
      key: 'mem-satria', kind: 'unit', leader: leader('mem-satria', 'Satria Nugraha'), count: 2,
      rows: [
        person('mem-satria', 'Satria Nugraha', { rung: AB, depth: 1 }),
        person('mem-oscar', 'Oscar Lim', {
          coaching: { status: 'lapsed', days: 47, coach: { membershipId: 'mem-satria', name: 'Satria Nugraha' } },
        }),
      ],
      teams: [],
    },
    {
      key: 'unled', kind: 'unled', leader: null, count: 1,
      rows: [person('mem-nora', 'Nora Siregar', { depth: 1, opens: false })],
      teams: [],
    },
  ],
};

const EMPTY: Roster = { ...ROSTER, total: 0, sections: [], scopes: { offered: [], default: 'downline' } };

const render = (body: unknown = ROSTER, me = OWNER) => {
  const stub = stubFetch({ '/coaching/coachees': { body } });
  renderWithSession(<CoachingRosterPage />, { me });
  return stub;
};

const card = () => document.querySelector('[data-roster]') as HTMLElement;
/** A person's row, by the name on it. */
const rowOf = (name: string) => [...card().querySelectorAll<HTMLElement>('[data-person-row]')]
  .find((r) => r.textContent!.includes(name))!;
/** Each unit line's words, in the order drawn. */
const unitLines = () => [...card().querySelectorAll('[data-roster-section] > h3 button')]
  .map((b) => b.querySelector('[data-unit-label]')!.textContent);

describe('P19.18-T5 Coaching for the KPM Owner: the whole office (ADR-0271 §9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.18-T5 AC-1 the control row: Semua downline ⌄ and Catatan coaching saya; the card reads Semua orang · n', async () => {
    stubFetch({ '/coaching/coachees': { body: ROSTER } });
    renderInIndonesian(<CoachingRosterPage />, { me: OWNER });
    await waitFor(() => expect(card()).not.toBeNull());
    const controls = document.querySelector('[data-roster-controls]') as HTMLElement;
    expect(within(controls).getByRole('button', { name: /Tampilan/ })).toHaveTextContent('Semua downline');
    expect(within(controls).getByRole('link', { name: 'Catatan coaching saya' })).toHaveAttribute('href', '/coaching/me');
    expect(within(card()).getByRole('heading', { level: 2 })).toHaveTextContent('Semua orang· 10');
    expect(card()).toHaveTextContent('1:1 terakhir');
  });

  it('P19.18-T5 AC-1 the views the server offers, and a choice reads the roster again with ?scope=', async () => {
    const user = userEvent.setup();
    const { calls } = render();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(calls.map((c) => c.url)).toEqual(['http://api.test/api/v1/coaching/coachees']);
    await user.click(screen.getByRole('button', { name: /View/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Direct Unit', 'Direct group', 'Informal group', 'All downline']);
    await user.click(screen.getByRole('option', { name: 'Direct group' }));
    await waitFor(() => expect(calls.map((c) => c.url)).toContain('http://api.test/api/v1/coaching/coachees?scope=direct'));
  });

  it('P19.18-T5 AC-1 one view offered: no picker, the notes pill alone', async () => {
    render({ ...ROSTER, scopes: { offered: ['unit'], default: 'unit' } });
    await waitFor(() => expect(card()).not.toBeNull());
    const controls = document.querySelector('[data-roster-controls]') as HTMLElement;
    expect(within(controls).queryByRole('button')).toBeNull();
    expect(within(controls).getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
  });

  it('P19.18-T5 AC-2 one orange line per unit — leader photo, Unit Anda / Unit NAME / Belum punya leader, n orang — open, a tap closes', async () => {
    const user = userEvent.setup();
    stubFetch({ '/coaching/coachees': { body: ROSTER } });
    renderInIndonesian(<CoachingRosterPage />, { me: OWNER });
    await waitFor(() => expect(card()).not.toBeNull());
    expect(unitLines()).toEqual(['Unit Anda', 'Unit AGUS PRASETYO', 'Unit SATRIA NUGRAHA', 'Belum punya leader']);
    const agus = screen.getByRole('button', { name: /Unit AGUS PRASETYO/ });
    expect(agus).toHaveClass('bg-primary/[0.12]');
    expect(agus).toHaveTextContent('6 orang');
    expect(agus).toHaveAttribute('aria-expanded', 'true');
    // The leader's photo — initials without one — on the line; *Belum punya leader* has none.
    expect(agus.querySelector('[aria-hidden="true"]')).toHaveTextContent('AP');
    await user.click(agus);
    expect(agus).toHaveAttribute('aria-expanded', 'false');
    expect(card()).not.toHaveTextContent('Dewi Lestari');
  });

  it('P19.18-T5 AC-2 an AAB’s team is a team line in the same tint, with the leader’s photo and n orang — not a folder', async () => {
    render();
    await waitFor(() => expect(card()).not.toBeNull());
    const team = card().querySelector('[data-roster-team="mem-arief"]') as HTMLElement;
    const line = team.querySelector('h4')!;
    expect(line).toHaveTextContent('ARIEF HIDAYAT’s unit2 people');
    expect(line).toHaveClass('bg-primary/[0.12]');
    expect(line.querySelector('button')).toBeNull();
    expect(within(team).getByRole('list', { name: 'ARIEF HIDAYAT’s unit' })).toBeInTheDocument();
  });

  it('P19.18-T5 AC-2 inside a unit: the AB, then the AAB, then agents, in the server’s order; the label orange, an AB never AAB', async () => {
    render();
    await waitFor(() => expect(card()).not.toBeNull());
    const agus = card().querySelectorAll('[data-roster-section="unit"]')[0] as HTMLElement;
    const names = [...agus.querySelectorAll('[data-row-main]')].map((a) => a.textContent);
    expect(names).toEqual(['Agus Prasetyo', 'Dewi Lestari', 'Hilmy', 'Indah Permatasari', 'Arief Hidayat', 'Novi Andriani']);
    expect(within(rowOf('Agus Prasetyo')).getByText('AB')).toHaveClass('text-primary-ink', 'font-extrabold');
    expect(within(rowOf('Satria Nugraha')).getByText('AB')).toHaveAttribute('data-rung-tag', 'AB');
    expect(within(rowOf('Dewi Lestari')).getByText('AAB')).toHaveAttribute('data-rung-tag', 'AAB');
    expect(rowOf('Hilmy').querySelector('[data-rung-tag]')).toBeNull();
    expect(card().textContent).not.toMatch(/AAB units|Your direct agents/);
  });

  it('P19.18-T5 AC-2 the coaching status tile: red never, green to 14 days, yellow after — and oleh <coach> under it', async () => {
    stubFetch({ '/coaching/coachees': { body: ROSTER } });
    renderInIndonesian(<CoachingRosterPage />, { me: OWNER });
    await waitFor(() => expect(card()).not.toBeNull());
    expect(within(rowOf('Dewi Lestari')).getByText('Belum pernah coaching')).toHaveClass('bg-pill-red');
    expect(within(rowOf('Hilmy')).getByText('Coaching 1 hari lalu')).toHaveClass('bg-pill-green');
    expect(within(rowOf('Hilmy')).getByText('oleh AGUS PRASETYO')).toBeInTheDocument();
    expect(within(rowOf('Oscar Lim')).getByText('Coaching 47 hari lalu')).toHaveClass('bg-pill-amber');
    expect(within(rowOf('Oscar Lim')).getByText('oleh SATRIA NUGRAHA')).toBeInTheDocument();
    expect(rowOf('Dewi Lestari')).not.toHaveTextContent('oleh');
  });

  it('P19.18-T5 AC-2 the row opens their Coaching Session; the reader’s own opens their notes; one outside their team opens nothing', async () => {
    render();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(screen.getByRole('link', { name: 'Dewi Lestari' })).toHaveAttribute('href', '/coaching/mem-dewi/session');
    expect(screen.getByRole('link', { name: 'You (Wilson)' })).toHaveAttribute('href', '/coaching/me');
    expect(within(rowOf('Nora Siregar')).queryByRole('link', { name: 'Nora Siregar' })).toBeNull();
    // A row that opens carries the ›; one that does not, none.
    expect(rowOf('Dewi Lestari').querySelector(':scope > svg')).not.toBeNull();
    expect(rowOf('Nora Siregar').querySelector(':scope > svg')).toBeNull();
  });

  it('P19.18-T5 AC-2 WhatsApp: a number opens it, none offers Isi nomor WhatsApp to a reader who may save one, never on the own row', async () => {
    render();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(within(rowOf('Dewi Lestari')).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me/6281211002200'));
    expect(within(rowOf('Hilmy')).getByRole('button', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(rowOf('You (Wilson)').querySelector('[data-roster-whatsapp]')).toBeNull();
  });

  // Found 2026-11-20: the reader's row is labelled *You (Wilson)*, and its avatar drew the label's initials, *Y(* — *A(* in
  // Indonesian. The initials are the person's own name's.
  it('draws the reader’s own initials on their row, not the label’s', async () => {
    render();
    await waitFor(() => expect(card()).not.toBeNull());
    const avatar = rowOf('You (Wilson)').querySelector(':scope > span[aria-hidden="true"]');
    expect(avatar).toHaveTextContent(/^WT$/);
  });

  it('P19.18-T5 AC-2 a reader who may not save a number gets no button on a row without one', async () => {
    render(ROSTER, makeMe({ ...OWNER, permissions: ['coaching_session:read'] }));
    await waitFor(() => expect(card()).not.toBeNull());
    expect(rowOf('Hilmy').querySelector('[data-roster-whatsapp]')).toBeNull();
    expect(within(rowOf('Dewi Lestari')).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it('UI-111 a person with a saved photo shows it on their row; a person without one shows their initials', async () => {
    const photo = 'https://cdn.test/user/u-dewi/avatar/a.jpg?sig=abc';
    const withPhoto: Roster = {
      ...ROSTER,
      sections: ROSTER.sections.map((s) => ({ ...s, rows: s.rows.map((r) => (r.membershipId === 'mem-dewi' ? { ...r, photoUrl: photo } : r)) })),
    };
    render(withPhoto);
    await waitFor(() => expect(card()).not.toBeNull());
    expect(rowOf('Dewi Lestari').querySelector('img')).toHaveAttribute('src', photo);
    expect(rowOf('Hilmy').querySelector('img')).toBeNull();
  });

  it('P11-T6 AC-6 draws verdicts and dates, never an activity count, even if one arrived', async () => {
    const counted = {
      ...ROSTER,
      sections: [{ ...ROSTER.sections[1], rows: [{ ...ROSTER.sections[1].rows[1], activityCount: 4321 } as RosterRow], teams: [] }],
    };
    render(counted);
    await waitFor(() => expect(card()).not.toBeNull());
    expect(card()).not.toHaveTextContent('4321');
  });

  it('P11-T6 AC-1 offers the reader’s notes while the roster is on its way, and when it fails', async () => {
    stubFetch({ '/coaching/coachees': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Down.', requestId: 'req-9' } } } });
    renderWithSession(<CoachingRosterPage />, { me: OWNER });
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading everyone you coach…');
    expect(await screen.findByRole('alert')).toHaveTextContent('Down.');
    expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR · req-9');
  });

  it('P19-T4 AC-3 shows a leader with nobody to coach the roster as it will look: greyed, Example, one next step', async () => {
    render(EMPTY);
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toBeInTheDocument();
    const sample = document.querySelector('[data-sample]')!;
    expect(sample).toHaveAttribute('aria-hidden', 'true');
    expect(sample.textContent).toContain('Sample agent 1');
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sample agent/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first agent' })).toHaveAttribute('href', '/new-hires');
  });

  it('says so in one line to an Agent with nobody to coach, on a typed address (L-01)', async () => {
    render(EMPTY, makeMe({
      permissions: ['coaching_session:read'],
      membership: {
        membershipId: 'mem-a', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 0,
      },
    }));
    expect(await screen.findByText('No one to coach yet.')).toBeInTheDocument();
    expect(document.querySelector('[data-sample-preview]')).toBeNull();
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
    renderInLayout(AgentLayout, <CoachingRosterPage />, { me: OWNER });
    await screen.findByRole('link', { name: 'Dewi Lestari' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Coaching' })).toHaveAttribute('aria-current', 'page');
  });
});
