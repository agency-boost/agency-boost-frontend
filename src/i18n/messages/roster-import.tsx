import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Filling an office from a spreadsheet** (P18.98-T4, people and forum; `functional/tenant-provisioning.md`, *Filling an
 * office from a spreadsheet*): `components/roster-import.tsx`, drawn by the office's *Import people* (`/people/import`)
 * and the Super Admin's *Import a roster* (`/admin/tenants/[kpmId]/roster`) — the file's columns, the template, the
 * two ways in, the check, the problems, and the people made with the password each starts on.
 *
 * **English is the source.** The Indonesian is the approved glossary's: *Unduh templat*, *Unggah*, *Mengimpor…* (§B.1,
 * §B.2), *Kode agen* and *Tanggal lahir* (§B.4), *Lupa kata sandi?* (§B.1), *office* as *KPM* (§B.9). **Files are not
 * words** (P18.98-T3 AC-4): what is typed in a cell — `AB`, `YYYY-MM-DD`, `full-time`, `male` — is the import's contract,
 * passed in as written, never translated; so are the template, its examples, and the server's own sentences about a
 * row (`issue.column`, `issue.message`) and the template's refusal. **Typed content stays as typed**: names, emails,
 * codes, the passwords.
 *
 * @moved components/roster-import.tsx
 * @moved app/(tenant)/people/import/page.tsx
 */

/** A run of words drawn bold, or in italics. */
type Wrap = (words: string) => ReactNode;

const en = {
  /** `/people/import`'s line, and its state for a reader in no office (the approved §B.6 sentence). */
  importSubtitle: 'Create several people at once from a spreadsheet.',
  notInOffice: 'You are not in an office.',
  /** The file's nine columns, in its order (P18.97-T4 AC-4): each name, and what each holds. */
  file: 'The file',
  guideCaption: 'The file’s columns, in order: one row per person',
  guideColumns: { column: 'Column', holds: 'What it holds' },
  columns: {
    name: 'Name',
    email: 'Email',
    agentCode: 'Agent code',
    role: 'Role',
    leader: 'Leader’s agent code (optional)',
    dateOfBirth: 'Date of birth',
    joinMonth: 'Join month',
    workStatus: 'Full/part-time',
    gender: 'Gender',
  },
  holds: {
    name: 'Their full name',
    email: 'An address nobody has registered yet',
    agentCode: 'The code their insurer issued, digits only',
    /** `ab`, `aab`, `agent`: each code as typed in the file. */
    role: ({ ab, aab, agent }: { ab: ReactNode; aab: ReactNode; agent: ReactNode }) => <>{ab}, {aab} or {agent}</>,
    leader: 'Empty for somebody who reports to nobody',
    dateOfBirth: ({ shape }: { shape: ReactNode }) => <>{shape}, at least 18 years ago</>,
    joinMonth: ({ shape }: { shape: ReactNode }) => <>{shape}, the month they joined the insurer</>,
    either: ({ a, b }: { a: ReactNode; b: ReactNode }) => <>{a} or {b}</>,
  },
  /** The template, always in view (P18.97-T4 AC-4). */
  downloadTemplate: 'Download template',
  /** `message` the server's own sentence. */
  templateFailed: ({ message }: { message: string }) => `The template could not be prepared. ${message}`,
  tryAgain: 'Try again',
  loadingTemplate: 'Loading the template…',
  /** The two ways in, the one that needs no file first. */
  how: 'How are you adding them?',
  paste: 'Paste from a spreadsheet',
  upload: 'Upload a CSV file',
  rows: 'Rows from your spreadsheet',
  rowsHint: 'Select the rows in Excel, Google Sheets or Numbers, copy them, and paste here. The header row is optional.',
  rosterFile: 'Roster file',
  /** A file the browser could not read. */
  unreadable: ({ file }: { file: string }) => `Could not read ${file}. Try saving it again as CSV.`,
  /** The check, and the import — all or nothing. */
  check: 'Check the file',
  checking: 'Checking…',
  importing: 'Importing…',
  importN: ({ n }: { n: number }) => `Import ${n}`,
  ready: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'} ready to import. Nothing has been created yet.`,
  problems: ({ n }: { n: number }) => `${n} ${n === 1 ? 'problem' : 'problems'} — nothing will be created`,
  allOrNothing:
    'The import is all or nothing, so every one of these has to be fixed before any of the file lands. Line numbers count the header, the way a spreadsheet does.',
  problemsCaption: 'What is wrong with the file',
  problemColumns: { line: 'Line', column: 'Column', problem: 'Problem' },
  /** The people made, and the password each starts on: shown once. */
  created: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'} created`,
  sendPasswords: ({ strong, em }: { strong: Wrap; em: Wrap }) => (
    <>
      Send each person their password — {strong('AgencyBoost does not email it for you')}. This is the only time it is
      shown: it is not stored anywhere and cannot be looked up. If you lose one, that person can
      use {em('Forgot your password')} on the sign-in page instead.
    </>
  ),
  firstSignIn: 'Everybody here is asked to choose their own password the first time they sign in, and can do nothing else until they have.',
  createdCaption: 'The people created, and the password each one starts on',
  createdColumns: { name: 'Name', email: 'Email', agentCode: 'Agent code', password: 'Temporary password' },
  back: 'Back',
};

