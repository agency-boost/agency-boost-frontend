import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SubscriptionDialog } from '@/components/subscription-dialog';
import { InLanguage, browserChose, makeMe, makeSession, renderInIndonesian, renderWithLanguage, resetLanguage, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminAuditMessages } from '@/i18n/messages/admin-audit';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { adminApprovalsMessages } from '@/i18n/messages/admin-approvals';
import { billingMessages } from '@/i18n/messages/billing';
import { officeSubscriptionMessages } from '@/i18n/messages/office-subscription';
import { supportBannerMessages } from '@/i18n/messages/support-banner';
import { supportSessionMessages } from '@/i18n/messages/support-session';
import { leadersSaid, subscriptionLine, tenantStatusLabels, tenantStatusWord, type TenantRow } from '@/lib/admin';
import { costMissingWords, policiesText, type BillingPrices } from '@/lib/billing';
import { SessionContext } from '@/lib/session';
// P19.23-T6 (ADR-0279): the audit log moved under *Platform*.
import AuditPage from './platform/audit/page';
import BillingPage from './billing/page';
import ImpersonatePage from './impersonate/[userId]/page';
import RetiredApprovalAddress from './impersonation/[sessionId]/page';
import ApprovalsPage from './approvals/page';
import TenantAdminsPage from './tenant-admins/page';
import AssignOwnerPage from './tenants/[kpmId]/owner/page';
import RetiredRosterAddress from './tenants/[kpmId]/roster/page';
// P19.23 (ADR-0277 §7, §8; ADR-0279): the console's moved and retired addresses, each a redirect.
import RetiredAnalyticsAddress from './analytics/page';
import MovedAuditAddress from './audit/page';
import RetiredKpmRequestsAddress from './kpm-requests/page';
import RetiredLeaderLimitAddress from './leader-limit-requests/page';
import PlatformIndex from './platform/page';
import RetiredNewKpmAddress from './tenants/new/page';

/**
 * **The Super Admin's console in Indonesian** (P18.10-T6 AC-1, as T4's AC-1 to AC-4): every screen of the console this
 * area moved — the Overview, *All KPMs* with *Edit subscription*, *New office*, an office's page, *Assign owner* ·
 * *Transfer owner*, *KPM Owners & Admins*, *Billing & subscription* with its dialog and quote, *Cross-platform
 * analytics*, the audit log, the two queues, a support session's start page and its banner. (*Import a roster* and
 * *Approve a support session to write* are retired by P19.4-T2, ADR-0206: their addresses redirect.)
 *
 * Each in its main state: the approved glossary's words (`i18n/messages/admin-*.ts(x)`, `billing.tsx`,
 * `support-*.ts(x)`, `office-subscription.ts`), the kept terms English (§A), what an office or a person typed as typed,
 * the figures in Indonesian, and no English message of the console's own left (`englishShown`). English is the pages'
 * own specs', unchanged. The shared pieces' words (`components/ui/`, `Page`'s refusal) are another area's.
 */
const nav = vi.hoisted(() => ({ pathname: '/admin', search: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
}));

const AREAS = [
  adminOfficesMessages, adminAuditMessages, adminApprovalsMessages,
  billingMessages, officeSubscriptionMessages, supportSessionMessages, supportBannerMessages,
];
const ENGLISH = englishOnly(...AREAS);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: [
    'kpm:list_all', 'kpm:create', 'kpm:read_profile', 'kpm:suspend', 'kpm:assign_owner',
    'company:crud', 'audit_log:read', 'platform_metrics:read', 'platform_analytics:read', 'billing:read_prices',
    'kpm_request:read', 'kpm_request:decide', 'leader_limit_request:read', 'leader_limit_request:decide',
    'kpm_admin:list_platform', 'impersonation:start',
  ],
});
const SHELL = { '/notifications': { body: { items: [], total: 0, page: 1, pageSize: 1, unread: 0 } } };

const inIndonesian = (path: string, page: React.ReactElement, me = SUPER_ADMIN) => {
  nav.pathname = path;
  return renderInIndonesian(<AdminLayout>{page}</AdminLayout>, { me });
};

