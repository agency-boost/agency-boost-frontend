'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { Language } from '@/i18n/language';
import { api } from './api-client';
import { formatMonth } from './format';

/**
 * **The surveys, as the app reads them** (P19.5-T4; ADR-0216; `functional/surveys.md`, *Data contract*): the reminder's
 * read, the list, the form and its answers, the KPM's runs and results, and the coaching *Survei* tab. Every figure,
 * every rule — when a popup is due, who is invited, what is shown of whom — is the server's; this mirrors the shapes and
 * holds no constant of its own (invariant §7).
 */

export type SurveyKind = 'nps' | 'qual';
export type RoleClass = 'agent' | 'aab' | 'ab';
export type Notice = 'anonymous' | 'per_person' | null;
export type Moment = 'opened' | 'halfway' | 'last_day';

export interface LabelPair {
  id: string;
  en: string;
}

export interface MySurveyRun {
  runId: string;
  kind: SurveyKind;
  periodKey: string;
  opensOn: string;
  closesOn: string;
  daysLeft: number;
  answeredCount: number;
  totalCount: number;
  minutes: number;
  anonymous: boolean;
  notice: Notice;
}

export interface SurveyPending {
  today: string;
  kpmCode: string;
  open: MySurveyRun[];
  sentOpen: { runId: string; kind: SurveyKind; periodKey: string; closesOn: string }[];
  popup: { moment: Moment; runIds: string[] } | null;
}

export interface SurveyList {
  today: string;
  open: MySurveyRun[];
  history: { runId: string; kind: SurveyKind; periodKey: string; submittedOn: string }[];
}

export type QuestionType =
  | 'score' | 'text' | 'aspiration' | 'scale_items' | 'state_items' | 'unit_items' | 'downline_yes_no' | 'downline_areas'
  | 'support';

export interface SurveyItem {
  kode: string;
  label: LabelPair;
  exclusive?: boolean;
}

export interface FormQuestion {
  kode: string;
  type: QuestionType;
  text: LabelPair;
  items: SurveyItem[];
  askWhy: boolean;
  required: boolean;
  blockKode: string | null;
  blockTitle: LabelPair | null;
  /** The scale the screen draws, the server's: 0 to 10, or 1 to 5. */
  scale: { min: number; max: number } | null;
}

export interface SurveyForm {
  run: {
    runId: string; kind: SurveyKind; periodKey: string; opensOn: string; closesOn: string; notice: Notice;
    anonymous: boolean; kpmCode: string;
  };
  state: 'open' | 'submitted' | 'closed';
  questions: FormQuestion[];
  answers: Record<string, AnswerValue>;
  answeredCount: number;
  totalCount: number;
  resumeIndex: number;
  downlineLeaders: { membershipId: string; name: string }[];
}

/** An answer, in its type's one shape (`checkAnswer`, the API's). */
export type AnswerValue = Record<string, unknown>;

export type SurveyState = 'consistent' | 'inconsistent' | 'not_done';
export const SURVEY_STATES: readonly SurveyState[] = ['consistent', 'inconsistent', 'not_done'];

// ------------------------------------------------------------------------------------------------- the reads

export const readSurveys = () => api<SurveyList>('/surveys');
export const readForm = (runId: string) => api<SurveyForm>(`/surveys/${encodeURIComponent(runId)}`);
export const saveAnswer = (runId: string, kode: string, value: AnswerValue) =>
  api<{ answeredCount: number; totalCount: number }>(
    `/surveys/${encodeURIComponent(runId)}/answers/${encodeURIComponent(kode)}`, { method: 'PUT', body: { value } },
  );
export const submitSurvey = (runId: string) =>
  api<{ submittedAt: string }>(`/surveys/${encodeURIComponent(runId)}/submit`, { method: 'POST' });
export const markPopupShown = (moment: Moment, runIds: string[]) =>
  api<void>('/surveys/popup/shown', { method: 'POST', body: { moment, runIds } });

// ---------------------------------------------------------------------------------- the reminder, shared

/**
 * **One read of `/surveys/pending` for the whole shell** (C-R2): the *Lainnya* dot, the sheet's cards, the *Survei*
 * tile's dot and Home's popup read the same answer, so they never disagree. Read once a page load; read again after
 * an answer, *Kirim* or a popup drawn (`refreshPending`). A reader with no office, or one the API refuses, has none.
 */
let pending: SurveyPending | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function refreshPending(): Promise<void> {
  loading = api<SurveyPending>('/surveys/pending')
    .then((next) => { pending = next; })
    .catch(() => { pending = null; })
    .finally(() => { loading = null; notify(); });
  return loading;
}

