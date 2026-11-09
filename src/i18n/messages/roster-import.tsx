import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Filling and updating an office from a spreadsheet** (P18.10-T4; the setup spec's §A3 since P19.3-T4, ADR-0205;
 * `functional/tenant-provisioning.md`, *Filling an office from a spreadsheet*): `components/roster-import.tsx`, drawn by
 * the office's *Import people* (`/people/import`) and the Super Admin's *Import a roster* (`/admin/tenants/[kpmId]/roster`)
 * — the template (Excel or CSV, ADR-0184), the fill-in guide (*Panduan pengisian*: the file's columns and its rules), the
 * two ways in, the check with a result per row, the skipped rows' file, the invitation, and what was imported.
 *
 * **English is the source.** The Indonesian is A3's where A3 gives a line — *"N orang baru siap diimpor, M diperbarui, K
 * baris dilewati"*, *"⬇ Unduh baris yang dilewati"*, *Masuk*, *Diperbarui*, *Dilewati*, *"N anggota diimpor."* — and the
 * approved glossary's otherwise: *Unduh template*, *Unggah*, *Mengimpor…* (§B.1, §B.2), *office* as *KPM* (§B.9). **Two
 * of A3's lines name email instead of WhatsApp** (ADR-0205 §7; invitations go by email, ADR-0010): the checkbox *"Kirim
 * undangan lewat email ke N orang baru"* and the toast *"Undangan dikirim lewat email."* (glossary, *Member import
 * invitation*). **Files are not words** (P18.10-T3 AC-4): the header names (*Kode agen*, *Kode upline*) and what is typed
 * in a cell — `AB`, `DD/MM/YYYY`, `Full-time`, `male` — are the import's contract, the same in both languages; so are the
 * server's own sentences about a row. **Typed content stays as typed**: names, emails, codes.
 *
 * @moved components/roster-import.tsx
 * @moved app/(tenant)/people/import/page.tsx
 */

/** What each guide row's "holds" draws a typed code with. */
type Code = (typed: string) => ReactNode;

const en = {
  /** `/people/import`'s line, and its state for a reader in no office (the approved §B.6 sentence). */
  importSubtitle: 'Add or update several people at once from a spreadsheet.',
  notInOffice: 'You are not in an office.',
  /** The file's columns, in its order (P18.9-T4 AC-4; A3): each header name, and what each holds. */
  guideCaption: 'The file’s columns, in order: one row per person',
  guideColumns: { column: 'Column', holds: 'What it holds' },
  holds: {
    agentCode: 'The code their insurer issued, digits only. A code already in this KPM updates that person.',
    fullName: 'Their full name',
    role: ({ code }: { code: Code }) => <>{code('Agent')}, {code('AAB')} or {code('AB')}. {code('Agen')} is read as Agent.</>,
    upline: 'The agent code of their upline: a leader at least their rank, in the file or already in the KPM. Empty only for the top rung',
    phone: 'Optional. Without one they are added, and cannot be reminded on WhatsApp yet',
    email: 'What they sign in with. Needed for somebody new: the invitation goes there',
    joinDate: ({ code }: { code: Code }) => <>{code('DD/MM/YYYY')}, the day they joined this KPM. Empty is today</>,
    workStatus: ({ code }: { code: Code }) => <>{code('Full-time')} or {code('Part-time')}</>,
    dateOfBirth: ({ code }: { code: Code }) => <>{code('DD/MM/YYYY')}, at least 18 years ago</>,
    gender: ({ code }: { code: Code }) => <>{code('male')} or {code('female')}</>,
    companyJoinMonth: ({ code }: { code: Code }) => <>{code('YYYY-MM')}, the month they joined the insurer</>,
  },
  /**
   * **Card 1, the template** (ADR-0184): Excel recommended, CSV beside it. *Excel (.xlsx)* and *CSV* are the files' own
   * names, kept as they are inside each language's verb.
   */
  downloadHeading: 'Download the template',
  downloadExcel: 'Download Excel (.xlsx)',
  recommended: 'Recommended',
  downloadCsv: 'Download CSV',
  preparing: 'Preparing the file…',
  /** `message` the server's own sentence. */
  templateFailed: ({ message }: { message: string }) => `The template could not be prepared. ${message}`,
  tryAgain: 'Try again',
  /** **The fill-in guide**, apart from the data: the columns, then the rules (ADR-0184; A3). */
  guideHeading: 'How to fill it in',
  ruleRequired: 'Kode agen, Nama and Peran are required. Leave any other cell empty when you do not know it.',
  ruleOnePerRow: 'One person per row.',
  ruleUplines: 'Rows can come in any order: an upline is matched in the file and among the people already in the KPM.',
  ruleSkipped: 'A row with a problem is skipped with its reason, and the rest are imported together.',
  /** **Card 2, the upload**: the filled file first, the paste second (ADR-0184). */
  uploadHeading: 'Upload',
  how: 'How are you adding them?',
  upload: 'Upload the filled file (.xlsx or .csv)',
  paste: 'Paste from a spreadsheet',
  rows: 'Rows from your spreadsheet',
  rowsHint: 'Select the rows in Excel, Google Sheets or Numbers, copy them, and paste here. The header row is optional.',
  rosterFile: 'Roster file',
  check: 'Check the file',
  checking: 'Checking…',
  /** **The file cannot be read at all** — no Kode agen column, an unknown one: said whole, nothing imported. */
  unreadable: ({ n }: { n: number }) => `The file could not be read: ${n} ${n === 1 ? 'problem' : 'problems'}`,
  unreadableLine: 'Nothing in it can be imported until this is fixed. Line numbers count the header, the way a spreadsheet does.',
  problemsCaption: 'What is wrong with the file',
  problemColumns: { line: 'Line', column: 'Column', problem: 'Problem' },
  /**
   * **The preview** (A3): *"N new people ready to import, M updated, K rows skipped."* A part that is zero is left out,
   * as A3's own mockup leaves it.
   */
  ready: ({ imported, updated, skipped }: { imported: number; updated: number; skipped: number }) =>
    `${imported} new ${imported === 1 ? 'person' : 'people'} ready to import`
    + `${updated ? `, ${updated} updated` : ''}${skipped ? `, ${skipped} ${skipped === 1 ? 'row' : 'rows'} skipped` : ''}.`,
  resultsCaption: 'Each row of the file, and what it comes to',
  resultColumns: { agentCode: 'Agent code', name: 'Name', role: 'Role', upline: 'Upline code', result: 'Result' },
  outcome: { imported: 'Imported', updated: 'Updated', skipped: 'Skipped' },
  /** No upline on a row. */
  none: 'None',
  /** A3's checkbox, naming email (ADR-0205 §7): `n` the new people. */
  invite: ({ n }: { n: number }) => `Send an email invitation to ${n} new ${n === 1 ? 'person' : 'people'}`,
  inviteHint: 'Each gets a one-time link to choose their password. Nothing is sent by WhatsApp.',
  /** `n` the rows that would be written: the new and the updated. */
  importN: ({ n }: { n: number }) => `Import ${n} ${n === 1 ? 'person' : 'people'}`,
  importing: 'Importing…',
  cancel: 'Cancel',
  downloadSkipped: '⬇ Download the skipped rows',
  /** **Done** (A3's toast, naming email): who was imported, who updated, and whether they were invited. */
  done: ({ imported, updated }: { imported: number; updated: number }) =>
    `${imported} ${imported === 1 ? 'member' : 'members'} imported${updated ? `, ${updated} updated` : ''}`,
  toast: ({ imported, updated, invited }: { imported: number; updated: number; invited: boolean }) =>
    `${imported} ${imported === 1 ? 'member' : 'members'} imported${updated ? `, ${updated} updated` : ''}.`
    + `${invited ? ' Invitations sent by email.' : ''}`,
  invitedLine: ({ n }: { n: number }) =>
    `An invitation went by email to ${n} new ${n === 1 ? 'person' : 'people'}, with a link to choose their password.`,
  notInvitedLine: 'Nobody was emailed. Each new person can sign in with Forgot your password? and their email.',
  skippedLine: ({ n }: { n: number }) => `${n} ${n === 1 ? 'row was' : 'rows were'} skipped. Download them, fix them and upload them again.`,
  back: 'Back',
};

