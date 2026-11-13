import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { setAccessToken } from '@/lib/api-client';
import { RosterImport } from './roster-import';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-1/roster',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:import_roster'],
});

const HEADER = 'Kode agen,Nama,Peran,Kode upline,No. WhatsApp,Email,Tanggal bergabung,Waktu,Tanggal lahir,Jenis kelamin,'
  + 'Bulan bergabung di perusahaan';
/** The same three rows the template carries, as cells — what the paste box shows (A3's eleven columns). */
const EXAMPLES = [
  ['88001', 'Agus Prasetyo', 'AB', '', '0812 1100 8801', 'agus@example.test', '02/03/2015', 'Full-time', '12/05/1984', 'male', '2012-03'],
  ['88002', 'Puspita, Sari', 'AAB', '88001', '0812 1100 8802', 'sari@example.test', '01/07/2019', 'Full-time', '02/11/1990', 'female', '2016-08'],
  ['88003', 'Rina Wijaya', 'Agent', '88002', '', 'rina@example.test', '15/01/2026', 'Part-time', '21/07/1998', 'female', '2024-01'],
];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE = {
  // The JSON the page reads for the paste box's examples; its `template` is the header alone since ADR-0184.
  'GET /admin/tenants/roster-template': ({ url }: { url: string }) => (url.includes('format=')
    ? { body: new Blob([url.includes('format=xlsx') ? 'PK\u0003\u0004' : `${HEADER}\n`]) }
    : { body: { header: HEADER, columns: [], template: `${HEADER}\n`, examples: EXAMPLES } }),
};

function render(extra: Record<string, unknown> = {}) {
  const stub = stubFetch({ ...TEMPLATE, ...extra });
  renderWithSession(<RosterImport kpmId="kpm-1" backHref="/admin/tenants/kpm-1" />, {
    me: SUPER_ADMIN,
  });
  return stub;
}

/** Choosing a file, the way the browser hands one over: an Excel workbook unless a CSV is asked for. */
async function upload(name = 'roster.xlsx') {
  const file = new File(['PK\u0003\u0004'], name, { type: name.endsWith('.csv') ? 'text/csv' : XLSX });
  await userEvent.upload(screen.getByLabelText('Roster file'), file);
  return file;
}

/** The other way: rows copied out of a spreadsheet, which arrive tab-separated. */
async function paste(text: string) {
  await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
  await userEvent.type(screen.getByLabelText('Rows from your spreadsheet'), text);
}

/** A blob's text. `Blob.text()` is not in jsdom; `FileReader` is. */
const textOf = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

/** Saving a file, as far as the browser lets a test see it: the object URL made, and the link clicked with its name. */
function watchSaves() {
  const saved: { name: string; blob: Blob }[] = [];
  const blobs = new Map<string, Blob>();
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: vi.fn((blob: Blob) => { const url = `blob:test/${blobs.size}`; blobs.set(url, blob); return url; }),
    revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ name: this.download, blob: blobs.get(this.getAttribute('href') ?? '')! });
  });
  return saved;
}

/** A row of the server's preview, as `GET …/roster/preview` answers it (A3). */
const result = (
  agentCode: string, fullName: string, outcome: 'imported' | 'updated' | 'invited' | 'skipped', messages: string[] = [],
  over: Record<string, unknown> = {},
) => ({
  line: 2, agentCode, fullName, role: 'Agent', leaderAgentCode: '70045001', email: '', outcome, messages, warnings: [], ...over,
});
const SKIPPED_CSV = `${HEADER},Alasan\n70045005,Fikri Ramadhan,Agent,70049999,,,,,,,,Kode upline 70049999 tidak ada di file atau di KPM ini.\n`;
/** A3's sample, as the server would answer it: three rows imported, one updated, two skipped. */
const PREVIEW = {
  issues: [], header: HEADER.split(','),
  counts: { imported: 3, updated: 1, invited: 0, skipped: 2 },
  rows: [
    result('70045001', 'Rahmat Hidayat', 'imported', [], { line: 2, role: 'AB', leaderAgentCode: '' }),
    result('70045002', 'Sari Wulandari', 'imported', [], { line: 3, role: 'AAB' }),
    result('70045009', 'Nadia Kusuma', 'imported', [], {
      line: 4, warnings: ['No WhatsApp number: imported, but cannot be reminded on WhatsApp yet.'],
    }),
    result('70013099', 'Indah Permatasari', 'updated', ['Already here; details updated.'], { line: 5 }),
    result('70045005', 'Fikri Ramadhan', 'skipped', ['Upline code 70049999 is in neither the file nor this KPM.'], { line: 6, leaderAgentCode: '70049999' }),
    result('70045006', 'Desi Anggraeni', 'skipped', ['Role "Agen Senior" does not exist. Use: Agent, AAB, AB.'], { line: 7, role: 'Agen Senior' }),
  ],
  skippedCsv: SKIPPED_CSV,
};
const DONE = { ...PREVIEW, invited: 3 };

