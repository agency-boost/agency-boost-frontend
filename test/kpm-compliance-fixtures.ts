import type {
  ComplianceCampaign, ComplianceCategory, ComplianceCell, ComplianceChip, ComplianceEvent, ComplianceRow,
  ComplianceSection, ComplianceTrainingCategory, ComplianceUnit, ComplianceView,
} from '@/lib/kpm-compliance';

/**
 * The compliance tree as the server answers it (P18.6-T1, T2): three AB agencies, A to Z — Hendra Wibowo's with
 * an AAB unit (Ika Wirawan's), Maya Halim's, who leads nobody, and the reader's own, Wilson Tanoto's — eleven
 * people in all. Each person has a status in every category, chosen so every pill, every date and every *—*
 * appears somewhere; the cards' and sections' counts are made from the cells as the server makes them.
 */

export const TODAY = '2026-10-10';

type Who = { id: string; name: string; leads?: boolean };
const HENDRA: Who = { id: 'mem-hendra', name: 'Hendra Wibowo', leads: true };
const RINA: Who = { id: 'mem-rina', name: 'Rina Agustina' };
const DEDY: Who = { id: 'mem-dedy', name: 'Dedy Pranata' };
const AGUS: Who = { id: 'mem-agus', name: 'Agus Prasetyo' };
const IKA: Who = { id: 'mem-ika', name: 'Ika Wirawan', leads: true };
const SINTA: Who = { id: 'mem-sinta', name: 'Sinta Halim' };
const YOGA: Who = { id: 'mem-yoga', name: 'Yoga Pratama' };
const MAYA: Who = { id: 'mem-maya', name: 'Maya Halim' };
export const OWNER: Who = { id: 'mem-owner', name: 'Wilson Tanoto', leads: true };
const PUTRI: Who = { id: 'mem-putri', name: 'Putri Ramadhani' };
const AYU: Who = { id: 'mem-ayu', name: 'Ayu Lestari' };

const cell = (status: string | null, done: boolean | null, on: string | null = null, extra: Partial<ComplianceCell> = {}): ComplianceCell =>
  ({ status, done, on, ...extra });

/** Each person's cell per category (the events and campaigns ones per item, below). */
const CELLS: Record<'training' | 'goals' | 'activity' | 'activation', Record<string, ComplianceCell>> = {
  training: {
    [HENDRA.id]: cell('done', true, '2026-09-01'),
    [RINA.id]: cell('in_progress', false),
    [DEDY.id]: cell('not_started', false),
    [AGUS.id]: cell('done', true, '2026-09-15'),
    [IKA.id]: cell('done', true, '2025-12-20'),
    [SINTA.id]: cell('not_started', false),
    [YOGA.id]: cell('done', true, '2026-10-02'),
    [MAYA.id]: cell('not_started', false),
    [OWNER.id]: cell('in_progress', false),
    [PUTRI.id]: cell('done', true, '2026-08-14'),
    [AYU.id]: cell('not_started', false),
  },
  goals: {
    [HENDRA.id]: cell('set', true, '2026-01-10'),
    [RINA.id]: cell('set', true, '2026-01-10'),
    [DEDY.id]: cell('not_set', false),
    [AGUS.id]: cell('set', true, '2026-01-11'),
    [IKA.id]: cell('set', true, '2026-01-12'),
    [SINTA.id]: cell('not_set', false),
    [YOGA.id]: cell('set', true, '2026-02-03'),
    [MAYA.id]: cell('set', true, '2026-01-10'),
    [OWNER.id]: cell('set', true, '2026-01-10'),
    [PUTRI.id]: cell('set', true, '2026-01-10'),
    [AYU.id]: cell('not_set', false),
  },
  activity: {
    [HENDRA.id]: cell('logged', true, '2026-10-09'),
    [RINA.id]: cell('logged', true, '2026-10-10'),
    [DEDY.id]: cell('missed', false),
    [AGUS.id]: cell('missed', false),
    [IKA.id]: cell('logged', true, '2026-10-08'),
    [SINTA.id]: cell('missed', false),
    [YOGA.id]: cell('logged', true, '2026-10-04'),
    [MAYA.id]: cell('missed', false),
    [OWNER.id]: cell('logged', true, '2026-10-10'),
    [PUTRI.id]: cell('logged', true, '2026-10-07'),
    [AYU.id]: cell('missed', false),
  },
  activation: {
    [HENDRA.id]: cell(null, null, null, { endedOn: null }),
    [RINA.id]: cell(null, null, null, { endedOn: null }),
    [DEDY.id]: cell('overdue', false, null, { endedOn: null }),
    [AGUS.id]: cell('in_progress', false, null, { endedOn: null }),
    [IKA.id]: cell(null, null, null, { endedOn: null }),
    [SINTA.id]: cell('completed', true, '2026-08-01', { endedOn: null }),
    [YOGA.id]: cell('overdue', false, null, { endedOn: '2026-09-30' }),
    [MAYA.id]: cell(null, null, null, { endedOn: null }),
    [OWNER.id]: cell(null, null, null, { endedOn: null }),
    [PUTRI.id]: cell('completed', true, '2026-07-20', { endedOn: null }),
    [AYU.id]: cell('in_progress', false, null, { endedOn: null }),
  },
};

