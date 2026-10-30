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

describe('UI-029 — the coachee’s Leads tab, read-only (P18.99-T8)', () => {
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

  it('UI-029 is read-only: no + Add lead, Isi tindakan and Isi tanggal as words, and the sheet opens to read', async () => {
    show();
    await screen.findByRole('button', { name: 'Desi Pratama' });
    expect(screen.queryByRole('button', { name: /Add lead/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add an action' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Next action date for/)).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent('Add an action');
    expect(document.body).toHaveTextContent('Add a date');

    await userEvent.click(screen.getByRole('button', { name: 'Desi Pratama' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: /^Save$|^Simpan$/ })).not.toBeInTheDocument();
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