/** For a test: forget what was read. */
export function resetPending(value: SurveyPending | null = null): void {
  pending = value;
  loading = null;
  notify();
}

/** The shell's pending surveys; `null` until read, or for a reader with none to read. */
export function useSurveyPending(enabled = true): SurveyPending | null {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => pending,
    () => null,
  );
  useEffect(() => {
    if (enabled && pending === null && loading === null) void refreshPending();
  }, [enabled]);
  return enabled ? value : null;
}

/** C-R2: the dot on *Lainnya* and on the *Survei* tile — a run open and not sent. */
export const hasSurveyDot = (p: SurveyPending | null) => (p?.open.length ?? 0) > 0;

// ------------------------------------------------------------------------------------------------- the words

/**
 * A run's period as the mockups write it: *Q4 2026*, *Semester 2 2026*, and a qualitative run by its month — *Jun
 * 2026* (the coaching mockup's *"Survei Jun 2026"*).
 */
export function periodLabel(
  periodKey: string, semester: (v: { n: string; year: string }) => string, language: Language,
): string {
  const [year, part] = periodKey.split('-');
  if (part?.startsWith('Q')) return `${part} ${year}`;
  if (part?.startsWith('H')) return semester({ n: part.slice(1), year });
  return formatMonth(periodKey, language);
}

/** The words of a pair in the reader's language: the ID, or the EN where it is written. */
export const pairIn = (pair: LabelPair | null | undefined, language: 'id' | 'en') =>
  (pair ? (language === 'en' ? pair.en || pair.id : pair.id) : '');

// --------------------------------------------------------------------------------------- the KPM's tabs

export interface RunView {
  runId: string;
  kind: SurveyKind;
  periodKey: string;
  opensOn: string;
  closesOn: string;
  state: 'scheduled' | 'open' | 'closed';
  invitedRoleClasses: RoleClass[];
  anonymous: boolean;
  perPerson: boolean;
  remindHalfway: boolean;
  responses: { sent: number; invited: number; pct: number | null };
}

export interface NpsResults {
  cutoffs: { promoterMin: number; passiveMin: number; ageBandUpper: [number, number]; tenureBands: [number, number, number] };
  respondents: number;
  /** `null` for an anonymous run under three respondents, as are every score, change and the open answers (ADR-0216 §3). */
  overall: { score: number | null; promoters: number; passives: number; detractors: number; n: number } | null;
  change: number | null;
  aspects: { aspect: string; score: number | null; n: number; change: number | null }[];
  questions: { kode: string; text: LabelPair; aspect: string; score: number | null; n: number; change: number | null; textChanged: boolean }[];
  openAnswers: string[] | null;
  breakdowns: Record<'roleClass' | 'tenureBand' | 'ageBand', { key: string; respondents: number; score: number | null }[]>;
}

export interface QualResults {
  respondents: number;
  cutoffs: { qualIssueMaxRating: number };
  blocks: {
    kode: string; title: LabelPair; audience: 'all' | 'leader'; questionKodes: string[];
    items: {
      questionKode: string; itemKode: string; label: LabelPair; kind: 'rating' | 'state' | 'comfort'; answers: number;
      issues: number | null; issuePct: number | null; severity: 'big' | 'watch' | null;
    }[];
  }[];
  aspiration: { kode: string; label: LabelPair; count: number | null; pct: number | null }[];
  support: { n: number; satisfiedPct: number | null; fairPct: number | null; poorPct: number | null } | null;
  coachingDownline: { n: number; pct: number | null; good: boolean | null };
}

export interface SurveyResults {
  kind: SurveyKind;
  today: string;
  visible: boolean;
  sectionOn: boolean;
  canWrite: boolean;
  audience: 'office' | 'core_leader' | 'summary';
  template: { cadence: 'quarter' | 'half'; qualMonths: number[]; defaults: { anonymous: boolean; perPerson: boolean; remindHalfway: boolean } };
  runs: RunView[];
  selected: (RunView & { previousRunId: string | null; nps: NpsResults | null; qual: QualResults | null }) | null;
}

export interface RunInput {
  opensOn: string;
  closesOn: string;
  invitedRoleClasses: RoleClass[];
  anonymous: boolean;
  perPerson?: boolean;
  remindHalfway: boolean;
}

