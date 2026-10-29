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

const ENGLISH = /\b(Edit|Archive|Restore|Show archived|statuses|Closes the pipeline|Open|Make this close|Add a (sales|recruitment) stage|Switch on|No stages yet|Nothing has been published)\b/;

/**
 * **P18.98-T4, Settings › Lead statuses in ID mode**: the screen's words the approved glossary's Indonesian, its title,
 * its tabs and *Expected to close* English (§A), and the office's stages as typed. In English: `page.spec.tsx`.
 */
describe('P18.98-T4 Settings › Lead statuses in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 says the ladder in Indonesian, its title, tabs and Expected to close kept English', async () => {
    atWidth(1280);
    render();
    await screen.findByText('Polis terbit');

    expect(screen.getByRole('heading', { name: 'Lead statuses', level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Pipeline lead' });
    expect(within(tabs).getByRole('link', { name: 'Sales' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'Recruitment' })).toBeInTheDocument();
    expect(screen.getByText(/^Tahap-tahap yang dilalui sebuah lead\./)).toBeInTheDocument();
    expect(screen.getByText('3 status — urutannya menentukan alur tahap dalam pipeline')).toBeInTheDocument();
    expect(document.getElementById('late-stage-hint')).toHaveTextContent(
      'Aktifkan pada tahap yang biasanya sudah dekat dengan closing. Leads di tahap itu akan dihitung sebagai '
      + 'Expected to close di KPM Overview.',
    );
    expect(screen.getByText('Menutup pipeline')).toBeInTheDocument();
    expect(screen.getAllByText('Terbuka')).toHaveLength(2);
    expect(screen.getAllByRole('switch', { name: 'Expected to close' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Jadikan penutup pipeline' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Ubah' })).toHaveLength(3);
    // The stage that closes the pipeline cannot be archived, and says why.
    expect(screen.getAllByRole('button', { name: 'Arsipkan' })[2])
      .toHaveAttribute('title', 'Jadikan tahap lain penutup pipeline terlebih dahulu.');
    expect(screen.getByRole('button', { name: 'Tambah tahap Sales' })).toBeInTheDocument();
    expect(await screen.findByText('Belum ada yang diterbitkan untuk KPM ini.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-4 shows the office’s stages as typed, and the archived one’s line in Indonesian', async () => {
    atWidth(1280);
    render();
    await screen.findByText('Polis terbit');
    for (const label of ['Belum didekati', 'Sudah di-follow up']) expect(screen.getByText(label)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tampilkan yang diarsipkan' }));
    const dormant = screen.getByText('Tidak aktif').closest('li')!;
    expect(within(dormant).getByText('diarsipkan')).toBeInTheDocument();
    expect(within(dormant).getByRole('button', { name: 'Pulihkan' })).toBeInTheDocument();
  });

  it('AC-1 edits and adds a stage with the fields in Indonesian', async () => {
    atWidth(1280);
    render();
    const row = (await screen.findByText('Sudah di-follow up')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));
    // The read-only code's own label is `CodeField`'s, the shared field's (`components/ui/field.tsx`), whose words move
    // with the shared pieces; its reason is this screen's.
    expect(screen.getByDisplayValue('FOLLOW_UP')).toHaveAccessibleDescription(
      'Setiap lead yang pernah mencapai tahap ini merujuk ke kode ini.',
    );
    expect(screen.getByLabelText('Label')).toHaveValue('Sudah di-follow up');
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));

    await userEvent.click(screen.getByRole('button', { name: 'Tambah tahap Sales' }));
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription('Permanen. Setiap lead menyimpannya.');
    expect(screen.getByRole('button', { name: 'Tambah' })).toBeInTheDocument();
  });

  it('AC-1 says a refused switch’s retry in Indonesian, named for its stage, the kept term first', async () => {
    atWidth(1280);
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
    await screen.findByText('Belum didekati');
    await userEvent.click(screen.getAllByRole('switch', { name: 'Expected to close' })[0]);

    expect(await screen.findByRole('button', {
      name: 'Gagal menyimpan — coba lagi: Expected to close, Belum didekati',
    })).toBeInTheDocument();
  });

  it('AC-1 puts a stage’s actions behind one ⋮ on a phone, in Indonesian', async () => {
    atWidth(375);
    render();
    await screen.findByText('Polis terbit');
    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk Sudah di-follow up' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent))
      .toEqual(['Naikkan', 'Turunkan', 'Ubah', 'Jadikan penutup pipeline', 'Arsipkan']);
  });

  it('AC-2 shows a reader who cannot write the badge, kept English', async () => {
    atWidth(1280);
    render(READER);
    await screen.findByText('Polis terbit');
    expect(screen.getByText('Expected to close')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
