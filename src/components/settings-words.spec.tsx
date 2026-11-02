import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InLanguage, makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import type { ApiError } from '@/lib/api-client';
import { STAGED_LABEL } from '@/lib/staged-projection';
import { OWN_TILE_REFUSED, planSummaryTile, tileRefusal } from '@/lib/summary-tiles';
import { formatFileSize, PITCH_COPY } from '@/lib/recruitment-pitch';
import { ActivityBindingFields } from './activity-binding-fields';
import { PublishBar } from './publish-bar';
import { SettingsScreen } from './settings-screen';
import { ACTIVITY_SETTINGS_TABS } from './settings-tabs';
import { StagedChangesBar } from './staged-changes-bar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activity-types',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

/**
 * **P18.98-T4, the settings screens' frame in ID mode** (`messages/settings.ts`): the tab rows, the two bars and a
 * staged row's mark — what every Settings screen draws, the training, events, campaigns and products screens too.
 * The English is each component's own spec's, untouched.
 */
describe('P18.98-T4 the settings frame in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the tab rows in Indonesian and keeps the tabs English', () => {
    renderInIndonesian(
      <SettingsScreen
        title="Lead statuses"
        tabs={ACTIVITY_SETTINGS_TABS}
        subtabs={[{ label: 'Sales', href: '#sales' }, { label: 'Recruitment', href: '#recruitment' }]}
      >
        isi
      </SettingsScreen>,
      { me: OWNER },
    );

    const tabs = screen.getByRole('navigation', { name: 'Pengaturan aktivitas' });
    expect(within(tabs).getByRole('link', { name: 'Activity types' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'Ratio benchmarks' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bagian Lead statuses' })).toBeInTheDocument();
  });

  it('says what is held in this browser in Indonesian, one form for one change and for many', () => {
    const { rerender } = render(
      <InLanguage language="id"><StagedChangesBar count={1} busy={false} onSave={vi.fn()} onDiscard={vi.fn()} /></InLanguage>,
    );
    expect(screen.getByText('1 perubahan belum disimpan.')).toBeInTheDocument();
    expect(screen.getByText(
      'Belum ada yang sampai ke KPM Anda — dan menerbitkan ke agent adalah langkah terpisah setelah itu.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buang perubahan' })).toBeInTheDocument();

    rerender(<InLanguage language="id"><StagedChangesBar count={3} busy onSave={vi.fn()} onDiscard={vi.fn()} /></InLanguage>);
    expect(screen.getByText('3 perubahan belum disimpan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menyimpan…' })).toBeDisabled();
  });

  it('says what agents are on in Indonesian, and the one way to move them', async () => {
    stubFetch({
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 0, workingVersion: 1, hasUnpublishedChanges: true, publishedAt: null },
      },
    });
    renderInIndonesian(<PublishBar />, { me: OWNER });
    expect(await screen.findByText('Agent Anda belum melihat perubahan ini.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada yang diterbitkan untuk KPM ini.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terbitkan ke agent' })).toBeInTheDocument();
  });

  it('says a failed read of the publish state in Indonesian, with the server’s reason', async () => {
    stubFetch({
      '/kpm/settings/publish-state': {
        status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan.', requestId: 'r-1' } },
      },
    });
    renderInIndonesian(<PublishBar />, { me: OWNER });
    expect(await screen.findByText('Tidak dapat memeriksa apa yang dilihat agent Anda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  it('keeps a staged row’s mark in English for a screen not moved yet', () => {
    expect(STAGED_LABEL).toEqual({
      added: 'Added — not saved yet', edited: 'Edited — not saved yet',
      archived: 'Archived — not saved yet', restored: 'Restored — not saved yet',
    });
  });
});

/**
 * **P18.98-T4, the activity binding's editor in ID mode** (`messages/activity-binding.ts`): the Super Admin's two
 * places. The three stages are the client's own and kept English (§A.6); a type's name is the office's, as typed.
 */