describe('P19.3-T4 importing members under A3', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('shows the worked examples in the box, tab-separated and three deep, in A3’s columns', async () => {
    render();
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    const box = screen.getByLabelText('Rows from your spreadsheet');
    await vi.waitFor(() => expect(box).toHaveAttribute('placeholder', EXAMPLES.map((cells) => cells.join('\t')).join('\n')));
  });

  it('leaves the box without examples when they cannot be read — a placeholder is all they are', async () => {
    stubFetch({ 'GET /admin/tenants/roster-template': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
    renderWithSession(<RosterImport kpmId="kpm-1" backHref="/back" />, { me: SUPER_ADMIN });
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    expect(screen.getByLabelText('Rows from your spreadsheet')).toHaveAttribute('placeholder', '');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('P19.3-T4 AC-7 lists A3’s columns in the file’s order, by the file’s own header names', async () => {
    render();
    const table = await screen.findByRole('table', { name: /The file’s columns, in order/ });
    const [, ...rows] = within(table).getAllByRole('row');
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'Kode agen', 'Nama', 'Peran', 'Kode upline', 'No. WhatsApp', 'Email', 'Tanggal bergabung', 'Waktu', 'Tanggal lahir',
      'Jenis kelamin', 'Bulan bergabung di perusahaan',
    ]);
    const said = rows.map((row) => row.textContent).join(' | ');
    expect(said).toContain('Agent, AAB or AB. Agen is read as Agent.');
    expect(said).toContain('Needed for somebody new: the invitation goes there');
    expect(said).toContain('cannot be reminded on WhatsApp yet');
    expect(said).toContain('DD/MM/YYYY, at least 18 years ago');
    expect(said).toContain('Full-time or Part-time');
  });

  it('sends pasted rows exactly as they were pasted, as JSON', async () => {
    const { calls } = render({ '/admin/tenants/kpm-1/roster/preview': { body: PREVIEW } });
    await paste('70045001\tRahmat\tAB');
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await screen.findByText('3 new people ready to import, 1 updated, 2 rows skipped.');
    // Untouched: the server decides the delimiter, and a screen that reformatted the text would be a second parser.
    expect(JSON.parse(calls.find((c) => c.url.includes('/roster/preview'))!.init.body as string)).toEqual({ rows: '70045001\tRahmat\tAB' });
  });

  it('clears what was there when the two ways are swapped', async () => {
    render();
    await upload();
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeEnabled();
    await paste('70045001\tRahmat\tAB');
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeEnabled();
    await userEvent.click(screen.getByLabelText('Upload the filled file (.xlsx or .csv)'));
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeDisabled();
    expect(screen.queryByText('roster.xlsx')).toBeNull();
  });

  it.each([[375], [1280]])('P19.3-T4 AC-10 at %ipx: the preview’s line, a result per row, and nothing written yet', async (width) => {
    atWidth(width);
    const { calls } = render({ '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW } });
    await upload();
    expect(screen.queryByRole('button', { name: /^Import/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    expect(await screen.findByText('3 new people ready to import, 1 updated, 2 rows skipped.')).toHaveAttribute('role', 'status');
    const table = screen.getByRole('table', { name: 'Each row of the file, and what it comes to' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Agent code', 'Name', 'Role', 'Upline code', 'Result']);
    const [, ...rows] = within(table).getAllByRole('row');
    expect(rows.map((r) => within(r).getAllByRole('cell')[4].textContent)).toEqual([
      'Imported', 'Imported', 'ImportedNo WhatsApp number: imported, but cannot be reminded on WhatsApp yet.',
      'UpdatedAlready here; details updated.', 'SkippedUpline code 70049999 is in neither the file nor this KPM.',
      'SkippedRole "Agen Senior" does not exist. Use: Agent, AAB, AB.',
    ]);
    // The top of the office has no upline, said in words.
    expect(within(rows[0]).getAllByRole('cell')[3]).toHaveTextContent('None');
    expect(screen.getByRole('button', { name: 'Import 4 people' })).toBeEnabled();
    expect(calls.some((c) => c.url.endsWith('/roster/file') || c.url.endsWith('/roster'))).toBe(false);
  });

  it('P19.3-T4 AC-10 downloads the skipped rows as the server wrote them, the file’s columns and Alasan', async () => {
    const saved = watchSaves();
    render({ '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW } });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: '⬇ Download the skipped rows' }));
    expect(saved.map((s) => s.name)).toEqual(['baris-dilewati.csv']);
    expect(await textOf(saved[0].blob)).toBe(SKIPPED_CSV);
  });

  it('P19.3-T4 AC-10 offers no download when nothing is skipped, and no import when nothing can be written', async () => {
    render({
      '/admin/tenants/kpm-1/roster/file/preview': {
        body: { ...PREVIEW, counts: { imported: 0, updated: 0, invited: 0, skipped: 1 }, rows: [PREVIEW.rows[4]] },
      },
    });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByText('0 new people ready to import, 1 row skipped.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 people' })).toBeDisabled();
    // Nobody new, so no invitation to offer.
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('P19.3-T4 AC-11 offers the invitation by email, ticked, and sends what the box says', async () => {
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW },
      '/admin/tenants/kpm-1/roster/file': { body: { ...DONE, invited: 0 } },
    });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    const box = await screen.findByRole('checkbox', { name: 'Send an email invitation to 3 new people' });
    expect(box).toBeChecked();
    // P19.12-T7: the hint names email, and no longer says nothing goes by WhatsApp — an Agent with no email may (ADR-0250 §4).
    expect(box).toHaveAccessibleDescription('Each gets a one-time link by email to choose their password.');
    await userEvent.click(box);
    await userEvent.click(screen.getByRole('button', { name: 'Import 4 people' }));
    await screen.findByRole('heading', { name: '3 members imported, 1 updated' });
    const sent = calls.find((c) => c.url.endsWith('/roster/file'))!;
    expect((sent.init.body as FormData).get('invite')).toBe('false');
  });

  it.each([[375], [1280]])('P19.3-T4 AC-11 at %ipx: imports, says so in A3’s toast naming email, and shows no password', async (width) => {
    atWidth(width);
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/preview': { body: PREVIEW },
      '/admin/tenants/kpm-1/roster': { body: DONE },
    });
    await paste('70045001\tRahmat\tAB');
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 4 people' }));

    expect(await screen.findByRole('heading', { name: '3 members imported, 1 updated' })).toBeInTheDocument();
    expect(screen.getByText('3 members imported, 1 updated. Invitations sent by email.')).toBeInTheDocument();
    expect(screen.getByText('An invitation went by email to 3 new people, with a link to choose their password.')).toBeInTheDocument();
    expect(screen.getByText('2 rows were skipped. Download them, fix them and upload them again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '⬇ Download the skipped rows' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
    expect(document.body.textContent).not.toMatch(/password it starts on|Temporary password/i);
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/roster'))!.init.body as string)).toEqual({ rows: '70045001\tRahmat\tAB', invite: true });
  });

  it('P19.3-T4 AC-11 says nobody was mailed when the box was unticked', async () => {
    render({
      '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW },
      '/admin/tenants/kpm-1/roster/file': { body: { ...DONE, invited: 0 } },
    });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Import 4 people' }));
    expect(await screen.findByText('Nobody was emailed. Each new person can sign in with Forgot your password? and their email.')).toBeInTheDocument();
    expect(screen.getByText('3 members imported, 1 updated.')).toBeInTheDocument();
  });

  it('Cancel puts the preview away, and the file can be checked again', async () => {
    render({ '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW } });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('table', { name: 'Each row of the file, and what it comes to' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeEnabled();
  });

  it.each([[375], [1280]])('P19.3-T4 AC-10 at %ipx: a file that cannot be read says so whole, with its problems', async (width) => {
    atWidth(width);
    render({
      '/admin/tenants/kpm-1/roster/file/preview': {
        body: {
          issues: [{ line: 1, column: 'file', message: 'The file has no Kode agen, Peran column. Download the template and use its header.' }],
          header: [], counts: { imported: 0, updated: 0, invited: 0, skipped: 0 }, rows: [], skippedCsv: null,
        },
      },
    });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByRole('heading', { name: 'The file could not be read: 1 problem' })).toBeInTheDocument();
    const problems = screen.getByRole('table', { name: 'What is wrong with the file' });
    expect(within(problems).getByText('The file has no Kode agen, Peran column. Download the template and use its header.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import/ })).toBeNull();
  });

  it('brings the file’s problems back when the server refuses the import', async () => {
    render({
      '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW },
      '/admin/tenants/kpm-1/roster/file': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED', message: 'The file could not be read, so nothing was imported.', requestId: 'r-4',
            details: { issues: [{ line: 1, column: 'file', message: 'The file is empty.' }] },
          },
        },
      },
    });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 4 people' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nothing was imported');
    expect(screen.getByText('The file is empty.')).toBeInTheDocument();
  });

  it('answers a file the server cannot read with what it said', async () => {
    render({
      '/admin/tenants/kpm-1/roster/file/preview': {
        status: 413,
        body: { error: { code: 'ASSET_TOO_LARGE', message: 'The workbook unpacks to more than 25 MB.', requestId: 'r-6' } },
      },
    });
    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The workbook unpacks to more than 25 MB.');
  });

  describe('the leader limit (P13.2-T4 AC-4, AC-5): the office filled while the import was written', () => {
    const LIMIT = {
      '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW },
      '/admin/tenants/kpm-1/roster/file': {
        status: 409,
        body: { error: { code: 'LEADER_LIMIT_REACHED', message: 'x', details: { maxLeaders: 10, leadersUsed: 10 }, requestId: 'r-5' } },
      },
    };

    async function importAll() {
      await upload();
      await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Import 4 people' }));
    }

    it('tells the Super Admin, in plain words, to raise the limit on the offices list', async () => {
      render(LIMIT);
      await importAll();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('This office has reached its limit of 10 leaders, so the ABs and AABs in this file cannot be added.');
      expect(within(alert).getByRole('link', { name: 'offices list' })).toHaveAttribute('href', '/admin/tenants');
      expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
    });

    it('P18.5-T2 AC-9: tells an Owner to import them as Agents and promote them, which asks AgencyBoost', async () => {
      stubFetch({ ...TEMPLATE, ...LIMIT });
      renderWithSession(<RosterImport kpmId="kpm-1" backHref="/people/members" />, { me: makeMe({ permissions: ['kpm:import_roster'] }) });
      await importAll();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Import them as Agents, then promote them on their page: past the limit, that asks AgencyBoost to approve it.');
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

/**
 * **ADR-0184: the template in Excel and in CSV, the guide apart from the data, the upload of either file.** The
 * developer for the product owner, 2026-11-01: *"pisahkan guideline template dengan isian templatenya agar rapih dan
 * mudah digunakan oleh user, berikan juga dukungan untuk template excel dan upload excel"*.
 */
/*
 * **The client's import test of 11 November** (P19.12-T7; ADR-0250): a bad optional cell left empty and said in the
 * warning tone, what a row leaves out, and an Agent with no email invited on WhatsApp, sent from their row.
 */
describe('P19.12-T7 the import forgives, says what is missing, and invites by WhatsApp', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const BLANKED = 'No. WhatsApp: "nomor saya" is not a WhatsApp number. Left empty; the rest of the row is imported.';
  const MISSING = 'Incomplete: no Tanggal lahir, Jenis kelamin. Import the row again with them to fill them in.';
  const INVITED = 'No email: invited on WhatsApp instead. They register through the link with their own email and password.';
  const LINK = 'https://app.agencyboost.test/register?invite=kpm-1.secret';
  const TES = {
    issues: [], header: HEADER.split(','),
    counts: { imported: 1, updated: 1, invited: 1, skipped: 0 },
    rows: [
      result('99311205', 'Tes Lima', 'imported', [], { line: 2, warnings: [BLANKED, MISSING] }),
      result('99311201', 'Tes Satu', 'updated', ['Already here; details updated.'], { line: 3, warnings: [MISSING] }),
      result('99311203', 'Tes Tiga', 'invited', [INVITED], { line: 4 }),
    ],
    skippedCsv: null,
  };
  const checked = async () => {
    await paste('99311205');
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    return screen.findByRole('table', { name: 'Each row of the file, and what it comes to' });
  };

  it('P19.12-T7 AC-2 AC-3 shows what a row leaves out on its imported and updated rows, in the warning tone', async () => {
    render({ '/admin/tenants/kpm-1/roster/preview': { body: TES } });
    const table = await checked();
    const blanked = within(table).getByText(`${BLANKED} ${MISSING}`);
    expect(blanked).toHaveClass('text-pill-amber-ink');
    expect(within(table).getByText(MISSING)).toHaveClass('text-pill-amber-ink');
    // The notes stay muted, apart from the warnings.
    expect(within(table).getByText('Already here; details updated.')).toHaveClass('text-muted');
  });

  it('P19.12-T7 AC-4 counts the row invited on WhatsApp in the line and in the import, its chip in words', async () => {
    render({ '/admin/tenants/kpm-1/roster/preview': { body: TES } });
    const table = await checked();
    expect(screen.getByText('1 new person ready to import, 1 updated, 1 invited on WhatsApp.')).toHaveAttribute('role', 'status');
    const [, , , invited] = within(table).getAllByRole('row');
    expect(within(invited).getAllByRole('cell')[4]).toHaveTextContent(`Invited on WhatsApp${INVITED}`);
    // Nothing to send yet: the link is made by the import.
    expect(within(invited).queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: 'Import 3 people' })).toBeEnabled();
    // The email box counts only the new people with an address.
    expect(screen.getByLabelText('Send an email invitation to 1 new person')).toBeChecked();
  });

  it('P19.12-T7 AC-4 imports a file whose only row is invited on WhatsApp', async () => {
    const only = { ...TES, counts: { imported: 0, updated: 0, invited: 1, skipped: 0 }, rows: [TES.rows[2]] };
    render({ '/admin/tenants/kpm-1/roster/preview': { body: only } });
    await checked();
    expect(screen.getByRole('button', { name: 'Import 1 person' })).toBeEnabled();
    expect(screen.queryByLabelText(/Send an email invitation/)).toBeNull();
  });

  it.each([[375], [1280]])('P19.12-T7 AC-4 at %ipx: once imported, each invited row sends its link on WhatsApp', async (width) => {
    atWidth(width);
    const done = {
      ...TES, invited: 1,
      rows: TES.rows.map((row) => (row.outcome === 'invited' ? { ...row, invite: { link: LINK, phone: '+6281211003300' } } : row)),
    };
    render({ '/admin/tenants/kpm-1/roster/preview': { body: TES }, 'POST /admin/tenants/kpm-1/roster': { body: done } });
    await checked();
    await userEvent.click(screen.getByRole('button', { name: 'Import 3 people' }));

    expect(await screen.findByRole('heading', { name: '1 member imported, 1 updated, 1 invited on WhatsApp' })).toBeInTheDocument();
    expect(screen.getByText('1 member imported, 1 updated, 1 invited on WhatsApp. Invitations sent by email.')).toBeInTheDocument();
    expect(screen.getByText(/Send each person invited on WhatsApp their link with the WhatsApp button on their row/))
      .toHaveTextContent('or later from New Hires › Waiting to join.');
    const send = screen.getByRole('link', { name: 'Send Tes Tiga their invitation on WhatsApp' });
    expect(send).toHaveAttribute('title', 'Send Tes Tiga their invitation on WhatsApp');
    expect(send).toHaveAttribute('target', '_blank');
    const href = new URL(send.getAttribute('href')!);
    expect(`${href.origin}${href.pathname}`).toBe('https://wa.me/6281211003300');
    expect(href.searchParams.get('text')).toContain(LINK);
    expect(href.searchParams.get('text')).toContain('Tes Tiga');
    // Only the invited row has one.
    expect(screen.getAllByRole('link', { name: /their invitation on WhatsApp/ })).toHaveLength(1);
  });
});

describe('ADR-0184 Excel beside CSV', () => {
  beforeEach(() => setAccessToken('token-in-memory'));
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setAccessToken(null); });

  it('offers the template as Excel, recommended, and as CSV — in three parts: the template, the guide, the upload', async () => {
    render();
    const excel = screen.getByRole('button', { name: 'Download Excel (.xlsx)' });
    expect(excel).toHaveAccessibleDescription('Recommended');
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Download the template', 'How to fill it in', 'Upload']);
    // The prototype's glyph, kept out of the button's name.
    expect(excel.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('downloads the workbook with the token, naming the office, and saves it as roster-template.xlsx', async () => {
    const saved = watchSaves();
    const { calls } = render();
    await userEvent.click(screen.getByRole('button', { name: 'Download Excel (.xlsx)' }));
    await vi.waitFor(() => expect(saved.map((s) => s.name)).toEqual(['roster-template.xlsx']));
    const call = calls.find((c) => c.url.includes('format=xlsx'))!;
    expect(call.url).toMatch(/\/admin\/tenants\/roster-template\?format=xlsx&kpmId=kpm-1$/);
    // Never a link: the token lives in memory and goes with the request.
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer token-in-memory');
    expect(await textOf(saved[0].blob)).toBe('PK\u0003\u0004');
  });

  it('downloads the CSV the same way, as roster-template.csv', async () => {
    const saved = watchSaves();
    const { calls } = render();
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await vi.waitFor(() => expect(saved.map((s) => s.name)).toEqual(['roster-template.csv']));
    expect(calls.some((c) => /roster-template\?format=csv&kpmId=kpm-1$/.test(c.url))).toBe(true);
    expect(await textOf(saved[0].blob)).toBe(`${HEADER}\n`);
  });

  it('says a download that failed, with the server’s reference and a way to ask again', async () => {
    watchSaves();
    let refused = true;
    stubFetch({
      'GET /admin/tenants/roster-template': ({ url }: { url: string }) => {
        if (!url.includes('format=')) return { body: { header: HEADER, columns: [], template: `${HEADER}\n`, examples: EXAMPLES } };
        if (refused) {
          refused = false;
          return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'r-1' } } };
        }
        return { body: new Blob(['PK']) };
      },
    });
    renderWithSession(<RosterImport kpmId="kpm-1" backHref="/back" />, { me: SUPER_ADMIN });
    await userEvent.click(screen.getByRole('button', { name: 'Download Excel (.xlsx)' }));
    const failed = await screen.findByRole('alert');
    expect(failed).toHaveTextContent('The template could not be prepared. Something went wrong on our side.');
    // The server's code and request id, for support (P18.9-T4 AC-10).
    expect(failed).toHaveTextContent('INTERNAL_ERROR · r-1');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('keeps the guide apart from the data: the columns and four rules, open on a desktop', async () => {
    render();
    const guide = screen.getByRole('group', { name: 'How to fill it in' });
    expect(guide).toHaveAttribute('open');
    expect(within(guide).getByRole('table', { name: /The file’s columns, in order/ })).toBeInTheDocument();
    expect(within(guide).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Kode agen, Nama and Peran are required. Leave any other cell empty when you do not know it.',
      'One person per row.',
      'Rows can come in any order: an upline is matched in the file and among the people already in the KPM.',
      'An optional cell written wrongly is left empty, with a warning, and the person is still imported. A row with a '
        + 'problem in a required cell is skipped with its reason, and the rest are imported together.',
    ]);
    // Nothing to fill in is inside it.
    expect(within(guide).queryByRole('textbox')).toBeNull();
    expect(within(guide).queryByLabelText('Roster file')).toBeNull();
  });

  it('folds the guide on a phone, where the upload would otherwise be a long scroll away', async () => {
    atWidth(375);
    render();
    await vi.waitFor(() => expect(screen.getByRole('group', { name: 'How to fill it in' })).not.toHaveAttribute('open'));
  });

  it('takes the filled file first — Excel or CSV — and keeps the paste, second', () => {
    render();
    const ways = within(screen.getByRole('group', { name: 'How are you adding them?' })).getAllByRole('radio');
    expect(ways.map((r) => (r as HTMLInputElement).value)).toEqual(['file', 'paste']);
    expect(screen.getByLabelText<HTMLInputElement>('Upload the filled file (.xlsx or .csv)').checked).toBe(true);
    expect(screen.getByLabelText('Roster file')).toHaveAttribute(
      'accept', `.xlsx,.csv,${XLSX},text/csv`,
    );
  });

  it('sends a chosen file as it is, in a form — never read in the browser — to the file routes', async () => {
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/file/preview': { body: PREVIEW },
      '/admin/tenants/kpm-1/roster/file': { body: DONE },
    });
    const file = await upload('roster.csv');
    expect(screen.getByText('roster.csv')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 4 people' }));

    const sent = calls.filter((c) => c.url.includes('/roster/file'));
    expect(sent.map((c) => [c.init.method, c.url.replace(/^.*\/admin/, '/admin')])).toEqual([
      ['POST', '/admin/tenants/kpm-1/roster/file/preview'],
      ['POST', '/admin/tenants/kpm-1/roster/file'],
    ]);
    for (const call of sent) {
      expect(call.init.body).toBeInstanceOf(FormData);
      expect((call.init.body as FormData).get('file')).toBe(file);
      // The browser writes the boundary; a Content-Type set here would have none.
      expect((call.init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    }
    expect(calls.some((c) => c.url.endsWith('/roster/preview'))).toBe(false);
  });
});

/**
 * **The import's instructions as a table of its columns** (P18.9-T4 AC-4, ADR-0176 §6; the client's KPM Owner review
 * of 2026-10-27, UI-025 — 120 words, *Remove* at every size). `/people/import` (the Owner, the Admin) and
 * `/admin/tenants/[kpmId]/roster` (the Super Admin) draw this one component, so they read the same.
 */
describe('P18.9-T4 AC-4 the import’s columns and its template', () => {
  afterEach(() => vi.unstubAllGlobals());

  const OWNER = makeMe({
    membership: {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 2,
    },
    permissions: ['kpm:import_roster'],
  });
  const CLIENTS_COLUMNS = [
    'Kode agen', 'Nama', 'Peran', 'Kode upline', 'No. WhatsApp', 'Email', 'Tanggal bergabung', 'Waktu', 'Tanggal lahir',
    'Jenis kelamin', 'Bulan bergabung di perusahaan',
  ];

  it.each([['the Super Admin', SUPER_ADMIN], ['an Owner', OWNER]])(
    'P18.9-T4 AC-4 lists the columns in the file’s order, in A3’s words (P19.3-T4 AC-7), for %s', async (_who, me) => {
      stubFetch(TEMPLATE);
      renderWithSession(<RosterImport kpmId="kpm-1" backHref="/back" />, { me });
      const table = await screen.findByRole('table', { name: /The file’s columns, in order/ });
      const [, ...rows] = within(table).getAllByRole('row');
      expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(CLIENTS_COLUMNS);
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Column', 'What it holds']);
    },
  );

  it('P18.9-T4 AC-4 has no paragraph of instructions left', async () => {
    render();
    await screen.findByRole('button', { name: 'Download Excel (.xlsx)' });
    for (const gone of [/One row per person:/, /order does not matter/, /Pasting works from Excel/, /Every column but the leader/]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it('P18.9-T4 AC-4 keeps the template in view whichever way in is chosen, above the choice', async () => {
    render();
    const excel = screen.getByRole('button', { name: 'Download Excel (.xlsx)' });
    const choice = screen.getByRole('group', { name: 'How are you adding them?' });
    expect(excel.compareDocumentPosition(choice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    expect(screen.getByRole('button', { name: 'Download Excel (.xlsx)' })).toBe(excel);
    await userEvent.click(screen.getByLabelText('Upload the filled file (.xlsx or .csv)'));
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  });
});
