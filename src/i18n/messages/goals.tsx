import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { Voice } from './goal-words';

/**
 * **Goal Settings' own words** (P18.98-T4, field selling; `functional/goals.md`): `/goals` and the calculator a coachee's
 * *Goal Setting* tab mounts too (`components/goal-calculator.tsx`) — its five steps, their fields and tiles, *Save goal*
 * and its status, the cascade, the commitment, the disclaimer, and the states a plan can be in. The marker beside the
 * APE produced and the months left in words are `lib/goals.ts`' (`goal-words.ts`).
 *
 * **UI V1 (P18.99-T5, 2026-10-30)**: the result card on top (UI-014), the commitment in the report's shorter sentence
 * built from the result card's own three names (UI-017), the save state the shared one's (`save-state.tsx`, UI-019) and
 * the ⚡ the shared marker's (`auto-marker.tsx`, UI-020) — so this area no longer holds a status, an *auto* badge or a
 * per-month line.
 *
 * **English is the source** of the keys, the prototype's words as built (`Overall.html:2860-3070`, the coaching tool's
 * `:5854-6104`); the Indonesian is the approved glossary's (OD-237; §B.0's voice), with the words it lacked added to the
 * glossary for approval's §B.10. **Kept English in both** (§A): the title; §A.4's Goal Settings KPI labels — *Annual APE
 * target*, *Annual savings target*, *APE already produced this year*, *This month's APE target*, *Policies per month*,
 * *Policies per week*, *Monthly activity target*, *Conversion assumptions*, *Closing rate*, *Commission rate* — and
 * *Appointment to Sales meeting* beside *Closing rate* (for approval); the cascade's three stages (§A.6); *APE*,
 * *goal*, *target*, *lead*, *closing*, *case size*, *leader*; *Activity Management*, *Personal Summary* and *Coaching
 * Session*. *Policy* is *polis*. **A person is *dia*** whatever their pronoun, the reader *Anda* — and *saya* in the
 * commitment, which the reader says of themselves. **Content stays as typed** (ADR-0179 §5): the activities each
 * stage's chip names, and the server's refusals. **A figure is never a message's**: a sum, a rate, a count of the plan
 * and a day are written by the caller in the figures' language and passed in.
 *
 * @moved components/goal-calculator.tsx
 * @moved app/(agent)/goals/
 */

/** Words drawn bold: the commitment's figures, amber on navy; *Set by your leader*; the target passed. */
type Strong = (words: string) => ReactNode;

