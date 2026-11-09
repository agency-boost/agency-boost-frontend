import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **`/admin`'s shared rows, sheets and pills** (P19.2-T2; UI-126, UI-133, UI-134, UI-135 — the full UI report's
 * Superadmin review of 2 November and `admin-mobile` / `admin-desktop-2026-11-02`): the words the console's ⋯ menu, its
 * *+* button, its choice pills and its add sheets say themselves. Words a page owns — a sheet's title, a field's label, a
 * row's action — are the page's and come in as props.
 *
 * The mockups' own Indonesian (*Batal*, *Semua*); the rest proposed in §B.10 of the glossary for approval (O-8).
 *
 * @moved components/ui/rows-and-sheets.tsx
 */
const en = {
  /** ⋯ on a row: *Actions for Manulife*. */
  actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
  /** A choice pill's sheet: the filter's name, and what it reads while nothing is chosen. */
  choose: ({ what }: { what: string }) => `Choose ${what.toLowerCase()}`,
  all: 'All',
  cancel: 'Cancel',
  /** ⓘ beside a title or a field: what a screen reader says before the explanation. */
  about: ({ what }: { what: string }) => `About ${what}`,
};

const id: MessagesOf<typeof en> = {
  actionsFor: ({ name }) => `Tindakan untuk ${name}`,
  choose: ({ what }) => `Pilih ${what.toLowerCase()}`,
  all: 'Semua',
  cancel: 'Batal',
  about: ({ what }) => `Tentang ${what}`,
};

export const adminLayoutMessages = defineMessages({ en, id });
