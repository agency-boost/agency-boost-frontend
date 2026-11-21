import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The recruitment pitch's documents** (P17-T4 to T6, ADR-0177; P18.10-T4): the banner and the six cards, drawn the
 * same on the office's *Settings › Recruitment pitch* and the agents' *Recruitment › Pitch Materials*
 * (`components/recruitment/`), and the PDF upload the pitch and the products page share (`pdf-upload.tsx`). The
 * prototype's words verbatim in English (`Recruitment_Section.html:681-818`, D-copy), but where a dated line said
 * otherwise; none of OD-39's six words in either language (`components/recruitment/copy.spec.ts`).
 *
 * **Content, shown as typed** (ADR-0179 §5): a slot's title, its checklist's labels and a file's name — the server's
 * and the office's. **Kept English** (§A): the settings page's title (§A.1), *Recruitment* and *Pitch* (§A.6). **A
 * message never writes a figure** (P18.10-T3): a file's size and day are written in the reader's figures and handed in.
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
  /** An HTML page's icon (P19.6-T2, ADR-0217): what it is, as the PDF's says. */
  fileIconPage: 'HTML',
  /** The checklist's legend. */
  checklist: 'Confirm this PDF actually includes',
  viewPdf: 'View PDF',
  /** An HTML page's *View PDF*: it opens in the window, never a tab (ADR-0217 §4). */
  viewPage: 'View page',
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
  viewPageName: ({ title }: { title: string }) => `View page, ${title} — opens in this window`,
  // P19.21-T3 AC-6: any format, so *Upload file* — the button's own words, which its name begins with (WCAG 2.5.3).
  uploadName: ({ title }: { title: string }) => `Upload file, ${title}`,
  replaceName: ({ title }: { title: string }) => `Replace, ${title}`,
  opening: 'Opening…',
  linkFailed: 'Could not open this PDF.',
  pageLinkFailed: 'Could not open this page.',
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
  notPdf: ({ name }: { name: string }) =>
    `“${name}” is not a PDF or an HTML page. Only a PDF or an HTML page can be uploaded here.`,
  sendFailed: ({ name }: { name: string }) => `“${name}” did not finish uploading. Check your connection and try again.`,

  /**
   * **Pengaturan › Recruitment pitch as one list** (P19.21-T3 AC-6, ADR-0274; `data-upload-pengaturan-*` frame 22): the
   * six materials agents see, no required/optional split, *"2/6 materi siap"*, each with its state and one button, and
   * **any format or a link**. The agents' side opens a link, a download or a file by what it is.
   */
  readyLine: 'materials ready · used by agents in Recruitment › Pitch Materials',
  readyName: ({ ready, total }: { ready: number; total: number }) => `${ready} of ${total} materials ready`,
  ready: 'Ready',
  needsCheck: 'Needs checking',
  uploadFile: 'Upload file',
  replaceFile: 'Replace file',
  useLink: 'Use a link',
  changeLink: 'Change link',
  anyFormat: 'Any format: PDF, PowerPoint, Word, image, video, or a link',
  fileLine: ({ name, day }: { name: string; day: string }) => `${name} · ${day}`,
  linkLine: ({ day }: { day: string }) => `Link · ${day}`,
  actionsFor: ({ title }: { title: string }) => `More for ${title}`,
  viewMaterialName: ({ title }: { title: string }) => `View ${title}: its file, its checklist and its link`,
  linkTitle: ({ title }: { title: string }) => `A link for ${title}`,
  linkLabel: 'Address (https://)',
  linkHint: 'A video too large to upload, or a shared folder. Agents open it in a new tab.',
  linkSaved: ({ title }: { title: string }) => `The link for ${title} is saved.`,
  notPitchFormat: ({ name }: { name: string }) =>
    `“${name}” is not a pitch format. Upload a PDF, PowerPoint, Word file, image or video — or give a link.`,
  tooLargeAny: ({ name, size, max }: { name: string; size: string; max: string }) =>
    `“${name}” is ${size}. A file can be ${max} MB at most — give a longer video as a link.`,
  openLink: 'Open link',
  openLinkName: ({ title }: { title: string }) => `Open link, ${title} — opens in a new tab`,
  download: 'Download',
  downloadName: ({ title }: { title: string }) => `Download, ${title}`,
  viewFile: 'View file',
  viewFileName: ({ title }: { title: string }) => `View file, ${title} — opens in a new tab`,
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
  fileIconPage: 'HTML',
  checklist: 'Pastikan PDF ini benar-benar memuat',
  viewPdf: 'Lihat PDF',
  viewPage: 'Lihat halaman',
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
  viewPageName: ({ title }) => `Lihat halaman, ${title} — terbuka di jendela ini`,
  uploadName: ({ title }) => `Unggah file, ${title}`,
  replaceName: ({ title }) => `Ganti, ${title}`,
  opening: 'Membuka…',
  linkFailed: 'Tidak dapat membuka PDF ini.',
  pageLinkFailed: 'Tidak dapat membuka halaman ini.',
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
  notPdf: ({ name }) => `“${name}” bukan PDF atau halaman HTML. Hanya PDF atau halaman HTML yang dapat diunggah di sini.`,
  sendFailed: ({ name }) => `“${name}” tidak selesai diunggah. Periksa koneksi Anda, lalu coba lagi.`,

  readyLine: `materi siap · dipakai agent di ${kept('Recruitment')} › ${kept('Pitch Materials')}`,
  readyName: ({ ready, total }) => `${ready} dari ${total} materi siap`,
  ready: 'Siap',
  needsCheck: 'Perlu dicek',
  uploadFile: 'Unggah file',
  replaceFile: 'Ganti file',
  useLink: 'Pakai link',
  changeLink: 'Ganti link',
  anyFormat: 'Format apa saja: PDF, PowerPoint, Word, gambar, video, atau link',
  fileLine: ({ name, day }) => `${name} · ${day}`,
  linkLine: ({ day }) => `Link · ${day}`,
  actionsFor: ({ title }) => `Lainnya untuk ${title}`,
  viewMaterialName: ({ title }) => `Lihat ${title}: file, daftar cek, dan link-nya`,
  linkTitle: ({ title }) => `Link untuk ${title}`,
  linkLabel: 'Alamat (https://)',
  linkHint: 'Video yang terlalu besar untuk diunggah, atau folder bersama. Agent membukanya di tab baru.',
  linkSaved: ({ title }) => `Link untuk ${title} tersimpan.`,
  notPitchFormat: ({ name }) =>
    `“${name}” bukan format materi pitch. Unggah PDF, PowerPoint, Word, gambar, atau video — atau berikan link.`,
  tooLargeAny: ({ name, size, max }) =>
    `“${name}” berukuran ${size}. Ukuran file maksimal ${max} MB — berikan video yang lebih besar sebagai link.`,
  openLink: 'Buka link',
  openLinkName: ({ title }) => `Buka link, ${title} — terbuka di tab baru`,
  download: 'Unduh',
  downloadName: ({ title }) => `Unduh, ${title}`,
  viewFile: 'Lihat file',
  viewFileName: ({ title }) => `Lihat file, ${title} — terbuka di tab baru`,
};

export const recruitmentPitchMessages = defineMessages({ en, id });
