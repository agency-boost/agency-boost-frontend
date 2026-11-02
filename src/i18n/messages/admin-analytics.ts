import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Cross-platform analytics*** — `/admin/analytics` (P18.98-T6; `functional/kpm-analytics.md`, *The platform's
 * analytics*, *The module's own strings*): adoption by branch and company, and nothing else (ADR-0133).
 *
 * **English is the source**, byte for byte what the screen wrote before; it uses none of OD-39's six words, and the
 * table's rows are *branches*, as *All KPMs*' *Branch* column calls them — the Indonesian keeps to that: *cabang*,
 * never *KPM* or *kantor*. The Indonesian is the approved glossary's (*Kode · Cabang · Perusahaan · Status · Anggota*
 * §B.4, *Coba lagi* §B.1, *Masuk* §B.1, *7 hari terakhir* §B.7, *jenjang* §B.10). **Kept** (§A): the title,
 * *AgencyBoost*, *Total* (spelled alike). **Typed content stays as typed**: an office's code and branch, a company's
 * name, its rungs' labels. **A figure is never a message's**: every count, share and month is written by the caller
 * in the figures' language and passed in.
 *
 * @moved app/(admin)/admin/analytics/
 * @moved lib/admin-analytics.ts
 */
const en = {
  title: kept('Cross-platform analytics'),
  subtitle: 'Adoption across every company on AgencyBoost',
  caption: 'Adoption by branch and company',
  empty: 'No branches on the platform yet.',
  tryAgain: 'Try again',
  /** `branches` the count written; `n` the number, for its plural. */
  companyTotal: ({ name, n, branches }: { name: string; n: number; branches: string }) =>
    `${name} — Total (${branches} ${n === 1 ? 'branch' : 'branches'})`,
  platformTotal: ({ c, companies, b, branches }: { c: number; companies: string; b: number; branches: string }) =>
    `Platform — Total (${companies} ${c === 1 ? 'company' : 'companies'}, ${branches} ${b === 1 ? 'branch' : 'branches'})`,
  /** The table's headings, in order: *All KPMs*' first four, verbatim, then the figures. */
  headings: {
    code: 'Code', branch: 'Branch', company: 'Company', status: 'Status', members: 'Members', byRung: 'By rung',
    joined: 'Joined this month', left: 'Left this month', signedIn7d: 'Signed in within 7 days',
    signedIn30d: 'Signed in within 30 days',
  },
  /** Once the read says which month *this month* is; `month` written in the figures' language. */
  joinedIn: ({ month }: { month: string }) => `Joined in ${month}`,
  leftIn: ({ month }: { month: string }) => `Left in ${month}`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Cross-platform analytics'),
  subtitle: `Adopsi di semua perusahaan di ${kept('AgencyBoost')}`,
  caption: 'Adopsi per cabang dan perusahaan',
  empty: 'Belum ada cabang di platform.',
  tryAgain: 'Coba lagi',
  companyTotal: ({ name, branches }) => `${name} — Total (${branches} cabang)`,
  platformTotal: ({ companies, branches }) => `Platform — Total (${companies} perusahaan, ${branches} cabang)`,
  headings: {
    code: 'Kode', branch: 'Cabang', company: 'Perusahaan', status: 'Status', members: 'Anggota', byRung: 'Per jenjang',
    joined: 'Bergabung bulan ini', left: 'Keluar bulan ini', signedIn7d: 'Masuk dalam 7 hari terakhir',
    signedIn30d: 'Masuk dalam 30 hari terakhir',
  },
  joinedIn: ({ month }) => `Bergabung pada ${month}`,
  leftIn: ({ month }) => `Keluar pada ${month}`,
};

export const adminAnalyticsMessages = defineMessages({ en, id });