/*
 * ── The catalog ─────────────────────────────────────────────────────────────────────────────────
 */

export const TRAINING: ComplianceTrainingCategory[] = [
  {
    code: 'SALES', label: 'Sales',
    skills: [
      {
        code: 'PROSPECTING', label: 'Prospecting',
        modules: [
          { code: 'PROSPECT_LIST', title: 'Building Your Prospect List' },
          { code: 'REFERRALS', title: 'Referral Generation Techniques' },
        ],
      },
      { code: 'CLOSING', label: 'Closing', modules: [{ code: 'CLOSING_TECHNIQUES', title: 'Closing Techniques That Work' }] },
    ],
  },
  { code: 'PRODUCT', label: 'Product', skills: [] },
];

const event = (id: string, title: string, startsOn: string, phase: ComplianceEvent['phase'], hour = 2): ComplianceEvent => ({
  id, title, startsOn, phase,
  startsAt: `${startsOn}T0${hour}:00:00.000Z`,
  endsAt: `${startsOn}T0${hour + 2}:00:00.000Z`,
});

/** In the read's order: not past soonest first (a running one leads), then past latest first. */
export const EVENTS: ComplianceEvent[] = [
  event('ev-huddle', 'Leaders’ huddle', '2026-10-10', 'running', 1),
  event('ev-kickoff', 'Kickoff 2026', '2026-10-24', 'upcoming'),
  event('ev-prulink', 'PRULink briefing', '2026-09-19', 'past'),
  event('ev-townhall', 'August Town Hall', '2026-08-15', 'past'),
];

const campaign = (over: Partial<ComplianceCampaign> & { code: string; title: string }): ComplianceCampaign => ({
  kind: 'seasonal', subtype: null, phase: 'running', startsAt: '2026-08-31T17:00:00.000Z', endsAt: '2026-12-31T16:59:59.999Z', final: false,
  ...over,
});

/** In the read's order: structural, seasonal running then upcoming, seasonal ended latest first. */
export const CAMPAIGNS: ComplianceCampaign[] = [
  campaign({ code: 'MDRT_QUALIFICATION', title: 'MDRT Qualification', kind: 'structural', subtype: 'promotion', startsAt: '2026-01-01T00:00:00.000Z', endsAt: null }),
  campaign({ code: 'APE_SPRINT', title: 'Q4 APE Push' }),
  campaign({ code: 'APE_CHALLENGE_NEXT', title: 'Year-End Star Club Drive', phase: 'upcoming', startsAt: '2026-10-31T17:00:00.000Z' }),
  campaign({
    code: 'PERSISTENCY_PUSH', title: 'Persistency Push', phase: 'ended', final: true,
    startsAt: '2026-06-30T17:00:00.000Z', endsAt: '2026-08-31T16:59:59.999Z',
  }),
];

/**
 * An upcoming seasonal campaign of **next** year: the read lists every upcoming item, whatever its year, so it sits
 * under *Seasonal — Ongoing*, tagged *Upcoming*, its date carrying its year.
 */
