import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { InLanguage, makeMe, renderInLayout, renderWithSession, routeParams, stubFetch } from '@test/harness';
import type { Language } from '@/i18n/language';
import CoachingPersonLayout from '../layout';
import CoacheeLeadsTabPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/leads',
}));

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['coaching_session:read', 'lead:read', 'lead:update', 'lead:create', 'lead:mark_outcome'],
});

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 }, today: '2026-10-02',
};

const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      { id: 's1', pipeline: 'sales', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 's2', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 2, isTerminal: false, isLateStage: true, version: 1, status: 'active' },
    ],
  },
  {
    pipeline: 'recruitment',
    statuses: [
      { id: 'r1', pipeline: 'recruitment', code: 'MEETING_SCHEDULED', label: 'Meeting scheduled', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
    ],
  },
];

const lead = (over: Record<string, unknown> = {}) => ({
  id: 'l-desi', ownerMembershipId: 'mem-rina', type: 'sales', name: 'Desi Pratama',
  contact: { phone: null, email: null }, statusCode: 'FOLLOW_UP', thisMonth: false, remarks: null,
  nextActionDate: '2026-10-05', nextActionNote: 'Confirm submission paperwork', outcome: null, source: null,
  dateRegistered: '2026-09-04T03:00:00.000Z', version: 3, flags: [], overdueDays: null, committedMonths: [], lastEditedBy: null, ...over,
});
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const LEADS = [
  lead(),
  lead({ id: 'l-shinta', name: 'Ibu Shinta Maharani', nextActionDate: null, nextActionNote: null, statusCode: 'NOT_YET_APPROACHED' }),
  lead({ id: 'l-laras', name: 'Sdri. Laras Wulandari', type: 'recruitment', statusCode: 'MEETING_SCHEDULED', nextActionDate: null, nextActionNote: 'Invite her to BOP' }),
  lead({ id: 'l-won', name: 'Pak Won', outcome: 'won' }),
];

const routes = (over: Record<string, unknown> = {}) => ({
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
  'GET /coaching/coachees/mem-rina': { body: RINA },
  'GET /leads?owner=mem-rina': { body: page(LEADS) },
  'GET /leads/l-desi': { body: { ...lead(), history: [] } },
  ...over,
});

const mount = (language?: Language, me = LEADER) => {
  const tab = <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeLeadsTabPage /></CoachingPersonLayout>;
  return language
    ? renderWithSession(<InLanguage language={language}><AgentLayout>{tab}</AgentLayout></InLanguage>, { me })
    : renderInLayout(AgentLayout, tab, { me });
};

const show = (language?: Language, over: Record<string, unknown> = {}, me = LEADER) => {
  const stub = stubFetch(routes(over) as Parameters<typeof stubFetch>[0]);
  return { ...stub, ...mount(language, me) };
};

/** The open leads, as `/leads`' cards (`LeadCard`, P19.16-T4 AC-1), in the order drawn. */
const rows = () => [...document.querySelectorAll('[data-lead-card]')].map((li) => li.getAttribute('data-lead-card'));
/** *Leads yang ditutup*'s two lists (`ClosedLeads`), by their header. */
const closedCard = (title: RegExp) => screen.getByRole('heading', { level: 3, name: title }).closest('div.overflow-hidden') as HTMLElement;

