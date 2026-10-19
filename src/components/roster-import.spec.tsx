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

const HEADER = 'fullName,email,agentCode,role,leaderAgentCode';
const FILE = `# Examples below are commented out.\n${HEADER}\n# Agus Prasetyo,agus@example.test,PRU-88001,ab,\n`;
/** The same three rows the template carries, as cells — what the paste box shows. */
const EXAMPLES = [
  ['Agus Prasetyo', 'agus@example.test', 'PRU-88001', 'ab', ''],
  ['Puspita, Sari', 'sari@example.test', 'PRU-88002', 'aab', 'PRU-88001'],
  ['Rina Wijaya', 'rina@example.test', 'PRU-88003', 'agent', 'PRU-88002'],
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
    // the worked examples are the part most worth not paraphrasing.
    render();
    await userEvent.click(screen.getByLabelText('Upload a CSV file'));
    const link = await screen.findByRole('link', { name: 'Download the template' });
    expect(link).toHaveAttribute('download', 'roster-template.csv');
    const downloaded = decodeURIComponent(link.getAttribute('href') ?? '');
    expect(downloaded).toContain(HEADER);
    expect(downloaded).toContain('# Agus Prasetyo');
  });

  it('says the examples are commented, so nobody deletes them out of fear', async () => {
    render();
    expect(await screen.findByText(/commented out/)).toBeInTheDocument();
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
      'Agus Prasetyo\tagus@example.test\tPRU-88001\tab\t\n'
      + 'Puspita, Sari\tsari@example.test\tPRU-88002\taab\tPRU-88001\n'
      + 'Rina Wijaya\trina@example.test\tPRU-88003\tagent\tPRU-88002',
    );
  });

  it('sends pasted rows exactly as they were pasted', async () => {
    const { calls } = render({
      '/admin/tenants/kpm-1/roster/preview': { body: { issues: [], willCreate: 1, rows: [] } },
    });

    await paste('Rina Wijaya\trina@k.test\tPRU-1\tagent\t');
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    const call = await screen.findByText(/1 person ready to import/).then(
      () => calls.find((c) => c.url.includes('/roster/preview'))!,
    );
    // Untouched: the server decides the delimiter, and a screen that reformatted the text
    // would be a second parser disagreeing with the first.
    expect(JSON.parse(call.init.body as string)).toEqual({
      rows: 'Rina Wijaya\trina@k.test\tPRU-1\tagent\t',
    });
  });

  it('clears what was there when the two ways are swapped', async () => {
    // Checking a paste and then importing a file chosen earlier is not a thing anybody
    // means to do.
    render();
    await paste('Rina\trina@k.test\tPRU-1\tagent\t');
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

    await upload(`${HEADER}\nRina,rina@k.test,PRU-1,ab,\n`);
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));

    expect(await screen.findByText(/2 people ready to import/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been created yet/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/roster'))).toBe(false);
  });

  it('will not let the import be clicked before the file has been checked', async () => {
    render();
    await upload(`${HEADER}\nRina,rina@k.test,PRU-1,ab,\n`);
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

    await upload(`${HEADER}\nA,nope,PRU-1,ab,\n`);
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
            agentCode: 'PRU-1',
            temporaryPassword: 'kfmp-3xqz-7bdn-r4vw',
          }],
        },
      },
    });

    await upload(`${HEADER}\nRina Wijaya,rina@k.test,PRU-1,ab,\n`);
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

    await upload(`${HEADER}\nRina,rina@k.test,PRU-1,ab,\n`);
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
      await upload(`${HEADER}\nRina,rina@k.test,PRU-1,aab,\n`);
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

    it('tells an Owner to import them as Agents, or ask AgencyBoost', async () => {
      stubFetch({ ...TEMPLATE, ...LIMIT });
      renderWithSession(<RosterImport kpmId="kpm-1" backHref="/people/members" />, {
        me: makeMe({ permissions: ['kpm:import_roster'] }),
      });
      await importOne();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Import them as Agents, or ask AgencyBoost to raise the limit.');
      expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
    });
  });


});