const id: MessagesOf<typeof en> = {
  importSubtitle: 'Buat beberapa orang sekaligus dari spreadsheet.',
  notInOffice: `Anda belum tergabung di ${kept('KPM')} mana pun.`,
  file: 'File',
  guideCaption: 'Kolom file, berurutan: satu baris per orang',
  guideColumns: { column: 'Kolom', holds: 'Isinya' },
  columns: {
    name: 'Nama',
    email: 'Email',
    agentCode: 'Kode agen',
    role: 'Peran',
    leader: `Kode agen ${kept('leader')} (opsional)`,
    dateOfBirth: 'Tanggal lahir',
    joinMonth: 'Bulan bergabung',
    workStatus: 'Penuh/paruh waktu',
    gender: 'Jenis kelamin',
  },
  holds: {
    name: 'Nama lengkapnya',
    email: 'Alamat yang belum didaftarkan siapa pun',
    agentCode: 'Kode dari perusahaan asuransinya, hanya angka',
    role: ({ ab, aab, agent }) => <>{ab}, {aab}, atau {agent}</>,
    leader: 'Kosongkan untuk orang yang tidak melapor kepada siapa pun',
    dateOfBirth: ({ shape }) => <>{shape}, minimal 18 tahun yang lalu</>,
    joinMonth: ({ shape }) => <>{shape}, bulan dia bergabung dengan perusahaan asuransi</>,
    either: ({ a, b }) => <>{a} atau {b}</>,
  },
  downloadTemplate: 'Unduh templat',
  templateFailed: ({ message }) => `Templat tidak dapat disiapkan. ${message}`,
  tryAgain: 'Coba lagi',
  loadingTemplate: 'Memuat templat…',
  how: 'Bagaimana Anda menambahkan mereka?',
  paste: 'Tempel dari spreadsheet',
  upload: 'Unggah file CSV',
  rows: 'Baris dari spreadsheet Anda',
  rowsHint: 'Pilih baris di Excel, Google Sheets, atau Numbers, salin, lalu tempel di sini. Baris judul kolom bersifat opsional.',
  rosterFile: 'File roster',
  unreadable: ({ file }) => `Tidak dapat membaca ${file}. Coba simpan ulang sebagai CSV.`,
  check: 'Periksa file',
  checking: 'Memeriksa…',
  importing: 'Mengimpor…',
  importN: ({ n }) => `Impor ${n}`,
  ready: ({ n }) => `${n} orang siap diimpor. Belum ada yang dibuat.`,
  problems: ({ n }) => `${n} masalah — tidak ada yang akan dibuat`,
  allOrNothing:
    'Impor ini semua atau tidak sama sekali, jadi setiap masalah ini harus diperbaiki sebelum isi file mana pun masuk. Nomor baris menghitung baris judul kolom, seperti di spreadsheet.',
  problemsCaption: 'Yang salah dengan file ini',
  problemColumns: { line: 'Baris', column: 'Kolom', problem: 'Masalah' },
  created: ({ n }) => `${n} orang dibuat`,
  sendPasswords: ({ strong, em }) => (
    <>
      Kirimkan kata sandi kepada setiap orang — {strong(`${kept('AgencyBoost')} tidak mengirimkannya lewat email untuk Anda`)}.
      Ini satu-satunya saat kata sandi ditampilkan: tidak disimpan di mana pun dan tidak dapat dicari. Jika ada yang hilang,
      orang tersebut dapat memakai {em('Lupa kata sandi?')} di halaman masuk.
    </>
  ),
  firstSignIn: 'Setiap orang di sini diminta membuat kata sandinya sendiri saat pertama kali masuk, dan tidak dapat melakukan hal lain sebelum itu.',
  createdCaption: 'Orang yang dibuat, dan kata sandi awal masing-masing',
  createdColumns: { name: 'Nama', email: 'Email', agentCode: 'Kode agen', password: 'Kata sandi sementara' },
  back: 'Kembali',
};

export const rosterImportMessages = defineMessages({ en, id });
