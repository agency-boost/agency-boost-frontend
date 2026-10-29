import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { adminTemplateOrgLevelsMessages } from '@/i18n/messages/admin-template-org-levels';
import OrgLevelsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/org-levels',
}));

/**
 * **P18.98-T6, the *Org role ladder* in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"): the ladder and
 * *Add a rung* in the approved glossary's Indonesian (`admin-template-org-levels.tsx`), the title, the two tiers and
 * *Template library* kept English (§A), and a company's name and a rung's label and code as stored. The same page in
 * English is `page.spec.tsx`.
 */
const ENGLISH = englishOnly(adminTemplateOrgLevelsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // `kpm:list_all` is the layout's gate, as `page.spec.tsx` says.
  permissions: ['kpm:list_all', 'org_level:read', 'org_level:crud', 'company:crud'],
});

const rung = (over: Record<string, unknown>) => ({
  orgLevelId: 'lvl-1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active',
  archivedAt: null, leaderTier: null, ...over,
});
const LADDER = [
  rung({}),
  rung({ orgLevelId: 'lvl-2', code: 'AAB', label: 'Associate Agency Builder', displayOrder: 2, leaderTier: 'associate' }),
  rung({ orgLevelId: 'lvl-3', code: 'AB', label: 'Agency Builder', displayOrder: 3, leaderTier: 'senior' }),
  rung({ orgLevelId: 'lvl-4', code: 'OLD', label: 'Penasihat', displayOrder: 4, status: 'archived' }),
];
const COMPANIES = [
  { _id: 'co-1', name: 'Prudential', slug: 'prudential', status: 'active', kind: 'insurer' },
  { _id: 'co-2', name: 'Sejahtera Baru Life', slug: 'sejahtera', status: 'active', kind: 'insurer' },
];

function mount(levels: unknown[] = LADDER, extra: Record<string, unknown> = {}) {
  const stub = stubFetch({ '/admin/org-levels': { body: levels }, '/admin/companies': { body: COMPANIES }, ...extra });
  renderWithSession(<InLanguage language="id"><AdminLayout><OrgLevelsPage /></AdminLayout></InLanguage>, { me: SUPER_ADMIN });
  return stub;
}

describe('P18.98-T6 the Org role ladder in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['Add a rung', 'Not a leader', 'Role ladder, junior first']));
  });

  it('AC-1, AC-2, AC-4 the ladder: its words in Indonesian, the tiers kept, every rung as named', async () => {
    mount();
    const table = await screen.findByRole('table', { name: 'Susunan jenjang, dari yang paling junior' });

    expect(screen.getByRole('heading', { level: 1, name: 'Org role ladder' })).toBeInTheDocument();
    expect(screen.getByText(/^Jenjang tempat perusahaan mempromosikan orang\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Perusahaan')).toHaveDisplayValue('Prudential');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Urutan', 'Jenjang', 'Tingkat leader', 'Status', 'Aksi']);
    const tier = within(table).getByRole('combobox', { name: 'Tingkat leader Agency Builder' });
    expect(tier).toHaveDisplayValue('Senior Leader');
    expect(within(tier).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Senior Leader', 'Associate Leader', 'Bukan leader']);
    expect(within(table).getAllByText('Aktif')).toHaveLength(3);
    expect(within(table).getByText('Diarsipkan')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'Arsipkan' })).toHaveLength(3);
    expect(within(table).getByRole('button', { name: 'Pulihkan' })).toBeInTheDocument();
    // The reading order, the active rungs bold in their own order.
    const order = screen.getByText(/^Urutan baca dari yang paling junior:/);
    expect(order).toHaveTextContent(
      'Urutan baca dari yang paling junior: Agent → Associate Agency Builder → Agency Builder. Mengarsipkan jenjang tidak '
      + 'menghapusnya, jadi semua orang yang pernah berada di jenjang itu tetap ditampilkan.',
    );
    expect(within(order).getByText('Agent → Associate Agency Builder → Agency Builder').tagName).toBe('STRONG');
    noEnglishLeft();
  });

  it('AC-3 a refused tier, how many stand on the rung, in one form for one and many', async () => {
    mount(LADDER, {
      '/admin/org-levels/lvl-3': {
        status: 409,
        body: { error: { code: 'ORG_LEVEL_TIER_IN_USE', message: 'Ditolak.', requestId: 'r-1', details: { members: 2 } } },
      },
    });
    const table = await screen.findByRole('table', { name: 'Susunan jenjang, dari yang paling junior' });
    await userEvent.selectOptions(within(table).getByRole('combobox', { name: 'Tingkat leader Agency Builder' }), '');
    expect(await screen.findByText(
      '2 orang berada di Agency Builder, jadi tingkat leader-nya tidak dapat diubah. Pindahkan mereka ke jenjang lain '
      + 'terlebih dahulu, atau tambahkan jenjang baru.',
    )).toBeInTheDocument();
  });

  it('AC-1 Add a rung: its fields, a code refused and the place it goes, in Indonesian', async () => {
    mount();
    await screen.findByRole('table', { name: 'Susunan jenjang, dari yang paling junior' });
    expect(screen.getByRole('heading', { name: 'Tambah jenjang' })).toBeInTheDocument();
    const code = screen.getByLabelText('Kode');
    expect(code).toHaveAccessibleDescription(expect.stringMatching(/^Stabil dan bermakna — AGENT, AAB, AB\./));
    await userEvent.type(code, '9X');
    expect(code).toHaveAccessibleDescription(expect.stringContaining('Huruf, angka, dan garis bawah, diawali huruf.'));
    expect(screen.getByLabelText('Label')).toHaveAccessibleDescription('Yang dilihat pembaca. Yang ini boleh Anda ubah.');
    expect(screen.getByLabelText('Tingkat leader', { selector: '#leader-tier' })).toHaveDisplayValue('Bukan leader');
    expect(screen.getByText('Jenjang ini ditambahkan di akhir susunan, di posisi 5.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah jenjang' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1, AC-4 a company with no ladder, by its name, in Indonesian', async () => {
    mount([]);
    expect(await screen.findByText('Prudential belum punya susunan jenjang. Tambahkan jenjang paling junior terlebih dahulu.'))
      .toBeInTheDocument();
    noEnglishLeft();
  });
});
