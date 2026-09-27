import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import DataUploadPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/data-upload',
}));

const membership = {
  membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 2,
};
const OWNER = makeMe({
  membership,
  permissions: ['kpm:read_profile', 'data_upload:read', 'data_upload:download_template'],
});
/** Holds the table and not the file — the two grants are separate in §3.9. */
const READER = makeMe({ membership, permissions: ['kpm:read_profile', 'data_upload:read'] });
const AGENT = makeMe({
  membership: { ...membership, membershipId: 'mem-agent', orgLevelCode: 'AGENT', hierarchyRole: 'agent' as const, isKpmOwner: false },
  permissions: ['kpm:read_profile'],
});

const empty = { value: null, provenance: null };
const cell = (value: number) => ({ value, provenance: 'imported' as const });
const blank = () => Object.fromEntries(
  ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount']
    .map((m) => [m, { monthly: empty, ytd: empty }]),
);

const rina = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-rina', agentCode: 'PRU-001', name: 'Rina Wijaya', metrics: blank(), ...over,
});
const budi = () => ({ membershipId: 'mem-budi', agentCode: 'PRU-002', name: 'Budi Santoso', metrics: blank() });

const month = (rows: unknown[], withData = 0, m = '2026-09') => ({ month: m, rows, withData });

const HEADER = 'Agent Code,Agent Name,APE (Rp M) — This Month,Rolling Persistency (%) — This Month,'
  + 'Recruitment — This Month,New Active Agents — This Month,FYP (Rp M) — This Month,# of Policy — This Month,'
  + 'APE (Rp M) — YTD,Rolling Persistency (%) — YTD,Recruitment — YTD,New Active Agents — YTD,'
  + 'FYP (Rp M) — YTD,# of Policy — YTD';
const template = (m = '2026-09') => ({
  month: m, version: 1, filename: 'KPM0417-agent-data-Sep-2026.csv', header: HEADER.split(','),
  file: `${HEADER}\nPRU-001,"Rina Wijaya",,,,,,,,,,,,`, rowCount: 1,
});

/**
 * Both routes, keyed so the stub tells them apart: `template` is the longer key and wins for the
 * template call, `/kpm/data-upload/` catches the month.
 */
const routes = (view: unknown, t: unknown = template()) => ({
  '/kpm/data-upload/': { body: view },
  '/kpm/data-upload/template': { body: t },
});

