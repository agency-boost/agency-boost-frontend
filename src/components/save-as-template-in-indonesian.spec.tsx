import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { activityBindingMessages } from '@/i18n/messages/activity-binding';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { ActivityBindingCard } from './activity-binding-card';
import { SaveAsTemplateDialog } from './save-as-template-dialog';

/**
 * **P18.98-T6, an office's *Save as template* and *Activity binding* in ID mode** (AC-1 as T4's AC-1 to AC-3; area
 * "admin-template"): the two pieces of the Company template drawn on `/admin/tenants/[kpmId]`, whose own words are
 * another area's — their words the approved glossary's Indonesian (`admin-template.tsx`), an office's code, a company's
 * name and an activity type's label as stored, the three cascade stages kept English (§A.6). Their English is the
 * office page's own spec's (`tenants/[kpmId]/page.spec.tsx`), untouched.
 */
const ENGLISH = englishOnly(adminTemplateMessages, activityBindingMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);
const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company_template:write', 'activity_binding:read', 'activity_binding:write'],
});

describe('P18.98-T6 Save as template and the activity binding in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, AC-4 Save as template: its fields in Indonesian, the office’s code and the companies as stored', async () => {
    stubFetch({
      '/admin/companies': {
        body: [
          { _id: 'co-2', name: 'Allianz Life', slug: 'allianz', status: 'active' },
          { _id: 'co-1', name: 'Prudential', slug: 'prudential', status: 'active' },
        ],
      },
    });
    renderInIndonesian(
      <SaveAsTemplateDialog open kpm={{ _id: 'kpm-1', code: '0417', companyId: 'co-1' }} onClose={vi.fn()} onSaved={vi.fn()} />,
      { me: SUPER_ADMIN },
    );
    const dialog = within(screen.getByRole('dialog', { name: 'Simpan sebagai templat' }));
    expect(dialog.getByText(/^Yang dibaca agent KPM 0417 sekarang menjadi templat baru:/)).toBeInTheDocument();
    const company = await dialog.findByLabelText('Perusahaan');
    // Its own company first, as stored.
    expect(within(company).getAllByRole('option').map((o) => o.textContent)).toEqual(['Prudential', 'Allianz Life']);
    expect(company).toHaveAccessibleDescription(
      'Ke perusahaan lain, setiap file pelatihan disalin, dan setiap peran yang disebut pengaturan ini harus ada di '
      + 'susunan jenjangnya.',
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Simpan templat' }));
    expect(dialog.getByLabelText('Nama')).toHaveAccessibleDescription('Beri nama templat ini.');
    expect(dialog.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
    await clean();
  });

  it('AC-1 Save as template waits for the companies, named in Indonesian', () => {
    stubFetch({ '/admin/companies': () => new Promise(() => undefined) as never });
    renderInIndonesian(
      <SaveAsTemplateDialog open kpm={{ _id: 'kpm-1', code: '0417', companyId: 'co-1' }} onClose={vi.fn()} onSaved={vi.fn()} />,
      { me: SUPER_ADMIN },
    );
    expect(screen.getByText('Memuat daftar perusahaan…')).toBeInTheDocument();
  });

  it('AC-1, AC-2 the activity binding: its words in Indonesian, the stages kept, the types as typed', async () => {
    stubFetch({
      '/admin/tenants/kpm-1/activity-binding': {
        body: {
          kpmId: 'kpm-1', leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'],
          version: 1, updatedAt: null,
          types: [
            { code: 'LEADS_CONTACTED', label: 'Menghubungi leads', categoryCode: 'LEADS', displayOrder: 3, status: 'active' },
            { code: 'SELL_PRESENTATION', label: 'Presentasi', categoryCode: 'SELLING', displayOrder: 4, status: 'active' },
            { code: 'SALES_MEETING', label: 'Pertemuan penjualan baru', categoryCode: 'SELLING', displayOrder: 5, status: 'active' },
            { code: 'SELL_SUBMISSION', label: 'Submission polis', categoryCode: 'SELLING', displayOrder: 6, status: 'active' },
          ],
        },
      },
      'PUT /admin/tenants/kpm-1/activity-binding': {
        body: {
          kpmId: 'kpm-1', leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION', 'SALES_MEETING'],
          closings: ['SELL_SUBMISSION'], version: 2, updatedAt: null, types: [],
        },
      },
    });
    renderInIndonesian(<ActivityBindingCard kpmId="kpm-1" />, { me: SUPER_ADMIN });
    const card = (await screen.findByRole('heading', { name: 'Pengaitan aktivitas' })).parentElement!;
    expect(card).toHaveTextContent(
      'Aktivitas mana yang dihitung ringkasan, rencana goal, dan coaching di setiap tahap. Untuk mengganti aktivitas, '
      + 'tambahkan yang baru di samping yang lama: yang sudah tercatat pada aktivitas lama tetap dihitung.',
    );
    expect(await within(card).findByRole('group', { name: 'Set appointment' })).toBeInTheDocument();
    expect(within(card).getByRole('list', { name: 'Yang dihitung Sales meeting' })).toHaveTextContent('Presentasi');
    expect(within(card).getByRole('button', { name: 'Simpan pengaitan' })).toBeDisabled();
    // A replacement added beside the old one, by its name as the office typed it.
    await userEvent.selectOptions(
      within(card).getByRole('combobox', { name: 'Tambahkan aktivitas ke Sales meeting' }), 'SALES_MEETING',
    );
    await userEvent.click(within(card).getByRole('button', { name: 'Simpan pengaitan' }));
    expect(await within(card).findByRole('status')).toHaveTextContent('Tersimpan. Ringkasan menghitungnya mulai sekarang.');
    noEnglishLeft();
    await clean();
  });
});
