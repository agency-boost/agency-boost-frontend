import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import ActivationChecklistPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activation-checklist',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'activation_settings:read', 'training_settings:read'],
});

/** The office's own aspects and items, in its own words (OD-238: the Default template is to be Indonesian). */
const item = (over: Record<string, unknown> = {}) => ({
  code: 'DASAR_ASURANSI', label: 'Pelajari dasar-dasar asuransi', displayOrder: 1, autoLink: null, link: null, ...over,
});
const PUBLISHED = {
  id: 'v1', version: 1, status: 'published', publishedAt: '2026-09-01T00:00:00.000Z',
  aspects: [
    {
      code: 'PENGENALAN', label: '1. Pengenalan', displayOrder: 1,
      items: [item(), item({ code: 'POLA_PIKIR', label: 'Pahami pola pikir karier agency', displayOrder: 2 })],
    },
    {
      code: 'PERSIAPAN', label: '2. Persiapan awal', displayOrder: 2,
      items: [item({
        code: 'GOAL_SETTING', label: 'Atur goal: target APE & aktivitas', autoLink: 'feature:goals',
        link: {
          kind: 'feature:goals', label: 'Goal Settings', route: '/goals',
          completesWhen: 'the hire has saved any goal since joining', live: true,
        },
      })],
    },
  ],
};
const DRAFT = { ...PUBLISHED, id: 'v2', version: 2, status: 'draft', publishedAt: null };

const TRAINING = [{
  id: 'c1', code: 'SALES', label: 'Penjualan', description: null, displayOrder: 1, version: 1, status: 'active',
  skills: [{
    id: 's1', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospek', displayOrder: 1, version: 1, status: 'active',
    modules: [{
      id: 'm1', code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Menyusun daftar prospek',
      publishState: 'published', displayOrder: 1, version: 1, status: 'active',
    }],
  }],
}];

function render(checklist: unknown = { published: PUBLISHED, draft: null, windowDays: 90 }) {
  stubFetch({
    '/kpm/settings/activation-checklist': { body: checklist },
    '/kpm/settings/training': { body: TRAINING },
  });
  renderInIndonesian(<ActivationChecklistPage />, { me: OWNER });
}

/** Our own English words, which ID mode no longer writes (*Item* is §B.4's, spelled alike; its plural is not). */
const ENGLISH = /\b(Save draft|Publish to agents|New hires are given|Nothing is published|Draft\.|days|Rename|Remove|Add aspect|Add item|Completes|No link|Feature|items)\b/;

const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;
async function openItem(label: string) {
  await userEvent.click(within(rowOf(label)).getByRole('button', { name: new RegExp(`^${label}`) }));
  return screen.findByRole('dialog', { name: label });
}

/**
 * **P18.10-T4, Settings › Activation checklist in ID mode**: the screen's words the approved glossary's Indonesian, its
 * title, the features an item completes from and *new hire* English (§A), and the office's aspects and items as typed.
 * Drawn since P19.21-T3 AC-3 as the client's 19 November card (mockup f16). In English: `page.spec.tsx`.
 */
