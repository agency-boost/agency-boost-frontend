'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { TextInput } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  OWN_COPY, parseTarget, PROTOTYPE_COPY, recruitPill, saveRecruitTarget, type OverviewRecruitment,
} from '@/lib/kpm-overview';
import { useCan, useSession } from '@/lib/session';
import { useDebounced } from '@/lib/use-debounced';
import { OverviewCard } from './parts';

/**
 * How long the *Target* waits for typing to stop before it is saved: long enough that *15* is not saved as
 * *1* on its way, short enough that leaving the page a moment after typing has kept it.
 */
export const TARGET_SAVE_DELAY_MS = 600;

/**
 * *Recruitment pipeline* (`KPM_Owner.html:1049-1073`, CSS `:516-528`): four tiles and the pill.
 *
 * **The tiles are figures, not links** (D-recruit): the prototype's alert lists candidates by name, and the
 * Owner and the Admin hold lead counts, never leads (roles §3.6).
 *
 * **The *Target* is the office's, for this month, and saved as it changes** (D-recruit): the prototype's
 * input keeps nothing (`:1061`). Ours is written for the office's current month once typing settles,
 * audited by the server with before and after, and carried into a month that has none. The pill reacts as
 * the number is typed, as `updateRecruitStatus()` does (`:4875-4889`), and **is not drawn without a
 * target** — judging the pipeline against the prototype's 15 would be judging it against nothing anybody set.
 *
 * Only somebody who may set it is offered the input: `kpm_overview:set_recruit_target`. A read-only support
 * session sees that input **disabled** (roles §3.13: the member's screen as they see it, nothing written), and
 * writes nothing. Anybody else reads it as a figure.
 */
