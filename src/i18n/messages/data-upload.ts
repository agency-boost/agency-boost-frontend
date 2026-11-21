import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Data upload's own words** (P19.21-T1; `functional/production-ingest.md`, *As built — P19.21-T1*): the page as the
 * client drew it on 19 November (`revisions/2026-11-19/files/UI/mockups/data-upload-pengaturan-*-stopmotion-2026-11-19
 * .html`, frames 1–10) — *Pilih bulan*, the navy month card, the filters and the table, *Belum jadi anggota*, *Riwayat
 * unggah*, the *Unggah data* dialog and *Koreksi* — with the words `lib/production.ts` and `components/ytd-cell.tsx`
 * give a figure.
 *
 * **The Indonesian is the mockup's, verbatim**; the English is ours, for a reader who chose it. **No *impor*** (the
 * client's rule, DESIGN-RULES *Writing*): a file is *diunggah* and its rows *disimpan*. **Kept in both languages** (§A):
 * the page's name and *YTD*. **Content stays as typed**: a member's name and agent code, a file's name, a reason, the
 * server's sentences. **A figure is never a message's**: a sum, a count and a month are written by the caller in the
 * figures' language and passed in.
 *
 * @moved app/(tenant)/kpm/data-upload/
 * @moved lib/production.ts
 */

/** Whose a figure is (P9-T6): the three writers. */
type Writer = 'imported' | 'corrected' | 'self_reported';

