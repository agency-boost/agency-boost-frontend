import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import {
  atWidth, browserChose, digestAt, InLanguage, makeMe, renderWithLanguage, renderWithSession, resetLanguage, stubFetch, wears,
} from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
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
const month = (rows: unknown[], withData = 0, m = '2026-09', st: unknown = state(m)) => ({ month: m, rows, withData, state: st });

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

  describe('the template (P9-T2)', () => {
    const link = () => screen.findByRole('link', { name: 'Download template' });
    const templateCalls = (calls: { url: string }[]) =>
      calls.filter((c) => c.url.includes('/kpm/data-upload/template'));

    it('offers the file as a download named for the office and the month', async () => {
      stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: OWNER });

      const a = await link();
      expect(a).toHaveAttribute('download', 'KPM0417-agent-data-Sep-2026.csv');
      // The prototype's ⬇ is drawn and kept out of the name, as on the Summary's Download (ADR-0068).
      expect(a).toHaveTextContent('⬇Download template');
      expect(a.querySelector('[aria-hidden="true"]')).toHaveTextContent('⬇');
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
      expect(screen.queryByRole('link', { name: 'Download template' })).not.toBeInTheDocument();
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
      expect(screen.queryByRole('link', { name: 'Download template' })).not.toBeInTheDocument();
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
      expect(screen.queryByRole('link', { name: 'Download template' })).not.toBeInTheDocument();
    });

    it('shows the table and not the control to somebody who may read and may not download', async () => {
      const { calls } = stubFetch(routes(month([rina()])));
      renderWithSession(<DataUploadPage />, { me: READER });

      await screen.findByText('Rina Wijaya');
      expect(screen.queryByRole('link', { name: 'Download template' })).not.toBeInTheDocument();
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
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('This Month');
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
    // Budi: twelve dashes, none of them a zero.
    expect(within(budiRow).getAllByLabelText('nothing reported')).toHaveLength(12);
    expect(within(budiRow).queryByText('IDR 0')).not.toBeInTheDocument();
  });

  it('formats money as rupiah in full, not as the file’s Rp M', async () => {
    stubFetch(routes(
      month([rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000_00), ytd: empty } } })], 1),
    ));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    expect(await screen.findByText('IDR 150,000,000')).toBeInTheDocument();
  });

  it('P18.97-T3 AC-2, AC-3 keeps the file’s own figures as filed: money to the rupiah, a persistency’s every place and no ,0', async () => {
    // Data upload's cells are where precision matters (ADR-0174 §3, §4): never *Rp 5,7 M*, never *87%* for 87,35.
    stubFetch(routes(month([rina({
      metrics: {
        ...blank(),
        ape: { monthly: cell(5_672_500_000_00), ytd: empty },
        persistency: { monthly: cell(87.35), ytd: cell(90) },
      },
    })], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const row = (await screen.findAllByRole('row')).find((r) => within(r).queryByText('Rina Wijaya'))!;
    expect(within(row).getByText('IDR 5,672,500,000')).toBeInTheDocument();
    expect(within(row).getByText('87.35%')).toBeInTheDocument();
    expect(within(row).getByText('90%')).toBeInTheDocument();
    expect(within(row).queryByText(/,0%/)).not.toBeInTheDocument();
  });

  it('P18.97-T3 AC-2, AC-3 writes the correction panel’s and its confirmation’s figures as the cells do', () => {
    expect(showFigure('ape', 5_672_500_000_00, 'id')).toBe('Rp 5.672.500.000');
    expect(showFigure('persistency', 87.35, 'id')).toBe('87,35%');
    expect(showFigure('persistency', 87, 'id')).toBe('87%');
    expect(showFigure('policyCount', 3, 'id')).toBe('3');
    expect(showFigure('persistency', null, 'id')).toBe('nothing reported');
  });

  it('P18.98-T3 AC-4 writes the file’s figures in full in the reader’s language, the same figure in each', () => {
    expect(showFigure('ape', 5_672_500_000_00, 'en')).toBe('IDR 5,672,500,000');
    expect(showFigure('persistency', 87.35, 'en')).toBe('87.35%');
    expect(showFigure('persistency', 87, 'en')).toBe('87%');
    expect(showFigure('policyCount', 1_250, 'en')).toBe('1,250');
    expect(showFigure('policyCount', 1_250, 'id')).toBe('1.250');
  });

  it('says so when nothing has been uploaded, and still lists everybody', async () => {
    stubFetch(routes(month([rina(), budi()], 0)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    // Wait for the table: the loading skeleton is itself a live region, and `findByRole` resolves
    // on the first match. The two never coexist, which is why a screen has exactly one `status`.
    await screen.findByText('Rina Wijaya');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has been uploaded for Sep 2026 yet');
    expect(screen.getAllByRole('row')).toHaveLength(4); // two heading rows + two members
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

const METRICS = ['ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount'] as const;
/** Twelve cells, not provided unless given, keyed `metric.cadence`. */
const cells = (given: Record<string, Partial<{ status: string; before: number | null; after: number | null; raw: string }>> = {}) =>
  (['monthly', 'ytd'] as const).flatMap((cadence) => METRICS.map((metric) => ({
    metric, cadence, status: 'not_provided', before: null, after: null, raw: null,
    ...given[`${metric}.${cadence}`],
  })));

const PREVIEW_REVISION = 3;
const PREVIEW = {
  month: '2026-09',
  filename: 'filled.csv',
  templateVersion: 1,
  encoding: 'utf-8',
  delimiter: ';',
  revision: PREVIEW_REVISION,
  summary: {
    rows: 3, ready: 2, refused: 1, newCells: 1, changedCells: 1, unchangedCells: 0,
    notProvidedCells: 21, refusedCells: 1, notInFile: 4,
  },
  rows: [
    {
      line: 2, agentCode: 'PRU-001', membershipId: 'mem-rina', resolvedAgentCode: 'PRU-001', name: 'Rina Wijaya',
      fileName: 'Rina Wijaya', nameDiffers: false, codeRecovered: false, status: 'ready',
      issues: [{
        code: 'UPLOAD_VALUE_OUT_OF_RANGE', metric: 'persistency', cadence: 'monthly',
        message: 'Rolling Persistency (%) — This Month: “140” is above 100 — persistency is a percentage.',
      }],
      cells: cells({
        'ape.monthly': { status: 'new', after: 150_000_000, raw: '1,5' },
        'ape.ytd': { status: 'changed', before: 100_000_000, after: 600_000_000, raw: '6' },
        'persistency.monthly': { status: 'refused', raw: '140' },
      }),
    },
    {
      line: 3, agentCode: '88213', membershipId: 'mem-sari', resolvedAgentCode: '00088213', name: 'Sari Dewi',
      fileName: 'Sari D.', nameDiffers: true, codeRecovered: true, status: 'ready', issues: [], cells: cells(),
    },
    {
      line: 4, agentCode: 'PRU-999', membershipId: null, resolvedAgentCode: null, name: null,
      fileName: 'Nobody', nameDiffers: false, codeRecovered: false, status: 'refused', cells: [],
      issues: [{ code: 'UPLOAD_UNKNOWN_AGENT_CODE', metric: null, cadence: null, message: 'No active member of this office has this code.' }],
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
    // The month table's order (P13.1-T7): name, code, this month's six from [2], the year's from [8].
    expect(cellsOf[2]).toHaveTextContent('IDR 1,500,000');
    expect(cellsOf[8]).toHaveTextContent('IDR 6,000,000');
    expect(cellsOf[8]).toHaveTextContent('was IDR 1,000,000');
    expect(cellsOf[3]).toHaveTextContent('✕ 140 — not taken');
    expect(within(cellsOf[9]).getByLabelText('left blank')).toHaveTextContent('—');
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
      expect(await screen.findByText('Open for imports and corrections until 7 Oct 2026, when it locks.')).toBeInTheDocument();
    });

    it.each([
      [{ locked: true, reason: 'schedule', editableUntil: '2026-09-07' }, 'Locked — its window closed after 7 Sep 2026. Reopen it to change its figures.'],
      [{ locked: true, reason: 'locked_by_hand', changedBy: 'Maya Halim', changedAt: '2026-09-20T03:00:00.000Z' }, 'Locked by Maya Halim on 20 Sep 2026. Reopen it to change its figures.'],
      [{ locked: false, reason: 'reopened', changedBy: 'Wilson Tanoto', changedAt: '2026-09-21T03:00:00.000Z' }, 'Reopened by Wilson Tanoto on 21 Sep 2026. It stays open until somebody locks it again.'],
    ])('says why: %j', async (over, sentence) => {
      stubFetch(everything({ '/kpm/data-upload/': { body: month([rina()], 1, '2026-09', state('2026-09', over)) } }));
      renderWithSession(<DataUploadPage />, { me: EVERYTHING });
      expect(await screen.findByText(sentence)).toBeInTheDocument();
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
      expect(screen.queryByRole('button', { name: /month$/ })).not.toBeInTheDocument();
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
    membershipId: 'mem-rina', metric: 'ape', cadence: 'monthly', changed: true,
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
    expect(screen.getByRole('button', { name: 'Correct FYP year to date for Rina Wijaya, now nothing reported' })).toBeInTheDocument();
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
      month: '2026-09', membershipId: 'mem-rina', metric: 'ape', cadence: 'monthly',
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
    const { calls } = stubFetch({ ...routes(month([withApe()], 1)), '/kpm/data-upload/cell': { body: correction({ metric: 'persistency' }) } });
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
        'ape.monthly': {
          status: 'changed', before: 200_000_000, after: 150_000_000, raw: '1,5',
          correction: { by: 'Maya Halim', at: '2026-09-26T03:00:00.000Z', reason: 'Carrier restated it', replacedValue: 150_000_000 },
        } as never,
        'fyp.monthly': { status: 'changed', before: 50_000_000, after: 60_000_000, raw: '0,6' },
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
    expect(form.get('replace')).toBe('mem-rina:apeMonthly');
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
      rows: [{ ...CONFLICTED.rows[0], cells: CONFLICTED.rows[0].cells.map((c) => (c.metric === 'fyp' ? { ...c, status: 'not_provided', after: null } : c)) }],
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

  // *Amended 2026-10-28 (P18.97-T4 AC-2; UI-023):* the 45-word sentence is the client's one-line legend.
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

    expect(cells[2]).toHaveTextContent('IDR 2,000,000✎, corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”');
    expect(within(cells[2]).getByTitle('corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”')).toBeInTheDocument();
    // A carrier figure is plain.
    expect(cells[8]).toHaveTextContent('IDR 9,000,000');
    expect(cells[8]).not.toHaveTextContent('✎');
  });

  it('marks a figure emptied by hand apart from one nothing was ever reported for', async () => {
    stubFetch(routes(month([withCorrections()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const row = (await screen.findByText('Rina Wijaya')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[6]).toHaveTextContent('—✎, emptied by hand by Maya Halim on 26 Sep 2026 — “Belongs to October”');
    expect(within(cells[12]).getByLabelText('nothing reported')).toBeInTheDocument();
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

  // *Amended 2026-10-28 (P18.97-T4 AC-2; UI-023):* the column's sentence is the legend's third part, the client's words.
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

  const SIX = ['APE', 'Rolling Persistency (%)', 'Recruitment', 'New Active Agents', 'FYP', '# of Policy'];
  const monthTable = () => screen.findByRole('table', { name: 'Data for Sep 2026' });
  const texts = (els: HTMLElement[]) => els.map((el) => el.textContent);
  /** What a cell's `headers` attribute names, in order — what a screen reader says before the figure. */
  const headingsOf = (cell: HTMLElement) =>
    (cell.getAttribute('headers') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);

  it('AC-1: draws the head in two rows — Agent, Agent code, This Month over six, YTD over the same six, Active (MAA)', async () => {
    stubFetch(routes(month([rina(), budi()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const [groups, metrics] = within(await monthTable()).getAllByRole('row');
    const top = within(groups).getAllByRole('columnheader');
    expect(texts(top)).toEqual(['Agent', 'Agent code', 'This Month', 'YTD', 'Active (MAA)']);
    expect(top.map((th) => [th.getAttribute('rowspan'), th.getAttribute('colspan')])).toEqual([
      ['2', null], ['2', null], [null, '6'], [null, '6'], ['2', null],
    ]);
    expect(texts(within(metrics).getAllByRole('columnheader'))).toEqual([...SIX, ...SIX]);
  });

  it('AC-1: marks the groups as groups, over a real column group each', async () => {
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const table = await monthTable();
    const [groups] = within(table).getAllByRole('row');
    expect(within(groups).getByRole('columnheader', { name: 'This Month' })).toHaveAttribute('scope', 'colgroup');
    expect(within(groups).getByRole('columnheader', { name: 'YTD' })).toHaveAttribute('scope', 'colgroup');
    // Agent and code, this month's six, the year's six, and Active (MAA).
    expect([...table.querySelectorAll('colgroup')].map((g) => g.querySelectorAll('col').length)).toEqual([2, 6, 6, 1]);
  });

  it('AC-1: puts the name before the code, and names both headings on every figure — “This Month, APE”', async () => {
    stubFetch(routes(month([rina({
      metrics: { ...blank(), ape: { monthly: cell(150_000_000_00), ytd: cell(900_000_000_00) } },
    })], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const row = (await screen.findByText('Rina Wijaya')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(texts(cells.slice(0, 2))).toEqual(['Rina Wijaya', 'PRU-001']);
    expect(cells[2]).toHaveTextContent('IDR 150,000,000');
    expect(headingsOf(cells[2])).toEqual(['This Month', 'APE']);
    expect(cells[8]).toHaveTextContent('IDR 900,000,000');
    expect(headingsOf(cells[8])).toEqual(['YTD', 'APE']);
    expect(cells.slice(2, 14).map(headingsOf)).toEqual([
      ...SIX.map((m) => ['This Month', m]), ...SIX.map((m) => ['YTD', m]),
    ]);
  });

  it('AC-1: gives the preview the month table’s head and order, without Active (MAA)', async () => {
    stubFetch({ ...routes(month([rina(), budi()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await choose();

    const preview = await screen.findByRole('table', { name: 'What “filled.csv” would change' });
    const [groups, metrics] = within(preview).getAllByRole('row');
    expect(texts(within(groups).getAllByRole('columnheader'))).toEqual(['Agent', 'Agent code', 'This Month', 'YTD']);
    expect(texts(within(metrics).getAllByRole('columnheader'))).toEqual([...SIX, ...SIX]);
    const rinaRow = within(preview).getByText('Rina Wijaya').closest('tr')!;
    expect(headingsOf(within(rinaRow).getAllByRole('cell')[8])).toEqual(['YTD', 'APE']);
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

    const [, , ...rows] = within(await monthTable()).getAllByRole('row');
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Budi Santoso', 'Rina Wijaya']);
  });

  it('AC-3: runs the figures in the template’s order — each heading is the file’s, without its Rp M', async () => {
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });

    const row = (await screen.findByText('Rina Wijaya')).closest('tr')!;
    const screenOrder = within(row).getAllByRole('cell').slice(2, 14).map(headingsOf)
      .map(([group, metric]) => `${metric} — ${group}`);
    // `HEADER` is the backend's pinned version-1 header (`production-template.spec.ts`).
    expect(screenOrder).toEqual(HEADER.split(',').slice(2).map((h) => h.replace(' (Rp M)', '')));
  });
});

/**
 * **The intro and the legend, in the client's words** (P18.97-T4 AC-2, ADR-0176 §6; the client's KPM Owner review of
 * 2026-10-27, UI-023: *"APE ⓘ What is APE? , rolling persistency, …"*, and a 45-word legend). The intro is one sentence
 * with *APE*'s ⓘ after it; the legend is one line — the grey-text table's *Show* at every size.
 */
describe('P18.97-T4 AC-2 Data upload’s intro and legend', () => {
  afterEach(() => vi.unstubAllGlobals());

  const LEGEND = '✎ = corrected by hand · —a dash = not reported · Active = APE or policies > 0 this month';

  it('P18.97-T4 AC-2 reads the intro as one sentence, its ⓘ after the full stop and never inside it', async () => {
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const tip = await screen.findByRole('button', { name: 'What is APE?' });
    const intro = tip.closest('p')!;
    // The sentence, then the ⓘ's own name: nothing of the ⓘ between its words.
    expect(intro).toHaveTextContent(
      /^APE, rolling persistency, recruitment, new active agents, FYP and # of policy — one file per month, matched by agent code\. ⓘ\s*What is APE\?/,
    );
    expect(intro.lastElementChild!.contains(tip)).toBe(true);
  });

  it('P18.97-T4 AC-2 says the legend in one line of three parts, the dash spoken as a dash', async () => {
    stubFetch(routes(month([withCorrectionsRow()], 1)));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const legend = (await screen.findByText(/= corrected by hand/)).closest('p')!;
    expect(legend).toHaveTextContent(LEGEND);
    expect(legend.textContent).not.toMatch(/Figures are from|Derived, not entered|A dash until/);
    // Each part whole, so a narrow screen breaks the line between them and never inside one.
    expect(legend.querySelectorAll('.whitespace-nowrap')).toHaveLength(3);
    expect(within(legend).getByText('—')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([375, 767, 768, 1023, 1024, 1280])('P18.97-T4 AC-2 at %ipx shows the legend: no size takes it away', async (px) => {
    atWidth(px);
    stubFetch(routes(month([rina()])));
    renderWithSession(<DataUploadPage />, { me: OWNER });
    const legend = (await screen.findByText(/= corrected by hand/)).closest('p')!;
    expect(wears(legend, px).split(' ')).not.toContain('hidden');
    expect(legend).toHaveTextContent(LEGEND);
  });

  it('P18.97-T4 AC-10 says a template that could not be prepared without a code the browser made', async () => {
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
 * **The month on a phone: a card per agent, and an edit sheet** (P18.97-T7 AC-2, AC-6, ADR-0178 §4, §5; the client's
 * KPM Owner review of 2026-10-27, UI-034: the table, 1816px; UI-040: 340 tappable cells under 44px). Below 768px each
 * member is a card, and a tap opens a sheet of their twelve figures as labelled fields, each saved through the
 * unchanged `PATCH /kpm/data-upload/cell` with its reason. At 768px and wider the page it was, to the byte.
 */
describe('P18.97-T7 AC-2 Data upload on a phone (UI-034, UI-040)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const corrected = (value: number | null) => ({
    value, provenance: 'corrected' as const,
    correction: { by: 'Maya Halim', at: '2026-09-18T03:00:00Z', reason: 'Carrier restated it' },
  });
  /** Rina with a figure in every kind — money, a persistency, counts — one corrected by hand; Budi with nothing. */
  const RINA = rina({
    metrics: {
      ...blank(),
      ape: { monthly: cell(150_000_000), ytd: cell(900_000_000) },
      persistency: { monthly: cell(87.35), ytd: cell(86) },
      policyCount: { monthly: cell(2), ytd: corrected(11) },
    },
    monthlyActiveAgent: true,
  });
  const BUDI = { ...budi(), monthlyActiveAgent: null };

  /** Every grant the page has: the template, the upload, the history, the lock, and correcting a figure. */
  const ALL = makeMe({ membership, permissions: [...EVERYTHING.permissions, 'data_upload:correct_cell'] });
  const everything = (over: Record<string, unknown> = {}) => ({
    ...routes(month([RINA, BUDI], 1)),
    '/kpm/data-upload/history': { body: { month: '2026-09', batches: [batch(), REVERTED] } },
    ...over,
  });

  /** The page's markup on the build before P18.97-T7, rendered from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<768 | 1280, string> = {
    768: '28a6dd8b74be26ceef6a2d2633e320d79f66195773066049291f0348e0655809',
    1280: '28a6dd8b74be26ceef6a2d2633e320d79f66195773066049291f0348e0655809',
  };

  it.each([768, 1280] as const)('P18.97-T7 AC-2 at %ipx draws the month table and its controls as they were, to the byte', async (px) => {
    atWidth(px);
    stubFetch(everything());
    // As a reader who has chosen no language reads it while the switch is not live: the bytes are the page's as it was
    // before T7, when every figure was written in Indonesian and every word in English. It was rendered in Indonesian
    // (`InLanguage`) until P18.98-T4 moved the page's words, which an Indonesian screen now writes in Indonesian too.
    const { container } = renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });
    await screen.findByRole('table', { name: 'Data for Sep 2026' });
    await screen.findByRole('link', { name: 'Download template' });
    await screen.findByText(/KPM0417-agent-data-Sep-2026-corrected\.csv/);
    expect(digestAt(container, px)).toBe(BEFORE_T7[px]);
    resetLanguage();
  });

  /** The server's answer to one correction: what was there, what is now, the month one revision on. */
  const answer = ({ body }: { body: unknown }) => {
    const sent = body as { metric: 'ape' | 'persistency' | 'policyCount'; cadence: 'monthly' | 'ytd'; value: number | null; revision: number };
    const before = (RINA.metrics as Record<string, Record<string, { value: number | null }>>)[sent.metric][sent.cadence].value;
    return {
      body: {
        membershipId: 'mem-rina', metric: sent.metric, cadence: sent.cadence, changed: true,
        before: { value: before, provenance: 'imported' }, after: { value: sent.value, provenance: 'corrected' },
        state: state('2026-09', { revision: sent.revision + 1 }),
      },
    };
  };
  const cardsOf = () => screen.findByRole('list', { name: 'Data for Sep 2026' });
  const cardOf = (name: string) => screen.getByText(name, { selector: 'button, span' }).closest('li')!;
  const openSheet = async (name = 'Rina Wijaya') => {
    await cardsOf();
    fireEvent.click(screen.getByRole('button', { name: `Correct figures for ${name}` }));
    return screen.getByRole('dialog', { name: `Correct figures for ${name}` });
  };
  const patches = (calls: { url: string; init: RequestInit }[]) => calls
    .filter((c) => c.url.includes('/kpm/data-upload/cell'))
    .map((c) => JSON.parse(c.init.body as string));

  it.each([375, 767])('P18.97-T7 AC-2 at %ipx draws a card per agent and no table, each figure under its heading', async (px) => {
    atWidth(px);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    const cards = await cardsOf();
    expect(screen.queryByRole('table', { name: 'Data for Sep 2026' })).not.toBeInTheDocument();
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
    const rina = cardOf('Rina Wijaya');
    expect(rina).toHaveTextContent('PRU-001');
    // The table's two groups, each its six figures under their headings, in the table's order and formats.
    const month = within(rina).getByRole('group', { name: 'This Month' });
    expect([...month.querySelectorAll('dt')].map((dt) => dt.textContent))
      .toEqual(['APE', 'Rolling Persistency (%)', 'Recruitment', 'New Active Agents', 'FYP', '# of Policy']);
    expect([...month.querySelectorAll('dd')].map((dd) => dd.textContent))
      .toEqual(['IDR 1,500,000', '87.35%', '—', '—', '—', '2']);
    const ytd = within(rina).getByRole('group', { name: 'YTD' });
    expect(within(ytd).getByText('IDR 9,000,000')).toBeInTheDocument();
    // A figure corrected by hand keeps its ✎ and, for a screen reader, who, when and why.
    expect(ytd).toHaveTextContent('11✎');
    expect(ytd).toHaveTextContent('corrected by hand by Maya Halim on 18 Sep 2026 — “Carrier restated it”');
    expect(within(rina).getByRole('img', { name: 'Active' })).toBeInTheDocument();
    expect(within(cardOf('Budi Santoso')).getByRole('img', { name: 'Not reported' })).toBeInTheDocument();
    // On a phone the tap is the agent's, so the line says so.
    expect(screen.getByText('Tap an agent to correct their figures — no need to re-upload for a single fix.')).toBeInTheDocument();
  });

  it('P18.97-T7 AC-2 edits no cell on a phone: no figure is a control, the card is, and a reader’s card is neither', async () => {
    atWidth(375);
    stubFetch(everything());
    const { unmount } = renderWithSession(<DataUploadPage />, { me: ALL });
    await cardsOf();
    expect(screen.queryByRole('button', { name: /^Correct APE this month/ })).not.toBeInTheDocument();
    const name = screen.getByRole('button', { name: 'Correct figures for Rina Wijaya' });
    expect(name).toHaveAttribute('aria-haspopup', 'dialog');
    // Its tap covers the card, and the focus ring is drawn round the card.
    expect(name.className).toContain("after:absolute after:inset-0");
    expect(cardOf('Rina Wijaya').className).toContain('relative');
    unmount();

    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: EVERYTHING });
    await cardsOf();
    expect(screen.queryByRole('button', { name: /^Correct figures for/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap an agent/)).not.toBeInTheDocument();
  });

  it('P18.97-T7 AC-2 holds a locked month’s cards still', async () => {
    atWidth(375);
    stubFetch(everything({ '/kpm/data-upload/': { body: month([RINA, BUDI], 1, '2026-09', state('2026-09', { locked: true, reason: 'schedule' })) } }));
    renderWithSession(<DataUploadPage />, { me: ALL });
    await cardsOf();
    expect(screen.queryByRole('button', { name: /^Correct figures for/ })).not.toBeInTheDocument();
  });

  it('P18.97-T7 AC-2 never draws the table first on a phone: the width is asked before the month answers', async () => {
    atWidth(375);
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
    await cardsOf();
    await screen.findByText(/KPM0417-agent-data-Sep-2026-corrected\.csv/);
    observer.disconnect();
    expect(drew).toBe(false);
  });

  it('P18.97-T7 AC-2, AC-5 opens the agent’s sheet: twelve labelled figures, 16px fields 44px tall, held as the cells hold them', async () => {
    atWidth(375);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    expect(sheet.closest('[data-placement]')).toHaveAttribute('data-placement', 'sheet');
    expect(sheet).toHaveAccessibleDescription('PRU-001 · Sep 2026');
    // Opened on its title, so no keyboard rises before a field is chosen.
    expect(sheet).toHaveFocus();
    expect(within(sheet).getAllByRole('group').map((g) => g.querySelector('legend')!.textContent)).toEqual(['This Month', 'YTD']);
    const ape = within(sheet).getByLabelText('APE this month');
    expect(ape).toHaveValue('1,500,000');
    expect(within(sheet).getByLabelText('APE year to date')).toHaveValue('9,000,000');
    expect(within(sheet).getByLabelText('Rolling persistency this month')).toHaveValue('87.35');
    expect(within(sheet).getByLabelText('# of policy this month')).toHaveValue('2');
    expect(within(sheet).getByLabelText('FYP this month')).toHaveValue('');
    // Whose a corrected figure is, under its field, as the table's ✎ says it.
    expect(within(sheet).getByLabelText('# of policy year to date'))
      .toHaveAccessibleDescription('corrected by hand by Maya Halim on 18 Sep 2026 — “Carrier restated it”');
    // Every field a text box of the shared style — 16px on a phone through the field rule (globals.css; theme.spec.ts) —
    // and 48px tall there, so an input inside a box with *Rp* or *%* still has 44px; nothing a size of its own the rule
    // could not reach.
    const boxes = within(sheet).getAllByRole('textbox');
    expect(boxes).toHaveLength(13);
    for (const box of boxes) {
      expect(box.tagName).toBe('INPUT');
      expect(box.className).toMatch(/\btext-base\b/);
      expect(box.className).not.toMatch(/text-\[/);
      const tall = box.closest('span.inline-flex') ?? box;
      expect(wears(tall, 375).split(' ')).toEqual(expect.arrayContaining(['w-full', 'h-12']));
    }
    for (const button of within(sheet.closest('[data-placement]') as HTMLElement).getAllByRole('button', { name: /^(Save corrections|Cancel)$/ })) {
      expect(wears(button, 375).split(' ')).toContain('h-11');
    }
  });

  it('P18.97-T7 AC-2 saves each changed figure through PATCH /kpm/data-upload/cell with its reason, the year before the month it would pass', async () => {
    atWidth(375);
    const { calls } = stubFetch({ ...everything(), 'PATCH /kpm/data-upload/cell': answer });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    // The month raised past the year held: the year goes first, so the server never holds a month above its year.
    fireEvent.change(within(sheet).getByLabelText('APE this month'), { target: { value: '12000000' } });
    fireEvent.change(within(sheet).getByLabelText('APE year to date'), { target: { value: '15.000.000' } });
    fireEvent.change(within(sheet).getByLabelText('Rolling persistency this month'), { target: { value: '88,5' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'Carrier restated it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));

    expect(await screen.findByText(
      'Corrected 3 figures for Rina Wijaya: APE year to date IDR 9,000,000 → IDR 15,000,000; APE this month IDR 1,500,000 → IDR 12,000,000; Rolling persistency this month 87.35% → 88.5%.',
    )).toBeInTheDocument();
    // Each on the revision the one before it answered: the month's 3, then 4, then 5.
    expect(patches(calls)).toEqual([
      { month: '2026-09', membershipId: 'mem-rina', metric: 'ape', cadence: 'ytd', value: 1_500_000_000, revision: 3, reason: 'Carrier restated it' },
      { month: '2026-09', membershipId: 'mem-rina', metric: 'ape', cadence: 'monthly', value: 1_200_000_000, revision: 4, reason: 'Carrier restated it' },
      { month: '2026-09', membershipId: 'mem-rina', metric: 'persistency', cadence: 'monthly', value: 88.5, revision: 5, reason: 'Carrier restated it' },
    ]);
    expect(calls.filter((c) => c.url.includes('/kpm/data-upload/cell')).every((c) => c.init.method === 'PATCH')).toBe(true);
    // The sheet is put away and the month read again, as after a correction on the table.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => /\/kpm\/data-upload\/2026-09$/.test(c.url))).toHaveLength(2));
  });

  it('P18.97-T7 AC-2 asks for a reason before sending anything, and saves nothing unchanged', async () => {
    atWidth(375);
    const { calls } = stubFetch({ ...everything(), 'PATCH /kpm/data-upload/cell': answer });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    expect(screen.getByRole('button', { name: 'Save corrections' })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText('# of policy this month'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(within(sheet).getByLabelText('Why is it being corrected?')).toHaveAccessibleDescription(/Say why the figure is being corrected\./);
    fireEvent.change(within(sheet).getByLabelText('# of policy this month'), { target: { value: 'tiga' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(within(sheet).getByLabelText('# of policy this month')).toHaveAccessibleDescription('# of policy this month is not a number.');
    expect(patches(calls)).toEqual([]);
  });

  it('P18.97-T7 AC-2 puts a refusal on its figure, keeps what saved before it, and says both once the sheet closes', async () => {
    atWidth(375);
    const refusal = {
      status: 422,
      body: { error: { code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'Rolling persistency year to date is above 100 — persistency is a percentage.', requestId: 'r' } },
    };
    const { calls } = stubFetch({
      ...everything(),
      // The server's range rule, as it answers it: a persistency over 100 is refused.
      'PATCH /kpm/data-upload/cell': (call) => ((call.body as { value: number }).value > 100 ? refusal : answer(call)),
    });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    fireEvent.change(within(sheet).getByLabelText('# of policy this month'), { target: { value: '3' } });
    fireEvent.change(within(sheet).getByLabelText('Rolling persistency year to date'), { target: { value: '140' } });
    fireEvent.change(within(sheet).getByLabelText('Why is it being corrected?'), { target: { value: 'Carrier restated it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));

    const ytd = within(sheet).getByLabelText('Rolling persistency year to date');
    await waitFor(() => expect(ytd).toHaveAccessibleDescription('Rolling persistency year to date is above 100 — persistency is a percentage.'));
    expect(screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' })).toBeInTheDocument();
    // The month's figure saved; sent again it would be nothing, so only the year goes, on the revision the first answered.
    fireEvent.change(ytd, { target: { value: '89' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(await screen.findByText(
      'Corrected 2 figures for Rina Wijaya: # of policy this month 2 → 3; Rolling persistency year to date 86% → 89%.',
    )).toBeInTheDocument();
    expect(patches(calls).map((b) => [b.metric, b.value, b.revision])).toEqual([
      ['policyCount', 3, 3], ['persistency', 140, 4], ['persistency', 89, 4],
    ]);
  });

  it('P18.97-T7 AC-2 reports what saved when the sheet is closed after a refusal', async () => {
    atWidth(375);
    const { calls } = stubFetch({
      ...everything(),
      'PATCH /kpm/data-upload/cell': [answer, () => ({ status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Sep 2026 has changed since you looked at it.', requestId: 'r' } } })],
    });
    renderWithSession(<DataUploadPage />, { me: ALL });
    const sheet = await openSheet();
    fireEvent.change(within(sheet).getByLabelText('# of policy this month'), { target: { value: '4' } });
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

  it('P18.97-T7 AC-2 clears an emptied figure only after asking, naming it, with an explicit null', async () => {
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
    expect(await screen.findByText('Corrected APE this month for Rina Wijaya: IDR 1,500,000 → nothing reported.')).toBeInTheDocument();
    expect(patches(calls)).toEqual([
      { month: '2026-09', membershipId: 'mem-rina', metric: 'ape', cadence: 'monthly', value: null, revision: 3, reason: 'Belongs to August' },
    ]);
  });

  it('P18.97-T7 AC-2 puts the sheet away on Cancel, Escape or the backdrop, sending nothing and saying nothing', async () => {
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

  it('P18.97-T7 AC-6 makes every field and button of the page a 44px target on a phone, and nothing at 768px', async () => {
    atWidth(375);
    stubFetch(everything());
    renderWithSession(<DataUploadPage />, { me: ALL });
    await cardsOf();
    const link = await screen.findByRole('link', { name: 'Download template' });
    const tall = [
      screen.getByLabelText('Month'),
      link,
      screen.getByLabelText('+ Upload filled template').nextElementSibling!,
    ];
    for (const el of tall) {
      expect(wears(el, 375).split(' ')).toContain('h-11');
      expect(wears(el, 768).split(' ')).not.toContain('h-11');
    }
    // The month's lock and the history's Revert are inline buttons, 44 × 44 on a phone already (`TAP_TARGET`).
    for (const name of ['Lock month', 'Revert']) {
      expect(wears(screen.getAllByRole('button', { name })[0], 375).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    }
  });

  /**
   * **P18.98-T3 figures on Data upload** (ADR-0174, ADR-0179 §6), under the app's own provider: written in the
   * reader's chosen language, and in Indonesian with no choice, whether or not the switch is live. Until it is, a
   * reader with no choice reads the page exactly as before T3 — its words English, its figures *Rp 1.500.000* and
   * *87,35%* — never *IDR* beside an unwired screen's *Rp* (the client's UI-019).
   */
  describe('P18.98-T3 figures on Data upload', () => {
    afterEach(() => resetLanguage());

    /** Rina's six figures for this month on her phone card, as read. */
    const thisMonth = async (list = 'Data for Sep 2026') => {
      await screen.findByRole('list', { name: list });
      const month = within(cardOf('Rina Wijaya')).getByRole('group', { name: 'This Month' });
      return [...month.querySelectorAll('dd')].map((dd) => dd.textContent);
    };

    it.each([768, 1280] as const)('P18.98-T3 figures, unchosen and not live, at %ipx: the page as before T3, to the byte — English words, Indonesian figures', async (px) => {
      atWidth(px);
      stubFetch(everything());
      const { container } = renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });
      await screen.findByRole('table', { name: 'Data for Sep 2026' });
      await screen.findByRole('link', { name: 'Download template' });
      await screen.findByText(/KPM0417-agent-data-Sep-2026-corrected\.csv/);

      const row = screen.getAllByRole('row').find((r) => within(r).queryByText('Rina Wijaya'))!;
      expect(within(row).getByText('Rp 1.500.000')).toBeInTheDocument();
      expect(within(row).getByText('87,35%')).toBeInTheDocument();
      expect(screen.queryByText(/IDR/)).not.toBeInTheDocument();
      expect(document.documentElement.lang).toBe('en');
      // The bytes of the page before T7, when every figure was Indonesian and every word English.
      expect(digestAt(container, px)).toBe(BEFORE_T7[px]);
    });

    it('P18.98-T3 figures, unchosen and not live, on a phone: Indonesian figures in English words, the sheet’s sum grouped with dots', async () => {
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });

      expect(await thisMonth()).toEqual(['Rp 1.500.000', '87,35%', '—', '—', '—', '2']);
      expect(screen.getByText('Tap an agent to correct their figures — no need to re-upload for a single fix.')).toBeInTheDocument();
      expect(within(cardOf('Rina Wijaya')).getByRole('group', { name: 'YTD' })).toHaveTextContent('corrected by hand by Maya Halim on 18 Sep 2026');
      fireEvent.click(screen.getByRole('button', { name: 'Correct figures for Rina Wijaya' }));
      const sheet = screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' });
      expect(within(sheet).getByLabelText('APE this month')).toHaveValue('1.500.000');
    });

    it('P18.98-T3 figures, chosen English by the browser, not live: IDR 1,500,000 and 87.35%, the sheet’s sum grouped with commas', async () => {
      browserChose('en');
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });

      expect(await thisMonth()).toEqual(['IDR 1,500,000', '87.35%', '—', '—', '—', '2']);
      fireEvent.click(screen.getByRole('button', { name: 'Correct figures for Rina Wijaya' }));
      const sheet = screen.getByRole('dialog', { name: 'Correct figures for Rina Wijaya' });
      expect(within(sheet).getByLabelText('APE this month')).toHaveValue('1,500,000');
    });

    it('P18.98-T3 figures, chosen Indonesian by the browser, not live: Rp 1.500.000 and 87,35%, the screen in Indonesian', async () => {
      browserChose('id');
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: false });

      // Its words Indonesian too since P18.98-T4: the list is *Data untuk Sep 2026*.
      expect(await thisMonth('Data untuk Sep 2026')).toEqual(['Rp 1.500.000', '87,35%', '—', '—', '—', '2']);
      expect(document.documentElement.lang).toBe('id');
    });

    it('P18.98-T3 figures, live and unchosen: Indonesian figures on a screen whose language is Indonesian', async () => {
      atWidth(375);
      stubFetch(everything());
      renderWithLanguage(<DataUploadPage />, { me: ALL }, { live: true });

      // The words' language too (`<html lang>`), and since P18.98-T4 the page's own words: *Data untuk Sep 2026*.
      expect(await thisMonth('Data untuk Sep 2026')).toEqual(['Rp 1.500.000', '87,35%', '—', '—', '—', '2']);
      expect(document.documentElement.lang).toBe('id');
    });
  });
});

/**
 * **P18.98-T4 Data upload in Indonesian** (`i18n/messages/data-upload.ts`; ADR-0179): the page's name and the table's
 * metric headings kept English — the carrier's file's own names — every other word the approved glossary's, a member's
 * name and code, a file's name and the server's sentences as sent, and the figures Indonesian.
 */
describe('P18.98-T4 Data upload in Indonesian', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  /** Every grant the page has: the template, the upload, the history, the lock, and correcting a figure. */
  const ALL_GRANTS = makeMe({ membership, permissions: [...EVERYTHING.permissions, 'data_upload:correct_cell'] });
  const withApe = () => rina({ metrics: { ...blank(), ape: { monthly: cell(150_000_000), ytd: empty } } });
  const inIndonesian = (me = ALL_GRANTS) => renderWithSession(<InLanguage language="id"><DataUploadPage /></InLanguage>, { me });

  it('P18.98-T4 reads the month in Indonesian: its toolbar, lock, legend, table and history, the headings kept', async () => {
    stubFetch({
      ...routes(month([withApe(), budi()], 1)),
      '/kpm/data-upload/history': { body: { month: '2026-09', batches: [batch(), REVERTED] } },
    });
    inIndonesian();
    const table = await screen.findByRole('table', { name: 'Data untuk Sep 2026' });
    expect(screen.getByRole('heading', { level: 1, name: /^Data upload/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Unduh templat' })).toBeInTheDocument();
    expect(screen.getByLabelText('+ Unggah templat yang sudah diisi')).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('Bulan')).toHaveValue('2026-09');
    expect(screen.getByText('Terbuka untuk impor dan koreksi sampai 7 Okt 2026, lalu terkunci.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kunci bulan' })).toBeInTheDocument();
    expect(screen.getByText('1 dari 2 anggota memiliki angka untuk bulan ini.')).toBeInTheDocument();
    expect(screen.getByText('Ketuk angka mana pun untuk mengoreksinya secara manual — tidak perlu mengunggah ulang untuk satu perbaikan.'))
      .toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Agent', 'Kode agen', 'This Month', 'YTD', 'Aktif (MAA)',
      'APE', 'Rolling Persistency (%)', 'Recruitment', 'New Active Agents', 'FYP', '# of Policy',
      'APE', 'Rolling Persistency (%)', 'Recruitment', 'New Active Agents', 'FYP', '# of Policy',
    ]);
    expect(screen.getByRole('button', { name: 'Koreksi APE bulan ini untuk Rina Wijaya, sekarang Rp 1.500.000' })).toBeInTheDocument();
    expect(screen.getByText(/= APE atau polis > 0 bulan ini/)).toBeInTheDocument();
    // The history: who imported and reverted what, in Indonesian, the file's name as it is.
    expect(await screen.findByRole('heading', { name: 'Impor untuk Sep 2026' })).toBeInTheDocument();
    expect(screen.getByText('Diimpor oleh Wilson Tanoto pada 26 Sep 2026 · 6 agent, 72 angka')).toBeInTheDocument();
    expect(screen.getByText('Dikembalikan oleh Maya Halim pada 25 Sep 2026 — 96 angka dipulihkan.')).toBeInTheDocument();
    expect(screen.getByText('Berlaku')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembalikan' })).toBeInTheDocument();
    // The scan reads the screen at all, so a silent zero cannot pass.
    expect(englishOnly(dataUploadMessages).length).toBeGreaterThan(40);
    expect(document.body.textContent).toContain('Berlaku');
    expect(englishShown(document.body, englishOnly(dataUploadMessages))).toEqual([]);
  });

  it('P18.98-T4 corrects a figure in Indonesian, and says what changed', async () => {
    const correction = {
      membershipId: 'mem-rina', metric: 'ape', cadence: 'monthly', changed: true,
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

  it('P18.98-T4 asks before a figure is cleared, in Indonesian', async () => {
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

  it('P18.98-T4 previews a filled file in Indonesian: the summary, what is not taken, and the diff', async () => {
    stubFetch({ ...routes(month([rina(), budi()])), '/kpm/data-upload/preview': { body: PREVIEW } });
    inIndonesian();
    fireEvent.change(await screen.findByLabelText('+ Unggah templat yang sudah diisi'), { target: { files: [csvFile()] } });
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

  it('P18.98-T4 opens an agent’s figures on a phone in Indonesian, each field named as a sentence names it', async () => {
    atWidth(375);
    stubFetch(routes(month([withApe(), budi()], 1)));
    inIndonesian();
    await screen.findByRole('list', { name: 'Data untuk Sep 2026' });
    expect(screen.getByText('Ketuk agent untuk mengoreksi angkanya — tidak perlu mengunggah ulang untuk satu perbaikan.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi angka Rina Wijaya' }));
    const sheet = screen.getByRole('dialog', { name: 'Koreksi angka Rina Wijaya' });
    expect(within(sheet).getByLabelText('APE bulan ini')).toHaveValue('1.500.000');
    expect(within(sheet).getByLabelText('FYP sejak awal tahun')).toHaveValue('');
    expect(within(sheet).getByRole('button', { name: 'Simpan koreksi' })).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Mengapa angka ini dikoreksi?')).toBeInTheDocument();
  });
});