export const NEXT_YEAR_CAMPAIGN = campaign({
  code: 'NEW_YEAR_DASH', title: 'New Year Dash', phase: 'upcoming',
  startsAt: '2026-12-31T17:00:00.000Z', endsAt: '2027-02-28T16:59:59.999Z',
});

/*
 * ── Events' and campaigns' cells, per item ─────────────────────────────────────────────────────
 */

const OUT = cell(null, null, null, { second: null });

function eventCells(id: string): Record<string, ComplianceCell> {
  if (id === 'ev-townhall' || id === 'ev-prulink') {
    return {
      [HENDRA.id]: cell('attended', true, '2026-08-15', { second: 'shared' }),
      [RINA.id]: cell('attended', true, '2026-08-15', { second: 'not_shared' }),
      [DEDY.id]: cell('no_show', false, null, { second: null }),
      [AGUS.id]: cell('not_registered', false, null, { second: null }),
      [IKA.id]: cell('unconfirmed', false, null, { second: 'shared' }),
      [SINTA.id]: cell('not_registered', false, null, { second: null }),
      [YOGA.id]: cell('attended', true, '2026-08-15', { second: 'shared' }),
      [MAYA.id]: OUT,
      [OWNER.id]: cell('attended', true, '2026-08-15', { second: 'shared' }),
      [PUTRI.id]: cell('not_registered', false, null, { second: null }),
      [AYU.id]: cell('no_show', false, null, { second: null }),
    };
  }
  return {
    [HENDRA.id]: cell('registered', true, '2026-10-24', { second: null }),
    [RINA.id]: cell('not_registered', false, null, { second: null }),
    [DEDY.id]: cell('registered', true, '2026-10-24', { second: null }),
    [AGUS.id]: cell('registered', true, '2026-10-24', { second: null }),
    [IKA.id]: cell('not_registered', false, null, { second: null }),
    [SINTA.id]: OUT,
    [YOGA.id]: cell('registered', true, '2026-10-24', { second: null }),
    [MAYA.id]: OUT,
    [OWNER.id]: cell('registered', true, '2026-10-24', { second: null }),
    [PUTRI.id]: cell('not_registered', false, null, { second: null }),
    [AYU.id]: OUT,
  };
}

const NO_OVERRIDE = { override: null, overridable: false };

function campaignCells(code: string): Record<string, ComplianceCell> {
  const chasing = (second: string | null = null, extra: Partial<ComplianceCell> = {}) =>
    cell('chasing', true, null, { second, ...NO_OVERRIDE, ...extra });
  const notChasing = (second: string | null = null) => cell('not_chasing', false, null, { second, ...NO_OVERRIDE });
  const ineligible = cell(null, null, null, { second: null, ...NO_OVERRIDE });
  if (code === 'PERSISTENCY_PUSH') {
    return {
      [HENDRA.id]: notChasing('not_joined'),
      [RINA.id]: chasing('qualified', { overridable: true }),
      [DEDY.id]: chasing('qualified', {
        overridable: true,
        override: {
          status: 'qualified', reason: 'Persistency corrected by the carrier after the month locked.',
          by: { membershipId: OWNER.id, name: OWNER.name }, at: '2026-10-08T03:00:00.000Z',
        },
      }),
      [AGUS.id]: notChasing('not_joined'),
      [IKA.id]: chasing('unknown', { overridable: true }),
      [SINTA.id]: chasing('not_met', { overridable: true }),
      [YOGA.id]: notChasing('not_joined'),
      [MAYA.id]: ineligible,
      [OWNER.id]: notChasing('not_joined'),
      [PUTRI.id]: notChasing('not_joined'),
      [AYU.id]: ineligible,
    };
  }
  return {
    [HENDRA.id]: chasing(),
    [RINA.id]: chasing(),
    [DEDY.id]: notChasing(),
    [AGUS.id]: chasing(),
    [IKA.id]: notChasing(),
    [SINTA.id]: chasing(),
    [YOGA.id]: notChasing(),
    [MAYA.id]: ineligible,
    [OWNER.id]: notChasing(),
    [PUTRI.id]: chasing(),
    [AYU.id]: ineligible,
  };
}

