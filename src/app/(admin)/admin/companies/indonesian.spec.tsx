import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { adminTemplateCompaniesMessages } from '@/i18n/messages/admin-template-companies';
import CompaniesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies',
}));

/**
 * **P18.10-T6, *Manage Companies* in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"): the list and *Add a
 * company* in the approved glossary's Indonesian (`admin-template-companies.ts`), the title kept English (§A), the
 * library *Template bawaan AgencyBoost* and a company's templates *Template KPM* (ADR-0185 §1), and a company's name,
 * slug, currency and time zone as stored. The same page in English is `page.spec.tsx`.
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

function mount(rows: unknown[], extra: Record<string, unknown> = {}) {
  stubFetch({ '/admin/companies': { body: rows }, ...extra });
  renderWithSession(<InLanguage language="id"><AdminLayout><CompaniesPage /></AdminLayout></InLanguage>, { me: SUPER_ADMIN });
}

describe('P18.10-T6 Manage Companies in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['Add a company', 'Suspend', 'Started blank']));
  });

  // Moved 2026-11-06 (P19.2-T2 AC-1, AC-3, AC-4; UI-126, UI-133, UI-134): a laptop's columns are *Nama · Status ·
  // Template default · KPM · Anggota* (the slug, the currency and the time zone on the company page); *Ubah* and
  // *Tangguhkan* in the row's ⋯; *Tambah perusahaan* a sheet opened from the title row, *Mulai dari* two choice rows.
  it('AC-1, AC-2, AC-4, ADR-0185 the list: its words in Indonesian, the title kept, the library a card, every company as stored', async () => {
    mount([PRUDENTIAL, BLANK, LIBRARY]);
    const table = await screen.findByRole('table', { name: 'Perusahaan' });

    expect(screen.getByRole('heading', { level: 1, name: 'Manage Companies' })).toBeInTheDocument();
    // P19.2-T2 AC-7 (UI-136, Appendix A): the page's sub-line removed at every size.
    expect(screen.queryByText('Setiap perusahaan memiliki susunan jenjang, produk, dan Template KPM sendiri.')).toBeNull();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Nama', 'Status', 'Template default', 'KPM', 'Anggota', 'Aksi']);
    const prudential = within(table).getByRole('row', { name: /Prudential/ });
    expect(within(prudential).getByText('Aktif')).toBeInTheDocument();
    expect(within(prudential).getByRole('link', { name: 'Prudential' })).toHaveAttribute('href', '/admin/companies/co-1');
    await userEvent.click(within(prudential).getByRole('button', { name: 'Tindakan untuk Prudential' }));
    expect(screen.getByRole('menuitem', { name: 'Ubah' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tangguhkan' })).toHaveAttribute(
      'title', 'Tidak ada orang baru dan KPM baru yang bergabung ke perusahaan ini. KPM yang sudah ada tetap berjalan.',
    );
    await userEvent.keyboard('{Escape}');
    const blank = within(table).getByRole('row', { name: /Sejahtera Baru Life/ });
    expect(within(blank).getByText('Ditangguhkan')).toBeInTheDocument();
    expect(within(blank).getByText('Dimulai kosong')).toBeInTheDocument();
    await userEvent.click(within(blank).getByRole('button', { name: 'Tindakan untuk Sejahtera Baru Life' }));
    expect(screen.getByRole('menuitem', { name: 'Aktifkan kembali' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    const library = screen.getByRole('link', { name: /Template bawaan AgencyBoost/ });
    expect(library).toHaveTextContent('Disalin saat perusahaan atau KPM baru dibuat.');
    expect(within(table).queryByRole('row', { name: /^Template template / })).toBeNull();
    noEnglishLeft();
  });

  it('P19.2-T2 AC-1 at 375px a company’s row: its slug and its KPMs, in Indonesian', async () => {
    atWidth(375);
    mount([PRUDENTIAL], { '/admin/overview': { body: { tiles: {}, attention: [], companies: [
      { companyId: 'co-1', name: 'Prudential', initials: 'PR', kpmCount: 2, memberCount: 38, ladder: [] },
    ] } } });
    const list = await screen.findByRole('list', { name: 'Perusahaan' });
    await waitFor(() => expect(list).toHaveTextContent('prudential · 2 KPM'));
    expect(within(list).getByRole('button', { name: 'Tindakan untuk Prudential' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a rename in its sheet, and a slug refused, in Indonesian', async () => {
    mount([PRUDENTIAL]);
    const table = await screen.findByRole('table', { name: 'Perusahaan' });
    await userEvent.click(within(table).getByRole('button', { name: 'Tindakan untuk Prudential' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ubah' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ubah perusahaan' });
    const slug = within(sheet).getByLabelText('Slug');
    expect(slug).toHaveAccessibleDescription('Tidak ada yang menyimpannya — setiap KPM merujuk ke perusahaan lewat id-nya.');
    await userEvent.clear(slug);
    await userEvent.type(slug, 'Bad Slug');
    expect(slug).toHaveAccessibleDescription(expect.stringContaining('Huruf kecil dan angka, dipisahkan oleh satu tanda hubung.'));
    expect(within(sheet).getByRole('button', { name: 'Simpan' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Add a company: where it starts from, by the library’s name, and what an office inherits', async () => {
    mount([PRUDENTIAL, LIBRARY]);
    await screen.findByRole('table', { name: 'Perusahaan' });
    expect(screen.queryByRole('heading', { name: 'Tambah perusahaan' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tambah perusahaan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Tambah perusahaan' });
    expect(within(sheet).getByRole('heading', { name: 'Tambah perusahaan' })).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Slug')).toHaveAccessibleDescription('Diisi dari nama. Unik.');
    const start = within(sheet).getByRole('radiogroup', { name: 'Mulai dari' });
    const [library, empty] = within(start).getAllByRole('radio');
    expect(library).toHaveAccessibleName('Template bawaan AgencyBoost');
    expect(empty).toHaveAccessibleName('Kosong');
    expect(library).toHaveAccessibleDescription('Salinannya, dengan produk, aturan perusahaan asuransi, dan playbook, siap diubah.');
    await userEvent.click(empty);
    expect(empty).toHaveAccessibleDescription('Semuanya dimulai kosong, kecuali susunan jenjang.');
    expect(within(sheet).getByText('Yang diwarisi KPM')).toBeInTheDocument();
    expect(within(sheet).getByText('IDR · Asia/Jakarta · id-ID')).toBeInTheDocument();
    // The main button is enabled (UI-133): pressed empty, the name says what it needs.
    await userEvent.click(within(sheet).getByRole('button', { name: 'Tambah perusahaan' }));
    expect(within(sheet).getByLabelText('Nama')).toHaveAccessibleDescription('Wajib diisi.');
    expect(within(sheet).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 no Template library, and no company at all, in Indonesian', async () => {
    mount([]);
    expect(await screen.findByText('Belum ada perusahaan. Tambahkan satu untuk mulai menyiapkan KPM.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tambah perusahaan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Tambah perusahaan' });
    expect(within(within(sheet).getByRole('radiogroup', { name: 'Mulai dari' })).getAllByRole('radio').map((o) => o.textContent))
      .toEqual([expect.stringMatching(/^Template bawaan AgencyBoost/), expect.stringMatching(/^Kosong/)]);
    noEnglishLeft();
  });
});
