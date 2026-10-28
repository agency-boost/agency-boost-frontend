import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
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
const FILE = `# Examples below are commented out.\n${HEADER}\n# Agus Prasetyo,agus@example.test,88001,AB,,1984-05-12,2012-03,full-time,male\n`;
/** The same three rows the template carries, as cells — what the paste box shows (P18.8-T4: nine columns). */
const EXAMPLES = [
  ['Agus Prasetyo', 'agus@example.test', '88001', 'AB', '', '1984-05-12', '2012-03', 'full-time', 'male'],
  ['Puspita, Sari', 'sari@example.test', '88002', 'AAB', '88001', '1990-11-02', '2016-08', 'full-time', 'female'],
  ['Rina Wijaya', 'rina@example.test', '88003', 'Agent', '88002', '1998-07-21', '2024-01', 'part-time', 'female'],
];
const TEMPLATE = {
  '/admin/tenants/roster-template': {
    body: { header: HEADER, columns: [], template: FILE, examples: EXAMPLES },
  },
};

function render(extra: Record<string, unknown> = {}) {
  const stub = stubFetch({ ...TEMPLATE, ...extra });
  renderWithSession(<RosterImport kpmId="kpm-1" backHref="/admin/tenants/kpm-1" />, {
    me: SUPER_ADMIN,
  });
  return stub;
}

