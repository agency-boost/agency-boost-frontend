import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { SessionPrintView } from '@/components/coaching-print-view';
import { activationMessages } from '@/i18n/messages/activation';
import { coachingMessages } from '@/i18n/messages/coaching';
import { coachingLeaderNotesMessages } from '@/i18n/messages/coaching-leader-notes';
import { coachingRecordMessages } from '@/i18n/messages/coaching-record';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import type { Me } from '@/lib/session';
import { leaderView, notFound } from '@test/activation-fixtures';
import { englishOnly, englishShown } from '@test/english-left';
import {
  InLanguage, makeMe, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply,
} from '@test/harness';
import CoacheeActivationTab from './[membershipId]/activation/page';
import CoachingPersonLayout from './[membershipId]/layout';
import CoachingArchivePage from './[membershipId]/archive/[sessionId]/page';
import CoacheeLeaderNotesTab from './[membershipId]/leader-notes/page';
import CoachingSessionTabPage from './[membershipId]/session/page';
import MyCoachingActivationPage from './me/activation/page';
import MyCoachingPage from './me/page';
import CoachingRosterPage from './page';

/**
 * **Coaching in Indonesian** (P18.98-T4 AC-1 to AC-4, coaching and unit): the roster as a table and as a phone's cards,
 * the person shell, a session's workspace — before it starts, as a draft, refused, finalized with *Edit again* asked —
 * its print, a past session's archive, the reader's own coaching and the *Leader Notes* tab. Their words the approved
 * glossary's, each kept term English (§A), what an office or a person typed as typed, and no English message of the
 * module's own left on the screen (`englishShown`); and the *Activation* tab, whose words are the activation's
 * (`messages/activation.ts`, its `record`). English is every other spec's, unchanged.
 */
const nav = vi.hoisted(() => ({ pathname: '/coaching', search: '', params: {} as Record<string, string> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => nav.params,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.pathname = '/coaching';
  nav.search = '';
  nav.params = {};
});
afterEach(() => vi.unstubAllGlobals());

const COACHING_ENGLISH = englishOnly(coachingMessages, coachingSessionMessages, coachingRecordMessages, coachingLeaderNotesMessages);

/**
 * No English message of coaching's own on the screen. The Leads card's table is the leads module's
 * (`components/leads-table.tsx`), moved by its own area, so it is read apart.
 */
const noEnglishLeft = (root: Element = document.body) => {
  const copy = root.cloneNode(true) as Element;
  copy.querySelector('#session-leads')?.remove();
  expect(englishShown(copy, COACHING_ENGLISH)).toEqual([]);
};

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: [
    'coaching_session:read', 'coaching_session:create', 'coaching_session:edit', 'coaching_session:finalize',
    'coaching_session:reopen', 'coaching_session:export_pdf', 'personal_summary:read', 'goal:read', 'goal:update',
    'activity_ratios:read', 'lead:read', 'lead:create', 'lead:update', 'lead:mark_outcome',
    'coaching_profile:read', 'coaching_profile:update', 'leader_notes:read', 'leader_notes:write',
  ],
});

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [{ pipeline: 'sales', statuses: [] }, { pipeline: 'recruitment', statuses: [] }], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};

/** A screen in Indonesian, inside the field shell, as a reader who chose Indonesian reads it. */
const inIndonesian = (page: React.ReactElement, me: Me = LEADER) =>
  renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me });

/*
 * ── The roster ──────────────────────────────────────────────────────────────────────────────────
 */

const rosterRow = (membershipId: string, name: string, over: Record<string, unknown> = {}) => ({
  membershipId, name, rung: { code: 'AGENT', label: 'Agent' }, depth: 1,
  lastOneOnOne: { days: 9, date: '2026-09-23', overdue: true, coach: { membershipId: 'mem-agus', name: 'Agus Santoso' } },
  status: 'watch_closely', ...over,
});
const ROSTER = {
  today: '2026-10-02',
  overdueAfterDays: 7,
  directAgents: [
    rosterRow('mem-rina', 'Rina Wijaya'),
    rosterRow('mem-melati', 'Melati Putri', { lastOneOnOne: null, status: 'no_goal_set' }),
  ],
  units: [{
    head: rosterRow('mem-dimas', 'Dimas Aditya', { rung: { code: 'AAB', label: 'Associate Agency Builder' }, status: 'on_track' }),
    members: [
      rosterRow('mem-tono', 'Tono Saputra', {
        depth: 2, status: 'needs_attention', lastOneOnOne: { days: 0, date: '2026-10-02', overdue: false, coach: null },
      }),
    ],
  }],
};