const SUBSCRIPTION = {
  startDate: '2026-01-06', endDate: '2027-01-05', pricePerLeaderMinor: 350_000_00, currency: 'IDR' as const,
  maxLeaders: 10, keepActiveAfterEnd: false,
};
const KPM = {
  _id: 'kpm-1', companyId: 'co-1', companyName: 'Prudential', code: '0417', branchName: 'BSD City Branch',
  address: 'Jl. Raya Serpong', contactPhone: null, ownerUserId: 'u-owner', ownerName: 'Rina Wijaya',
  ownerEmail: 'rina@kpm0417.test', timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active' as const,
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z', settings: {},
  subscription: SUBSCRIPTION, leadersUsed: 13, subscriptionState: 'active' as const,
};

const rp = (major: number) => major * 100;
/** `GET /admin/billing/prices` (P19.23-T5; ADR-0279 §1): the price list and the calculator's numbers. */
const PRICES: BillingPrices = {
  currency: 'IDR',
  tiers: [
    { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), offerMinor: rp(400_000), customPricing: false },
    { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), offerMinor: rp(375_000), customPricing: false },
    { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: null, offerMinor: null, customPricing: true },
  ],
  annualDiscountPct: 5, trialDays: 30, graceDays: 7, endingSoonDays: 30, daysPerMonth: 30, perDayRoundingMinor: rp(100),
  bulkPercentMax: 100, noteMax: 500, kpmNameMax: 120, countMax: 10_000, rateMaxMinor: rp(100_000_000),
  breakEven: { policyApeMinor: rp(20_000_000), commissionPct: 20, overridingPct: 10, bonusPct: 10, incomePerPolicyMinor: rp(8_000_000) },
};
const BILLING_ROW = {
  kpmId: 'kpm-1', code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' }, kpmStatus: 'active',
  owner: { fullName: 'Rina Wijaya', phone: null }, leadersUsed: 9, maxLeaders: 10,
  tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, rateMinor: rp(350_000), customPrice: true, plan: 'annual',
  trial: false, startDate: '2026-01-06', endDate: '2027-01-05', perMonthMinor: rp(3_325_000), periodTotalMinor: rp(39_900_000),
  graceEndsOn: null, attention: null, needsAction: false, agents: null, bulkDiscount: null, note: null,
};
const BILLING_LIST = {
  summary: { monthlyRevenueMinor: rp(3_325_000), payingKpms: 1, leadersBilled: 10, endingSoon: 0, needsAction: 1, kpms: 2 },
  total: { kpms: 2, leadersUsed: 10, weightedRateMinor: rp(350_000), perMonthMinor: rp(3_325_000), periodTotalMinor: rp(39_900_000), needsAction: 1 },
  rows: [
    BILLING_ROW,
    { ...BILLING_ROW, kpmId: 'kpm-2', code: '0601', branch: 'Cikarang Branch', leadersUsed: 1, endDate: '2026-11-10', graceEndsOn: '2026-11-17', attention: 'ended', needsAction: true },
  ],
};

beforeEach(() => {
  nav.search = new URLSearchParams();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetLanguage();
});

