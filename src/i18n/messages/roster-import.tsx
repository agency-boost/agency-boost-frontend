import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Import people** — `/people/import` (P19.20-T5; ADR-0273 §6; `functional/tenant-provisioning.md`, *Filling an office
 * from a spreadsheet*): the navy card, *Lihat kolom*, *Unggah anggota* with its tiles and its rows to fix or fill, *Simpan
 * semua*, *Struktur saat ini* and *Riwayat unggah* (`components/roster-import.tsx`).
 *
 * **The Indonesian is the source**: the approved People mockups of 19 November, frames 13–21, word for word — *Tambah
 * banyak anggota sekaligus*, *Isi template, lalu unggah*, *Satu baris per orang · wajib: kode agen, nama, peran · Lihat
 * kolom*, *Unggah file*, *Unduh template*, *Kolom di template* and its eleven hints, *Struktur saat ini*, *dari All
 * members · ketuk untuk membuka*, *Lihat seluruh struktur di Org tree ›*, *Riwayat unggah*, *Unggah anggota*, *Ganti*,
 * *orang baru · diperbarui · perlu dicek · semua disimpan*, *Baru · Diperbarui · Perlu dicek*, *Orang baru menerima
 * undangan lewat email atau WhatsApp. Data yang tidak terbaca dikosongkan, orangnya tetap masuk.*, *Simpan semua (n
 * orang)*, *n orang baru ditandai*. **No word *impor* anywhere in the UI** (the brief's *Import people*). The English is
 * ours. **Files are not words** (P18.10-T3 AC-4): the header names (*Kode agen*, *Kode upline* …) are the file's contract,
 * the same in both languages, and so are the server's own sentences about a row. **Kept** (§A): *KPM*, *All members*,
 * *Org tree*, *AB*, *AAB*, *Agent*, *WhatsApp*.
 *
 * @moved components/roster-import.tsx
 * @moved app/(tenant)/people/import/page.tsx
 */
const en = {
  notInOffice: 'You are not in a KPM.',
  eyebrow: 'Add many members at once',
  title: 'Fill in the template, then upload',
  line: 'One row per person · required: agent code, name, role',
  seeColumns: 'See the columns',
  upload: 'Upload file',
  template: 'Download template',
  columnsTitle: 'Columns in the template',
  closeColumns: 'Close the columns',
  /**
   * Each column's short hint, by the file's own header name — the ones in words. A column whose hint is what the file
   * takes (*DD/MM/YYYY*, *L / P*) is the component's (`FORMATS`): the file's contract, the same in both languages.
   */
  hints: {
    'Kode agen': 'digits from the company',
    'Kode upline': 'empty only for the top rung',
    'No. WhatsApp': 'for the invitation and reminders',
    Email: 'to sign in; without one, invited on WhatsApp',
  } as Record<string, string>,
  columnsNote: '* required · an agent code already here = that person’s details are updated · rows in any order',
  structureTitle: 'Current structure',
  structureNote: 'from All members · tap to open',
  structureFresh: ({ n }: { n: number }) => `${n} new ${n === 1 ? 'person' : 'people'} marked`,
  seeOrgTree: 'See the whole structure in Org tree ›',
  structureLoading: 'Loading the structure…',
  historyTitle: 'Upload history',
  historyLine: ({ date, by }: { date: string; by: string | null }) => (by ? `${date} · by ${by}` : date),
  newN: ({ n }: { n: number }) => `${n} new`,
  updatedN: ({ n }: { n: number }) => `${n} updated`,
  historyEmpty: 'No file uploaded yet.',
  noFileName: 'Corrected rows',
  /* The dialog after *Unggah*. */
  dialogTitle: 'Upload members',
  rowsN: ({ n }: { n: number }) => `${n} ${n === 1 ? 'row' : 'rows'}`,
  change: 'Change',
  tiles: { created: 'new people', updated: 'updated', check: 'to check', saved: 'all saved' },
  pill: { new: 'New', updated: 'Updated', check: 'To check', skipped: 'Skipped' },
  upline: ({ code }: { code: string }) => `upline ${code}`,
  rowOpen: ({ name }: { name: string }) => `See and fix ${name}’s data`,
  note: 'New people get the invitation by email or WhatsApp. Data that cannot be read is left empty; the person is still added.',
  recheck: 'Check again',
  saveAll: ({ n }: { n: number }) => `Save all (${n} ${n === 1 ? 'person' : 'people'})`,
  saving: 'Saving…',
  cancel: 'Cancel',
  unreadable: 'This file cannot be read:',
  reading: 'Reading the file…',
  done: ({ created, updated }: { created: number; updated: number }) =>
    `${created} new, ${updated} updated · saved`,
  whatsAppTitle: 'Invitations to send on WhatsApp',
  sendOnWhatsApp: ({ name }: { name: string }) => `Send ${name} the invitation on WhatsApp`,
};

const id: MessagesOf<typeof en> = {
  notInOffice: `Anda belum tergabung di ${kept('KPM')} mana pun.`,
  eyebrow: 'Tambah banyak anggota sekaligus',
  title: 'Isi template, lalu unggah',
  line: 'Satu baris per orang · wajib: kode agen, nama, peran',
  seeColumns: 'Lihat kolom',
  upload: 'Unggah file',
  template: 'Unduh template',
  columnsTitle: 'Kolom di template',
  closeColumns: 'Tutup kolom',
  hints: {
    'Kode agen': 'angka dari perusahaan',
    'Kode upline': 'kosong hanya untuk jenjang teratas',
    'No. WhatsApp': 'untuk undangan & pengingat',
    Email: 'untuk masuk; tanpa email diundang lewat WhatsApp',
  },
  columnsNote: '* wajib · kode agen yang sudah ada = data orang itu diperbarui · urutan baris bebas',
  structureTitle: 'Struktur saat ini',
  structureNote: `dari ${kept('All members')} · ketuk untuk membuka`,
  structureFresh: ({ n }) => `${n} orang baru ditandai`,
  seeOrgTree: `Lihat seluruh struktur di ${kept('Org tree')} ›`,
  structureLoading: 'Memuat struktur…',
  historyTitle: 'Riwayat unggah',
  historyLine: ({ date, by }) => (by ? `${date} · oleh ${by}` : date),
  newN: ({ n }) => `${n} baru`,
  updatedN: ({ n }) => `${n} diperbarui`,
  historyEmpty: 'Belum ada file yang diunggah.',
  noFileName: 'Baris yang diperbaiki',
  dialogTitle: 'Unggah anggota',
  rowsN: ({ n }) => `${n} baris`,
  change: 'Ganti',
  tiles: { created: 'orang baru', updated: 'diperbarui', check: 'perlu dicek', saved: 'semua disimpan' },
  pill: { new: 'Baru', updated: 'Diperbarui', check: 'Perlu dicek', skipped: 'Dilewati' },
  upline: ({ code }) => `upline ${code}`,
  rowOpen: ({ name }) => `Lihat dan perbaiki data ${name}`,
  note: 'Orang baru menerima undangan lewat email atau WhatsApp. Data yang tidak terbaca dikosongkan, orangnya tetap masuk.',
  recheck: 'Periksa lagi',
  saveAll: ({ n }) => `Simpan semua (${n} orang)`,
  saving: 'Menyimpan…',
  cancel: 'Batal',
  unreadable: 'File ini tidak dapat dibaca:',
  reading: 'Membaca file…',
  done: ({ created, updated }) => `${created} baru, ${updated} diperbarui · tersimpan`,
  whatsAppTitle: 'Undangan untuk dikirim lewat WhatsApp',
  sendOnWhatsApp: ({ name }) => `Kirim undangan ke ${name} lewat WhatsApp`,
};

export const rosterImportMessages = defineMessages({ en, id });
