import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **An HTML page opened inside the app** (P19.6-T2, ADR-0217 §4): a lesson, a pitch page or a product page, drawn in the
 * sandboxed frame of a full-height window titled with the item's own name (its ✕ is the sheet's own). The frame's own
 * words are these few: the line it shows while the link is fetched, the one it shows when it cannot draw the page, and
 * an open control's name that says it opens here.
 *
 * @moved components/sandboxed-document.tsx
 */
const en = {
  /** While the signed link is asked for. */
  opening: 'Opening…',
  /** An address the frame refuses (not the storage host's), or a link that could not be had. */
  notShown: 'This page can’t be shown. Close it and try again.',
  /** A file's open control, named for a screen reader: its words, the item, and that it opens here (no new tab). */
  openHereName: ({ button, label }: { button: string; label: string }) => `${button}: ${label} (opens in this window)`,
};

const id: MessagesOf<typeof en> = {
  opening: 'Membuka…',
  notShown: 'Halaman ini tidak dapat ditampilkan. Tutup, lalu coba lagi.',
  openHereName: ({ button, label }) => `${button}: ${label} (terbuka di jendela ini)`,
};

export const sandboxedDocumentMessages = defineMessages({ en, id });
