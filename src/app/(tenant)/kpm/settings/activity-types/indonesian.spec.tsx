import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import ActivityTypesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activity-types',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'activity_binding:read'],
});

const type = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis',
  description: 'telepon, WhatsApp, dll', appliesToOrgLevelCodes: [], displayOrder: 2, version: 1,
  status: 'active', ...over,
});

/** Two sections the office typed, each with a tile of its own. */
const TAXONOMY = [
  {
    id: 'c1', code: 'SELLING', label: 'Selling', description: 'Penjualan langsung', appliesToOrgLevelCodes: [],
    displayOrder: 1, version: 1, status: 'active',
    types: [type({ id: 't0', code: 'SELL_PRESENTATION', label: 'Presentasi penjualan', displayOrder: 1 }), type()],
  },
  {
    id: 'c2', code: 'RECRUITING', label: 'Recruiting', description: null, appliesToOrgLevelCodes: ['AB'],
    displayOrder: 2, version: 1, status: 'active', types: [],
  },
];

const LADDER = [
  { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
  { orgLevelId: 'l2', companyId: 'co-1', code: 'AB', label: 'AB', displayOrder: 2, status: 'active', archivedAt: null },
];

function render(routes: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/kpm/settings/activity-types': { body: TAXONOMY },
    '/kpm/settings/activity-binding': {
      body: { leads: [], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'], version: 1, updatedAt: null },
    },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 3, workingVersion: 4, hasUnpublishedChanges: true, publishedAt: null },
    },
    '/kpm/config': { body: { activity: TAXONOMY, ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: LADDER },
    ...routes,
  });
  renderInIndonesian(<TenantConfigProvider><ActivityTypesPage /></TenantConfigProvider>, { me: OWNER });
  return stub;
}

/** Our own English words, which ID mode no longer writes: none of them is a kept term. */
const ENGLISH = /\b(Save|Cancel|Edit|Archive|Restore|Rename|Undo|Show archived|Applies to|Everyone|Add activity|Add category|activities|not saved yet|Counts as|Drag)\b/;

