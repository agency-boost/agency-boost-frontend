import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import { settingsMessages } from '@/i18n/messages/settings';
import { settingsCampaignsMessages } from '@/i18n/messages/settings-campaigns';
import CampaignsSettingsPage from './page';

/**
 * **Settings › Campaigns in Indonesian** (P18.98-T4 AC-1 to AC-4, events, campaigns and the calendar): the campaigns'
 * rows with their phase and requirements, the panel with its requirement rows, and the carrier's tiers and MOC with the
 * line saying whose they are. The approved glossary's words, the title, tabs, *Target* and the metrics' names kept (§A),
 * what the office and the company typed as typed, and none of the module's English left. English is `page.spec.tsx`'s.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/campaigns',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'campaign_settings:read'],
});

const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'c1', code: 'YEAR_END_DRIVE', title: 'Year-End Star Club Drive', description: 'Push to Star Club before the year closes.',
  startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-12-31T16:59:59.000Z', phase: 'running',
  requirements: [
    { metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte', value: 50_000_000_000, unit: 'idr_minor', measured: true },
    { metricKey: 'NET_APE', metricName: 'Net APE', comparator: 'lt', value: 60_000_000_000, unit: 'idr_minor', measured: false },
  ],
  reward: 'Extra unit budget', status: 'active', version: 1, kind: 'seasonal', subtype: null, window: 'campaign_dates',
  appliesToOrgLevelCodes: [], poster: { emoji: '⭐', color: 'amber' }, blurb: 'The last push of the year.', ...over,
});
const tier = {
  id: 't1', kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club', appliesToOrgLevelCodes: [],
  criteriaGroups: [{ mode: 'all', criteria: [{ metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte', value: 120_000_000_000, unit: 'idr_minor' }] }],
  groupMode: 'all', reward: 'Promotion bonus', rank: 1, waitingOnMetrics: [],
};
const moc = {
  id: 'm1', kind: 'moc', code: 'MOC_AB', name: 'Maintenance of Contract — AB', appliesToOrgLevelCodes: ['AB'],
  criteriaGroups: [
    { mode: 'all', criteria: [{ metricKey: 'NET_APE', metricName: 'NET_APE', comparator: 'gte', value: 60_000_000_000, unit: 'idr_minor' }] },
    { mode: 'all', criteria: [{ metricKey: 'DIRECT_AB_COUNT', metricName: 'DIRECT_AB_COUNT', comparator: 'gte', value: 5, unit: 'count' }] },
  ],
  groupMode: 'any', reward: '', rank: 1, waitingOnMetrics: ['NET_APE', 'DIRECT_AB_COUNT'],
};

const ENGLISH = englishOnly(settingsCampaignsMessages, settingsMessages, campaignsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

function render(campaigns: unknown[] = [campaign()]) {
  stubFetch({
    '/kpm/settings/campaigns/rules': { body: [tier, moc] },
    '/kpm/settings/campaigns': { body: campaigns },
    '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true, campaign: true }] },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  });
  renderInIndonesian(<CampaignsSettingsPage />, { me: OWNER });
}

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 Settings › Campaigns in Indonesian', () => {
  it('P18.98-T4 AC-1 to AC-4 a campaign’s row: phase, KPM ini, requirements in words, its prize as typed', async () => {
    render();
    expect(await screen.findByText('Year-End Star Club Drive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeInTheDocument();
    for (const name of ['Campaigns', 'Production club tiers']) expect(screen.getByRole('link', { name })).toBeInTheDocument();
    expect(screen.getByText('Berjalan')).toBeInTheDocument();
    expect(screen.getByText('KPM ini')).toBeInTheDocument();
    // The metric's name as served (§A.4), the comparison Indonesian, the figure the reader's.
    expect(screen.getByText('APE achieved minimal Rp 500 jt')).toBeInTheDocument();
    expect(screen.getByText(/^Net APE kurang dari Rp 600 jt/)).toBeInTheDocument();
    expect(screen.getByText('Belum diukur')).toBeInTheDocument();
    expect(screen.getByText('Hadiah: Extra unit budget')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah campaign' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the panel and its requirement rows, the money field’s mark the reader’s', async () => {
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah' }));
    for (const label of ['Judul', 'Kode', 'Jenis', 'Mulai', 'Selesai', 'Emoji poster', 'Warna poster', 'Kalimat kartu', 'Deskripsi', 'Hadiah']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(screen.getByLabelText('Jenis')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Musiman', 'Struktural']);
    expect(screen.getByRole('group', { name: 'Yang harus dicapai' })).toBeInTheDocument();
    expect(screen.getByLabelText('Syarat 1')).toHaveValue('APE_ACHIEVED');
    expect(within(screen.getByLabelText('Syarat 1 Perbandingan')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['minimal', 'lebih dari', 'maksimal', 'kurang dari', 'tepat']);
    expect(screen.getByLabelText('Syarat 1 Target (Rp)')).toHaveValue('500000000');
    expect(screen.getByRole('option', { name: 'Net APE (belum diukur)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus syarat 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tambah syarat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan campaign' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the carrier’s tiers and MOC: whose they are, the rules in words, what they wait on', async () => {
    render();
    await screen.findByText('Year-End Star Club Drive');
    await userEvent.click(screen.getByRole('link', { name: 'Production club tiers' }));
    expect(await screen.findByText('Ini milik perusahaan asuransi Anda, bukan milik KPM Anda.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Maintenance of Contract' })).toBeInTheDocument();
    // A company's tier and rule names as typed; a group joined by *atau*.
    expect(screen.getByText('Star Club')).toBeInTheDocument();
    expect(screen.getByText(/^atau/)).toBeInTheDocument();
    expect(screen.getByText('Belum ada yang mengukur NET_APE, DIRECT_AB_COUNT, jadi aturan ini belum dapat dihitung. Tidak ada yang ditebak di sini.'))
      .toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 an empty list, in Indonesian', async () => {
    render([]);
    expect(await screen.findByText(/^Belum ada campaign\. Campaign adalah program/)).toBeInTheDocument();
    noEnglishLeft();
  });
});
