import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithLanguage, resetLanguage, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { ModuleContentEditor } from '@/components/module-content';
import { settingsMessages } from '@/i18n/messages/settings';
import { trainingSettingsMessages } from '@/i18n/messages/training-settings';
import TrainingSettingsPage from './page';
import TrainingModulePage from './[moduleId]/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/kpm/settings/training',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'training_settings:read'],
});

const moduleRow = (over: Record<string, unknown>) => ({
  id: 'm-x', code: 'X', skillCode: 'PROSPEK', title: 'X', publishState: 'published',
  displayOrder: 1, version: 1, status: 'active', ...over,
});

/** The office's own catalog, in its own words (OD-238: the Default template is to be Indonesian). */
const TREE = [
  {
    id: 'c-sales', code: 'PENJUALAN', label: 'Penjualan', description: 'Dasar-dasar menjual', displayOrder: 1, version: 1,
    status: 'active',
    skills: [
      {
        id: 's-prospek', code: 'PROSPEK', categoryCode: 'PENJUALAN', label: 'Mencari prospek', displayOrder: 1, version: 2,
        status: 'active',
        modules: [
          moduleRow({ id: 'm-list', code: 'DAFTAR_PROSPEK', title: 'Menyusun daftar prospek', version: 4 }),
          moduleRow({ id: 'm-cold', code: 'TELEPON', title: 'Telepon pertama', publishState: 'draft', displayOrder: 2 }),
        ],
      },
    ],
  },
  { id: 'c-produk', code: 'PRODUK', label: 'Produk', description: null, displayOrder: 2, version: 1, status: 'active', skills: [] },
  {
    id: 'c-old', code: 'LAMA', label: 'Cara lama', description: null, displayOrder: 3, version: 3, status: 'archived',
    skills: [{
      id: 's-old', code: 'LAMA_SKILL', categoryCode: 'LAMA', label: 'Ketuk pintu', displayOrder: 1, version: 2,
      status: 'archived', modules: [],
    }],
  },
];

const CONTENT_URL = '/kpm/settings/training/modules/DAFTAR_PROSPEK/content';
const file = (over: Record<string, unknown> = {}) => ({
  id: 'f1', label: 'Materi prospek', storageKey: 'dev/kpm-1/training/0001', mimeType: 'application/pdf', bytes: 2_097_152, ...over,
});
const content = (over: Record<string, unknown> = {}) => ({
  moduleCode: 'DAFTAR_PROSPEK', title: 'Menyusun daftar prospek',
  content: { files: [file()], videos: [], links: [{ id: 'l1', label: 'Webinar', url: 'https://example.com/w' }] },
  companyContent: { files: [file()], videos: [], links: [] },
  overridden: false,
  ...over,
});

function stubs(extra: Record<string, unknown> = {}) {
  return stubFetch({
    '/kpm/settings/training': { body: TREE },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    '/kpm/settings/changes': { body: { training: [], version: 2 } },
    [CONTENT_URL]: { body: content() },
    ...extra,
  });
}

/** The screens' English that ID mode must not show — theirs, and the settings frame's they draw. */
const SETTINGS_ENGLISH = englishOnly(trainingSettingsMessages, settingsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, SETTINGS_ENGLISH)).toEqual([]);

const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;
const tabs = () => within(screen.getByRole('navigation', { name: 'Bagian Training' }));

/**
 * **P18.98-T4, Settings › Training in ID mode** (ADR-0179 §3–§5): the list, a module's page and its Files, Videos and
 * Links in the approved glossary's Indonesian; the title, the tabs, *Skill* and *KPM* English (§A); every category, skill,
 * module, file and link as the office typed it; a file's size in the reader's figures. In English: `page.spec.tsx`,
 * `[moduleId]/page.spec.tsx` and `components/module-content.spec.tsx`.
 */