describe('P18.10-T6 the Super Admin’s console in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same page in English shows it', async () => {
    expect(ENGLISH.length).toBeGreaterThan(150);
    stubFetch({ ...SHELL, '/admin/accounts': { body: [] }, '/admin/tenants/kpm-1': { body: KPM } });
    nav.pathname = '/admin/tenants/kpm-1/owner';
    render(
      <SessionContext.Provider value={makeSession({ me: SUPER_ADMIN })}>
        <AdminLayout><AssignOwnerPage params={routeParams({ kpmId: 'kpm-1' })} /></AdminLayout>
      </SessionContext.Provider>,
    );
    await screen.findByRole('heading', { level: 1 });
    expect(englishShown(document.body, ENGLISH).length).toBeGreaterThan(0);
  });
  it('AC-1 Edit subscription: its own refusals, the cost lines it cannot work out, and a passed end date', async () => {
    stubFetch({});
    render(
      <InLanguage language="id">
        <SubscriptionDialog row={KPM as unknown as TenantRow} open onClose={vi.fn()} onSaved={vi.fn()} />
      </InLanguage>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Ubah langganan' });
    await userEvent.clear(within(dialog).getByLabelText('Jumlah maksimal leader'));
    await userEvent.clear(within(dialog).getByLabelText('Harga per leader per bulan'));
    expect(dialog).toHaveTextContent('Per bulan— tanpa harga per leader dan tanpa jumlah maksimal leader');
    const end = within(dialog).getByLabelText('Tanggal berakhir');
    await userEvent.clear(end);
    await userEvent.type(end, '2020-01-31');
    expect(dialog).toHaveTextContent('Tanggal berakhir ini, 31 Jan 2020, sudah lewat. Setelah Anda menyimpan');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    expect(dialog).toHaveTextContent('Tanggal berakhir harus sama dengan atau setelah tanggal mulai.');
    noEnglishLeft();
  });

  it('AC-1, AC-4 P19-T3 AC-5 Ganti Owner: the current Owner as stored, the picker, and an invitation to an address with no account', async () => {
    stubFetch({
      ...SHELL,
      '/admin/accounts': { body: [] },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    inIndonesian('/admin/tenants/kpm-1/owner', <AssignOwnerPage params={routeParams({ kpmId: 'kpm-1' })} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ganti Owner' })).toBeInTheDocument();
    expect(screen.getByText(/^Owner saat ini adalah/)).toHaveTextContent(
      'Owner saat ini adalah Rina Wijaya (rina@kpm0417.test). Pemindahan dicatat di audit',
    );
    expect(screen.getByRole('button', { name: 'Ganti' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Cari akun'), 'nobody@nowhere.test');
    expect(await screen.findByText('Tidak ada akun yang memakai alamat itu.')).toBeInTheDocument();
    // P19.4-T3 AC-6 (ADR-0212 §3): the person is named and invited by the API — no `mailto:` asking them to register.
    expect(screen.getByRole('heading', { name: 'Jadikan pemilik dan undang' })).toBeInTheDocument();
    for (const label of ['Nama', 'No. WhatsApp', 'Kode agen pemilik']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Kirim undangan lewat email' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Jadikan pemilik dan undang' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Kirim undangan' })).toBeNull();
    noEnglishLeft();
  });

  /*
   * **P19.4-T2 AC-1, AC-3: the two retired addresses** (ADR-0206 §3, §6) redirect, and say nothing in either language
   * while they do: a skeleton, no English left.
   */
  it('P19.4-T2 the retired roster and approval addresses: a skeleton, nothing in English, while they redirect', () => {
    stubFetch({ ...SHELL });
    const { unmount } = inIndonesian('/admin/tenants/kpm-1/roster', <RetiredRosterAddress params={routeParams({ kpmId: 'kpm-1' })} />);
    expect(screen.queryByText(/Impor roster|Import a roster/)).toBeNull();
    noEnglishLeft();
    unmount();
    inIndonesian('/admin/impersonation/s1', <RetiredApprovalAddress />);
    expect(screen.queryByText(/Setujui|Approve/)).toBeNull();
    noEnglishLeft();
  });

  /*
   * **P19.23: the console's moved and retired addresses** (ADR-0277 §7, §8; ADR-0279) — *Cross-platform analytics* to the
   * Dashboard, the two queues to *Persetujuan*, the old audit address and *Platform*'s index to its audit log, the
   * three-step *KPM baru* to the list with the sheet open — say nothing in either language while they redirect.
   */
  it('P19.23 the moved and retired console addresses: a skeleton, nothing in English, while they redirect', () => {
    stubFetch({ ...SHELL });
    const addresses: [string, React.ReactElement][] = [
      ['/admin/analytics', <RetiredAnalyticsAddress key="analytics" />],
      ['/admin/audit', <MovedAuditAddress key="audit" />],
      ['/admin/kpm-requests', <RetiredKpmRequestsAddress key="kpm-requests" />],
      ['/admin/leader-limit-requests', <RetiredLeaderLimitAddress key="leader-limit" />],
      ['/admin/platform', <PlatformIndex key="platform" />],
      ['/admin/tenants/new', <RetiredNewKpmAddress key="new" />],
    ];
    for (const [path, page] of addresses) {
      const { unmount } = inIndonesian(path, page);
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
      noEnglishLeft();
      unmount();
    }
  });

  it('AC-1 KPM Owners & Admins: the columns, the roles kept, an Owner’s access with the office, a date Indonesian', async () => {
    stubFetch({
      ...SHELL,
      '/admin/tenant-admins': {
        body: [
          { membershipId: 'mem-1', fullName: 'Wilson Tanoto', email: 'wilson@kpm0417.test', initials: 'WT', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD City Branch', isOwner: true, isAdmin: false, grantedAt: null },
          { membershipId: 'mem-2', fullName: 'Agus Prasetyo', email: 'agus@kpm0417.test', initials: 'AP', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD City Branch', isOwner: false, isAdmin: true, grantedAt: '2026-10-01T00:00:00.000Z' },
        ],
      },
    });
    inIndonesian('/admin/tenant-admins', <TenantAdminsPage />);
    const table = await screen.findByRole('table', { name: 'Pengelola KPM' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Siapa', 'KPM', 'Akses', 'Diberikan']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^KPM Owners & Admins$/);
    expect(within(table).getByText('Melekat pada KPM')).toBeInTheDocument();
    expect(within(table).getByText('1 Okt 2026')).toBeInTheDocument();
    expect(within(table).getByText('Owner')).toBeInTheDocument();
    expect(within(table).getByText('Admin')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P19.23-T5 AC-1, AC-2 Langganan & akses: the calculator, its result and its buttons, in the mockups’ words', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T03:00:00Z'));
    stubFetch({ ...SHELL, '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: BILLING_LIST } });
    inIndonesian('/admin/billing', <BillingPage />);
    expect(await screen.findByRole('heading', { name: 'Kalkulator harga' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Langganan & akses$/);
    expect(screen.getByRole('combobox', { name: 'KPM' })).toHaveAttribute('placeholder', 'Pilih atau tulis KPM baru');
    expect(screen.getByText('HEMAT 5%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'isi total' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Harga' })).toHaveTextContent('Hemat Rp 21.375.000 (25%) dari harga standar');
    for (const name of ['Pakai untuk KPM', 'Buat PDF']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kirim penawaran' })).toBeInTheDocument();
    expect(screen.getByText('PAKET INI')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P19.23-T5 AC-4 Langganan per KPM and a KPM’s Atur, in Indonesian', async () => {
    nav.search = new URLSearchParams('tab=kpm');
    stubFetch({ ...SHELL, '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: BILLING_LIST } });
    inIndonesian('/admin/billing', <BillingPage />);
    const table = await screen.findByRole('table', { name: 'Langganan per KPM' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['KPM', 'Leader dipakai', 'Harga / leader', 'Per bulan', 'Tagihan per periode', 'Berlaku hingga', 'Tindakan']);
    expect(table).toHaveTextContent('harga khusus · paket 1–10 leader');
    expect(table).toHaveTextContent('Berakhir');
    noEnglishLeft();
    await userEvent.click(screen.getByRole('button', { name: 'Atur langganan BSD City Branch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Langganan BSD City Branch' });
    expect(within(dialog).getByRole('button', { name: 'Konfirmasi paket' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 billing: an amount typed is grouped again in the new marks when the reader switches language', async () => {
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: BILLING_LIST } });
    const session = makeSession({ me: SUPER_ADMIN });
    const at = (language: 'id' | 'en') => (
      <SessionContext.Provider value={session}>
        <Suspense fallback={null}><InLanguage language={language}><BillingPage /></InLanguage></Suspense>
      </SessionContext.Provider>
    );
    const { rerender } = render(at('id'));
    const price = await screen.findByLabelText('Harga / leader / bulan');
    await userEvent.clear(price);
    await userEvent.type(price, '360000');
    expect(price).toHaveValue('360.000');

    rerender(at('en'));
    await vi.waitFor(() => expect(screen.getByLabelText('Price / leader / month')).toHaveValue('360,000'));
    expect(screen.getByRole('region', { name: 'The price' })).toHaveTextContent('IDR 61,560,000');
  });

  it('AC-1, AC-4 the audit log: the frame Indonesian, the actions as recorded, both people named (P19.23-T6 AC-1)', async () => {
    stubFetch({
      ...SHELL,
      '/admin/tenants': { body: [] },
      '/admin/audit': {
        body: {
          items: [{
            _id: 'a-1', actorUserId: 'u-root', actorName: 'Root Operator', effectiveUserId: 'u-owner', effectiveName: 'Rangga Wibisono',
            action: 'kpm.created', targetCollection: 'kpms', targetId: 'kpm-1', targetLabel: '0417 · Surabaya Branch',
            change: null, kpm: { id: 'kpm-1', code: '0417', branch: 'Surabaya Branch' }, company: { id: 'co-1', name: 'Prudential' },
            createdAt: '2026-10-04T02:00:00.000Z', count: 3, oldestAt: '2026-10-04T01:55:00.000Z',
          }],
          page: { cursor: null, nextCursor: 'cur-2', limit: 50, hasMore: true },
          facets: { actions: ['kpm.created'], actors: [{ userId: 'u-root', name: 'Root Operator' }] },
        },
      },
    });
    inIndonesian('/admin/platform/audit', <AuditPage />);
    const list = await screen.findByRole('list', { name: 'Entri audit, terbaru lebih dulu' });
    const [line] = within(list).getAllByRole('listitem');
    expect(line).toHaveTextContent('kpm.created · 0417 · Surabaya Branch');
    expect(line).toHaveTextContent('Root Operator sebagai Rangga Wibisono · Surabaya Branch · Prudential');
    expect(within(line).getByText('4 Okt 2026, 09.00')).toBeInTheDocument();
    // P19.23-T6 AC-1 (frame f52): the search and the three filters in the mockup's own words, then *Pelaku* and *Tanggal*.
    expect(screen.getByRole('searchbox', { name: 'Cari perubahan' })).toBeInTheDocument();
    for (const chip of ['Perusahaan: Semua perusahaan', 'KPM: Semua KPM', 'Tindakan: Semua tindakan', 'Pelaku: Semua pelaku']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /^Tanggal: / })).toBeInTheDocument();
    expect(within(list).getByText('×3')).toBeInTheDocument();
    expect(within(list).getByText('3 kali')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Muat lagi' })).toBeInTheDocument();
    expect(screen.getByText('Semua perubahan Super Admin: siapa, kapan, sebelum → sesudah')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P19.23-T3 AC-2 Persetujuan: both queues waiting, Tolak · Setujui, and the decided rows with who and when', async () => {
    const kpm = (over: Record<string, unknown> = {}) => ({
      requestId: 'req-1', branchName: 'Surabaya Barat Branch', companyId: 'co-1', companyName: 'Prudential',
      requestedByName: 'Rizal Pratama', requestedByEmail: 'rizal@example.test', note: null,
      status: 'pending', requestedAt: new Date().toISOString(), decidedAt: null, decidedByName: null, reason: null,
      createdKpmId: null, requestedByPhone: null, requesterCompanyId: 'co-1', requesterCompanyName: 'Prudential',
      requesterEmailVerified: true, createdKpm: null, ...over,
    });
    const limit = (over: Record<string, unknown> = {}) => ({
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch', companyName: 'Prudential',
      subjectMembershipId: 'mem-1', subjectName: 'Rizky Ramadhan', subjectAgentCode: '86114', action: 'promote',
      fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: null, requestedByMembershipId: 'mem-owner',
      requestedByName: 'Hendra Gunawan', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
      decidedByName: null, declineReason: null, maxLeaders: 10, leadersUsed: 11, ...over,
    });
    stubFetch({
      ...SHELL,
      '/admin/kpm-requests': {
        body: [kpm(), kpm({
          requestId: 'req-2', branchName: 'Test Branch', status: 'declined', reason: 'data tidak lengkap',
          decidedAt: '2026-09-28T03:00:00.000Z', decidedByName: 'Platform Operator',
        })],
      },
      '/admin/leader-limit-requests': { body: [limit()] },
      '/companies': { body: [{ _id: 'co-1', name: 'Prudential' }] },
    });
    inIndonesian('/admin/approvals', <ApprovalsPage />);
    expect(await screen.findByText('KPM baru · Surabaya Barat Branch')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Menunggu 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/diajukan RIZAL PRATAMA/)).toHaveTextContent('Prudential · diajukan RIZAL PRATAMA (calon owner) · hari ini');
    expect(screen.getByText('Leader melewati batas · Tangerang Branch (Prudential)')).toBeInTheDocument();
    expect(screen.getByText(/RIZKY RAMADHAN/)).toHaveTextContent(
      'RIZKY RAMADHAN Agent → AAB · paket 10 leader, sekarang 11 · diajukan HENDRA GUNAWAN',
    );
    expect(screen.getAllByRole('button', { name: 'Setujui' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Tolak' })).toHaveLength(2);
    expect(screen.getByText('Semua yang perlu persetujuan Super Admin ada di sini')).toBeInTheDocument();
    noEnglishLeft();

    await userEvent.click(screen.getByRole('tab', { name: 'Sudah diputuskan' }));
    const decided = await screen.findByRole('list', { name: 'Permintaan yang sudah diputuskan' });
    expect(within(decided).getByText('Ditolak')).toBeInTheDocument();
    expect(within(decided).getByText(/PLATFORM OPERATOR/)).toHaveTextContent('Prudential · diajukan RIZAL PRATAMA · 28 Sep · PLATFORM OPERATOR');
    expect(within(decided).getByText('data tidak lengkap')).toBeInTheDocument();
    expect(screen.getByText('Siapa yang memutuskan dan kapan · tercatat di audit log')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 P19.4-T2 AC-1 Act as another user: the consequences, Hanya melihat with no choice, the person and their office', async () => {
    nav.search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-1' });
    stubFetch({ ...SHELL, '/admin/tenants/kpm-1': { body: KPM } });
    inIndonesian('/admin/impersonate/u-owner', <ImpersonatePage params={routeParams({ userId: 'u-owner' })} />);
    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Bertindak sebagai pengguna lain' })).toBeInTheDocument();
    expect(screen.getByText(/^Setiap tindakan Anda dicatat/).closest('li')).toHaveTextContent(
      'Setiap tindakan Anda dicatat atas nama kedua pihak: Anda dan Rina Wijaya, Owner KPM 0417 · BSD City Branch.',
    );
    expect(screen.getByText('Sesi ini dibatasi waktu dan tidak dapat melebihi 60 menit.')).toBeInTheDocument();
    // P19.4-T2 AC-1 (UI-151): one kind of session, said and not chosen — whatever an old address says.
    expect(screen.getByText('Hanya melihat')).toBeInTheDocument();
    expect(screen.getByText('Lihat layarnya tanpa mengubah apa pun. Setiap perubahan ditolak selama Anda melihat sebagai dia.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByText(/Penyiapan|Untuk apa sesi ini/)).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Durasi (menit)'));
    await userEvent.type(screen.getByLabelText('Durasi (menit)'), '90');
    expect(screen.getByText('Antara 1 dan 60.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mulai sesi' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Batal' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
    noEnglishLeft();
  });

  it('AC-1 P19.4-T2 AC-5 the banner: the session only looks', () => {
    renderInIndonesian(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true }),
    });
    const banner = screen.getByRole('status');
    // P19.23-T2 AC-7 (ADR-0277): the owner mockups' view-as bar.
    expect(banner).toHaveTextContent('Melihat sebagai Rina');
    expect(banner).toHaveTextContent('Hanya melihat · tercatat di audit log');
    expect(screen.getByRole('button', { name: 'Selesai' })).toBeInTheDocument();
    noEnglishLeft();
  });

  /*
   * **A support session reads in the Super Admin's own language** (T2 AC-2, T5): the person acted as chose English on
   * their account, the support person's browser Indonesian — the banner, and every screen under it, read Indonesian; and
   * the other way about.
   */
  it.each([
    ['id', 'en', 'Melihat sebagai Rina'],
    ['en', 'id', 'Viewing as Rina'],
  ] as const)('the support person’s browser chose %s, the person’s account %s: the banner reads the support person’s', (browser, account, words) => {
    browserChose(browser);
    const base = makeMe({ isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true });
    renderWithLanguage(<ImpersonationBanner />, { me: { ...base, user: { ...base.user, locale: account, localeChosen: true } } }, { live: true });
    expect(screen.getByRole('status')).toHaveTextContent(words);
    expect(document.documentElement.lang).toBe(browser);
  });
});

describe('P18.10-T6 the console’s lib functions, language by language', () => {
  const row = { ...KPM, subscriptionState: 'ended_kept_active' as const, subscription: { ...SUBSCRIPTION, endDate: '2026-10-02' } };

  it('an office’s status, subscription line and leaders, the words and the figures each in their own language', () => {
    expect(tenantStatusWord(row)).toBe('Ended — kept active');
    expect(tenantStatusWord(row, 'id')).toBe('Berakhir — tetap aktif');
    expect(tenantStatusLabels('id')).toEqual({ active: 'Aktif', suspended: 'Ditangguhkan', archived: 'Diarsipkan' });
    // English words and Indonesian figures when given neither — the old call, unchanged.
    expect(subscriptionLine(row)).toBe('Ended 2 Okt 2026 — kept active');
    expect(subscriptionLine(row, 'en', 'en')).toBe('Ended 2 Oct 2026 — kept active');
    expect(subscriptionLine(row, 'id', 'id')).toBe('Berakhir 2 Okt 2026 — tetap aktif');
    expect(leadersSaid(row, 'id')).toBe('13 leaders dari batas 10, lebih 3');
    expect(leadersSaid({ leadersUsed: 1, subscription: null }, 'id')).toBe('1 leader, tanpa batas');
  });

  it('billing’s words and its figures in each language (P19.23-T5)', () => {
    expect(policiesText(80, 'id')).toBe('8,0');
    expect(policiesText(80, 'en')).toBe('8.0');
    expect(policiesText(110, 'id')).toBe('11');
    expect(costMissingWords(['price', 'dates'], 'id')).toBe('— tanpa harga per leader dan tanpa tanggal mulai dan tanggal berakhir');
  });
});