const id: MessagesOf<typeof en> = {
  importSubtitle: 'Tambah atau perbarui beberapa orang sekaligus dari spreadsheet.',
  notInOffice: `Anda belum tergabung di ${kept('KPM')} mana pun.`,
  guideCaption: 'Kolom file, berurutan: satu baris per orang',
  guideColumns: { column: 'Kolom', holds: 'Isinya' },
  holds: {
    agentCode: `Kode dari perusahaan asuransinya, hanya angka. Kode yang sudah ada di ${kept('KPM')} ini memperbarui data orang itu.`,
    fullName: 'Nama lengkapnya',
    role: ({ code }) => <>{code('Agent')}, {code('AAB')}, atau {code('AB')}. {code('Agen')} dibaca sebagai Agent.</>,
    upline: `Kode agen upline-nya: ${kept('leader')} yang jenjangnya paling tidak sama, di file atau sudah ada di ${kept('KPM')}. Kosongkan hanya untuk jenjang teratas`,
    phone: 'Opsional. Tanpa nomor, mereka tetap masuk, tetapi belum bisa diingatkan lewat WhatsApp',
    email: 'Untuk masuk. Wajib untuk orang baru: undangan dikirim ke sana',
    joinDate: ({ code }) => <>{code('DD/MM/YYYY')}, tanggal bergabung di {kept('KPM')} ini. Kosong berarti hari ini</>,
    workStatus: ({ code }) => <>{code('Full-time')} atau {code('Part-time')}</>,
    dateOfBirth: ({ code }) => <>{code('DD/MM/YYYY')}, minimal 18 tahun yang lalu</>,
    gender: ({ code }) => <>{code('male')} atau {code('female')}</>,
    companyJoinMonth: ({ code }) => <>{code('YYYY-MM')}, bulan dia bergabung dengan perusahaan asuransi</>,
  },
  downloadHeading: 'Unduh template',
  downloadExcel: 'Unduh Excel (.xlsx)',
  recommended: 'Disarankan',
  downloadCsv: 'Unduh CSV',
  preparing: 'Menyiapkan file…',
  templateFailed: ({ message }) => `Template tidak dapat disiapkan. ${message}`,
  tryAgain: 'Coba lagi',
  guideHeading: 'Panduan pengisian',
  ruleRequired: 'Kode agen, Nama, dan Peran wajib diisi. Kosongkan sel lain bila tidak tahu isinya.',
  ruleOnePerRow: 'Satu orang per baris.',
  ruleUplines: `Urutan baris bebas: upline dicocokkan dari file dan dari anggota yang sudah ada di ${kept('KPM')}.`,
  ruleSkipped: 'Baris yang bermasalah dilewati dengan alasannya. Sisanya masuk sekaligus.',
  uploadHeading: 'Unggah',
  how: 'Bagaimana Anda menambahkan mereka?',
  upload: 'Unggah file yang sudah diisi (.xlsx atau .csv)',
  paste: 'Tempel dari spreadsheet',
  rows: 'Baris dari spreadsheet Anda',
  rowsHint: 'Pilih baris di Excel, Google Sheets, atau Numbers, salin, lalu tempel di sini. Baris judul kolom bersifat opsional.',
  rosterFile: 'File roster',
  check: 'Periksa file',
  checking: 'Memeriksa…',
  unreadable: ({ n }) => `File tidak dapat dibaca: ${n} masalah`,
  unreadableLine: 'Tidak ada isinya yang bisa diimpor sebelum ini diperbaiki. Nomor baris menghitung baris judul kolom, seperti di spreadsheet.',
  problemsCaption: 'Yang salah dengan file ini',
  problemColumns: { line: 'Baris', column: 'Kolom', problem: 'Masalah' },
  ready: ({ imported, updated, skipped }) =>
    `${imported} orang baru siap diimpor${updated ? `, ${updated} diperbarui` : ''}${skipped ? `, ${skipped} baris dilewati` : ''}.`,
  resultsCaption: 'Setiap baris file, dan hasilnya',
  resultColumns: { agentCode: 'Kode agen', name: 'Nama', role: 'Peran', upline: 'Kode upline', result: 'Hasil' },
  outcome: { imported: 'Masuk', updated: 'Diperbarui', skipped: 'Dilewati' },
  none: 'Tidak ada',
  invite: ({ n }) => `Kirim undangan lewat email ke ${n} orang baru`,
  inviteHint: 'Masing-masing mendapat tautan sekali pakai untuk membuat kata sandi. Tidak ada yang dikirim lewat WhatsApp.',
  importN: ({ n }) => `Impor ${n} orang`,
  importing: 'Mengimpor…',
  cancel: 'Batal',
  downloadSkipped: '⬇ Unduh baris yang dilewati',
  done: ({ imported, updated }) => `${imported} anggota diimpor${updated ? `, ${updated} diperbarui` : ''}`,
  toast: ({ imported, updated, invited }) =>
    `${imported} anggota diimpor${updated ? `, ${updated} diperbarui` : ''}.${invited ? ' Undangan dikirim lewat email.' : ''}`,
  invitedLine: ({ n }) => `Undangan dikirim lewat email ke ${n} orang baru, dengan tautan untuk membuat kata sandi.`,
  notInvitedLine: 'Tidak ada email yang dikirim. Setiap orang baru dapat masuk lewat Lupa kata sandi? dengan email-nya.',
  skippedLine: ({ n }) => `${n} baris dilewati. Unduh, perbaiki, lalu unggah lagi.`,
  back: 'Kembali',
};

export const rosterImportMessages = defineMessages({ en, id });
