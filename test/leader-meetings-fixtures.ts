import { render } from '@testing-library/react';
import { createElement, useState, type ReactNode } from 'react';
import { vi } from 'vitest';
import { stubFetch, withLanguage, type StubReply, type StubResponse } from './harness';
import type { Language } from '@/i18n/language';
import { MeetingWriterProvider } from '@/components/leader-forum/meeting-writer';
import {
  readMeeting, type ActionItem, type AgendaItem, type MeetingView, type Scorecard, type ScorecardCell,
} from '@/lib/leader-meetings';

/**
 * A meeting as the server answers it (P18.1-T2, P18.97-T1): 0417's **#14**, upcoming, as the seed writes it — the
 * prototype's ten agenda items (`KPM_Owner.html:2500-2513`), its four tracker rows (`:2516-2521`) and *Monthly
 * Target* as rates — with a scorecard the server computed in the reference slide's shape: *Full Year*, both *YTD*s and
 * *This Month, Last Year* held, this year's *YTD* leaving August out, *This Month* not yet uploaded, FLC *pending data*
 * (OD-26), and *Avg. Case Size* over no policies in *YTD*.
 */

/** Rupiah to minor units (sen). */
export const sen = (rupiah: number) => Math.round(rupiah * 100);
/** *Miliar* of rupiah, as *APE (Rp M)* reads, to minor units. */
export const billions = (b: number) => sen(b * 1e9);
/** *Juta* of rupiah, as *Avg. Case Size (Rp jt)* reads, to minor units. */
export const millions = (m: number) => sen(m * 1e6);

const fig = (value: number, leavesOut: string[] = []): ScorecardCell => ({ kind: 'figure', value, leavesOut });
const PENDING: ScorecardCell = { kind: 'pending' };
const BLOCKED: ScorecardCell = { kind: 'blocked' };
const NONE: ScorecardCell = { kind: 'none' };

export function makeScorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  const fy = (value: number, leavesOut: string[] = []) => fig(value, leavesOut);
  const target = (rate: number | null, value: number | null, version: number, typed: string | null = null) =>
    ({ rate, value, typed, version });
  return {
    periods: {
      fy: { from: '2025-01', to: '2025-12' },
      ytdLastYear: { from: '2025-01', to: '2025-09' },
      ytd: { from: '2026-01', to: '2026-09' },
      thisMonthLastYear: { from: '2025-09', to: '2025-09' },
      lastMonth: { from: '2026-08', to: '2026-08' },
      thisMonth: { from: '2026-09', to: '2026-09' },
    },
    chips: { manpower: 187, agents: 155, units: 32, ab: 8, aab: 24 },
    rows: [
      {
        key: 'ape',
        unit: 'idr_minor',
        cells: {
          fy: fy(billions(12.1)),
          ytdLastYear: fig(billions(7.9)),
          ytd: fig(billions(8.4), ['2026-08']),
          thisMonthLastYear: fig(billions(0.75)),
          lastMonth: PENDING,
          thisMonth: PENDING,
        },
        ytdChange: { kind: 'figure', value: 6, unit: 'percent' },
        monthlyTarget: target(null, null, 2),
      },
      {
        key: 'manpower',
        unit: 'count',
        cells: { fy: fig(201), ytdLastYear: fig(190), ytd: fig(187), thisMonthLastYear: fig(196), lastMonth: fig(181), thisMonth: fig(187) },
        ytdChange: { kind: 'figure', value: -2, unit: 'percent' },
        monthlyTarget: target(null, null, 0),
      },
      {
        key: 'flc',
        unit: 'count',
        cells: { fy: PENDING, ytdLastYear: PENDING, ytd: PENDING, thisMonthLastYear: PENDING, lastMonth: PENDING, thisMonth: PENDING },
        ytdChange: { kind: 'none' },
        monthlyTarget: target(1, 32, 1),
      },
      {
        key: 'producing_agents',
        unit: 'count',
        cells: { fy: fig(96), ytdLastYear: fig(80), ytd: fig(71, ['2026-08']), thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'figure', value: -11, unit: 'percent' },
        monthlyTarget: null,
      },
      {
        key: 'new_agent_3m',
        unit: 'percentage',
        cells: { fy: fig(30), ytdLastYear: fig(25), ytd: PENDING, thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'none' },
        monthlyTarget: null,
      },
      {
        key: 'avg_monthly_aa',
        unit: 'count',
        cells: { fy: fig(14.4), ytdLastYear: fig(12), ytd: fig(11), thisMonthLastYear: fig(10), lastMonth: PENDING, thisMonth: PENDING },
        ytdChange: { kind: 'figure', value: -8, unit: 'percent' },
        monthlyTarget: target(3, 96, 1),
      },
      {
        key: 'case_submission',
        unit: 'count',
        cells: { fy: fig(420), ytdLastYear: fig(300), ytd: fig(198, ['2026-08']), thisMonthLastYear: fig(27), lastMonth: PENDING, thisMonth: PENDING },
        ytdChange: { kind: 'figure', value: -34, unit: 'percent' },
        monthlyTarget: target(null, null, 1),
      },
      {
        key: 'cases_per_producing_agent',
        unit: 'ratio',
        cells: { fy: fig(420 / 96), ytdLastYear: fig(3.75), ytd: fig(198 / 71, ['2026-08']), thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'figure', value: -26, unit: 'percent' },
        monthlyTarget: null,
      },
      {
        key: 'average_case_size',
        unit: 'idr_minor',
        cells: { fy: fig(millions(19.8)), ytdLastYear: fig(millions(17.6)), ytd: NONE, thisMonthLastYear: BLOCKED, lastMonth: BLOCKED, thisMonth: BLOCKED },
        ytdChange: { kind: 'none' },
        monthlyTarget: null,
      },
    ],
    asOf: { kind: 'date', date: '2026-09-05' },
    partialPeriods: [{ column: 'ytd', leavesOut: ['2026-08'] }],
    frozenAt: null,
    ...overrides,
  };
}