/** Choosing a file, the way the browser hands one over. */
async function upload(text: string) {
  await userEvent.click(screen.getByLabelText('Upload a CSV file'));
  const file = new File([text], 'roster.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('Roster file'), file);
}

/** The other way: rows copied out of a spreadsheet, which arrive tab-separated. */
async function paste(text: string) {
  await userEvent.type(screen.getByLabelText('Rows from your spreadsheet'), text);
}

describe('importing a roster (P3.6-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers the file the API composed, examples and all', async () => {
    // A template the screen built itself would drift from the one the parser demands, and
    // the worked examples are the part most worth not paraphrasing. *Download template* since P18.97-T4 AC-4, in
    // view whichever way in is chosen.
    render();
    const link = await screen.findByRole('link', { name: 'Download template' });
    expect(link).toHaveAttribute('download', 'roster-template.csv');
    const downloaded = decodeURIComponent(link.getAttribute('href') ?? '');
    expect(downloaded).toContain(HEADER);
    expect(downloaded).toContain('# Agus Prasetyo');
  });

  /*
   * *Amended 2026-10-28 (P18.97-T4 AC-4; UI-025):* the page's sentence about the commented examples left with the rest
   * of the 120 words (*Remove* at every size). The template the reader downloads says it, on its first lines.
   */
  it('says the examples are commented, so nobody deletes them out of fear — in the template itself', async () => {
    render();
    const link = await screen.findByRole('link', { name: 'Download template' });
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toMatch(/^data:text\/csv;charset=utf-8,# Examples below are commented out\./);
    expect(screen.queryByText(/commented out/)).toBeNull();
  });

  it('offers pasting first, because it needs no file at all', () => {
    // The complaint was that not everybody knows CSV. Copying cells out of a spreadsheet
    // puts tab-separated text on the clipboard, so this path never meets a file format.
    render();
    expect(screen.getByLabelText<HTMLInputElement>('Paste from a spreadsheet').checked).toBe(true);
    expect(screen.getByLabelText('Rows from your spreadsheet')).toBeInTheDocument();
    // And the file controls are not in the way until they are asked for.
    expect(screen.queryByLabelText('Roster file')).toBeNull();
  });

  it('shows the worked examples in the box, tab-separated and three deep', async () => {
    /*
     * The placeholder is the only instruction most people will read, and one row can only
     * ever demonstrate an *empty* leader column — the case nobody gets wrong. Three rows
     * show a code in it, and show it blank only at the top of the office.
     *
     * They come from the API rather than being written here, for the same reason the
     * template does: an example that drifted from the parser would teach a shape the
     * server refuses.
     */
    render();
    const box = await screen.findByLabelText('Rows from your spreadsheet');
    expect(box).toHaveAttribute(
      'placeholder',
      'Agus Prasetyo\tagus@example.test\t88001\tAB\t\t1984-05-12\t2012-03\tfull-time\tmale\n'
      + 'Puspita, Sari\tsari@example.test\t88002\tAAB\t88001\t1990-11-02\t2016-08\tfull-time\tfemale\n'
      + 'Rina Wijaya\trina@example.test\t88003\tAgent\t88002\t1998-07-21\t2024-01\tpart-time\tfemale',
    );
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

  it('sends pasted rows exactly as they were pasted', async () => {
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
    await paste('Rina\trina@k.test\t881\tagent\t');
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeEnabled();

    await userEvent.click(screen.getByLabelText('Upload a CSV file'));
    expect(screen.getByRole('button', { name: 'Check the file' })).toBeDisabled();
  });

  it('checks the file without creating anybody', async () => {
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/preview': {
        body: { issues: [], willCreate: 2, rows: [] },
      },
    });

    await upload(`${HEADER}\nRina,rina@k.test,881,ab,\n`);
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    expect(await screen.findByText(/2 people ready to import/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been created yet/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/roster'))).toBe(false);
  });

  it('will not let the import be clicked before the file has been checked', async () => {
    render();
    await upload(`${HEADER}\nRina,rina@k.test,881,ab,\n`);
    expect(screen.getByRole('button', { name: 'Import 0' })).toBeDisabled();
  });

  it('lists every problem, and says plainly that nothing will be created', async () => {
    // The import is all or nothing, so "9 of 10 will import" would describe something the
    // server cannot do.
    render({
      '/admin/tenants/kpm-1/roster/preview': {
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

    await upload(`${HEADER}\nA,nope,881,ab,\n`);
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    expect(await screen.findByText(/2 problems — nothing will be created/)).toBeInTheDocument();
    expect(screen.getByText('"nope" is not an email address.')).toBeInTheDocument();
    expect(screen.getByText('Already on line 2.')).toBeInTheDocument();
    // And the import stays shut.
    expect(screen.getByRole('button', { name: 'Import 0' })).toBeDisabled();
  });

  it('shows every password once, and says that is the only time', async () => {
    render({
      '/admin/tenants/kpm-1/roster/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster': {
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

    await upload(`${HEADER}\nRina Wijaya,rina@k.test,881,ab,\n`);
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
      '/admin/tenants/kpm-1/roster/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster': {
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

    await upload(`${HEADER}\nRina,rina@k.test,881,ab,\n`);
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('1 row would not import');
    expect(screen.getByText('Already registered.')).toBeInTheDocument();
  });

  describe('the leader limit (P13.2-T4 AC-4, AC-5)', () => {
    const LIMIT = {
      '/admin/tenants/kpm-1/roster/preview': { body: { issues: [], willCreate: 1, rows: [] } },
      '/admin/tenants/kpm-1/roster': {
        status: 409,
        body: { error: { code: 'LEADER_LIMIT_REACHED', message: 'x', details: { maxLeaders: 10, leadersUsed: 10 }, requestId: 'r-5' } },
      },
    };

    async function importOne() {
      await upload(`${HEADER}\nRina,rina@k.test,881,aab,\n`);
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
 * **The import's instructions as a table of its columns, with *Download template* always in view** (P18.97-T4 AC-4,
 * ADR-0176 §6; the client's KPM Owner review of 2026-10-27, UI-025 — 120 words, *Remove* at every size). `/people/import`
 * (the Owner, the Admin) and `/admin/tenants/[kpmId]/roster` (the Super Admin) draw this one component, so they read
 * the same.
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
    await screen.findByRole('link', { name: 'Download template' });
    for (const gone of [/One row per person:/, /order does not matter/, /Pasting works from Excel/, /Every column but the leader/]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it('P18.97-T4 AC-4 keeps Download template in view whichever way in is chosen, above the choice', async () => {
    render();
    const link = await screen.findByRole('link', { name: 'Download template' });
    const choice = screen.getByRole('group', { name: 'How are you adding them?' });
    expect(link.compareDocumentPosition(choice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Upload a CSV file'));
    expect(screen.getByRole('link', { name: 'Download template' })).toBe(link);
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    expect(screen.getByRole('link', { name: 'Download template' })).toBeInTheDocument();
    // The prototype's glyph, kept out of the link's name.
    expect(link.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('P18.97-T4 AC-4 says a template on its way as a wait, and one that failed with a way to ask again', async () => {
    let answer: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { answer = resolve; });
    let reads = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      reads += 1;
      if (reads === 1) {
        await held;
        return { ok: false, status: 500, json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'r-1' } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => TEMPLATE['/admin/tenants/roster-template'].body } as Response;
    }));
    renderWithSession(<RosterImport kpmId="kpm-1" backHref="/back" />, { me: SUPER_ADMIN });
    expect(screen.getByRole('status')).toHaveTextContent('Loading the template…');
    expect(screen.queryByRole('link', { name: 'Download template' })).toBeNull();
    answer();
    const failed = await screen.findByRole('alert');
    expect(failed).toHaveTextContent('The template could not be prepared. Something went wrong on our side.');
    // The server's code and request id, for support (P18.97-T4 AC-10).
    expect(failed).toHaveTextContent('INTERNAL_ERROR · r-1');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Download template' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