/** A sentence's first word: *she* → *She*. */
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const en = {
  /** The page (`Overall.html:10405`): its title, kept (§A.2), and the prototype's line, verbatim. */
  title: kept('Goal Settings'),
  subtitle: "Turn your annual target into this month's activity numbers.",
  /** While the plan is read: *Loading your plan…*, *Loading her plan…*. */
  loading: ({ who }: { who: Voice }) => `Loading ${who.possessive} plan…`,
  /** ADR-0046: a leader saved the reader's own plan. `date` the day, written by the caller, or `null`. */
  setByLeader: ({ strong, date }: { strong: Strong; date: string | null }) => (
    <>{strong('Set by your leader')}{date ? ` on ${date}` : ''}. You can change it — it is your plan.</>
  ),

  /** Step 1: the question, in the coaching tool's own words for somebody else's plan (`Overall.html:5860`). */
  target: { mine: "What's your APE target this year?", theirs: "What's their APE target this year?" },
  /** The button (`:2854-2862`); its status is the shared save state's (UI-019). */
  save: 'Save goal',
  /** The two ways to set it (`:2865-2868`), and the pair's name for a screen reader. */
  how: { mine: 'How you want to set it', theirs: 'How to set it' },
  modes: { direct: 'Set APE target directly', fromSavings: 'Calculate from savings target' },
  annualApe: 'Annual APE target',
  annualSavings: 'Annual savings target',
  commissionRate: 'Commission rate',
  commissionHint: '% of APE that becomes income / savings',
  apeTargetOf: 'That is an APE target of',

  /** Step 2. */
  progress: { mine: 'Your current progress', theirs: 'Current progress' },
  monthsLeftThisYear: 'Months left this year',
  /** The months field's unit, beside its box. */
  months: 'months',
  produced: 'APE already produced this year',
  remaining: 'Remaining needed',
  monthlyTarget: "This month's APE target",

  /** Step 3. */
  toPolicies: 'From APE to policy count',
  caseSize: 'Average case size (APE per policy)',
  /** The prototype's 💡 tip, verbatim (`Overall.html:2971`), in a phone's ⓘ (grey text row 15). */
  caseSizeTip: 'APE per closing. Increase if one appointment often yields multiple policies.',
  policiesPerMonth: 'Policies per month',
  /** *Policies per month*'s unit, inside its tile. */
  policies: 'policies',
  policiesPerWeek: 'Policies per week',

  /** Step 4 (ADR-0160 §4): the client's label, and the prototype's. */
  assumptions: 'Conversion assumptions',
  appointmentToMeeting: kept('Appointment to meeting'),
  closingRate: 'Closing rate',

  /** Step 5. */
  activityTarget: 'Monthly activity target',
  /** ADR-0047: the annual target is reached, so the cascade gives way to this. */
  passed: ({ who, strong }: { who: Voice; strong: Strong }) => (
    <>
      {strong(`${cap(who.subject)} ${who.have} passed ${who.possessive} annual target.`)} Set a new one above, or keep
      going — there is nothing left for this plan to ask of {who.object}.
    </>
  ),
  /** A result tile's week (ADR-0160 §5; UI-014): `n` written by the caller, *≈ 10/week*. */
  perWeek: ({ n }: { n: string }) => `≈ ${n}/week`,
  /** The inputs make no plan. */
  unworkable: 'This plan cannot be worked out from the numbers above. Check the case size and the two conversion '
    + 'rates — each has to be more than zero.',
  /** The prototype's 🔗 tip (`:3062-3065`), the office's own numbers in it: *#3, #4, #6*. */
  mapsTo: ({ numbers }: { numbers: string }) => `Maps to activities ${numbers} in Activity Management.`,

  /** The commitment's heading (`:3070`, *Commitment* on the coaching tool, `:5971`): `date` the day it was saved. */
  commitment: ({ mine, date }: { mine: boolean; date: string | null }) =>
    `${mine ? 'My commitment' : 'Commitment'}${date ? ` (as of ${date})` : ''}`,
  /**
   * **The commitment** (UI V1, UI-017: the owner's shorter sentence of 2026-10-30): this month's APE, the year's, and the
   * result card's three figures **under the result card's own three names** (`stages`, passed by the caller), so the two
   * cannot drift. Whose plan it is needs no pronoun. Every figure is the caller's, written in the figures' language;
   * `strong` paints each amber.
   */
  pledge: ({ strong, monthly, annual, stages }: {
    strong: Strong; monthly: string; annual: string; stages: readonly { n: string; label: string }[];
  }) => (
    <>
      This month, APE {strong(monthly)} (on the way to {strong(annual)} this year):{' '}
      {stages.map((stage, i) => <span key={stage.label}>{i > 0 ? ', ' : ''}{strong(`${stage.n} ${stage.label}`)}</span>)}.
    </>
  ),
  /** The retired section files' one admission that the cascade is an estimate (L-29). */
  disclaimer: 'Estimates for personal planning — assumptions vary per individual.',
  /** The coaching tab's footer, verbatim (`Overall.html:4327`). */
  inSync: 'Changes here update instantly in Personal Summary and Coaching Session — all three stay in sync.',
};

