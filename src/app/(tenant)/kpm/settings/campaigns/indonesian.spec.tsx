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
 * **Pengaturan › Campaigns in Indonesian** (P18.10-T4 AC-1 to AC-4; P19.25-T5 AC-1): the filter *Semua · Struktural ·
 * Musiman*, the rows with their tag, their requirements and their dates, the notes, and the form with its requirement
 * rows — no tiers and no MOC since P19.25-T5. The approved glossary's words, the title, tabs, *Target* and the metrics' names kept (§A),
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
const ENGLISH = englishOnly(settingsCampaignsMessages, settingsMessages, campaignsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

function render(campaigns: unknown[] = [campaign()]) {
  stubFetch({
    '/kpm/settings/campaigns': { body: campaigns },
    '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: '9', computed: true, campaign: true }] },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  });
  renderInIndonesian(<CampaignsSettingsPage />, { me: OWNER });
}

afterEach(() => vi.unstubAllGlobals());

describe('P18.10-T4 Settings › Campaigns in Indonesian', () => {
  it('P18.10-T4 AC-1 to AC-4, P19.25-T5 AC-1 a campaign’s row: its tag, its requirements in words, its dates', async () => {
    render();
    expect(await screen.findByText('Year-End Star Club Drive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Production club tiers' })).toBeNull();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Semua 1', 'Struktural 0', 'Musiman 1']);
    expect(screen.getByText('Musiman', { selector: 'span' })).toBeInTheDocument();
    // The metric's name as served (§A.4), the comparison Indonesian, the figure the reader's; the office's dates.
    expect(screen.getByText('APE achieved minimal Rp 500 Jt + Net APE kurang dari Rp 600 Jt · 1 Okt – 31 Des 2026')).toBeInTheDocument();
    expect(screen.getByText('Belum diukur')).toBeInTheDocument();
    expect(screen.getByText('Struktural = berlaku terus (jenjang, MDRT)')).toBeInTheDocument();
    expect(screen.getByText('Musiman = ada tanggal mulai dan selesai')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah campaign' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P19.25-T5 AC-1 a Struktural campaign in Indonesian: setiap tahun, sepanjang tahun', async () => {
    render([
      campaign({ id: 'c2', title: 'MDRT Qualification', kind: 'structural', window: 'calendar_year', endsAt: null, requirements: [] }),
      campaign({ id: 'c3', title: 'Kenaikan jenjang AAB → AB', kind: 'structural', window: 'rolling_12m', endsAt: null, requirements: [] }),
    ]);
    await screen.findByText('MDRT Qualification');
    expect(screen.getByText('setiap tahun')).toBeInTheDocument();
    expect(screen.getByText('sepanjang tahun')).toBeInTheDocument();
    expect(screen.getAllByText('Struktural', { selector: 'span' })).toHaveLength(2);
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 the panel and its requirement rows, the money field’s mark the reader’s', async () => {
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Lainnya untuk Year-End Star Club Drive' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ubah' }));
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

  it('P18.10-T4 AC-1 an empty list, in Indonesian', async () => {
    render([]);
    expect(await screen.findByText(/^Belum ada campaign\. Campaign adalah program/)).toBeInTheDocument();
    noEnglishLeft();
  });
});
