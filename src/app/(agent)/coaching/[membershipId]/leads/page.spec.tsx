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

const show = (language?: Language, over: Record<string, unknown> = {}, me = LEADER) => {
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
    '/kpm/org-levels': { body: [] },
    'GET /coaching/coachees/mem-rina': { body: RINA },
    'GET /leads?owner=mem-rina': { body: page(LEADS) },
    'GET /leads/l-desi': { body: { ...lead(), history: [] } },
    ...over,
  });
  const tab = <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeLeadsTabPage /></CoachingPersonLayout>;
  const view = language
    ? renderWithSession(<InLanguage language={language}><AgentLayout>{tab}</AgentLayout></InLanguage>, { me })
    : renderInLayout(AgentLayout, tab, { me });
  return { ...stub, ...view };
};

const rows = () => [...document.querySelectorAll('[data-coachee-lead]')].map((li) => li.getAttribute('data-coachee-lead'));

describe('UI-029 — the coachee’s Leads tab (P18.11-T8), writable since the staging review of 2026-10-31', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-029 lists only that agent’s open leads, read once by owner, in the card’s order; the closed in one line', async () => {
    const { calls } = show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(rows()).toEqual(['l-shinta', 'l-laras', 'l-desi']);
    const reads = calls.filter((c) => c.url.includes('/leads?'));
    expect(reads).toHaveLength(1);
    expect(new URL(reads[0].url).searchParams.get('owner')).toBe('mem-rina');
    expect(document.querySelector('[data-closed-line]')).toHaveTextContent('Closed: Won 1 · Lost 0');
    // The shell is the one header; the tab is marked current.
    expect(within(screen.getByRole('navigation', { name: 'Coaching' })).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
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
    // `/leads`' own floating +, and at every width: the tab has no table button to stand in for it on a desktop.
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

  it('staging review 2026-10-31: a row opens the sheet to edit, pinned to the version it read; the row is the answer', async () => {
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

  it('staging review 2026-10-31: never Delete — not in the sheet, not on a row', async () => {
    show(undefined, {}, makeMe({ ...LEADER, permissions: [...LEADER.permissions, 'lead:delete'] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desi Pratama' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Desi Pratama' }));
    expect(sheet.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('staging review 2026-10-31: Isi tindakan opens the sheet on the next action, and Isi tanggal is a date to set', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(screen.getByLabelText('Next action date for Sdri. Laras Wulandari')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add an action' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Shinta Maharani' }));
    await waitFor(() => expect(sheet.getByLabelText('Next action note')).toHaveFocus());
  });

  it('a read-only support session adds nothing and edits nothing: no +, the sheet opens to read', async () => {
    const support = makeMe({ ...LEADER, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-admin' });
    show(undefined, {}, support);
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add an action' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Next action date for/)).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Add an action' })).not.toBeInTheDocument();
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

  it('UI-081 keeps WhatsApp and Call live on every row', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    for (const name of ['Desi Pratama', 'Ibu Shinta Maharani', 'Sdri. Laras Wulandari']) {
      expect(screen.getByRole('button', { name: `Send a WhatsApp message to ${name}` })).toBeEnabled();
      expect(screen.getByRole('button', { name: `Call ${name}` })).toBeEnabled();
    }
  });

  it('shows a refused read in place', async () => {
    show(undefined, { 'GET /leads?owner=mem-rina': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  it('a reader without lead:read meets the refusal and reads no lead', async () => {
    const { calls } = show(undefined, {}, makeMe({ ...LEADER, permissions: ['coaching_session:read'] }));
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    await waitFor(() => expect(screen.getByText(/Not available to you/)).toBeInTheDocument());
    expect(calls.some((c) => c.url.includes('/leads?'))).toBe(false);
  });

  it('UI-006, O-8 in Indonesian: the chips, Isi tindakan, Isi tanggal and the closed line', async () => {
    show('id');
    await screen.findByRole('button', { name: 'Desi Pratama' });
    const chips = screen.getByRole('group', { name: 'Jenis lead' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua3', 'Sales2', 'Recruit1']);
    expect(document.body).toHaveTextContent('Isi tindakan');
    expect(document.body).toHaveTextContent('Isi tanggal');
    expect(document.querySelector('[data-closed-line]')).toHaveTextContent('Ditutup: Berhasil 1 · Tidak berhasil 0');
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Cari leads…');
  });
});
