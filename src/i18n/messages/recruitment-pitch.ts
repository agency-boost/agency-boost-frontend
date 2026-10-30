import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The recruitment pitch's documents** (P17-T4 to T6, ADR-0177; P18.98-T4): the banner and the six cards, drawn the
 * same on the office's *Settings › Recruitment pitch* and the agents' *Recruitment › Pitch Materials*
 * (`components/recruitment/`), and the PDF upload the pitch and the products page share (`pdf-upload.tsx`). The
 * prototype's words verbatim in English (`Recruitment_Section.html:681-818`, D-copy), but where a dated line said
 * otherwise; none of OD-39's six words in either language (`components/recruitment/copy.spec.ts`).
 *
 * **Content, shown as typed** (ADR-0179 §5): a slot's title, its checklist's labels and a file's name — the server's
 * and the office's. **Kept English** (§A): the settings page's title (§A.1), *Recruitment* and *Pitch* (§A.6). **A
 * message never writes a figure** (P18.98-T3): a file's size and day are written in the reader's figures and handed in.
 * *Missing*, *Complete* (a document), *Replace*, *document*, *candidate* and *tick* are *Belum ada*, *Lengkap*,
 * *Ganti*, *dokumen*, *kandidat* and *centang* (for approval, the glossary for approval's §B.10).
 *
 * @moved components/recruitment/
 * @moved lib/recruitment-pitch.ts
 * @moved app/(tenant)/kpm/settings/recruitment-pitch/
 */
const en = {
  /** A card's state (`.status-badge`, `:681-696`), a word as well as a tint. */
  missing: 'Missing',
  complete: 'Complete',
  uploaded: 'Uploaded',
  /** A file whose checklist is not finished (UI-029; ADR-0177 §1). */
  needsConfirmation: 'Uploaded · needs confirmation',
  /** The tag on an optional document (UI-042; ADR-0177 §2). */
  optional: 'Optional',
  /** A card with no file (the client's words, grey text row 12). */
  noFile: 'Not uploaded yet',
  /** The file's line: its size and its day, written in the reader's figures. */
  updated: ({ size, day }: { size: string; day: string }) => `${size} · updated ${day}`,
  /** The file's icon, drawn as words. */
  fileIcon: 'PDF',
  /** The checklist's legend. */
  checklist: 'Confirm this PDF actually includes',
  viewPdf: 'View PDF',
  replace: 'Replace',
  uploadPdf: 'Upload PDF',

  /** The banner (`:364-370`, `:797-820`); its counts are the server's. */
  completeTitle: 'Recruitment Pitch is complete',
  completeLine: ({ total }: { total: number }) =>
    `All ${total} documents are uploaded and fully confirmed — ready to show or send to a candidate.`,
  incompleteTitle: 'Recruitment Pitch is incomplete',
  /** The incomplete banner's line, in the client's words (grey text row 11): *2 missing, 1 needs checking.* */
  missingCount: ({ n }: { n: number }) => `${n} missing`,
  needsChecking: ({ n }: { n: number }) => `${n} needs checking`,
  incompleteLine: ({ parts }: { parts: readonly string[] }) => `${parts.join(', ')}.`,

  /** The module's own (D-copy): the Fills, the refusals, the accessible names. */
  loading: 'Loading the pitch documents…',
  readFailed: 'Could not read the pitch documents.',
  tryAgain: 'Try again',
  /** The ring's name: the figure alone says nothing to somebody who cannot see the ring. */
  ringName: ({ done, total }: { done: number; total: number }) => `${done} of ${total} documents complete`,
  viewName: ({ title }: { title: string }) => `View PDF, ${title} — opens in a new tab`,
  uploadName: ({ title }: { title: string }) => `Upload PDF, ${title}`,
  replaceName: ({ title }: { title: string }) => `Replace, ${title}`,
  opening: 'Opening…',
  linkFailed: 'Could not open this PDF.',
  tickFailed: 'Could not save that tick.',
  /** A tick refused with `409`: the file it was made against has been replaced since. */
  replacedSince: 'This PDF was replaced while the page was open, so its ticks were cleared. Check the new file, then '
    + 'tick again.',
  /** Said to assistive technology alone when a file is attached. */
  attached: ({ name, cleared }: { name: string; cleared: boolean }) =>
    `“${name}” attached.${cleared ? ' Its ticks are cleared.' : ''}`,

  /** The upload's own (`pdf-upload.tsx`): refused before anything is sent, or the send failing. */
  /**
   * **Pitch Materials on a phone** (UI V1, UI-107; `attack-plan-mobile` 6): the groups, a row's *View*, the ring's name
   * — what it counts is the required documents with a file — and the line when none is missing. No state pills there.
   */
  requiredGroup: 'Required',
  optionalGroup: 'Optional',
  view: 'View',
  uploadedRing: ({ done, total }: { done: number; total: number }) => `${done} of ${total} required documents uploaded`,
  allUploaded: 'Every required document is uploaded.',

  uploading: ({ name }: { name: string }) => `Uploading “${name}”…`,
  tooLarge: ({ name, size, max }: { name: string; size: string; max: string }) =>
    `“${name}” is ${size}. A PDF can be ${max} MB at most.`,
  notPdf: ({ name }: { name: string }) => `“${name}” is not a PDF. Only a PDF can be uploaded here.`,
  sendFailed: ({ name }: { name: string }) => `“${name}” did not finish uploading. Check your connection and try again.`,
};

const id: MessagesOf<typeof en> = {
  missing: 'Belum ada',
  complete: 'Lengkap',
  uploaded: 'Terunggah',
  needsConfirmation: 'Terunggah · perlu konfirmasi',
  optional: 'Opsional',
  noFile: 'Belum diunggah',
  updated: ({ size, day }) => `${size} · diperbarui ${day}`,
  fileIcon: 'PDF',
  checklist: 'Pastikan PDF ini benar-benar memuat',
  viewPdf: 'Lihat PDF',
  replace: 'Ganti',
  uploadPdf: 'Unggah PDF',

  completeTitle: `${kept('Recruitment')} ${kept('Pitch')} sudah lengkap`,
  completeLine: ({ total }) =>
    `Semua ${total} dokumen sudah diunggah dan dikonfirmasi penuh — siap ditunjukkan atau dikirim ke kandidat.`,
  incompleteTitle: `${kept('Recruitment')} ${kept('Pitch')} belum lengkap`,
  missingCount: ({ n }) => `${n} belum ada`,
  needsChecking: ({ n }) => `${n} perlu dicek`,
  incompleteLine: ({ parts }) => `${parts.join(', ')}.`,

  loading: `Memuat dokumen ${kept('pitch')}…`,
  readFailed: `Tidak dapat membaca dokumen ${kept('pitch')}.`,
  tryAgain: 'Coba lagi',
  ringName: ({ done, total }) => `${done} dari ${total} dokumen lengkap`,
  viewName: ({ title }) => `Lihat PDF, ${title} — terbuka di tab baru`,
  uploadName: ({ title }) => `Unggah PDF, ${title}`,
  replaceName: ({ title }) => `Ganti, ${title}`,
  opening: 'Membuka…',
  linkFailed: 'Tidak dapat membuka PDF ini.',
  tickFailed: 'Tidak dapat menyimpan centang itu.',
  replacedSince: 'PDF ini diganti saat halaman sedang terbuka, jadi centangnya dihapus. Periksa file baru, lalu centang '
    + 'lagi.',
  attached: ({ name, cleared }) => `“${name}” terlampir.${cleared ? ' Centangnya dihapus.' : ''}`,

  requiredGroup: 'Wajib',
  optionalGroup: 'Opsional',
  view: 'Lihat',
  uploadedRing: ({ done, total }) => `${done} dari ${total} dokumen wajib sudah diunggah`,
  allUploaded: 'Semua dokumen wajib sudah diunggah.',

  uploading: ({ name }) => `Mengunggah “${name}”…`,
  tooLarge: ({ name, size, max }) => `“${name}” berukuran ${size}. Ukuran PDF maksimal ${max} MB.`,
  notPdf: ({ name }) => `“${name}” bukan PDF. Hanya PDF yang dapat diunggah di sini.`,
  sendFailed: ({ name }) => `“${name}” tidak selesai diunggah. Periksa koneksi Anda, lalu coba lagi.`,
};

export const recruitmentPitchMessages = defineMessages({ en, id });
