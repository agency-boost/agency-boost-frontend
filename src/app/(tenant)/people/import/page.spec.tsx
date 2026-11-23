import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import PeopleImportPage from './page';

const saveFile = vi.fn();
vi.mock('@/lib/save-file', () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/import',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: ['kpm:import_roster'],
});

const HEADER = ['Kode agen', 'Nama', 'Peran', 'Kode upline', 'No. WhatsApp', 'Email', 'Tanggal bergabung', 'Waktu', 'Tanggal lahir', 'Jenis kelamin', 'Bulan bergabung di perusahaan'];
const cells = (code: string, name: string, role: string, upline: string, birth = '') =>
  [code, name, role, upline, '', `${name.split(' ')[0].toLowerCase()}@mail.com`, '', '', birth, '', ''];
const base = { messages: [], warnings: [], flagged: [] as string[], email: '' };
const PREVIEW = {
  issues: [],
  header: HEADER,
  counts: { imported: 2, updated: 1, invited: 0, skipped: 0 },
  rows: [
    { ...base, line: 2, agentCode: '80211', fullName: 'Rudi Hartono', role: 'Agent', leaderAgentCode: '80005', outcome: 'imported', cells: cells('80211', 'Rudi Hartono', 'Agent', '80005') },
    { ...base, line: 3, agentCode: '80009', fullName: 'Budi Santoso', role: 'Agent', leaderAgentCode: '80006', outcome: 'updated', cells: cells('80009', 'Budi Santoso', 'Agent', '80006') },
    { ...base, line: 4, agentCode: '80213', fullName: 'Citra Lestari', role: 'Agent', leaderAgentCode: '80006', outcome: 'imported', flagged: ['Tanggal lahir'], warnings: ['Tanggal lahir: not a date. Left empty; the rest of the row is imported.'], cells: cells('80213', 'Citra Lestari', 'Agent', '80006', '31/02/1990') },
  ],
  skippedCsv: null,
};
const TREE = {
  nodes: [
    { membershipId: 'mem-wilson', fullName: 'Wilson Tanoto', preferredName: null, initials: 'WT', agentCode: '80003', role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: 1, directCounts: { ab: 1, aab: 0, agent: 0, total: 1 }, subtreeCount: 2, isLeader: true, isSelf: true },
    { membershipId: 'mem-agus', fullName: 'Agus Prasetyo', preferredName: null, initials: 'AP', agentCode: '80005', role: 'ab', depth: 1, layer: 2, leaderId: 'mem-wilson', directCount: 1, directCounts: { ab: 0, aab: 0, agent: 1, total: 1 }, subtreeCount: 1, isLeader: true, isSelf: false },
    { membershipId: 'mem-rudi', fullName: 'Rudi Hartono', preferredName: null, initials: 'RH', agentCode: '80211', role: 'agent', depth: 2, layer: 3, leaderId: 'mem-agus', directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isSelf: false },
  ],
  leader: null, rootIds: ['mem-wilson'], selfId: 'mem-wilson', counts: { ab: 1, aab: 0, agent: 1, total: 2 },
};
const HISTORY = [{ importId: 'imp-1', fileName: 'anggota_okt_2026.xlsx', importedAt: '2026-11-02T02:00:00.000Z', byName: 'Wilson Tanoto', created: 3, updated: 1, invited: 0, skipped: 0 }];
const routes = (over: Record<string, unknown> = {}) => ({
  '/members/tree': { body: TREE },
  '/people/imports': { body: HISTORY },
  '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW },
  '/admin/tenants/kpm-1/roster/preview': { body: PREVIEW },
  '/admin/tenants/kpm-1/roster/file': { body: { ...PREVIEW, invited: 2 } },
  '/admin/tenants/kpm-1/roster': { body: { ...PREVIEW, invited: 2 } },
  ...over,
});
const upload = async (name = 'Upload members') => {
  const file = new File(['x'], 'anggota_nov_2026.xlsx');
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
  return screen.findByRole('dialog', { name });
};

