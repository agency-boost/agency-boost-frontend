import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **What a field that saves itself says** (`components/ui/inline-save-status.tsx`; OD-200, ADR-0167 §5): the client's
 * own *Saving… → Saved ✓* and *Couldn't save — retry*, in the approved glossary's §B.2. Moved with P18.98-T2, whose
 * *Language* on *Your account* saves itself this way and changes the screen's language as it does, so its status reads
 * in the language just chosen.
 *
 * @moved components/ui/inline-save-status.tsx
 */
const en = {
  saving: 'Saving…',
  saved: 'Saved ✓',
  failed: "Couldn't save — retry",
  /** A failure with nothing to send again: what the field held is no longer on the screen. */
  failedFinal: "Couldn't save",
  /** The retry's name, with the field it retries: *Couldn't save — retry: Remarks, row 3*. */
  retryField: ({ field }: { field: string }) => `Couldn't save — retry: ${field}`,
};

const id: MessagesOf<typeof en> = {
  saving: 'Menyimpan…',
  saved: 'Tersimpan ✓',
  failed: 'Gagal menyimpan — coba lagi',
  failedFinal: 'Gagal menyimpan',
  retryField: ({ field }) => `Gagal menyimpan — coba lagi: ${field}`,
};

export const inlineSaveMessages = defineMessages({ en, id });