/*
 * ── The tree ────────────────────────────────────────────────────────────────────────────────────
 */

const person = (w: Who) => ({ membershipId: w.id, name: w.name, leads: w.leads ?? false });

function unit(head: Who, rung: 'AB' | 'AAB', members: Who[], cells: Record<string, ComplianceCell>): ComplianceUnit {
  const rows: ComplianceRow[] = [head, ...members].map((w, i) => ({
    ...person(w), personal: i === 0, cell: cells[w.id] ?? cell(null, null, null),
  }));
  const counted = rows.filter((r) => r.cell.done !== null);
  return { head: person(head), rung, rows, done: counted.filter((r) => r.cell.done).length, of: counted.length };
}

function section(head: Who, units: ComplianceUnit[]): ComplianceSection {
  return {
    head: person(head),
    units,
    done: units.reduce((n, u) => n + u.done, 0),
    of: units.reduce((n, u) => n + u.of, 0),
  };
}

export function tree(cells: Record<string, ComplianceCell>): ComplianceSection[] {
  return [
    section(HENDRA, [unit(HENDRA, 'AB', [RINA, DEDY, AGUS], cells), unit(IKA, 'AAB', [SINTA, YOGA], cells)]),
    section(MAYA, [unit(MAYA, 'AB', [], cells)]),
    section(OWNER, [unit(OWNER, 'AB', [PUTRI, AYU], cells)]),
  ];
}

export const SUMMARY: ComplianceChip[] = [
  { category: 'training', count: 3, of: 11 },
  { category: 'goals', count: 8, of: 11 },
  { category: 'activity', count: 6, of: 11 },
  { category: 'activation', count: 2, of: 6 },
  { category: 'events', count: 5, of: 9 },
  { category: 'campaigns', count: 4, of: 8 },
];

/** The default item of each category, as the read resolves it. */
const DEFAULT_ITEM: Record<ComplianceCategory, string | null> = {
  training: 'PROSPECT_LIST', goals: null, activity: null, activation: null, events: 'ev-huddle', campaigns: 'MDRT_QUALIFICATION',
};

function cellsOf(category: ComplianceCategory, item: string | null): Record<string, ComplianceCell> {
  if (category === 'events') return eventCells(item ?? '');
  if (category === 'campaigns') return campaignCells(item ?? '');
  return CELLS[category];
}

/** The read's answer for a selection (the item asked, or the category's default). */
export function complianceView(
  category: ComplianceCategory = 'training',
  item: string | null = null,
  over: Partial<ComplianceView> = {},
): ComplianceView {
  const chosen = item ?? DEFAULT_ITEM[category];
  return {
    today: TODAY,
    people: 11,
    units: 3,
    summary: SUMMARY,
    catalog: { training: TRAINING, goals: { year: '2026' }, events: EVENTS, campaigns: CAMPAIGNS },
    selected: { category, item: chosen },
    tree: tree(cellsOf(category, chosen)),
    can: { override: true },
    // UI V1 (UI-109): the server's split, as `KPM_REPORTING` serves it.
    thresholds: { lowBelowPct: 50, highFromPct: 80 },
    ...over,
  };
}

/** An office with no AB yet: no row, every chip over nobody. */
export const NO_AB: ComplianceView = complianceView('training', null, {
  people: 0, units: 0, tree: [],
  summary: SUMMARY.map((c) => ({ ...c, count: 0, of: 0 })),
});

/** Nothing published, no event and no campaign this year: the empty catalog's states. */
export const EMPTY_CATALOG = (category: ComplianceCategory) => complianceView(category, null, {
  catalog: { training: [], goals: { year: '2026' }, events: [], campaigns: [] },
  selected: { category, item: null },
  tree: tree({}),
  summary: SUMMARY.map((c) => (['training', 'events', 'campaigns'].includes(c.category) ? { ...c, count: 0, of: 0 } : c)),
});

export const NOT_FOUND = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Training module not found.', requestId: 'r-404' } } };
export const ITEM_REFUSED = {
  status: 400,
  body: { error: { code: 'VALIDATION_FAILED', message: 'item must be shorter than or equal to 100 characters', requestId: 'r-400' } },
};
export const SERVER_ERROR = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };
