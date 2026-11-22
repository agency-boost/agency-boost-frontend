import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The audit log** — `/admin/audit`, *Audit / Role Change Log* (P18.10-T6; `nfr/security-and-privacy.md`, *Audit*;
 * `functional/tenant-provisioning.md`, *The module's own strings*): its line, the scope, the table's frame and its empty
 * states.
 *
 * **English is the source**, byte for byte what the console wrote before; the Indonesian is the approved glossary's
 * (*Kapan* §B.4, *KPM* for an office §B.9, *sesi dukungan* §A.2). **Kept** (§A): the title, *KPM*, *Target*.
 * **What a row records is shown as recorded, in both languages**: the action and the collection are the log's codes
 * (`kpm.created`, `company_template.published`, `memberships`) — evidence, never relabelled (ADR-0023's note) — and the
 * target's and the actors' names are as stored. A row's moment is a figure, written by the page.
 *
 * **Since P19.23-T6 (ADR-0279)** at `/admin/platform/audit`, the console's *Platform* › *Audit log* (frame f52): *Cari
 * perubahan*, *Semua perusahaan · Semua KPM · Semua tindakan*, and each line *when · what (before → after) · who · KPM ·
 * company*; `/admin/audit` redirects there.
 *
 * @moved app/(admin)/admin/audit/
 * @moved components/admin/platform/audit-log.tsx
 */
const en = {
  title: kept('Audit / Role Change Log'),
  scope: 'Scope',
  platformLevel: 'Platform level (no KPM)',
  columns: { when: 'When', action: 'Action', target: kept('Target'), actor: 'Actor' },
  caption: 'Audit entries, newest first',
  emptyOffice: 'Nothing recorded for this office yet.',
  emptyPlatform: 'Nothing recorded at platform level yet — create an office and it will appear here.',
  showPlatform: 'Show platform level',
  /** Under impersonation, the member the action was taken as (`name` as stored, or their id). */
  actingAs: ({ name }: { name: string }) => `as ${name}`,

  /*
   * The page's filters, paging and groups (P19.2-T2 AC-6; UI-132, `admin-mobile` screen 5 and `admin-desktop` screen
   * 3): the chips *Cakupan · Perusahaan · Tindakan · Pelaku · Tanggal*, *Muat lagi*, and the count pill (*×28*).
   */
  company: 'Company',
  date: 'Date',
  filters: 'Filter the log',
  /** The date chip's sheet: two office days, both inclusive. */
  from: 'From',
  to: 'To',
  apply: 'Apply',
  anyDate: 'Any date',
  /** An actor whose account is gone, in the Pelaku list. */
  unknownActor: ({ id }: { id: string }) => `Unknown account (${id})`,
  loadMore: 'Load more',
  loadingMore: 'Loading…',
  /** The count pill: what it draws, and what a screen reader hears. */
  count: ({ n }: { n: number }) => `×${n}`,
  countSaid: ({ n }: { n: number }) => `${n} times`,
  timesSince: ({ n, oldest }: { n: number; oldest: string }) => `${n} times since ${oldest}`,
  emptyFiltered: 'Nothing recorded matches these filters.',
  clearFilters: 'Clear filters',

  /* P19.23-T6 AC-1 (ADR-0279; frame f52): the search, the three filters' *all*, the KPM and the note under the list. */
  search: 'Search changes',
  kpm: kept('KPM'),
  allCompanies: 'All companies',
  allKpms: `Every ${kept('KPM')}`,
  allActions: 'All actions',
  allActors: 'Everyone',
  emptyAll: 'Nothing recorded yet.',
  note: `Every ${kept('Super Admin')} change: who, when, before → after`,
  officeNote: `Every change in this ${kept('KPM')}: who, when, before → after`,

  /*
   * P19.26-T3 (UI-217 (21 Nov); ADR-0284 §3): changes only by default, the looks behind a chip; on a phone the search and
   * one *Filter* button, which opens a sheet holding the five filters.
   */
  includeViewed: 'Including views',
  filter: 'Filter',
  filterOn: ({ n }: { n: number }) => `Filter, ${n} on`,
  done: 'Done',
};

const id: MessagesOf<typeof en> = {
  title: kept('Audit / Role Change Log'),
  scope: 'Cakupan',
  platformLevel: `Tingkat platform (tanpa ${kept('KPM')})`,
  columns: { when: 'Kapan', action: 'Tindakan', target: kept('Target'), actor: 'Pelaku' },
  caption: 'Entri audit, terbaru lebih dulu',
  emptyOffice: `Belum ada yang dicatat untuk ${kept('KPM')} ini.`,
  emptyPlatform: `Belum ada yang dicatat di tingkat platform — buat ${kept('KPM')} dan catatannya akan muncul di sini.`,
  showPlatform: 'Tampilkan tingkat platform',
  actingAs: ({ name }) => `sebagai ${name}`,

  company: 'Perusahaan',
  date: 'Tanggal',
  filters: 'Saring catatan',
  from: 'Dari',
  to: 'Sampai',
  apply: 'Terapkan',
  anyDate: 'Semua tanggal',
  unknownActor: ({ id }) => `Akun tidak dikenal (${id})`,
  loadMore: 'Muat lagi',
  loadingMore: 'Memuat…',
  count: ({ n }) => `×${n}`,
  countSaid: ({ n }) => `${n} kali`,
  timesSince: ({ n, oldest }) => `${n} kali sejak ${oldest}`,
  emptyFiltered: 'Tidak ada catatan yang cocok dengan saringan ini.',
  clearFilters: 'Hapus saringan',

  search: 'Cari perubahan',
  kpm: kept('KPM'),
  allCompanies: 'Semua perusahaan',
  allKpms: `Semua ${kept('KPM')}`,
  allActions: 'Semua tindakan',
  allActors: 'Semua pelaku',
  emptyAll: 'Belum ada yang dicatat.',
  note: `Semua perubahan ${kept('Super Admin')}: siapa, kapan, sebelum → sesudah`,
  officeNote: `Semua perubahan di ${kept('KPM')} ini: siapa, kapan, sebelum → sesudah`,

  includeViewed: 'Termasuk dilihat',
  filter: 'Filter',
  filterOn: ({ n }) => `Filter, ${n} aktif`,
  done: 'Selesai',
};

export const adminAuditMessages = defineMessages({ en, id });
