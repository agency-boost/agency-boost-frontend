import type { ReactNode } from 'react';
import type { Kept, KeptTermOf } from './kept';
import type { Language } from './language';

/**
 * **The catalogue: every word the app writes, per module, in both languages** (ADR-0179 §4; P18.98-T1 AC-1). Our own,
 * with no i18n library: no runtime parser, and a message format TypeScript checks key by key.
 *
 * A module's words are one **area**, one file under `src/i18n/messages/`: its English, `en`, is the source of its
 * keys; its Indonesian, `id`, is typed against them (`MessagesOf<typeof en>`), so a key missing, extra or misspelt in
 * the Indonesian fails `tsc`. A screen reads its area with `useMessages(area)`, a function outside React with
 * `messagesIn(area, language)`. Nothing registers an area: a screen imports it.
 */

/**
 * **One message**: the words; a kept-English term (`kept('…')`); or, for words with values in them, **a function of
 * named values** — `({ n, name }) => …` — so each language orders its words and chooses its own plural, with no
 * parser. A function may return elements where a value must be one (a name in bold).
 */
export type Message = string | ((values: never) => string | ReactNode);

/** A module's messages: messages, and groups of them under a name. */
export interface MessageTree {
  readonly [key: string]: Message | MessageTree;
}

/**
 * **What a module's Indonesian must be, given its English**: the same keys, each the same kind of message —
 *
 * - words for words;
 * - a function for a function, of **the same named values** and returning the same kind (a value renamed fails);
 * - **the very same kept term for a kept term**: a kept term reads the same in both languages (§A), so translating
 *   one fails;
 * - a group for a group, by the same rules.
 *
 * Written as an annotation, `const id: MessagesOf<typeof en> = { … }`, so that an extra key is refused as well.
 */
export type MessagesOf<E> = {
  readonly [K in keyof E]: [KeptTermOf<E[K]>] extends [never]
    ? E[K] extends (values: infer V) => infer R
      ? (values: V) => R
      : E[K] extends string
        ? string
        : MessagesOf<E[K]>
    : Kept<KeptTermOf<E[K]>>;
};

/** A module's words in both languages: what `defineMessages` makes, and what a screen hands `useMessages`. */
export interface MessageArea<E extends MessageTree> {
  readonly en: E;
  readonly id: MessagesOf<E>;
}

/**
 * **An area**: `export const shellMessages = defineMessages({ en, id })`, at the foot of the module's file. Both
 * languages are in the module's chunk. **Where that would take a route past the 200 kB budget** (P18.98-T1 AC-2), the
 * area's languages go into two files and only the reader's is loaded — behind the same `useMessages`, so no screen
 * changes. Not built: no module needs it yet, and the first that does builds it.
 */
export function defineMessages<E extends MessageTree>(area: MessageArea<E>): MessageArea<E> {
  return area;
}

/**
 * **An area's messages in a language**, for a function outside React that writes words: it takes the reader's
 * `language` as its last parameter, defaulting to the source (`SOURCE_LANGUAGE`), which its spec reads, and its
 * caller passes `useLanguage()` — **never `useFigureLanguage()`**, which differs from it for a reader with no choice
 * whenever the switch is not live, as it was not until 2026-10-29 (P18.98-T3). A figure inside a message is written by its caller, in the figures' language,
 * and passed in as a value.
 */
export function messagesIn<E extends MessageTree>(area: MessageArea<E>, language: Language): MessagesOf<E> {
  return area[language] as MessagesOf<E>;
}
