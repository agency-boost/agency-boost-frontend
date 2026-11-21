'use client';

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
 * The reminder's one read (C-R2) lives in `survey-pending.ts`, which the shell's tab bar and *Lainnya* import without the
 * rest of this client (the bundle, 2026-11-06). Re-exported, so every reader shares the one store.
 */
export { hasSurveyDot, refreshPending, resetPending, useSurveyPending } from './survey-pending';

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

/** *Semua · Leader · Agent* (P19.22-T6 AC-1, T7 AC-1; ADR-0276 §3): the leaders are the ABs and the AABs. */
export type SurveyWho = 'all' | 'leader' | 'agent';
export const SURVEY_WHO: readonly SurveyWho[] = ['all', 'leader', 'agent'];

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
  /** *x dari y menjawab · n leader · n agent*. */
  responses: { sent: number; invited: number; pct: number | null; leaders: number; agents: number };
  /** *Survei sebelumnya*'s *NPS x%*; `null` for a qualitative run or under the floor. */
  headlineScore: number | null;
}

/** A quote with its writer's class, or `null` where that would name them (ADR-0276 §3). */
export interface SurveyQuote {
  text: string;
  who: 'leader' | 'agent' | null;
}

export interface NpsShares {
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

/** The *Keseluruhan KPM* card, or one question's row. */
export interface NpsLine {
  kode: string;
  text: LabelPair;
  aspect: string;
  score: number | null;
  n: number;
  /** In *poin*. */
  change: number | null;
  textChanged: boolean;
  shares: NpsShares | null;
  /** Oldest first, this run last; a hidden run `null`. */
  trend: (number | null)[];
  reasons: SurveyQuote[] | null;
}

export interface NpsResults {
  cutoffs: { promoterMin: number; passiveMin: number };
  who: SurveyWho;
  whoShown: boolean;
  respondents: number;
  headline: NpsLine | null;
  /** Lowest score first. */
  questions: NpsLine[];
  trendPeriods: string[];
  /** The open question's answers: what the respondents would improve. */
  improve: SurveyQuote[] | null;
}

export interface QualRow {
  questionKode: string;
  itemKode: string;
  label: LabelPair;
  kind: 'rating' | 'state';
  answers: number;
  issuePct: number | null;
  severity: 'big' | 'watch' | null;
  previousPct: number | null;
  trend: 'worse' | 'better' | 'same' | null;
  /** *D*: *tidak nyaman x%*. */
  comfortPct: number | null;
}

export interface QualBlockResult {
  kode: string;
  title: LabelPair;
  audience: 'all' | 'leader';
  questionKodes: string[];
  asked: boolean;
  respondents: number;
  rows: QualRow[];
}

export interface QualResults {
  who: SurveyWho;
  whoShown: boolean;
  respondents: number;
  cutoffs: { qualIssueMaxRating: number; supportPromMin: number; supportPasMin: number };
  profile: {
    workStatus: { fullTime: number; partTime: number; unknown: number } | null;
    tenure: { counts: number[]; unknown: number; bands: [number, number, number] } | null;
  };
  aspiration: { kode: string; label: LabelPair; pct: number | null; leaderPct: number | null; agentPct: number | null }[];
  aspirationNotes: SurveyQuote[] | null;
  blocks: QualBlockResult[];
  support: {
    rater: 'agent' | 'leader'; n: number; average: number | null; satisfiedPct: number | null; fairPct: number | null;
    poorPct: number | null;
  }[];
  coachingDownline: {
    asked: boolean; n: number; yes: number | null; pct: number | null; good: boolean | null;
    rows: { leaderId: string; uplineId: string; leaderName: string; uplineName: string; areas: string[]; independent: boolean }[] | null;
  };
  voices: SurveyQuote[] | null;
}

/** One line of *Pratinjau survei*. */
export interface PreviewLine {
  kodes: string[];
  text: LabelPair;
  type: string;
  audience: 'all' | 'leader';
  items: number;
}

/** ***Survei baru*** (ADR-0276 §2). */
export interface SendView {
  periodKey: string;
  opensOn: string;
  closesOnMax: string;
  invitable: number;
  run: RunView | null;
  notAnswered: { membershipId: string; name: string; roleClass: RoleClass }[] | null;
  preview: PreviewLine[];
  minutes: number;
}

export interface SurveyResults {
  kind: SurveyKind;
  today: string;
  visible: boolean;
  sectionOn: boolean;
  canWrite: boolean;
  audience: 'office' | 'core_leader' | 'summary';
  who: SurveyWho;
  template: { cadence: 'quarter' | 'half'; qualMonths: number[]; defaults: { anonymous: boolean; perPerson: boolean; remindHalfway: boolean } };
  runs: RunView[];
  selected: (RunView & { previousRunId: string | null; nps: NpsResults | null; qual: QualResults | null }) | null;
  send: SendView;
}

export interface RunInput {
  opensOn: string;
  closesOn: string;
  invitedRoleClasses: RoleClass[];
  anonymous: boolean;
  perPerson?: boolean;
  remindHalfway: boolean;
}

/**
 * The NPS or *Kualitatif* tab: `runId` (else the newest opened) in one view. P19.5-T3 AC-12: the Super Admin's *Lihat
 * sebagai KPM* reads the same tab as a summary through the platform's route.
 */
export function readResults(kind: SurveyKind, runId?: string, platformKpmId?: string, who: SurveyWho = 'all') {
  const query = [runId ? `runId=${encodeURIComponent(runId)}` : '', who !== 'all' ? `who=${who}` : ''].filter(Boolean).join('&');
  if (platformKpmId !== undefined) {
    const kpm = encodeURIComponent(platformKpmId);
    return api<SurveyResults>(`/admin/tenants/${kpm}/advanced-analytics/${kind}?${query}`);
  }
  return kind === 'nps'
    ? api<SurveyResults>(`/kpm/advanced-analytics/nps${query ? `?${query}` : ''}`)
    : api<SurveyResults>(`/kpm/advanced-analytics/qual${query ? `?${query}` : ''}`);
}

/** One row of *Per orang* (P19.22-T7 AC-3). */
export interface SurveyPersonRow {
  membershipId: string;
  name: string;
  photoUrl: string | null;
  roleClass: RoleClass;
  upline: string | null;
  groupId: string | null;
  workStatus: 'full_time' | 'part_time' | null;
  tenureYears: number | null;
  age: number | null;
  generation: number | null;
  answered: boolean;
  issues: number | null;
  canOpen: boolean;
  phone: string | null;
}

export interface SurveyPeople {
  today: string;
  audience: 'office' | 'core_leader' | 'summary';
  runs: { runId: string; periodKey: string; state: 'scheduled' | 'open' | 'closed' }[];
  run: { runId: string; periodKey: string; state: 'scheduled' | 'open' | 'closed'; anonymous: boolean; perPerson: boolean } | null;
  answersShown: boolean;
  groups: { groupId: string; name: string }[];
  issueMaxRating: number | null;
  people: SurveyPersonRow[] | null;
}

/** One person's answers, opened under their row. */
export interface SurveyPersonAnswers {
  membershipId: string;
  runId: string;
  roleClass: RoleClass;
  person: { workStatus: 'full_time' | 'part_time' | null; tenureYears: number | null; age: number | null; generation: number | null };
  issueMaxRating: number;
  tiles: { kode: string; title: LabelPair; count: number; of: number }[];
  aspiration: { kode: string; options: { kode: string; label: LabelPair; chosen: boolean }[]; note: string | null } | null;
  sections: CoachingSection[];
  /** Q12's score: the office's alone. */
  support: { kode: string; score: number | null } | null;
}

export const readPeople = (runId?: string) =>
  (runId
    ? api<SurveyPeople>(`/kpm/advanced-analytics/qual/people?runId=${encodeURIComponent(runId)}`)
    : api<SurveyPeople>('/kpm/advanced-analytics/qual/people'));

export const readPersonAnswers = (membershipId: string, runId: string) =>
  api<SurveyPersonAnswers>(
    `/kpm/advanced-analytics/qual/people/${encodeURIComponent(membershipId)}?runId=${encodeURIComponent(runId)}`,
  );

/** *Leader* for an AB and an AAB, *Agent* for the rest: the class a quote or a row is tagged with. */
export const isLeaderRole = (roleClass: RoleClass) => roleClass !== 'agent';

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
