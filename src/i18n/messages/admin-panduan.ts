import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The Super Admin's guide page, `/admin/panduan`** (P19.6-T5 AC-4; ADR-0219 §4): its title, which also names the
 * frame, the *PDF* control and its states. The guide inside the frame is the owner's own file, in Bahasa whatever the
 * language (acceptance 5): none of its words are here.
 *
 * @moved app/(admin)/admin/panduan/page.tsx
 */
const en = {
  title: 'Super Admin guide',
  /** The frame's name for a screen reader: the guide it holds. */
  frameTitle: 'Super Admin guide',
  /** The control's words, and its name, which keeps them (WCAG 2.5.3). */
  pdf: 'PDF',
  pdfName: 'Save the guide as a PDF',
  savingPdf: 'Saving…',
  tryAgain: 'Try again',
  /** What the wait says to a screen reader while the guide is read. */
  loading: 'Opening the guide…',
};

const id: MessagesOf<typeof en> = {
  title: 'Panduan Super Admin',
  frameTitle: 'Panduan Super Admin',
  pdf: 'PDF',
  pdfName: 'Simpan panduan sebagai PDF',
  savingPdf: 'Menyimpan…',
  tryAgain: 'Coba lagi',
  loading: 'Membuka panduan…',
};

export const adminPanduanMessages = defineMessages({ en, id });
