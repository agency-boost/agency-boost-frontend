import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Data upload's own words** (P18.98-T4, the office reporting; `functional/data-upload.md`): the month's table and its
 * phone cards (`app/(tenant)/kpm/data-upload/page.tsx`, `figure-table.tsx`), the template and the upload, the preview of
 * a filled file and *Confirm import*, the correction of one figure (`correction-panel.tsx`) and of an agent's twelve on a
 * phone (`figures-sheet.tsx`), the month's lock (`month-lock.tsx`) and the imports' history (`import-history.tsx`), with
 * the words `lib/production.ts` gives a figure.
 *
 * **English is the source** of the keys, as built (P9-T1 to P9-T6, P18.97-T4, P18.97-T7); the Indonesian is the approved
 * glossary's (OD-237; §B.1 *Download template*, *Upload*, *Cancel*; §B.2 *Saving…*, *Importing…*), with the words it
 * lacked added to the glossary for approval's §B.10. **Kept in both languages** (§A): the page's name, the table's
 * metric headings — the carrier's file's own (*APE*, *Rolling Persistency (%)*, *New Active Agents*, *FYP*, *# of
 * Policy*) — its two groups (*This Month*, *YTD*), *Agent* and the jargon. **Content stays as typed**: a member's name and
 * agent code, a file's name, a correction's reason, and the server's own sentences (a refusal, a line not taken). **A
 * figure is never a message's**: a sum, a persistency, a count and a month are written by the caller in the figures'
 * language and passed in.
 *
 * @moved app/(tenant)/kpm/data-upload/page.tsx
 * @moved app/(tenant)/kpm/data-upload/correction-panel.tsx
 * @moved app/(tenant)/kpm/data-upload/figure-table.tsx
 * @moved app/(tenant)/kpm/data-upload/figures-sheet.tsx
 * @moved app/(tenant)/kpm/data-upload/import-history.tsx
 * @moved app/(tenant)/kpm/data-upload/month-label.ts
 * @moved app/(tenant)/kpm/data-upload/month-lock.tsx
 * @moved lib/production.ts
 */

/** Whose a figure is (P9-T6): the three writers. */
type Writer = 'imported' | 'corrected' | 'self_reported';

