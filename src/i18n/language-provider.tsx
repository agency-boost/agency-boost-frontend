'use client';

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { setRequestLanguage } from '@/lib/api-client';
import type { Me } from '@/lib/session';
import { messagesIn, type MessageArea, type MessagesOf, type MessageTree } from './catalogue';
import {
  figureLanguage, isLanguage, LANGUAGE_LIVE, LANGUAGE_PENDING, SOURCE_LANGUAGE, unchosenLanguage, type Language,
} from './language';
import { readLanguageCookie, writeLanguageCookie } from './language-cookie';

/**
 * **The reader's language** (ADR-0179 §2, §8; P18.98-T1 AC-3, AC-4, AC-5).
 *
 * Outside a provider it is **English**, the catalogue's source: every spec that renders a screen without asking for
 * a language reads it as it always has (AC-5). `test/harness.tsx`'s `renderInIndonesian` and `InLanguage` ask for
 * Indonesian. The app's one provider is the root layout's.
 */
export const LanguageContext = createContext<Language>(SOURCE_LANGUAGE);

/**
 * The language the screen's **words** are written in — its messages (`useMessages`), `<html lang>` and the API's
 * `Accept-Language`. **Never a figure's**: a date, a number or a sum is written in `useFigureLanguage()`'s.
 */
export function useLanguage(): Language {
  return useContext(LanguageContext);
}

/**
 * **The language a figure is written in, where a provider says it** — `LanguageProvider`, and the harness's
 * `InLanguage`. `null`, outside both, writes a figure in the words' language (`useFigureLanguage`).
 */
export const FigureLanguageContext = createContext<Language | null>(null);

/**
 * **The language a figure is written in** — what a screen hands every formatter (`lib/format.ts`):
 * `formatCalendarDay(day, language)`, `formatRupiahCompact(minor, {}, language)`, `moneyPrefix(language)` (P18.98-T3;
 * ADR-0174, ADR-0179 §6). **The reader's chosen language, and with no choice `DEFAULT_LANGUAGE`, Bahasa Indonesia, in
 * every state of `LANGUAGE_LIVE`** (`figureLanguage`). A reader with no choice reads English words until the switch is
 * live (`useLanguage`), so until then they read English words and Indonesian figures — every screen as it was before
 * the phase; a reader who chose a language, by the cookie or on their account, reads both in it; once live the two
 * always agree.
 *
 * **Outside a provider it is the words' language**: English in every spec that does not ask, Indonesian under
 * `InLanguage`. A spec's language counts as a language the reader chose, so a spec reads its figures as it reads its
 * words (ADR-0179 §9), and every suite written since P18.98-T3 keeps its assertions.
 */
export function useFigureLanguage(): Language {
  const words = useLanguage();
  return useContext(FigureLanguageContext) ?? words;
}

/**
 * **A module's words in the reader's language** — how a screen asks for a message (`components-and-patterns.md`,
 * *Words*): `const t = useMessages(shellMessages)`, then `t.signOut`, or `t.withUnread({ name, unread })`.
 */
export function useMessages<E extends MessageTree>(area: MessageArea<E>): MessagesOf<E> {
  return messagesIn(area, useLanguage());
}

/**
 * **Choosing the language, and following an account's** (ADR-0179 §2; P18.98-T2 AC-3, AC-5).
 *
 * - **`live`** — whether the product offers the choice: the switch and *Language* on *Your account* are drawn only
 *   while it is true (`LANGUAGE_LIVE`).
 * - **`choose(language)`** — the reader chose, on the switch or on *Your account*: the screen is written in it at once,
 *   with no reload and no remount, so an open form keeps what was typed; the cookie keeps it for the browser, and the
 *   API is told it from the next request. Saving it on the account is the caller's (`useChooseLanguage`), which knows
 *   who is signed in.
 * - **`follow(me)`** — the session, each time it reads who is signed in: **at sign-in an account's saved language wins
 *   and rewrites the cookie; an account with none keeps the language the browser had, and nothing is written.** Once
 *   per session, so a choice made since is not undone by the next read of the same account. **Never in a support
 *   session**: the person's own choice is neither read nor written there, and the support person's browser keeps its
 *   language (ADR-0162 §4).
 *
 * Outside a provider nothing is offered and nothing followed — what every spec renders unless it asks, as with English
 * (AC-5). The harness asks with `LanguageProvider live`.
 */
export interface LanguageChoice {
  readonly live: boolean;
  readonly choose: (language: Language) => void;
  readonly follow: (me: Me | null) => void;
}

const NOTHING_TO_CHOOSE: LanguageChoice = { live: false, choose: () => undefined, follow: () => undefined };

export const LanguageChoiceContext = createContext<LanguageChoice>(NOTHING_TO_CHOOSE);