/**
 * **A scorecard kept before the reference slide's table** (P18.97-T1 AC-19), as the server reads it tolerantly: *YTD
 * {Y−1}* and *Cases/producing agents* *unrecorded*, *AS OF* unrecorded, *# of units* the five it was kept with.
 */
export function makeScorecardKeptBefore(): Scorecard {
  const now = makeScorecard();
  const UNRECORDED: ScorecardCell = { kind: 'unrecorded' };
  return {
    ...now,
    chips: { manpower: 26, agents: 17, units: 5, ab: 5, aab: 4 },
    rows: now.rows.map((row) => ({
      ...row,
      cells: row.key === 'cases_per_producing_agent'
        ? { ...row.cells, fy: UNRECORDED, ytdLastYear: UNRECORDED, ytd: UNRECORDED }
        : { ...row.cells, ytdLastYear: UNRECORDED },
      ytdChange: { kind: 'none' },
      monthlyTarget: row.monthlyTarget && row.monthlyTarget.rate !== null
        ? { ...row.monthlyTarget, value: row.monthlyTarget.rate * 5 }
        : row.monthlyTarget,
    })),
    asOf: { kind: 'unrecorded' },
    frozenAt: '2026-09-13T02:00:00.000Z',
  };
}

const item = (id: string, text: string, pic = '', done = false, version = 1): AgendaItem => ({ id, text, pic, done, version });

/** The prototype's ten (`:2500-2513`), with #14's *"Prepare August performance data"*. */
export function makeAgenda(): MeetingView['agenda'] {
  return {
    preparation: [
      item('ag-1', 'Compile follow-ups & commitments from prior session', 'Wilson'),
      item('ag-2', 'Prepare August performance data', 'Wilson'),
      item('ag-3', 'Review scorecard, draft talking points'),
    ],
    during: [
      item('ag-4', 'Process update — review prior follow-ups', '', true),
      item('ag-5', 'Performance review vs. key thresholds'),
      item('ag-6', 'Strategic priorities (Corporate)'),
      item('ag-7', 'Strategic priorities (Agency)'),
      item('ag-8', 'Summarize next steps & assign owners'),
    ],
    post: [
      item('ag-9', 'Document outcomes into template', 'Wilson'),
      item('ag-10', 'Note feedback for RBDO/BDO'),
    ],
  };
}

const row = (
  id: string, initiative: string, metric: string, action: string, pic: string, status: ActionItem['status'], remarks: string,
): ActionItem => ({ id, initiative, metric, action, pic, status, remarks, version: 1 });

/** #14's four rows (`:2516-2521`). */
export function makeActionItems(): ActionItem[] {
  return [
    row('ai-1', 'Activity tracking tool adoption', 'Adoption 80% (currently 63%)', 'Socialization on Activity Tracking Tool in LWS session', 'Amelia', 'planned', 'Scheduled for 2 Sept'),
    row('ai-2', 'Activity tracking tool adoption', 'Adoption 80% (currently 63%)', 'Find success story for leaders meeting', 'Amelia', 'planned', 'TBD'),
    row('ai-3', 'Leads Generation Playbook', '# of new prospects', 'Embed into recruitment onboarding', 'Ferry / Joy', 'not_planned', 'TBD'),
    row('ai-4', 'Team Management Playbook', '# of 1-on-1s', 'Embed into leaders training materials', 'Hellen', 'not_planned', 'TBD'),
  ];
}

const person = (membershipId: string, name: string, code: string, label: string, isReader = false) =>
  ({ membershipId, name, rung: { code, label }, isReader, tagged: true });

