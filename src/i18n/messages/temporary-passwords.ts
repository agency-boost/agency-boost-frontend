import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * ***Akun & password*** (P19.30-T1, T2; ADR-0288; glossary *Akun & password*, *Password sementara*): the item that opens
 * the confirmation — the KPM page's ⋯ for the Super Admin, *All members*' ⋯ for an Owner, *Import people*'s result — and
 * the confirmation itself (`components/temporary-passwords-dialog.tsx`). **The Indonesian is the source**: the item's name
 * is the phase file's, *Unduh akun & password (PDF)*; the rest is ours, in the console's idiom (parity I-1315 to I-1318).
 * *Akun & password* and *Password sementara* are the glossary's own words, the same in both languages' UI.
 *
 * @moved components/temporary-passwords-dialog.tsx
 */
const en = {
  /** The menu item and the dialog's button. */
  item: 'Download accounts & passwords (PDF)',
  title: 'Accounts & passwords',
  /** Under the title: the KPM. */
  subtitle: ({ kpm }: { kpm: string }) => kpm,
  loading: 'Counting the accounts…',
  /** How many the PDF lists, before anything is issued. */
  lists: ({ n }: { n: number }) => `The PDF lists ${n} ${n === 1 ? 'person' : 'people'} who do not use their own password yet, each with a new temporary password.`,
  older: 'Any PDF downloaded before stops working for them.',
  firstSignIn: 'Each must choose their own password the first time they sign in.',
  confidential: 'Confidential — give each person only their own line.',
  /** The empty case: nobody left to list. */
  nobody: 'Everybody already uses their own password. There is nobody to put in the PDF.',
  /** Step 1: issue the passwords and make the PDF, held in the dialog. */
  make: 'Make PDF',
  making: 'Making the PDF…',
  /** Step 2: save the PDF it holds — as often as needed, the same file. */
  download: 'Download PDF',
  /** Closes the dialog and lets the PDF go. */
  done: 'Done',
  cancel: 'Cancel',
  close: 'Close',
  /** The toast once the PDF is made: ready, not yet saved. */
  ready: ({ n }: { n: number }) => `The PDF is ready: ${n} ${n === 1 ? 'account' : 'accounts'}. Download it now.`,
  /** The dialog once the PDF is made. */
  madeLine: ({ n }: { n: number }) => `The PDF with ${n} ${n === 1 ? 'account' : 'accounts'} is ready. Its passwords work from now on.`,
  again: 'Download PDF saves this same file as often as you need. Making a new PDF gives everybody new passwords.',
  /** All members' ⋯: its accessible name. */
  more: 'More for all members',
};

const id: MessagesOf<typeof en> = {
  item: 'Unduh akun & password (PDF)',
  title: 'Akun & password',
  subtitle: ({ kpm }) => kpm,
  loading: 'Menghitung akun…',
  lists: ({ n }) => `PDF ini memuat ${n} orang yang belum memakai password sendiri, masing-masing dengan password sementara baru.`,
  older: 'PDF yang diunduh sebelumnya tidak berlaku lagi untuk mereka.',
  firstSignIn: 'Saat pertama masuk, setiap orang wajib membuat password sendiri.',
  confidential: 'Rahasia — berikan ke masing-masing orang barisnya sendiri saja.',
  nobody: 'Semua orang sudah memakai password sendiri. Tidak ada yang perlu dimasukkan ke PDF.',
  make: 'Buat PDF',
  making: 'Membuat PDF…',
  download: 'Unduh PDF',
  done: 'Selesai',
  cancel: 'Batal',
  close: 'Tutup',
  ready: ({ n }) => `PDF siap: ${n} akun. Unduh sekarang.`,
  madeLine: ({ n }) => `PDF berisi ${n} akun sudah siap. Password di dalamnya berlaku mulai sekarang.`,
  again: 'Unduh PDF menyimpan file yang sama ini, berapa kali pun perlu. Membuat PDF baru memberi semua orang password baru.',
  more: 'Lainnya untuk semua anggota',
};

export const temporaryPasswordsMessages = defineMessages({ en, id });