describe('P18.98-T4 the activity binding’s editor in Indonesian', () => {
  const TYPES = [
    { code: 'LEADS_CONTACTED', label: 'Menghubungi leads', status: 'active' as const },
    { code: 'SELL_PRESENTATION', label: 'Presentasi penjualan', status: 'active' as const },
    { code: 'OLD_MEETING', label: 'Pertemuan lama', status: 'archived' as const },
  ];

  it('says each role’s list in Indonesian, the role kept English and an archived type marked', () => {
    render(
      <InLanguage language="id">
        <ActivityBindingFields
          value={{ leads: ['LEADS_CONTACTED'], appointments: ['OLD_MEETING'], closings: [] }}
          types={TYPES}
          onChange={vi.fn()}
          idPrefix="b"
        />
      </InLanguage>,
    );

    expect(screen.getByRole('group', { name: 'Set appointment' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Yang dihitung Sales meeting' })).toHaveTextContent('Pertemuan lama (diarsipkan)');
    expect(screen.getByRole('button', { name: 'Hapus Menghubungi leads dari Set appointment' }))
      .toHaveAttribute('title', 'Hapus dari Set appointment');
    expect(within(screen.getByRole('list', { name: 'Yang dihitung Submission polis' })).getByText('Belum menghitung apa pun.'))
      .toBeInTheDocument();
    const add = screen.getByLabelText('Tambahkan aktivitas ke Submission polis');
    expect(within(add).getAllByRole('option')[0]).toHaveTextContent('Tambah aktivitas…');
  });
});

/** **P18.98-T4, a section's tile refused in the reader's words** (`messages/summary-tiles.ts`). */
describe('P18.98-T4 the summary tile’s refusals in each language', () => {
  const SECTIONS = [
    { code: 'SELLING', label: 'Penjualan', summaryGroupCode: null, summaryGroupLabel: null },
    { code: 'RECRUITING', label: 'Rekrutmen', summaryGroupCode: null, summaryGroupLabel: null },
  ];

  it('refuses a new name on a section with a tile of its own, in English by default and in Indonesian when asked', () => {
    expect(planSummaryTile('Jualan', SECTIONS[0], SECTIONS)).toEqual({ refused: OWN_TILE_REFUSED });
    expect(planSummaryTile('Jualan', SECTIONS[0], SECTIONS, 'id')).toEqual({
      refused: 'Bagian dengan kotak sendiri menampilkan namanya sendiri. Ganti nama bagian untuk mengubahnya, atau '
        + 'ketik nama kotak bagian lain untuk menghitung keduanya bersama.',
    });
  });

  it('says the server’s two tile refusals in Indonesian, the codes and labels as typed', () => {
    const taken: ApiError = {
      code: 'CONFIG_SUMMARY_GROUP_CODE_TAKEN', message: 'x', requestId: 'r',
      details: { summaryGroupCode: 'DEVELOPMENT', label: 'Pengembangan' },
    };
    expect(tileRefusal(taken, 'id')?.message)
      .toBe('DEVELOPMENT sudah menjadi kode kotak ringkasan “Pengembangan”. Beri bagian ini kode lain.');
    expect(tileRefusal(taken)?.message)
      .toBe('DEVELOPMENT is already the code of the summary tile “Pengembangan”. Give the section another code.');
    const mismatch: ApiError = {
      code: 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH', message: 'x', requestId: 'r', details: { labels: ['A', 'B', 'C'] },
    };
    expect(tileRefusal(mismatch, 'id')?.message)
      .toBe('Satu kotak ringkasan, dua nama: “A”, “B” dan “C”. Beri setiap bagian di dalamnya nama kotak yang sama.');
    expect(tileRefusal({ ...mismatch, details: {} }, 'id')?.message)
      .toBe('Satu kotak ringkasan, dua nama: dua nama. Beri setiap bagian di dalamnya nama kotak yang sama.');
  });
});

/** **P18.98-T4, the pitch's figures and its English for code with no reader** (`lib/recruitment-pitch.ts`). */
describe('P18.98-T4 the pitch’s file size in each language', () => {
  it('writes a size in the reader’s marks — Indonesian when none is passed — MB and KB alike in both', () => {
    expect(formatFileSize(2.4 * 1024 * 1024, 'en')).toBe('2.4 MB');
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2,4 MB');
    expect(formatFileSize(14_336, 'en')).toBe('14 KB');
    expect(formatFileSize(640, 'en')).toBe('< 1 KB');
    // The settings page's title, a kept term: the same in both languages.
    expect(PITCH_COPY.settingsTitle).toBe('Recruitment pitch');
  });
});
