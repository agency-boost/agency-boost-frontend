import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import {
  atWidth, browserChose, digestAt, InLanguage, makeMe, renderInIndonesian, renderWithLanguage, renderWithSession, resetLanguage,
  stubFetch, wears,
} from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import {
  CASES, cellsOf, configOf, FYC_FROM_DEC, KOMISI, statusOf, V1_COLUMNS, V1_FILE_COLUMNS, V2_FILE_COLUMNS, viewOf,
} from '@test/data-upload-fixtures';
import { columnHeading, correctionKey } from '@/lib/production';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { setAccessToken } from '@/lib/api-client';
import { showFigure } from './correction-panel';
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
  permissions: [
    'kpm:read_profile', 'data_upload:read', 'data_upload:download_template', 'data_upload:upload_and_preview',
  ],
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

/** A month's state as the server answers it: open, and three writes in (P9-T4). */
const state = (m = '2026-09', over: Record<string, unknown> = {}) => ({
  month: m, revision: 3, locked: false, reason: 'open', editableUntil: '2026-10-07',
  changedAt: null, changedBy: null, ...over,
});
/** A month read as the server answers it since P19.5-T2: version 1's seven columns, rows by kode (`viewOf`). */
const month = (rows: Parameters<typeof viewOf>[0], withData = 0, m = '2026-09', st: unknown = state(m)) => viewOf(rows, withData, m, st);

const HEADER = 'Agent Code,Agent Name,APE (Rp M) — This Month,Rolling Persistency (%) — This Month,'
  + 'Recruitment — This Month,New Active Agents — This Month,FYP (Rp M) — This Month,# of Policy — This Month,'
  + 'APE (Rp M) — YTD,Rolling Persistency (%) — YTD,Recruitment — YTD,New Active Agents — YTD,'
  + 'FYP (Rp M) — YTD,# of Policy — YTD';