const en = {
  /** The page (`KPM_Owner.html:1289-1324`): its name is the nav item's (§A.1). */
  title: kept('Data upload'),
  subtitle: 'APE, rolling persistency, recruitment, new active agents, FYP and # of policy — one file per month, matched by agent code.',
  month: 'Month',
  /** **⬇ Download template** (`:1301`) and what it says when the file could not be made. */
  downloadTemplate: 'Download template',
  templateFailed: ({ message }: { message: string }) => `The template could not be prepared. ${message}`,
  tryAgain: 'Try again',
  /** **+ Upload filled template** (`:1302`), the file input dressed as the primary button. */
  upload: '+ Upload filled template',
  readingFile: 'Reading the file…',

  /** The month's table and its cards. */
  agentCode: 'Agent code',
  active: 'Active',
  activeColumn: 'Active (MAA)',
  notActive: 'Not active',
  notReported: 'Not reported',
  nothingReported: 'nothing reported',
  loadingMonth: ({ month }: { month: string }) => `Loading the data for ${month}…`,
  dataFor: ({ month }: { month: string }) => `Data for ${month}`,
  nothingUploaded: ({ month }: { month: string }) =>
    `Nothing has been uploaded for ${month} yet. Every member is listed so you can see who the file will need to cover.`,
  withFigures: ({ n, of }: { n: number; of: number }) => `${n} of ${of} members have figures for this month.`,
  tapAgent: 'Tap an agent to correct their figures — no need to re-upload for a single fix.',
  tapNumber: 'Tap any number to correct it manually — no need to re-upload for a single fix.',
  /** The table's legend, in the client's words (P18.97-T4 AC-2; UI-023). */
  legend: {
    corrected: 'corrected by hand',
    dash: 'a dash',
    notReported: 'not reported',
    active: 'APE or policies > 0 this month',
  },
  /** A figure as a control (P9-T5): its name says what, whose, and what it reads now. */
  correctFigure: ({ label, name, now, note }: { label: string; name: string; now: string; note: string | null }) =>
    `Correct ${label} for ${name}, now ${now}${note ? `, ${note}` : ''}`,
  correctFiguresFor: ({ name }: { name: string }) => `Correct figures for ${name}`,

  /** What the last write did, in a sentence (P9-T4, P9-T5). */
  imported: ({ records, month, kept: held, replaced }: { records: number; month: string; kept: number; replaced: number }) => {
    const corrections = [
      ...(held ? [`${held} correction${held === 1 ? '' : 's'} kept`] : []),
      ...(replaced ? [`${replaced} correction${replaced === 1 ? '' : 's'} replaced with the file’s figure`] : []),
    ].join(', ');
    return `Imported ${records} agent record${records === 1 ? '' : 's'} for ${month}.${corrections ? ` ${corrections}.` : ''}`;
  },
  reverted: ({ filename, restored, kept: held }: { filename: string; restored: number; kept: number }) =>
    `Reverted “${filename}”: ${restored} figure${restored === 1 ? '' : 's'} put back`
    + `${held ? `, ${held} kept because something changed them since` : ''}.`,
  relocked: ({ month, locked }: { month: string; locked: boolean }) => `${month} is ${locked ? 'locked' : 'open again'}.`,
  corrected: ({ label, who, before, after }: { label: string; who: string; before: string; after: string }) =>
    `Corrected ${label} for ${who}: ${before} → ${after}.`,
  correctedMany: ({ n, who, changes }: { n: number; who: string; changes: string }) => `Corrected ${n} figures for ${who}: ${changes}.`,
  unchanged: ({ label, who, after }: { label: string; who: string; after: string }) =>
    `${label} for ${who} already reads ${after} — nothing was changed.`,
  thisMember: 'this member',

  /** Reading a file, and one that could not be read (P9-T3). */
  reading: ({ filename }: { filename: string }) => `Reading “${filename}”`,
  notRead: ({ filename }: { filename: string }) => `“${filename}” was not read. Nothing has been saved.`,
  dismiss: 'Dismiss',

  /** The preview: what the file would change, a diff (P9-T3 AC-8). */
  ready: ({ ready, skipped }: { ready: number; skipped: number }) =>
    `${ready} agent${ready === 1 ? '' : 's'} ready to import${skipped ? `, ${skipped} row${skipped === 1 ? '' : 's'} skipped` : ''}.`,
  fromFile: ({ filename, figures }: { filename: string; figures: string }) => `From “${filename}”. Figures: ${figures}.`,
  figures: ({ fresh, changed, unchanged, blank, refused, corrections }: {
    fresh: number; changed: number; unchanged: number; blank: number; refused: number; corrections: number;
  }) => [
    `${fresh} new`,
    `${changed} changed`,
    `${unchanged} already as stored`,
    `${blank} left blank, which keep what is stored`,
    ...(refused ? [`${refused} not taken`] : []),
    ...(corrections ? [`${corrections} corrected by hand, kept unless you tick them`] : []),
  ].join(' · '),
  notInFile: ({ n }: { n: number }) =>
    `${n} active member${n === 1 ? ' is' : 's are'} not in the file and keep what they have.`,
  nothingSavedYet: 'Nothing has been saved yet.',
  confirmWrites: ({ month }: { month: string }) =>
    `Confirm import writes the figures in bold into ${month}; a blank keeps what is stored, and what is not taken is left out.`,
  correctedByHand: ({ n }: { n: number }) => `Corrected by hand (${n})`,
  replaceAll: 'Replace all',
  keepAll: 'Keep all',
  correctionsNote: 'The file would change these figures, which somebody corrected by hand. Each is kept unless you tick it.',
  notTaken: ({ n }: { n: number }) => `Not taken (${n})`,
  line: ({ line, code, name }: { line: number; code: string | null; name: string | null }) =>
    `Line ${line} · ${code || 'no code'}${name ? ` · ${name}` : ''}`,
  wouldChange: ({ filename }: { filename: string }) => `What “${filename}” would change`,
  fileSays: ({ name }: { name: string }) => `the file says “${name}”`,
  readFrom: ({ code }: { code: string }) => `read from “${code}”`,
  importing: 'Importing…',
  confirmImport: 'Confirm import',
  cancel: 'Cancel',
  lockedImport: ({ month }: { month: string }) => `${month} is locked — reopen it to import.`,
  nothingWouldChangeCorrected: 'Nothing would change — every figure it would, somebody corrected, and none is ticked.',
  nothingWouldChange: 'Nothing in this file would change a figure.',
  /** One cell of the diff. */
  correctionKept: 'correction kept',
  replacesCorrection: 'replaces a correction',
  was: ({ figure }: { figure: string }) => `was ${figure}`,
  leftBlank: 'left blank',
  notTakenCell: ' — not taken',
  /** One figure somebody corrected, that the file would change (ADR-0053). */
  choice: ({ now, by, day, reason, file, old }: {
    now: string | null; by: string | null; day: string | null; reason: string | null; file: string; old: boolean;
  }) => {
    const done = now === null ? 'Emptied' : `Corrected to ${now}`;
    return `${done} by ${by ?? 'somebody'}${day ? ` on ${day}` : ''}${reason ? ` — “${reason}”` : ''}.`
      + ` The file says ${file}${old ? ' — the figure the correction replaced, so this is probably the old file' : ''}.`;
  },
  choiceFor: ({ label, name }: { label: string; name: string }) => `${label} for ${name}: `,
  replaceWithFile: 'Replace with the file’s figure',

  /** Correct one figure (P9-T5), and an agent's twelve on a phone (P18.97-T7 AC-2). */
  correctHeading: ({ label, name }: { label: string; name: string }) => `Correct ${label} for ${name}`,
  now: ({ figure }: { figure: string }) => `Now: ${figure}`,
  source: { imported: 'from the carrier’s file', corrected: 'corrected by hand', self_reported: 'reported by the agent' } satisfies Record<Writer, string>,
  /** Whose a figure is, as the table's ✎ says it: *corrected by hand by Maya Halim on 26 Sep 2026 — “Carrier restated it”*. */
  handNote: ({ emptied, by, day, reason }: { emptied: boolean; by: string | null; day: string | null; reason: string | null }) =>
    `${emptied ? 'emptied by hand' : 'corrected by hand'}${by ? ` by ${by}` : ''}${day ? ` on ${day}` : ''}${reason ? ` — “${reason}”` : ''}`,
  /** The source in brackets after *Now*: *(from the carrier's file)*, *(corrected by hand by Maya Halim on … — “…”)*. */
  sourceNote: ({ source, by, day, reason }: { source: string; by: string | null; day: string | null; reason: string | null }) =>
    ` (${source}${by ? ` by ${by}` : ''}${day ? ` on ${day}` : ''}${reason ? ` — “${reason}”` : ''})`,
  newFigure: 'New figure',
  why: 'Why is it being corrected?',
  whyHint: 'Kept with the figure, and in the audit log.',
  sayWhy: 'Say why the figure is being corrected.',
  typeFigure: 'Type the figure.',
  typeNewFigure: 'Type the new figure — to empty it, use Clear figure.',
  notANumber: ({ label }: { label: string }) => `${label} is not a number.`,
  saving: 'Saving…',
  saveCorrection: 'Save correction',
  saveCorrections: 'Save corrections',
  clearFigure: 'Clear figure',
  clearFigures: 'Clear figures',
  clearOne: ({ label, name, month }: { label: string; name: string; month: string }) =>
    `Clear ${label} for ${name} in ${month}? The figure is emptied, as if nothing had been reported, and your reason is kept with the change.`,
  clearSome: ({ labels, name, month }: { labels: readonly string[]; name: string; month: string }) =>
    `Clear ${labels.join(' and ')} for ${name} in ${month}? `
    + `${labels.length === 1 ? 'The figure is' : 'The figures are'} emptied, as if nothing had been reported, `
    + 'and your reason is kept with the change.',
  /** After a metric's name in the sheet's field, read as a sentence names it: *APE this month*. */
  thisMonth: ' this month',
  yearToDate: ' year to date',
  /** A figure as a sentence names it: *APE this month*, *# of policy year to date*. */
  figureLabel: ({ metric, ytd }: { metric: string; ytd: boolean }) => `${metric} ${ytd ? 'year to date' : 'this month'}`,

  /** The month's lock (P9-T4, ADR-0050). */
  locked: 'Locked',
  open: 'Open',
  lockMonth: 'Lock month',
  reopenMonth: 'Reopen month',
  openUntil: ({ day }: { day: string }) => `Open for imports and corrections until ${day}, when it locks.`,
  lockedBySchedule: ({ day }: { day: string }) => `Locked — its window closed after ${day}. Reopen it to change its figures.`,
  lockedBy: ({ who, when }: { who: string | null; when: string | null }) =>
    `Locked by ${who ?? 'somebody'}${when ? ` on ${when}` : ''}. Reopen it to change its figures.`,
  reopenedBy: ({ who, when }: { who: string | null; when: string | null }) =>
    `Reopened by ${who ?? 'somebody'}${when ? ` on ${when}` : ''}. It stays open until somebody locks it again.`,
  askLock: ({ month }: { month: string }) =>
    `Lock ${month}? Imports, reverts and corrections to it will be refused until somebody reopens it.`,
  askReopen: ({ month }: { month: string }) =>
    `Reopen ${month}? Its figures can be imported, reverted and corrected again until somebody locks it.`,

  /** Every import of the month, and the way back from the latest (P9-T4). */
  importsFor: ({ month }: { month: string }) => `Imports for ${month}`,
  nothingImported: ({ month }: { month: string }) => `Nothing has been imported for ${month} yet.`,
  importedBy: ({ by, day, agents, figures, notTaken }: {
    by: string | null; day: string | null; agents: number; figures: number; notTaken: number;
  }) => `Imported by ${by ?? 'somebody'}${day ? ` on ${day}` : ''} · ${agents} agent${agents === 1 ? '' : 's'}, `
    + `${figures} figure${figures === 1 ? '' : 's'}${notTaken ? `, ${notTaken} not taken` : ''}`,
  revertedBy: ({ by, day, restored, kept: held }: { by: string | null; day: string | null; restored: number; kept: number }) =>
    `Reverted by ${by ?? 'somebody'}${day ? ` on ${day}` : ''} — ${restored} figure${restored === 1 ? '' : 's'} put back`
    + `${held ? `, ${held} kept because something changed them since` : ''}.`,
  standing: 'Standing',
  revertedTag: 'Reverted',
  revert: 'Revert',
  revertImport: 'Revert import',
  lockedRevert: ({ month }: { month: string }) => `${month} is locked — reopen it to revert an import.`,
  askRevert: ({ filename, month }: { filename: string; month: string }) =>
    `Revert “${filename}”? Every figure it wrote into ${month} goes back to what it was before — empty where it was empty.`,

  /** Whose a figure is, as a reader is told it (`PROVENANCE_LABEL`, P9-T6). */
  provenance: { imported: 'the carrier’s file', corrected: 'corrected by hand', self_reported: 'the agent’s own figure' } satisfies Record<Writer, string>,
};