/** Open a ⋯ by its name and choose one of its items. */
async function choose(name: string, item: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Aksi untuk ${name}` }));
  await userEvent.click(within(screen.getByRole('menu', { name: `Aksi untuk ${name}` })).getByRole('menuitem', { name: item }));
}

/**
 * **P18.10-T4, Settings › Activity types in ID mode**: the screen's words the approved glossary's Indonesian, each kept
 * term English (§A) — its title and tabs, the cascade stage a bound type counts as — and what the office typed as typed.
 * Drawn since P19.21-T3 AC-1 as the client's 19 November cards (mockup f13–f14): *"n aktivitas · untuk …"*, the ⋯ with
 * *Ganti nama · Ubah untuk siapa · Arsipkan*, *+ Tambah aktivitas*, *+ Tambah kategori* and the legend.
 */
describe('P18.10-T4 Settings › Activity types in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 P19.21-T3 AC-1 says the screen in Indonesian and keeps its title and tabs English', async () => {
    render();
    await screen.findByText('Submission polis');

    expect(screen.getByRole('heading', { name: 'Activity types', level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Pengaturan aktivitas' });
    expect(within(tabs).getByRole('link', { name: 'Activity types' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'Ratio benchmarks' })).toBeInTheDocument();
    expect(screen.getByText('2 aktivitas · untuk Semua orang')).toBeInTheDocument();
    expect(screen.getByText('0 aktivitas · untuk AB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah kategori' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah aktivitas ke Selling' })).toHaveTextContent('Tambah aktivitas');
    expect(screen.getByText('Seret ⠿ untuk mengubah urutan')).toBeInTheDocument();
    expect(screen.getByText('⋯ = ganti nama, untuk siapa, arsipkan')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tampilkan yang diarsipkan' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-4 shows what the office typed as typed: categories, types, rungs', async () => {
    render();
    await screen.findByText('Submission polis');
    expect(screen.getByRole('heading', { name: 'Selling' })).toBeInTheDocument();
    expect(screen.getByText('Presentasi penjualan')).toBeInTheDocument();
    // A type's description is in its sheet (P19.21-T3 AC-1): the card draws the name only.
    await choose('Submission polis', 'Ganti nama');
    expect(screen.getByLabelText('Deskripsi')).toHaveValue('telepon, WhatsApp, dll');
  });

  it('AC-2 names the stage a bound type counts as in English, around Indonesian words', async () => {
    render();
    const chip = await screen.findByText('Dihitung sebagai: Sales meeting');
    expect(chip).toHaveAttribute(
      'title',
      'Ringkasan dan rencana goal menghitung ini sebagai Sales meeting. Ubah aktivitas mana yang dihitung di Pengaitan aktivitas.',
    );
    expect(screen.getByText('Dihitung sebagai: Submission polis')).toBeInTheDocument();
  });

  it('AC-1 says what is staged, row by row and in the bar, in Indonesian', async () => {
    render();
    await choose('Submission polis', 'Arsipkan');
    const row = screen.getByText('Submission polis').closest('li')!;

    expect(within(row).getByText('Diarsipkan — belum disimpan')).toBeInTheDocument();
    expect(within(row).getByText('diarsipkan')).toBeInTheDocument();
    expect(screen.getByText('1 perubahan belum disimpan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buang perubahan' })).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Urungkan' }));
    expect(screen.queryByText(/belum disimpan/)).not.toBeInTheDocument();
  });

  it('AC-1 adds a category and a type with the fields in Indonesian', async () => {
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah kategori' }));
    expect(screen.getByRole('heading', { name: 'Tambah kategori' })).toBeInTheDocument();
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Permanen setelah disimpan.');
    expect(screen.getByLabelText('Nama')).toBeInTheDocument();
    expect(screen.getByLabelText('Deskripsi')).toHaveAccessibleDescription('Opsional.');
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));

    await userEvent.click(screen.getByRole('button', { name: 'Tambah aktivitas ke Selling' }));
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Permanen. Setiap ratio dan goal terikat padanya.');
    expect(screen.getByLabelText('Kode')).toHaveAttribute('placeholder', 'SELL_REFERRAL');
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Deskripsi')).toHaveAccessibleDescription('Opsional. Ditampilkan di bawah nama di layar agent.');
    expect(screen.getByRole('button', { name: 'Tambah' })).toBeInTheDocument();
  });

  it('AC-1 renames a category from its ⋯, and the focus follows Ganti nama there and back (WCAG 2.4.3)', async () => {
    atWidth(1280);
    render();
    await choose('Selling', 'Ganti nama');
    expect(screen.getByLabelText('Nama')).toHaveFocus();
    expect(screen.getByLabelText('Kotak ringkasan')).toHaveAccessibleDescription(
      'Bagian dengan kotak yang sama dihitung bersama. Biarkan kosong agar bagian ini punya kotak sendiri.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByRole('button', { name: 'Aksi untuk Selling' })).toHaveFocus();
  });

  it('AC-1 refuses a tile name in Indonesian, the section’s name as typed', async () => {
    render();
    await choose('Selling', 'Ganti nama');
    await userEvent.type(screen.getByLabelText('Kotak ringkasan'), 'Penjualan');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByLabelText('Kotak ringkasan')).toHaveAccessibleDescription(
      expect.stringContaining('Bagian dengan kotak sendiri menampilkan namanya sendiri.'),
    );
  });

  it('AC-1 says the server’s tile refusal in Indonesian, the tile’s names as typed', async () => {
    render({
      '/kpm/settings/changes': {
        status: 422,
        body: {
          error: {
            code: 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH', message: 'Change 1: SALES has two labels.', requestId: 'r-1',
            details: { labels: ['Penjualan', 'Jualan'] },
          },
        },
      },
    });
    await choose('Submission polis', 'Arsipkan');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    expect(await screen.findByText(
      'Satu kotak ringkasan, dua nama: “Penjualan” dan “Jualan”. Beri setiap bagian di dalamnya nama kotak yang sama.',
    )).toBeInTheDocument();
  });

  it('P19.21-T3 AC-1 puts a category’s actions behind one ⋯, worded as the mockup words them', async () => {
    atWidth(1023);
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Aksi untuk Selling' }));
    const menu = within(screen.getByRole('menu', { name: 'Aksi untuk Selling' }));
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Ganti nama', 'Ubah untuk siapa', 'Arsipkan']);
    expect(menu.getByRole('menuitem', { name: 'Arsipkan' }))
      .toHaveAttribute('title', 'Mengarsipkan bagian ini beserta semua isinya.');
    await userEvent.click(menu.getByRole('menuitem', { name: 'Ubah untuk siapa' }));
    expect(screen.getByRole('group', { name: 'Berlaku untuk' })).toBeInTheDocument();
    expect(screen.getByText(/^Biarkan semua tanpa centang agar berlaku untuk semua orang\./)).toBeInTheDocument();
  });
});
