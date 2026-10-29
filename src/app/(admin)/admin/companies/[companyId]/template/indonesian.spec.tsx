import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, routeParams, stubFetch as stubRoutes } from '@test/harness';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { adminTemplateEditorMessages } from '@/i18n/messages/admin-template-editor';
import { checklistMessages } from '@/i18n/messages/settings-checklist';
import { settingsMessages } from '@/i18n/messages/settings';
import CompanyTemplatePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/template',
}));

/**
 * **P18.98-T6, the Company template in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"): the screen's words
 * the approved glossary's Indonesian (`admin-template.tsx`), its title and every tab kept English (§A.2, §A.3), and a
 * template's and a company's names, and every section and type a template holds, as typed (ADR-0179 §5). The same screen
 * in English is `page.spec.tsx`, untouched.
 *
 * **English left** (`englishShown`) is read against the screen's own areas and the office's settings' words it shares;
 * *Code*, a read-only code's label, is `CodeField`'s (`components/ui/`), the shared pieces', and is left out.
 */
const ENGLISH = englishOnly(adminTemplateMessages, adminTemplateEditorMessages, settingsMessages, checklistMessages)
  .filter((words) => words !== 'Code');
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const TEMPLATES = [
  {
    id: 't-default', companyId: 'c1', name: 'Prudential template', isDefault: true, status: 'active',
    archivedAt: null, origin: { kind: 'migration' }, officeCount: 3,
    publishedVersions: { activity_taxonomy: 1 }, createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
  },
  {
    id: 't-second', companyId: 'c1', name: 'Jakarta branches', isDefault: false, status: 'active', archivedAt: null,
    origin: { kind: 'empty' }, officeCount: 1, publishedVersions: {},
    createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
  },
  {
    id: 't-old', companyId: 'c1', name: 'Old settings', isDefault: false, status: 'archived',
    archivedAt: '2026-10-01T00:00:00.000Z', origin: { kind: 'empty' }, officeCount: 0, publishedVersions: {},
    createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
  },
];

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['company_template:read', 'company_template:write', 'recruitment_playbook:write'],
});

/** A taxonomy the template holds — its sections and types typed in the platform's own words (OD-238). */
const TAXONOMY = {
  id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1, status: 'draft',
  publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
  payload: {
    categories: [{ code: 'SELLING', label: 'Penjualan', displayOrder: 1 }],
    types: [{
      code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: 'Kirim SPAJ',
      displayOrder: 1,
    }],
  },
};

const COMPANIES = [
  { _id: 'c1', name: 'Prudential', slug: 'prudential', status: 'active', usesPlatformDefaults: true, kind: 'insurer' },
  { _id: 'c2', name: 'Allianz Life', slug: 'allianz-life', status: 'active', usesPlatformDefaults: true, kind: 'insurer' },
];