const template = (m = '2026-09') => ({
  month: m, version: 1, filename: `0417-agent-data-${m}.csv`, header: HEADER.split(','),
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
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('defaults to the office’s month, not the browser’s UTC one (invariant §9)', async () => {
    // 01:00 on 1 October in Jakarta is still 30 September in UTC.
    vi.setSystemTime(new Date('2026-09-30T18:00:00Z'));
    const { calls } = stubFetch({
      ...routes(month([rina()], 0, '2026-10')),
      '/kpm/settings/branch-info': { body: { timezone: 'Asia/Jakarta' } },
    });
    renderWithSession(<DataUploadPage />, { me: OWNER });

    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/data-upload/2026-10'))).toBe(true));
  });

  /*
   * *Amended 2026-11-01 (ADR-0184):* **⬇ Download template** is the Excel workbook, a button that fetches it with the
   * token; the CSV, as it always was, is **Download CSV** beside it — the `data:` link these tests read.
   */
  describe('the template (P9-T2)', () => {
    const link = () => screen.findByRole('link', { name: 'Download CSV' });
    const templateCalls = (calls: { url: string }[]) =>
      calls.filter((c) => c.url.includes('/kpm/data-upload/template'));

    it('offers the file as a download named for the office and the month', async () => {
      stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: OWNER });

      const a = await link();
      expect(a).toHaveAttribute('download', '0417-agent-data-2026-09.csv');
      // The prototype's ⬇ is drawn on the control it drew it on — now the workbook's — and kept out of the name, as on
      // the Summary's Download (ADR-0068).
      const workbook = screen.getByRole('button', { name: 'Download template' });
      expect(workbook).toHaveTextContent('⬇Download template');
      expect(workbook.querySelector('[aria-hidden="true"]')).toHaveTextContent('⬇');
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
          body: { ...template('2026-08'), filename: '0417-agent-data-2026-08.csv' },
        },
      });
      renderWithSession(<DataUploadPage />, { me: OWNER });
      expect(await link()).toHaveAttribute('download', '0417-agent-data-2026-09.csv');

      fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-08' } });

      // Gone at once — the link is for the month the table shows, and the table is reloading.
      expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Download template' })).not.toBeInTheDocument();
      await waitFor(async () => {
        expect(await link()).toHaveAttribute('download', '0417-agent-data-2026-08.csv');
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
      expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Download template' })).not.toBeInTheDocument();
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

      expect(await link()).toHaveAttribute('download', '0417-agent-data-2026-09.csv');
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
      expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Download template' })).not.toBeInTheDocument();
    });

    it('shows the table and not the control to somebody who may read and may not download', async () => {
      const { calls } = stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: READER });

      await screen.findByText('Rina Wijaya');
      expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Download template' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      // Not asked for either: a grant enforced on the pixels and not on the wire is the defect.
      expect(templateCalls(calls)).toHaveLength(0);
    });

    describe('ADR-0184 the Excel workbook', () => {
      const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      afterEach(() => { vi.restoreAllMocks(); setAccessToken(null); });

      /** Saving a file, as far as the browser lets a test see it: the link clicked, with its name. */
      const watchSaves = () => {
        const saved: string[] = [];
        vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }));
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
          if (this.getAttribute('href') === 'blob:test') saved.push(this.download);
        });
        return saved;
      };

      it('fetches the month’s workbook with the token and saves it, named as the CSV is with .xlsx', async () => {
        setAccessToken('token-in-memory');
        const saved = watchSaves();
        const { calls } = stubFetch({
          ...routes(month([rina()])),
          'GET /kpm/data-upload/template': ({ url }: { url: string }) => (url.includes('format=xlsx')
            ? { body: new Blob(['PK'], { type: XLSX }) }
            : { body: template() }),
        });
        renderWithSession(<DataUploadPage />, { me: OWNER });

        fireEvent.click(await screen.findByRole('button', { name: 'Download template' }));
        await waitFor(() => expect(saved).toEqual(['0417-agent-data-2026-09.xlsx']));
        const asked = calls.find((c) => c.url.includes('format=xlsx'))!;
        expect(asked.url).toContain('/kpm/data-upload/template?month=2026-09&format=xlsx');
        expect((asked.init.headers as Record<string, string>).Authorization).toBe('Bearer token-in-memory');
      });

      it('says a workbook that could not be prepared, with the reference and a way to ask again', async () => {
        const saved = watchSaves();
        let refuse = true;
        stubFetch({
          ...routes(month([rina()])),
          'GET /kpm/data-upload/template': ({ url }: { url: string }) => {
            if (!url.includes('format=xlsx')) return { body: template() };
            if (refuse) {
              refuse = false;
              return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'req-43' } } };
            }
            return { body: new Blob(['PK']) };
          },
        });
        renderWithSession(<DataUploadPage />, { me: OWNER });

        fireEvent.click(await screen.findByRole('button', { name: 'Download template' }));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('The template could not be prepared. Something went wrong on our side.');
        expect(alert).toHaveTextContent('INTERNAL_ERROR · req-43');
        // The CSV is still there to take.
        expect(screen.getByRole('link', { name: 'Download CSV' })).toBeInTheDocument();
        fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
        await waitFor(() => expect(saved).toEqual(['0417-agent-data-2026-09.xlsx']));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  it('AC-7: lists every member for the month, code and name', async () => {
    stubFetch(routes(month([rina(), budi()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('PRU-001')).toBeInTheDocument();
    // *Changed 2026-11-05 (P19.2-T3 AC-1; UI-139):* the table shows one side of the *Bulan ini | YTD* switch at a time,
    // this month's first.
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('APE');
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
    expect(within(rinaRow).getByText('IDR 0')).toBeInTheDocument();
    expect(within(rinaRow).getAllByText('3').length).toBeGreaterThan(0);
    // Budi: a dash for each of this month's six, none of them a zero — and, an agent, a dash under *Unit persistency
    // (%)* (P19.3-T2) — and five more on the switch's YTD side (P19.2-T3 AC-1: one side at a time; P19.5-T2: the five
    // columns with a year to date — a persistency has none).
    expect(within(budiRow).getAllByLabelText('nothing reported')).toHaveLength(7);
    expect(within(budiRow).queryByText('IDR 0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const budiYtd = screen.getAllByRole('row').find((r) => within(r).queryByText('Budi Santoso'))!;
    expect(within(budiYtd).getAllByLabelText('nothing reported')).toHaveLength(5);
  });

  it('formats money as rupiah in full, not as the file’s Rp M', async () => {
    stubFetch(routes(
      month([rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000_00), ytd: empty } } })], 1),
    ));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText('IDR 150,000,000')).toBeInTheDocument();
  });

  it('P18.9-T3 AC-2, AC-3 keeps the file’s own figures as filed: money to the rupiah, a persistency’s every place and no ,0', async () => {
    // Data upload's cells are where precision matters (ADR-0174 §3, §4): never *Rp 5,7 M*, never *87%* for 87,35.
    stubFetch(routes(month([rina({
      metrics: {
        ...blank(),
        ape: { monthly: cell(5_672_500_000_00), ytd: cell(9_672_500_000_00) },
        persistency: { monthly: cell(87.35), ytd: cell(90) },
      },
    })], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const row = (await screen.findAllByRole('row')).find((r) => within(r).queryByText('Rina Wijaya'))!;
    expect(within(row).getByText('IDR 5,672,500,000')).toBeInTheDocument();
    expect(within(row).getByText('87.35%')).toBeInTheDocument();
    expect(within(row).queryByText(/,0%/)).not.toBeInTheDocument();
    // The year to date on the switch's other side (P19.2-T3 AC-1) — APE's the sum of the months (P19.5-T2, R4); a
    // persistency has none.
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const ytd = screen.getAllByRole('row').find((r) => within(r).queryByText('Rina Wijaya'))!;
    expect(within(ytd).getByText('IDR 9,672,500,000')).toBeInTheDocument();
    expect(within(ytd).queryByText('90%')).not.toBeInTheDocument();
  });

  it('P18.9-T3 AC-2, AC-3 writes the correction panel’s and its confirmation’s figures as the cells do', () => {
    expect(showFigure('rp_million', 5_672_500_000_00, 'id')).toBe('Rp 5.672.500.000');
    expect(showFigure('percent', 87.35, 'id')).toBe('87,35%');
    expect(showFigure('percent', 87, 'id')).toBe('87%');
    expect(showFigure('count', 3, 'id')).toBe('3');
    expect(showFigure('percent', null, 'id')).toBe('nothing reported');
  });

  it('P18.10-T3 AC-4 writes the file’s figures in full in the reader’s language, the same figure in each', () => {
    expect(showFigure('rp_million', 5_672_500_000_00, 'en')).toBe('IDR 5,672,500,000');
    expect(showFigure('percent', 87.35, 'en')).toBe('87.35%');
    expect(showFigure('percent', 87, 'en')).toBe('87%');
    expect(showFigure('count', 1_250, 'en')).toBe('1,250');
    expect(showFigure('count', 1_250, 'id')).toBe('1.250');
  });

  it('says so when nothing has been uploaded, and still lists everybody', async () => {
    stubFetch(routes(month([rina(), budi()], 0)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    // Wait for the table: the loading skeleton is itself a live region, and `findByRole` resolves
    // on the first match. The two never coexist, which is why a screen has exactly one `status`.
    await screen.findByText('Rina Wijaya');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has been uploaded for Sep 2026 yet');
    expect(screen.getAllByRole('row')).toHaveLength(3); // the heading row + two members (one head row since P19.2-T3)
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'data_upload:read');
    expect(screen.queryByText('Rina Wijaya')).not.toBeInTheDocument();
    // Neither the month nor the template is asked for.
    expect(calls.filter((c) => c.url.includes('/kpm/data-upload/'))).toHaveLength(0);
  });
});

// ── P9-T3 ────────────────────────────────────────────────────────────────────────────────────

/**
 * A row's cells, one per column a version 1 file is read for — this month's six (P19.5-T2: its YTD headers are not
 * stored, R4) — not provided unless given, keyed by the metric's old name (`cellsOf`).
 */
const cells = (given: Parameters<typeof cellsOf>[0] = {}) => cellsOf(given);

const PREVIEW_REVISION = 3;
const PREVIEW = {
  month: '2026-09',
  filename: 'filled.csv',
  templateVersion: 1,
  encoding: 'utf-8',
  delimiter: ';',
  revision: PREVIEW_REVISION,
  columns: V1_FILE_COLUMNS,
  notes: [] as unknown[],
  summary: {
    rows: 3, ready: 2, refused: 1, held: 0, newCells: 1, changedCells: 1, unchangedCells: 0,
    notProvidedCells: 21, refusedCells: 1, notInFile: 4,
  },
  rows: [
    {
      line: 2, agentCode: 'PRU-001', membershipId: 'mem-rina', resolvedAgentCode: 'PRU-001', name: 'Rina Wijaya',
      fileName: 'Rina Wijaya', nameDiffers: false, codeRecovered: false, status: 'ready',
      issues: [{
        code: 'UPLOAD_VALUE_OUT_OF_RANGE', kode: 'PERSISTENCY', ytd: false,
        message: 'Rolling persistency (%) [PERSISTENCY]: “140” is above 100 — persistency is a percentage.',
      }],
      cells: cells({
        ape: { status: 'new', after: 150_000_000, raw: '1,5' },
        fyp: { status: 'changed', before: 100_000_000, after: 600_000_000, raw: '6' },
        persistency: { status: 'refused', raw: '140' },
      }),
    },
    {
      line: 3, agentCode: '88213', membershipId: 'mem-sari', resolvedAgentCode: '00088213', name: 'Sari Dewi',
      fileName: 'Sari D.', nameDiffers: true, codeRecovered: true, status: 'ready', issues: [], cells: cells(),
    },
    {
      line: 4, agentCode: 'PRU-999', membershipId: null, resolvedAgentCode: null, name: null,
      fileName: 'Nobody', nameDiffers: false, codeRecovered: false, status: 'refused', cells: [],
      issues: [{ code: 'UPLOAD_UNKNOWN_AGENT_CODE', kode: null, ytd: null, message: 'No active member of this office has this code.' }],
    },
  ],
};

const csvFile = () => new File(['Agent Code;Agent Name'], 'filled.csv', { type: 'text/csv' });
const choose = async (file = csvFile()) => {
  const input = await screen.findByLabelText('+ Upload filled template');
  fireEvent.change(input, { target: { files: [file] } });
};

describe('Data upload — reading a filled file (P9-T3)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const withPreview = (preview: unknown = PREVIEW, status = 200) => ({
    ...routes(month([rina(), budi()])),
    '/kpm/data-upload/preview': { status, body: preview },
  });

  it('offers the upload to somebody who holds its grant, and not to somebody who may only read', async () => {
    stubFetch(withPreview());
    const { unmount } = renderWithSession(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByLabelText('+ Upload filled template')).toHaveAttribute('type', 'file');
    // ADR-0184: an Excel workbook or a CSV, either read on the server.
    expect(screen.getByLabelText('+ Upload filled template')).toHaveAttribute(
      'accept', '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
    );
    unmount();

    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: READER });
    await screen.findByText('Rina Wijaya');
    expect(screen.queryByLabelText('+ Upload filled template')).not.toBeInTheDocument();
  });

  it('AC-11: sends the file as bytes, in a form, with the month the table shows', async () => {
    const { calls } = stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const file = csvFile();
    await choose(file);

    await waitFor(() => expect(calls.some((c) => c.url.includes('/kpm/data-upload/preview'))).toBe(true));
    const sent = calls.find((c) => c.url.includes('/kpm/data-upload/preview'))!;
    expect(sent.init.method).toBe('POST');
    const form = sent.init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('month')).toBe('2026-09');
    expect(form.get('file')).toBe(file);
  });

  it('says what would change, in the prototype’s words, and takes focus so a screen reader hears it', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const heading = await screen.findByRole('heading', { name: '2 agents ready to import, 1 row skipped.' });
    await waitFor(() => expect(heading).toHaveFocus());
    const card = screen.getByRole('region', { name: '2 agents ready to import, 1 row skipped.' });
    expect(card).toHaveTextContent(
      'Figures: 1 new · 1 changed · 0 already as stored · 21 left blank, which keep what is stored · 1 not taken.',
    );
    expect(card).toHaveTextContent('4 active members are not in the file and keep what they have.');
  });

  it('AC-8: says plainly that nothing has been saved yet, and offers no confirm without its grant', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const card = await screen.findByRole('region');
    expect(card).toHaveTextContent('Nothing has been saved yet. Confirm import writes the figures in bold');
    // OWNER here holds upload_and_preview and not commit_import — §3.9 grants them apart.
    expect(within(card).queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument();
  });

  it('lists every row and figure not taken, with its line, its code and its reason', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const list = (await screen.findByRole('heading', { name: 'Not taken (2)' })).nextElementSibling as HTMLElement;
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Line 2 · PRU-001 · Rina Wijaya');
    expect(items[0]).toHaveTextContent('“140” is above 100');
    expect(items[1]).toHaveTextContent('Line 4 · PRU-999');
    expect(items[1]).toHaveTextContent('No active member of this office has this code.');
  });

  it('AC-9: shows a diff — new, changed with what it was, not taken, and a blank that keeps what is stored', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const table = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const rinaRow = within(table).getAllByRole('row').find((r) => within(r).queryByText('Rina Wijaya'))!;
    const cellsOf = within(rinaRow).getAllByRole('cell');
    // The template's order (P13.1-T7, P19.5-T2): name, code, then the columns the file is read for from [2] — APE,
    // Rolling persistency, Recruitment, New active agents, FYP, # of policy.
    expect(cellsOf[2]).toHaveTextContent('IDR 1,500,000');
    expect(cellsOf[6]).toHaveTextContent('IDR 6,000,000');
    expect(cellsOf[6]).toHaveTextContent('was IDR 1,000,000');
    expect(cellsOf[3]).toHaveTextContent('✕ 140 — not taken');
    expect(within(cellsOf[4]).getByLabelText('left blank')).toHaveTextContent('—');
    // The row the file could not attribute is in the list, not the table.
    expect(within(table).queryByText('PRU-999')).not.toBeInTheDocument();
  });

  it('AC-6: shows a recovered code and a different name, and still takes the row', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const table = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const sari = within(table).getAllByRole('row').find((r) => within(r).queryByText('Sari Dewi'))!;
    expect(sari).toHaveTextContent('00088213read from “88213”');
    expect(sari).toHaveTextContent('the file says “Sari D.”');
  });

  it('refuses a file whole with the server’s reason, and leaves the table as it was', async () => {
    stubFetch(withPreview({
      error: {
        code: 'UPLOAD_TEMPLATE_MISMATCH', requestId: 'req-7',
        message: 'Column 5 of the header reads “Recruits”; the template’s reads “Recruitment — This Month”.',
      },
    }, 422));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    expect(await screen.findByText('“filled.csv” was not read. Nothing has been saved.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Column 5 of the header reads “Recruits”');
    expect(screen.getByRole('alert')).toHaveTextContent('UPLOAD_TEMPLATE_MISMATCH · req-7');
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('puts the preview away on Cancel', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('puts the preview away when the month changes — it compared the other month’s figures', async () => {
    stubFetch({ ...withPreview(), '/kpm/data-upload/2026-08': { body: month([rina()], 0, '2026-08') } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();
    await screen.findByRole('region');

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-08' } });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('keeps one status region on the screen with a preview open', async () => {
    stubFetch(withPreview());
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();
    await screen.findByRole('region');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

// ── P9-T4 ────────────────────────────────────────────────────────────────────────────────────

const EVERYTHING = makeMe({
  membership,
  permissions: [
    'kpm:read_profile', 'data_upload:read', 'data_upload:download_template', 'data_upload:upload_and_preview',
    'data_upload:commit_import', 'data_upload:revert_batch', 'data_upload:read_history',
    'data_upload:lock_month', 'data_upload:reopen_month',
  ],
});

const batch = (over: Record<string, unknown> = {}) => ({
  id: 'b-2', month: '2026-09', filename: 'KPM0417-agent-data-Sep-2026-corrected.csv', status: 'committed',
  templateVersion: 1, rowCount: 6, writtenRowCount: 6, cellCount: 72, issueCount: 0,
  committedAt: '2026-09-26T07:00:00.000Z', committedBy: 'Wilson Tanoto',
  revertedAt: null, revertedBy: null, restoredCellCount: 0, keptCellCount: 0, canRevert: true, ...over,
});
const REVERTED = batch({
  id: 'b-1', filename: 'KPM0417-agent-data-Sep-2026.csv', status: 'reverted', canRevert: false, writtenRowCount: 8,
  cellCount: 96, revertedAt: '2026-09-25T07:00:00.000Z', revertedBy: 'Maya Halim', restoredCellCount: 96,
});
const result = (b: Record<string, unknown>, st = state('2026-09', { revision: 4 })) => ({ batch: batch(b), state: st });

describe('Data upload — confirm, history, revert and the month lock (P9-T4)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const everything = (over: Record<string, unknown> = {}) => ({
    ...routes(month([rina(), budi()], 1)),
    '/kpm/data-upload/preview': { body: PREVIEW },
    '/kpm/data-upload/history': { body: { month: '2026-09', batches: [batch(), REVERTED] } },
    ...over,
  });

  describe('the month lock (ADR-0050)', () => {
    it('says a month is open, and until when', async () => {
      stubFetch(everything());
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      // *Changed 2026-11-05 (P19.2-T3 AC-1; UI-139):* the strip says *Open until …*, and the sentence is its ⓘ.
      expect(await screen.findByText('Open until 7 Oct 2026')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open for imports and corrections until 7 Oct 2026, when it locks.' })).toBeInTheDocument();
    });

    it.each([
      [{ locked: true, reason: 'schedule', editableUntil: '2026-09-07' }, 'Locked — its window closed after 7 Sep 2026. Reopen it to change its figures.'],
      [{ locked: true, reason: 'locked_by_hand', changedBy: 'Maya Halim', changedAt: '2026-09-20T03:00:00.000Z' }, 'Locked by Maya Halim on 20 Sep 2026. Reopen it to change its figures.'],
      [{ locked: false, reason: 'reopened', changedBy: 'Wilson Tanoto', changedAt: '2026-09-21T03:00:00.000Z' }, 'Reopened by Wilson Tanoto on 21 Sep 2026. It stays open until somebody locks it again.'],
    ])('says why: %j', async (over, sentence) => {
      stubFetch(everything({ '/kpm/data-upload/': { body: month([rina()], 1, '2026-09', state('2026-09', over)) } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      // The sentence is the strip's ⓘ since P19.2-T3 (UI-139: long explanations behind ⓘ).
      expect(await screen.findByRole('button', { name: sentence })).toBeInTheDocument();
    });

    it('locks the month after asking, and says so', async () => {
      const { calls } = stubFetch(everything({
        '/kpm/data-upload/months/2026-09/lock': { body: state('2026-09', { locked: true, reason: 'locked_by_hand', revision: 4 }) },
      }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });

      fireEvent.click(await screen.findByRole('button', { name: 'Lock month' }));
      expect(screen.getByRole('dialog')).toHaveTextContent('Lock Sep 2026? Imports, reverts and corrections to it will be refused');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lock month' }));

      expect(await screen.findByText('Sep 2026 is locked.')).toBeInTheDocument();
      expect(calls.find((c) => c.url.includes('/months/2026-09/lock'))!.init.method).toBe('POST');
    });

    it('offers Reopen on a locked month, and neither without the grants', async () => {
      stubFetch(everything({ '/kpm/data-upload/': { body: month([rina()], 1, '2026-09', state('2026-09', { locked: true, reason: 'schedule' })) } }));
      const { unmount } = renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      expect(await screen.findByRole('button', { name: 'Reopen month' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Lock month' })).not.toBeInTheDocument();
      unmount();

      stubFetch(everything());
      renderWithSession(<DataUploadPage />, { me: OWNER });
      await screen.findByText('Rina Wijaya');
      // *Lock month* and *Reopen month* — not the table's *This month* switch (P19.2-T3).
    expect(screen.queryByRole('button', { name: /^(Lock|Reopen) month$/ })).not.toBeInTheDocument();
    });
  });

  describe('Confirm import', () => {
    it('sends the same file with the revision its preview saw, then reloads and says what it did', async () => {
      const { calls } = stubFetch(everything({ '/kpm/data-upload/commit': { status: 201, body: result({ writtenRowCount: 2 }) } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      const file = csvFile();
      await choose(file);

      fireEvent.click(await screen.findByRole('button', { name: 'Confirm import' }));

      const notice = await screen.findByText('Imported 2 agent records for Sep 2026.');
      await waitFor(() => expect(notice).toHaveFocus());
      const sent = calls.find((c) => c.url.includes('/kpm/data-upload/commit'))!;
      const form = sent.init.body as FormData;
      expect([form.get('month'), form.get('revision'), form.get('file')]).toEqual(['2026-09', String(PREVIEW_REVISION), file]);
      // The preview is put away, and the month is read again.
      await waitFor(() => expect(screen.queryByRole('region', { name: /ready to import/ })).not.toBeInTheDocument());
      expect(calls.filter((c) => /\/kpm\/data-upload\/2026-09$/.test(c.url)).length).toBeGreaterThanOrEqual(2);
    });

    it('keeps the preview open and says why when the month has moved on', async () => {
      stubFetch(everything({
        '/kpm/data-upload/commit': {
          status: 409,
          body: { error: { code: 'VERSION_CONFLICT', message: 'Sep 2026 has changed since you looked at it.', requestId: 'r' } },
        },
      }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      await choose();
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm import' }));

      const card = screen.getByRole('region', { name: /ready to import/ });
      expect(await within(card).findByRole('alert')).toHaveTextContent('Sep 2026 has changed since you looked at it.');
      expect(within(card).getByRole('button', { name: 'Confirm import' })).toBeEnabled();
    });

    it('is unavailable in a locked month, saying so', async () => {
      stubFetch(everything({ '/kpm/data-upload/': { body: month([rina()], 1, '2026-09', state('2026-09', { locked: true, reason: 'schedule' })) } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      await choose();
      const card = await screen.findByRole('region', { name: /ready to import/ });
      expect(within(card).getByRole('button', { name: 'Confirm import' })).toBeDisabled();
      expect(card).toHaveTextContent('Sep 2026 is locked — reopen it to import.');
    });

    it('is unavailable when the file would change nothing, saying so', async () => {
      const idle = { ...PREVIEW, summary: { ...PREVIEW.summary, newCells: 0, changedCells: 0 } };
      stubFetch(everything({ '/kpm/data-upload/preview': { body: idle } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      await choose();
      const card = await screen.findByRole('region', { name: /ready to import/ });
      expect(within(card).getByRole('button', { name: 'Confirm import' })).toBeDisabled();
      expect(card).toHaveTextContent('Nothing in this file would change a figure.');
    });
  });

  describe('the history', () => {
    it('lists each import: the file, who and when, what it wrote, and whether it stands', async () => {
      stubFetch(everything());
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });

      const section = await screen.findByRole('region', { name: 'Imports for Sep 2026' });
      const items = await within(section).findAllByRole('listitem');
      expect(items[0]).toHaveTextContent('KPM0417-agent-data-Sep-2026-corrected.csv');
      expect(items[0]).toHaveTextContent('Imported by Wilson Tanoto on 26 Sep 2026 · 6 agents, 72 figures');
      expect(items[0]).toHaveTextContent('Standing');
      expect(items[1]).toHaveTextContent('Reverted by Maya Halim on 25 Sep 2026 — 96 figures put back.');
      expect(within(items[1]).queryByRole('button', { name: 'Revert' })).not.toBeInTheDocument();
    });

    it('reverts the latest standing import after asking, and says what came back', async () => {
      const { calls } = stubFetch(everything({
        '/kpm/data-upload/revert': { body: result({ status: 'reverted', restoredCellCount: 70, keptCellCount: 2, canRevert: false }) },
      }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });

      fireEvent.click(await screen.findByRole('button', { name: 'Revert' }));
      expect(screen.getByRole('dialog')).toHaveTextContent('Every figure it wrote into Sep 2026 goes back to what it was before — empty where it was empty.');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revert import' }));

      expect(await screen.findByText(
        'Reverted “KPM0417-agent-data-Sep-2026-corrected.csv”: 70 figures put back, 2 kept because something changed them since.',
      )).toBeInTheDocument();
      expect(JSON.parse(calls.find((c) => c.url.includes('/revert'))!.init.body as string)).toEqual({ batchId: 'b-2' });
    });

    it('holds Revert back in a locked month, saying so', async () => {
      stubFetch(everything({ '/kpm/data-upload/': { body: month([rina()], 1, '2026-09', state('2026-09', { locked: true, reason: 'schedule' })) } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      expect(await screen.findByRole('button', { name: 'Revert' })).toBeDisabled();
      expect(screen.getByText('Sep 2026 is locked — reopen it to revert an import.')).toBeInTheDocument();
    });

    it('says so when nothing has been imported', async () => {
      stubFetch(everything({ '/kpm/data-upload/history': { body: { month: '2026-09', batches: [] } } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      expect(await screen.findByText('Nothing has been imported for Sep 2026 yet.')).toBeInTheDocument();
    });

    it('is neither shown nor asked for without its grant', async () => {
      const { calls } = stubFetch(everything());
      renderWithSession(<DataUploadPage />, { me: OWNER });
      await screen.findByText('Rina Wijaya');
      expect(screen.queryByRole('region', { name: /Imports for/ })).not.toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/history'))).toBe(false);
    });
  });
});

// ── P9-T5 ────────────────────────────────────────────────────────────────────────────────────

const CORRECTOR = makeMe({
  membership,
  permissions: ['kpm:read_profile', 'data_upload:read', 'data_upload:correct_cell'],
});

describe('Data upload — correcting one figure (P9-T5)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const withApe = () => rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000), ytd: empty } } });
  const correction = (over: Record<string, unknown> = {}) => ({
    membershipId: 'mem-rina', kode: 'APE', ytd: false, changed: true,
    before: { value: 150_000_000, provenance: 'imported' }, after: { value: 200_000_000, provenance: 'corrected' },
    state: state('2026-09', { revision: 4 }), ...over,
  });
  const openApe = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Correct APE this month for Rina Wijaya, now IDR 1,500,000' }));
    return screen.getByRole('region', { name: 'Correct APE this month for Rina Wijaya' });
  };

  it('makes every figure a control for somebody who may correct it, and says so in the prototype’s words', async () => {
    stubFetch(routes(month([withApe()], 1)));
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    expect(await screen.findByText('Tap any number to correct it manually — no need to re-upload for a single fix.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correct FYP this month for Rina Wijaya, now nothing reported' })).toBeInTheDocument();
    // P19.5-T2 AC-7 (R4): a summed year to date is the months', on the switch's other side, and never a control.
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    expect(screen.queryByRole('button', { name: /year to date/ })).not.toBeInTheDocument();
  });

  it('leaves figures as text without the grant, and in a locked month', async () => {
    stubFetch(routes(month([withApe()], 1)));
    const { unmount } = renderWithSession(<DataUploadPage />, { me: OWNER });
    await screen.findByText('Rina Wijaya');
    expect(screen.queryByRole('button', { name: /^Correct / })).not.toBeInTheDocument();
    unmount();

    stubFetch(routes(month([withApe()], 1, '2026-09', state('2026-09', { locked: true, reason: 'schedule' }))));
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    await screen.findByText('Rina Wijaya');
    expect(screen.queryByRole('button', { name: /^Correct / })).not.toBeInTheDocument();
  });

  it('opens on the figure: what it reads now and where it came from, typed in rupiah, grouped', async () => {
    stubFetch(routes(month([withApe()], 1)));
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();

    expect(panel).toHaveTextContent('PRU-001 · Sep 2026 · Now: IDR 1,500,000 (from the carrier’s file)');
    const input = within(panel).getByLabelText('New figure');
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('1,500,000');
    fireEvent.change(input, { target: { value: '2000000' } });
    expect(input).toHaveValue('2,000,000');
  });

  it('sends the figure in sen, with the month’s revision and the reason, and says what changed', async () => {
    const { calls } = stubFetch({ ...routes(month([withApe()], 1)), '/kpm/data-upload/cell': { body: correction() } });
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();

    fireEvent.change(within(panel).getByLabelText('New figure'), { target: { value: '2.000.000' } });
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'Carrier restated it' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));

    expect(await screen.findByText('Corrected APE this month for Rina Wijaya: IDR 1,500,000 → IDR 2,000,000.')).toBeInTheDocument();
    const sent = calls.find((c) => c.url.includes('/kpm/data-upload/cell'))!;
    expect(sent.init.method).toBe('PATCH');
    expect(JSON.parse(sent.init.body as string)).toEqual({
      month: '2026-09', membershipId: 'mem-rina', kode: 'APE', ytd: false,
      value: 200_000_000, revision: 3, reason: 'Carrier restated it',
    });
    expect(screen.queryByRole('region', { name: /^Correct / })).not.toBeInTheDocument();
  });

  it('asks for a reason before sending anything', async () => {
    const { calls } = stubFetch(routes(month([withApe()], 1)));
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();

    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));

    expect(within(panel).getByLabelText('Why is it being corrected?')).toHaveAccessibleDescription(/Say why the figure is being corrected\./);
    expect(calls.some((c) => c.url.includes('/cell'))).toBe(false);
  });

  it('AC-1: puts a refusal on the figure it is about', async () => {
    stubFetch({
      ...routes(month([withApe()], 1)),
      '/kpm/data-upload/cell': {
        status: 422,
        body: { error: { code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'Rolling persistency this month is above 100 — persistency is a percentage.', requestId: 'r' } },
      },
    });
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    fireEvent.click(await screen.findByRole('button', { name: 'Correct Rolling persistency this month for Rina Wijaya, now nothing reported' }));
    const panel = screen.getByRole('region', { name: 'Correct Rolling persistency this month for Rina Wijaya' });

    fireEvent.change(within(panel).getByLabelText('New figure'), { target: { value: '140' } });
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));

    await waitFor(() => expect(within(panel).getByLabelText('New figure'))
      .toHaveAccessibleDescription('Rolling persistency this month is above 100 — persistency is a percentage.'));
  });

  it('reads a decimal comma in a persistency figure', async () => {
    const { calls } = stubFetch({ ...routes(month([withApe()], 1)), '/kpm/data-upload/cell': { body: correction({ kode: 'PERSISTENCY' }) } });
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    fireEvent.click(await screen.findByRole('button', { name: 'Correct Rolling persistency this month for Rina Wijaya, now nothing reported' }));
    const panel = screen.getByRole('region', { name: /Rolling persistency/ });
    fireEvent.change(within(panel).getByLabelText('New figure'), { target: { value: '92,5' } });
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/cell'))).toBe(true));
    expect(JSON.parse(calls.find((c) => c.url.includes('/cell'))!.init.body as string).value).toBe(92.5);
  });

  it('shows a refusal about the month — it moved, or was locked — above the buttons', async () => {
    stubFetch({
      ...routes(month([withApe()], 1)),
      '/kpm/data-upload/cell': {
        status: 409,
        body: { error: { code: 'VERSION_CONFLICT', message: 'Sep 2026 has changed since you looked at it.', requestId: 'r' } },
      },
    });
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));
    expect(await within(panel).findByText('Sep 2026 has changed since you looked at it.')).toBeInTheDocument();
  });

  it('AC-4: clears a figure after asking, sending an explicit null', async () => {
    const { calls } = stubFetch({
      ...routes(month([withApe()], 1)),
      '/kpm/data-upload/cell': { body: correction({ after: { value: null, provenance: 'corrected' } }) },
    });
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'Belongs to August' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Clear figure' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Clear APE this month for Rina Wijaya in Sep 2026?');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear figure' }));

    expect(await screen.findByText('Corrected APE this month for Rina Wijaya: IDR 1,500,000 → nothing reported.')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.url.includes('/cell'))!.init.body as string).value).toBeNull();
  });

  it('says so when the figure already read that', async () => {
    stubFetch({
      ...routes(month([withApe()], 1)),
      '/kpm/data-upload/cell': { body: correction({ changed: false, after: { value: 150_000_000, provenance: 'imported' } }) },
    });
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));
    expect(await screen.findByText('APE this month for Rina Wijaya already reads IDR 1,500,000 — nothing was changed.')).toBeInTheDocument();
  });

  it('puts the form away on Cancel', async () => {
    stubFetch(routes(month([withApe()], 1)));
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const panel = await openApe();
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: /^Correct / })).not.toBeInTheDocument();
  });
});

// ── P9-T5 AC-3, ADR-0053 ─────────────────────────────────────────────────────────────────────

describe('Data upload — a correction the file would change (ADR-0053)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  /** Rina's APE this month: corrected to Rp 2.000.000 by Maya; the file says Rp 1.500.000 — what it replaced. */
  const CONFLICTED = {
    ...PREVIEW,
    summary: { ...PREVIEW.summary, rows: 1, ready: 1, refused: 0, newCells: 0, changedCells: 2, refusedCells: 0, correctionCells: 1 },
    rows: [{
      ...PREVIEW.rows[0],
      issues: [],
      cells: cells({
        ape: {
          status: 'changed', before: 200_000_000, after: 150_000_000, raw: '1,5',
          correction: { by: 'Maya Halim', at: '2026-09-26T03:00:00.000Z', reason: 'Carrier restated it', replacedValue: 150_000_000 },
        },
        fyp: { status: 'changed', before: 50_000_000, after: 60_000_000, raw: '0,6' },
      }),
    }],
  };
  const withConflict = (preview: unknown = CONFLICTED, commit: unknown = result({ writtenRowCount: 1, keptCorrectionCount: 1 })) => ({
    ...routes(month([rina()], 1)),
    '/kpm/data-upload/preview': { body: preview },
    '/kpm/data-upload/commit': { status: 201, body: commit },
  });
  const choice = () => screen.getByRole('checkbox', { name: 'APE this month for Rina Wijaya: Replace with the file’s figure' });

  it('lists the correction with who, when, why and what the file says — and that it is the figure it replaced', async () => {
    stubFetch(withConflict());
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await choose();

    const list = (await screen.findByRole('heading', { name: 'Corrected by hand (1)' })).closest('div')!.parentElement!;
    expect(list).toHaveTextContent(
      'Corrected to IDR 2,000,000 by Maya Halim on 26 Sep 2026 — “Carrier restated it”. '
      + 'The file says IDR 1,500,000 — the figure the correction replaced, so this is probably the old file.',
    );
    expect(choice()).not.toBeChecked();
    expect(choice()).toHaveAccessibleDescription(/Corrected to IDR 2,000,000 by Maya Halim/);
  });

  it('keeps it by default: the diff shows the correction, and Confirm sends nothing to replace', async () => {
    const { calls } = stubFetch(withConflict());
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await choose();

    const table = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    expect(within(table).getAllByRole('cell')[2]).toHaveTextContent('IDR 2,000,000correction kept');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));

    expect(await screen.findByText('Imported 1 agent record for Sep 2026. 1 correction kept.')).toBeInTheDocument();
    const form = calls.find((c) => c.url.includes('/commit'))!.init.body as FormData;
    expect(form.get('replace')).toBeNull();
  });

  it('replaces it when ticked, and says so in the diff and after', async () => {
    const { calls } = stubFetch(withConflict(CONFLICTED, result({ writtenRowCount: 1, replacedCorrectionCount: 1 })));
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await choose();
    await screen.findByRole('heading', { name: 'Corrected by hand (1)' });

    fireEvent.click(choice());
    const table = screen.getByRole('table', { name: 'What “filled.csv” would change' });
    expect(within(table).getAllByRole('cell')[2]).toHaveTextContent('IDR 1,500,000replaces a correction');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));

    expect(await screen.findByText('Imported 1 agent record for Sep 2026. 1 correction replaced with the file’s figure.')).toBeInTheDocument();
    const form = calls.find((c) => c.url.includes('/commit'))!.init.body as FormData;
    // By kode since P19.5-T2 (ADR-0214 §9): `membershipId:KODE`.
    expect(form.get('replace')).toBe('mem-rina:APE');
  });

  it('ticks and unticks them all', async () => {
    stubFetch(withConflict());
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await choose();
    fireEvent.click(await screen.findByRole('button', { name: 'Replace all' }));
    expect(choice()).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Keep all' }));
    expect(choice()).not.toBeChecked();
  });

  it('holds Confirm back when the only change is a correction left unticked, saying why', async () => {
    const only = {
      ...CONFLICTED,
      summary: { ...CONFLICTED.summary, changedCells: 1 },
      rows: [{ ...CONFLICTED.rows[0], cells: CONFLICTED.rows[0].cells.map((c) => (c.kode === 'FYP' ? { ...c, status: 'not_provided' as const, after: null } : c)) }],
    };
    stubFetch(withConflict(only));
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await choose();

    expect(await screen.findByRole('button', { name: 'Confirm import' })).toBeDisabled();
    expect(screen.getByText('Nothing would change — every figure it would, somebody corrected, and none is ticked.')).toBeInTheDocument();
    fireEvent.click(choice());
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeEnabled();
  });
});

// ── P9-T6: whose each figure is ─────────────────────────────────────────────────────────────

describe('Data upload — whose each figure is (P9-T6)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const corrected = (value: number | null, reason: string) => ({
    value, provenance: 'corrected' as const,
    correction: { by: 'Maya Halim', at: '2026-09-26T03:00:00.000Z', reason },
  });
  const withCorrections = () => rina({
    metrics: {
      ...blank(),
      ape: { monthly: corrected(200_000_000, 'Carrier restated it'), ytd: cell(900_000_000) },
      fyp: { monthly: corrected(null, 'Belongs to October'), ytd: empty },
    },
  });

  // *Amended 2026-10-28 (P18.9-T4 AC-2; UI-023):* the 45-word sentence is the client's one-line legend.
  it('says once, above the table, that figures are the carrier’s unless marked', async () => {
    stubFetch(routes(month([withCorrections()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByText(/= corrected by hand/)).toHaveTextContent('✎ = corrected by hand');
  });

  it('marks a corrected figure, with who, when and why for a reader and a screen reader', async () => {
    stubFetch(routes(month([withCorrections()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const row = (await screen.findByText('Rina Wijaya')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');

    // The name and its code are one column since P19.2-T3, so this month's APE is the second cell.
    expect(cells[1]).toHaveTextContent('IDR 2,000,000✎, corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”');
    expect(within(cells[1]).getByTitle('corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”')).toBeInTheDocument();
    // A carrier figure is plain: the year's APE, on the switch's other side.
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const ytd = within(screen.getByText('Rina Wijaya').closest('tr')!).getAllByRole('cell');
    expect(ytd[1]).toHaveTextContent('IDR 9,000,000');
    expect(ytd[1]).not.toHaveTextContent('✎');
  });

  it('marks a figure emptied by hand apart from one nothing was ever reported for', async () => {
    stubFetch(routes(month([withCorrections()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const row = (await screen.findByText('Rina Wijaya')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[5]).toHaveTextContent('—✎, emptied by hand by Maya Halim on 26 Sep 2026 — “Belongs to October”');
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const ytd = within(screen.getByText('Rina Wijaya').closest('tr')!).getAllByRole('cell');
    // FYP's year to date, the fourth of the five with one (P19.5-T2): nothing held.
    expect(within(ytd[4]).getByLabelText('nothing reported')).toBeInTheDocument();
  });

  it('carries the same note on a correctable figure’s name, and in the form it opens', async () => {
    stubFetch(routes(month([withCorrections()], 1)));
    renderWithSession(<DataUploadPage />, { me: CORRECTOR });
    const button = await screen.findByRole('button', {
      name: 'Correct APE this month for Rina Wijaya, now IDR 2,000,000, corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”',
    });
    fireEvent.click(button);
    expect(screen.getByRole('region', { name: 'Correct APE this month for Rina Wijaya' })).toHaveTextContent(
      'Now: IDR 2,000,000 (corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”)',
    );
  });
});


describe('Data upload — the Active (MAA) column (OD-21, ADR-0054)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const sari = (over: Record<string, unknown> = {}) => ({
    membershipId: 'mem-sari', agentCode: 'PRU-003', name: 'Sari Dewi', metrics: blank(), ...over,
  });
  const mark = async (name: string) => {
    const row = (await screen.findByText(name)).closest('tr')!;
    return within(row).getAllByRole('cell').at(-1)!;
  };

  it('closes every row with ✓, ✕ or a dash — active, not active, not reported', async () => {
    stubFetch(routes(month([
      rina({ monthlyActiveAgent: true }),
      { ...budi(), monthlyActiveAgent: false },
      sari({ monthlyActiveAgent: null }),
    ], 2)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(within(await mark('Rina Wijaya')).getByRole('img', { name: 'Active' })).toHaveTextContent('✓');
    expect(within(await mark('Budi Santoso')).getByRole('img', { name: 'Not active' })).toHaveTextContent('✕');
    expect(within(await mark('Sari Dewi')).getByRole('img', { name: 'Not reported' })).toHaveTextContent('—');
    // The last heading of the first row, spanning both: the prototype's place for it (`:4843`).
    const [groups] = within(screen.getByRole('table', { name: 'Data for Sep 2026' })).getAllByRole('row');
    expect(within(groups).getAllByRole('columnheader').at(-1)).toHaveTextContent('Active (MAA)');
  });

  it('draws the server’s answer and never works it out itself — one definition (invariant §8)', async () => {
    // APE above zero on the row, and the server says it is not known: the screen believes the server.
    stubFetch(routes(month([
      rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000_00), ytd: empty } }, monthlyActiveAgent: null }),
    ], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(within(await mark('Rina Wijaya')).getByRole('img', { name: 'Not reported' })).toBeInTheDocument();
  });

  // *Amended 2026-10-28 (P18.9-T4 AC-2; UI-023):* the column's sentence is the legend's third part, the client's words.
  it('says what the column is beside the table, rather than in a hover', async () => {
    stubFetch(routes(month([rina({ monthlyActiveAgent: true })], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText(/^Active = /)).toHaveTextContent('Active = APE or policies > 0 this month');
  });

  it('is not a column of the preview — a file says what to write, not who is active', async () => {
    stubFetch({ ...routes(month([rina(), budi()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const preview = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    expect(within(preview).queryByRole('columnheader', { name: 'Active (MAA)' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Data for Sep 2026' }))
      .getByRole('columnheader', { name: 'Active (MAA)' })).toBeInTheDocument();
  });
});

describe('Data upload — the prototype’s order (P13.1-T7)', () => {
  // The page offers this month as its default: pinned, so a run on another day reads the same month.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  /** Version 1's columns as the table heads them, in the reader's language (P19.5-T2): this month's side. */
  const SIX = ['APE', 'Rolling persistency (%)', 'Recruitment', 'New active agents', 'FYP', '# of policy (case issued)'];
  /** The YTD side: the five columns with a year to date — a persistency has none (R4). */
  const FIVE = ['APE', 'Recruitment', 'New active agents', 'FYP', '# of policy (case issued)'];
  const monthTable = () => screen.findByRole('table', { name: 'Data for Sep 2026' });
  const texts = (els: HTMLElement[]) => els.map((el) => el.textContent);
  /** What a cell's `headers` attribute names, in order — what a screen reader says before the figure. */
  const headingsOf = (cell: HTMLElement) =>
    (cell.getAttribute('headers') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);

  /*
   * *Changed 2026-11-05 (P19.2-T3 AC-1; the client's UI-139, `kpm-owner-desktop-2026-11-03` screen 2):* the month's table
   * is one head row — *Agent*, then **one side of the *Bulan ini | YTD* switch**, six figures in the template's order, then
   * *Active (MAA)* — where it was two rows of fifteen columns (1,816px in 933px at 1280). The preview keeps both groups.
   */
  it('AC-1, P19.2-T3 AC-1: draws one head row — Agent, the switch’s six, Active (MAA) — and the year’s six on the switch’s other side', async () => {
    stubFetch(routes(month([rina(), budi()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const [head] = within(await monthTable()).getAllByRole('row');
    // P19.3-T2 (T1's AC-6): the leader rows' *Unit persistency (%)* on the month's side, before *Active (MAA)*.
    expect(texts(within(head).getAllByRole('columnheader'))).toEqual(['Agent', ...SIX, 'Unit persistency (%)', 'Active (MAA)']);
    expect(within(head).getAllByRole('columnheader').every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    const sides = screen.getByRole('group', { name: 'Figures for' });
    expect(within(sides).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
      .toEqual([['This month', 'true'], ['YTD', 'false']]);
    fireEvent.click(within(sides).getByRole('button', { name: 'YTD' }));
    // The year's side: the columns with a year to date (P19.5-T2) — no persistency, no *Active (MAA)*, which is a month's.
    expect(texts(within(within(await monthTable()).getAllByRole('row')[0]).getAllByRole('columnheader')))
      .toEqual(['Agent', ...FIVE]);
    expect(within(sides).getByRole('button', { name: 'YTD' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC-1: marks the preview’s groups as groups, over a real column group each', async () => {
    stubFetch({ ...routes(month([rina()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const table = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const [groups] = within(table).getAllByRole('row');
    expect(within(groups).getByRole('columnheader', { name: 'This month' })).toHaveAttribute('scope', 'colgroup');
    // Agent and code, and the six this version 1 file is read for (P19.5-T2): its YTD headers are not stored, so there
    // is no YTD group — one comes only with a column whose year to date is uploaded.
    expect(within(groups).queryByRole('columnheader', { name: 'YTD' })).not.toBeInTheDocument();
    expect([...table.querySelectorAll('colgroup')].map((g) => g.querySelectorAll('col').length)).toEqual([2, 6]);
  });

  it('AC-1, P19.2-T3 AC-1: puts the code beside the name, and each figure under its heading on the side the switch shows', async () => {
    stubFetch(routes(month([rina({
      metrics: { ...blank(), ape: { monthly: cell(150_000_000_00), ytd: cell(900_000_000_00) } },
    })], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const row = (await screen.findByText('Rina Wijaya')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Rina Wijaya PRU-001');
    expect(cells[1]).toHaveTextContent('IDR 150,000,000');
    expect(cells).toHaveLength(9);
    // P19.5-T2 AC-7: the year's APE is the sum of the months — greyed, worked out, never typed.
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const ytd = within(screen.getByText('Rina Wijaya').closest('tr')!).getAllByRole('cell');
    expect(ytd[1]).toHaveTextContent('IDR 900,000,000');
    expect(ytd[1].querySelector('[data-ytd]')).toHaveAttribute('data-ytd', 'calculated');
  });

  it('AC-1: gives the preview the month table’s head and order, without Active (MAA)', async () => {
    stubFetch({ ...routes(month([rina(), budi()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const preview = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const [groups, metrics] = within(preview).getAllByRole('row');
    expect(texts(within(groups).getAllByRole('columnheader'))).toEqual(['Agent', 'Agent code', 'This month']);
    // The columns the file is read for, in the template's order (P19.5-T2), each headed in the reader's language.
    expect(texts(within(metrics).getAllByRole('columnheader')))
      .toEqual(['APE', 'Rolling persistency (%)', 'Recruitment', 'New active agents', 'FYP', '# of policy (case issued)']);
    const rinaRow = within(preview).getByText('Rina Wijaya').closest('tr')!;
    expect(headingsOf(within(rinaRow).getAllByRole('cell')[2])).toEqual(['This month', 'APE']);
  });

  it('AC-1: keeps two tables’ headings apart — each figure names its own table’s', async () => {
    stubFetch({ ...routes(month([rina()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const preview = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const table = await monthTable();
    const ids = (t: HTMLElement) => within(t).getAllByRole('cell').flatMap((c) => (c.getAttribute('headers') ?? '').split(' ').filter(Boolean));
    for (const id of ids(table)) expect(table.contains(document.getElementById(id))).toBe(true);
    for (const id of ids(preview)) expect(preview.contains(document.getElementById(id))).toBe(true);
  });

  it('AC-2: draws the rows in the server’s order — the org tree’s — and never re-sorts them', async () => {
    // Budi before Rina, and PRU-002 before PRU-001: neither by name nor by code, and kept.
    stubFetch(routes(month([budi(), rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const [, ...rows] = within(await monthTable()).getAllByRole('row');
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Budi Santoso PRU-002', 'Rina Wijaya PRU-001']);
  });

  it('AC-3, P19.5-T2 AC-1: runs the columns in the template’s order — each headed by its name, money without its Rp juta', async () => {
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    // Each side of the switch in turn (P19.2-T3 AC-1): this month's columns, then the year's.
    const table = await monthTable();
    const side = () => texts(within(within(table).getAllByRole('row')[0]).getAllByRole('columnheader')).slice(1);
    expect(side()).toEqual([...V1_COLUMNS.map((c) => columnHeading(c, 'en')), 'Active (MAA)']);
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    expect(side()).toEqual(V1_COLUMNS.filter((c) => c.ytd !== 'none').map((c) => columnHeading(c, 'en')));
    expect(side().join(' ')).not.toMatch(/Rp|IDR/);
  });
});

/**
 * **The intro and the legend, in the client's words** (P18.9-T4 AC-2, ADR-0176 §6; the client's KPM Owner review of
 * 2026-10-27, UI-023: *"APE ⓘ What is APE? , rolling persistency, …"*, and a 45-word legend). The intro is one sentence
 * with *APE*'s ⓘ after it; the legend is one line — the grey-text table's *Show* at every size.
 */
describe('P18.9-T4 AC-2 Data upload’s intro and legend', () => {
  afterEach(() => vi.unstubAllGlobals());

  const LEGEND = '✎ = corrected by hand · —a dash = not reported · Active = APE or policies > 0 this month';

  /*
   * *Changed 2026-11-05 (P19.2-T3 AC-1; UI-139: "long explanations behind ⓘ", UI-112):* the intro is no longer a grey
   * sub-line under the title but the words of one ⓘ in the toolbar, at every size — still one sentence, and *APE*'s
   * definition after it, so the term's ⓘ (P18.7-T9 AC-3) is not lost.
   */
  it('P18.9-T4 AC-2, P19.2-T3 AC-1 reads the intro as one sentence behind one ⓘ, APE’s definition after its full stop', async () => {
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const about = await screen.findByRole('button', { name: 'About Data upload' });
    expect(about).toHaveAccessibleDescription(
      /^Each agent’s figures for the month, in the columns of the KPM’s template — one file per month, matched by agent code\. Annualised Premium Equivalent/,
    );
    // No sub-line under the title any more.
    expect(screen.getByRole('heading', { level: 1, name: 'Data upload' }).nextElementSibling).toBeNull();
  });

  it('P18.9-T4 AC-2 says the legend in one line of three parts, the dash spoken as a dash', async () => {
    stubFetch(routes(month([withCorrectionsRow()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const legend = (await screen.findByText(/= corrected by hand/)).closest('p')!;
    expect(legend).toHaveTextContent(LEGEND);
    expect(legend.textContent).not.toMatch(/Figures are from|Derived, not entered|A dash until/);
    // Each part whole, so a narrow screen breaks the line between them and never inside one.
    expect(legend.querySelectorAll('.whitespace-nowrap')).toHaveLength(3);
    expect(within(legend).getByText('—')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([375, 767, 768, 1023, 1024, 1280])('P18.9-T4 AC-2 at %ipx shows the legend: no size takes it away', async (px) => {
    atWidth(px);
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const legend = (await screen.findByText(/= corrected by hand/)).closest('p')!;
    expect(wears(legend, px).split(' ')).not.toContain('hidden');
    expect(legend).toHaveTextContent(LEGEND);
  });

  it('P18.9-T4 AC-10 says a template that could not be prepared without a code the browser made', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { mock } = stubFetch(routes(month([rina()])));
    // The template's request never arrives, as a dropped connection's does: `fetch` itself refuses.
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/template')) throw new TypeError('Failed to fetch');
      return mock(url, init);
    }));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const said = (await screen.findByText(/The template could not be prepared/)).closest('[role="alert"]')!;
    expect(said).toHaveTextContent('Could not reach the server. Check your connection and try again.');
    expect(said.textContent).not.toMatch(/NETWORK/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[NETWORK]'));
    warn.mockRestore();
  });
});

/** Rina, with one figure corrected by hand — the legend's ✎ on the table. */
function withCorrectionsRow() {
  return rina({
    metrics: {
      ...Object.fromEntries(['persistency', 'recruitment', 'newActiveAgents', 'policyCount'].map((m) => [m, { monthly: { value: null, provenance: null }, ytd: { value: null, provenance: null } }])),
      ape: { monthly: { value: 200_000_000, provenance: 'corrected', correctedAt: '2026-09-26T03:00:00Z', correctedByName: 'Maya Halim', reason: 'Carrier restated it' }, ytd: { value: 900_000_000, provenance: 'imported' } },
      fyp: { monthly: { value: null, provenance: null }, ytd: { value: null, provenance: null } },
    },
  });
}

/**
 * **The month on a phone: a card per agent, and an edit sheet** (P18.9-T7 AC-2, AC-6, ADR-0178 §4, §5; the client's
 * KPM Owner review of 2026-10-27, UI-034: the table, 1816px; UI-040: 340 tappable cells under 44px). Below 768px each
 * member is a card, and a tap opens a sheet of their twelve figures as labelled fields, each saved through the
 * unchanged `PATCH /kpm/data-upload/cell` with its reason. At 768px and wider the page it was, to the byte.
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-1; the client's UI-139, `kpm-owner-mobile-2026-11-03` screens 2–3):* **below 1024px**
 * — a phone and a tablet — a 56px row per member in place of the card, and the sheet's figures under a *Bulan ini |
 * YTD* switch, saying *Tersimpan ✓* with ✎ on each figure a save wrote; from 1024px the table of one side at a time.
 */
describe('P18.9-T7 AC-2 Data upload on a phone (UI-034, UI-040)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const corrected = (value: number | null) => ({
    value, provenance: 'corrected' as const,
    correction: { by: 'Maya Halim', at: '2026-09-18T03:00:00Z', reason: 'Carrier restated it' },
  });
  /**
   * Rina with a figure in every kind — money, a persistency, counts — one corrected by hand; Budi with nothing. *Since
   * P19.5-T2* the correction is this month's policies: a year to date is the months' sum (R4), never corrected itself.
   */
  const RINA = rina({
    metrics: {
      ...blank(),
      ape: { monthly: cell(150_000_000), ytd: cell(900_000_000) },
      persistency: { monthly: cell(87.35), ytd: empty },
      policyCount: { monthly: corrected(2), ytd: cell(11) },
    },
    monthlyActiveAgent: true,
  });
  const BUDI = { ...budi(), monthlyActiveAgent: null };

  /**
   * Rina, on a template with one more column whose year to date the carrier uploads (P19.5-T2): *Commission*, `KOMISI`
   * — the only year to date a sheet can hold as a field.
   */
  const RINA_KOMISI = { ...RINA, metrics: { ...RINA.metrics, KOMISI: { monthly: cell(30_000_000), ytd: cell(86_000_000) } } };
  const WITH_KOMISI = configOf({ columns: [...V1_COLUMNS, KOMISI] });
  const komisiMonth = () => viewOf([RINA_KOMISI, BUDI], 1, '2026-09', state('2026-09'), { config: WITH_KOMISI });

  /** Every grant the page has: the template, the upload, the history, the lock, and correcting a figure. */
  const ALL = makeMe({ membership, permissions: [...EVERYTHING.permissions, 'data_upload:correct_cell'] });
  const everything = (over: Record<string, unknown> = {}) => ({
    ...routes(month([RINA, BUDI], 1)),
    '/kpm/data-upload/history': { body: { month: '2026-09', batches: [batch(), REVERTED] } },
    ...over,
  });

  /**
   * **The page's markup from 1024px, as P19.2-T3 built it** (UI-139, `kpm-owner-desktop-2026-11-03` screen 2), rendered
   * from this fixture on 2026-11-05.
   *
   * *Re-recorded 2026-11-05 (P19.2-T3 AC-1):* the digest was the page before P18.9-T7 at 768 and 1280 (re-recorded for
   * UI V1 on 2026-10-30 and for ADR-0184 on 2026-11-01). UI-139 changes the page at every size — the toolbar, the
   * strip, the switch, the chips and the one-row head — and a tablet now draws the phone's rows, so this pins the laptop's
   * markup as built, at 1024 and 1280, where nothing between the two moves.
   *
   * *Re-recorded 2026-11-05 (P19.3-T2; T1's AC-6, ADR-0201 §2):* the month's side gains *Unit Persistency (%)*, a leader
   * row's own column, between *# of Policy* and *Active (MAA)* — the only change; the AC-1 tests above pin where it is.
   *
   * *Re-recorded 2026-11-05 (P19.5-T2; ADR-0214 §5, §14):* the columns are the template's, headed by their names in the
   * reader's language (*Rolling persistency (%)*, *# of policy (case issued)*); the banner says how many columns and what
   * a greyed YTD is; the history names the template version; the intro is the template's. The tests above pin each.
   */
  const AS_BUILT_T3: Record<1024 | 1280, string> = {
    1024: '512cea5e7231e682821a3ee4a9ea3b131bc9ac0900dcdf221760d5d1973ebe9a',
    1280: '512cea5e7231e682821a3ee4a9ea3b131bc9ac0900dcdf221760d5d1973ebe9a',
  };

  it.each([1024, 1280] as const)('P19.2-T3 AC-1 at %ipx draws the month table and its controls as built, to the byte', async (px) => {
    atWidth(px);
    stubFetch(everything());
    // As a reader who has chosen no language reads it while the switch is not live (P18.10-T3).
    const { container } = renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });
    await screen.findByRole('table', { name: 'Data for Sep 2026' });
    await screen.findByRole('button', { name: 'Download template' });
    await screen.findByText(/KPM0417-agent-data-Sep-2026-corrected\.csv/);
    expect(digestAt(container, px)).toBe(AS_BUILT_T3[px]);
    resetLanguage();
  });

  /** The server's answer to one correction: what was there, what is now, the month one revision on. */
  const answer = ({ body }: { body: unknown }) => {
    const sent = body as { kode: string; ytd: boolean; value: number | null; revision: number };
    const row = komisiMonth().rows[0];
    const before = (sent.ytd ? row.ytd[sent.kode] : row.values[sent.kode])?.value ?? null;
    return {
      body: {
        membershipId: 'mem-rina', kode: sent.kode, ytd: sent.ytd, changed: true,
        before: { value: before, provenance: 'imported' }, after: { value: sent.value, provenance: 'corrected' },
        state: state('2026-09', { revision: sent.revision + 1 }),
      },
    };
  };
  const rowsOf = () => screen.findByRole('list', { name: 'Data for Sep 2026' });
  const openSheet = async (name = 'Rina Wijaya') => {
    await rowsOf();
    fireEvent.click(screen.getByRole('button', { name: `Correct figures for ${name}` }));
    return screen.getByRole('dialog', { name: `Correct figures for ${name}` });
  };
  /** The switch inside the sheet, onto its *YTD* side. */
  const toYtd = (sheet: HTMLElement) => fireEvent.click(within(sheet).getByRole('tab', { name: 'YTD' }));
  const patches = (calls: { url: string; init: RequestInit }[]) => calls
    .filter((c) => c.url.includes('/kpm/data-upload/cell'))
    .map((c) => JSON.parse(c.init.body as string));

  /*
   * **P19.2-T3 AC-1, a phone and a tablet** (the client's UI-139: *"Mobile + Tablet: one 56px row per person (NAME caps,
   * agent code, APE this month or grey 'Belum dilaporkan' pill, ›)"*; `kpm-owner-mobile-2026-11-03` screen 2). *Replaces
   * P18.9-T7 AC-2's card per agent*, ~600px each below 768px, and the 1,816px table at 768–1023px.
   */
  it.each([375, 767, 768, 1023])('P19.2-T3 AC-1 at %ipx draws a 56px row per member and no table: NAME, code, this month’s APE or Belum dilaporkan, ✎, ›', async (px) => {
    atWidth(px);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    const list = await rowsOf();
    expect(screen.queryByRole('table', { name: 'Data for Sep 2026' })).not.toBeInTheDocument();
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    for (const item of items) expect(wears(item, px).split(' ')).toContain('min-h-14');
    const rina = items[0];
    const name = within(rina).getByRole('button', { name: 'Correct figures for Rina Wijaya' });
    // The NAME in capitals, the code under it, this month's APE in full and the ✎ of a figure corrected by hand.
    expect(name).toHaveTextContent('Rina Wijaya');
    expect(name.className).toContain('uppercase');
    expect(rina).toHaveTextContent('PRU-001');
    expect(rina).toHaveTextContent('IDR 1,500,000✎corrected by hand');
    // The whole row is the target, opening a sheet, with a ›.
    expect(name).toHaveAttribute('aria-haspopup', 'dialog');
    expect(name.className).toContain('after:inset-0');
    expect(rina.querySelector('svg')).not.toBeNull();
    // Budi has nothing at all: the grey pill.
    expect(within(items[1]).getByText('Not reported')).toHaveAttribute('data-tone', 'grey');
    // No switch on the page below 1024px: it is the sheet's.
    expect(screen.queryByRole('group', { name: 'Figures for' })).not.toBeInTheDocument();
  });

  it('P19.2-T3 AC-1 opens a sheet that reads for somebody who may not correct, and in a locked month', async () => {
    atWidth(768);
    stubFetch(everything());
    const { unmount } = renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await rowsOf();
    expect(screen.queryByRole('button', { name: /^Correct figures for/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Figures for Rina Wijaya' }));
    let sheet = screen.getByRole('dialog', { name: 'Figures for Rina Wijaya' });
    expect(within(sheet).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(sheet).getByText('IDR 1,500,000')).toBeInTheDocument();
    expect(sheet).toHaveTextContent('2✎');
    expect(within(sheet).getByRole('img', { name: 'Active' })).toBeInTheDocument();
    toYtd(sheet);
    // P19.5-T2 AC-7: the year's APE, the months' sum, greyed.
    expect(within(sheet).getByText('IDR 9,000,000').closest('[data-ytd]')).toHaveAttribute('data-ytd', 'calculated');
    fireEvent.click(within(sheet.closest('[data-placement]') as HTMLElement).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    stubFetch(everything({ '/kpm/data-upload/': { body: month([RINA, BUDI], 1, '2026-09', state('2026-09', { locked: true, reason: 'schedule' })) } }));
    renderWithSession(<DataUploadPage />, { me: ALL });
    await rowsOf();
    expect(screen.queryByRole('button', { name: /^Correct figures for/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Figures for Rina Wijaya' }));
    sheet = screen.getByRole('dialog', { name: 'Figures for Rina Wijaya' });
    expect(within(sheet).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each([375, 768])('P19.2-T3 AC-1 at %ipx never draws the table first: the width is asked before the month answers', async (px) => {
    atWidth(px);
    stubFetch(everything());
    // The month's table, that is: the frame before the width answers is a skeleton (`role="status"`), never figures.
    let drew = false;
    const figures = (el: Element) => [el, ...el.querySelectorAll('table')]
      .some((t) => t.matches('table') && t.closest('[role="status"]') === null);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && figures(node)) drew = true;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    renderWithSession(<DataUploadPage />, { me: ALL });
    await rowsOf();
    await screen.findByText(/KPM0417-agent-data-Sep-2026-corrected\.csv/);
    observer.disconnect();
    expect(drew).toBe(false);
  });

  it('P18.9-T7 AC-2, AC-5, P19.2-T3 AC-1 opens the agent’s sheet: the switch, six labelled figures a side, 16px fields 48px tall', async () => {
    atWidth(375);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    // A sheet below 1024px, a centred box from it (P19.2-T3: it opens on a tablet too).
    expect(sheet.closest('[data-placement]')).toHaveAttribute('data-placement', 'responsive');
    expect(sheet).toHaveAccessibleDescription('PRU-001 · Sep 2026');
    // Opened on its title, so no keyboard rises before a field is chosen.
    expect(sheet).toHaveFocus();
    // The switch, this month first; the visible side is one group of the template's columns.
    expect(within(sheet).getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('aria-selected')]))
      .toEqual([['This month', 'true'], ['YTD', 'false']]);
    expect(within(sheet).getAllByRole('group').map((g) => g.querySelector('legend')!.textContent)).toEqual(['This month']);
    const ape = within(sheet).getByLabelText('APE this month');
    expect(ape).toHaveValue('1,500,000');
    expect(within(sheet).getByLabelText('Rolling persistency this month')).toHaveValue('87.35');
    expect(within(sheet).getByLabelText('# of policy (case issued) this month')).toHaveValue('2');
    expect(within(sheet).getByLabelText('FYP this month')).toHaveValue('');
    expect(within(sheet).getByRole('img', { name: 'Active' })).toBeInTheDocument();
    // Six fields and the reason on this side: *Unit persistency* is a leader's, and Rina an agent, so it reads *—*.
    expect(within(sheet).getAllByRole('textbox')).toHaveLength(7);
    // Whose a corrected figure is, under its field, and its ✎ beside the label.
    const policies = within(sheet).getByLabelText('# of policy (case issued) this month');
    expect(policies).toHaveAccessibleDescription('corrected by hand by Maya Halim on 18 Sep 2026 — “Carrier restated it”');
    expect(policies.closest('div.relative')!.querySelector('[data-corrected]')).toHaveTextContent('✎');
    toYtd(sheet);
    expect(within(sheet).getAllByRole('group').map((g) => g.querySelector('legend')!.textContent)).toEqual(['YTD']);
    // P19.5-T2 AC-7 (R4): every year to date of version 1 is the months' sum — shown greyed, never a field.
    expect(within(sheet).queryByLabelText('APE year to date')).not.toBeInTheDocument();
    expect(within(sheet).getByText('IDR 9,000,000').closest('[data-ytd]')).toHaveAttribute('data-ytd', 'calculated');
    // Every field a text box of the shared style — 16px on a phone through the field rule (globals.css; theme.spec.ts) —
    // and 48px tall on a phone and a tablet, so an input inside a box with *Rp* or *%* still has 44px.
    for (const box of within(sheet).getAllByRole('textbox')) {
      expect(box.tagName).toBe('INPUT');
      expect(box.className).toMatch(/\btext-base\b/);
      expect(box.className).not.toMatch(/text-\[/);
      const tall = box.closest('span.inline-flex') ?? box;
      for (const px of [375, 768]) expect(wears(tall, px).split(' ')).toEqual(expect.arrayContaining(['w-full', 'h-12']));
    }
    for (const button of within(sheet.closest('[data-placement]') as HTMLElement).getAllByRole('button', { name: /^(Save corrections|Cancel)$/ })) {
      for (const px of [375, 768]) expect(wears(button, px).split(' ')).toContain('h-11');
    }
  });

  it('P18.9-T7 AC-2, P19.2-T3 AC-1, P19.5-T2 AC-7 saves each changed figure by kode — an uploaded YTD a field — then says Saved ✓ with ✎ on each', async () => {
    atWidth(375);
    const { calls } = stubFetch({
      ...everything({ '/kpm/data-upload/': { body: komisiMonth() } }), 'PATCH /kpm/data-upload/cell': answer,
    });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    fireEvent.change(within(sheet).getByLabelText('APE this month'), { target: { value: '12000000' } });
    fireEvent.change(within(sheet).getByLabelText('Rolling persistency this month'), { target: { value: '88,5' } });
    // The other side keeps what was typed on this one; *Commission*'s year to date is uploaded, so it is a field.
    toYtd(sheet);
    fireEvent.change(within(sheet).getByLabelText('Commission year to date'), { target: { value: '1.500.000' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'Carrier restated it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));

    // Each on the revision the one before it answered: the month's 3, then 4, then 5 — `{ kode, ytd }`, in the sheet's order.
    await waitFor(() => expect(patches(calls)).toEqual([
      { month: '2026-09', membershipId: 'mem-rina', kode: 'APE', ytd: false, value: 1_200_000_000, revision: 3, reason: 'Carrier restated it' },
      { month: '2026-09', membershipId: 'mem-rina', kode: 'PERSISTENCY', ytd: false, value: 88.5, revision: 4, reason: 'Carrier restated it' },
      { month: '2026-09', membershipId: 'mem-rina', kode: 'KOMISI', ytd: true, value: 150_000_000, revision: 5, reason: 'Carrier restated it' },
    ]));
    expect(calls.filter((c) => c.url.includes('/kpm/data-upload/cell')).every((c) => c.init.method === 'PATCH')).toBe(true);
    // UI-139's *Done when*: the sheet stays, says *Saved ✓*, and every figure it wrote wears ✎.
    expect(await within(sheet.closest('[data-placement]') as HTMLElement).findByRole('status')).toHaveTextContent('Saved ✓');
    expect(within(sheet).getByLabelText('Commission year to date').closest('div.relative')!.querySelector('[data-corrected]')).not.toBeNull();
    fireEvent.click(within(sheet).getByRole('tab', { name: 'This month' }));
    expect(within(sheet).getByLabelText('APE this month')).toHaveValue('12,000,000');
    expect(within(sheet).getByLabelText('APE this month').closest('div.relative')!.querySelector('[data-corrected]')).not.toBeNull();
    expect(within(sheet).getByLabelText('APE this month')).toHaveAccessibleDescription('corrected by hand');
    expect(screen.getByRole('button', { name: 'Save corrections' })).toBeDisabled();
    // Closing says what it did, and the month is read again, as after a correction on the table.
    fireEvent.click(within(sheet.closest('[data-placement]') as HTMLElement).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(await screen.findByText(
      'Corrected 3 figures for Rina Wijaya: APE this month IDR 1,500,000 → IDR 12,000,000; Rolling persistency this month 87.35% → 88.5%; Commission year to date IDR 860,000 → IDR 1,500,000.',
    )).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => /\/kpm\/data-upload\/2026-09$/.test(c.url))).toHaveLength(2));
  });

  it('P18.9-T7 AC-2 asks for a reason before sending anything, and saves nothing unchanged', async () => {
    atWidth(375);
    const { calls } = stubFetch({ ...everything(), 'PATCH /kpm/data-upload/cell': answer });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    expect(screen.getByRole('button', { name: 'Save corrections' })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText('Recruitment this month'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(within(sheet).getByLabelText('Why is it being corrected?')).toHaveAccessibleDescription(/Say why the figure is being corrected\./);
    fireEvent.change(within(sheet).getByLabelText('Recruitment this month'), { target: { value: 'tiga' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(within(sheet).getByLabelText('Recruitment this month')).toHaveAccessibleDescription('Recruitment this month is not a number.');
    expect(patches(calls)).toEqual([]);
  });

  it('P19.2-T3 AC-1 brings a figure that is not a number into sight, on whichever side of the switch it is', async () => {
    atWidth(768);
    // A count whose year to date the carrier uploads: its field reads what is typed, as a count's does.
    const cases = viewOf([RINA, BUDI], 1, '2026-09', state('2026-09'), { config: configOf({ columns: [...V1_COLUMNS, CASES] }) });
    stubFetch({ ...everything({ '/kpm/data-upload/': { body: cases } }), 'PATCH /kpm/data-upload/cell': answer });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    toYtd(sheet);
    fireEvent.change(within(sheet).getByLabelText('Cases year to date'), { target: { value: 'dua' } });
    fireEvent.click(within(sheet).getByRole('tab', { name: 'This month' }));
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(within(sheet).getByRole('tab', { name: 'YTD' })).toHaveAttribute('aria-selected', 'true');
    expect(within(sheet).getByLabelText('Cases year to date')).toHaveAccessibleDescription('Cases year to date is not a number.');
  });

  it('P18.9-T7 AC-2, P19.2-T3 AC-1 puts a refusal on its figure in sight, keeps what saved before it, and says both once the sheet closes', async () => {
    atWidth(375);
    const refusal = {
      status: 422,
      body: { error: { code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'Commission year to date is above this column’s maximum, 100.', requestId: 'r' } },
    };
    const { calls } = stubFetch({
      ...everything({ '/kpm/data-upload/': { body: komisiMonth() } }),
      // The server's range rule, as it answers it: a commission's year to date over Rp 100 juta is refused.
      'PATCH /kpm/data-upload/cell': (call) => ((call.body as { value: number }).value > 10_000_000_000 ? refusal : answer(call)),
    });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    toYtd(sheet);
    fireEvent.change(within(sheet).getByLabelText('Commission year to date'), { target: { value: '140.000.000' } });
    fireEvent.click(within(sheet).getByRole('tab', { name: 'This month' }));
    fireEvent.change(within(sheet).getByLabelText('# of policy (case issued) this month'), { target: { value: '3' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'Carrier restated it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));

    const ytd = within(sheet).getByLabelText('Commission year to date');
    await waitFor(() => expect(ytd).toHaveAccessibleDescription('Commission year to date is above this column’s maximum, 100.'));
    // The refused figure's side is the one in sight.
    expect(within(sheet).getByRole('tab', { name: 'YTD' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' })).toBeInTheDocument();
    // The month's figure saved; sent again it would be nothing, so only the year goes, on the revision the first answered.
    fireEvent.change(ytd, { target: { value: '890.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(await within(sheet.closest('[data-placement]') as HTMLElement).findByRole('status')).toHaveTextContent('Saved ✓');
    fireEvent.click(within(sheet.closest('[data-placement]') as HTMLElement).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(await screen.findByText(
      'Corrected 2 figures for Rina Wijaya: # of policy (case issued) this month 2 → 3; Commission year to date IDR 860,000 → IDR 890,000.',
    )).toBeInTheDocument();
    expect(patches(calls).map((b) => [b.kode, b.ytd, b.value, b.revision])).toEqual([
      ['POLICY_COUNT', false, 3, 3], ['KOMISI', true, 14_000_000_000, 4], ['KOMISI', true, 89_000_000, 4],
    ]);
  });

  it('P18.9-T7 AC-2 reports what saved when the sheet is closed after a refusal', async () => {
    atWidth(375);
    const { calls } = stubFetch({
      ...everything(),
      'PATCH /kpm/data-upload/cell': [answer, () => ({ status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Sep 2026 has changed since you looked at it.', requestId: 'r' } } })],
    });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    fireEvent.change(within(sheet).getByLabelText('# of policy (case issued) this month'), { target: { value: '4' } });
    fireEvent.change(within(sheet).getByLabelText('Recruitment this month'), { target: { value: '1' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    // A refusal about the month is said above the buttons, in the sheet.
    expect(await within(sheet).findByText('Sep 2026 has changed since you looked at it.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Corrected Recruitment this month for Rina Wijaya: nothing reported → 1.')).toBeInTheDocument();
    expect(patches(calls)).toHaveLength(2);
  });

  it('P18.9-T7 AC-2 clears an emptied figure only after asking, naming it, with an explicit null', async () => {
    atWidth(375);
    const { calls } = stubFetch({ ...everything(), 'PATCH /kpm/data-upload/cell': answer });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    fireEvent.change(within(sheet).getByLabelText('APE this month'), { target: { value: '' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'Belongs to August' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));

    const ask = screen.getByRole('dialog', { name: /^Clear APE this month for Rina Wijaya in Sep 2026\?/ });
    expect(ask).toHaveTextContent('The figure is emptied, as if nothing had been reported, and your reason is kept with the change.');
    expect(patches(calls)).toEqual([]);
    fireEvent.click(within(ask).getByRole('button', { name: 'Clear figure' }));
    await waitFor(() => expect(patches(calls)).toEqual([
      { month: '2026-09', membershipId: 'mem-rina', kode: 'APE', ytd: false, value: null, revision: 3, reason: 'Belongs to August' },
    ]));
    fireEvent.click(within(sheet.closest('[data-placement]') as HTMLElement).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(await screen.findByText('Corrected APE this month for Rina Wijaya: IDR 1,500,000 → nothing reported.')).toBeInTheDocument();
  });

  it('P18.9-T7 AC-2 puts the sheet away on Cancel, Escape or the backdrop, sending nothing and saying nothing', async () => {
    atWidth(375);
    const { calls } = stubFetch({ ...everything(), 'PATCH /kpm/data-upload/cell': answer });
    renderWithSession(<DataUploadPage />, { me: ALL });
    let sheet = await openSheet();
    fireEvent.change(within(sheet).getByLabelText('APE this month'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    sheet = await openSheet();
    // Opened again, it holds the month's figures, not what was typed before.
    expect(within(sheet).getByLabelText('APE this month')).toHaveValue('1,500,000');
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(patches(calls)).toEqual([]);
    expect(screen.queryByText(/^Corrected /)).not.toBeInTheDocument();
  });

  it('P18.9-T7 AC-6, P19.2-T3 AC-1 makes every field and button of the page a 44px target on a phone and a tablet, and nothing from 1024px', async () => {
    atWidth(375);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    await rowsOf();
    const workbook = await screen.findByRole('button', { name: 'Download template' });
    const tall = [
      screen.getByLabelText('Month'),
      workbook,
      screen.getByRole('link', { name: 'Download CSV' }),
      screen.getByLabelText('+ Upload filled template').nextElementSibling!,
    ];
    for (const el of tall) {
      expect(wears(el, 375).split(' ')).toContain('h-11');
      expect(wears(el, 768).split(' ')).toContain('h-11');
      expect(wears(el, 1024).split(' ')).not.toContain('h-11');
    }
    // The month's lock and the history's Revert are inline buttons, 44 × 44 on a phone already (`TAP_TARGET`), and on a
    // tablet inside the shell (`TAP_TARGET_TABLET`).
    for (const name of ['Lock month', 'Revert']) {
      expect(wears(screen.getAllByRole('button', { name })[0], 375).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    }
    // The chips and the rows, 44px and more.
    for (const chip of within(screen.getByRole('group', { name: 'Show members' })).getAllByRole('button')) {
      for (const px of [375, 768]) expect(wears(chip, px).split(' ')).toContain('min-h-11');
    }
  });

  /*
   * **P19.2-T3 AC-1, the chips** (UI-139: *"chips Semua n · Belum dilaporkan n · Dikoreksi n"*): counted from the month
   * the server sent, each a toggle, and the rows or the table the chosen one's.
   */
  it.each([375, 1280])('P19.2-T3 AC-1 at %ipx counts and filters: Semua 2 · Not reported 1 · Corrected 1', async (px) => {
    atWidth(px);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    const chips = await screen.findByRole('group', { name: 'Show members' });
    expect(within(chips).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
      .toEqual([['All2', 'true'], ['Not reported1', 'false'], ['Corrected1', 'false']]);
    const names = () => (px < 1024
      ? within(screen.getByRole('list', { name: 'Data for Sep 2026' })).getAllByRole('listitem')
      : within(screen.getByRole('table', { name: 'Data for Sep 2026' })).getAllByRole('row').slice(1))
      .map((r) => (r.textContent ?? '').replace(/^(\S+ \S+).*$/s, '$1'));
    expect(names()).toHaveLength(2);
    fireEvent.click(within(chips).getByRole('button', { name: /^Not reported/ }));
    expect(names()).toEqual([expect.stringMatching(/^Budi Santoso/)]);
    fireEvent.click(within(chips).getByRole('button', { name: /^Corrected/ }));
    expect(names()).toEqual([expect.stringMatching(/^Rina Wijaya/)]);
  });

  it('P19.2-T3 AC-1 says so when a chip leaves nobody, and starts on All again in another month', async () => {
    stubFetch(everything({ '/kpm/data-upload/': { body: month([BUDI], 0) } }));
    renderWithSession(<DataUploadPage />, { me: ALL });
    const chips = await screen.findByRole('group', { name: 'Show members' });
    fireEvent.click(within(chips).getByRole('button', { name: /^Corrected/ }));
    expect(screen.getByText('Nobody here this month.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Data for Sep 2026' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-08' } });
    expect(await screen.findByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
  });

  /*
   * **P19.2-T3 AC-1, the laptop** (UI-139's *Done when*: *"no sideways scroll at 1280, 1024, 768"*;
   * `kpm-owner-desktop-2026-11-03` screen 2): the table has no minimum width — eight columns that share the page — its
   * head and its name column held while it scrolls inside its own box, which is no taller than the window.
   */
  it.each([1024, 1280])('P19.2-T3 AC-1 at %ipx lays the table out to fit: no minimum width, the head and name column sticky', async (px) => {
    atWidth(px);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    const table = await screen.findByRole('table', { name: 'Data for Sep 2026' });
    expect(table.className).not.toMatch(/min-w-/);
    expect(wears(table, px).split(' ')).toContain('w-full');
    const box = table.closest('[data-month-grid]')!;
    expect(wears(box, px).split(' ')).toEqual(expect.arrayContaining(['overflow-auto', 'max-h-[calc(100dvh-12rem)]']));
    for (const th of within(table).getAllByRole('columnheader')) expect(th.className).toContain('sticky');
    expect(within(table).getAllByRole('columnheader')[0].className).toContain('left-0');
    const nameCell = within(table).getAllByRole('row')[1].querySelector('td')!;
    expect(nameCell.className).toEqual(expect.stringContaining('sticky left-0'));
    // The month is a navy pill, and the lock a strip with *Lock month*.
    expect(screen.getByLabelText('Month')).toHaveClass('rounded-pill', 'bg-secondary');
    expect(screen.getByText('Open until 7 Oct 2026').closest('[data-lock-strip]')).toHaveAttribute('data-tone', 'green');
  });

  /**
   * **P18.10-T3 figures on Data upload** (ADR-0174, ADR-0179 §6), under the app's own provider: written in the
   * reader's chosen language, and in Indonesian with no choice, whether or not the switch is live. Until it is, a
   * reader with no choice reads the page exactly as before T3 — its words English, its figures *Rp 1.500.000* and
   * *87,35%* — never *IDR* beside an unwired screen's *Rp* (the client's UI-019).
   */
  describe('P18.10-T3 figures on Data upload', () => {
    afterEach(() => resetLanguage());

    /**
     * Rina's APE this month on her phone row, as read (P19.2-T3: the row writes this month's APE where the card wrote
     * the six; the sheet holds the rest).
     */
    const thisMonth = async (list = 'Data for Sep 2026') => {
      const rows = await screen.findByRole('list', { name: list });
      const rina = within(rows).getAllByRole('listitem')[0];
      return rina.querySelector('[data-list-row] > div:last-of-type span.text-ink')?.textContent;
    };

    it.each([1024, 1280] as const)('P18.10-T3 figures, unchosen and not live, at %ipx: the page as built, to the byte — English words, Indonesian figures', async (px) => {
      atWidth(px);
      stubFetch(everything());
      const { container } = renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });
      await screen.findByRole('table', { name: 'Data for Sep 2026' });
      await screen.findByRole('button', { name: 'Download template' });
      await screen.findByText(/KPM0417-agent-data-Sep-2026-corrected\.csv/);

      const row = screen.getAllByRole('row').find((r) => within(r).queryByText('Rina Wijaya'))!;
      expect(within(row).getByText('Rp 1.500.000')).toBeInTheDocument();
      expect(within(row).getByText('87,35%')).toBeInTheDocument();
      expect(screen.queryByText(/IDR/)).not.toBeInTheDocument();
      expect(document.documentElement.lang).toBe('en');
      // The bytes of the page as P19.2-T3 built it: every figure Indonesian, every word English.
      expect(digestAt(container, px)).toBe(AS_BUILT_T3[px]);
    });

    it('P18.10-T3 figures, unchosen and not live, on a phone: Indonesian figures in English words, the sheet’s sum grouped with dots', async () => {
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });

      expect(await thisMonth()).toBe('Rp 1.500.000');
      fireEvent.click(screen.getByRole('button', { name: 'Correct figures for Rina Wijaya' }));
      const sheet = screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' });
      expect(within(sheet).getByLabelText('APE this month')).toHaveValue('1.500.000');
      expect(within(sheet).getByLabelText('Rolling persistency this month')).toHaveValue('87,35');
      expect(within(sheet).getByLabelText('# of policy (case issued) this month')).toHaveAccessibleDescription(/corrected by hand by Maya Halim on 18 Sep 2026/);
    });

    it('P18.10-T3 figures, chosen English by the browser, not live: IDR 1,500,000 and 87.35%, the sheet’s sum grouped with commas', async () => {
      browserChose('en');
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });

      expect(await thisMonth()).toBe('IDR 1,500,000');
      fireEvent.click(screen.getByRole('button', { name: 'Correct figures for Rina Wijaya' }));
      const sheet = screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' });
      expect(within(sheet).getByLabelText('APE this month')).toHaveValue('1,500,000');
    });

    it('P18.10-T3 figures, chosen Indonesian by the browser, not live: Rp 1.500.000 and 87,35%, the screen in Indonesian', async () => {
      browserChose('id');
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });

      // Its words Indonesian too since P18.10-T4: the list is *Data untuk Sep 2026*.
      expect(await thisMonth('Data untuk Sep 2026')).toBe('Rp 1.500.000');
      expect(document.documentElement.lang).toBe('id');
    });

    it('P18.10-T3 figures, live and unchosen: Indonesian figures on a screen whose language is Indonesian', async () => {
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: true });

      // The words' language too (`<html lang>`), and since P18.10-T4 the page's own words: *Data untuk Sep 2026*.
      expect(await thisMonth('Data untuk Sep 2026')).toBe('Rp 1.500.000');
      expect(document.documentElement.lang).toBe('id');
    });
  });
});

/**
 * **P18.10-T4 Data upload in Indonesian** (`i18n/messages/data-upload.ts`; ADR-0179): the page's name and the table's
 * metric headings kept English — the carrier's file's own names — every other word the approved glossary's, a member's
 * name and code, a file's name and the server's sentences as sent, and the figures Indonesian.
 */
describe('P18.10-T4 Data upload in Indonesian', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  /** Every grant the page has: the template, the upload, the history, the lock, and correcting a figure. */
  const ALL_GRANTS = makeMe({ membership, permissions: [...EVERYTHING.permissions, 'data_upload:correct_cell'] });
  const withApe = () => rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000), ytd: empty } } });
  const inIndonesian = (me = ALL_GRANTS) => renderWithSession(<InLanguage language="id"><DataUploadPage /></InLanguage>, { me });

  it('P18.10-T4 reads the month in Indonesian: its toolbar, lock, legend, table and history, the headings kept', async () => {
    stubFetch({
      ...routes(month([withApe(), budi()], 1)),
      '/kpm/data-upload/history': { body: { month: '2026-09', batches: [batch(), REVERTED] } },
    });
    inIndonesian();
    const table = await screen.findByRole('table', { name: 'Data untuk Sep 2026' });
    expect(screen.getByRole('heading', { level: 1, name: /^Data upload/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Unduh template' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unduh CSV' })).toBeInTheDocument();
    expect(screen.getByLabelText('+ Unggah template yang sudah diisi')).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('Bulan')).toHaveValue('2026-09');
    expect(screen.getByRole('button', { name: 'Terbuka untuk impor dan koreksi sampai 7 Okt 2026, lalu terkunci.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kunci bulan' })).toBeInTheDocument();
    expect(screen.getByText('1 dari 2 anggota memiliki angka untuk bulan ini.')).toBeInTheDocument();
    expect(screen.getByText('Ketuk angka mana pun untuk mengoreksinya secara manual — tidak perlu mengunggah ulang untuk satu perbaikan.'))
      .toBeInTheDocument();
    // One head row since P19.2-T3, under the switch's *Bulan ini | YTD* (UI-139's words) — since P19.5-T2 the template's
    // columns by their Indonesian names (ADR-0214 §5: *the label is in the reader's language*).
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Agent', 'APE', 'Persistensi rolling (%)', 'Rekrutmen', 'Agen aktif baru', 'FYP', 'Jumlah polis (case issued)',
      'Unit persistency (%)', 'Aktif (MAA)',
    ]);
    expect(within(screen.getByRole('group', { name: 'Angka untuk' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Bulan ini', 'YTD']);
    expect(within(screen.getByRole('group', { name: 'Tampilkan anggota' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Semua2', 'Belum dilaporkan1', 'Dikoreksi0']);
    expect(screen.getByText('Terbuka sampai 7 Okt 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentang Data upload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Koreksi APE bulan ini untuk Rina Wijaya, sekarang Rp 1.500.000' })).toBeInTheDocument();
    expect(screen.getByText(/= APE atau polis > 0 bulan ini/)).toBeInTheDocument();
    // The history: who imported and reverted what, in Indonesian, the file's name as it is.
    expect(await screen.findByRole('heading', { name: 'Impor untuk Sep 2026' })).toBeInTheDocument();
    expect(screen.getByText('Diimpor oleh Wilson Tanoto pada 26 Sep 2026 · 6 agent, 72 angka · template v1')).toBeInTheDocument();
    expect(screen.getByText('Dikembalikan oleh Maya Halim pada 25 Sep 2026 — 96 angka dipulihkan.')).toBeInTheDocument();
    expect(screen.getByText('Berlaku')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembalikan' })).toBeInTheDocument();
    // The scan reads the screen at all, so a silent zero cannot pass.
    expect(englishOnly(dataUploadMessages).length).toBeGreaterThan(40);
    expect(document.body.textContent).toContain('Berlaku');
    expect(englishShown(document.body, englishOnly(dataUploadMessages))).toEqual([]);
  });

  it('P18.10-T4 corrects a figure in Indonesian, and says what changed', async () => {
    const correction = {
      membershipId: 'mem-rina', kode: 'APE', ytd: false, changed: true,
      before: { value: 150_000_000, provenance: 'imported' }, after: { value: 200_000_000, provenance: 'corrected' },
      state: state('2026-09', { revision: 4 }),
    };
    stubFetch({ ...routes(month([withApe()], 1)), '/kpm/data-upload/cell': { body: correction } });
    inIndonesian(CORRECTOR);
    fireEvent.click(await screen.findByRole('button', { name: 'Koreksi APE bulan ini untuk Rina Wijaya, sekarang Rp 1.500.000' }));
    const panel = screen.getByRole('region', { name: 'Koreksi APE bulan ini untuk Rina Wijaya' });
    expect(panel).toHaveTextContent('PRU-001 · Sep 2026 · Sekarang: Rp 1.500.000 (dari file perusahaan)');
    expect(within(panel).getByText('Disimpan bersama angkanya, dan di log audit.')).toBeInTheDocument();
    // Saved empty, with no reason: both refused on the fields they are about.
    fireEvent.change(within(panel).getByLabelText('Angka baru'), { target: { value: '' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Simpan koreksi' }));
    expect(within(panel).getByText('Ketik angka yang baru — untuk mengosongkannya, gunakan Hapus angka.')).toBeInTheDocument();
    expect(within(panel).getByText('Tuliskan mengapa angka ini dikoreksi.')).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText('Angka baru'), { target: { value: '2.000.000' } });
    fireEvent.change(within(panel).getByLabelText('Mengapa angka ini dikoreksi?'), { target: { value: 'Dikoreksi perusahaan' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Simpan koreksi' }));
    expect(await screen.findByText('APE bulan ini untuk Rina Wijaya dikoreksi: Rp 1.500.000 → Rp 2.000.000.')).toBeInTheDocument();
  });

  it('P18.10-T4 asks before a figure is cleared, in Indonesian', async () => {
    stubFetch(routes(month([withApe()], 1)));
    inIndonesian(CORRECTOR);
    fireEvent.click(await screen.findByRole('button', { name: 'Koreksi APE bulan ini untuk Rina Wijaya, sekarang Rp 1.500.000' }));
    const panel = screen.getByRole('region', { name: 'Koreksi APE bulan ini untuk Rina Wijaya' });
    fireEvent.change(within(panel).getByLabelText('Mengapa angka ini dikoreksi?'), { target: { value: 'Salah unggah' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Hapus angka' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Hapus APE bulan ini untuk Rina Wijaya di Sep 2026? Angkanya dikosongkan');
    expect(within(dialog).getByRole('button', { name: 'Hapus angka' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
  });

  it('P18.10-T4 previews a filled file in Indonesian: the summary, what is not taken, and the diff', async () => {
    stubFetch({ ...routes(month([rina(), budi()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    inIndonesian();
    fireEvent.change(await screen.findByLabelText('+ Unggah template yang sudah diisi'), { target: { files: [csvFile()] } });
    expect(await screen.findByRole('heading', { name: '2 agent siap diimpor, 1 baris dilewati.' })).toBeInTheDocument();
    expect(screen.getByText(/^Dari “filled\.csv”\. Angka: 1 baru · 1 berubah · 0 sudah sama dengan yang tersimpan · 21 dibiarkan kosong/))
      .toHaveTextContent('4 anggota aktif tidak ada di file dan tetap dengan angkanya.');
    expect(screen.getByText('Belum ada yang disimpan.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tidak diambil (2)' })).toBeInTheDocument();
    expect(screen.getByText('Baris 2 · PRU-001 · Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('Baris 4 · PRU-999')).toBeInTheDocument();
    const diff = screen.getByRole('table', { name: 'Yang akan diubah oleh “filled.csv”' });
    expect(within(diff).getByText('di file tertulis “Sari D.”')).toBeInTheDocument();
    expect(within(diff).getByText('dibaca dari “88213”')).toBeInTheDocument();
    expect(within(diff).getByText('sebelumnya Rp 1.000.000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konfirmasi impor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
  });

  it('P18.10-T4 opens an agent’s figures on a phone in Indonesian, each field named as a sentence names it', async () => {
    atWidth(375);
    stubFetch(routes(month([withApe(), budi()], 1)));
    inIndonesian();
    await screen.findByRole('list', { name: 'Data untuk Sep 2026' });
    // The row's › says a tap opens the figures (P19.2-T3); Budi's grey pill says nothing is reported.
    expect(screen.getByText('Belum dilaporkan', { selector: '[data-tone]' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi angka Rina Wijaya' }));
    const sheet = screen.getByRole('dialog', { name: 'Koreksi angka Rina Wijaya' });
    expect(within(sheet).getByLabelText('APE bulan ini')).toHaveValue('1.500.000');
    expect(within(sheet).getByLabelText('Persistensi rolling bulan ini')).toHaveValue('');
    // P19.5-T2 (R4): a summed year to date is no field.
    expect(within(sheet).queryByLabelText('FYP sejak awal tahun')).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Simpan koreksi' })).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Mengapa angka ini dikoreksi?')).toBeInTheDocument();
  });
});

/**
 * **P19.3-T2 — Data upload on the month the Overview names, and the leader rows' *Unit Persistency (%)*** (AC-7; UI-150,
 * the route registry's `?month=YYYY-MM`; T1's AC-6, ADR-0201 §2, which T2 draws on the screen).
 */
describe('P19.3-T2 Data upload: ?month= and Unit Persistency (%)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-03T03:00:00Z')); });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/kpm/data-upload');
  });

  const monthCalls = (calls: { url: string }[]) => calls
    .map((c) => /\/kpm\/data-upload\/(\d{4}-\d{2})$/.exec(c.url)?.[1]).filter(Boolean);

  it('P19.3-T2 AC-7 Overview case 8: /kpm/data-upload?month=2026-10 opens on October, and the office’s zone does not move it', async () => {
    window.history.replaceState({}, '', '/kpm/data-upload?month=2026-10');
    const { calls } = stubFetch({
      ...routes(month([rina()], 0, '2026-10', state('2026-10', { editableUntil: '2026-11-07' })), template('2026-10')),
      '/kpm/settings/branch-info': { body: { timezone: 'Asia/Jakarta' } },
    });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByRole('table', { name: 'Data for Oct 2026' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Month')).toHaveValue('2026-10'));
    expect(monthCalls(calls).at(-1)).toBe('2026-10');
  });

  it('P19.3-T2 AC-7 a month in the address that is locked falls back to the page’s own default', async () => {
    window.history.replaceState({}, '', '/kpm/data-upload?month=2026-01');
    stubFetch({
      '/kpm/data-upload/2026-01': { body: month([rina()], 0, '2026-01', state('2026-01', { locked: true, reason: 'schedule', editableUntil: '2026-02-07' })) },
      '/kpm/data-upload/2026-11': { body: month([rina()], 0, '2026-11', state('2026-11', { editableUntil: '2026-12-07' })) },
      '/kpm/data-upload/template': { body: template('2026-11') },
      '/kpm/data-upload/history': { body: { month: '2026-11', batches: [] } },
      '/kpm/settings/branch-info': { body: { timezone: 'Asia/Jakarta' } },
    });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await waitFor(() => expect(screen.getByLabelText('Month')).toHaveValue('2026-11'));
    expect(await screen.findByRole('table', { name: 'Data for Nov 2026' })).toBeInTheDocument();
  });

  it('P19.3-T2 AC-7 an address month that is no month is ignored', async () => {
    window.history.replaceState({}, '', '/kpm/data-upload?month=2026-13');
    stubFetch({
      ...routes(month([rina()], 0, '2026-11', state('2026-11')), template('2026-11')),
      '/kpm/settings/branch-info': { body: { timezone: 'Asia/Jakarta' } },
    });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await waitFor(() => expect(screen.getByLabelText('Month')).toHaveValue('2026-11'));
  });

  it('P19.3-T2 (T1 AC-6): a leader’s row shows its uploaded Unit Persistency (%); an agent’s reads —', async () => {
    const agus = {
      membershipId: 'mem-agus', agentCode: 'PRU-010', name: 'Agus Prasetyo', metrics: blank(),
      unitPersistency: { value: 87.5, provenance: 'imported' }, leader: true,
    };
    stubFetch(routes(month([agus, { ...rina(), unitPersistency: empty, leader: false }], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table', { name: 'Data for Sep 2026' });
    // *Since P19.5-T2* a column of the template like any other, `rows: 'leaders'` (ADR-0214 §2).
    const leaderCell = within(table).getByText('Agus Prasetyo').closest('tr')!.querySelector('[data-kode="UNIT_PERSISTENCY"]')!;
    expect(leaderCell).toHaveTextContent('87.5%');
    const agentCell = within(table).getByText('Rina Wijaya').closest('tr')!.querySelector('[data-kode="UNIT_PERSISTENCY"]')!;
    expect(within(agentCell as HTMLElement).getByLabelText('nothing reported')).toHaveTextContent('—');
  });

  it('P19.3-T2 (T1 AC-6): the preview shows a version 2 file’s unitPersistency cell, and — where the row has none', async () => {
    vi.setSystemTime(new Date('2026-09-20T03:00:00Z'));
    // A version 2 file: version 1's six and *Unit Persistency (%)*, read as the template's `UNIT_PERSISTENCY` (P19.5-T2).
    const v2 = {
      ...PREVIEW,
      templateVersion: 2,
      columns: V2_FILE_COLUMNS,
      rows: PREVIEW.rows.map((row, i) => (row.status === 'refused' ? row : {
        ...row,
        cells: i === 0
          ? [...row.cells, { kode: 'UNIT_PERSISTENCY', ytd: false, status: 'new', before: null, after: 90, raw: '90', correction: null }]
          : [...row.cells, { kode: 'UNIT_PERSISTENCY', ytd: false, status: 'not_provided', before: null, after: null, raw: null, correction: null }],
      })),
    };
    stubFetch({ ...routes(month([rina()])), '/kpm/data-upload/preview': { body: v2 } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();
    const preview = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const header = within(preview).getByRole('columnheader', { name: 'Unit persistency (%)' });
    const rinaRow = within(preview).getByText('Rina Wijaya').closest('tr')!;
    const last = within(rinaRow).getAllByRole('cell').at(-1)!;
    expect((last.getAttribute('headers') ?? '').split(' ')).toContain(header.id);
    expect(last).toHaveTextContent('90%');
    const sariRow = within(preview).getByText('Sari Dewi').closest('tr')!;
    expect(within(sariRow).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });
});

/**
 * **P19.5-T2 — Data upload from the template** (ADR-0214 §5, §8, §10 to §12; the Advanced analytics spec §4, R2, R4, R5,
 * D8; AA UI-010, UI-012, UI-013, UI-016, UI-025; the template mockup's *Lihat sisi KPM → Data upload*). The screen draws
 * what the month read says: the template's columns, the years to date summed and *Belum lengkap*, the months from the
 * required history on, *Belum terdaftar*, *Di luar batas sejak v<n>* and the current month's *as of*.
 */
describe('P19.5-T2 Data upload from the template', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetLanguage(); });

  const ALL = makeMe({ membership, permissions: [...EVERYTHING.permissions, 'data_upload:correct_cell'] });
  const NOV = (over: Record<string, unknown> = {}) => state('2026-11', { editableUntil: '2026-12-07', ...over });
  const withMonth = (view: unknown) => ({
    '/kpm/data-upload/': { body: view },
    '/kpm/data-upload/template': { body: template('2026-11') },
    '/kpm/data-upload/history': { body: { month: '2026-11', batches: [] } },
  });
  /** Rina with APE this month and its year to date; the leader Agus with a unit persistency of 105, flagged. */
  const RINA = rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000), ytd: cell(900_000_000) } }, monthlyActiveAgent: true });
  const monthTable = () => screen.findByRole('table', { name: 'Data for Nov 2026' });

  it('P19.5-T2 AC-4, AT-1 draws the template’s columns — a column before its start month reads —, Berlaku mulai on its tooltip', async () => {
    atWidth(1280);
    const view = viewOf([RINA], 1, '2026-11', NOV(), { config: configOf({ columns: [...V1_COLUMNS, FYC_FROM_DEC] }) });
    stubFetch(withMonth(view));
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table', { name: 'Data untuk Nov 2026' });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toContain('Komisi tahun pertama');
    const fyc = within(table).getByText('Rina Wijaya').closest('tr')!.querySelector('[data-kode="FYC"] [data-not-in-force]')!;
    expect(fyc).toHaveTextContent('—');
    expect(fyc).toHaveAttribute('title', 'Berlaku mulai Des 2026');
    // The banner names the template and how many columns, and what a greyed YTD is (the mockup's KPM side).
    expect(screen.getByText(/^Kolom mengikuti Prudential template v1\./).closest('p')).toHaveTextContent(
      'Kolom mengikuti Prudential template v1. 8 kolom per agen. Kolom YTD yang abu-abu dihitung otomatis dari bulan-bulan sebelumnya, jadi tidak perlu diunggah.',
    );
  });

  it('P19.5-T2 AC-7, AT-6, AA UI-012 draws a year to date missing a month as Belum lengkap — the cell and the page’s banner', async () => {
    atWidth(1280);
    const columns = V1_COLUMNS.map((c) => (c.ytd === 'sum' ? { ...c, ytdMissingMonths: ['2026-03'] } : c));
    const view = viewOf([RINA], 1, '2026-11', NOV(), { config: configOf({ columns }), ytdMissingMonths: ['2026-03'] });
    stubFetch(withMonth(view));
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    await screen.findByRole('table', { name: 'Data untuk Nov 2026' });
    expect(screen.getByText('YTD belum lengkap: Mar 2026 belum diunggah.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const ape = screen.getByText('Rina Wijaya').closest('tr')!.querySelector('[data-kode="APE"] [data-ytd]')!;
    expect(ape).toHaveAttribute('data-ytd', 'incomplete');
    expect(ape).toHaveAttribute('title', 'Belum lengkap · Mar belum diunggah');
    // The partial sum is still the figure, said with its words for a screen reader.
    expect(ape).toHaveTextContent('Rp 9.000.000, Belum lengkap · Mar belum diunggah');
    expect(ape.className).toEqual(expect.stringContaining('bg-pill-amber'));
  });

  it('P19.5-T2 AC-7 draws a complete summed year to date greyed, and none of it as a control', async () => {
    atWidth(1280);
    stubFetch(withMonth(viewOf([RINA], 1, '2026-11', NOV())));
    renderWithSession(<DataUploadPage />, { me: ALL });
    await monthTable();
    expect(screen.queryByText(/^YTD incomplete/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    const ape = screen.getByText('Rina Wijaya').closest('tr')!.querySelector('[data-kode="APE"] [data-ytd]')!;
    expect(ape).toHaveAttribute('data-ytd', 'calculated');
    expect(ape.className).toEqual(expect.stringContaining('bg-hover-row'));
    expect(ape.closest('button')).toBeNull();
  });

  it('P19.5-T2 AC-7 corrects an uploaded year to date as { kode, ytd: true }', async () => {
    atWidth(1280);
    const komisi = { ...RINA, metrics: { ...RINA.metrics, KOMISI: { monthly: cell(30_000_000), ytd: cell(86_000_000) } } };
    const view = viewOf([komisi], 1, '2026-11', NOV(), { config: configOf({ columns: [...V1_COLUMNS, KOMISI] }) });
    const { calls } = stubFetch({
      ...withMonth(view),
      '/kpm/data-upload/cell': {
        body: {
          membershipId: 'mem-rina', kode: 'KOMISI', ytd: true, changed: true,
          before: { value: 86_000_000, provenance: 'imported' }, after: { value: 90_000_000, provenance: 'corrected' },
          state: NOV({ revision: 4 }),
        },
      },
    });
    renderWithSession(<DataUploadPage />, { me: ALL });
    await monthTable();
    fireEvent.click(screen.getByRole('button', { name: 'YTD' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correct Commission year to date for Rina Wijaya, now IDR 860,000' }));
    const panel = screen.getByRole('region', { name: 'Correct Commission year to date for Rina Wijaya' });
    fireEvent.change(within(panel).getByLabelText('New figure'), { target: { value: '900.000' } });
    fireEvent.change(within(panel).getByLabelText('Why is it being corrected?'), { target: { value: 'Carrier restated it' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));
    expect(await screen.findByText('Corrected Commission year to date for Rina Wijaya: IDR 860,000 → IDR 900,000.')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.url.includes('/kpm/data-upload/cell'))!.init.body as string)).toEqual({
      month: '2026-11', membershipId: 'mem-rina', kode: 'KOMISI', ytd: true, value: 90_000_000, revision: 3, reason: 'Carrier restated it',
    });
  });

  it('P19.5-T2 AC-11, AA UI-025 outlines a stored value outside its column’s limits: Di luar batas sejak v2', async () => {
    atWidth(1280);
    const agus = {
      membershipId: 'mem-agus', agentCode: 'PRU-010', name: 'Agus Prasetyo', leader: true, metrics: blank(),
      unitPersistency: { value: 105, provenance: 'corrected' as const, outOfBounds: { sinceVersion: 2 } },
    };
    stubFetch(withMonth(viewOf([agus], 1, '2026-11', NOV())));
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    const table = await screen.findByRole('table', { name: 'Data untuk Nov 2026' });
    const flagged = within(table).getByText('Agus Prasetyo').closest('tr')!.querySelector('[data-out-of-bounds]')!;
    expect(flagged).toHaveAttribute('title', 'Di luar batas sejak v2');
    expect(flagged.className).toEqual(expect.stringContaining('outline-alert'));
    // The value is the stored one, never changed; the words are on the cell for a screen reader.
    expect(flagged).toHaveTextContent('105%, Di luar batas sejak v2');
  });

  it.each([375, 1280])('P19.5-T2 AC-5 at %ipx lists the Belum terdaftar rows after the members, read-only, and says how many', async (px) => {
    atWidth(px);
    const view = viewOf([RINA], 1, '2026-11', NOV(), {
      unregistered: [{
        agentCode: '70019999', fileName: 'Calon Baru',
        values: { APE: { value: 50_000_000, provenance: 'imported', correction: null } }, ytd: {},
      }],
    });
    stubFetch(withMonth(view));
    renderInIndonesian(<DataUploadPage />, { me: ALL });
    await screen.findByText('Rina Wijaya');
    // A table row from 1024px, a list row below it (`data-row="held:<code>"`).
    const held = document.querySelector('[data-unregistered="70019999"], [data-row="held:70019999"]')!;
    expect(held).toHaveTextContent('Belum terdaftar');
    expect(held).toHaveTextContent('70019999');
    // Read-only: it opens nothing and corrects nothing — it is nobody's yet.
    expect(within(held as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('1 kode belum terdaftar: disimpan terpisah dan tidak dihitung sampai kode itu dipakai anggota KPM ini.')).toBeInTheDocument();
  });

  it('P19.5-T2 AC-8, AT-9, AA UI-016 offers the months from the required history on, each as complete or not, and picks one', async () => {
    atWidth(1280);
    const months = [
      statusOf('2026-03', 'missing'), statusOf('2026-04', 'incomplete'), statusOf('2026-10'), statusOf('2026-11', 'missing'),
    ];
    const { calls } = stubFetch({
      ...withMonth(viewOf([RINA], 1, '2026-11', NOV(), { config: configOf({ historyFrom: '2026-03' }), months })),
      '/kpm/data-upload/2026-03': { body: viewOf([RINA], 0, '2026-03', state('2026-03'), { months }) },
    });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    await screen.findByRole('table', { name: 'Data untuk Nov 2026' });
    const grid = document.querySelector('[data-month-status]') as HTMLElement;
    expect(within(grid).getByText(/^Data wajib mulai Mar 2026/)).toHaveTextContent('Data wajib mulai Mar 2026 · 3 belum lengkap');
    const pills = within(grid).getAllByRole('button');
    expect(pills.map((b) => b.textContent)).toEqual([
      'Mar 2026Belum diunggah', 'Apr 2026Belum lengkap', 'Okt 2026Lengkap', 'Nov 2026Belum diunggah',
    ]);
    expect(pills[3]).toHaveAttribute('aria-current', 'true');
    fireEvent.click(pills[0]);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/kpm/data-upload/2026-03'))).toBe(true));
    expect(screen.getByLabelText('Bulan')).toHaveValue('2026-03');
  });

  it('P19.5-T2 AC-8 says a never-written month of the history is open until its first upload', async () => {
    stubFetch(withMonth(viewOf([RINA], 0, '2026-03', state('2026-03', { reason: 'history', editableUntil: '2026-11-12' }))));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByRole('button', {
      name: 'A required month that was never uploaded: open until its first upload — uploaded today, it stays open until 12 Nov 2026.',
    })).toBeInTheDocument();
  });

  it('P19.5-T2 AC-9, D8 shows the current month’s as of day, and sends one with an upload into it', async () => {
    atWidth(1280);
    const preview = { ...PREVIEW, month: '2026-11' };
    const { calls } = stubFetch({
      ...withMonth(viewOf([rina(), budi()], 1, '2026-11', NOV({ asOf: '2026-11-03' }))),
      '/kpm/data-upload/preview': { body: preview },
      '/kpm/data-upload/commit': { status: 201, body: result({ month: '2026-11', asOf: '2026-11-04' }, NOV({ revision: 4 })) },
    });
    renderInIndonesian(<DataUploadPage />, { me: EVERYTHING });
    expect(await screen.findByText('per 3 Nov 2026')).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText('+ Unggah template yang sudah diisi'), { target: { files: [csvFile()] } });
    const asOf = await screen.findByLabelText('Data per tanggal');
    expect(asOf).toHaveValue('2026-11-05');
    expect(asOf).toHaveAttribute('min', '2026-11-01');
    expect(asOf).toHaveAttribute('max', '2026-11-05');
    fireEvent.change(asOf, { target: { value: '2026-11-04' } });
    fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi impor' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/commit'))).toBe(true));
    expect((calls.find((c) => c.url.includes('/commit'))!.init.body as FormData).get('asOf')).toBe('2026-11-04');
  });

  it('P19.5-T2 AC-9 sends no as of day with a month that has ended — its upload is final', async () => {
    const { calls } = stubFetch({
      ...withMonth(viewOf([rina(), budi()], 1, '2026-10', state('2026-10', { editableUntil: '2026-11-07' }))),
      '/kpm/data-upload/2026-11': { body: viewOf([rina(), budi()], 1, '2026-10', state('2026-10', { editableUntil: '2026-11-07' })) },
      '/kpm/data-upload/preview': { body: { ...PREVIEW, month: '2026-10' } },
      '/kpm/data-upload/commit': { status: 201, body: result({ month: '2026-10' }) },
    });
    window.history.replaceState({}, '', '/kpm/data-upload?month=2026-10');
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await choose();
    await screen.findByRole('region');
    expect(screen.queryByLabelText('Figures as of')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/commit'))).toBe(true));
    expect((calls.find((c) => c.url.includes('/commit'))!.init.body as FormData).get('asOf')).toBeNull();
    window.history.replaceState({}, '', '/kpm/data-upload');
  });

  it('P19.5-T2 AC-3, AT-3, AA UI-013 lists what the header says about the file’s columns — a missing one in amber', async () => {
    const preview = {
      ...PREVIEW,
      month: '2026-11',
      notes: [
        { code: 'column_missing', kode: 'FYC', header: null, message: 'Kolom Komisi tahun pertama kosong di file ini. Baris tetap diimpor.' },
        { code: 'column_retired', kode: 'APE', header: 'APE (Rp M) — YTD', message: 'Kolom APE YTD tidak dipakai lagi' },
      ],
    };
    stubFetch({ ...withMonth(viewOf([rina(), budi()], 1, '2026-11', NOV())), '/kpm/data-upload/preview': { body: preview } });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    fireEvent.change(await screen.findByLabelText('+ Unggah template yang sudah diisi'), { target: { files: [csvFile()] } });
    const missing = await screen.findByText('Kolom Komisi tahun pertama kosong di file ini. Baris tetap diimpor.');
    expect(missing).toHaveAttribute('data-note', 'column_missing');
    expect(missing.className).toEqual(expect.stringContaining('text-pill-amber-ink'));
    expect(screen.getByText('Kolom APE YTD tidak dipakai lagi')).toHaveAttribute('data-note', 'column_retired');
  });

  it('P19.5-T2 AC-5 previews a held row as Belum terdaftar and names a correction on it held:<CODE>:KODE', async () => {
    const held = {
      line: 5, agentCode: '70019999', membershipId: null, resolvedAgentCode: null, name: null, fileName: 'Calon Baru',
      nameDiffers: false, codeRecovered: false, status: 'held', issues: [],
      cells: cellsOf({ ape: { status: 'new', after: 50_000_000, raw: '0,5' } }),
    };
    const preview = {
      ...PREVIEW, month: '2026-11', rows: [...PREVIEW.rows, held], summary: { ...PREVIEW.summary, rows: 4, held: 1 },
    };
    stubFetch({ ...withMonth(viewOf([rina(), budi()], 1, '2026-11', NOV())), '/kpm/data-upload/preview': { body: preview } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();
    const card = await screen.findByRole('region');
    expect(card).toHaveTextContent('1 row of a code not registered yet, kept as Not registered.');
    const table = within(card).getByRole('table', { name: 'What “filled.csv” would change' });
    const row = within(table).getByText('70019999').closest('tr')!;
    expect(row).toHaveTextContent('Not registered');
    expect(row).toHaveTextContent('IDR 500,000');
    expect(correctionKey({ status: 'held', membershipId: null, agentCode: ' 70019999 ' }, { kode: 'APE', ytd: false })).toBe('held:70019999:APE');
    expect(correctionKey({ status: 'ready', membershipId: 'mem-rina', agentCode: 'PRU-001' }, { kode: 'KOMISI', ytd: true })).toBe('mem-rina:KOMISI_YTD');
  });

  it('P19.5-T2 AC-12, R6 names the template version each import was read against, and a running month’s as of', async () => {
    stubFetch({
      ...withMonth(viewOf([rina()], 1, '2026-11', NOV())),
      '/kpm/data-upload/history': { body: { month: '2026-11', batches: [batch({ month: '2026-11', templateVersion: 2, asOf: '2026-11-03', heldRowCount: 1 })] } },
    });
    renderInIndonesian(<DataUploadPage />, { me: EVERYTHING });
    expect(await screen.findByText(/^Diimpor oleh Wilson Tanoto/)).toHaveTextContent(
      'Diimpor oleh Wilson Tanoto pada 26 Sep 2026 · 6 agent, 72 angka · template v2 · per 3 Nov 2026 · 1 belum terdaftar',
    );
  });
});
