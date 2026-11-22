import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

/**
 * **Settings › Branch info** (`/kpm/settings/branch-info`, P4-T5; P18.10-T4; **P19.21-T3 AC-7**, frame 23): a simple
 * two-column form — what the office is called and where it is — the fields the platform sets grey, each saying so. *Save*, *Saving…* and *Saved.* are `settings.ts`'.
 *
 * **Content, shown as typed** (ADR-0179 §5): the office's code, branch name, address and phone, the company's name and
 * the Owner's. **Kept English** (§A): the title (§A.1), *KPM*, *KPM Owner*, *Superadmin* and *AgencyBoost* (§A.5).
 * *Office* is *KPM* (§B.9); *tagged by* is built on §B.9's *di-tag*. The months are whole names, chosen from a list —
 * not a date, which `lib/format.ts` writes — so they are words here. *Financial year*, *time zone* and *currency* are
 * *tahun buku*, *zona waktu* and *mata uang* (for approval, the glossary for approval's §B.10).
 *
 * @moved app/(tenant)/kpm/settings/branch-info/
 */
const en = {
  kpmCode: `${kept('KPM')} code`,
  /** P19.21-T3 AC-7 (frame 23): the platform's fields grey, each saying so in two or three words. */
  kpmCodeReason: 'Unique in your company, cannot be changed',
  branchName: 'Branch name',
  company: 'Company',
  /** The company's and the Owner's line: the platform sets them. */
  companyReason: 'Set by the platform',
  address: 'Address',
  contactPhone: 'Contact phone',
  /** The Owner's field while the office has none. */
  nobodyYet: 'Nobody yet',
  ownerReason: 'Set by the platform',
  financialYear: 'Financial year starts',
  /** A month by its number, 1 to 12, for the financial year's select. */
  month: ({ month }: { month: number }): string => MONTHS_EN[month - 1] ?? '',
  timeLanguageCurrency: 'Time zone · language · currency',
  timeLanguageCurrencyReason: 'The same for every office',
};

const id: MessagesOf<typeof en> = {
  kpmCode: `Kode ${kept('KPM')}`,
  kpmCodeReason: 'Unik di perusahaan, tidak bisa diubah',
  branchName: 'Nama cabang',
  company: 'Perusahaan',
  companyReason: 'Diatur platform',
  address: 'Alamat',
  contactPhone: 'Telepon kontak',
  nobodyYet: 'Belum ada',
  ownerReason: 'Diatur platform',
  financialYear: 'Tahun buku dimulai',
  month: ({ month }) => MONTHS_ID[month - 1] ?? '',
  timeLanguageCurrency: 'Zona waktu · bahasa · mata uang',
  timeLanguageCurrencyReason: `Sama untuk semua ${kept('KPM')}`,
};

export const branchInfoMessages = defineMessages({ en, id });