describe('UI-029 — the coachee’s Leads tab (P18.11-T8), writable since the staging review of 2026-10-31, drawn as /leads since P19.16-T4', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-029 lists only that agent’s open leads, read once by owner, in the card’s order; the closed below', async () => {
    const { calls } = show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(rows()).toEqual(['l-shinta', 'l-laras', 'l-desi']);
    const reads = calls.filter((c) => c.url.includes('/leads?'));
    expect(reads).toHaveLength(1);
    expect(new URL(reads[0].url).searchParams.get('owner')).toBe('mem-rina');
    // The shell is the one header; the tab is marked current.
    expect(within(screen.getByRole('navigation', { name: 'Coaching' })).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('P19.16-T4 AC-1 draws each open lead as /leads’ card, in /leads’ phone list, with no white card around it', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    // `LeadCard`, not the session card's compact row.
    expect(document.querySelector('[data-coachee-lead]')).toBeNull();
    const desi = document.querySelector('[data-lead-card="l-desi"]') as HTMLElement;
    expect(desi).toHaveClass('rounded-row', 'bg-card');
    expect(within(desi).getByText('Follow-up')).toBeInTheDocument();
    expect(desi.querySelector('[data-pill-separator]')).toBeInTheDocument();
    // One under the other on a phone, two to a row on a tablet — `/leads`' own list.
    const list = desi.closest('ul') as HTMLElement;
    expect(list).toHaveAttribute('aria-label', 'Leads');
    expect(list).toHaveClass('flex', 'flex-col', 'gap-1.5', 'md:max-lg:grid', 'md:max-lg:grid-cols-2', 'md:max-lg:gap-2');
    // Nothing between the list and the tab: no bordered white section around the leads any more.
    expect(list.parentElement).toHaveAttribute('data-coachee-leads');
    expect(document.querySelector('[data-coachee-leads] section.border-card-edge')).toBeNull();
    // The red *Isi tindakan* / *Isi tanggal* are the card's words where there is no next action.
    expect(document.querySelector('[data-lead-card="l-shinta"] [data-next-action="missing"]')).toHaveTextContent('Add an action');
    expect(document.querySelector('[data-lead-card="l-laras"] [data-next-action="missing"]')).toHaveTextContent('Add a date');
  });

  it('P19.16-T4 AC-1 says no Milik … and draws no proposal pill or Buat proposal: every lead is the coachee’s', async () => {
    const proposals = { count: 1, latest: { products: ['PRUWell Medical'] }, done: 0, latestDone: null };
    show(undefined, {
      'GET /leads?owner=mem-rina': {
        body: page(LEADS.map((l) => ({ ...l, owner: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, proposals }))),
      },
    }, makeMe({ ...LEADER, permissions: [...LEADER.permissions, 'proposal:read', 'proposal:create'] }));
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(rows()).toHaveLength(3);
    expect(document.querySelector('[data-lead-owner]')).toBeNull();
    expect(document.body).not.toHaveTextContent('Rina Wijaya’s');
    expect(document.querySelector('[data-lead-proposal]')).toBeNull();
    expect(document.querySelector('[data-make-proposal]')).toBeNull();
  });

  /*
   * The staging review of 2026-10-31 (the product owner: *ini saya lihat tim saya, tapi ga bisa tambah leads*), decided
   * 2026-11-01: the leader **adds and edits** a team member's leads here, as in a session, and **never deletes** —
   * replacing UI-029's read-only tab.
   */
  const writes = (calls: { url: string; init: RequestInit }[]) => calls
    .filter((c) => (c.init.method ?? 'GET') !== 'GET')
    .map((c) => `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')}${new URL(c.url).search} ${String(c.init.body)}`);

  it('staging review 2026-10-31: the floating + adds a lead to her pipeline (POST /leads?owner=), and it joins the list', async () => {
    const { calls } = show(undefined, {
      'POST /leads': { status: 201, body: lead({ id: 'l-joko', name: 'Pak Joko', statusCode: null, nextActionDate: null, nextActionNote: null, version: 1 }) },
    });
    await screen.findByRole('button', { name: 'Desi Pratama' });
    const add = screen.getByRole('button', { name: 'Add lead' });
    // `/leads`' own floating +, and at every width: the tab has no title-row button to stand in for it on a desktop.
    expect(add).toHaveClass('fixed', 'bottom-[calc(var(--tab-bar-space)+1rem)]', 'bg-primary');
    expect(add.className).not.toMatch(/\blg:hidden\b/);
    await userEvent.click(add);
    const sheet = within(await screen.findByRole('dialog', { name: 'New lead' }));
    await userEvent.type(sheet.getByLabelText('Name'), 'Pak Joko');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatch(/^POST \/leads\?owner=mem-rina \{"name":"Pak Joko",/);
    await waitFor(() => expect(rows()).toContain('l-joko'));
  });

  it('staging review 2026-10-31: a card opens the sheet to edit, pinned to the version it read; the card is the answer', async () => {
    const { calls } = show(undefined, {
      'PATCH /leads/l-desi': { body: lead({ remarks: 'Two kids.', version: 4 }) },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Desi Pratama' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Desi Pratama' }));
    await userEvent.type(sheet.getByLabelText('Remarks'), 'Two kids.');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /leads/l-desi {"remarks":"Two kids.","version":3}']));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('staging review 2026-10-31: never Delete — not in the sheet, not on a card', async () => {
    show(undefined, {}, makeMe({ ...LEADER, permissions: [...LEADER.permissions, 'lead:delete'] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desi Pratama' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Desi Pratama' }));
    expect(sheet.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('P19.16-T4 AC-4 a card with no next action opens the sheet on the next action; one with a note and no date does not', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    // The card is the one control: no *Isi tindakan* button, no date picker of its own (`/leads`' card has neither).
    expect(screen.queryByRole('button', { name: 'Add an action' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Next action date for/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ibu Shinta Maharani' }));
    const shinta = within(await screen.findByRole('dialog', { name: 'Ibu Shinta Maharani' }));
    await waitFor(() => expect(shinta.getByLabelText('Next action note')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Sdri. Laras Wulandari' }));
    const laras = within(await screen.findByRole('dialog', { name: 'Sdri. Laras Wulandari' }));
    expect(laras.getByLabelText('Next action note')).toHaveValue('Invite her to BOP');
    expect(laras.getByLabelText('Next action note')).not.toHaveFocus();
  });

  it('a read-only support session adds nothing and edits nothing: no +, the sheet opens to read', async () => {
    const support = makeMe({ ...LEADER, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-admin' });
    show(undefined, {}, support);
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent('Add an action');
    expect(document.body).toHaveTextContent('Add a date');

    await userEvent.click(screen.getByRole('button', { name: 'Desi Pratama' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: /^Save$|^Simpan$/ })).not.toBeInTheDocument();
  });

  it('a reader the server granted no lead:create is offered no +, and one with no lead:update no edit', async () => {
    show(undefined, {}, makeMe({ ...LEADER, permissions: ['coaching_session:read', 'lead:read'] }));
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desi Pratama' }));
    expect(within(await screen.findByRole('dialog')).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('UI-029 narrows by type with the chips, each counted, and by the search', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    const chips = screen.getByRole('group', { name: 'Lead type' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All3', 'Sales2', 'Recruit1']);
    await userEvent.click(within(chips).getByRole('button', { name: /^Recruit/ }));
    expect(rows()).toEqual(['l-laras']);
    await userEvent.click(within(chips).getByRole('button', { name: /^All/ }));
    await userEvent.type(screen.getByRole('searchbox'), 'shinta');
    expect(rows()).toEqual(['l-shinta']);
  });

  it('P19.16-T4 AC-2 the search pill and the chips are /leads’ own: white, 44px, the chosen chip navy; no filter button', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    const search = screen.getByRole('search', { name: 'Search and filter leads' });
    const pill = screen.getByRole('searchbox').closest('label') as HTMLElement;
    expect(pill).toHaveClass('min-h-11', 'rounded-pill', 'bg-card', 'focus-within:outline-focus-ring');
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search lead names');
    // Search and the type alone, as before: no sort, scope, stage or proposal filters on this tab.
    expect(within(search).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Filter and sort/ })).not.toBeInTheDocument();
    expect(document.querySelector('[data-pipeline-strip]')).toBeNull();

    const chips = screen.getByRole('group', { name: 'Lead type' });
    expect(chips).toHaveClass('my-2.5', 'flex', 'gap-1.5');
    const all = within(chips).getByRole('button', { name: /^All/ });
    const sales = within(chips).getByRole('button', { name: /^Sales/ });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(all).toHaveClass('min-h-11', 'bg-secondary', 'text-secondary-contrast');
    expect(sales).toHaveClass('min-h-11', 'bg-card', 'text-navy');
    await userEvent.click(sales);
    expect(sales).toHaveClass('bg-secondary');
    expect(all).toHaveClass('bg-card');
  });

  it('P19.16-T4 AC-2 the empty and the no-match states wear /leads’ EmptyState, in the coachee’s words', async () => {
    show(undefined, { 'GET /leads?owner=mem-rina': { body: page([lead({ id: 'l-won', name: 'Pak Won', outcome: 'won' })]) } });
    await waitFor(() => expect(screen.getByText('No leads yet.')).toBeInTheDocument());
    const empty = screen.getByText('No leads yet.').closest('[data-variant]') as HTMLElement;
    expect(empty).toHaveAttribute('data-variant', 'empty');
    expect(empty.parentElement).toHaveClass('rounded-lg', 'bg-card');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    await userEvent.type(screen.getByRole('searchbox'), 'nobody');
    expect(rows()).toEqual([]);
    expect(screen.getByText('No lead matches.').closest('[data-variant]')).toHaveAttribute('data-variant', 'filtered');
  });

  it('P19.16-T4 AC-2 waits in /leads’ card skeleton while the leads are read', async () => {
    const { mock } = stubFetch(routes() as Parameters<typeof stubFetch>[0]);
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => (
      url.includes('/leads?owner=') ? new Promise<Response>(() => {}) : mock(url, init))));
    mount();
    const wait = (await screen.findByText('Reading the leads…')).closest('[role="status"]') as HTMLElement;
    expect(wait.querySelectorAll('.rounded-lg.border-card-edge.bg-card').length).toBe(4);
    // The chips wait with no count, never a 0 that is not one.
    expect(within(screen.getByRole('group', { name: 'Lead type' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Sales', 'Recruit']);
    expect(rows()).toEqual([]);
  });

  it('P19.16-T4 AC-1 WhatsApp alone on every card, as on /leads, and live', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    for (const name of ['Desi Pratama', 'Ibu Shinta Maharani', 'Sdri. Laras Wulandari']) {
      expect(screen.getByRole('button', { name: `Send a WhatsApp message to ${name}` })).toBeEnabled();
      expect(screen.queryByRole('button', { name: `Call ${name}` })).not.toBeInTheDocument();
    }
  });

  it('P19.16-T4 AC-3 the closed leads are /leads’ Closed leads, from the same read, newest first, and read-only', async () => {
    const { calls } = show(undefined, {
      'GET /leads?owner=mem-rina': {
        body: page([
          ...LEADS,
          lead({ id: 'l-won-2', name: 'Bu Newer', outcome: 'won', statusCode: 'NOT_YET_APPROACHED', dateRegistered: '2026-09-20T03:00:00.000Z' }),
          lead({ id: 'l-lost', name: 'Pak Lost', type: 'recruitment', outcome: 'lost', statusCode: 'MEETING_SCHEDULED' }),
        ]),
      },
    });
    await screen.findByRole('button', { name: 'Desi Pratama' });
    // No session card's one line on the tab.
    expect(document.querySelector('[data-closed-line]')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Closed leads' })).toBeInTheDocument();
    const won = closedCard(/Successful/);
    expect(within(won).getByText('2')).toBeInTheDocument();
    expect([...won.querySelectorAll('.text-navy.truncate')].map((n) => n.textContent)).toEqual(['Bu Newer', 'Pak Won']);
    expect(won).toHaveTextContent('Sales · Not yet approached');
    expect(won).toHaveTextContent('Sales · Follow-up');
    const lost = closedCard(/Not successful/);
    expect(lost).toHaveTextContent('Pak Lost');
    expect(lost).toHaveTextContent('Recruit · Meeting scheduled');
    // A closed lead is not an open card, and nothing moves back from here — though this leader may mark outcomes.
    expect(rows()).not.toContain('l-won');
    expect(screen.queryByRole('button', { name: /Move to active/ })).not.toBeInTheDocument();
    // One read: the closed lists ask for nothing of their own.
    expect(calls.filter((c) => c.url.includes('/leads?'))).toHaveLength(1);
  });

  it('P19.16-T4 AC-3 with nothing closed, each list says so', async () => {
    show(undefined, { 'GET /leads?owner=mem-rina': { body: page(LEADS.filter((l) => l.outcome === null)) } });
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(closedCard(/Successful/)).toHaveTextContent('No successful leads yet.');
    expect(closedCard(/Not successful/)).toHaveTextContent('No lost leads yet.');
  });

  it('shows a refused read in place, once', async () => {
    show(undefined, { 'GET /leads?owner=mem-rina': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Closed leads' })).not.toBeInTheDocument();
  });

  it('a reader without lead:read meets the refusal and reads no lead', async () => {
    const { calls } = show(undefined, {}, makeMe({ ...LEADER, permissions: ['coaching_session:read'] }));
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    await waitFor(() => expect(screen.getByText(/Not available to you/)).toBeInTheDocument());
    expect(calls.some((c) => c.url.includes('/leads?'))).toBe(false);
  });

  it('UI-006, O-8, P19.16-T4 in Indonesian: the chips, the search, Isi tindakan, Isi tanggal and Leads yang ditutup', async () => {
    show('id');
    await screen.findByRole('button', { name: 'Desi Pratama' });
    const chips = screen.getByRole('group', { name: 'Jenis lead' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua3', 'Sales2', 'Recruit1']);
    expect(document.body).toHaveTextContent('Isi tindakan');
    expect(document.body).toHaveTextContent('Isi tanggal');
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Cari nama lead');
    expect(screen.getByRole('heading', { level: 2, name: 'Leads yang ditutup' })).toBeInTheDocument();
    expect(closedCard(/^✓ Berhasil$/)).toHaveTextContent('Pak Won');
    expect(closedCard(/Tidak berhasil/)).toHaveTextContent('Belum ada leads yang tidak berhasil.');
  });
});