export function makeMeetingView(overrides: Partial<MeetingView> = {}): MeetingView {
  return {
    id: 'm14',
    number: 14,
    title: 'Strategic Check-in — #14',
    date: '2026-09-18',
    state: 'upcoming',
    editors: {
      owner: person('mem-owner', 'Wilson Tanoto', 'AB', 'AB', true),
      admins: [person('mem-maya', 'Maya Halim', 'AGENT', 'Agent')],
      coreLeaders: [person('mem-agus', 'Agus Pratama', 'AB', 'AB'), person('mem-sari', 'Sari Dewi', 'AAB', 'AAB')],
      coreLeaderCount: 3,
      frozen: false,
    },
    openItems: 4,
    version: 3,
    branch: 'BSD City Branch',
    scorecard: makeScorecard(),
    agenda: makeAgenda(),
    actionItems: makeActionItems(),
    writtenIn: true,
    via: 'address',
    accessNote: { ownerName: 'Wilson Tanoto', adminNames: ['Maya Halim'] },
    can: { edit: true, share: true, reschedule: true, delete: false, manageTags: true, print: true },
    limits: { titleMax: 120, textMax: 500, picMax: 80, targetMax: 40 },
    ...overrides,
  };
}

/** As a shared link or a read-only support session reads it: nothing may be written, *Save as PDF* stays. */
export const readOnlyMeeting = (overrides: Partial<MeetingView> = {}) =>
  makeMeetingView({
    via: 'link',
    can: { edit: false, share: false, reschedule: false, delete: false, manageTags: false, print: true },
    ...overrides,
  });

/** A past meeting, its scorecard frozen onto it at the first read after its date (ADR-0129). */
export const completedMeeting = (overrides: Partial<MeetingView> = {}) =>
  makeMeetingView({
    id: 'm13',
    number: 13,
    title: 'Strategic Check-in — #13',
    date: '2026-09-04',
    state: 'completed',
    scorecard: makeScorecard({ frozenAt: '2026-09-05T02:00:00.000Z', chips: { manpower: 181, agents: 150, units: 31, ab: 8, aab: 23 } }),
    ...overrides,
  });

/** The server's refusal of a write against an item changed since it was read. */
export const versionConflict: StubReply = {
  status: 409,
  body: { error: { code: 'VERSION_CONFLICT', message: 'Changed since read.', requestId: 'req-409' } },
};

/** Any other refusal: the write did not land. */
export const writeFailed: StubReply = {
  status: 500,
  body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'req-500' } },
};

/**
 * The meeting page as far as a tab sees it: the meeting held in state, the writer over it (FE-shell's
 * `MeetingWriterProvider`, reading the meeting again after a conflict), and the tab drawn from what is held.
 */
function MeetingHost({
  initial, draw, onMeeting,
}: {
  initial: MeetingView;
  draw: (meeting: MeetingView) => ReactNode;
  onMeeting?: (meeting: MeetingView) => void;
}) {
  const [meeting, setMeeting] = useState(initial);
  onMeeting?.(meeting);
  return createElement(
    MeetingWriterProvider,
    { meeting, setMeeting: (change) => setMeeting(change), reread: () => readMeeting(meeting.id) },
    draw(meeting),
  );
}

/**
 * Render a tab over a meeting, with `fetch` stubbed. `held()` is the meeting the page holds now — what a landed
 * write left in it.
 */
export function renderTab(
  Tab: (props: { meeting: MeetingView }) => ReactNode,
  meeting: MeetingView = makeMeetingView(),
  routes: Record<string, StubReply | StubReply[]> = {},
  /**
   * The reader's language (P18.98-T3): one a spec asks for (`InLanguage`, words and figures), or `{ live }`, the app's
   * own provider, where nothing is chosen but what the browser chose (`browserChose`) — not live, English words and
   * Indonesian figures. English, every spec's default, when none is given.
   */
  language?: Language | { live: boolean },
) {
  const stub = stubFetch(routes);
  let current = meeting;
  const host = createElement(MeetingHost, {
    initial: meeting,
    draw: (m: MeetingView) => createElement(Tab, { meeting: m }),
    onMeeting: (m: MeetingView) => {
      current = m;
    },
  });
  const result = render(withLanguage(host, language));
  return { ...result, ...stub, held: () => current };
}

/** The JSON body a call sent. */
export const bodyOf = (call: { init: RequestInit }) =>
  (typeof call.init.body === 'string' ? JSON.parse(call.init.body) : call.init.body) as Record<string, unknown>;

/** The calls that wrote: everything but a read. */
export const writesIn = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');

/** A promise the test settles when it chooses: a write held out while the reader goes on typing. */
export function gate<T = StubResponse>() {
  let open!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/**
 * `fetch` answered by `reply`, which may wait — for a write still out when the next one is made, which
 * `stubFetch`'s immediate answers cannot hold. Stubbed over whatever `renderTab` stubbed.
 */
export function gatedFetch(reply: (call: { url: string; method: string; body: unknown; n: number }) => Promise<StubResponse> | StubResponse) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    const stub = await reply({ url, method, body, n: calls.length });
    const status = stub.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => stub.body } as Response;
  }));
  return { calls };
}