const id: MessagesOf<typeof en> = {
  title: kept('Goal Settings'),
  subtitle: `Ubah ${kept('target')} tahunan Anda menjadi angka aktivitas bulan ini.`,
  loading: ({ who }) => (who.self ? 'Memuat rencana Anda…' : 'Memuat rencananya…'),
  setByLeader: ({ strong, date }) => (
    <>{strong(`Diatur oleh ${kept('leader')} Anda`)}{date ? ` pada ${date}` : ''}. Anda dapat mengubahnya — ini rencana Anda.</>
  ),

  target: {
    mine: `Berapa ${kept('target')} ${kept('APE')} Anda tahun ini?`,
    theirs: `Berapa ${kept('target')} ${kept('APE')}-nya tahun ini?`,
  },
  save: `Simpan ${kept('goal')}`,
  how: { mine: 'Cara Anda ingin mengaturnya', theirs: 'Cara mengaturnya' },
  modes: {
    direct: `Atur ${kept('target')} ${kept('APE')} langsung`,
    fromSavings: `Hitung dari ${kept('target')} tabungan`,
  },
  annualApe: 'Target APE tahunan',
  annualSavings: 'Target tabungan tahunan',
  commissionRate: 'Persentase komisi',
  commissionHint: `% dari ${kept('APE')} yang menjadi penghasilan / tabungan`,
  apeTargetOf: `Setara dengan ${kept('target')} ${kept('APE')} sebesar`,

  progress: { mine: 'Progres Anda saat ini', theirs: 'Progres saat ini' },
  monthsLeftThisYear: 'Sisa bulan tahun ini',
  months: 'bulan',
  produced: 'APE yang sudah dicapai tahun ini',
  remaining: 'Sisa yang dibutuhkan',
  monthlyTarget: 'Target APE bulan ini',

  toPolicies: `Dari ${kept('APE')} ke jumlah polis`,
  caseSize: `Rata-rata ${kept('case size')} (${kept('APE')} per polis)`,
  caseSizeTip: `${kept('APE')} per ${kept('closing')}. Naikkan jika satu janji temu sering menghasilkan lebih dari satu polis.`,
  policiesPerMonth: 'Polis per bulan',
  policies: 'polis',
  policiesPerWeek: 'Polis per minggu',

  assumptions: 'Asumsi konversi',
  appointmentToMeeting: kept('Appointment to meeting'),
  closingRate: 'Tingkat closing',

  activityTarget: 'Target aktivitas bulanan',
  passed: ({ who, strong }) => (
    <>
      {strong(who.self
        ? `Anda sudah melampaui ${kept('target')} tahunan Anda.`
        : `Dia sudah melampaui ${kept('target')} tahunannya.`)}{' '}
      Atur yang baru di atas, atau terus melaju — tidak ada lagi yang diminta rencana ini {who.self ? 'dari Anda' : 'darinya'}.
    </>
  ),
  perWeek: ({ n }) => `≈ ${n}/minggu`,
  unworkable: 'Rencana ini tidak dapat dihitung dari angka di atas. Periksa '
    + `${kept('case size')} dan kedua tingkat konversi — masing-masing harus lebih dari nol.`,
  mapsTo: ({ numbers }) => `Terhubung ke aktivitas ${numbers} di ${kept('Activity Management')}.`,

  commitment: ({ mine, date }) => `${mine ? 'Komitmen saya' : 'Komitmen'}${date ? ` (per ${date})` : ''}`,
  // The report's own sentence (UI-017, the owner's of 2026-10-30): *Bulan ini APE Rp 100 jt (menuju Rp 500 jt tahun ini):
  // 40 Set appointment, 20 Sales meeting, 6 Submission polis.*
  pledge: ({ strong, monthly, annual, stages }) => (
    <>
      Bulan ini {kept('APE')} {strong(monthly)} (menuju {strong(annual)} tahun ini):{' '}
      {stages.map((stage, i) => <span key={stage.label}>{i > 0 ? ', ' : ''}{strong(`${stage.n} ${stage.label}`)}</span>)}.
    </>
  ),
  disclaimer: 'Perkiraan untuk perencanaan pribadi — asumsi berbeda untuk setiap orang.',
  inSync: `Perubahan di sini langsung diperbarui di ${kept('Personal Summary')} dan ${kept('Coaching Session')} — `
    + 'ketiganya tetap selaras.',
};

export const goalsMessages = defineMessages({ en, id });
