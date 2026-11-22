import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import LeadStatusesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/lead-statuses',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const READER = makeMe({ membership, permissions: ['tenant_config:read'] });

const stage = (over: Record<string, unknown> = {}) => ({
  id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Sudah di-follow up', rank: 2,
  isTerminal: false, isLateStage: true, version: 1, status: 'active', ...over,
});

/** The office's own stages, in its own words. */
const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Belum didekati', rank: 1, isLateStage: false }),
      stage(),
      stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Polis terbit', rank: 3, isTerminal: true, isLateStage: false }),
      stage({ id: 's3', code: 'DORMANT', label: 'Tidak aktif', rank: 4, isLateStage: false, status: 'archived' }),
    ],
  },
  { pipeline: 'recruitment', statuses: [] },
];

function render(me = OWNER) {
  const stub = stubFetch({
    '/kpm/settings/lead-statuses': { body: PIPELINES },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 0, workingVersion: 1, hasUnpublishedChanges: true, publishedAt: null },
    },
  });
  renderInIndonesian(<LeadStatusesPage />, { me });
  return stub;
}

const ENGLISH = /\b(Edit|Archive|Restore|Rename|Show archived|statuses|Closes|Open|Make this close|Add status|Count as|Stop counting|No stages yet|Order =)\b/;

/** A stage's row, by the name it was typed with. */
const rowOf = (label: string) => [...document.querySelectorAll<HTMLElement>('[data-stage]')]
  .find((li) => li.querySelector('p')?.textContent?.endsWith(label))!;
async function choose(label: string, name: string) {
  await userEvent.click(screen.getByRole('button', { name: `Aksi untuk ${label}` }));
  await userEvent.click(screen.getByRole('menuitem', { name }));
}

/**
 * **P18.10-T4, Settings › Lead statuses in ID mode**: the screen's words the approved glossary's Indonesian, its title,
 * its tabs and *Expected to close* English (§A), and the office's stages as typed. Drawn since P19.21-T3 AC-2 as the
 * client's 19 November card (mockup f15): numbered rows, the tags *Expected to close*, *Terbuka* and *Penutup*, one ⋯,
 * *+ Tambah status* and the legend. In English: `page.spec.tsx`.
 */
describe('P18.10-T4 Settings › Lead statuses in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 P19.21-T3 AC-2 says the ladder in Indonesian, its title, tabs and Expected to close kept English', async () => {
    atWidth(1280);
    render();
    await screen.findByText('3. Polis terbit');

    expect(screen.getByRole('heading', { name: 'Lead statuses', level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Pipeline lead' });
    expect(within(tabs).getByRole('link', { name: 'Sales' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'Recruitment' })).toBeInTheDocument();
    expect(screen.getByText('1. Belum didekati')).toBeInTheDocument();
    expect(screen.getByText('Penutup')).toBeInTheDocument();
    expect(screen.getAllByText('Terbuka')).toHaveLength(2);
    expect(screen.getByText('Expected to close')).toBeInTheDocument();
    expect(screen.getByText('Urutan = alur pipeline')).toBeInTheDocument();
    expect(document.getElementById('late-stage-hint')).toHaveTextContent('Expected to close dihitung di KPM Overview');
    expect(screen.getByRole('button', { name: 'Tambah status ke Sales' })).toHaveTextContent('Tambah status');
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-4 shows the office’s stages as typed, and the archived one’s line in Indonesian', async () => {
    render();
    await screen.findByText('3. Polis terbit');
    for (const label of ['Belum didekati', 'Sudah di-follow up']) expect(rowOf(label)).toBeTruthy();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tampilkan yang diarsipkan' }));
    expect(within(rowOf('Tidak aktif')).getByText('diarsipkan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Tidak aktif' }));
    expect(screen.getByRole('menuitem', { name: 'Pulihkan' })).toBeInTheDocument();
  });

  it('AC-1 renames and adds a stage with the fields in Indonesian', async () => {
    render();
    await screen.findByText('3. Polis terbit');
    await choose('Sudah di-follow up', 'Ganti nama');
    expect(screen.getByDisplayValue('FOLLOW_UP')).toHaveAccessibleDescription(
      'Setiap lead yang pernah mencapai tahap ini merujuk ke kode ini.',
    );
    expect(screen.getByLabelText('Label')).toHaveValue('Sudah di-follow up');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Tambah status ke Sales' }));
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Permanen. Setiap lead menyimpannya.');
    expect(screen.getByRole('button', { name: 'Tambah' })).toBeInTheDocument();
  });

  it('AC-1 says a refused flag’s retry in Indonesian, named for its stage, the kept term first', async () => {
    stubFetch({
      '/kpm/settings/lead-statuses': { body: PIPELINES },
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 0, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
      },
      'PATCH /kpm/settings/lead-statuses/s0/late-stage': {
        status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan.', requestId: 'r-1' } },
      },
    });
    renderInIndonesian(<LeadStatusesPage />, { me: OWNER });
    await screen.findByText('1. Belum didekati');
    await choose('Belum didekati', 'Hitung sebagai Expected to close');
    expect(await screen.findByRole('button', {
      name: 'Gagal menyimpan — coba lagi: Expected to close, Belum didekati',
    })).toBeInTheDocument();
  });

  it('AC-1 puts a stage’s actions behind one ⋯ at every width, in Indonesian', async () => {
    atWidth(375);
    render();
    await screen.findByText('3. Polis terbit');
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Sudah di-follow up' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Naikkan', 'Turunkan', 'Ganti nama', 'Jangan hitung sebagai Expected to close', 'Jadikan penutup pipeline', 'Arsipkan',
    ]);
  });

  it('AC-2 shows a reader who cannot write the tag, kept English, and no ⋯', async () => {
    render(READER);
    await screen.findByText('3. Polis terbit');
    expect(screen.getByText('Expected to close')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aksi untuk/ })).toBeNull();
  });
});
