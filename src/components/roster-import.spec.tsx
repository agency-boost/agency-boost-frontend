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

const HEADER = 'fullName,email,agentCode,role,leaderAgentCode,dateOfBirth,companyJoinMonth,workStatus,gender';
/** The same three rows the template carries, as cells — what the paste box shows (P18.8-T4: nine columns). */
const EXAMPLES = [
  ['Agus Prasetyo', 'agus@example.test', '88001', 'AB', '', '1984-05-12', '2012-03', 'full-time', 'male'],
  ['Puspita, Sari', 'sari@example.test', '88002', 'AAB', '88001', '1990-11-02', '2016-08', 'full-time', 'female'],
  ['Rina Wijaya', 'rina@example.test', '88003', 'Agent', '88002', '1998-07-21', '2024-01', 'part-time', 'female'],
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

describe('importing a roster (P3.6-T4)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('shows the worked examples in the box, tab-separated and three deep', async () => {
    /*
     * The placeholder is the only instruction most people will read, and one row can only
     * ever demonstrate an *empty* leader column — the case nobody gets wrong. Three rows
     * show a code in it, and show it blank only at the top of the office.
     *
     * They come from the API rather than being written here: an example that drifted from
     * the parser would teach a shape the server refuses.
     */
    render();
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    const box = screen.getByLabelText('Rows from your spreadsheet');
    await vi.waitFor(() => expect(box).toHaveAttribute(
      'placeholder',
      'Agus Prasetyo\tagus@example.test\t88001\tAB\t\t1984-05-12\t2012-03\tfull-time\tmale\n'
      + 'Puspita, Sari\tsari@example.test\t88002\tAAB\t88001\t1990-11-02\t2016-08\tfull-time\tfemale\n'
      + 'Rina Wijaya\trina@example.test\t88003\tAgent\t88002\t1998-07-21\t2024-01\tpart-time\tfemale',
    ));
  });

  it('leaves the box without examples when they cannot be read — a placeholder is all they are', async () => {
    stubFetch({ 'GET /admin/tenants/roster-template': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
    renderWithSession(<RosterImport kpmId="kpm-1" backHref="/back" />, { me: SUPER_ADMIN });
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    expect(screen.getByLabelText('Rows from your spreadsheet')).toHaveAttribute('placeholder', '');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // *Amended 2026-10-28 (P18.97-T4 AC-4; UI-025):* said in the columns' table, a row each, where it was a paragraph.
  it('P18.8-T4 AC-2: says what each of the nine columns takes, the rungs written AB, AAB and Agent', async () => {
    render();
    const said = within(await screen.findByRole('table', { name: /The file’s columns, in order/ })).getAllByRole('row')
      .map((row) => row.textContent).join(' | ');
    expect(said).toContain('digits only');
    expect(said).toContain('AB, AAB or Agent');
    expect(said).toContain('YYYY-MM-DD');
    expect(said).toContain('at least 18');
    expect(said).toContain('YYYY-MM');
    expect(said).toContain('full-time or part-time');
    expect(said).toContain('male or female');
    expect(said).toContain('Leader’s agent code (optional)');
    expect(said).not.toMatch(/\bab, aab or agent\b/);
  });

  it('sends pasted rows exactly as they were pasted, as JSON', async () => {
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/preview': { body: { issues: [], willCreate: 1, rows: [] } },
    });

    await paste('Rina Wijaya\trina@k.test\t881\tagent\t');
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    const call = await screen.findByText(/1 person ready to import/).then(
      () => calls.find((c) => c.url.includes('/roster/preview'))!,
    );
    // Untouched: the server decides the delimiter, and a screen that reformatted the text
    // would be a second parser disagreeing with the first.
    expect(JSON.parse(call.init.body as string)).toEqual({
      rows: 'Rina Wijaya\trina@k.test\t881\tagent\t',
    });
  });

  it('clears what was there when the two ways are swapped', async () => {
    // Checking a paste and then importing a file chosen earlier is not a thing anybody
    // means to do.
    render();
    await upload();
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeEnabled();
    await paste('Rina\trina@k.test\t881\tagent\t');
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeEnabled();

    await userEvent.click(screen.getByLabelText('Upload the filled file (.xlsx or .csv)'));
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeDisabled();
    expect(screen.queryByText('roster.xlsx')).toBeNull();
  });

  it('checks the file without creating anybody', async () => {
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/file/preview': {
        body: { issues: [], willCreate: 2, rows: [] },
      },
    });

    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    expect(await screen.findByText(/2 people ready to import/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been created yet/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/roster/file') || c.url.endsWith('/roster'))).toBe(false);
  });

  it('will not let the import be clicked before the file has been checked', async () => {
    render();
    await upload();
    expect(screen.getByRole('button', { name: 'Import 0' })).toBeDisabled();
  });

  it('lists every problem, and says plainly that nothing will be created', async () => {
    // The import is all or nothing, so "9 of 10 will import" would describe something the
    // server cannot do.
    render({
      '/admin/tenants/kpm-1/roster/file/preview': {
        body: {
          willCreate: 0,
          rows: [],
          issues: [
            { line: 2, column: 'email', message: '"nope" is not an email address.' },
            { line: 3, column: 'agentCode', message: 'Already on line 2.' },
          ],
        },
      },
    });

    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    expect(await screen.findByText(/2 problems — nothing will be created/)).toBeInTheDocument();
    expect(screen.getByText('"nope" is not an email address.')).toBeInTheDocument();
    expect(screen.getByText('Already on line 2.')).toBeInTheDocument();
    // And the import stays shut.
    expect(screen.getByRole('button', { name: 'Import 0' })).toBeDisabled();
  });

  it('shows every password once, and says that is the only time', async () => {
    render({
      '/admin/tenants/kpm-1/roster/file/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster/file': {
        body: {
          created: [{
            fullName: 'Rina Wijaya',
            email: 'rina@k.test',
            agentCode: '881',
            temporaryPassword: 'kfmp-3xqz-7bdn-r4vw',
          }],
        },
      },
    });

    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1' }));

    expect(await screen.findByText('kfmp-3xqz-7bdn-r4vw')).toBeInTheDocument();
    expect(screen.getByText(/This is the only time it is shown/)).toBeInTheDocument();
    // And what the recipient will be asked to do with it.
    expect(screen.getByText(/asked to choose their own password/)).toBeInTheDocument();
  });

  it('brings the row list back when the server refuses the commit', async () => {
    // The refusal carries the issues, so the operator is not told "something was wrong"
    // and left to guess which row.
    render({
      '/admin/tenants/kpm-1/roster/file/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster/file': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: '1 row would not import.',
            requestId: 'r-4',
            details: {
              issues: [{ line: 2, column: 'agentCode', message: 'Already registered.' }],
            },
          },
        },
      },
    });

    await upload();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('1 row would not import');
    expect(screen.getByText('Already registered.')).toBeInTheDocument();
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

  describe('the leader limit (P13.2-T4 AC-4, AC-5)', () => {
    const LIMIT = {
      '/admin/tenants/kpm-1/roster/file/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster/file': {
        status: 409,
        body: { error: { code: 'LEADER_LIMIT_REACHED', message: 'x', details: { maxLeaders: 10, leadersUsed: 10 }, requestId: 'r-5' } },
      },
    };

    async function importOne() {
      await upload();
      await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Import 1' }));
    }

    it('tells the Super Admin, in plain words, to raise the limit on the offices list', async () => {
      render(LIMIT);
      await importOne();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('This office has reached its limit of 10 leaders, so the ABs and AABs in this file cannot be added.');
      expect(alert).toHaveTextContent('Raise it with Edit subscription on the offices list first, or import them as Agents.');
      expect(within(alert).getByRole('link', { name: 'offices list' })).toHaveAttribute('href', '/admin/tenants');
      expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
    });

    it('P18.8-T2 AC-9: tells an Owner to import them as Agents and promote them, which asks AgencyBoost', async () => {
      stubFetch({ ...TEMPLATE, ...LIMIT });
      renderWithSession(<RosterImport kpmId="kpm-1" backHref="/people/members" />, {
        me: makeMe({ permissions: ['kpm:import_roster'] }),
      });
      await importOne();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Import them as Agents, then promote them on their page: past the limit, that asks AgencyBoost to approve it.',
      );
      expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
      // A roster row cannot wait: no ask is offered (ADR-0157 §5).
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

/**
 * **ADR-0184: the template in Excel and in CSV, the guide apart from the data, the upload of either file.** The
 * developer for the product owner, 2026-11-01: *"pisahkan guideline template dengan isian templatenya agar rapih dan
 * mudah digunakan oleh user, berikan juga dukungan untuk template excel dan upload excel"*.
 */
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
    // The server's code and request id, for support (P18.97-T4 AC-10).
    expect(failed).toHaveTextContent('INTERNAL_ERROR · r-1');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('keeps the guide apart from the data: the columns and three rules, open on a desktop', async () => {
    render();
    const guide = screen.getByRole('group', { name: 'How to fill it in' });
    expect(guide).toHaveAttribute('open');
    expect(within(guide).getByRole('table', { name: /The file’s columns, in order/ })).toBeInTheDocument();
    expect(within(guide).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'One person per row.',
      'Rows can come in any order, and the leader’s code is empty for somebody who reports to nobody.',
      'Dates are written YYYY-MM-DD, and months YYYY-MM.',
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
      '/admin/tenants/kpm-1/roster/file/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster/file': { body: { created: [] } },
    });
    const file = await upload('roster.csv');
    expect(screen.getByText('roster.csv')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1' }));

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
 * **The import's instructions as a table of its columns** (P18.97-T4 AC-4, ADR-0176 §6; the client's KPM Owner review
 * of 2026-10-27, UI-025 — 120 words, *Remove* at every size). `/people/import` (the Owner, the Admin) and
 * `/admin/tenants/[kpmId]/roster` (the Super Admin) draw this one component, so they read the same.
 */
describe('P18.97-T4 AC-4 the import’s columns and its template', () => {
  afterEach(() => vi.unstubAllGlobals());

  const OWNER = makeMe({
    membership: {
      membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 2,
    },
    permissions: ['kpm:import_roster'],
  });
  const CLIENTS_COLUMNS = [
    'Name', 'Email', 'Agent code', 'Role', 'Leader’s agent code (optional)', 'Date of birth', 'Join month',
    'Full/part-time', 'Gender',
  ];

  it.each([['the Super Admin', SUPER_ADMIN], ['an Owner', OWNER]])(
    'P18.97-T4 AC-4 lists the nine columns in the file’s order, in the client’s words, for %s', async (_who, me) => {
      stubFetch(TEMPLATE);
      renderWithSession(<RosterImport kpmId="kpm-1" backHref="/back" />, { me });
      const table = await screen.findByRole('table', { name: /The file’s columns, in order/ });
      const [, ...rows] = within(table).getAllByRole('row');
      expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(CLIENTS_COLUMNS);
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Column', 'What it holds']);
    },
  );

  it('P18.97-T4 AC-4 has no paragraph of instructions left', async () => {
    render();
    await screen.findByRole('button', { name: 'Download Excel (.xlsx)' });
    for (const gone of [/One row per person:/, /order does not matter/, /Pasting works from Excel/, /Every column but the leader/]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it('P18.97-T4 AC-4 keeps the template in view whichever way in is chosen, above the choice', async () => {
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