describe('P18.10-T4 Settings › Activation checklist in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 P19.21-T3 AC-3 says the note, the cards and their lines in Indonesian, as the mockup words them', async () => {
    render();
    expect(await screen.findByText(
      'New hire mendapat versi 1 · 90 hari. Perubahan menjadi versi baru, hanya untuk new hire berikutnya.',
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activation checklist', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '1. Pengenalan' })).toHaveTextContent('2 item');
    expect(within(rowOf('Pelajari dasar-dasar asuransi')).getByText('Selesai otomatis dari: manual')).toBeInTheDocument();
    expect(within(rowOf('Atur goal: target APE & aktivitas')).getByText('Selesai otomatis dari: Goal Setting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah item ke 1. Pengenalan' })).toHaveTextContent('Tambah item');
    expect(screen.getByRole('button', { name: 'Tambah aspek' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-2 P19.21-T3 AC-3 says the draft bar in Indonesian: Draf, the version agents are on, Simpan draf, Terbitkan ke agent', async () => {
    render({ published: PUBLISHED, draft: DRAFT, windowDays: 90 });
    await screen.findByText('Pelajari dasar-dasar asuransi');
    const bar = document.querySelector<HTMLElement>('[data-draft-bar]')!;
    expect(bar).toHaveTextContent('Draf. Agent masih memakai versi 1.');
    expect(within(bar).getByRole('button', { name: 'Simpan draf' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: 'Terbitkan ke agent' })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-1 says the other versions’ sentences in Indonesian, with the window', async () => {
    render({ published: null, draft: DRAFT, windowDays: 90 });
    expect(await screen.findByText(/^Belum ada yang diterbitkan, jadi belum ada new hire yang mendapat checklist\. Draf Anda akan menjadi/))
      .toBeInTheDocument();
    expect(screen.getByText(/Jangka waktunya/)).toHaveTextContent('Jangka waktunya 90 hari.');
    expect(document.querySelector('[data-draft-bar]')).toHaveTextContent('Draf. Belum ada yang diterbitkan.');
  });

  it('AC-1 says the standard checklist’s sentence in Indonesian, its name in bold', async () => {
    render({ published: null, draft: { ...DRAFT, id: '', version: 1 }, windowDays: 90 });
    expect((await screen.findByText('checklist standar')).tagName).toBe('STRONG');
  });

  it('AC-1 adds an aspect and edits an item with the fields in Indonesian', async () => {
    render();
    await screen.findByText('Pelajari dasar-dasar asuransi');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah aspek' }));
    expect(screen.getByRole('heading', { name: 'Tambah aspek' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aspek')).toBeInTheDocument();
    expect(screen.getByLabelText('Item pertamanya')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));

    const sheet = await openItem('Pelajari dasar-dasar asuransi');
    expect(within(sheet).getByDisplayValue('DASAR_ASURANSI')).toHaveAccessibleDescription(
      'Progres setiap new hire pada item ini merujuk ke kode ini.',
    );
    const select = within(sheet).getByLabelText('Diselesaikan dari');
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Fitur', 'Modul Training']);
    expect(within(select).getByRole('option', { name: 'Tanpa tautan (manual)' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Menyusun daftar prospek' })).toBeInTheDocument();
  });

  it('AC-1 says why Hapus is held, and what it takes, in Indonesian', async () => {
    render();
    await screen.findByText('Pelajari dasar-dasar asuransi');
    const sheet = await openItem('Atur goal: target APE & aktivitas');
    expect(within(sheet).getByRole('button', { name: 'Hapus' }))
      .toHaveAttribute('title', 'Aspek memerlukan setidaknya satu item — hapus aspeknya saja.');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk 1. Pengenalan' }));
    expect(screen.getByRole('menuitem', { name: 'Hapus' }))
      .toHaveAccessibleDescription('Menghapus 1. Pengenalan beserta 2 itemnya dari versi berikutnya.');
  });

  it('AC-1 says the empty checklist in Indonesian', async () => {
    render({ published: null, draft: null, windowDays: 90 });
    expect(await screen.findByText('KPM ini belum punya Activation checklist.')).toBeInTheDocument();
  });
});

describe('P18.10-T4 the checklist’s link badges in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  const SALES = {
    kind: 'sales:first', label: 'Sales data', route: null, live: true, form: 'closing',
    completesWhen: 'the hire has a first sale since joining',
  };
  const WITH_LINKS = {
    ...PUBLISHED,
    aspects: [
      PUBLISHED.aspects[0],
      {
        ...PUBLISHED.aspects[1],
        items: [
          ...PUBLISHED.aspects[1].items,
          item({
            code: 'TRAINING_LINKED', label: 'Selesaikan modul prospek', displayOrder: 2, autoLink: 'training:PROSPECT_LIST',
            link: { kind: 'training:PROSPECT_LIST', label: 'Menyusun daftar prospek', route: null, completesWhen: 'x', live: false },
          }),
          item({ code: 'FIRST_CASE_CLOSED', label: 'Tutup case pertama secara mandiri', displayOrder: 3, link: SALES }),
        ],
      },
    ],
  };

  it('AC-2 says Otomatis and Dicentang manual, the registry’s sentence as sent, and Dari {data}', async () => {
    render({ published: WITH_LINKS, draft: null, windowDays: 90 });
    await screen.findByText('Atur goal: target APE & aktivitas');
    expect(within(rowOf('Selesaikan modul prospek')).getByRole('button', { name: /^Dicentang manual — tautan ini tidak menyelesaikan item/ }))
      .toHaveTextContent('Dicentang manual');
    expect(within(rowOf('Selesaikan modul prospek')).getByText('Selesai otomatis dari: Training › Menyusun daftar prospek'))
      .toBeInTheDocument();
    expect(within(rowOf('Tutup case pertama secara mandiri')).getByText('Selesai otomatis dari: Sales data')).toBeInTheDocument();
    let sheet = await openItem('Atur goal: target APE & aktivitas');
    expect(within(sheet).getByRole('button', { name: 'Otomatis — selesai saat the hire has saved any goal since joining' }))
      .toHaveTextContent('Otomatis');
    await userEvent.keyboard('{Escape}');
    sheet = await openItem('Tutup case pertama secara mandiri');
    expect(within(within(sheet).getByLabelText('Diselesaikan dari')).getByRole('option', { name: 'Dari Sales data' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bTicked by hand\b|\bFrom Sales data\b/);
  });
});