describe('Data upload — the month table (P9-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the template (P9-T2)', () => {
    const link = () => screen.findByRole('link', { name: '⬇ Download template' });
    const templateCalls = (calls: { url: string }[]) =>
      calls.filter((c) => c.url.includes('/kpm/data-upload/template'));

    it('offers the file as a download named for the office and the month', async () => {
      stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: OWNER });

      const a = await link();
      expect(a).toHaveAttribute('download', 'KPM0417-agent-data-Sep-2026.csv');
      // A data: URL carrying the whole file, so saving it needs no second request.
      const href = a.getAttribute('href')!;
      expect(href.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
      expect(decodeURIComponent(href.split(',').slice(1).join(','))).toContain('PRU-001,"Rina Wijaya"');
    });

    it('opens the saved file with a byte-order mark, so a spreadsheet reads the em dashes', async () => {
      stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: OWNER });

      const payload = (await link()).getAttribute('href')!.slice('data:text/csv;charset=utf-8,'.length);
      expect(payload.startsWith('%EF%BB%BF')).toBe(true);
      // And the header follows it directly: the mark is the file's first three bytes, not a line.
      expect(decodeURIComponent(payload).slice(1).startsWith('Agent Code,Agent Name,')).toBe(true);
    });

    it('asks only once the month has answered, and never beside it', async () => {
      const { calls } = stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: OWNER });
      await link();

      const asked = calls.map((c) => c.url).filter((u) => u.includes('/kpm/data-upload/'));
      expect(asked).toHaveLength(2);
      expect(asked[0]).not.toContain('template');
      expect(asked[1]).toContain('/kpm/data-upload/template?month=2026-09');
    });

    it('names the file for the month that is picked, and never for the one that was left', async () => {
      stubFetch({
        ...routes(month([rina()])),
        '/kpm/data-upload/2026-08': { body: month([rina()], 0, '2026-08') },
        '/kpm/data-upload/template?month=2026-08': {
          body: { ...template('2026-08'), filename: 'KPM0417-agent-data-Aug-2026.csv' },
        },
      });
      renderWithSession(<DataUploadPage />, { me: OWNER });
      expect(await link()).toHaveAttribute('download', 'KPM0417-agent-data-Sep-2026.csv');

      fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-08' } });

      // Gone at once — the link is for the month the table shows, and the table is reloading.
      expect(screen.queryByRole('link', { name: '⬇ Download template' })).not.toBeInTheDocument();
      await waitFor(async () => {
        expect(await link()).toHaveAttribute('download', 'KPM0417-agent-data-Aug-2026.csv');
      });
    });

    it('says so beside the picker when the file cannot be prepared, and leaves the table alone', async () => {
      stubFetch({
        '/kpm/data-upload/': { body: month([rina()]) },
        '/kpm/data-upload/template': {
          status: 500,
          body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'req-42' } },
        },
      });
      renderWithSession(<DataUploadPage />, { me: OWNER });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('The template could not be prepared. Something went wrong on our side.');
      expect(alert).toHaveTextContent('INTERNAL_ERROR · req-42');
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '⬇ Download template' })).not.toBeInTheDocument();
      // The table it sits beside loaded, and says so.
      expect(screen.getByText('Rina Wijaya')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('tries again when asked, and offers the file once it arrives', async () => {
      const { calls } = stubFetch({
        '/kpm/data-upload/': { body: month([rina()]) },
        '/kpm/data-upload/template': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } },
          { body: template() },
        ],
      });
      renderWithSession(<DataUploadPage />, { me: OWNER });

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await link()).toHaveAttribute('download', 'KPM0417-agent-data-Sep-2026.csv');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(templateCalls(calls)).toHaveLength(2);
    });

    it('does not ask for a file when the month itself could not be read', async () => {
      const { calls } = stubFetch({
        '/kpm/data-upload/': {
          status: 500,
          body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } },
        },
        '/kpm/data-upload/template': { body: template() },
      });
      renderWithSession(<DataUploadPage />, { me: OWNER });

      await screen.findByRole('alert');
      expect(templateCalls(calls)).toHaveLength(0);
      expect(screen.queryByRole('link', { name: '⬇ Download template' })).not.toBeInTheDocument();
    });

    it('shows the table and not the control to somebody who may read and may not download', async () => {
      const { calls } = stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: READER });

      await screen.findByText('Rina Wijaya');
      expect(screen.queryByRole('link', { name: '⬇ Download template' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      // Not asked for either: a grant enforced on the pixels and not on the wire is the defect.
      expect(templateCalls(calls)).toHaveLength(0);
    });
  });

  it('AC-7: lists every member for the month, code and name', async () => {
    stubFetch(routes(month([rina(), budi()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('PRU-001')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('APE — month');
  });

  it('AC-4: shows a dash for nothing reported and a number for a reported zero', async () => {
    const reported = rina({
      metrics: { ...blank(), ape: { monthly: cell(0), ytd: empty }, policyCount: { monthly: cell(3), ytd: cell(3) } },
    });
    stubFetch(routes(month([reported, budi()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const rows = await screen.findAllByRole('row');
    const rinaRow = rows.find((r) => within(r).queryByText('Rina Wijaya'))!;
    const budiRow = rows.find((r) => within(r).queryByText('Budi Santoso'))!;
    // Rina: a reported zero is a figure.
    expect(within(rinaRow).getByText('Rp 0')).toBeInTheDocument();
    expect(within(rinaRow).getAllByText('3').length).toBeGreaterThan(0);
    // Budi: twelve dashes, none of them a zero.
    expect(within(budiRow).getAllByLabelText('nothing reported')).toHaveLength(12);
    expect(within(budiRow).queryByText('Rp 0')).not.toBeInTheDocument();
  });

  it('formats money as rupiah in full, not as the file’s Rp M', async () => {
    stubFetch(routes(
      month([rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000_00), ytd: empty } } })], 1),
    ));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText('Rp 150.000.000')).toBeInTheDocument();
  });

  it('says so when nothing has been uploaded, and still lists everybody', async () => {
    stubFetch(routes(month([rina(), budi()], 0)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    // Wait for the table: the loading skeleton is itself a live region, and `findByRole` resolves
    // on the first match. The two never coexist, which is why a screen has exactly one `status`.
    await screen.findByText('Rina Wijaya');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has been uploaded for September 2026 yet');
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + two members
  });

  it('counts the rows that hold a figure once something has', async () => {
    stubFetch(routes(month([rina(), budi()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    await screen.findByText('Rina Wijaya');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 members have figures');
  });

  it('asks the server for the month that is picked', async () => {
    const { calls } = stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await screen.findByText('Rina Wijaya');

    // A `type="month"` input takes a value, not keystrokes — jsdom has no picker to type into.
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-08' } });

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/kpm/data-upload/2026-08'))).toBe(true);
    });
  });

  it('renders the server’s refusal rather than an empty table', async () => {
    stubFetch({
      '/kpm/data-upload/': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'september is not a month. Use YYYY-MM.', requestId: 'r1' } },
      },
      '/kpm/data-upload/template': { body: template() },
    });
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText(/is not a month/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('is gated on data_upload:read — an agent gets neither the table nor the request', async () => {
    // Both halves. The table was withheld from the start; the request was not, because the effect
    // lived in the page component around the gate rather than in a child inside it — a permission
    // enforced on the pixels and not on the wire.
    const { calls } = stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: AGENT });

    expect(await screen.findByText(/needs the/)).toBeInTheDocument();
    expect(screen.queryByText('Rina Wijaya')).not.toBeInTheDocument();
    // Neither the month nor the template is asked for.
    expect(calls.filter((c) => c.url.includes('/kpm/data-upload/'))).toHaveLength(0);
  });
});
