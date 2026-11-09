import { api } from './api-client';

/**
 * **Home** (UI V1, 2026-10-30, Phase 18.11 T11; UI-100, UI-101; `functional/home.md`): `GET /home`, every block of the
 * page in one read. The screen draws the server's figures and adds nothing up: the tiles are the Unit Dashboard's, the
 * schedule Calendar's, the counts Activity Management's.
 *
 * Each interface is flat, as `contract.spec.ts` reads them against the API document.
 */

/** The office's wall clock as the read was made. */
export interface HomeNow {
  /** Minutes since the office's midnight: the greeting's time of day. */
  minute: number;
}

/** Boost's four quote poses, the day number mod 4 (the server's `HOME_QUOTE_POSES`). */
export type HomeQuotePose = 'thinking' | 'celebrating' | 'pointing' | 'phone';

/** The quote of the day: in the language it was said in, whatever the reader's — content, never a catalogue string. */
export interface HomeQuote {
  index: number;
  text: string;
  person: string;
  pose: HomeQuotePose;
}

export interface HomeDay {
  date: string;
  count: number;
}

/** *Aktivitas saya* and the 7-day chart: the reader's saved totals. */
export interface HomeActivity {
  today: number;
  yesterday: number;
  /** The seven office days ending today, oldest first. */
  days: HomeDay[];
  total: number;
}

/** *Jadwal hari ini*: today's timed items, and today's open *Tugas*. */
export interface HomeSchedule {
  meetings: number;
  tasks: number;
}

/** Somebody a row names, with the WhatsApp number on their account. */
export interface HomePerson {
  membershipId: string;
  name: string;
  phone: string | null;
}

export interface HomeLeadContact {
  phone: string | null;
  email: string | null;
}

/** A coaching action item due today: *Dari: NAME* and the item. */
export interface HomeCoachingAction {
  kind: 'coaching';
  sessionId: string;
  itemId: string;
  text: string;
  from: HomePerson | null;
}

/** A lead whose next action is today. */
export interface HomeLeadAction {
  kind: 'lead';
  leadId: string;
  name: string;
  type: 'sales' | 'recruitment' | null;
  note: string | null;
  contact: HomeLeadContact;
  version: number;
}

/** A timed item: today's not yet ended, or the next days'. */
export interface HomeAgendaAction {
  kind: 'agenda';
  source: 'entry' | 'event';
  id: string;
  /** An entry's type code, or a joined event's type as the office named it. */
  type: string;
  title: string;
  date: string;
  /** `HH:mm`, the office's. */
  start: string;
}

export type HomeAction = HomeCoachingAction | HomeLeadAction | HomeAgendaAction;

export interface HomeCountOf {
  count: number;
  of: number;
}

/** A leader tile's figure with its *Unit* / *AAB* split. */
export interface HomeSplit {
  count: number;
  of: number;
  unit: HomeCountOf;
  aab: HomeCountOf;
}

/** One person on *Laporan tim*. */
export interface HomeTeamPerson {
  membershipId: string;
  name: string;
  phone: string | null;
  /** A signed link; `null` draws initials. */
  photoUrl: string | null;
  inUnit: boolean;
  /**
   * **Their rung** (P19.9-T2 AC-2; ADR-0235): the code and the company's own label — the *Group* tab's tag, in the
   * company's short words (`RungTag`: *AB · AAB · Agent*).
   */
  rung: HomeRung;
  /** The day's saved total, `null` for no saved day. */
  yesterday: number | null;
  today: number | null;
}

/** A rung as `GET /home` names it: its code on the company's ladder, and the company's label for it. */
export interface HomeRung {
  code: string;
  label: string;
}

/**
 * The leader's part of Home — sent for **every leader by role**, at zero with no team yet (ADR-0189 §4, ADR-0228 §4);
 * `null` for an Agent. *Changed 2026-11-07 (P19.8-T2): `members` and `recruitmentPipeline` left with *Tim saya*;
 * `newHires` is the view's.*
 */
export interface HomeLeader {
  activeAgent: HomeSplit;
  coached7d: HomeSplit;
  /** *Laporan aktivitas tim*, in UI-101's order: nobody-reported first. */
  team: HomeTeamPerson[];
}

export interface HomeView {
  today: string;
  yesterday: string;
  month: string;
  now: HomeNow;
  quote: HomeQuote;
  activity: HomeActivity;
  schedule: HomeSchedule;
  actions: HomeAction[];
  /** *Leads* (`OWN_OPEN_LEADS`; P19.9-T1 AC-5, ADR-0232): every open lead the reader owns — what `/leads` opens on. */
  leads: number;
  /** *New hires*: the reader's Group's new hires before a first sale; 0 when they lead nobody. */
  newHires: number;
  leader: HomeLeader | null;
}

export const readHome = () => api<HomeView>('/home');

/**
 * *Laporan aktivitas tim* shows five, then *Semua ›* (UI-101, MOB UI-165), which **opens the rest in place** (P19.9-T2
 * AC-1, R8; ADR-0235, OD-278 option 3) — where from P19.8-T2 it went to the Unit Dashboard's *Aktivitas* tab.
 */
export const HOME_TEAM_SHOWN = 5;

/** Where *Tambah user* goes (P19.8-T2 AC-3; OD-277 by its default, ADR-0228 §3): the existing *Add New Agents* page. */
export const ADD_USER_HREF = '/user-management/add';

/** Where *Tambah agent pertama →* goes (P19.8-T2 AC-9; ADR-0228 §6): New Hires, where *+ Tambah agent* is. */
export const FIRST_AGENT_HREF = '/new-hires';

/** A part of the day, for the greeting: *Pagi*, *Siang*, *Sore*, *Malam*. */
export type DayPart = 'morning' | 'midday' | 'afternoon' | 'evening';

/**
 * **The greeting's part of the day** (UI-100: *time of day + first name*), by the office's wall clock: morning from 04:00,
 * midday (*siang*) from 11:00, afternoon (*sore*) from 15:00, evening (*malam*) from 18:00 to 03:59 — the Indonesian day's
 * four greetings. Cosmetic, so a page left open across a boundary keeps the one it opened with.
 */
export function dayPartOf(minute: number): DayPart {
  const hour = Math.floor((((minute % 1440) + 1440) % 1440) / 60);
  if (hour >= 4 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  return 'evening';
}

/** A person's first name, as the greeting and the reminder write it: the first word of the name on their account. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** *Laporan tim*'s two scopes: the reader's *Unit* (them and their direct agents), or the whole *Group*. */
export type HomeScope = 'unit' | 'group';

/** The list for a scope, in the server's order. The reader is never on it. */
export function teamIn(team: readonly HomeTeamPerson[], scope: HomeScope): HomeTeamPerson[] {
  return scope === 'unit' ? team.filter((p) => p.inUnit) : [...team];
}

/** Reported, as the pill draws it: above zero (the server's `reported`, `home-figures.ts`). */
export const reportedOn = (count: number | null): boolean => count !== null && count > 0;

/** The link the WhatsApp reminder carries (UI-101): today's Log Activity, on the host the reader is using. */
export function logLink(host: string): string {
  return `${host}/activity/log`;
}
