'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { readProposal, type Proposal } from '@/lib/proposals';

/** Where the last save stands: nothing pending, on its way, or refused by the network or the server. */
export type ProposalSaveState = 'idle' | 'saving' | 'failed';

export interface ProposalEditor {
  proposal: Proposal | null;
  /** The read failed: the proposal is not the reader's, or the request never arrived. */
  error: ApiError | null;
  save: ProposalSaveState;
  /** *"Proposal ini diubah di perangkat lain."* — set when a write met `409 VERSION_CONFLICT` and the proposal was read again. */
  conflict: boolean;
  /** The refusal of the last write the server answered with something other than a conflict. */
  refusal: ApiError | null;
  /**
   * **One write, after every write before it, at the version the last one left** (ADR-0221 §3). Answers what the server
   * answered, or `null` when it was refused — a conflict is read again and said, anything else is kept for *Coba lagi*.
   */
  write: <T extends Proposal>(run: (version: number) => Promise<T>) => Promise<T | null>;
  /** *Coba lagi*: the write that failed, again. */
  retry: () => void;
  /** Read it again — after a conflict, or to start over. */
  reload: () => Promise<void>;
}

/**
 * **The draft on the server, saved on every change** (AC-2; Acc. 18; ADR-0221 §3).
 *
 * - **Writes queue.** Each waits for the one before, and pins the version that one answered: two taps in a row would
 *   otherwise race each other into a `409` the agent did not cause.
 * - **A `409` is news, not a failure**: the proposal is read again and the screen says it changed on another device.
 * - **Anything else keeps what was typed** — the inputs hold their own text — and offers *Coba lagi*.
 */
export function useProposal(id: string): ProposalEditor {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [save, setSave] = useState<ProposalSaveState>('idle');
  const [conflict, setConflict] = useState(false);
  const [refusal, setRefusal] = useState<ApiError | null>(null);
  const version = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const failed = useRef<(() => void) | null>(null);
  const live = useRef(true);

  const take = useCallback((next: Proposal) => {
    version.current = next.version;
    if (live.current) setProposal(next);
  }, []);

  const reload = useCallback(async () => {
    try {
      take(await readProposal(id));
      if (live.current) setError(null);
    } catch (err) {
      if (live.current) setError(toDisplayError(err));
    }
  }, [id, take]);

  useEffect(() => {
    live.current = true;
    void reload();
    return () => { live.current = false; };
  }, [reload]);

  const write = useCallback(<T extends Proposal>(run: (version: number) => Promise<T>): Promise<T | null> => {
    const attempt = async (): Promise<T | null> => {
      setSave('saving');
      setRefusal(null);
      try {
        const next = await run(version.current);
        take(next);
        failed.current = null;
        if (live.current) {
          setSave('idle');
          setConflict(false);
        }
        return next;
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          await reload();
          if (live.current) {
            setConflict(true);
            setSave('idle');
          }
          return null;
        }
        failed.current = () => { void write(run); };
        if (live.current) {
          setRefusal(err instanceof ApiRequestError ? err.error : null);
          setSave('failed');
        }
        return null;
      }
    };
    const next = queue.current.then(attempt, attempt);
    queue.current = next;
    return next;
  }, [reload, take]);

  const retry = useCallback(() => { failed.current?.(); }, []);

  return { proposal, error, save, conflict, refusal, write, retry, reload };
}
