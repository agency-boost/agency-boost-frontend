import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **A forum meeting's *Overview & Stats*: the client's reference slide** (P18.98-T4, people and forum; ADR-0175;
 * `functional/leader-forum.md`, *Overview & Stats* and *The module's own strings*) — the strip, the table's columns, its
 * groups and rows, the section bands, the numbered footnotes, the *(\*)* notes, a cell's words for a screen reader, a
 * phone's card and a *Monthly Target*'s field. Drawn by `components/leader-forum/scorecard.tsx` and the print, and
 * written by `lib/leader-meeting-tabs.ts`.
 *
 * **English is the source**: the slide's labels as built and the module's own (D-copy), none of the six words in either
 * language. **Almost all of it is kept** (§A.4): every KPI and row name, the columns and their groups, *TBD* and *AS
 * OF* — written `kept('…')` in both languages, the unit beside *APE* and *Avg. Case Size* a format (§E, `rowName`). What
 * is ours to say is Indonesian: *menunggu data*, *Tidak dilacak*, the reasons for *—*, the footnotes and the notes.
 * **A figure is never a message's**: a month, a date, a count or a change is written by the caller in the figures'
 * language (`useFigureLanguage()`) and passed in.
 *
 * @moved lib/leader-meeting-tabs.ts
 * @moved components/leader-forum/scorecard.tsx
 */
const en = {
  /** The KPI strip (UI-011), in its order. */
  chips: {
    manpower: kept('Manpower'),
    agents: kept('# of agents'),
    units: kept('# of units'),
    ab: kept('# of AB'),
    aab: kept('# of AAB'),
  },
  metrics: kept('Metrics'),
  monthlyTarget: kept('Monthly Target'),
  /** The slide's two spanning labels (UI-003). */
  groups: { year: kept('Full Year & YTD View'), month: kept('Monthly View') },
  columns: {
    fy: kept('Full Year'),
    ytd: kept('YTD'),
    thisMonthLastYear: kept('This Month, Last Year'),
    lastMonth: kept('Last Month'),
    thisMonth: kept('This Month'),
  },
  /** The slide's rows, in its order (UI-004); a money row's unit is written beside its name (`rowName`). */
  rows: {
    ape: kept('APE'),
    manpower: kept('Manpower'),
    flc: kept('FLC (avg. monthly)'),
    producing_agents: kept('Annual Active Agents'),
    new_agent_3m: kept('3M new agent %'),
    avg_monthly_aa: kept('Avg. monthly AA'),
    case_submission: kept('Case submission'),
    cases_per_producing_agent: kept('Cases/producing agents'),
    average_case_size: kept('Avg. Case Size'),
  },
  /** The section bands (UI-004): before *3M new agent %*, before *Case submission*. */
  sections: { new_agent_3m: kept('Activation'), case_submission: kept('Productivity') },
  /** A cell no source holds a figure for. */
  pending: 'pending data',
  /** *APE*'s *Monthly Target* with no rate (UI-008). */
  tbd: kept('TBD'),
  /** A cell the table does not track, for a screen reader (I-255, I-484). */
  notTracked: 'Not tracked',
  /** *—* on a scorecard kept before the column or the row existed (I-495). */
  unrecorded: 'Not recorded for this meeting.',
  /** *—*, a ratio over nothing — each row's own reason. */
  none: {
    average_case_size: 'No policies in this period.',
    cases_per_producing_agent: 'No annual active agents in this period.',
  },
  /** A figure over part of its period: its mark, for a screen reader (I-488). */
  partialMark: 'covers part of its period; see the notes below',
  /** *AS OF* (UI-010), the slide's capitals; for a screen reader where a kept scorecard has none. */
  asOf: kept('AS OF'),
  asOfUnrecorded: 'AS OF: not recorded for this meeting',
  /** A phone's card (UI-014, I-493): the change against last year. */
  change: 'Change',
  /** On a percentage row, the change in percentage points (P18.97-T8 F1): `figure` written, `points` the number. */
  points: ({ sign, figure, points }: { sign: string; figure: string; points: number }) =>
    `${sign}${figure} ${points === 1 ? 'point' : 'points'}`,
  /** A *Monthly Target* input's name: the column, its rate, then the row (I-487). */
  targetName: ({ row }: { row: string }) => `Monthly Target per unit, ${row}`,
  /** A rate the field cannot read (P18.97-T1 AC-10); `example` a figure in the reader's marks. */
  notARate: ({ example }: { example: string }) => `Type a number from 0, like 1 or ${example}.`,
  /**
   * The four footnotes, in our metrics' words (P18.97-T1 AC-12; ADR-0175 §5) — *the monthly production file* where the
   * ADR says *the office's file*: the same file, in none of the six words.
   */
  footnotes: {
    producing_agents:
      'Annual Active Agents — members with APE or a policy in the monthly production file in at least one month of the period.',
    new_agent_3m:
      // UI-023, rule A: a first case by day 90 counts at once; one after day 90 counts on neither side.
      '3M new agent % — of the new hires who joined in the period and whose result is decided, the share with a first paid and issued case by day 90 of their join date. A first case after day 90 counts on neither side.',
    avg_monthly_aa: 'AA — Active Agent, a member whose month shows APE or a policy in the monthly production file.',
    case_submission: 'Case submission and Avg. Case Size — the policies in the monthly production file, and its APE over them.',
  },
  /**
   * One *(\*)* note per partial period, in the client's words (AC-12): `column` the column's name, `months` the run it
   * covers and `without` the months it leaves out, each written.
   */
  partial: {
    noFigures: ({ column }: { column: string }) => `(*) ${column}: no figures uploaded for it yet`,
    earlier: ({ column, months }: { column: string; months: string }) =>
      `(*) ${column} covers ${months} only; earlier months not uploaded`,
    later: ({ column, months }: { column: string; months: string }) =>
      `(*) ${column} covers ${months} only; later months not uploaded`,
    gap: ({ column, months, without }: { column: string; months: string; without: string }) =>
      `(*) ${column} covers ${months} without ${without}, not uploaded`,
  },
};

const id: MessagesOf<typeof en> = {
  chips: {
    manpower: kept('Manpower'),
    agents: kept('# of agents'),
    units: kept('# of units'),
    ab: kept('# of AB'),
    aab: kept('# of AAB'),
  },
  metrics: kept('Metrics'),
  monthlyTarget: kept('Monthly Target'),
  groups: { year: kept('Full Year & YTD View'), month: kept('Monthly View') },
  columns: {
    fy: kept('Full Year'),
    ytd: kept('YTD'),
    thisMonthLastYear: kept('This Month, Last Year'),
    lastMonth: kept('Last Month'),
    thisMonth: kept('This Month'),
  },
  rows: {
    ape: kept('APE'),
    manpower: kept('Manpower'),
    flc: kept('FLC (avg. monthly)'),
    producing_agents: kept('Annual Active Agents'),
    new_agent_3m: kept('3M new agent %'),
    avg_monthly_aa: kept('Avg. monthly AA'),
    case_submission: kept('Case submission'),
    cases_per_producing_agent: kept('Cases/producing agents'),
    average_case_size: kept('Avg. Case Size'),
  },
  sections: { new_agent_3m: kept('Activation'), case_submission: kept('Productivity') },
  pending: 'menunggu data',
  tbd: kept('TBD'),
  notTracked: 'Tidak dilacak',
  unrecorded: 'Tidak tercatat untuk rapat ini.',
  none: {
    average_case_size: 'Tidak ada polis dalam periode ini.',
    cases_per_producing_agent: `Tidak ada ${kept('Annual Active Agents')} dalam periode ini.`,
  },
  partialMark: 'hanya mencakup sebagian periodenya; lihat catatan di bawah',
  asOf: kept('AS OF'),
  asOfUnrecorded: `${kept('AS OF')}: tidak tercatat untuk rapat ini`,
  change: 'Perubahan',
  points: ({ sign, figure }) => `${sign}${figure} poin`,
  targetName: ({ row }) => `${kept('Monthly Target')} per ${kept('unit')}, ${row}`,
  notARate: ({ example }) => `Ketik angka mulai dari 0, misalnya 1 atau ${example}.`,
  footnotes: {
    producing_agents:
      `${kept('Annual Active Agents')} — anggota yang memiliki ${kept('APE')} atau polis di file produksi bulanan, minimal dalam satu bulan pada periode ini.`,
    new_agent_3m:
      `${kept('3M new agent %')} — dari agen baru yang bergabung dalam periode ini dan hasilnya sudah ditetapkan, persentase yang memiliki ${kept('case')} pertama yang dibayar dan terbit paling lambat hari ke-90 sejak tanggal bergabungnya. ${kept('Case')} pertama setelah hari ke-90 tidak dihitung di kedua sisi.`,
    avg_monthly_aa:
      `${kept('AA')} — ${kept('Active Agent')}, anggota yang bulannya menunjukkan ${kept('APE')} atau polis di file produksi bulanan.`,
    case_submission:
      `${kept('Case submission')} dan ${kept('Avg. Case Size')} — polis di file produksi bulanan, dan ${kept('APE')}-nya dibagi jumlah polis tersebut.`,
  },
  partial: {
    noFigures: ({ column }) => `(*) ${column}: belum ada angka yang diunggah untuk periode ini`,
    earlier: ({ column, months }) => `(*) ${column} hanya mencakup ${months}; bulan-bulan sebelumnya belum diunggah`,
    later: ({ column, months }) => `(*) ${column} hanya mencakup ${months}; bulan-bulan berikutnya belum diunggah`,
    gap: ({ column, months, without }) => `(*) ${column} mencakup ${months} tanpa ${without}, yang belum diunggah`,
  },
};

export const forumStatsMessages = defineMessages({ en, id });