function mount(routes: Parameters<typeof stubRoutes>[0] = {}, body: unknown = TAXONOMY) {
  const stub = stubRoutes({
    '/admin/companies/c1/templates': { body: TEMPLATES },
    '/admin/companies/c1/template': { body },
    '/admin/companies': { body: COMPANIES },
    ...routes,
  });
  renderInIndonesian(<CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
  return stub;
}

const picker = () => screen.findByRole('combobox', { name: 'Templat' });

describe('P18.98-T6 the Company template in Indonesian', () => {
  afterEach(() => {
    window.location.hash = '';
    vi.unstubAllGlobals();
  });

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH.length).toBeGreaterThan(150);
    expect(ENGLISH).toEqual(expect.arrayContaining(['Back to companies', 'New template', 'Template sections']));
  });

  it('AC-2 says the screen in Indonesian and keeps its title and every tab English', async () => {
    mount();
    await screen.findByText('Submission polis');

    expect(screen.getByRole('heading', { level: 1, name: 'Company template' })).toBeInTheDocument();
    expect(screen.getByText('Yang menjadi awal setiap KPM baru perusahaan ini.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke daftar perusahaan' })).toHaveAttribute('href', '/admin/companies');
    const tabs = within(screen.getByRole('navigation', { name: 'Bagian templat' }));
    for (const tab of ['Activity types', 'Lead statuses', 'Activation checklist', 'Training', 'Capability Mapping',
      'Events', 'Campaigns', 'Products', 'Recruitment']) {
      expect(tabs.getByRole('link', { name: tab })).toBeInTheDocument();
    }
    // The tabs every template shares say so in their tooltip.
    expect(tabs.getByRole('link', { name: 'Products' }).closest('[title]') ?? tabs.getByRole('link', { name: 'Products' }))
      .toHaveAttribute('title', 'Products adalah milik perusahaan, dipakai bersama oleh setiap templat.');
    // The second row, named for its group, its halves kept English.
    const halves = within(screen.getByRole('navigation', { name: 'Bagian Activity types' }));
    expect(halves.getByRole('link', { name: 'Ratio benchmarks' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 says what an office made from it starts with, the template’s name as typed', async () => {
    mount();
    expect(await screen.findByText(
      'Belum ada yang diterbitkan, jadi KPM yang dibuat dari Prudential template dimulai tanpa isi bagian ini.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan draf' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Terbitkan versi 1' })).toBeInTheDocument();
    // Typed content as typed: a section, a type and its description.
    expect(screen.getByRole('heading', { name: 'Penjualan' })).toBeInTheDocument();
    expect(screen.getByText('Kirim SPAJ')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 says who is behind, one form for one and many, and the version in bold in its own order', async () => {
    mount({}, {
      ...TAXONOMY, status: 'draft', version: 3, publishedVersion: 2, officesBehind: 1, officesUnrecorded: 4,
    });
    const card = (await screen.findByText(/^KPM baru yang dibuat dari Prudential template dimulai dari/)).closest('p')!;
    expect(card).toHaveTextContent(
      'KPM baru yang dibuat dari Prudential template dimulai dari versi 2. Anda punya perubahan yang belum diterbitkan, '
      + 'yang akan menjadi versi 3.',
    );
    expect(within(card).getByText('versi 2').tagName).toBe('STRONG');
    expect(screen.getByText(
      '1 KPM menjalankan versi yang lebih lama. 4 KPM dibuat sebelum versi templat yang menjadi awalnya tercatat, jadi '
      + 'tidak diketahui apakah sudah mutakhir. Menerbitkan tidak mengubahnya — setiap KPM memiliki salinannya sendiri '
      + 'sejak hari dibuat.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the carrier rules reach every template’s offices, said in Indonesian', async () => {
    window.location.hash = '#campaign-tiers';
    mount({
      '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true }] },
    }, {
      id: 'tpl-5', companyId: 'c1', kind: 'campaign_kinds', version: 2, status: 'published', publishedAt: null,
      publishedVersion: 2, officesBehind: 0, officesUnrecorded: 0, payload: { rules: [] },
    });
    expect(await screen.findByText(/^KPM baru yang dibuat dari templat mana pun dimulai dari/)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the picker: the default marked, the archived apart, the offices counted, the actions in Indonesian', async () => {
    mount();
    const select = await picker();
    expect(within(select).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Prudential template · Default', 'Jakarta branches', 'Old settings']);
    expect(within(select).getByRole('group', { name: 'Diarsipkan' })).toBeInTheDocument();
    expect(screen.getByText('3 KPM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Templat baru' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Impor dari perusahaan lain' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Prudential template' }));
    expect(screen.getByRole('menuitem', { name: 'Ganti nama' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Jadikan default/ })).toHaveTextContent('Templat ini sudah menjadi default.');
    expect(screen.getByRole('menuitem', { name: /Arsipkan/ })).toHaveTextContent(
      'Templat default tidak dapat diarsipkan. Jadikan templat lain sebagai default terlebih dahulu.',
    );
    await userEvent.keyboard('{Escape}');

    await userEvent.selectOptions(select, 't-old');
    expect(await screen.findByText('Diarsipkan · 0 KPM')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 New template: where it starts, and a name asked for, in Indonesian', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Templat baru' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Templat baru' }));
    expect(dialog.getByText('Templat baru perusahaan ini. Templat ini belum menjadi default sampai Anda menjadikannya default.'))
      .toBeInTheDocument();
    expect(dialog.getByRole('group', { name: 'Mulai dengan' })).toBeInTheDocument();
    expect(dialog.getByRole('radio', { name: /^Kosong/ })).toBeChecked();
    expect(dialog.getByRole('radio', { name: /^Pengaturan default AgencyBoost/ })).toBeInTheDocument();
    // *Copy of* the template shown, its name as typed.
    expect(dialog.getByRole('radio', { name: /^Salinan Prudential template/ })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Buat templat' }));
    expect(dialog.getByLabelText('Nama')).toHaveAccessibleDescription('Beri nama templat ini.');
    expect(dialog.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Make default and Archive ask in Indonesian, the template’s name as typed', async () => {
    mount();
    await userEvent.selectOptions(await picker(), 't-second');
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Jakarta branches' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Jadikan default/ }));
    const question = screen.getByRole('dialog', { name: /^Jadikan Jakarta branches sebagai default\?/ });
    expect(within(question).getByRole('button', { name: 'Jadikan default' })).toBeInTheDocument();
    expect(within(question).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    await userEvent.click(within(question).getByRole('button', { name: 'Batal' }));

    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Jakarta branches' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Arsipkan/ }));
    const archive = screen.getByRole('dialog', { name: /^Arsipkan Jakarta branches\? Templat ini tetap dapat dibaca/ });
    expect(within(archive).getByRole('button', { name: 'Arsipkan templat' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 Import from another company: its fields in Indonesian, a company and its templates as named', async () => {
    mount({
      '/admin/companies/c2/templates': {
        body: [{ ...TEMPLATES[0], id: 'a-default', companyId: 'c2', name: 'Allianz Life template' }],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Impor dari perusahaan lain' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Impor dari perusahaan lain' }));
    expect(dialog.getByText(/^Salinan salah satu templatnya menjadi templat baru perusahaan ini\./)).toBeInTheDocument();
    const company = await dialog.findByLabelText('Perusahaan');
    expect(within(company).getByRole('option', { name: 'Pilih perusahaan' })).toBeInTheDocument();
    await userEvent.selectOptions(company, 'c2');
    expect(await dialog.findByLabelText('Templat')).toHaveDisplayValue('Allianz Life template · Default');
    expect(dialog.getByLabelText('Nama')).toHaveValue('Allianz Life template');
    expect(dialog.getByRole('button', { name: 'Impor templat' })).toBeEnabled();
    noEnglishLeft();
  });

  it('AC-1 Import says, in Indonesian, that a company has no active template, by its name', async () => {
    mount({ '/admin/companies/c2/templates': { body: [] } });
    await userEvent.click(await screen.findByRole('button', { name: 'Impor dari perusahaan lain' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Impor dari perusahaan lain' }));
    await userEvent.selectOptions(await dialog.findByLabelText('Perusahaan'), 'c2');
    expect(await dialog.findByText('Allianz Life tidak memiliki templat aktif untuk diimpor.')).toBeInTheDocument();
  });

  it('AC-1 asks before another tab discards a draft, in Indonesian, the tab’s name kept', async () => {
    mount();
    const row = (await screen.findByText('Submission polis')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));
    await userEvent.type(within(row).getByLabelText('Nama'), ' baru');
    await userEvent.click(within(row).getByRole('button', { name: 'Simpan' }));
    await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ada perubahan di sini yang belum disimpan.');
    expect(alert).toHaveTextContent(
      'Membuka Sales akan membuang perubahan itu — draf hanya ada di satu tab pada satu waktu.',
    );
    expect(within(alert).getByRole('button', { name: 'Buang dan buka Sales' })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Tetap di sini' })).toBeInTheDocument();
    noEnglishLeft();
  });
});