describe('P18.98-T4 Settings › Training in Indonesian', () => {
  beforeEach(() => window.history.replaceState(null, '', '/kpm/settings/training'));
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
    resetLanguage();
  });

  it('AC-2 categories: the title and tabs kept, the line, badges and controls in Indonesian, the office’s as typed', async () => {
    stubs();
    renderInIndonesian(<TrainingSettingsPage />, { me: OWNER });
    await screen.findByText('Penjualan');
    expect(screen.getByRole('heading', { level: 1, name: 'Training' })).toBeInTheDocument();
    expect(screen.getByText('Kategori, skill, dan modul yang tersedia untuk KPM ini')).toBeInTheDocument();
    expect(tabs().getAllByRole('link').map((l) => l.textContent)).toEqual(['Categories', 'Skills', 'Modules']);
    expect(within(rowOf('Penjualan')).getByText('1 skill · 1 modul diterbitkan')).toBeInTheDocument();
    expect(within(rowOf('Penjualan')).getByText('Dasar-dasar menjual')).toBeInTheDocument();
    expect(within(rowOf('Produk')).getByText('Kosong')).toBeInTheDocument();
    expect(screen.getByLabelText('Tampilkan yang diarsipkan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tambah kategori' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 adding a category: the fields, a code taken and its refusal in Indonesian, the code’s example as it is', async () => {
    stubs();
    renderInIndonesian(<TrainingSettingsPage />, { me: OWNER });
    await screen.findByText('Penjualan');
    await userEvent.click(screen.getByRole('button', { name: '+ Tambah kategori' }));
    expect(screen.getByRole('heading', { name: 'Tambah kategori' })).toBeInTheDocument();
    expect(screen.getByLabelText('Kode')).toHaveAttribute('placeholder', 'PRODUCT_KNOWLEDGE');
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Diisi dari nama. Permanen setelah disimpan.');
    expect(screen.getByLabelText('Deskripsi')).toHaveAccessibleDescription(
      'Opsional. Ditampilkan di bawah nama di layar pelatihan agent.',
    );
    await userEvent.type(screen.getByLabelText('Nama'), 'Lama');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'KPM ini sudah punya kategori dengan kode ini. Yang diarsipkan ikut dihitung — kode tidak pernah dipakai ulang.',
    );
    expect(screen.getByRole('button', { name: 'Tambah kategori ini' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1 staging: an archive reaching down, its marks and Restore first in Indonesian', async () => {
    stubs();
    renderInIndonesian(<TrainingSettingsPage />, { me: OWNER });
    await screen.findByText('Penjualan');
    await userEvent.click(within(rowOf('Penjualan')).getByRole('button', { name: 'Arsipkan' }));
    expect(within(rowOf('Penjualan')).getByText('Diarsipkan — belum disimpan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeInTheDocument();
    await userEvent.click(tabs().getByRole('link', { name: 'Skills' }));
    expect(within(rowOf('Mencari prospek')).getByText('Diarsipkan bersama Penjualan — belum disimpan')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 skills and modules: the filters, the counts, the switch and the empty states in Indonesian', async () => {
    stubs();
    renderInIndonesian(<TrainingSettingsPage />, { me: OWNER });
    await screen.findByText('Penjualan');
    await userEvent.click(tabs().getByRole('link', { name: 'Skills' }));
    expect(within(rowOf('Mencari prospek')).getByText('2 modul')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Kategori'), 'PRODUK');
    expect(screen.getByText('Belum ada skill untuk kategori ini.')).toBeInTheDocument();

    await userEvent.click(tabs().getByRole('link', { name: 'Modules' }));
    expect(within(screen.getByLabelText('Skill')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Semua skill', 'Mencari prospek']);
    expect(within(rowOf('Menyusun daftar prospek')).getByRole('switch', { name: 'Diterbitkan' })).toBeChecked();
    expect(within(rowOf('Telepon pertama')).getByRole('switch', { name: 'Diterbitkan' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: '+ Tambah modul' }));
    expect(screen.getByText(/^Modul baru dimulai sebagai draf/)).toHaveTextContent(
      'Modul baru dimulai sebagai draf, yang tidak ditawarkan ke agent mana pun. Terbitkan di sini saat sudah siap — '
      + 'agent melihatnya setelah KPM Anda menerbitkan perubahannya berikutnya.',
    );
    noEnglishLeft();
  });

  it('AC-3 opening a module with edits staged asks in Indonesian, the module’s title inside the sentence', async () => {
    window.history.replaceState(null, '', '/kpm/settings/training#modules');
    stubs();
    renderInIndonesian(<TrainingSettingsPage />, { me: OWNER });
    await screen.findByText('Menyusun daftar prospek');
    await userEvent.click(within(rowOf('Telepon pertama')).getByRole('switch', { name: 'Diterbitkan' }));
    await userEvent.click(within(rowOf('Menyusun daftar prospek')).getByRole('link', { name: 'Ubah' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ada perubahan di sini yang belum disimpan. Membuka Menyusun daftar prospek akan membuang perubahan itu.',
    );
    expect(screen.getByRole('button', { name: 'Buang dan buka Menyusun daftar prospek' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tetap di sini' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-2 a module’s page: its fields, the switch’s line and the way back in Indonesian, its title as typed', async () => {
    stubs();
    renderInIndonesian(<TrainingModulePage params={routeParams({ moduleId: 'm-list' })} />, { me: OWNER });
    expect(await screen.findByRole('heading', { level: 1, name: 'Menyusun daftar prospek' })).toBeInTheDocument();
    expect(screen.getByText('Penjualan › Mencari prospek')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke Training' })).toBeInTheDocument();
    expect(screen.getByLabelText('Judul')).toHaveValue('Menyusun daftar prospek');
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription(/^Permanen\. Apa pun yang merujuk ke modul ini/);
    expect(screen.getByText('Agent ditawari modul ini setelah KPM Anda menerbitkan perubahannya berikutnya.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Kategori'), 'PRODUK');
    expect(screen.getByText('Kategori ini belum punya skill. Tambahkan terlebih dahulu di Training.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a module not in the office: not found, in Indonesian, its fallback title Modul Training', async () => {
    stubs();
    renderInIndonesian(<TrainingModulePage params={routeParams({ moduleId: 'm-nobody' })} />, { me: OWNER });
    expect(await screen.findByText('Modul ini tidak ada di katalog pelatihan KPM Anda.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modul Training' })).toBeInTheDocument();
  });

  it('AC-3 an archived module: one sentence with its link inside, in Indonesian', async () => {
    const archived = structuredClone(TREE);
    archived[0].skills[0].modules[0].status = 'archived';
    stubs({ '/kpm/settings/training': { body: archived } });
    renderInIndonesian(<TrainingModulePage params={routeParams({ moduleId: 'm-list' })} />, { me: OWNER });
    const line = (await screen.findByText('Modul ini sudah diarsipkan.')).parentElement!;
    expect(line).toHaveTextContent(
      'Modul ini sudah diarsipkan. Tidak ada agent yang ditawari modul ini. Pulihkan dari Training — di Modules, dengan '
      + 'Tampilkan yang diarsipkan aktif.',
    );
    expect(within(line).getByRole('link', { name: 'Training' })).toHaveAttribute('href', '/kpm/settings/training#modules');
    expect(screen.getByText('Status terbit')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-2 a module’s content: the sections, the company’s material and the controls in Indonesian, a size in its figures', async () => {
    stubs();
    renderInIndonesian(<ModuleContentEditor moduleCode="DAFTAR_PROSPEK" canWrite />, { me: OWNER });
    expect(await screen.findByText('Ini materi perusahaan Anda.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'File' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Video' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tautan' })).toBeInTheDocument();
    expect(screen.getAllByText('1 item')).toHaveLength(1);
    expect(screen.getByText('1 tautan')).toBeInTheDocument();
    expect(screen.getByText('Belum ada apa pun di sini.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Materi prospek')).toBeInTheDocument();
    expect(screen.getByText('2,0 MB')).toBeInTheDocument();
    expect(screen.getByLabelText('Tambahkan ke File')).toBeInTheDocument();
    expect(screen.getByLabelText('Alamat')).toHaveAccessibleDescription('Harus diawali https://');
    expect(screen.getByRole('button', { name: 'Simpan konten' })).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0]);
    expect(screen.getByText(/^Belum disimpan — file yang Anda tambahkan/)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a module’s own material, and an oversized file refused, in Indonesian', async () => {
    stubs({ [CONTENT_URL]: { body: content({ overridden: true }) } });
    renderInIndonesian(<ModuleContentEditor moduleCode="DAFTAR_PROSPEK" canWrite />, { me: OWNER });
    expect(await screen.findByText('KPM ini punya materi sendiri untuk modul ini.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gunakan lagi materi perusahaan saya' }))
      .toHaveAttribute('title', 'Mengembalikan 1 file dan 0 tautan milik perusahaan Anda.');
    const big = new File(['x'], 'besar.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText('Tambahkan ke File'), big);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File maksimal 25 MB. “besar.pdf” berukuran 26,0 MB. Yang lebih besar letakkan di Tautan.',
    );
  });

  it('P18.98-T3 figures: a reader with no choice reads the words in English and the size in Indonesian figures', async () => {
    stubs();
    renderWithLanguage(<ModuleContentEditor moduleCode="DAFTAR_PROSPEK" canWrite />, { me: OWNER }, { live: false });
    expect(await screen.findByText('This is your company’s material.')).toBeInTheDocument();
    expect(screen.getByText('2,0 MB')).toBeInTheDocument();
  });
});