export function Recruitment({ recruitment, month }: { recruitment: OverviewRecruitment; month: string }) {
  const { me } = useSession();
  const holds = useCan('kpm_overview:set_recruit_target');
  const readOnly = !!me?.impersonationReadOnly;
  const canSet = holds && !readOnly;
  // A read-only session's `/auth/me` lists no write (the server drops every write verb inside one), so the
  // member's own *Target* input is recognised by whose screen it is — the Owner's or an Admin's — and drawn
  // disabled, as roles §3.13 says the member's screen is shown.
  const membersInput = readOnly && !!(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);
  const [saved, setSaved] = useState<number | null>(recruitment.target);
  const [typed, setTyped] = useState(recruitment.target === null ? '' : String(recruitment.target));
  const [error, setError] = useState<ApiError | null>(null);
  const settled = useDebounced(typed, TARGET_SAVE_DELAY_MS);
  /** The target the server last confirmed: what a refused save goes back to. */
  const confirmed = useRef<number | null>(recruitment.target);
  /** **One save in flight**, and only the newest value waiting behind it, so two answers never race. */
  const inFlight = useRef(false);
  const queued = useRef<number | null>(null);
  /** What the box holds now, read by a save answering after the reader typed on. */
  const typedNow = useRef(typed);
  typedNow.current = typed;
  const inputId = useId();
  const errorId = useId();

  const parsed = parseTarget(typed);
  const invalid = typed.trim() !== '' && parsed === null;

  const send = useCallback((value: number) => {
    inFlight.current = true;
    setError(null);
    saveRecruitTarget({ month, target: value })
      .then((written) => {
        confirmed.current = written.target;
        setSaved(written.target);
      })
      .catch((err) => {
        setError(toDisplayError(err));
        // What is on screen goes back to what is kept — but only if the box still shows the value refused: a
        // newer value typed meanwhile is the reader's, and is saved in its turn.
        if (parseTarget(typedNow.current) === value) {
          setTyped(confirmed.current === null ? '' : String(confirmed.current));
        }
      })
      .finally(() => {
        inFlight.current = false;
        const next = queued.current;
        queued.current = null;
        if (next !== null && next !== confirmed.current) send(next);
      });
  }, [month]);

  /** Ask for a value to be kept: now, or after the save in flight. A value already kept asks nothing. */
  const request = useCallback((value: number | null) => {
    if (!canSet || value === null || value === confirmed.current) return;
    if (inFlight.current) { queued.current = value; return; }
    send(value);
  }, [canSet, send]);

  // Typing settles: save.
  useEffect(() => { request(parseTarget(settled)); }, [settled, request]);
  // Leaving the page before it settled: save what was typed, rather than drop it.
  useEffect(() => () => { request(parseTarget(typedNow.current)); }, [request]);

  const shownTarget = canSet ? parsed : saved;
  const showInput = holds || membersInput;
  const pill = recruitPill(recruitment.expectedToClose, shownTarget);

  return (
    <OverviewCard className="p-5">
      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RecruitTile label={PROTOTYPE_COPY.expectedToClose}>
          <Value>{recruitment.expectedToClose}</Value>
        </RecruitTile>
        <RecruitTile label={PROTOTYPE_COPY.target} htmlFor={showInput ? inputId : undefined}>
          {showInput ? (
            <TextInput
              id={inputId}
              disabled={readOnly}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={typed}
              invalid={invalid}
              aria-describedby={invalid || error ? errorId : undefined}
              onChange={(e) => setTyped(e.target.value)}
              // A field left empty or half-typed goes back to what is kept; nothing is cleared by leaving it.
              // Leaving the box saves at once what it holds, without waiting for the pause; a box left empty or
              // half-typed goes back to what is kept — nothing is cleared by leaving it.
              onBlur={() => {
                const value = parseTarget(typed);
                if (value === null) setTyped(saved === null ? '' : String(saved));
                else request(value);
              }}
              // `.rt-target-input` (`:524-527`): Inter 20px bold in a 7px box, inside the tile.
              className="h-auto w-full rounded-[7px] px-1.5 py-px font-body text-2xl font-bold"
            />
          ) : saved === null ? (
            <Value>
              <span aria-hidden="true">—</span>
              <span className="sr-only">{OWN_COPY.noTarget}</span>
            </Value>
          ) : (
            <Value>{saved}</Value>
          )}
        </RecruitTile>
        <RecruitTile label={PROTOTYPE_COPY.lastMonth}>
          <Value>{recruitment.closedLastMonth}</Value>
        </RecruitTile>
        <RecruitTile label={PROTOTYPE_COPY.pipelineNow}>
          <Value>{recruitment.pipelineNow}</Value>
        </RecruitTile>
      </div>

      {(invalid || error) && (
        <p id={errorId} role="alert" className="mb-2 text-sm text-alert">
          {invalid ? OWN_COPY.targetInvalid : `${OWN_COPY.targetNotSaved} ${error?.message ?? ''}`.trim()}
        </p>
      )}

      {/* Polite, so the pill's new sentence is heard as the target is typed, as it is seen. */}
      <div aria-live="polite">
        {pill && (
          // `.status-pill` (`:564-566`).
          <span
            className={cn(
              'inline-flex items-center rounded-pill px-2.5 py-1 text-sm font-semibold',
              pill.tone === 'success' ? 'bg-success/10 text-success' : 'bg-alert/10 text-alert',
            )}
          >
            {pill.text}
          </span>
        )}
      </div>
    </OverviewCard>
  );
}

/** `.recruit-tile` (`:521-523`): a warm tile, its 11px label, its 22px figure. */
function RecruitTile({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-hairline bg-base px-3 py-2.5">
      {htmlFor
        ? <label htmlFor={htmlFor} className="mb-[3px] block text-xs text-muted">{label}</label>
        : <p className="mb-[3px] text-xs text-muted">{label}</p>}
      {children}
    </div>
  );
}

function Value({ children }: { children: ReactNode }) {
  return <p className="font-body text-2xl font-bold text-navy">{children}</p>;
}