describe('P18.98-T4 the coaching roster in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same roster in English shows it', async () => {
    expect(COACHING_ENGLISH.length).toBeGreaterThan(100);
    stubFetch({ ...SHELL, '/coaching/coachees': { body: ROSTER } });
    renderInLayout(AgentLayout, <CoachingRosterPage />, { me: LEADER });
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(englishShown(document.body, COACHING_ENGLISH)).toEqual(
      expect.arrayContaining(['Everyone you coach', 'Your direct agents', 'Watch closely', 'My Coaching Notes']),
    );
  });

  it('P18.98-T4 AC-1, AC-2, UI-033 the rows: the title kept, the columns, groups, pills and lines Indonesian; No 1:1 yet grey', async () => {
    stubFetch({ ...SHELL, '/coaching/coachees': { body: ROSTER } });
    inIndonesian(<CoachingRosterPage />);
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(screen.getByRole('heading', { level: 1, name: 'Coaching Session' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Semua orang yang Anda coaching' })).toBeInTheDocument();
    expect(screen.getByText('Terakhir di-coaching oleh').parentElement).toHaveTextContent('Nama1:1 terakhirTerakhir di-coaching olehStatus');
    expect(screen.getByRole('heading', { level: 3, name: /Agen langsung Anda/ })).toHaveTextContent('Agen langsung Anda· 2');
    expect(screen.getByRole('heading', { level: 3, name: 'Unit AAB' })).toBeInTheDocument();
    const row = (name: string) => screen.getByRole('link', { name }).closest('[data-person-row]') as HTMLElement;
    expect(row('Rina Wijaya')).toHaveTextContent('9 hari lalu · terlambat');
    expect(within(row('Rina Wijaya')).getByText('Perlu dipantau')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rina Wijaya' })).toHaveAttribute('href', '/coaching/mem-rina/session');
    const melati = row('Melati Putri').querySelector('[data-roster-line]') as HTMLElement;
    expect(melati).toHaveTextContent('Belum ada 1:1');
    expect(melati).toHaveClass('text-signal-grey');
    expect(row('Melati Putri')).toHaveTextContent('Goal belum diatur');
    expect(row('Dimas Aditya')).toHaveTextContent('Sesuai target');
    expect(row('Tono Saputra')).toHaveTextContent('Hari ini');
    expect(row('Tono Saputra')).toHaveTextContent('Perlu perhatian');
    expect(screen.getByRole('list', { name: 'Unit Dimas Aditya' })).toBeInTheDocument();
    expect(screen.queryByText('Coaching Anda sendiri')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catatan coaching saya' })).toHaveAttribute('href', '/coaching/me');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a reader nobody reports to', async () => {
    stubFetch({ ...SHELL, '/coaching/coachees': { body: { ...ROSTER, directAgents: [], units: [] } } });
    inIndonesian(<CoachingRosterPage />);
    expect(await screen.findByText('Belum ada orang yang Anda coaching.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

/*
 * ── A person, and the session ───────────────────────────────────────────────────────────────────
 */

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
  today: '2026-10-02',
};
const AGUS = { membershipId: 'mem-agus', name: 'Agus Santoso' };
const M = 1_000_000 * 100;

const session = (over: Record<string, unknown> = {}) => ({
  sessionId: 's-1', coachee: { membershipId: 'mem-rina', name: 'Rina Wijaya' }, coach: AGUS,
  status: 'draft', version: 1, date: null, startedAt: '2026-10-02T02:00:00.000Z',
  finalizedAt: null, finalizedBy: null, reopenableUntil: null,
  lastWeek: { sessionId: 's-0924', date: '2026-09-24' },
  lastWeekItems: [
    { itemId: 'lw-1', text: 'Confirm submission paperwork with Bp. Andi', dueDate: '2026-09-24', lead: null, done: true },
    { itemId: 'lw-2', text: 'Call Alvin about the illustration', dueDate: '2026-09-24', lead: { leadId: 'l-alvin', name: 'Alvin Sanjaya' }, done: false },
  ],
  leadActions: [
    { leadId: 'l-desi', leadName: 'Desi Pratama', dueDate: '2026-10-05', text: 'Collect the signed SPAJ' },
    { leadId: 'l-hana', leadName: 'Hana Permata', dueDate: '2026-10-07', text: null },
  ],
  actionItems: [{ itemId: 'a-1', text: 'Practice a tighter close', dueDate: null }],
  tips: [{ tipId: 't-1', text: 'Slow down on the opening line.' }],
  snapshot: null,
  earlier: [],
  ...over,
});
const finalized = (over: Record<string, unknown> = {}) => session({
  status: 'finalized', version: 3, date: '2026-10-02', finalizedAt: '2026-10-02T03:00:00.000Z', finalizedBy: AGUS,
  reopenableUntil: '2026-10-09', ...over,
});

const figures = (target: number, actual: number, pct: number, gap: number) => ({
  targetMinor: target, actualMinor: actual, attainmentPct: pct, gapMinor: gap, overMinor: 0, policiesNeeded: 1, targetMet: false,
});
const none = { from: '2026-10-01', to: '2026-10-02', targets: [], total: 0, sections: [] };
const SUMMARY = {
  year: '2026', month: '2026-10', today: '2026-10-02', goal: { set: true, savedAt: null }, caseSizeMinor: 18 * M,
  period: { firstMonth: '2026-01', thisMonth: '2026-10', currentMonth: true, currentYear: true },
  monthly: { ...figures(80 * M, 65.6 * M, 82, 14.4 * M), source: { provenance: 'imported', month: '2026-09' } },
  yearly: { ...figures(960 * M, 620 * M, 65, 340 * M), source: { provenance: 'imported', month: '2026-09' } },
  pace: null, activity: { monthly: none, yearly: none }, leads: { rows: [], total: 0 }, insights: [],
};
const ratio = (over: Record<string, unknown> = {}) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15,
  tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false,
  value: 0.18, share: null, numeratorCount: 9, denominatorCount: 50, status: 'success', ...over,
});
const RATIOS = {
  membershipId: 'mem-rina', from: '2026-09-03', to: '2026-10-02', days: 30,
  ratios: [
    ratio(),
    ratio({
      code: 'SALES_VS_RECRUITMENT', label: 'Sales vs. Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
      value: 40, share: 70, sides: { numerator: 'Selling', denominator: 'Recruitment' }, status: 'alert',
    }),
  ],
};
const WEEK = {
  from: '2026-09-26', to: '2026-10-02', totals: [], daysLogged: 5, totalCount: 20,
  targets: [
    { key: 'leads', code: 'LEADS_CONTACTED', logged: 14, target: 16 },
    { key: 'appointments', code: 'SELL_PRESENTATION', logged: 4, target: 5 },
    { key: 'closings', code: 'SELL_SUBMISSION', logged: 1, target: null },
  ],
  sections: [{ code: 'DEVELOPMENT', label: 'Development', total: 2, rows: [{ code: 'DEV_TRAINING', label: 'Training attended', count: 2 }] }],
};
const leadRows = { body: { rows: [], total: 0, page: 1, pageSize: 200 } };

const sessionRoutes = (current: unknown, read: unknown = session(), over: Record<string, StubReply | StubReply[]> = {}) => ({
  ...SHELL,
  'GET /coaching/coachees/mem-rina': { body: RINA },
  'GET /coaching/coachees/mem-rina/sessions': {
    body: {
      today: '2026-10-02', current,
      sessions: [{ sessionId: 's-0924', date: '2026-09-24', coach: AGUS, actionItemCount: 3, completedCount: 1 }],
    },
  },
  'GET /coaching/sessions/s-1': { body: read },
  '/summary?for=mem-rina': { body: SUMMARY },
  '/activity/ratios?for=mem-rina': { body: RATIOS },
  '/activity/summary?': { body: WEEK },
  'GET /leads?owner=mem-rina': leadRows,
  ...over,
});

const openSession = () => {
  nav.pathname = '/coaching/mem-rina/session';
  return inIndonesian(<CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoachingSessionTabPage /></CoachingPersonLayout>);
};
const card = (name: string | RegExp) => screen.findByRole('region', { name });

describe('P18.98-T4 a person and their session in Indonesian', () => {
  it('P18.98-T4 AC-1, AC-2, UI-029, UI-041 the person shell: the line under the name, no view switch, the tabs kept, the way back', async () => {
    stubFetch(sessionRoutes(null));
    openSession();
    expect(await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' })).toBeInTheDocument();
    expect(screen.getByText('Agent · Unit langsung')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tampilan' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Tampilan leader|Tampilan Agent/)).not.toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Coaching' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Coaching Session', 'Activity', 'Leads', 'Goal Setting', 'Personal Summary', 'Activation', 'Training', 'Capability mapping',
    ]);
    expect(screen.getByRole('link', { name: '← Kembali ke Coaching Session' })).toHaveAttribute('href', '/coaching');
  });

  it('P18.98-T4 AC-1, UI-032 before it starts: the card, its tag, the past sessions as rows and Mulai sesi coaching', async () => {
    stubFetch(sessionRoutes(null));
    openSession();
    const start = await screen.findByRole('button', { name: 'Mulai sesi coaching' });
    const card0 = document.querySelector('[data-session-card="session"]') as HTMLElement;
    expect(card0).toContainElement(start);
    expect(within(card0).getByRole('heading', { level: 2 })).toHaveTextContent(/^Sesi hari ini ?Jumat, 2 Okt 2026$/);
    expect(within(card0).getByText('Belum dimulai')).toBeInTheDocument();
    expect(within(card0).getByRole('link', { name: '24 Sep 2026 · 3 tindakan · 1 selesai' })).toHaveAttribute('href', '/coaching/mem-rina/archive/s-0924');
    expect(screen.queryByText(/Membuka item minggu lalu/)).not.toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 to AC-4, UI-061, UI-062 a draft: every card’s words Indonesian, the kept terms English, what was typed as typed', async () => {
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'draft' }));
    openSession();
    const lastWeek = await card('Tindakan minggu lalu');
    expect(lastWeek).toHaveTextContent('Dari sesi 24 Sep');
    expect(within(lastWeek).getByText('Alvin Sanjaya')).toBeInTheDocument();
    expect(within(lastWeek).getByText('Confirm submission paperwork with Bp. Andi')).toBeInTheDocument();
    expect(within(lastWeek).getAllByLabelText(/^Ubah tanggal: /)).toHaveLength(2);
    expect(screen.getByText('Draf')).toBeInTheDocument();

    const goal = await card('Goal');
    await within(goal).findByText(/Rp 65,6 jt/);
    expect(goal).toHaveTextContent('Bulan ini');
    expect(goal).toHaveTextContent('Tahun ini');
    expect(within(goal).getByText('Ketuk target tahun ini untuk mengubah')).toBeInTheDocument();
    expect(within(goal).getByRole('progressbar', { name: 'Target bulan ini' })).toBeInTheDocument();

    const ratios = await card('Ratio · 30 hari terakhir');
    expect(await within(ratios).findByText('Target 15%')).toBeInTheDocument();

    const activity = await card('Aktivitas');
    expect(within(activity).getByRole('button', { name: '7 hari terakhir' })).toBeInTheDocument();
    await within(activity).findByText('Set appointment');
    expect(activity).toHaveTextContent('14 / 16');
    expect(activity).toHaveTextContent('16 prorata');
    expect(within(activity).getByText('Belum ada target')).toBeInTheDocument();
    expect(within(activity).getByRole('progressbar', { name: 'Set appointment terhadap target prorata' }))
      .toHaveAttribute('aria-valuetext', '14 dari 16');

    const tips = await card('Tips coaching');
    expect(within(tips).getByRole('button', { name: 'Tambah tips' })).toBeInTheDocument();
    expect(within(tips).getByLabelText('Tips 1')).toHaveValue('Slow down on the opening line.');
    expect(within(tips).getByRole('button', { name: 'Hapus tips 1' })).toBeInTheDocument();

    const next = await card('Tindakan berikutnya');
    expect(within(next).getByRole('heading', { name: /Dari leads$/ })).toBeInTheDocument();
    expect(next).not.toHaveTextContent('(otomatis)');
    expect(within(next).getByText('Collect the signed SPAJ')).toBeInTheDocument();
    expect(within(next).getByText('Lakukan follow up dengan Hana Permata')).toBeInTheDocument();
    expect(within(next).getByRole('heading', { name: 'Lainnya' })).toBeInTheDocument();
    expect(within(next).getByLabelText('Tindakan 1')).toHaveAttribute('placeholder', 'Apa yang perlu dilakukan…');
    expect(within(next).getByRole('button', { name: 'Tambah tindakan' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Finalkan sesi ini' })).toBeInTheDocument();
    expect(document.querySelector('[data-finalize-bar="draft"]')).toHaveTextContent(/^Draf · \d+ tindakan/);
    expect(screen.getByRole('region', { name: /^Leads/ })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the Activity drill: its dialog and its table', async () => {
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'draft' }));
    openSession();
    const drill = await screen.findByRole('button', { name: '7 hari terakhir' });
    await waitFor(() => expect(drill).toBeEnabled());
    await userEvent.click(drill);
    const dialog = await screen.findByRole('dialog', { name: 'Rina Wijaya — Activity Dashboard' });
    expect(within(dialog).getByText('7 hari terakhir · rincian per kategori')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Kategori', 'Tercatat', 'Target (prorata)']);
    expect(within(dialog).getByRole('row', { name: /Training attended/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a refused finalize says the prototype’s sentence in Indonesian', async () => {
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'draft' }, session(), {
      'POST /coaching/sessions/s-1/finalize': {
        status: 422, body: { error: { code: 'COACHING_SESSION_INCOMPLETE', message: 'Incomplete.', requestId: 'r-1', details: { rule: 'UNDATED_ACTION_ITEM' } } },
      },
    }));
    openSession();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalkan sesi ini' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Setiap tindakan perlu tanggal sebelum memfinalkan.');
  });

  it('UI-060, UI-062 the new words in Indonesian: the count above Finalkan, Tampilkan semua, Ditutup, the action row’s Pilih tanggal', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `l-${i}`, ownerMembershipId: 'mem-rina', type: 'sales', name: `Lead ${i}`, contact: { phone: null, email: null },
      statusCode: null, thisMonth: false, remarks: null, nextActionDate: `2026-10-1${i}`, nextActionNote: 'Telepon',
      outcome: null, source: null, dateRegistered: null, version: 1, flags: [], overdueDays: null, committedMonths: [], lastEditedBy: null,
    }));
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'draft' }, session({ actionItems: [{ itemId: 'a-1', text: 'Tanpa tanggal', dueDate: null }] }), {
      'GET /leads?owner=mem-rina': { body: { rows: many, total: 6, page: 1, pageSize: 200 } },
      'POST /coaching/sessions/s-1/finalize': {
        status: 422,
        body: { error: { code: 'COACHING_SESSION_INCOMPLETE', message: 'Incomplete.', requestId: 'r-1', details: { rule: 'UNDATED_ACTION_ITEM', count: 1, itemIds: ['a-1'] } } },
      },
    }));
    openSession();
    expect(await screen.findByRole('button', { name: 'Tampilkan semua (6)' })).toBeInTheDocument();
    expect(document.querySelector('[data-closed-line]')).toHaveTextContent('Ditutup: Berhasil 0 · Tidak berhasil 0');
    await userEvent.click(screen.getByRole('button', { name: 'Finalkan sesi ini' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Setiap tindakan perlu tanggal sebelum memfinalkan. (1)');
    expect(document.querySelector('[data-action-row][data-invalid]')).toHaveTextContent('Pilih tanggal');
  });

  it('P18.98-T4 AC-1 finalized: the badge, Edit again and its question, Download as PDF', async () => {
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'finalized' }, finalized()));
    openSession();
    expect(await screen.findByText('Difinalkan 2 Okt')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Unduh sebagai PDF' }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Ubah lagi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ubah sesi ini lagi?' });
    expect(dialog).toHaveTextContent(
      'Jelaskan mengapa sesi ini perlu diubah. Alasannya tersimpan bersama sesi, dan semua orang yang membaca sesi ini akan membacanya — termasuk Rina Wijaya.',
    );
    expect(within(dialog).getByLabelText('Alasan')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Ubah lagi' })).toBeDisabled();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 past the window: Edit again held, saying until when', async () => {
    stubFetch(sessionRoutes({ sessionId: 's-1', status: 'finalized' }, finalized({ date: '2026-09-24', reopenableUntil: '2026-10-01' })));
    openSession();
    const edit = await screen.findByRole('button', { name: 'Ubah lagi' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit).toHaveAccessibleDescription('Sesi ini bisa dibuka kembali sampai 1 Okt 2026.');
  });

  it('P18.98-T4 AC-1 a person the reader does not coach', async () => {
    stubFetch({
      ...SHELL,
      'GET /coaching/coachees/mem-rina': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-1' } } },
      'GET /coaching/coachees/mem-rina/sessions': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-2' } } },
    });
    openSession();
    expect(await screen.findByRole('heading', { level: 2, name: 'Orang ini bukan orang yang Anda coaching.' })).toBeInTheDocument();
    expect(screen.getByText(
      'Mungkin dia sudah pindah ke leader lain, atau alamatnya salah ketik. Semua orang yang Anda coaching ada di Coaching Session.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });
});

/*
 * ── The print, the archive and the reader's own coaching ────────────────────────────────────────
 */

describe('P18.98-T4 the record in Indonesian', () => {
  it('P18.98-T4 AC-1, AC-4 the print: its headings and lines Indonesian, the title kept, what was typed as typed', () => {
    render(
      <InLanguage language="id">
        <SessionPrintView
          showCoach
          print={{
            sessionId: 's-1', version: 3, date: '2026-10-02', coachee: { name: 'Rina Wijaya' }, coach: { name: 'Agus Santoso' },
            lastWeekItems: [{ text: 'Confirm the paperwork', done: true }],
            goal: { currency: 'IDR', monthly: { targetMinor: 80 * M, actualMinor: 65.6 * M }, yearly: { targetMinor: 960 * M, actualMinor: null } },
            tips: [],
            leadActions: [{ dueDate: '2026-10-03', text: '', leadName: 'Desi' }],
            actionItems: [],
          }}
        />
      </InLanguage>,
    );
    const paper = document.querySelector('[data-print-view]')!;
    expect(within(paper as HTMLElement).getByRole('heading', { level: 1 })).toHaveTextContent('Coaching Session — Rina Wijaya');
    expect(paper).toHaveTextContent('Jumat, 2 Okt 2026 · Di-coaching oleh Agus Santoso · Final');
    expect(paper).toHaveTextContent('Tindakan minggu lalu');
    expect(paper).toHaveTextContent('[x] Confirm the paperwork');
    expect(paper).toHaveTextContent('Bulan ini: Rp 65,6 jt / Rp 80 jt');
    expect(paper).toHaveTextContent('Tahun ini: Belum diunggah / Rp 960 jt');
    expect(paper).toHaveTextContent('Tips coaching');
    expect(paper).toHaveTextContent('Tindakan berikutnya — dari leads');
    expect(paper).toHaveTextContent('1. 3 Okt — Lakukan follow up dengan Desi (Leads: Desi)');
    expect(paper).toHaveTextContent('Tindakan berikutnya — lainnya');
    expect(within(paper as HTMLElement).getAllByText('Tidak ada yang ditambahkan.')).toHaveLength(2);
    noEnglishLeft(paper);
  });

  const recordSession = (over: Record<string, unknown> = {}) => session({
    sessionId: 's-0924', status: 'finalized', version: 4, date: '2026-09-24', finalizedAt: '2026-09-25T03:00:00.000Z',
    finalizedBy: AGUS, reopenableUntil: '2026-10-01', lastWeek: { sessionId: 's-0917', date: '2026-09-17' },
    snapshot: {
      takenAt: '2026-09-24T03:00:00.000Z',
      goal: {
        period: '2026', month: '2026-09', currency: 'IDR',
        monthly: { targetMinor: 80 * M, actualMinor: 65.6 * M, attainmentPct: 82, gapMinor: 14.4 * M, targetMet: false },
        yearly: { targetMinor: 960 * M, actualMinor: 620 * M, attainmentPct: 65, gapMinor: 340 * M, targetMet: false },
        source: { provenance: 'imported', month: '2026-08' },
      },
      ratios: { from: '2026-08-26', to: '2026-09-24', days: 30, rows: [] },
      activity: { from: '2026-09-18', to: '2026-09-24', targets: [], sections: [] },
    },
    earlier: [{
      finalizedAt: '2026-09-24T03:00:00.000Z', finalizedBy: AGUS, reopenedAt: '2026-09-25T02:00:00.000Z', reopenedBy: AGUS,
      reason: 'Two action items had the wrong dates.',
      lastWeekItems: [], leadActions: [], actionItems: [], tips: [],
    }],
    ...over,
  });

  const openArchive = (read: StubReply, person: StubReply = { body: { ...RINA, today: '2026-09-28' } }) => {
    nav.pathname = '/coaching/mem-rina/archive/s-0924';
    nav.params = { membershipId: 'mem-rina', sessionId: 's-0924' };
    stubFetch({ ...SHELL, '/coaching/coachees/mem-rina': person, '/coaching/sessions/s-0924': read });
    return inIndonesian(
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoachingArchivePage /></CoachingPersonLayout>,
    );
  };

  it('P18.98-T4 AC-1 to AC-4 a past session’s archive: the record’s header, its earlier version and its reason as typed', async () => {
    openArchive({ body: recordSession() });
    const earlier = await card('Versi sebelumnya');
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Sesi — Kamis, 24 Sep 2026 Final')).toBeInTheDocument();
    expect(screen.getByText('Di-coaching oleh Agus Santoso')).toBeInTheDocument();
    expect(earlier).toHaveTextContent('Difinalkan 24 Sep 2026 oleh Agus Santoso');
    expect(earlier).toHaveTextContent('Dibuka kembali 25 Sep 2026 oleh Agus Santoso');
    expect(earlier).toHaveTextContent('Alasan: Two action items had the wrong dates.');
    await userEvent.click(within(earlier).getByRole('button', { name: 'Lihat yang disepakati' }));
    expect(within(earlier).getByRole('button', { name: 'Sembunyikan yang disepakati' })).toBeInTheDocument();
    expect(within(earlier).getAllByText('Tidak ada tips yang ditambahkan di sesi ini.')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Goal' })).toHaveTextContent('Sisa Rp 14,4 jt untuk bulan ini.');
    expect(screen.getByRole('region', { name: /^Rasio/ })).toHaveTextContent('Belum ada ratio untuk perannya.');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a draft’s address, and one the reader cannot open', async () => {
    const { unmount } = openArchive({ body: recordSession({ status: 'draft', earlier: [] }) });
    expect(await screen.findByRole('heading', { level: 2, name: 'Sesi ini belum difinalkan.' })).toBeInTheDocument();
    expect(screen.getByText('Sampai difinalkan, sesi ini terbuka di Coaching Session.')).toBeInTheDocument();
    noEnglishLeft();
    unmount();
    vi.unstubAllGlobals();
    openArchive({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-1' } } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Anda tidak dapat membuka sesi ini.' })).toBeInTheDocument();
    expect(screen.getByText('Mungkin alamatnya salah ketik. Semua orang yang Anda coaching ada di Coaching Session.')).toBeInTheDocument();
  });

  it('P18.98-T4 AC-1 the reader’s own coaching: its line, its tabs kept, its history and the sessions they led', async () => {
    nav.pathname = '/coaching/me';
    stubFetch({
      ...SHELL,
      '/coaching/me/sessions': {
        body: {
          sessions: [{ sessionId: 's-0924', date: '2026-09-24', coach: { membershipId: 'mem-w', name: 'Wilson Tanoto' }, actionItemCount: 2, completedCount: 1 }],
          ledFormerly: [{ sessionId: 's-led', date: '2026-08-20', coachee: { membershipId: 'mem-bayu', name: 'Bayu Pratama' }, actionItemCount: 1, completedCount: 1 }],
        },
      },
      '/coaching/sessions/s-0924': {
        body: recordSession({ coachee: { membershipId: 'mem-agus', name: 'Agus Santoso' }, coach: { membershipId: 'mem-w', name: 'Wilson Tanoto' }, reopenableUntil: null }),
      },
    });
    inIndonesian(<MyCoachingPage />);
    expect(await card('Tips coaching dari Wilson')).toBeInTheDocument();
    expect(screen.getByText(/· Coaching Anda sendiri$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lihat sesi sebelumnya' }));
    expect(screen.getByRole('link', { name: /2 tindakan · 1 selesai Di-coaching oleh Wilson Tanoto/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sesi yang Anda pimpin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bayu Pratama · 1 tindakan · 1 selesai Lihat →/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /^Rasio/ })).toHaveTextContent('Belum ada ratio untuk peran Anda.');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the reader’s own coaching, with no session yet', async () => {
    nav.pathname = '/coaching/me';
    stubFetch({ ...SHELL, '/coaching/me/sessions': { body: { sessions: [], ledFormerly: [] } } });
    inIndonesian(<MyCoachingPage />);
    expect(await screen.findByText('Belum ada sesi coaching.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

/*
 * ── Leader Notes ────────────────────────────────────────────────────────────────────────────────
 */

const item = (code: string, label: string, displayOrder: number, status: 'active' | 'archived' = 'active') => ({ code, label, displayOrder, status });
const CATALOG = {
  stages: [
    { ...item('COMPETENT_PRODUCER', 'Competent Producer', 1), stageOrder: 1, requiredMilestoneCodes: ['M1'] },
    { ...item('INDEPENDENT_PRODUCER', 'Independent Producer', 2), stageOrder: 2, requiredMilestoneCodes: ['M1', 'M2'] },
  ],
  milestones: [item('M1', 'Sells policies independently', 1), item('M2', 'Sells outside direct network', 2, 'archived')],
  grids: [
    { ...item('PERSONAL_SELLING', 'Personal selling', 1), requiresDownline: false, items: [item('LEADS_GEN', 'Leads generation consistency', 1)] },
    { ...item('DEVELOPING_DOWNLINE_AGENT', 'Developing downline agent', 2), requiresDownline: true, items: [item('AGENT_VISIBILITY', 'Visibility into progress', 1)] },
  ],
};

describe('P18.98-T4 Leader Notes in Indonesian', () => {
  it('P18.98-T4 AC-1 to AC-4 the capability mapping, the skill tracker and the personal notes', async () => {
    nav.pathname = '/coaching/mem-rina/leader-notes';
    const { calls } = stubFetch({
      ...SHELL,
      'GET /coaching/coachees/mem-rina': { body: RINA },
      'GET /coaching/coachees/mem-rina/profile': {
        body: {
          catalog: CATALOG, milestoneCodes: ['M1', 'M2'], skillCodes: ['LEADS_GEN'], stageCode: 'INDEPENDENT_PRODUCER', version: 3,
          updatedAt: '2026-09-30T03:00:00.000Z', updatedBy: AGUS,
        },
      },
      'GET /coaching/coachees/mem-rina/leader-notes': {
        body: {
          mine: { noteId: 'n-1', text: 'Strong closer.', version: 2, updatedAt: '2026-09-30T03:00:00.000Z' },
          others: [{ noteId: 'n-2', author: { membershipId: 'mem-sari', name: 'Sari Wulandari' }, text: 'Watch her load.', updatedAt: '2026-09-29T03:00:00.000Z' }],
        },
      },
      'PUT /coaching/coachees/mem-rina/leader-notes': { body: { noteId: 'n-1', version: 3, updatedAt: '2026-10-02T03:00:00.000Z' } },
    });
    inIndonesian(<CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeLeaderNotesTab /></CoachingPersonLayout>);

    // UI V1 (UI-035, UI-038): the tile shows the current stage only — the office's label, as typed — with the pill and
    // the tile's button in Indonesian, *Capability mapping* kept, no *Saat ini:* pill; the privacy line is the ⓘ.
    const mapping = await card('Capability mapping');
    expect(within(mapping).getByText('Independent Producer')).toBeInTheDocument();
    expect(within(mapping).getByText('Tahap saat ini')).toBeInTheDocument();
    expect(mapping.textContent).not.toMatch(/Saat ini:/);
    const ladder = within(mapping).getByRole('button', { name: 'Capability mapping: Independent Producer. Tampilkan semua tahap.' });
    expect(within(mapping).getByRole('button', { name: 'Khusus leader, tidak pernah ditampilkan kepada Rina Wijaya' })).toBeInTheDocument();
    // *Skill tracker* kept English (UI-006, UI-036); its reason Indonesian.
    const tracker = await card('Skill tracker');
    expect(tracker).toHaveTextContent('Tidak berlaku — dia belum punya agen di bawahnya.');
    expect(screen.queryByText('Pelacak skill')).not.toBeInTheDocument();
    const notes = await card(/^Catatan pribadi$/);
    expect(notes.textContent).not.toMatch(/Khusus leader/);
    expect(within(notes).getByRole('textbox')).toHaveValue('Strong closer.');
    const other = await card('Catatan pribadi dari Sari Wulandari');
    expect(other).toHaveTextContent('Dari Sari Wulandari');
    expect(other).toHaveTextContent('Watch her load.');
    noEnglishLeft();

    await userEvent.click(within(notes).getByRole('button', { name: 'Simpan catatan' }));
    expect(await screen.findByText('Catatan pribadi tersimpan.')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(true);

    // The ladder the tile opens (UI-035): the current stage's pill, and a ticked milestone the office archived, marked.
    await userEvent.click(ladder);
    const sheet = await screen.findByRole('dialog', { name: 'Capability mapping' });
    expect(within(sheet).getByText('Tahap saat ini')).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: 'Sells outside direct network Diarsipkan' })).toBeChecked();
    noEnglishLeft();
  });
});

/*
 * ── The Activation tab ──────────────────────────────────────────────────────────────────────────
 */

describe('P18.98-T4 the coaching Activation tab in Indonesian', () => {
  // UI V1 (UI-029): the tab is the coachee's own new-hire detail, so its words are the activation's, New Hires' and the
  // shared ⚡'s.
  const ACTIVATION_ENGLISH = englishOnly(activationMessages, newHiresMessages, uiV1Messages);
  const noActivationEnglishLeft = () => expect(englishShown(document.body, ACTIVATION_ENGLISH)).toEqual([]);
  const row = (code: string) => document.querySelector(`[data-code="${code}"]`) as HTMLElement;

  it('P18.98-T4 AC-1 to AC-4, UI-029 a coachee’s: their new-hire detail, *activation* kept, its percentage, each item’s state, the items as typed', async () => {
    nav.pathname = '/coaching/mem-rina/activation';
    stubFetch({ ...SHELL, '/coaching/coachees/': { body: RINA }, 'GET /new-hires/mem-rina': { body: leaderView() } });
    inIndonesian(<CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivationTab /></CoachingPersonLayout>);
    expect(await screen.findByRole('heading', { level: 2, name: 'Progres activation' })).toBeInTheDocument();
    expect(screen.getByText('31% selesai')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progres activation' })).toHaveAttribute('aria-valuetext', '31% selesai');
    // Ticked by hand: its box, and who ticked it when, in Indonesian; the office's label as typed.
    expect(within(row('INSURANCE_BASICS')).getByRole('checkbox', { name: 'Learn insurance basics' })).toBeChecked();
    expect(within(row('INSURANCE_BASICS')).getByRole('button', { name: 'Dicentang oleh Rina Wijaya · 10 Agu 2026' })).toBeInTheDocument();
    // Not done: an empty box and nothing else.
    expect(within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' })).not.toBeChecked();
    expect(row('CRM_SETUP')).toHaveTextContent(/^Set up company CRM system$/);
    // Completed by the sales data: ✓, the ⚡ named *Otomatis*, and its rule and source behind the ⓘ, in Indonesian.
    const firstSale = row('FIRST_CASE_CLOSED');
    expect(firstSale).toHaveTextContent(/^✓Close first case independently/);
    expect(within(firstSale).getByText('Otomatis')).toBeInTheDocument();
    expect(within(firstSale).getByRole('button', { name: 'Kenapa Close first case independently otomatis' }))
      .toHaveAccessibleDescription(/^Selesai saat .+\. Diselesaikan dari Sales data · 20 Sep 2026$/);
    noActivationEnglishLeft();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a coachee with no activation, and the reader with none', async () => {
    nav.pathname = '/coaching/mem-rina/activation';
    stubFetch({ ...SHELL, '/coaching/coachees/': { body: RINA }, 'GET /new-hires/mem-rina': notFound });
    const { unmount } = inIndonesian(
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivationTab /></CoachingPersonLayout>,
    );
    expect(await screen.findByText('Rina Wijaya tidak punya 90-day activation.')).toBeInTheDocument();
    noActivationEnglishLeft();
    unmount();
    vi.unstubAllGlobals();
    nav.pathname = '/coaching/me/activation';
    stubFetch({ ...SHELL, 'GET /activation/me': notFound });
    inIndonesian(<MyCoachingActivationPage />);
    expect(await screen.findByText('Anda tidak punya 90-day activation.')).toBeInTheDocument();
    expect(screen.getByText(/· Coaching Anda sendiri$/)).toBeInTheDocument();
    noActivationEnglishLeft();
    noEnglishLeft();
  });
});
