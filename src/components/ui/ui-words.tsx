'use client';

import { messagesIn } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { useLanguage } from '@/i18n/language-provider';
import { uiMessages } from '@/i18n/messages/ui';

/**
 * **The words of the two primitives that read no hook** (P18.98-T4, the shared pieces): `field.tsx` is reached from the
 * server's graph as well as the client's, so what it writes in the reader's language is drawn by these small client
 * components, as `ConsoleCode` draws its console line.
 */

/** `CodeField`'s label, *Code* (§B.4). */
export function CodeWord() {
  return <>{messagesIn(uiMessages, useLanguage()).code}</>;
}

/**
 * **A failure's sentence in the reader's language** (P18.98-T4, the shared pieces), drawn by `ErrorBanner`.
 *
 * - **A server's sentence arrives in the reader's language already** (P18.98-T5: the API writes for `Accept-Language`),
 *   and is shown as it came.
 * - **What the browser composed itself** — `toDisplayError`'s *the request never arrived* and *the screen broke*, and
 *   `api()`'s answer with no body — is composed in English wherever it is thrown, outside React and with no language
 *   to hand. It is recognised by its English here and written in the reader's language, so none of the screens that
 *   call `toDisplayError` changes. **The three outcomes stay three.**
 * - **The app misconfigured** (`CONFIG`) keeps its sentence for whoever deploys it — a variable and how to set it —
 *   after a sentence of the reader's language.
 */
export function ErrorWords({ code, message }: { code: string; message: string }) {
  return <>{errorSentence(code, message, useLanguage())}</>;
}

/** The sentence `ErrorWords` writes, for `language`. */
export function errorSentence(code: string, message: string, language: Language): string {
  const english = uiMessages.en.errors;
  const words = messagesIn(uiMessages, language).errors;
  if (code === 'CONFIG') return words.config({ detail: message });
  if (message === english.network) return words.network;
  if (message === english.unexpected) return words.unexpected;
  if (message === english.noAnswer) return words.noAnswer;
  return message;
}
