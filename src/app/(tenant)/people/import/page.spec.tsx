import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import PeopleImportPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/import',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: ['kpm:import_roster'],
});
const ADMIN = makeMe({
  membership: {
    membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    isKpmOwner: false, isKpmAdmin: true, status: 'active', directCount: 0,
  },
  permissions: ['kpm:import_roster'],
});

const HEADER = 'Kode agen,Nama,Peran,Kode upline,No. WhatsApp,Email,Tanggal bergabung,Waktu,Tanggal lahir,Jenis kelamin,'
  + 'Bulan bergabung di perusahaan';
const PREVIEW = {
  issues: [], header: HEADER.split(','), counts: { imported: 1, updated: 0, invited: 0, skipped: 1 },
  rows: [
    { line: 2, agentCode: '70045001', fullName: 'Rahmat Hidayat', role: 'AB', leaderAgentCode: '', email: 'rahmat@contoh.id', outcome: 'imported', messages: [], warnings: [] },
    { line: 3, agentCode: '70013011', fullName: 'Rina Wijaya', role: 'Agent', leaderAgentCode: '70045001', email: '', outcome: 'skipped',
      messages: ['This agent code is already registered at this insurer.'], warnings: [] },
  ],
  skippedCsv: `${HEADER},Alasan\n`,
};
const ROUTES = {
  '/admin/tenants/roster-template': { body: { header: HEADER, columns: [], template: `${HEADER}\n`, examples: [] } },
  '/admin/tenants/kpm-1/roster/preview': { body: PREVIEW },
  '/admin/tenants/kpm-1/roster': { body: { ...PREVIEW, invited: 1 } },
};

afterEach(() => vi.unstubAllGlobals());

/**
 * **`/people/import`, the Owner's and the Admin's** (P19.3-T4; the setup spec's §A3, moved to them by the 3 November
 * handover's §B2 note): their own office, named by their session — the API answers any other as 404.
 */
describe('P19.3-T4 /people/import', () => {
  it.each([['the Owner', OWNER], ['an Admin', ADMIN]])('P19.3-T4 AC-13 imports into %s’s own office, named by the session', async (_who, me) => {
    const { calls } = stubFetch(ROUTES as never);
    renderWithSession(<PeopleImportPage />, { me });
    expect(screen.getByRole('heading', { level: 1, name: 'Import people' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
    await userEvent.type(screen.getByLabelText('Rows from your spreadsheet'), '70045001,Rahmat,AB');
    await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await screen.findByText('1 new person ready to import, 1 row skipped.');
    expect(calls.some((c) => c.url.endsWith('/admin/tenants/kpm-1/roster/preview'))).toBe(true);
  });

  it.each([[375, false], [1280, true]])(
    'P19.3-T4 AC-10 at %ipx (the guide open: %s): the results in their own table, each control a finger’s height on a phone',
    async (width, open) => {
      atWidth(width);
      stubFetch(ROUTES as never);
      renderWithSession(<PeopleImportPage />, { me: OWNER });
      await vi.waitFor(() => expect(screen.getByRole('group', { name: 'How to fill it in' }).hasAttribute('open')).toBe(open));
      await userEvent.click(screen.getByLabelText('Paste from a spreadsheet'));
      await userEvent.type(screen.getByLabelText('Rows from your spreadsheet'), '70045001,Rahmat,AB');
      await userEvent.click(screen.getByRole('button', { name: 'Check the file' }));
      const table = await screen.findByRole('table', { name: 'Each row of the file, and what it comes to' });
      expect(within(table).getByText('This agent code is already registered at this insurer.')).toBeInTheDocument();
      // The office's page asks its own controls for 44px below 1024px (UI-142).
      expect(screen.getByRole('checkbox', { name: 'Send an email invitation to 1 new person' }).closest('label')).toHaveClass('max-lg:min-h-11');
      await userEvent.click(screen.getByRole('button', { name: 'Import 1 person' }));
      expect(await screen.findByRole('link', { name: 'Back' })).toHaveAttribute('href', '/people/members');
    },
  );

  it('says so to somebody in no office, and draws no import', () => {
    stubFetch(ROUTES as never);
    renderWithSession(<PeopleImportPage />, { me: makeMe({ membership: null, permissions: ['kpm:import_roster'] }) });
    expect(screen.getByText('You are not in an office.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check the file' })).toBeNull();
  });
});