const en = {
  /** The page: its name is the menu item's (§A.1). */
  title: kept('Data upload'),
  loadFailed: 'This month could not be read.',
  tryAgain: 'Try again',

  // ---- Pilih bulan (AC-1)
  pickMonth: 'Choose month',
  yearsLabel: 'Year',
  monthsOf: ({ year }: { year: string }) => `Months of ${year}`,
  monthUploaded: 'uploaded',
  monthMissing: 'not uploaded',
  missingLine: ({ count, year, since }: { count: number; year: string; since: string }) =>
    `${count} month${count === 1 ? '' : 's'} not uploaded in ${year} · green = done · red = not yet · data required since ${since} · YTD is counted from these months`,

  // ---- the month card (AC-2)
  haveFigures: ({ total }: { total: number }) => `of ${total} members have figures`,
  openUntil: ({ day }: { day: string }) => `Open until ${day}`,
  thenLocks: 'then it locks by itself',
  lockNow: 'Lock now',
  locked: 'Locked',
  lockedUploaded: 'uploaded',
  lockedMissing: 'not uploaded, can still be uploaded',
  reopen: 'Reopen',
  reopened: 'Reopened',
  askLock: ({ month }: { month: string }) => `Lock ${month}? Uploads and corrections to it are refused until somebody reopens it.`,
  askReopen: ({ month }: { month: string }) => `Reopen ${month}? Its figures can be uploaded and corrected again until somebody locks it.`,
  upload: 'Upload data',
  downloadTemplate: 'Download template',
  templateCsv: 'CSV file',
  templateOf: ({ name, version }: { name: string; version: number }) => `${name} v${version}`,
  defaultTemplate: 'Standard template',
  templateFailed: ({ message }: { message: string }) => `The template could not be prepared. ${message}`,
  asOfDay: 'Figures as of',

  // ---- the filters and the table (AC-3)
  views: 'Figures',
  thisMonth: 'This month',
  ytd: kept('YTD'),
  showLabel: 'Show',
  all: 'All',
  unreported: 'Not reported',
  corrected: 'Corrected',
  notYetMembers: 'Not yet members',
  search: 'Search name',
  member: 'Member',
  tableOf: ({ month }: { month: string }) => `Figures for ${month}`,
  seeAll: ({ count }: { count: number }) => `See all (${count})`,
  seeFewer: 'Show fewer',
  noMembers: 'This office has no members yet: their rows appear here as they join.',
  noMatch: 'Nobody matches this filter.',
  correctFigure: ({ label, name }: { label: string; name: string }) => `Correct ${label} for ${name}`,

  // ---- the legend
  legendTap: 'Tap a figure to correct it, with no upload again',
  legendCorrected: 'corrected by hand',
  legendActive: 'Active = APE or policies this month',
  legendKept: 'Agent codes not registered yet are kept',
  legendTest: 'Test accounts are not shown',

  // ---- Belum jadi anggota (AC-6)
  notYetSection: 'Not yet members · data kept, attached when they register',
  notRegistered: 'not registered',
  invite: 'Invite',
  inviteWho: ({ name }: { name: string }) => `Invite ${name}`,

  // ---- Riwayat unggah (AC-7)
  historyOf: ({ month }: { month: string }) => `Upload history · ${month}`,
  noUploads: ({ month }: { month: string }) => `No upload for ${month} yet.`,
  uploadedBy: ({ when, who }: { when: string; who: string | null }) => `${when} · by ${who ?? 'somebody'}`,
  toMembers: ({ count }: { count: number }) => `${count} to members`,
  notYet: ({ count }: { count: number }) => `${count} not yet members`,
  revertedTag: 'Undone',
  historyActions: ({ filename }: { filename: string }) => `Actions for ${filename}`,
  undoUpload: 'Undo this upload',
  askUndo: ({ filename, month }: { filename: string; month: string }) =>
    `Undo “${filename}”? Every figure it wrote to ${month} goes back to what it was — corrections by hand included.`,

  // ---- the Unggah data dialog (AC-5)
  uploadTitle: ({ month }: { month: string }) => `Upload data ${month}`,
  pickFile: 'Choose a file or drag it here',
  pickHint: ({ template }: { template: string }) => `Excel / CSV template · columns of ${template}`,
  rowsCount: ({ count }: { count: number }) => `${count} row${count === 1 ? '' : 's'}`,
  change: 'Change',
  reading: 'Reading the file…',
  tileMembers: 'members',
  tileNotYet: 'not yet members',
  tileAll: 'all saved',
  savedAllWithNotYet: ({ names }: { names: string }) =>
    `Every row is saved. ${names} not registered yet: their data attaches to them when they register with the same agent code. `
    + 'The file’s figures replace earlier corrections by hand.',
  savedAll: 'Every row is saved. The file’s figures replace earlier corrections by hand.',
  andMore: ({ count }: { count: number }) => `and ${count} more`,
  and: 'and',
  problems: ({ count }: { count: number }) =>
    `${count} thing${count === 1 ? '' : 's'} to fix in the file before it can be saved — nothing has been saved.`,
  problemLine: ({ line, code }: { line: number; code: string }) => `Row ${line}${code ? ` · ${code}` : ''}`,
  cancel: 'Cancel',
  next: 'Continue',
  saveAll: ({ count }: { count: number }) => `Save all (${count} row${count === 1 ? '' : 's'})`,
  saving: 'Saving…',
  saved: ({ count, month }: { count: number; month: string }) => `${count} row${count === 1 ? '' : 's'} saved to ${month}.`,
  undone: ({ filename }: { filename: string }) => `“${filename}” undone: its figures are back to what they were.`,
  lockedNow: ({ month, locked }: { month: string; locked: boolean }) => (locked ? `${month} is locked.` : `${month} is open again.`),

  // ---- Koreksi (AC-4)
  correctTitle: ({ column, name }: { column: string; name: string }) => `Correct ${column} · ${name}`,
  fromFile: ({ month, value }: { month: string; value: string }) => `${month} · from the file: ${value}`,
  valueIn: ({ column, unit }: { column: string; unit: string }) => `${column} (${unit})`,
  reason: 'Reason (required)',
  logged: 'Recorded: who, when, why. It can go back to the file’s figure.',
  correctedBy: ({ who, when, reason }: { who: string | null; when: string; reason: string | null }) =>
    `Corrected by ${who ?? 'somebody'} · ${when}${reason ? `: ${reason}` : ''}`,
  restore: ({ value }: { value: string }) => `Back to the file’s figure (${value})`,
  restoring: 'Putting back…',
  saveCorrection: 'Save correction',
  emptyClears: 'Leave it empty to clear the figure.',
  notANumber: 'Write the figure as a number.',
  reasonNeeded: 'Say why it is corrected.',
  correctedNotice: ({ label, who, after }: { label: string; who: string; after: string }) => `${label} for ${who} is now ${after}.`,
  unchangedNotice: ({ label, who }: { label: string; who: string }) => `${label} for ${who} already held that figure: nothing changed.`,
  restoredNotice: ({ label, who, after }: { label: string; who: string; after: string }) =>
    `${label} for ${who} is back to the file’s figure, ${after}.`,

  // ---- figures, as `ytd-cell.tsx` and `lib/production.ts` write them
  active: 'Active',
  notActive: 'Not active',
  notReported: 'Not reported',
  nothingReported: 'nothing reported',
  ytdIncomplete: ({ months }: { months: string }) => `Incomplete · ${months} not uploaded`,
  ytdCalculated: 'calculated from the months',
  outOfBounds: ({ version }: { version: number }) => `Outside the limits since v${version}`,
  figureLabel: ({ metric, ytd }: { metric: string; ytd: boolean }) => `${metric} ${ytd ? 'year to date' : 'this month'}`,
  provenance: { imported: 'the carrier’s file', corrected: 'corrected by hand', self_reported: 'the agent’s own figure' } satisfies Record<Writer, string>,
};

