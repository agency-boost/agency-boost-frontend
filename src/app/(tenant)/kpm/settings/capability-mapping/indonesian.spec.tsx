import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
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

const entry = (code: string, label: string, displayOrder = 1, over: Record<string, unknown> = {}) => ({
  code, label, displayOrder, status: 'active', ...over,
});

/** The office's own ladder and groups, in its own words. */
const CATALOG = {
  stages: [
    { ...entry('PRODUSEN_KOMPETEN', 'Produsen kompeten'), requiredMilestoneCodes: ['JUAL_MANDIRI'], stageOrder: 1 },
    { ...entry('PRODUSEN_MANDIRI', 'Produsen mandiri', 2), requiredMilestoneCodes: ['JUAL_MANDIRI', 'JUAL_LUAR'], stageOrder: 2 },
  ],
  milestones: [
    entry('JUAL_MANDIRI', 'Menjual polis secara mandiri'),
    entry('JUAL_LUAR', 'Menjual di luar jaringan langsung', 2),
    entry('LAMA', 'Milestone lama', 3, { status: 'archived' }),
  ],
  grids: [
    { ...entry('PENJUALAN', 'Penjualan pribadi'), requiresDownline: false, items: [entry('PENDEKATAN', 'Pendekatan & janji temu')] },
    { ...entry('PEMBINAAN', 'Membina agent', 2), requiresDownline: true, items: [] },
  ],
  version: 1,
};

function render() {
  stubFetch({
    '/kpm/settings/capability-mapping': { body: CATALOG },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null, settings: [] },
    },
  });
  renderInIndonesian(<CapabilityMappingPage />, { me: OWNER });
}

const ENGLISH = /\b(Stage = |Ticked by|Add a (milestone|stage|skill|group)|Rename|More for|Show archived|Only for somebody|No (stages|skill groups) yet|Leaders tick|drag to reorder)\b/;

/**
 * **P19.21-T3 AC-4, Capability Mapping in ID mode** (frame 18's words verbatim): *Ladder* and *Skill tracker* kept
 * English (§A), *"Tahap = tahap tertinggi yang semua milestone-nya dicentang leader"*, *"Dicentang leader di profil
 * agent · n kelompok"*, *Tambah milestone · tahap · skill · kelompok*, the office's stages, milestones, groups and skills
 * as typed. In English: `page.spec.tsx`.
 */
describe('P19.21-T3 AC-4 Capability Mapping in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-4 says both cards in the mockup’s Indonesian, the office’s rows as typed', async () => {
    render();
    await screen.findByText('Produsen kompeten');
    expect(screen.getByRole('heading', { level: 1, name: 'Capability Mapping' })).toBeInTheDocument();
    const ladder = screen.getByRole('region', { name: 'Ladder' });
    expect(within(ladder).getByText('Tahap = tahap tertinggi yang semua milestone-nya dicentang leader')).toBeInTheDocument();
    expect(within(ladder).getByLabelText('Tahap 1')).toBeInTheDocument();
    expect(within(ladder).getAllByRole('button', { name: 'Tambah milestone' })).toHaveLength(2);
    expect(within(ladder).getByRole('button', { name: 'Tambah tahap' })).toBeInTheDocument();
    const tracker = screen.getByRole('region', { name: 'Skill tracker' });
    expect(within(tracker).getByText('Dicentang leader di profil agent · 2 kelompok')).toBeInTheDocument();
    expect(within(tracker).getByText('1 skill')).toBeInTheDocument();
    expect(within(tracker).getByText('0 skill · Hanya untuk yang memiliki downline')).toBeInTheDocument();
    expect(within(tracker).getByRole('button', { name: 'Tambah skill' })).toBeInTheDocument();
    expect(within(tracker).getByRole('button', { name: 'Tambah kelompok' })).toBeInTheDocument();
    expect(screen.getByText('Leader mencentang di profil agent (Capability mapping + Skill tracker)')).toBeInTheDocument();
    expect(screen.getByText('ganti nama · seret untuk urutan · ⋯ arsipkan')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('P19.21-T3 AC-4 renames with the code said in Indonesian, and archives with what it does said', async () => {
    render();
    await screen.findByText('Produsen kompeten');
    await userEvent.click(screen.getByRole('button', { name: 'Ganti nama Menjual di luar jaringan langsung' }));
    expect(screen.getByLabelText('Nama')).toHaveAccessibleDescription(
      'Kode JUAL_LUAR — centang merujuk ke kode ini, dan mengganti nama tidak pernah memindahkannya.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya untuk Menjual di luar jaringan langsung' }));
    expect(screen.getByRole('menuitem', { name: 'Arsipkan' })).toHaveAccessibleDescription(
      'Dikeluarkan dari setiap tahap yang mensyaratkannya; memulihkannya mengembalikannya.',
    );
  });

  it('P19.21-T3 AC-4 shows an archived milestone apart, marked in Indonesian, once asked', async () => {
    render();
    await screen.findByText('Produsen kompeten');
    await userEvent.click(screen.getByLabelText('Tampilkan yang diarsipkan'));
    const loose = screen.getByText('Milestone tanpa tahap').parentElement!;
    expect(within(loose).getByText('Milestone lama')).toBeInTheDocument();
    expect(within(loose).getByText('Diarsipkan')).toBeInTheDocument();
  });
});
