'use client';

import { toDisplayError } from '@/lib/api-client';
import type { MeetingView } from '@/lib/leader-meetings';

/**
 * **How a forum's write is sent and what it leaves** (P19.22-T8 AC-3, AC-4; `functional/leader-forum.md`, *Saving*).
 * Each write carries the version of the one item it changes; a landed write's answer replaces that item, and the forum
 * is now written in. **A write somebody else's beat** (`409 VERSION_CONFLICT`) reads the forum again and says so; a
 * forum gone (`404`) says so too; any other failure is said and changes nothing.
 */
export interface ForumWriter {
  /** The forum as last read or written. */
  meeting: MeetingView;
  /** Apply a change to the forum on the screen. */
  update: (change: (m: MeetingView) => MeetingView) => void;
  /** Send `write`, then `apply` its answer; a refusal is read again or said. */
  run: <T>(write: () => Promise<T>, apply: (answer: T, m: MeetingView) => MeetingView) => Promise<boolean>;
}

/** What `run` says, in the reader's words. */
export interface WriterWords {
  conflict: string;
  failed: string;
}

export function makeRun(
  update: ForumWriter['update'], reread: () => Promise<void>, say: (message: string) => void, words: WriterWords,
  onGone: () => void,
): ForumWriter['run'] {
  return async (write, apply) => {
    try {
      const answer = await write();
      update((m) => ({ ...apply(answer, m), writtenIn: true, can: { ...m.can, delete: false } }));
      return true;
    } catch (err) {
      const refused = toDisplayError(err);
      if (refused.code === 'VERSION_CONFLICT') {
        say(words.conflict);
        try {
          await reread();
        } catch {
          // The next write reads it again.
        }
      } else if (refused.code === 'NOT_FOUND') {
        onGone();
      } else {
        say(refused.code === 'VALIDATION_FAILED' ? refused.message : words.failed);
      }
      return false;
    }
  };
}

/** The *Action items x/y selesai* a forum's own list holds after a write. */
export function withProgress(m: MeetingView): MeetingView {
  return {
    ...m,
    actionProgress: { done: m.actionItems.filter((i) => i.status === 'done').length, total: m.actionItems.length },
    agendaCount: m.agenda.length,
  };
}
