import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The glossary terms' tips** (`lib/terms.ts`, drawn by `TermTip`; P18.95-T9 AC-3, P18.97-T3 AC-8; P18.98-T4, the
 * shared pieces): each ⓘ's name, *What is APE?*, and its one line.
 *
 * **English is the source**, byte for byte the tips as they were (`TERMS`, which keeps them in its old shape). **A kept
 * term's name stays kept** (§A: *APE*, *MDRT*, *AAB*, *MOC*, the three clubs, *Potential Monthly Active Agent*) and is
 * written `kept('…')` inside the Indonesian; **the explanation moves**. The industry's and the insurer's words that an
 * office or a company types in its own labels and copy — *NBO*, *NPA*, *BOP*, *JFW* (§C11), *CI premium waiver*,
 * *as-billed* — are named as the content spells them, since the ⓘ sits beside that content. *Touch* is *sentuhan*
 * (§B.10). The Indonesian follows the approved glossary — *polis*, *klub*, *goal*, *leader*, *agen*, *kandidat*,
 * *nasabah* — and is for approval as whole sentences in the glossary for approval's §B.10.
 *
 * @moved lib/terms.ts
 */
const en = {
  APE: {
    question: 'What is APE?',
    definition: 'Annualised Premium Equivalent: a policy’s first-year premium, counted as a full year’s. Goals, production and clubs all count in it.',
  },
  MDRT: {
    question: 'What is MDRT?',
    definition: 'Million Dollar Round Table: the international club for the top-producing advisers, qualified by a year’s production.',
  },
  AAB: {
    question: 'What is AAB?',
    definition: 'Associate Agency Builder: a leader under an AB, with agents of their own.',
  },
  NBO: {
    question: 'What is NBO?',
    definition: 'New Business Opportunity: the pitch that presents the agent career to somebody you want to recruit.',
  },
  NPA: {
    question: 'What is NPA?',
    definition: 'New agent registration: the paperwork that gives a recruit their agent code.',
  },
  BOP: {
    question: 'What is BOP?',
    definition: 'Business Opportunity Presentation: the company’s group session that presents the agent career to candidates.',
  },
  JFW: {
    question: 'What is JFW?',
    definition: 'Joint field work: a visit to a prospect that an agent makes with their leader there too.',
  },
  TOUCHES: {
    question: 'What is a touch?',
    definition: 'A touch is one logged activity: each one you add on Log Activity counts once.',
  },
  CI_PREMIUM_WAIVER: {
    question: 'What is a CI premium waiver?',
    definition: 'If the insured is diagnosed with a critical illness, the premiums still to come are waived and the cover carries on.',
  },
  AS_BILLED: {
    question: 'What is as-billed?',
    definition: 'Hospital costs paid as the bill charges them, up to the plan’s limits, rather than a fixed amount a day.',
  },
  POTENTIAL_MAA: {
    question: 'What is a Potential Monthly Active Agent?',
    definition: 'Potential Monthly Active Agent (✓): pacing, from this month’s activity, to submit at least 1 policy this month. A projection, not a sale.',
  },
  MOC: {
    question: 'What is MOC?',
    definition: 'Maintenance of Contract: the bar a leader must clear to keep their role, set by the company for each leader rung.',
  },
  STAR_CLUB: {
    question: 'What is Star Club?',
    definition: 'The first of the company’s production clubs, badged on an agency whose APE this year reaches its bar.',
  },
  ELITE_CLUB: {
    question: 'What is Elite Club?',
    definition: 'The middle production club, above Star Club, badged on an agency whose APE this year reaches its bar.',
  },
  CHAIRMANS_CLUB: {
    question: 'What is Chairman’s Club?',
    definition: 'The highest of the company’s production clubs, badged on an agency whose APE this year reaches its bar.',
  },
};

const id: MessagesOf<typeof en> = {
  APE: {
    question: `Apa itu ${kept('APE')}?`,
    definition: `Annualised Premium Equivalent: premi tahun pertama sebuah polis, dihitung sebagai premi setahun penuh. ${kept('Goal')}, produksi, dan klub semuanya dihitung dengan ${kept('APE')}.`,
  },
  MDRT: {
    question: `Apa itu ${kept('MDRT')}?`,
    definition: 'Million Dollar Round Table: klub internasional bagi penasihat keuangan dengan produksi tertinggi, dengan kualifikasi berdasarkan produksi setahun.',
  },
  AAB: {
    question: `Apa itu ${kept('AAB')}?`,
    definition: `Associate Agency Builder: ${kept('leader')} di bawah seorang ${kept('AB')}, yang memiliki agen sendiri.`,
  },
  NBO: {
    question: 'Apa itu NBO?',
    definition: 'New Business Opportunity: presentasi yang memperkenalkan karier agen kepada orang yang ingin Anda rekrut.',
  },
  NPA: {
    question: 'Apa itu NPA?',
    definition: 'Pendaftaran agen baru: berkas yang memberi seorang rekrutan kode agennya.',
  },
  BOP: {
    question: 'Apa itu BOP?',
    definition: 'Business Opportunity Presentation: sesi kelompok dari perusahaan yang memperkenalkan karier agen kepada kandidat.',
  },
  JFW: {
    question: 'Apa itu JFW?',
    definition: `Joint field work: kunjungan ke prospek yang dilakukan agen bersama ${kept('leader')}-nya.`,
  },
  TOUCHES: {
    question: 'Apa itu sentuhan?',
    definition: `Sentuhan adalah satu aktivitas yang tercatat: setiap aktivitas yang Anda tambahkan di ${kept('Log Activity')} dihitung satu kali.`,
  },
  CI_PREMIUM_WAIVER: {
    question: 'Apa itu CI premium waiver?',
    definition: 'Jika tertanggung didiagnosis menderita penyakit kritis, premi yang belum jatuh tempo dibebaskan dan perlindungannya tetap berjalan.',
  },
  AS_BILLED: {
    question: 'Apa itu as-billed?',
    definition: 'Biaya rumah sakit dibayar sesuai tagihan, hingga batas manfaat polis, bukan dengan jumlah tetap per hari.',
  },
  POTENTIAL_MAA: {
    question: `Apa itu ${kept('Potential Monthly Active Agent')}?`,
    definition: `${kept('Potential Monthly Active Agent')} (✓): dari aktivitas bulan ini, berada di jalur untuk mengajukan setidaknya 1 polis bulan ini. Sebuah proyeksi, bukan penjualan.`,
  },
  MOC: {
    question: `Apa itu ${kept('MOC')}?`,
    definition: `${kept('Maintenance of Contract')}: batas yang harus dicapai seorang ${kept('leader')} untuk mempertahankan perannya, ditetapkan oleh perusahaan untuk setiap jenjang ${kept('leader')}.`,
  },
  STAR_CLUB: {
    question: `Apa itu ${kept('Star Club')}?`,
    definition: `Klub produksi pertama perusahaan, disematkan pada agensi yang ${kept('APE')} tahun ini mencapai batasnya.`,
  },
  ELITE_CLUB: {
    question: `Apa itu ${kept('Elite Club')}?`,
    definition: `Klub produksi tengah, di atas ${kept('Star Club')}, disematkan pada agensi yang ${kept('APE')} tahun ini mencapai batasnya.`,
  },
  CHAIRMANS_CLUB: {
    question: `Apa itu ${kept('Chairman’s Club')}?`,
    definition: `Klub produksi tertinggi perusahaan, disematkan pada agensi yang ${kept('APE')} tahun ini mencapai batasnya.`,
  },
};

export const termMessages = defineMessages({ en, id });
