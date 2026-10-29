'use client';

import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { ApiRequestError } from '@/lib/api-client';
import type { MeetingView, MeetingWriter } from '@/lib/leader-meetings';

/**
 * **How a meeting is written** (`functional/leader-forum.md`, *Saving*; D-forum-model): one field per write,
 * each tracked so the head's *Save* can wait for it, each announced in the page's live region.
 *
 * - A write that lands says *Saved* (or what the tab asks it to: *Status updated*, *Reordered*).
 * - **`409 VERSION_CONFLICT`**: somebody else changed that same item since it was read. The meeting is read
 *   again, so every field shows what was saved, and one line says so.
 * - **Any other failure**: the line saying it failed. The tab keeps what was typed, so leaving the field
 *   again sends it again.
 *
 * The lines go to the page's toast, the one live region it has (`:2023`); a failure or a conflict also stays
 * under *Save* until a later write lands (L-110), because the toast goes after 2600 ms and the change it
 * names is still not saved. **That line is held by what it says** — a conflict or a failure — and written in the
 * screen's language each time it is drawn, so a reader who switches language reads it in the new one (P18.98-T4).
 */

/** What the line under *Save* says: a write was read again over somebody else's, or one failed. */
type Line = 'conflict' | 'failed';

type Outcome = { ok: true } | { ok: false; line: Line };

interface WriterContext {
  writer: MeetingWriter;
  /** *Save*: leave the field being edited, wait for every write in flight, then say how it went. */
  flush: () => Promise<void>;
  /** The last write's failure or conflict, until a later write lands. */
  line: string | null;
}

const Context = createContext<WriterContext | null>(null);

/** A field whose blur writes: what *Save* takes the focus out of before it waits. */
const isField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLInputElement
  || el instanceof HTMLTextAreaElement
  || el instanceof HTMLSelectElement
  || (el instanceof HTMLElement && el.isContentEditable);

export function MeetingWriterProvider({
  meeting,
  setMeeting,
  reread,
  children,
}: {
  meeting: MeetingView;
  /** The page's state: every landed write and every read again goes through it. */
  setMeeting: (change: (meeting: MeetingView) => MeetingView) => void;
  /** Read the meeting again, after a conflict. */
  reread: () => Promise<MeetingView>;
  /** Optional in the type only, so `createElement(MeetingWriterProvider, props, child)` compiles. */
  children?: ReactNode;
}) {
  const t = useMessages(forumMessages);
  const { toast, show } = useToast();
  const [line, setLine] = useState<Line | null>(null);
  const inFlight = useRef(new Set<Promise<Outcome>>());
  // Read through refs, so `run` and `flush` stay the same functions while the meeting changes — and the language.
  const rereadRef = useRef(reread);
  rereadRef.current = reread;
  const words = useRef(t);
  words.current = t;
  const lineRef = useRef<Line | null>(null);

  /** A toast in the screen's words; a failure or a conflict also stays under *Save*. */
  const say = useCallback((text: string, failure: Line | null = null) => {
    show(text);
    lineRef.current = failure;
    setLine(lineRef.current);
  }, [show]);

  const announce = useCallback((text: string) => show(text), [show]);

  const update = useCallback(
    (change: (meeting: MeetingView) => MeetingView) => setMeeting(change),
    [setMeeting],
  );

  const run = useCallback(<T,>(write: () => Promise<T>, options?: { done?: string }): Promise<T | undefined> => {
    let answer: T | undefined;
    const tracked: Promise<Outcome> = (async () => {
      try {
        answer = await write();
        say(options?.done ?? words.current.saved);
        return { ok: true } as const;
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409 && err.error.code === 'VERSION_CONFLICT') {
          try {
            const fresh = await rereadRef.current();
            setMeeting(() => fresh);
            say(words.current.conflict, 'conflict');
            return { ok: false, line: 'conflict' } as const;
          } catch {
            // Read again and failed too: what is on screen is not what was saved, and nothing says otherwise.
          }
        }
        say(words.current.failed, 'failed');
        return { ok: false, line: 'failed' } as const;
      }
    })();
    inFlight.current.add(tracked);
    void tracked.then(() => inFlight.current.delete(tracked));
    return tracked.then(() => answer);
  }, [say, setMeeting]);

  const flush = useCallback(async () => {
    // A blur is what writes a field: the tab's handler runs inside it and starts its write before we wait.
    const focused = typeof document === 'undefined' ? null : document.activeElement;
    if (isField(focused)) focused.blur();
    await Promise.resolve();

    let failed: Line | null = null;
    const seen = new Set<Promise<Outcome>>();
    // Writes that start while we wait (a blur's own) are waited for as well.
    for (;;) {
      const waiting = [...inFlight.current].filter((p) => !seen.has(p));
      if (waiting.length === 0) break;
      for (const p of waiting) seen.add(p);
      for (const outcome of await Promise.all(waiting)) if (!outcome.ok) failed = outcome.line;
    }

    // A failure before *Save* was pressed and not sent again since is still not saved.
    const still = failed ?? (lineRef.current === 'failed' ? 'failed' : null);
    if (still) say(words.current[still], still);
    else say(words.current.allSaved);
  }, [say]);

  const readOnly = !meeting.can.edit;
  const writer = useMemo<MeetingWriter>(
    () => ({ run, update, announce, readOnly }),
    [run, update, announce, readOnly],
  );
  const shown = line === null ? null : t[line];
  const value = useMemo(() => ({ writer, flush, line: shown }), [writer, flush, shown]);

  return (
    <Context.Provider value={value}>
      {children}
      <Toast toast={toast} />
    </Context.Provider>
  );
}

function useWriterContext(): WriterContext {
  const context = useContext(Context);
  if (!context) throw new Error('useMeetingWriter() needs a MeetingWriterProvider above it.');
  return context;
}

/** What each tab writes through. */
export function useMeetingWriter(): MeetingWriter {
  return useWriterContext().writer;
}

/** What the head's *Save* needs: `flush`, and the failure line it shows under the buttons. */
export function useMeetingSave(): { flush: () => Promise<void>; line: string | null } {
  const { flush, line } = useWriterContext();
  return { flush, line };
}