export function useLanguageChoice(): LanguageChoice {
  return useContext(LanguageChoiceContext);
}

/** Before the browser paints, as the shells' own size reads are (`app-shell.tsx`). The server runs neither. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Which session `follow` last followed: the person, and whether it is a support session's view of them. */
function sessionKey(me: Me): string {
  return `${me.user.id}${me.isImpersonating ? ':support' : ''}`;
}

/**
 * **The language, known before any word paints** (AC-3), and `<html lang>` written from it (AC-4).
 *
 * - **The prerender and the first client render agree**: both write the language the static pages are built in
 *   (`LANGUAGE_UNCHOSEN`: `unchosenLanguage(live)`), so hydration matches the HTML it adopts.
 * - **Before the first paint**, the language the pre-paint script read off the cookie and left on `<html lang>`
 *   (`pre-paint.ts`) is taken up: React re-renders in it before the browser paints, and a page the script held back
 *   for it (`LANGUAGE_PENDING`) is shown.
 * - **Every change after that** is written to `<html lang>`, so a screen reader pronounces the screen in its language
 *   (WCAG 3.1.1; parity F-258), and handed to the API client, which tells the API (`Accept-Language`, P18.98-T2 AC-6).
 * - **The account's language**, from `GET /auth/me`, arrives through `follow` (above), in the same render as the
 *   session itself, so the first frame of a signed-in screen is already in it.
 * - **What the reader chose** is held, not only the language in force (P18.98-T3): the words are the choice, or
 *   `unchosenLanguage(live)` with none, and **the figures are the choice, or `DEFAULT_LANGUAGE` with none**
 *   (`figureLanguage`, `useFigureLanguage`). A choice is the browser's — the cookie, read on the first commit as the
 *   pre-paint script read it — or one made since (`choose`), or the account's (`follow`). The prerender knows none, so
 *   its first frame writes figures in `DEFAULT_LANGUAGE`, and the first client render agrees with it; no prerendered
 *   page draws a figure (a signed-in route's is the session's wait). Every screen mounts behind the session, after
 *   this first commit, so a field that keeps the text of its first frame (`DecimalInput`, a money field's draft) starts
 *   in the figures' language the reader reads.
 *
 * `live` is `LANGUAGE_LIVE`; a spec passes `live` to exercise the switch as it will be once released.
 */
export function LanguageProvider({ live = LANGUAGE_LIVE, children }: { live?: boolean; children: ReactNode }) {
  const unchosen = unchosenLanguage(live);
  /** The language the reader chose — by the cookie, on the switch, on their account — or `null` for none. */
  const [chosen, setChosen] = useState<Language | null>(null);
  const language = chosen ?? unchosen;
  /** What the pre-paint script read, once, on the first commit. */
  const prePaint = useRef<Language | null>(null);
  /** The session `follow` last followed (`sessionKey`), `null` while nobody is signed in. */
  const followed = useRef<string | null>(null);

  useBeforePaint(() => {
    const root = document.documentElement;
    if (prePaint.current === null) {
      const read = isLanguage(root.lang) ? root.lang : unchosen;
      prePaint.current = read;
      // The browser's choice. The script moves `<html lang>` only to the cookie's language, and leaves the page alone
      // where the cookie holds the page's own — which the cookie then says. No cookie, no choice.
      if (read !== unchosen || readLanguageCookie() === read) setChosen(read);
      // Rendered again in it before anything is written: `<html lang>` already says it.
      if (read !== language) {
        setRequestLanguage(read);
        return;
      }
    }
    root.lang = language;
    root.removeAttribute(LANGUAGE_PENDING);
    setRequestLanguage(language);
  }, [language, unchosen]);

  /** Into force at once: the API's next request, the cookie, and the screen, in that order. */
  const apply = useCallback((next: Language) => {
    setRequestLanguage(next);
    writeLanguageCookie(next);
    setChosen(next);
  }, []);

  const follow = useCallback((me: Me | null) => {
    if (!me) {
      followed.current = null;
      return;
    }
    const key = sessionKey(me);
    if (followed.current === key) return;
    followed.current = key;
    // A support session reads nothing of the person's choice, and an account with none keeps the browser's language.
    if (me.isImpersonating || me.user.localeChosen !== true || !isLanguage(me.user.locale)) return;
    apply(me.user.locale);
  }, [apply]);

  const choice = useMemo<LanguageChoice>(() => ({ live, choose: apply, follow }), [live, apply, follow]);

  return (
    <LanguageChoiceContext.Provider value={choice}>
      <LanguageContext.Provider value={language}>
        <FigureLanguageContext.Provider value={figureLanguage(chosen)}>{children}</FigureLanguageContext.Provider>
      </LanguageContext.Provider>
    </LanguageChoiceContext.Provider>
  );
}
