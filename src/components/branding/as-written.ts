import { messagesIn, type MessageArea, type MessagesOf, type MessageTree } from '@/i18n/catalogue';
import { useLanguage } from '@/i18n/language-provider';

/**
 * **An area's messages as written, the KPM's *Nama sistem* left out** (P19.21-T4; ADR-0274): `useMessages` writes the
 * word *AgencyBoost* as the KPM's name everywhere — except on the page that sets the name, where *AgencyBoost* is the
 * default being replaced (*"Menggantikan tulisan "AgencyBoost"…"*) and what *Kembalikan ke default* brings back.
 */
export function useMessagesAsWritten<E extends MessageTree>(area: MessageArea<E>): MessagesOf<E> {
  return messagesIn(area, useLanguage());
}