describe('P19.20-T5 Import people', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.20-T5 AC-1 one navy card: the two lines, Unggah file and Unduh template — and Lihat kolom’s grid', async () => {
    stubFetch(routes() as never);
    renderWithSession(<PeopleImportPage />, { me: OWNER });

    expect(screen.getByRole('heading', { level: 1, name: 'Import people' })).toBeInTheDocument();
    expect(screen.getByText('Fill in the template, then upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download template' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'See the columns' }));
    const grid = screen.getByRole('region', { name: 'Columns in the template' });
    expect(within(grid).getAllByRole('term')).toHaveLength(11);
    expect(within(grid).getByText('Kode agen').parentElement).toHaveTextContent('Kode agen *');
    expect(grid).toHaveTextContent('Kode uplineempty only for the top rung');
  });

  it('P19.20-T5 AC-2 after Unggah: the four tiles and a row each with its pill; the unreadable field in yellow', async () => {
    stubFetch(routes() as never);
    renderWithSession(<PeopleImportPage />, { me: OWNER });

    const dialog = await upload();
    expect(dialog).toHaveTextContent('anggota_nov_2026.xlsx3 rows');
    expect(dialog).toHaveTextContent('2new people1updated1to check3all saved');
    const citra = dialog.querySelector('[data-preview-row="4"]') as HTMLElement;
    expect(citra).toHaveAttribute('data-state', 'check');
    await userEvent.click(within(citra).getByRole('button', { name: 'See and fix Citra Lestari’s data' }));
    expect(within(citra).getByLabelText('Tanggal lahir').parentElement).toHaveClass('bg-pill-amber');
    expect(within(dialog).getByRole('button', { name: 'Save all (3 people)' })).toBeInTheDocument();
  });

  it('P19.20-T5 AC-2 a corrected row is checked again and saved as corrected rows, with the file’s name', async () => {
    const corrected = { ...PREVIEW, rows: PREVIEW.rows.map((r) => (r.line === 4 ? { ...r, flagged: [], warnings: [], cells: cells('80213', 'Citra Lestari', 'Agent', '80006', '14/02/1990') } : r)) };
    const { calls } = stubFetch(routes({ '/admin/tenants/kpm-1/roster/preview': { body: corrected } }) as never);
    renderWithSession(<PeopleImportPage />, { me: OWNER });

    const dialog = await upload();
    const citra = dialog.querySelector('[data-preview-row="4"]') as HTMLElement;
    await userEvent.click(within(citra).getByRole('button', { name: /Citra Lestari/ }));
    const birth = within(citra).getByLabelText('Tanggal lahir');
    await userEvent.clear(birth);
    await userEvent.type(birth, '14/02/1990');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Check again' }));
    await vi.waitFor(() => expect(calls.some((c) => c.url.endsWith('/roster/preview'))).toBe(true));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all (3 people)' }));

    await vi.waitFor(() => {
      const save = calls.find((c) => c.url.endsWith('/admin/tenants/kpm-1/roster'));
      const body = JSON.parse(String(save?.init.body));
      expect(body.fileName).toBe('anggota_nov_2026.xlsx');
      expect(body.rows).toContain('80213,Citra Lestari,Agent,80006,,citra@mail.com,,,14/02/1990,,');
    });
  });

  it('P19.20-T5 AC-3 a file saved as it came: the new people under their upline, Baru, a light green row', async () => {
    const { calls } = stubFetch(routes() as never);
    renderWithSession(<PeopleImportPage />, { me: OWNER });

    const dialog = await upload();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all (3 people)' }));

    await vi.waitFor(() => expect(calls.some((c) => c.url.endsWith('/roster/file'))).toBe(true));
    const rudi = await vi.waitFor(() => {
      const row = document.querySelector('[data-node="mem-rudi"]');
      expect(row).toHaveAttribute('data-new');
      return row as HTMLElement;
    });
    expect(rudi).toHaveTextContent('New');
    expect(screen.getByText('1 new person marked')).toBeInTheDocument();
  });

  it('P19.20-T5 AC-3 Struktur saat ini: AB → AAB → Agent with each team’s size, and the link to the Org tree; Riwayat unggah', async () => {
    stubFetch(routes() as never);
    renderWithSession(<PeopleImportPage />, { me: OWNER });

    expect(await screen.findByText('Agus Prasetyo')).toBeInTheDocument();
    expect(document.querySelector('[data-node="mem-wilson"]')).toHaveTextContent('2 people');
    expect(screen.getByRole('link', { name: 'See the whole structure in Org tree ›' })).toHaveAttribute('href', '/people/org-tree');
    const history = document.querySelector('[data-import="imp-1"]') as HTMLElement;
    expect(history).toHaveTextContent('anggota_okt_2026.xlsx');
    expect(history).toHaveTextContent('by WILSON TANOTO');
    expect(history).toHaveTextContent('3 new1 updated');
  });

  it('P19.20-T5 AC-2 a file that cannot be read says why, and saves nothing', async () => {
    stubFetch(routes({
      '/admin/tenants/kpm-1/roster/file/preview': { body: { ...PREVIEW, rows: [], issues: [{ line: 1, column: 'file', message: 'There is no Kode agen column.' }] } },
    }) as never);
    renderWithSession(<PeopleImportPage />, { me: OWNER });

    const dialog = await upload();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('There is no Kode agen column.');
    expect(within(dialog).getByRole('button', { name: /Save all/ })).toBeDisabled();
  });

  it('P19.20-T5 AC-3 no word “impor” on the Indonesian page', async () => {
    stubFetch(routes() as never);
    renderInIndonesian(<PeopleImportPage />, { me: OWNER });

    await screen.findByText('Struktur saat ini');
    expect(screen.getByText('Isi template, lalu unggah')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unggah file' })).toBeInTheDocument();
    expect(screen.getByText('Riwayat unggah')).toBeInTheDocument();
    const dialog = await upload('Unggah anggota');
    expect(dialog).toHaveTextContent('orang baru');
    expect(dialog).toHaveTextContent('Simpan semua (3 orang)');
    // *Import people* is the menu's kept English name (ADR-0269); the Indonesian word *impor* is never written.
    expect(document.body.textContent ?? '').not.toMatch(/\b(di|meng)?impor\b/i);
  });

  it('P19.20-T5 AC-4 a reader in no KPM is told so', () => {
    stubFetch(routes() as never);
    renderWithSession(<PeopleImportPage />, { me: makeMe({ membership: null, permissions: ['kpm:import_roster'] }) });

    expect(screen.getByText('You are not in a KPM.')).toBeInTheDocument();
  });

  /*
   * **P19.30-T2 (ADR-0288 §5): how new people get in** — *Kirim undangan email* (the default) or *Password sementara
   * (PDF)*: with the second, `invite: false`, and the *Akun & password* PDF of the accounts the save made, offered at once.
   */
  describe('P19.30-T2 how new people get in', () => {
    /** The Owner, who may download the PDF (`member:issue_temporary_password`). */
    const ISSUER = makeMe({ ...OWNER, permissions: ['kpm:import_roster', 'member:issue_temporary_password'] });
    const MADE = ['mem-rudi', 'mem-citra'];
    const saved = { ...PREVIEW, invited: 0, membershipIds: MADE };
    const pdfRoutes = (over: Record<string, unknown> = {}) => routes({
      '/admin/tenants/kpm-1/roster/file': { body: saved },
      '/admin/tenants/kpm-1/roster': { body: saved },
      'POST /members/temporary-passwords/preview': { body: { count: 2, kpmName: 'BSD City Branch', fileName: 'Akun-password-BSD-City-Branch-2026-11-22.pdf' } },
      'POST /members/temporary-passwords': { body: new Blob(['%PDF-1.3']) },
      ...over,
    });

    it('P19.30-T2 AC-1 the step offers Send an email invitation (chosen) or Temporary password (PDF); the default sends invite=true', async () => {
      const { calls } = stubFetch(pdfRoutes() as never);
      renderWithSession(<PeopleImportPage />, { me: ISSUER });
      const dialog = await upload();
      const choice = within(dialog).getByRole('group', { name: 'How new people get in' });
      expect(within(choice).getByRole('radio', { name: 'Send an email invitation' })).toBeChecked();
      expect(within(choice).getByRole('radio', { name: 'Temporary password (PDF)' })).not.toBeChecked();
      // Colour contrast is jsdom's blind spot (no layout, no computed colour): the tokens are pinned by `a11y.spec.tsx`.
      expect((await axe(dialog, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toEqual([]);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save all (3 people)' }));
      await vi.waitFor(() => {
        const save = calls.find((c) => c.url.endsWith('/roster/file'));
        expect((save?.init.body as FormData).get('invite')).toBe('true');
      });
      // Invited by email: no PDF is offered.
      expect(document.querySelector('[data-roster-temporary]')).toBeNull();
      expect(calls.some((c) => c.url.includes('/members/temporary-passwords'))).toBe(false);
    });

    it('P19.30-T2 AC-2 Temporary password (PDF): invite=false, then the PDF of the accounts just made — confirmed, then saved', async () => {
      saveFile.mockReset();
      const { calls } = stubFetch(pdfRoutes() as never);
      renderWithSession(<PeopleImportPage />, { me: ISSUER });
      const dialog = await upload();
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Temporary password (PDF)' }));
      expect(dialog).toHaveTextContent('Nobody is emailed.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save all (3 people)' }));
      await vi.waitFor(() => {
        const save = calls.find((c) => c.url.endsWith('/roster/file'));
        expect((save?.init.body as FormData).get('invite')).toBe('false');
      });
      // The confirmation opens at once, narrowed to the two accounts the save made.
      const confirm = await screen.findByRole('dialog', { name: 'Accounts & passwords' });
      expect(await within(confirm).findByText(/The PDF lists 2 people/)).toBeInTheDocument();
      const preview = calls.find((c) => c.url.endsWith('/members/temporary-passwords/preview'));
      expect(JSON.parse(String(preview?.init.body))).toEqual({ membershipIds: MADE });
      // Two steps (the 2026-11-23 browser walk): Make PDF issues and holds the file, Download PDF saves it in the click.
      await userEvent.click(within(confirm).getByRole('button', { name: 'Make PDF' }));
      await userEvent.click(await within(confirm).findByRole('button', { name: 'Download PDF' }));
      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), 'Akun-password-BSD-City-Branch-2026-11-22.pdf');
      const issue = calls.find((c) => c.url.endsWith('/members/temporary-passwords'));
      expect(JSON.parse(String(issue?.init.body))).toEqual({ membershipIds: MADE });
      // The card stays, to download again.
      const card = document.querySelector('[data-roster-temporary]') as HTMLElement;
      expect(card).toHaveTextContent('2 new accounts ready to hand out, each with a temporary password.');
      const again = within(card).getByRole('button', { name: 'Download accounts & passwords (PDF)' });
      // On a phone the button goes under the words, full width (the 2026-11-23 browser walk).
      expect(card).toHaveClass('max-md:flex-col', 'max-md:items-stretch');
      expect(again).toHaveClass('max-md:w-full');
    });

    it('P19.30-T2 AC-1 in Indonesian: Kirim undangan email · Password sementara (PDF)', async () => {
      stubFetch(pdfRoutes() as never);
      renderInIndonesian(<PeopleImportPage />, { me: ISSUER });
      const dialog = await upload('Unggah anggota');
      const choice = within(dialog).getByRole('group', { name: 'Cara orang baru masuk' });
      expect(within(choice).getByRole('radio', { name: 'Kirim undangan email' })).toBeChecked();
      expect(within(choice).getByRole('radio', { name: 'Password sementara (PDF)' })).toBeInTheDocument();
    });

    it('P19.30-T2 AC-1 a file that makes nobody new asks nothing: updates and WhatsApp invitations need no password', async () => {
      stubFetch(pdfRoutes({
        '/admin/tenants/kpm-1/roster/file/preview': { body: { ...PREVIEW, counts: { imported: 0, updated: 1, invited: 0, skipped: 0 }, rows: [PREVIEW.rows[1]] } },
      }) as never);
      renderWithSession(<PeopleImportPage />, { me: ISSUER });
      const dialog = await upload();
      expect(within(dialog).queryByRole('group', { name: 'How new people get in' })).toBeNull();
    });

    it('P19.30-T2 AC-1 a KPM Admin is not asked (OD-485): the PDF is the Owner’s, so new people are invited by email', async () => {
      const ADMIN = makeMe({
        membership: { ...OWNER.membership!, membershipId: 'mem-maya', isKpmOwner: false, isKpmAdmin: true },
        permissions: ['kpm:import_roster'],
      });
      const { calls } = stubFetch(pdfRoutes() as never);
      renderWithSession(<PeopleImportPage />, { me: ADMIN });
      const dialog = await upload();
      expect(within(dialog).queryByRole('group', { name: 'How new people get in' })).toBeNull();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save all (3 people)' }));
      await vi.waitFor(() => {
        const save = calls.find((c) => c.url.endsWith('/roster/file'));
        expect((save?.init.body as FormData).get('invite')).toBe('true');
      });
      expect(calls.some((c) => c.url.includes('/members/temporary-passwords'))).toBe(false);
    });
  });
});