const id: MessagesOf<typeof en> = {
  title: kept('Data upload'),
  subtitle: `${kept('APE')}, ${kept('Rolling persistency')}, ${kept('Recruitment')}, ${kept('New active agents')}, ${kept('FYP')} dan ${kept('# of policy')} — satu file per bulan, dicocokkan dengan kode agen.`,
  month: 'Bulan',
  downloadTemplate: 'Unduh templat',
  templateFailed: ({ message }) => `Templat tidak dapat disiapkan. ${message}`,
  tryAgain: 'Coba lagi',
  upload: '+ Unggah templat yang sudah diisi',
  readingFile: 'Membaca file…',

  agentCode: 'Kode agen',
  active: 'Aktif',
  activeColumn: 'Aktif (MAA)',
  notActive: 'Tidak aktif',
  notReported: 'Belum dilaporkan',
  nothingReported: 'tidak dilaporkan',
  loadingMonth: ({ month }) => `Memuat data untuk ${month}…`,
  dataFor: ({ month }) => `Data untuk ${month}`,
  nothingUploaded: ({ month }) =>
    `Belum ada yang diunggah untuk ${month}. Setiap anggota ditampilkan agar Anda bisa melihat siapa saja yang perlu ada di file.`,
  withFigures: ({ n, of }) => `${n} dari ${of} anggota memiliki angka untuk bulan ini.`,
  tapAgent: 'Ketuk agent untuk mengoreksi angkanya — tidak perlu mengunggah ulang untuk satu perbaikan.',
  tapNumber: 'Ketuk angka mana pun untuk mengoreksinya secara manual — tidak perlu mengunggah ulang untuk satu perbaikan.',
  legend: {
    corrected: 'dikoreksi manual',
    dash: 'tanda pisah',
    notReported: 'belum dilaporkan',
    active: `${kept('APE')} atau polis > 0 bulan ini`,
  },
  correctFigure: ({ label, name, now, note }) => `Koreksi ${label} untuk ${name}, sekarang ${now}${note ? `, ${note}` : ''}`,
  correctFiguresFor: ({ name }) => `Koreksi angka ${name}`,

  // One form for one and many (§B.0 rule 8): *1 data agent*, *3 data agent*; *koreksi*, *angka*.
  imported: ({ records, month, kept: held, replaced }) => {
    const corrections = [
      ...(held ? [`${held} koreksi dipertahankan`] : []),
      ...(replaced ? [`${replaced} koreksi diganti dengan angka dari file`] : []),
    ].join(', ');
    return `${records} data agent untuk ${month} diimpor.${corrections ? ` ${corrections}.` : ''}`;
  },
  reverted: ({ filename, restored, kept: held }) =>
    `“${filename}” dikembalikan: ${restored} angka dipulihkan`
    + `${held ? `, ${held} dipertahankan karena sudah diubah sejak itu` : ''}.`,
  relocked: ({ month, locked }) => `${month} ${locked ? 'terkunci' : 'terbuka kembali'}.`,
  corrected: ({ label, who, before, after }) => `${label} untuk ${who} dikoreksi: ${before} → ${after}.`,
  correctedMany: ({ n, who, changes }) => `${n} angka untuk ${who} dikoreksi: ${changes}.`,
  unchanged: ({ label, who, after }) => `${label} untuk ${who} sudah ${after} — tidak ada yang diubah.`,
  thisMember: 'anggota ini',

  reading: ({ filename }) => `Membaca “${filename}”`,
  notRead: ({ filename }) => `“${filename}” tidak terbaca. Belum ada yang disimpan.`,
  dismiss: 'Tutup',

  ready: ({ ready, skipped }) => `${ready} agent siap diimpor${skipped ? `, ${skipped} baris dilewati` : ''}.`,
  fromFile: ({ filename, figures }) => `Dari “${filename}”. Angka: ${figures}.`,
  figures: ({ fresh, changed, unchanged, blank, refused, corrections }) => [
    `${fresh} baru`,
    `${changed} berubah`,
    `${unchanged} sudah sama dengan yang tersimpan`,
    `${blank} dibiarkan kosong, yang mempertahankan yang tersimpan`,
    ...(refused ? [`${refused} tidak diambil`] : []),
    ...(corrections ? [`${corrections} dikoreksi manual, dipertahankan kecuali Anda mencentangnya`] : []),
  ].join(' · '),
  notInFile: ({ n }) => `${n} anggota aktif tidak ada di file dan tetap dengan angkanya.`,
  nothingSavedYet: 'Belum ada yang disimpan.',
  confirmWrites: ({ month }) =>
    `Konfirmasi impor menulis angka bercetak tebal ke ${month}; yang kosong mempertahankan yang tersimpan, dan yang tidak diambil dilewati.`,
  correctedByHand: ({ n }) => `Dikoreksi manual (${n})`,
  replaceAll: 'Ganti semua',
  keepAll: 'Pertahankan semua',
  correctionsNote: 'File ini akan mengubah angka-angka berikut, yang sudah dikoreksi manual oleh seseorang. Masing-masing dipertahankan kecuali Anda mencentangnya.',
  notTaken: ({ n }) => `Tidak diambil (${n})`,
  line: ({ line, code, name }) => `Baris ${line} · ${code || 'tanpa kode'}${name ? ` · ${name}` : ''}`,
  wouldChange: ({ filename }) => `Yang akan diubah oleh “${filename}”`,
  fileSays: ({ name }) => `di file tertulis “${name}”`,
  readFrom: ({ code }) => `dibaca dari “${code}”`,
  importing: 'Mengimpor…',
  confirmImport: 'Konfirmasi impor',
  cancel: 'Batal',
  lockedImport: ({ month }) => `${month} terkunci — buka kembali untuk mengimpor.`,
  nothingWouldChangeCorrected: 'Tidak ada yang berubah — setiap angka yang akan diubahnya sudah dikoreksi seseorang, dan tidak ada yang dicentang.',
  nothingWouldChange: 'Tidak ada isi file ini yang mengubah angka.',
  correctionKept: 'koreksi dipertahankan',
  replacesCorrection: 'mengganti koreksi',
  was: ({ figure }) => `sebelumnya ${figure}`,
  leftBlank: 'dibiarkan kosong',
  notTakenCell: ' — tidak diambil',
  choice: ({ now, by, day, reason, file, old }) => {
    const done = now === null ? 'Dikosongkan' : `Dikoreksi menjadi ${now}`;
    return `${done} oleh ${by ?? 'seseorang'}${day ? ` pada ${day}` : ''}${reason ? ` — “${reason}”` : ''}.`
      + ` Di file tertulis ${file}${old ? ' — angka yang diganti oleh koreksi itu, jadi kemungkinan ini file lama' : ''}.`;
  },
  choiceFor: ({ label, name }) => `${label} untuk ${name}: `,
  replaceWithFile: 'Ganti dengan angka dari file',

  correctHeading: ({ label, name }) => `Koreksi ${label} untuk ${name}`,
  now: ({ figure }) => `Sekarang: ${figure}`,
  source: { imported: 'dari file perusahaan', corrected: 'dikoreksi manual', self_reported: 'dilaporkan oleh agent' },
  handNote: ({ emptied, by, day, reason }) =>
    `${emptied ? 'dikosongkan manual' : 'dikoreksi manual'}${by ? ` oleh ${by}` : ''}${day ? ` pada ${day}` : ''}${reason ? ` — “${reason}”` : ''}`,
  sourceNote: ({ source, by, day, reason }) =>
    ` (${source}${by ? ` oleh ${by}` : ''}${day ? ` pada ${day}` : ''}${reason ? ` — “${reason}”` : ''})`,
  newFigure: 'Angka baru',
  why: 'Mengapa angka ini dikoreksi?',
  whyHint: 'Disimpan bersama angkanya, dan di log audit.',
  sayWhy: 'Tuliskan mengapa angka ini dikoreksi.',
  typeFigure: 'Ketik angkanya.',
  typeNewFigure: 'Ketik angka yang baru — untuk mengosongkannya, gunakan Hapus angka.',
  notANumber: ({ label }) => `${label} bukan angka.`,
  saving: 'Menyimpan…',
  saveCorrection: 'Simpan koreksi',
  saveCorrections: 'Simpan koreksi',
  clearFigure: 'Hapus angka',
  clearFigures: 'Hapus angka',
  clearOne: ({ label, name, month }) =>
    `Hapus ${label} untuk ${name} di ${month}? Angkanya dikosongkan, seolah-olah tidak pernah dilaporkan, dan alasan Anda disimpan bersama perubahan ini.`,
  clearSome: ({ labels, name, month }) =>
    `Hapus ${labels.join(' dan ')} untuk ${name} di ${month}? `
    + 'Angkanya dikosongkan, seolah-olah tidak pernah dilaporkan, dan alasan Anda disimpan bersama perubahan ini.',
  thisMonth: ' bulan ini',
  yearToDate: ' sejak awal tahun',
  figureLabel: ({ metric, ytd }) => `${metric} ${ytd ? 'sejak awal tahun' : 'bulan ini'}`,

  locked: 'Terkunci',
  open: 'Terbuka',
  lockMonth: 'Kunci bulan',
  reopenMonth: 'Buka kembali bulan',
  openUntil: ({ day }) => `Terbuka untuk impor dan koreksi sampai ${day}, lalu terkunci.`,
  lockedBySchedule: ({ day }) => `Terkunci — masa ubahnya berakhir setelah ${day}. Buka kembali untuk mengubah angkanya.`,
  lockedBy: ({ who, when }) => `Dikunci oleh ${who ?? 'seseorang'}${when ? ` pada ${when}` : ''}. Buka kembali untuk mengubah angkanya.`,
  reopenedBy: ({ who, when }) =>
    `Dibuka kembali oleh ${who ?? 'seseorang'}${when ? ` pada ${when}` : ''}. Tetap terbuka sampai seseorang menguncinya lagi.`,
  askLock: ({ month }) => `Kunci ${month}? Impor, pengembalian, dan koreksi untuk bulan ini akan ditolak sampai seseorang membukanya kembali.`,
  askReopen: ({ month }) => `Buka kembali ${month}? Angkanya bisa diimpor, dikembalikan, dan dikoreksi lagi sampai seseorang menguncinya.`,

  importsFor: ({ month }) => `Impor untuk ${month}`,
  nothingImported: ({ month }) => `Belum ada yang diimpor untuk ${month}.`,
  importedBy: ({ by, day, agents, figures, notTaken }) =>
    `Diimpor oleh ${by ?? 'seseorang'}${day ? ` pada ${day}` : ''} · ${agents} agent, ${figures} angka${notTaken ? `, ${notTaken} tidak diambil` : ''}`,
  revertedBy: ({ by, day, restored, kept: held }) =>
    `Dikembalikan oleh ${by ?? 'seseorang'}${day ? ` pada ${day}` : ''} — ${restored} angka dipulihkan`
    + `${held ? `, ${held} dipertahankan karena sudah diubah sejak itu` : ''}.`,
  standing: 'Berlaku',
  revertedTag: 'Dikembalikan',
  revert: 'Kembalikan',
  revertImport: 'Kembalikan impor',
  lockedRevert: ({ month }) => `${month} terkunci — buka kembali untuk mengembalikan impor.`,
  askRevert: ({ filename, month }) =>
    `Kembalikan “${filename}”? Setiap angka yang ditulisnya ke ${month} kembali seperti sebelumnya — kosong jika sebelumnya kosong.`,

  provenance: { imported: 'file perusahaan', corrected: 'dikoreksi manual', self_reported: 'angka agent sendiri' },
};

export const dataUploadMessages = defineMessages({ en, id });
