import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { adminTemplateCompaniesMessages } from '@/i18n/messages/admin-template-companies';
import CompaniesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies',
}));

/**
 * **P18.98-T6, *Manage Companies* in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"): the list and *Add a
 * company* in the approved glossary's Indonesian (`admin-template-companies.ts`), the title, *Company template* and
 * *Template library* kept English (§A), and a company's name, slug, currency and time zone as stored. The same page in
 * English is `page.spec.tsx`.
 */
const ENGLISH = englishOnly(adminTemplateCompaniesMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company:crud'],
});

const PRUDENTIAL = {
  _id: 'co-1', name: 'Prudential', slug: 'prudential', defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta',
  status: 'active', usesPlatformDefaults: true, kind: 'insurer',
};
const BLANK = { ...PRUDENTIAL, _id: 'co-2', name: 'Sejahtera Baru Life', slug: 'sejahtera-baru', usesPlatformDefaults: false, status: 'suspended' };
const LIBRARY = {
  _id: '000000000000000000000001', name: 'Template', slug: 'template', defaultCurrency: 'IDR',
  defaultTimezone: 'Asia/Jakarta', status: 'active', usesPlatformDefaults: true, kind: 'template',
};

function mount(rows: unknown[]) {
  stubFetch({ '/admin/companies': { body: rows } });
  renderWithSession(<InLanguage language="id"><AdminLayout><CompaniesPage /></AdminLayout></InLanguage>, { me: SUPER_ADMIN });
}

describe('P18.98-T6 Manage Companies in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['Add a company', 'Suspend', 'Started blank']));
  });

  it('AC-1, AC-2, AC-4 the list: its words in Indonesian, the title and the template kept, every company as stored', async () => {
    mount([PRUDENTIAL, BLANK, LIBRARY]);
    const table = await screen.findByRole('table', { name: 'Perusahaan' });

    expect(screen.getByRole('heading', { level: 1, name: 'Manage Companies' })).toBeInTheDocument();
    expect(screen.getByText(/^Setiap perusahaan memiliki susunan jenjang, katalog produk, dan Company template sendiri\./))
      .toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Nama', 'Slug', 'Mata uang', 'Zona waktu', 'Status', 'Company template', 'Aksi']);
    const prudential = within(table).getByRole('row', { name: /Prudential/ });
    expect(within(prudential).getByText('prudential')).toBeInTheDocument();
    expect(within(prudential).getByText('Aktif')).toBeInTheDocument();
    expect(within(prudential).getByRole('link', { name: 'Company template' })).toBeInTheDocument();
    expect(within(prudential).getByRole('button', { name: 'Ubah' })).toBeInTheDocument();
    expect(within(prudential).getByRole('button', { name: 'Tangguhkan' })).toHaveAttribute(
      'title', 'Tidak ada orang baru dan KPM baru yang bergabung ke perusahaan ini. KPM yang sudah ada tetap berjalan.',
    );
    const blank = within(table).getByRole('row', { name: /Sejahtera Baru Life/ });
    expect(within(blank).getByText('Ditangguhkan')).toBeInTheDocument();
    expect(within(blank).getByText('Dimulai kosong')).toBeInTheDocument();
    expect(within(blank).getByRole('button', { name: 'Aktifkan kembali' })).toBeInTheDocument();
    expect(within(within(table).getByRole('row', { name: /^Template template / })).getByText('Template library'))
      .toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a rename in the row, and a slug refused, in Indonesian', async () => {
    mount([PRUDENTIAL]);
    const table = await screen.findByRole('table', { name: 'Perusahaan' });
    await userEvent.click(within(table).getByRole('button', { name: 'Ubah' }));
    const slug = within(table).getByLabelText('Slug');
    expect(slug).toHaveAccessibleDescription('Tidak ada yang menyimpannya — setiap KPM merujuk ke perusahaan lewat id-nya.');
    await userEvent.clear(slug);
    await userEvent.type(slug, 'Bad Slug');
    expect(slug).toHaveAccessibleDescription(expect.stringContaining('Huruf kecil dan angka, dipisahkan oleh satu tanda hubung.'));
    expect(within(table).getByRole('button', { name: 'Simpan' })).toBeDisabled();
    expect(within(table).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Add a company: where it starts from, by the library’s name, and what an office inherits', async () => {
    mount([PRUDENTIAL, LIBRARY]);
    await screen.findByRole('table', { name: 'Perusahaan' });
    expect(screen.getByRole('heading', { name: 'Tambah perusahaan' })).toBeInTheDocument();
    expect(screen.getByLabelText('Slug', { selector: '#slug' }))
      .toHaveAccessibleDescription('Diisi dari nama, dan boleh Anda ubah. Unik, dan tidak diganti nama nanti.');
    const start = screen.getByLabelText('Mulai dari');
    expect(within(start).getAllByRole('option').map((o) => o.textContent)).toEqual(['Template · Templat default', 'Kosong']);
    expect(start).toHaveAccessibleDescription(expect.stringMatching(/^Salinan Template library: susunan jenjang, produk/));
    await userEvent.selectOptions(start, 'empty');
    expect(start).toHaveAccessibleDescription(expect.stringMatching(/^Semuanya dimulai kosong\./));
    expect(screen.getByText('Yang diwarisi KPM')).toBeInTheDocument();
    expect(screen.getByText('IDR · Asia/Jakarta · id-ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah perusahaan' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1 no Template library, and no company at all, in Indonesian', async () => {
    mount([]);
    expect(await screen.findByText('Belum ada perusahaan. Tambahkan satu untuk mulai menyiapkan KPM.')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Mulai dari')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Pengaturan default AgencyBoost', 'Kosong']);
    noEnglishLeft();
  });
});
