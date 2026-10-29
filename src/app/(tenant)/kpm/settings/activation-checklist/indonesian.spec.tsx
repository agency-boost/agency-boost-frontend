import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, stubFetch, wears } from '@test/harness';
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

const NEW_VERSIONS = 'Versi baru hanya berlaku untuk new hire.';
const LINKED = 'Item yang tertaut selesai secara otomatis.';
/** Our own English words, which ID mode no longer writes (*Item* is §B.4's, spelled alike; its plural is not). */
const ENGLISH = /\b(Save draft|Publish version|Hires starting|Nothing is published|The window is|days|Rename|Remove|Edit|Add aspect|Add item|Completes from|No link|Feature|items)\b/;

/**
 * **P18.98-T4, Settings › Activation checklist in ID mode**: the screen's words the approved glossary's Indonesian, its
 * title, the features an item completes from and *new hire* English (§A), and the office's aspects and items as typed.
 * The two grey sentences keep their verdict per size in Indonesian (P18.97-T4 AC-6). In English: `page.spec.tsx`.
 */
describe('P18.98-T4 Settings › Activation checklist in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 says the version card and the controls in Indonesian, the title kept English', async () => {
    atWidth(1280);
    render({ published: PUBLISHED, draft: DRAFT, windowDays: 90 });
    await screen.findByText('Pelajari dasar-dasar asuransi');

    expect(screen.getByRole('heading', { name: 'Activation checklist', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Yang dijalani setiap new hire dalam 90 hari pertamanya.')).toBeInTheDocument();
    const version = screen.getByText(/^New hire yang mulai sekarang mendapat/);
    expect(version).toHaveTextContent(
      'New hire yang mulai sekarang mendapat versi 1. Anda punya draf yang belum diterbitkan, yang akan menjadi versi 2.',
    );
    expect(within(version).getByText('versi 1').tagName).toBe('STRONG');
    expect(screen.getByText(/^Jangka waktunya/)).toHaveTextContent('Jangka waktunya 90 hari.');
    expect(screen.getByRole('button', { name: 'Simpan draf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terbitkan versi 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tambah aspek' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Tambah item' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Ganti nama' })).toHaveLength(2);
    expect(screen.getByText('2 item')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Diselesaikan dari')).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-2 keeps the features an item completes from English, and the office’s module as typed', async () => {
    render();
    await screen.findByText('Pelajari dasar-dasar asuransi');
    const select = screen.getAllByLabelText('Diselesaikan dari')[0];

    expect(within(select).getByRole('option', { name: 'Tanpa tautan (manual)' })).toBeInTheDocument();
    expect(within(select).getByRole('group', { name: 'Fitur' })).toBeInTheDocument();
    expect(within(select).getByRole('group', { name: 'Modul Training' })).toBeInTheDocument();
    for (const name of ['Goal Settings', 'Leads Management', 'Activity Management', 'Menyusun daftar prospek']) {
      expect(within(select).getByRole('option', { name })).toBeInTheDocument();
    }
  });

  it('AC-1 says the other versions’ sentences in Indonesian', async () => {
    render({ published: null, draft: { ...DRAFT, version: 1 }, windowDays: 90 });
    expect(await screen.findByText(/^Belum ada yang diterbitkan, jadi belum ada new hire yang mendapat checklist\./))
      .toHaveTextContent(/Draf Anda akan menjadi versi 1\.ⓘ/);
  });

  it('AC-1 says the standard checklist’s sentence in Indonesian, its name in bold', async () => {
    render({ published: null, draft: { ...DRAFT, id: undefined, version: 1 }, windowDays: 90 });
    const line = await screen.findByText(/^Belum ada yang diterbitkan/);
    expect(line).toHaveTextContent(/Yang Anda lihat adalah checklist standar, siap diubah — simpan, lalu terbitkan versi 1\.ⓘ/);
    expect(within(line).getByText('checklist standar').tagName).toBe('STRONG');
  });

  it('AC-1 adds an aspect and edits an item with the fields in Indonesian', async () => {
    atWidth(1280);
    render();
    await userEvent.click(await screen.findByRole('button', { name: '+ Tambah aspek' }));
    expect(screen.getByRole('heading', { name: 'Tambah aspek' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aspek')).toBeInTheDocument();
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Diisi dari nama. Permanen setelah disimpan.');
    expect(screen.getByLabelText('Item pertamanya')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah aspek ini' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));

    const row = screen.getByText('Pahami pola pikir karier agency').closest('li')!;
    expect(within(row).getByRole('button', { name: 'Hapus' })).toBeEnabled();
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));
    expect(screen.getByLabelText('Item')).toHaveValue('Pahami pola pikir karier agency');
    // The read-only code's label is the shared `CodeField`'s; its reason is this screen's.
    expect(screen.getByDisplayValue('POLA_PIKIR')).toHaveAccessibleDescription(
      'Progres setiap new hire pada item ini merujuk ke kode ini.',
    );
  });

  it('AC-1 says why Remove is held, and what it takes, in Indonesian', async () => {
    atWidth(1280);
    render();
    await screen.findByText('Pelajari dasar-dasar asuransi');
    const aspect = screen.getByRole('heading', { name: '1. Pengenalan' }).closest('[data-row]')!;
    expect(within(aspect as HTMLElement).getAllByRole('button', { name: 'Hapus' })[0])
      .toHaveAttribute('title', 'Menghapus 1. Pengenalan beserta 2 itemnya dari versi berikutnya.');
    const lone = screen.getByText('Atur goal: target APE & aktivitas').closest('li')!;
    expect(within(lone).getByRole('button', { name: 'Hapus' }))
      .toHaveAttribute('title', 'Aspek memerlukan setidaknya satu item — hapus aspeknya saja.');
  });

  it('AC-4 shows the office’s aspects and items as typed', async () => {
    render();
    for (const words of ['1. Pengenalan', '2. Persiapan awal', 'Pelajari dasar-dasar asuransi', 'Atur goal: target APE & aktivitas']) {
      expect(await screen.findByText(words)).toBeInTheDocument();
    }
  });

  it('AC-1 says the empty checklist in Indonesian', async () => {
    render({ published: null, draft: null, windowDays: 90 });
    expect(await screen.findByText('KPM ini belum punya Activation checklist.')).toBeInTheDocument();
  });
});

/**
 * **The grey sentences per size, in Indonesian** (P18.97-T4 AC-6, ADR-0176 §6; UI-027): the same verdicts as in English
 * — *New versions* *ⓘ · ⓘ · Show*, *Linked items* *Remove · ⓘ · Show* — read from the classes CSS would apply.
 */
describe('P18.98-T4 the checklist’s grey text per size, in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function drawnAt(px: number) {
    atWidth(px);
    render();
    await screen.findByText(/^New hire yang mulai sekarang mendapat/);
    const shown = (el: Element | null | undefined) => (el ? !wears(el, px).split(' ').includes('hidden') : false);
    const sentence = (text: string) => screen.getAllByText(text)
      .find((el) => !el.classList.contains('sr-only') && el.getAttribute('role') !== 'tooltip');
    const tip = (text: string) => screen.getByRole('button', { name: text }).parentElement;
    return {
      newVersions: { sentence: shown(sentence(NEW_VERSIONS)), tip: shown(tip(NEW_VERSIONS)) },
      linked: { sentence: shown(sentence(LINKED)), tip: shown(tip(LINKED)) },
    };
  }

  it.each([1024, 1280])('at %ipx shows both sentences and draws neither ⓘ', async (px) => {
    expect(await drawnAt(px)).toEqual({ newVersions: { sentence: true, tip: false }, linked: { sentence: true, tip: false } });
  });

  it.each([768, 1023])('at %ipx puts both behind their ⓘ', async (px) => {
    expect(await drawnAt(px)).toEqual({ newVersions: { sentence: false, tip: true }, linked: { sentence: false, tip: true } });
  });

  it('at 767px keeps the new versions’ ⓘ and removes the linked items’ sentence altogether', async () => {
    expect(await drawnAt(767)).toEqual({ newVersions: { sentence: false, tip: true }, linked: { sentence: false, tip: false } });
  });
});

/**
 * **P18.98-T4 (new hires and activation): the link badge and *From {data}* in Indonesian** — the hire's activation's
 * words (`lib/activation.ts`' `autoBadge`, `byHandBadge`, `fromDataWords`), which read English here until that module
 * moved: *Otomatis* for a live link, *Dicentang manual* for one that does not complete its item, and a data-backed item's
 * *Dari {data}*. The registry's sentence and a link's label are the server's, as it sends them.
 */
describe('P18.98-T4 the checklist’s link badges in Indonesian', () => {
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
    const goals = screen.getByText('Atur goal: target APE & aktivitas').closest('li')!;
    expect(within(goals).getByRole('button', { name: 'Otomatis — selesai saat the hire has saved any goal since joining' }))
      .toHaveTextContent('Otomatis');
    const training = screen.getByText('Selesaikan modul prospek').closest('li')!;
    expect(within(training).getByRole('button', { name: /^Dicentang manual — tautan ini tidak menyelesaikan item/ }))
      .toHaveTextContent('Dicentang manual');
    const sale = screen.getByText('Tutup case pertama secara mandiri').closest('li')!;
    expect(within(within(sale).getByLabelText('Diselesaikan dari')).getByRole('option', { name: 'Dari Sales data' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bTicked by hand\b|\bFrom Sales data\b/);
  });
});
