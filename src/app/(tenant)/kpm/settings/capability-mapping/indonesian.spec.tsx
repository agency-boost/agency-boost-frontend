import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, stubFetch, wears } from '@test/harness';
import CapabilityMappingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/capability-mapping',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

const entry = (code: string, label: string, over: Record<string, unknown> = {}) => ({
  code, label, displayOrder: 1, status: 'active', ...over,
});

/** The office's own ladder and grids, in its own words. */
const CATALOG = {
  stages: [
    { ...entry('PRODUSEN_KOMPETEN', 'Produsen kompeten'), requiredMilestoneCodes: ['JUAL_MANDIRI'], stageOrder: 1 },
    {
      ...entry('PRODUSEN_MANDIRI', 'Produsen mandiri', { displayOrder: 2 }),
      requiredMilestoneCodes: ['JUAL_MANDIRI', 'JUAL_LUAR'], stageOrder: 2,
    },
  ],
  milestones: [
    entry('JUAL_MANDIRI', 'Menjual polis secara mandiri'),
    entry('JUAL_LUAR', 'Menjual di luar jaringan langsung', { displayOrder: 2, status: 'archived' }),
  ],
  grids: [
    { ...entry('PENJUALAN', 'Penjualan pribadi'), requiresDownline: false, items: [entry('PENDEKATAN', 'Pendekatan & janji temu')] },
    { ...entry('PEMBINAAN', 'Membina agent', { displayOrder: 2 }), requiresDownline: true, items: [] },
  ],
  version: 1,
};

function render(tab: '#ladder' | '#skills') {
  window.location.hash = tab;
  stubFetch({
    '/kpm/settings/capability-mapping': { body: CATALOG },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  });
  renderInIndonesian(<CapabilityMappingPage />, { me: OWNER });
}

const NOTE = 'Tahap seseorang = tahap tertinggi yang semua milestone-nya sudah dicentang.';
const ENGLISH = /\b(The ladder|Milestones|Needs \d|Add a milestone|Add an item|Rename|Archive|Restore|Show archived|Only for somebody|No (stages|milestones|skill grids) yet)\b/;

/**
 * **P18.98-T4, Settings › Capability Mapping in ID mode**: the screen's words the approved glossary's Indonesian, its
 * title and tabs English (§A), the office's stages, milestones, grids and items as typed, and the ladder's grey
 * sentence with its verdict per size (P18.97-T4 AC-6). In English: `page.spec.tsx`.
 */
describe('P18.98-T4 Settings › Capability Mapping in Indonesian', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });

  it('AC-2 says the ladder in Indonesian, its title and tabs kept English', async () => {
    atWidth(1280);
    render('#ladder');
    await screen.findByText('Produsen kompeten');

    expect(screen.getByRole('heading', { name: 'Capability Mapping', level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Bagian Capability Mapping' });
    expect(within(tabs).getByRole('link', { name: 'Ladder' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByText(/^Ladder dan grid skill yang menjadi acuan leader Anda/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ladder', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Perlu 1 milestone')).toBeInTheDocument();
    expect(screen.getByText('Perlu 2 milestone')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Milestone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah milestone' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ganti nama' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Arsipkan' })[0])
      .toHaveAttribute('title', 'Tetap ada di penilaian yang sudah mencentangnya, dan tidak ditawarkan di penilaian baru.');
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-4 shows the office’s stages and milestones as typed, an archived one marked in Indonesian', async () => {
    atWidth(1280);
    render('#ladder');
    await screen.findByText('Produsen kompeten');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tampilkan yang diarsipkan' }));

    const archived = screen.getByText('Menjual di luar jaringan langsung').closest('li')!;
    expect(within(archived).getByText('Diarsipkan')).toBeInTheDocument();
    expect(within(archived).getByRole('button', { name: 'Pulihkan' })).toBeInTheDocument();
  });

  it('AC-1 says the skill grids in Indonesian, the office’s as typed', async () => {
    atWidth(1280);
    render('#skills');
    await screen.findByText('Pendekatan & janji temu');

    expect(screen.getByRole('heading', { name: 'Penjualan pribadi' })).toBeInTheDocument();
    expect(screen.getByText('Hanya untuk yang memiliki downline')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Tambah item' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Tambah item' })[0]);
    expect(screen.getByLabelText('Nama')).toBeInTheDocument();
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Dipilih sekali. Tidak pernah dipakai ulang.');
  });

  it('AC-1 renames a row with its code said in Indonesian', async () => {
    atWidth(1280);
    render('#skills');
    const row = (await screen.findByText('Pendekatan & janji temu')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ganti nama' }));

    expect(screen.getByLabelText('Nama')).toHaveAccessibleDescription(
      'Kode PENDEKATAN — centang merujuk ke kode ini, dan mengganti nama tidak pernah memindahkannya.',
    );
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
  });
});

/** **The ladder's grey sentence per size, in Indonesian** (P18.97-T4 AC-6; UI-027, *ⓘ · ⓘ · Show*). */
describe('P18.98-T4 the ladder’s grey text per size, in Indonesian', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });

  async function drawnAt(px: number) {
    atWidth(px);
    render('#ladder');
    const heading = await screen.findByRole('heading', { name: 'Ladder', level: 2 });
    const shown = (el: Element) => !wears(el, px).split(' ').includes('hidden');
    const sentence = screen.getAllByText(NOTE).find((el) => el.tagName === 'P')!;
    const tip = screen.getByRole('button', { name: NOTE });
    return { heading, sentence: shown(sentence), tip: shown(tip.parentElement!), glyph: tip };
  }

  it.each([1024, 1280])('at %ipx shows the sentence under the heading and no ⓘ', async (px) => {
    const { sentence, tip } = await drawnAt(px);
    expect([sentence, tip]).toEqual([true, false]);
  });

  it.each([767, 768, 1023])('at %ipx hides it behind the ⓘ beside the ladder’s heading', async (px) => {
    const { heading, sentence, tip, glyph } = await drawnAt(px);
    expect([sentence, tip]).toEqual([false, true]);
    expect(heading.parentElement).toContainElement(glyph);
  });
});
