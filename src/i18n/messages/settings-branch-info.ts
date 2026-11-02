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
 * **Settings › Branch info** (`/kpm/settings/branch-info`, P4-T5; P18.98-T4): what the office is called and where it
 * is, two fields the platform sets shown read-only. *Save*, *Saving…* and *Saved.* are `settings.ts`'.
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
  subtitle: 'What this office is called, and where it is.',
  kpmCode: 'KPM code',
  kpmCodeReason: 'Set when the office was created, and unique within your company.',
  branchName: 'Branch name',
  /** Disabled and labelled, as the prototype has it: the label says who can change it. */
  company: 'Company (tagged by Superadmin)',
  companyReason: 'The insurer this office belongs to. Only the platform can change it.',
  address: 'Address',
  contactPhone: 'Contact phone',
  /** The Owner's field while the office has none. */
  nobodyYet: 'Nobody yet',
  ownerReason: 'Assigned and transferred by the platform, not from inside the office.',
  financialYear: 'Financial year starts',
  /** A month by its number, 1 to 12, for the financial year's select. */
  month: ({ month }: { month: number }): string => MONTHS_EN[month - 1] ?? '',
  timeLanguageCurrency: 'Time zone, language and currency',
  timeLanguageCurrencyReason: 'Every office runs on these in this version of AgencyBoost.',
};

const id: MessagesOf<typeof en> = {
  subtitle: `Nama ${kept('KPM')} ini, dan lokasinya.`,
  kpmCode: `Kode ${kept('KPM')}`,
  kpmCodeReason: `Ditetapkan saat ${kept('KPM')} ini dibuat, dan unik di perusahaan Anda.`,
  branchName: 'Nama cabang',
  company: `Perusahaan (di-tag oleh ${kept('Superadmin')})`,
  companyReason: `Perusahaan asuransi tempat ${kept('KPM')} ini bernaung. Hanya platform yang dapat mengubahnya.`,
  address: 'Alamat',
  contactPhone: 'Telepon kontak',
  nobodyYet: 'Belum ada',
  ownerReason: `Ditetapkan dan dipindahkan oleh platform, bukan dari dalam ${kept('KPM')}.`,
  financialYear: 'Tahun buku dimulai',
  month: ({ month }) => MONTHS_ID[month - 1] ?? '',
  timeLanguageCurrency: 'Zona waktu, bahasa, dan mata uang',
  timeLanguageCurrencyReason: `Setiap ${kept('KPM')} memakai pengaturan ini di versi ${kept('AgencyBoost')} ini.`,
};

export const branchInfoMessages = defineMessages({ en, id });
