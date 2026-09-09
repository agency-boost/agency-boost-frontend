import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import RosterImportPage from './page';

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
const TEMPLATE = { '/admin/tenants/roster-template': { body: { header: HEADER, columns: [] } } };

function render(extra: Record<string, unknown> = {}) {
  const stub = stubFetch({ ...TEMPLATE, ...extra });
  renderWithSession(<RosterImportPage params={routeParams({ kpmId: 'kpm-1' })} />, {
    me: SUPER_ADMIN,
  });
  return stub;
}

/** Choosing a file, the way the browser hands one over. */
async function upload(text: string) {
  const file = new File([text], 'roster.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('Roster file'), file);
}

describe('importing a roster (P3.6-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('takes the template header from the API rather than writing it twice', async () => {
    // A template the screen composed itself would drift from the one the parser demands,
    // and the failure would read as "download the template" on a file downloaded here.
    render();
    const link = await screen.findByRole('link', { name: 'Download the template' });
    expect(link).toHaveAttribute('download', 'roster-template.csv');
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain(HEADER);
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

  it('is refused to anybody without the permission', () => {
    renderWithSession(<RosterImportPage params={routeParams({ kpmId: 'kpm-1' })} />, {
      me: makeMe({ permissions: [] }),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('kpm:import_roster');
  });
});