export function readResults(kind: SurveyKind, runId?: string, platformKpmId?: string) {
  const run = encodeURIComponent(runId ?? '');
  // P19.5-T3 AC-12 (ADR-0215 §9; A-R9): the Super Admin's *Lihat sebagai KPM* reads the same tab as a summary.
  if (platformKpmId !== undefined) {
    const kpm = encodeURIComponent(platformKpmId);
    return api<SurveyResults>(`/admin/tenants/${kpm}/advanced-analytics/${kind}?${runId ? `runId=${run}` : ''}`);
  }
  if (kind === 'nps') {
    return runId ? api<SurveyResults>(`/kpm/advanced-analytics/nps?runId=${run}`) : api<SurveyResults>('/kpm/advanced-analytics/nps');
  }
  return runId ? api<SurveyResults>(`/kpm/advanced-analytics/qual?runId=${run}`) : api<SurveyResults>('/kpm/advanced-analytics/qual');
}
export const startRun = (kind: SurveyKind, input: RunInput) =>
  api<RunView>('/kpm/advanced-analytics/surveys/runs', { method: 'POST', body: { kind, ...input } });
export const changeRun = (runId: string, input: Partial<RunInput>) =>
  api<RunView>(`/kpm/advanced-analytics/surveys/runs/${encodeURIComponent(runId)}`, { method: 'PATCH', body: input });
export const cancelRun = (runId: string) =>
  api<void>(`/kpm/advanced-analytics/surveys/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });

/**
 * The first period the start dialog offers (spec §2, OD-267): the next days the template's cadence allows — the rest of
 * today's quarter or half for NPS, the next June or December for a qualitative run. A suggestion; the server decides.
 */
export function suggestedDates(kind: SurveyKind, today: string, cadence: 'quarter' | 'half', qualMonths: readonly number[]): {
  opensOn: string; closesOn: string;
} {
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const last = (year: number, month: number) => `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  if (kind === 'nps') {
    const span = cadence === 'quarter' ? 3 : 6;
    const endMonth = Math.ceil(m / span) * span;
    return { opensOn: today, closesOn: last(y, endMonth) };
  }
  const month = qualMonths.find((q) => q >= m) ?? qualMonths[0];
  const year = month >= m ? y : y + 1;
  const first = `${year}-${pad(month)}-01`;
  return { opensOn: first > today ? first : today, closesOn: last(year, month) };
}

// ------------------------------------------------------------------------------------ the coaching tab

export type CoachingSection =
  | { kode: string; kind: 'scale'; title: LabelPair; questionKodes: string[]; items: { kode: string; label: LabelPair; rating: number | null }[] }
  | { kode: string; kind: 'state'; title: LabelPair; questionKodes: string[]; items: { kode: string; label: LabelPair; state: SurveyState | null }[] }
  | { kode: string; kind: 'unit'; title: LabelPair; questionKodes: string[]; items: { kode: string; label: LabelPair; state: SurveyState | null; rating: number | null }[] }
  | {
    kode: string; kind: 'downline'; title: LabelPair; questionKodes: string[]; stillCoaching: boolean | null;
    leaders: { membershipId: string | null; name: string; areas: { kode: string; label: LabelPair }[] }[];
  };

export interface CoachingSurvey {
  state: 'answered' | 'not_answered' | 'anonymous' | 'none';
  run: { runId: string; periodKey: string; opensOn: string; closesOn: string; submittedOn: string | null } | null;
  person: { roleClass: RoleClass; workStatus: string | null; tenureYears: number | null; age: number | null; generation: number | null } | null;
  issueMaxRating: number | null;
  issueCounts: { kode: string; title: LabelPair; count: number }[];
  aspiration: { kode: string; options: { kode: string; label: LabelPair; chosen: boolean }[]; note: string | null } | null;
  sections: CoachingSection[];
}

export const readCoachingSurvey = (membershipId: string) =>
  api<CoachingSurvey>(`/coaching/${encodeURIComponent(membershipId)}/survey`);

/**
 * **Whether a screen's answer is whole** — the server's `isAnswered`, mirrored so *Lanjut* and *Kirim* wait for a
 * required answer. The server decides again on *Kirim*.
 */
export function answered(q: FormQuestion, value: AnswerValue | undefined): boolean {
  if (!value) return false;
  switch (q.type) {
    case 'score':
    case 'support':
      return typeof value.score === 'number';
    case 'text':
      return typeof value.text === 'string' && value.text.trim() !== '';
    case 'aspiration':
      return Array.isArray(value.chosen) && value.chosen.length > 0;
    case 'scale_items':
    case 'unit_items':
    case 'state_items':
      return q.items.every((i) => value[i.kode] !== undefined);
    case 'downline_yes_no':
      return value.answer === 'yes' || value.answer === 'no';
    case 'downline_areas':
      return Array.isArray(value.leaders) && value.leaders.length > 0;
  }
}

/** The whole numbers of a scale. */
export const scaleOf = (scale: { min: number; max: number } | null) =>
  (scale ? Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i) : []);
