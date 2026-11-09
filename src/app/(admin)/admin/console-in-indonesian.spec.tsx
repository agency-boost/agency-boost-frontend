import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SubscriptionDialog } from '@/components/subscription-dialog';
import { InLanguage, browserChose, makeMe, makeSession, renderInIndonesian, renderWithLanguage, resetLanguage, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminAnalyticsMessages } from '@/i18n/messages/admin-analytics';
import { adminAuditMessages } from '@/i18n/messages/admin-audit';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { adminOverviewMessages } from '@/i18n/messages/admin-overview';
import { adminRequestsMessages } from '@/i18n/messages/admin-requests';
import { billingMessages } from '@/i18n/messages/billing';
import { officeSubscriptionMessages } from '@/i18n/messages/office-subscription';
import { supportBannerMessages } from '@/i18n/messages/support-banner';
import { supportSessionMessages } from '@/i18n/messages/support-session';
import { leadersSaid, subscriptionLine, tenantStatusLabels, tenantStatusWord, type TenantRow } from '@/lib/admin';
import { officeState, platformHeadings, signedInWords } from '@/lib/admin-analytics';
import { costMissingWords, maskAmount, perLeaderDiscount, priceQuote, saveWordsIn, validateQuote, type BillingTier } from '@/lib/billing';
import { SessionContext } from '@/lib/session';
import AdminOverviewPage from './page';
import PlatformAnalyticsPage from './analytics/page';
import AuditPage from './audit/page';
import BillingPage from './billing/page';
import { KpmBillingTab } from '@/components/admin/kpm-billing-tab';
import ImpersonatePage from './impersonate/[userId]/page';
import RetiredApprovalAddress from './impersonation/[sessionId]/page';
import KpmRequestsPage from './kpm-requests/page';
import LeaderLimitRequestsPage from './leader-limit-requests/page';
import TenantAdminsPage from './tenant-admins/page';
import TenantsPage from './tenants/page';
import NewTenantPage from './tenants/new/page';
import TenantDetailPage from './tenants/[kpmId]/page';
import AssignOwnerPage from './tenants/[kpmId]/owner/page';
import RetiredRosterAddress from './tenants/[kpmId]/roster/page';

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
  adminOverviewMessages, adminOfficesMessages, adminAnalyticsMessages, adminAuditMessages, adminRequestsMessages,
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
const TIERS: BillingTier[] = [
  { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), sixMonthMinor: rp(400_000), annualMinor: rp(380_000), customPricing: false },
  { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), sixMonthMinor: rp(375_000), annualMinor: rp(356_250), customPricing: false },
  { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: rp(375_000), sixMonthMinor: rp(250_000), annualMinor: rp(237_500), customPricing: true },
];

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
    expect(ENGLISH.length).toBeGreaterThan(250);
    stubFetch({ ...SHELL, '/admin/tenants': { body: [KPM] } });
    nav.pathname = '/admin/tenants';
    render(
      <SessionContext.Provider value={makeSession({ me: SUPER_ADMIN })}>
        <AdminLayout><TenantsPage /></AdminLayout>
      </SessionContext.Provider>,
    );
    await screen.findByRole('table');
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['New office', 'Edit subscription', 'Active']));
  });

  it('AC-1, AC-2 the Overview: the queue’s frame, the tiles kept, the figures and the server’s items as sent', async () => {
    stubFetch({
      ...SHELL,
      '/admin/overview': {
        body: {
          tiles: { companies: 1, kpms: 8, totalMembers: 1340, agencyBuilders: 61 },
          attention: [{
            tag: 'Owner KPM', severity: 'structural', title: '2 KPM belum punya Owner',
            detail: 'Tidak ada yang dapat mengelola KPM sampai Owner ditetapkan.', href: '/admin/tenants', actionLabel: 'Tinjau',
          }],
          companies: [{ companyId: 'co-1', name: 'Prudential', initials: 'PR', kpmCount: 8, memberCount: 1340, ladder: ['Agent', 'AAB', 'AB'] }],
        },
      },
    });
    inIndonesian('/admin', <AdminOverviewPage />);
    expect(await screen.findByText('2 KPM belum punya Owner')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Perlu perhatian Anda', 'Sekilas', 'Perusahaan']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Overview$/);
    expect(screen.getByText(/^1 item memerlukan tindakan Superadmin — tidak ada yang dapat didelegasikan ke KPM Owner atau Admin\.$/)).toBeInTheDocument();
    // The tiles' names kept (§A.4), *ABs* in its English plural; the figures Indonesian.
    for (const tile of ['Companies', 'Total members', 'ABs']) expect(screen.getAllByText(tile, { selector: 'main p' }).length).toBe(1);
    expect(screen.getAllByText('1.340').length).toBeGreaterThan(0);
    expect(screen.getByText('Susunan jenjang: Agent → AAB → AB')).toBeInTheDocument();
    expect(screen.getByText('Anggota')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 to AC-4 All KPMs: the columns, the states, past the limit, and Edit subscription named for its office', async () => {
    stubFetch({
      ...SHELL,
      '/admin/tenants': {
        body: [KPM, { ...KPM, _id: 'kpm-2', code: '0555', branchName: 'Kelapa Gading Branch', ownerName: null, ownerUserId: null, ownerEmail: null, subscriptionState: 'ended_kept_active', leadersUsed: 2 }],
      },
    });
    inIndonesian('/admin/tenants', <TenantsPage />);
    const table = await screen.findByRole('table', { name: 'KPM di platform' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      // P19.4-T3 AC-8 (A2): *KPM · Pemilik · Anggota · Data terakhir · Perlu tindakan*, beside the client's earlier columns.
      'KPM', 'Perusahaan', 'Owner', 'Anggota', 'Data terakhir', 'Perlu tindakan', 'Status', 'Tanggal berakhir', 'Jumlah leader',
      'Langganan',
    ]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^All KPMs$/);
    expect(screen.getByRole('link', { name: 'KPM baru' })).toHaveAttribute('href', '/admin/tenants/new');
    const first = within(table).getByRole('row', { name: /^0417/ });
    expect(within(first).getByText('Aktif')).toBeInTheDocument();
    expect(within(first).getByText('5 Jan 2027')).toBeInTheDocument();
    expect(within(first).getByText('lebih 3')).toBeInTheDocument();
    expect(within(first).getByText('13 leaders dari batas 10, lebih 3')).toHaveClass('sr-only');
    // A branch, a company and a person as typed.
    expect(within(first).getByText('BSD City Branch')).toBeInTheDocument();
    expect(within(first).getByText('Rina Wijaya')).toBeInTheDocument();
    const second = within(table).getByRole('row', { name: /^0555/ });
    expect(within(second).getByText('Berakhir — tetap aktif')).toBeInTheDocument();
    expect(within(second).getByRole('link', { name: 'Tetapkan Owner' })).toBeInTheDocument();
    noEnglishLeft();

    await userEvent.click(within(first).getByRole('button', { name: 'Ubah langganan untuk KPM 0417 · BSD City Branch' }));
    const dialog = screen.getByRole('dialog', { name: 'Ubah langganan' });
    expect(within(dialog).getByLabelText('Harga per leader per bulan')).toHaveValue('350.000');
    expect(within(dialog).getByLabelText('Jumlah maksimal leader')).toHaveValue('10');
    expect(dialog).toHaveTextContent('Per bulan untuk 10 leadersRp 3.500.000');
    expect(dialog).toHaveTextContent('Durasi12 bulan');
    expect(dialog).toHaveTextContent('Jumlah leader saat ini: 13');
    expect(dialog).toHaveTextContent(
      'KPM ini kini memiliki 13 leaders, lebih dari 10. Tidak ada yang diturunkan, dan setiap AB atau AAB baru setelah 10 menunggu persetujuan AgencyBoost.',
    );
    expect(within(dialog).getByRole('switch', { name: 'Tetap aktif setelah tanggal berakhir' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    noEnglishLeft();
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

  it('AC-1 New office: the fields, Start from with a company’s templates as named, and what each gives', async () => {
    stubFetch({
      ...SHELL,
      '/admin/companies/co-1/templates': {
        body: [{ id: 't-default', companyId: 'co-1', name: 'Prudential template', isDefault: true, status: 'active', archivedAt: null, origin: { kind: 'empty' }, publishedVersions: {}, officeCount: 0, createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z' }],
      },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', slug: 'prudential' }] },
    });
    inIndonesian('/admin/tenants/new', <NewTenantPage />);
    const select = await screen.findByRole('combobox', { name: 'Mulai dari' });
    await vi.waitFor(() => expect(select).toHaveDisplayValue('Prudential template · Default'));
    expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Prudential template · Default', 'Kosong']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^KPM baru$/);
    expect(screen.getByText('Bagian yang sudah terbit disalin; bagian yang belum terbit dimulai kosong.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Kode KPM'), 'has space');
    expect(screen.getByText('2–16 karakter: huruf, angka, dan tanda hubung.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nama cabang')).toBeInTheDocument();
    expect(screen.getByText('Asia/Jakarta')).toBeInTheDocument();
    // *Changed 2026-11-06 (P19.2-T2 AC-3; UI-133):* the main button is enabled; pressed, each field says what it needs
    // in Indonesian and nothing is sent, where the button was disabled.
    expect(screen.getByRole('button', { name: 'Buat KPM' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Buat KPM' }));
    expect(screen.getByLabelText('Nama cabang')).toHaveAccessibleDescription(expect.stringContaining('Wajib diisi.'));
    await userEvent.selectOptions(select, 'empty');
    // ADR-0185 §5: Kosong says, once, that it cannot be filled later.
    expect(screen.getByText('Hanya tiga jenis aktivitas yang dihitung rencana goal. Tidak dapat diisi dari template nanti.'))
      .toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 an office’s page: its four cards, the lifecycle in Indonesian, the subscription line’s date Indonesian', async () => {
    stubFetch({ ...SHELL, '/admin/tenants/kpm-1': { body: { ...KPM, subscriptionState: 'ended_kept_active', subscription: { ...SUBSCRIPTION, endDate: '2026-10-02', keepActiveAfterEnd: true }, suspendedReason: 'tagihan belum dibayar' } } });
    inIndonesian('/admin/tenants/kpm-1', <TenantDetailPage params={routeParams({ kpmId: 'kpm-1' })} />);
    expect(await screen.findByText('Berakhir 2 Okt 2026 — tetap aktif')).toBeInTheDocument();
    // P19.4-T3 AC-9: *Ringkasan*'s cards — the Owner, the Admins, the members — then the KPM's profile and lifecycle.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Owner', 'Admin', 'Anggota', 'Profil', 'Siklus hidup']);
    expect(screen.getByText('ID KPM')).toBeInTheDocument();
    expect(screen.getByText('Mata uang')).toBeInTheDocument();
    expect(screen.getByText('Ditangguhkan: tagihan belum dibayar')).toBeInTheDocument();
    expect([...(screen.getByLabelText('Status') as HTMLSelectElement).options].map((o) => o.textContent))
      .toEqual(['Aktif', 'Ditangguhkan', 'Diarsipkan']);
    // P19-T3 (UI-168 point 4), P19.4-T3 AC-9: the Owner's card's *Ganti pemilik*; and *Buka sebagai Owner*, which only
    // looks (P19.4-T2 AC-1) — for a reader whose grants open them.
    expect(screen.queryByRole('link', { name: 'Impor roster' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terapkan' })).toBeInTheDocument();
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

  it('P19.4-T3 AC-10 Billing & subscription: the tiers strip and the KPMs, with no “Tingkat Anda”', async () => {
    stubFetch({
      ...SHELL,
      '/admin/billing/prices': { body: { currency: 'IDR', tiers: TIERS, annualDiscountPct: 5 } },
      '/admin/billing/kpms': {
        body: [
          { kpmId: 'kpm-1', code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' }, leadersUsed: 9, tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, plan: 'annual', renewalDate: '2027-01-05', status: 'active' },
          { kpmId: 'kpm-2', code: '0601', branch: 'Cikarang Branch', company: { id: 'co-1', name: 'Prudential' }, leadersUsed: 1, tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, plan: 'six_months', renewalDate: '2026-09-25', status: 'ended' },
          { kpmId: 'kpm-3', code: '0100', branch: 'Sudirman', company: { id: 'co-2', name: 'Manulife' }, leadersUsed: 0, tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, plan: null, renewalDate: null, status: 'none' },
        ],
      },
    });
    inIndonesian('/admin/billing', <BillingPage />);
    const table = await screen.findByRole('table');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Billing & subscription$/);
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.replace(/[▲▼⇅]/g, '').trim()))
      .toEqual(['KPM', 'Perusahaan', 'Leader', 'Tingkat', 'Paket', 'Perpanjangan', 'Status']);
    expect(within(table).getByText('Tahunan')).toBeInTheDocument();
    expect(within(table).getByText('6 bulan')).toBeInTheDocument();
    expect(within(table).getByText('Berakhir')).toBeInTheDocument();
    expect(within(table).getByText('Belum ada langganan')).toBeInTheDocument();
    expect(within(table).getByText('5 Jan 2027')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tingkat harga' })).toBeInTheDocument();
    expect(screen.queryByText('Tingkat Anda')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Perusahaan')).toHaveDisplayValue('Semua perusahaan');
    noEnglishLeft();
  });

  it('AC-1, AC-3 a KPM’s Billing tab: the cards, the estimate, a refusal, the dialog and the quote', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T18:30:00Z'));
    stubFetch({ ...SHELL, '/admin/billing/prices': { body: { currency: 'IDR', tiers: TIERS, annualDiscountPct: 5 } } });
    // P19.4-T3 AC-10 (ADR-0211 §4): the calculator moved to the KPM's *Billing* tab, filled with its 8 leaders.
    inIndonesian('/admin/tenants/kpm-1', <KpmBillingTab kpm={{ ...KPM, leadersUsed: 8, subscription: null } as unknown as TenantRow} />);
    expect(await screen.findByText('Perkirakan harga Anda')).toBeInTheDocument();
    const grid = screen.getByText('Tingkat Anda').closest('ul') as HTMLElement;
    const cards = within(grid).getAllByRole('listitem').map((c) => c.textContent);
    expect(cards[0]).toBe('1–10 leadersRp 500.000/blnRp 400.000 /leader/blnHemat 20%Tingkat Anda');
    expect(cards[2]).toBe('101+ leadersHarga khusus berdasarkan struktur unit Anda.Hubungi kami');
    expect(screen.getByText(/masuk tingkat/)).toHaveTextContent('8 leaders masuk tingkat 1–10.');
    expect(screen.getByText('Total 6 bulan (semua leader)', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Rp 19.200.000');
    expect(screen.getByText('Tidak berlaku — pilih Tahunan di atas')).toBeInTheDocument();
    noEnglishLeft();

    await userEvent.click(screen.getByText('Penyesuaian manual'));
    await userEvent.selectOptions(screen.getByLabelText('Jenis diskon'), 'Rp/leader');
    const discount = screen.getByLabelText('Diskon bebas (internal, per leader)');
    await userEvent.clear(discount);
    await userEvent.type(discount, '400001');
    expect(discount).toHaveValue('400.001');
    expect(screen.getByRole('alert')).toHaveTextContent('Masukkan jumlah dari Rp 0 sampai Rp 400.000.');
    await userEvent.clear(discount);

    await userEvent.click(screen.getByRole('button', { name: 'Kirim penawaran' }));
    const dialog = screen.getByRole('dialog', { name: 'Kirim penawaran' });
    expect(within(dialog).getByLabelText('Tanggal mulai')).toHaveAttribute('placeholder', 'HH/BB/TTTT');
    // The KPM's own name, read-only, and its Owner as the PIC (ADR-0211 §4).
    expect(within(dialog).getByLabelText('Nama KPM')).toHaveValue('KPM 0417 · BSD City Branch');
    await userEvent.clear(within(dialog).getByLabelText('Nama PIC'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat penawaran' }));
    expect(within(dialog).getByText('Isi nama PIC.')).toBeInTheDocument();
    noEnglishLeft();

    await userEvent.type(within(dialog).getByLabelText('Nama PIC'), 'Andi Wijaya');
    await userEvent.type(within(dialog).getByLabelText('Diisi oleh sales'), 'Maya');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat penawaran' }));
    const quote = screen.getByRole('article');
    expect(within(quote).getByRole('heading', { name: 'Penawaran langganan' })).toBeInTheDocument();
    expect(quote).toHaveTextContent('Dibuat 8 Okt 2026');
    expect(within(quote).getByText('Tanggal mulai paket').nextElementSibling).toHaveTextContent('15 Okt 2026');
    expect(within(quote).getByText('Tingkat').nextElementSibling).toHaveTextContent('1–10 leaders');
    expect(within(quote).getByText('Periode tagihan').nextElementSibling).toHaveTextContent('Paket 6 bulan');
    // The client's names as typed; the product's name kept.
    expect(within(quote).getByText('Penanggung jawab (PIC)').nextElementSibling).toHaveTextContent('Andi Wijaya');
    expect(quote).toHaveTextContent('AgencyBoost');
    expect(screen.getByRole('button', { name: 'Cetak / simpan sebagai PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim ke Rina Wijaya' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 billing: an amount typed is grouped again in the new marks when the reader switches language', async () => {
    stubFetch({ '/admin/billing/prices': { body: { currency: 'IDR', tiers: TIERS, annualDiscountPct: 5 } } });
    const session = makeSession({ me: SUPER_ADMIN });
    const at = (language: 'id' | 'en') => (
      <SessionContext.Provider value={session}>
        <Suspense fallback={null}><InLanguage language={language}><KpmBillingTab kpm={{ ...KPM, leadersUsed: 8, subscription: null } as unknown as TenantRow} /></InLanguage></Suspense>
      </SessionContext.Provider>
    );
    const { rerender } = render(at('id'));
    await screen.findByText('Perkirakan harga Anda');
    await userEvent.click(screen.getByText('Penyesuaian manual'));
    await userEvent.selectOptions(screen.getByLabelText('Jenis diskon'), 'flat');
    await userEvent.clear(screen.getByLabelText('Diskon bebas (internal, per leader)'));
    await userEvent.type(screen.getByLabelText('Diskon bebas (internal, per leader)'), '25000');
    expect(screen.getByLabelText('Diskon bebas (internal, per leader)')).toHaveValue('25.000');

    rerender(at('en'));
    expect(await screen.findByText('Estimate your price')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByLabelText('Arbitrary discount (internal, per leader)')).toHaveValue('25,000'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Monthly total (all leaders)', { selector: 'dt' }).nextElementSibling).toHaveTextContent('IDR 3,000,000');
  });

  it('AC-1 Cross-platform analytics: the headings with the month, the totals counted in Indonesian, a state as All KPMs says it', async () => {
    const ladder = (agent: number, aab: number, ab: number) => [
      { code: 'AGENT', label: 'Agent', count: agent }, { code: 'AAB', label: 'AAB', count: aab }, { code: 'AB', label: 'AB', count: ab },
    ];
    const figures = { members: 1340, byRung: ladder(1300, 28, 12), joinedThisMonth: 14, leftThisMonth: 2, signedIn7d: 1072, signedIn30d: 1206 };
    stubFetch({
      ...SHELL,
      '/admin/analytics': {
        body: {
          month: '2026-10',
          offices: [{ kpmId: 'kpm-0417', code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' }, state: 'suspended', ...figures }],
          companies: [{ id: 'co-1', name: 'Prudential', offices: 1, ...figures }],
          platform: { offices: 1, companies: 1, ...figures },
        },
      },
    });
    inIndonesian('/admin/analytics', <PlatformAnalyticsPage />);
    const table = await screen.findByRole('table', { name: 'Adopsi per KPM dan perusahaan' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Kode', 'Cabang', 'Perusahaan', 'Status', 'Anggota', 'Per jenjang', 'Bergabung pada Okt 2026', 'Keluar pada Okt 2026',
      'Masuk dalam 7 hari terakhir', 'Masuk dalam 30 hari terakhir',
    ]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Cross-platform analytics$/);
    const office = within(table).getByRole('row', { name: /^0417/ });
    expect(within(office).getByText('Ditangguhkan')).toBeInTheDocument();
    expect(within(office).getByText('1.072 (80%)')).toBeInTheDocument();
    expect(within(table).getByText('Prudential — Total (1 KPM)')).toBeInTheDocument();
    expect(within(table).getByText('Platform — Total (1 perusahaan, 1 KPM)')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 the audit log: the frame Indonesian, the actions and collections as recorded, both people named', async () => {
    stubFetch({
      ...SHELL,
      '/admin/tenants': { body: [] },
      '/admin/audit': {
        body: {
          items: [{
            _id: 'a-1', actorUserId: 'u-root', actorName: 'Root Operator', effectiveUserId: 'u-owner', effectiveName: 'Rangga Wibisono',
            action: 'kpm.created', targetCollection: 'kpms', targetId: 'kpm-1', targetLabel: '0417 · Surabaya Branch',
            createdAt: '2026-10-04T02:00:00.000Z', count: 3, oldestAt: '2026-10-04T01:55:00.000Z',
          }],
          page: { cursor: null, nextCursor: 'cur-2', limit: 50, hasMore: true },
          facets: { actions: ['kpm.created'], actors: [{ userId: 'u-root', name: 'Root Operator' }] },
        },
      },
    });
    inIndonesian('/admin/audit', <AuditPage />);
    const table = await screen.findByRole('table', { name: 'Entri audit, terbaru lebih dulu' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Kapan', 'Tindakan', 'Target', 'Pelaku']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Audit \/ Role Change Log$/);
    expect(within(table).getByText('kpm.created')).toBeInTheDocument();
    expect(within(table).getByText('kpms')).toBeInTheDocument();
    expect(within(table).getByText('sebagai Rangga Wibisono')).toBeInTheDocument();
    expect(within(table).getByText('4 Okt 2026, 09.00')).toBeInTheDocument();
    // P19.2-T2 AC-6: the chips, the count pill and *Muat lagi*, the mockups' own words.
    expect(screen.getByRole('button', { name: 'Cakupan: Tingkat platform (tanpa KPM)' })).toBeInTheDocument();
    for (const chip of ['Perusahaan', 'Tindakan', 'Pelaku', 'Tanggal']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${chip}: `) })).toBeInTheDocument();
    }
    expect(within(table).getByText('×3')).toBeInTheDocument();
    expect(within(table).getByText('3 kali')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Muat lagi' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 Pending KPM requests: the card, the code, what approving does, the decided table', async () => {
    const req = (over: Record<string, unknown> = {}) => ({
      requestId: 'req-1', branchName: 'Surabaya Branch', companyId: 'co-1', companyName: 'Prudential',
      requestedByName: 'Rangga Wibisono', requestedByEmail: 'rangga@example.test', note: 'Sudah ada dua belas agen.',
      status: 'pending', requestedAt: '2026-09-01T00:00:00.000Z', decidedAt: null, reason: null, createdKpmId: null,
      requestedByPhone: '+62 812 3456 7890', requesterCompanyId: 'co-1', requesterCompanyName: 'Prudential',
      requesterEmailVerified: true, createdKpm: null, ...over,
    });
    stubFetch({
      ...SHELL,
      '/admin/kpm-requests': { body: [req(), req({ requestId: 'req-2', branchName: 'Medan Branch', status: 'declined', reason: 'Sudah ada KPM 0417.' })] },
      '/companies': { body: [{ _id: 'co-1', name: 'Prudential' }] },
    });
    inIndonesian('/admin/kpm-requests', <KpmRequestsPage />);
    expect(await screen.findByText('Surabaya Branch')).toBeInTheDocument();
    // P19-T3 AC-1: name, email, phone and the date; the company is the picker below.
    expect(screen.getByText(/diajukan oleh/)).toHaveTextContent(
      'diajukan oleh Rangga Wibisono (calon KPM Owner) · rangga@example.test · +62 812 3456 7890 · 1 Sep 2026',
    );
    expect(screen.getByLabelText('Perusahaan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setujui & jadikan Owner' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hapus' }).length).toBe(2);
    expect(screen.getByText('Sudah ada dua belas agen.')).toBeInTheDocument();
    expect(screen.getByText('Menunggu')).toBeInTheDocument();
    expect(screen.getByLabelText('Kode KPM')).toBeInTheDocument();
    expect(screen.getByLabelText('Alasan')).toHaveAttribute('placeholder', 'Dikirim kembali ke pemohon');
    expect(screen.getByText('Menyetujui akan membuat KPM ini dan menjadikan Rangga Wibisono sebagai Owner-nya.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Pendaftaran yang sudah diputuskan' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nama KPM', 'Perusahaan', 'Diajukan oleh', 'Status']);
    expect(within(table).getByText('Ditolak')).toBeInTheDocument();
    expect(within(table).getByText('Sudah ada KPM 0417.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Leaders past the limit: the card, the count approving makes, and the change a request asks for', async () => {
    const req = (over: Record<string, unknown> = {}) => ({
      requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch', subjectMembershipId: 'mem-1',
      subjectName: 'Rizky Ramadhan', subjectAgentCode: '86114', action: 'activate', fromOrgLevelCode: 'AAB', toOrgLevelCode: null,
      reason: null, requestedByMembershipId: 'mem-owner', requestedByName: 'Hendra Gunawan', status: 'pending',
      requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null, declineReason: null, maxLeaders: 10, leadersUsed: 13, ...over,
    });
    stubFetch({ ...SHELL, '/admin/leader-limit-requests': { body: [req(), req({ requestId: 'llr-2', status: 'cancelled' })] } });
    inIndonesian('/admin/leader-limit-requests', <LeaderLimitRequestsPage />);
    expect(await screen.findByText('Rizky Ramadhan · Diterima sebagai AAB')).toBeInTheDocument();
    expect(screen.getByText(/diajukan oleh/)).toHaveTextContent('KPM 0603 · Tangerang Branch · diajukan oleh Hendra Gunawan · leaders 13 / 10');
    expect(screen.getByText(/^Menyetujui akan langsung menjalankan perubahan ini/)).toHaveTextContent('jumlah leaders KPM menjadi 14 / 10. Batasnya tidak berubah.');
    const table = screen.getByRole('table', { name: 'Permintaan yang sudah diputuskan' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Anggota', 'KPM', 'Perubahan', 'Diajukan oleh', 'Status']);
    expect(within(table).getByText('Dibatalkan')).toBeInTheDocument();
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
    expect(banner).toHaveTextContent(
      'Anda bertindak sebagai Rina. Ini sesi hanya melihat: Anda dapat melihat, dan tidak ada yang bisa diubah. '
      + 'Semua yang Anda lakukan juga dicatat atas nama Anda.',
    );
    expect(screen.getByRole('button', { name: 'Berhenti bertindak sebagai dia' })).toBeInTheDocument();
    noEnglishLeft();
  });

  /*
   * **A support session reads in the Super Admin's own language** (T2 AC-2, T5): the person acted as chose English on
   * their account, the support person's browser Indonesian — the banner, and every screen under it, read Indonesian; and
   * the other way about.
   */
  it.each([
    ['id', 'en', 'Anda bertindak sebagai Rina.'],
    ['en', 'id', 'You are acting as Rina.'],
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

  it('Cross-platform analytics’ words and figures', () => {
    expect(officeState('ended_kept_active', 'id')).toEqual({ word: 'Berakhir — tetap aktif', tone: 'watch' });
    // The word in either language names the same state.
    expect(officeState('Ditangguhkan')).toEqual({ word: 'Suspended', tone: 'alert' });
    expect(signedInWords(1072, 1340, 'en')).toBe('1,072 (80%)');
    expect(signedInWords(1072, 1340, 'id')).toBe('1.072 (80%)');
    expect(platformHeadings('2026-10', 'id', 'id').slice(6, 8)).toEqual(['Bergabung pada Okt 2026', 'Keluar pada Okt 2026']);
  });

  it('billing’s words, its refusals and its amounts in each language', () => {
    const input = { leaders: '8', period: 'sixMonth' as const, discountType: 'flat' as const, discount: '400.001' };
    expect(priceQuote({ tiers: TIERS }, input, 'id', 'id').discountError).toBe('Masukkan jumlah dari Rp 0 sampai Rp 400.000.');
    expect(priceQuote({ tiers: TIERS }, { ...input, discount: '400,001' }, 'en', 'en').discountError)
      .toBe('Enter an amount from IDR 0 to IDR 400,000.');
    // An amount is read in the figures' grouping: the other mark is that language's decimal.
    expect(priceQuote({ tiers: TIERS }, { ...input, discount: '25,000' }, 'en').finalMinor).toBe(rp(375_000));
    expect(priceQuote({ tiers: TIERS }, { ...input, discount: '25.000' }, 'en').discountError).not.toBeNull();
    expect(maskAmount('25000', 'en')).toBe('25,000');
    expect(perLeaderDiscount(rp(20_000), 'id', 'id')).toBe('-Rp 20.000/leader/bln');
    expect(perLeaderDiscount(rp(20_000), 'en', 'en')).toBe('-IDR 20,000/leader/mo');
    expect(saveWordsIn(TIERS[0], 'id', 'id')).toBe('Hemat 20%');
    expect(validateQuote({ kpm: '', pic: '', sales: '', start: '31/02/2027', end: '' }, 'id')).toEqual({
      kpm: 'Isi nama KPM.', pic: 'Isi nama PIC.', sales: 'Isi siapa yang mengajukan penawaran ini.',
      start: 'Masukkan tanggal mulai yang valid, dengan format HH/BB/TTTT.',
      end: 'Masukkan tanggal berakhir yang valid, dengan format HH/BB/TTTT.',
    });
    expect(costMissingWords(['price', 'dates'], 'id')).toBe('— tanpa harga per leader dan tanpa tanggal mulai dan tanggal berakhir');
  });
});