const id: MessagesOf<typeof en> = {
  title: kept('Data upload'),
  loadFailed: 'Bulan ini tidak dapat dibaca.',
  tryAgain: 'Coba lagi',

  pickMonth: 'Pilih bulan',
  yearsLabel: 'Tahun',
  monthsOf: ({ year }) => `Bulan di ${year}`,
  monthUploaded: 'sudah diunggah',
  monthMissing: 'belum diunggah',
  missingLine: ({ count, year, since }) =>
    `${count} bulan belum diunggah di ${year} · hijau = sudah · merah = belum · data wajib sejak ${since} · YTD dihitung dari bulan-bulan ini`,

  haveFigures: ({ total }) => `dari ${total} anggota sudah punya angka`,
  openUntil: ({ day }) => `Terbuka sampai ${day}`,
  thenLocks: 'lalu terkunci otomatis',
  lockNow: 'Kunci sekarang',
  locked: 'Terkunci',
  lockedUploaded: 'sudah diunggah',
  lockedMissing: 'belum diunggah, masih bisa diunggah',
  reopen: 'Buka kembali',
  reopened: 'Dibuka kembali',
  askLock: ({ month }) => `Kunci ${month}? Unggahan dan koreksi ke bulan ini ditolak sampai ada yang membukanya kembali.`,
  askReopen: ({ month }) => `Buka kembali ${month}? Angkanya bisa diunggah dan dikoreksi lagi sampai ada yang menguncinya.`,
  upload: 'Unggah data',
  downloadTemplate: 'Unduh template',
  templateCsv: 'file CSV',
  templateOf: ({ name, version }) => `${name} v${version}`,
  defaultTemplate: 'Template standar',
  templateFailed: ({ message }) => `Template tidak dapat disiapkan. ${message}`,
  asOfDay: 'Data sampai tanggal',

  views: 'Angka',
  thisMonth: 'Bulan ini',
  ytd: kept('YTD'),
  showLabel: 'Tampilkan',
  all: 'Semua',
  unreported: 'Belum dilaporkan',
  corrected: 'Dikoreksi',
  notYetMembers: 'Belum jadi anggota',
  search: 'Cari nama',
  member: 'Anggota',
  tableOf: ({ month }) => `Angka ${month}`,
  seeAll: ({ count }) => `Lihat semua (${count})`,
  seeFewer: 'Tampilkan lebih sedikit',
  noMembers: 'KPM ini belum punya anggota: barisnya muncul di sini saat mereka bergabung.',
  noMatch: 'Tidak ada yang cocok dengan saringan ini.',
  correctFigure: ({ label, name }) => `Koreksi ${label} ${name}`,

  legendTap: 'Ketuk angka untuk mengoreksi, tanpa unggah ulang',
  legendCorrected: 'dikoreksi manual',
  legendActive: 'Aktif = ada APE atau polis bulan ini',
  legendKept: 'Kode agen yang belum terdaftar tetap disimpan',
  legendTest: 'Akun tes tidak ditampilkan',

  notYetSection: 'Belum jadi anggota · data disimpan, masuk otomatis saat terdaftar',
  notRegistered: 'belum terdaftar',
  invite: 'Undang',
  inviteWho: ({ name }) => `Undang ${name}`,

  historyOf: ({ month }) => `Riwayat unggah · ${month}`,
  noUploads: ({ month }) => `Belum ada unggahan untuk ${month}.`,
  uploadedBy: ({ when, who }) => `${when} · oleh ${who ?? 'seseorang'}`,
  toMembers: ({ count }) => `${count} ke anggota`,
  notYet: ({ count }) => `${count} belum jadi anggota`,
  revertedTag: 'Dibatalkan',
  historyActions: ({ filename }) => `Tindakan untuk ${filename}`,
  undoUpload: 'Batalkan unggahan ini',
  askUndo: ({ filename, month }) =>
    `Batalkan “${filename}”? Setiap angka yang ditulisnya ke ${month} kembali seperti sebelumnya — termasuk koreksi manual.`,

  uploadTitle: ({ month }) => `Unggah data ${month}`,
  pickFile: 'Pilih file atau tarik ke sini',
  pickHint: ({ template }) => `Template Excel / CSV · kolom ${template}`,
  rowsCount: ({ count }) => `${count} baris`,
  change: 'Ganti',
  reading: 'Membaca file…',
  tileMembers: 'anggota',
  tileNotYet: 'belum jadi anggota',
  tileAll: 'semua disimpan',
  savedAllWithNotYet: ({ names }) =>
    `Semua baris disimpan. ${names} belum terdaftar: datanya otomatis masuk ke mereka saat terdaftar dengan kode agen yang sama. `
    + 'Angka dari file mengganti koreksi manual sebelumnya.',
  savedAll: 'Semua baris disimpan. Angka dari file mengganti koreksi manual sebelumnya.',
  andMore: ({ count }) => `dan ${count} lainnya`,
  and: 'dan',
  problems: ({ count }) => `${count} hal perlu diperbaiki di file sebelum bisa disimpan — belum ada yang disimpan.`,
  problemLine: ({ line, code }) => `Baris ${line}${code ? ` · ${code}` : ''}`,
  cancel: 'Batal',
  next: 'Lanjut',
  saveAll: ({ count }) => `Simpan semua (${count} baris)`,
  saving: 'Menyimpan…',
  saved: ({ count, month }) => `${count} baris disimpan ke ${month}.`,
  undone: ({ filename }) => `“${filename}” dibatalkan: angkanya kembali seperti sebelumnya.`,
  lockedNow: ({ month, locked }) => (locked ? `${month} terkunci.` : `${month} terbuka kembali.`),

  correctTitle: ({ column, name }) => `Koreksi ${column} · ${name}`,
  fromFile: ({ month, value }) => `${month} · dari file: ${value}`,
  valueIn: ({ column, unit }) => `${column} (${unit})`,
  reason: 'Alasan (wajib)',
  logged: 'Tercatat: siapa, kapan, alasan. Bisa dikembalikan ke angka dari file.',
  correctedBy: ({ who, when, reason }) => `Dikoreksi ${who ?? 'seseorang'} · ${when}${reason ? `: ${reason}` : ''}`,
  restore: ({ value }) => `Kembalikan ke angka dari file (${value})`,
  restoring: 'Mengembalikan…',
  saveCorrection: 'Simpan koreksi',
  emptyClears: 'Kosongkan untuk menghapus angkanya.',
  notANumber: 'Tulis angkanya sebagai bilangan.',
  reasonNeeded: 'Tulis alasan koreksinya.',
  correctedNotice: ({ label, who, after }) => `${label} ${who} sekarang ${after}.`,
  unchangedNotice: ({ label, who }) => `${label} ${who} sudah berisi angka itu: tidak ada yang berubah.`,
  restoredNotice: ({ label, who, after }) => `${label} ${who} kembali ke angka dari file, ${after}.`,

  active: 'Aktif',
  notActive: 'Tidak aktif',
  notReported: 'Belum dilaporkan',
  nothingReported: 'tidak dilaporkan',
  ytdIncomplete: ({ months }) => `Belum lengkap · ${months} belum diunggah`,
  ytdCalculated: 'dihitung dari bulan-bulannya',
  outOfBounds: ({ version }) => `Di luar batas sejak v${version}`,
  figureLabel: ({ metric, ytd }) => `${metric} ${ytd ? 'sejak awal tahun' : 'bulan ini'}`,
  provenance: { imported: 'file perusahaan', corrected: 'dikoreksi manual', self_reported: 'angka agent sendiri' },
};

export const dataUploadMessages = defineMessages({ en, id });
