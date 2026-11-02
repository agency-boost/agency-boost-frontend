'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { TextInput } from '@/components/ui/field';
import { InlineSaveField, useInlineSave, type InlineSaveOutcome } from '@/components/ui/inline-save-status';
import { TEXT_TAP } from '@/components/ui/phone';
import { Toast, useToast } from '@/components/ui/toast';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  parseTarget, recruitPill, saveRecruitTarget, targetValueWords, type OverviewRecruitment,
} from '@/lib/kpm-overview';
import { useCan, useSession } from '@/lib/session';
import { OverviewCard } from './parts';

/** The *Target*'s own *Saving…* and *Couldn't save — retry* (P18.95-T1 AC-5): the one field on this card that saves itself. */
const TARGET_KEY = 'target';

/**
 * *Recruitment pipeline* (`KPM_Owner.html:1049-1073`, CSS `:516-528`): four tiles and the pill.
 *
 * **The tiles are figures, not links** (D-recruit): the prototype's alert lists candidates by name, and the
 * Owner and the Admin hold lead counts, never leads (roles §3.6).
 *
 * **The *Target* is the office's, for this month** (D-recruit): the prototype's input keeps nothing (`:1061`). Ours is
 * written for the office's current month, audited by the server with before and after, and carried into a month that
 * has none. **Since P18.97-T3 AC-7 it reads as a labelled value** — the tile's *Target* over *15*, or *No target set* —
 * **with *Edit*** for whoever holds `kpm_overview:set_recruit_target` (ADR-0176 §4, UI-020; parity I-506): *Edit* opens
 * the labelled number input in the value's place, which **saves itself on Enter or on leaving it** (OD-200's autosave),
 * reads as a value again and confirms with the toast ***Target saved ✓*** where the field's own *Saved ✓* would have
 * shown. A refusal keeps the input, with *Couldn't save — retry* beside it, which sends the same value again; ***Escape***
 * leaves without saving. No *Save* button and no dialog: the smallest form with a label, an *Edit* and a confirmation.
 *
 * The pill reacts as the number is typed, as `updateRecruitStatus()` does (`:4875-4889`), and **is not drawn without a
 * target** — judging the pipeline against the prototype's 15 would be judging it against nothing anybody set.
 *
 * Anybody without the permission reads the value. A read-only support session sees the member's *Edit* **disabled**
 * (roles §3.13: the member's screen as they see it, nothing written), and writes nothing.
 */
export function Recruitment({ recruitment, month }: { recruitment: OverviewRecruitment; month: string }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const { me } = useSession();
  const holds = useCan('kpm_overview:set_recruit_target');
  const readOnly = !!me?.impersonationReadOnly;
  const canSet = holds && !readOnly;
  // A read-only session's `/auth/me` lists no write (the server drops every write verb inside one), so the member's own
  // *Edit* is recognised by whose screen it is — the Owner's or an Admin's — and drawn disabled, as roles §3.13 says
  // the member's screen is shown.
  const showEdit = holds || (readOnly && !!(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin));
  const [saved, setSaved] = useState<number | null>(recruitment.target);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  /** Enter on an empty box: the reader asked to save nothing, so the box says what it takes. */
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inputId = useId();
  const errorId = useId();
  /** The box, by its id: `TextInput` takes no ref. */
  const input = useCallback(
    () => (typeof document === 'undefined' ? null : document.getElementById(inputId) as HTMLInputElement | null),
    [inputId],
  );
  const editButton = useRef<HTMLButtonElement>(null);
  /** Where the focus goes once the box closes: back to *Edit*, when the box held it. */
  const [focusEdit, setFocusEdit] = useState(false);
  const { toast, show } = useToast();
  const inline = useInlineSave();
  const saveInline = inline.save;
  const clearInline = inline.clear;
  /** A save on its way: the box waits for it, and neither Enter nor leaving sends another. */
  const inFlight = useRef(false);
  /** The value the last attempt was refused: leaving the box does not send it again — its retry does. */
  const refused = useRef<number | null>(null);
  /** What the box holds now, and whether it is open, for the save the page's leaving sends. */
  const now = useRef({ editing, typed, saved });
  now.current = { editing, typed, saved };
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => { gone.current = true; };
  }, []);

  // *Edit* puts the reader in the box, its number selected, so typing replaces it.
  useEffect(() => {
    if (!editing) return;
    const box = input();
    box?.focus();
    try { box?.select(); } catch { /* a number box that keeps no selection still has the focus */ }
  }, [editing, input]);
  useEffect(() => {
    if (!focusEdit) return;
    editButton.current?.focus();
    setFocusEdit(false);
  }, [focusEdit]);

  const parsed = parseTarget(typed);
  const invalid = editing && ((typed.trim() !== '' && parsed === null) || (asked && parsed === null));

  /** Back to the value, saving nothing: the inline status and the refusal go with the box. */
  const close = useCallback((refocus: boolean) => {
    clearInline(TARGET_KEY);
    refused.current = null;
    setError(null);
    setAsked(false);
    setEditing(false);
    if (refocus) setFocusEdit(true);
  }, [clearInline]);

  const send = useCallback((value: number) => {
    /** One write of `value`; its retry sends this same value again (P18.95-T1 AC-5). */
    const attempt = async (): Promise<InlineSaveOutcome> => {
      inFlight.current = true;
      refused.current = null;
      setError(null);
      try {
        const written = await saveRecruitTarget({ month, target: value });
        setSaved(written.target);
        if (!gone.current) {
          const hadFocus = typeof document !== 'undefined' && document.activeElement !== null && document.activeElement === input();
          close(hadFocus);
          show(t.targetSaved);
        }
        return true;
      } catch (err) {
        refused.current = value;
        setError(toDisplayError(err));
        return false;
      } finally {
        inFlight.current = false;
      }
    };
    // Leaving the page as it saves: nowhere to say how it went.
    if (gone.current) void attempt();
    else void saveInline(TARGET_KEY, attempt);
  }, [month, saveInline, close, show, input, t]);

  /** Enter, or leaving the box: save what it holds, if it is a target and not the one kept. */
  const commit = (how: 'enter' | 'blur') => {
    if (!canSet || inFlight.current) return;
    const value = parseTarget(typed);
    if (value === null) {
      // Leaving a box empty or half-typed clears nothing: the value kept stands. Enter on it says what it takes.
      if (how === 'enter') setAsked(true);
      else close(false);
      return;
    }
    if (value === saved) { close(how === 'enter'); return; }
    // The value just refused is sent again by its retry, not by leaving the box towards it.
    if (how === 'blur' && value === refused.current) return;
    send(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit('enter'); }
    // A save already on its way lands whatever Escape says: the box closes when it does.
    if (e.key === 'Escape') { e.preventDefault(); if (!inFlight.current) close(true); }
  };

  // Leaving the page with the box open saves what it holds, as leaving the box does; nothing is drawn for it.
  useEffect(() => () => {
    const { editing: wasOpen, typed: text, saved: kept } = now.current;
    const value = parseTarget(text);
    if (!wasOpen || !canSet || inFlight.current || value === null || value === kept || value === refused.current) return;
    send(value);
  }, [canSet, send]);

  const open = () => {
    setTyped(saved === null ? '' : String(saved));
    setAsked(false);
    setError(null);
    setEditing(true);
  };

  const shownTarget = editing && parsed !== null ? parsed : saved;
  const pill = recruitPill(recruitment.expectedToClose, shownTarget, language);

  return (
    <OverviewCard className="p-5">
      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RecruitTile label={t.expectedToClose}>
          <Value>{recruitment.expectedToClose}</Value>
        </RecruitTile>
        <RecruitTile label={t.target} htmlFor={editing ? inputId : undefined}>
          {editing ? (
            // Its status on the line under it, inside the tile (P18.95-T1 AC-5); the refusal's reason stays below the tiles.
            <InlineSaveField status={inline.statusOf(TARGET_KEY)} label={t.target}>
              <TextInput
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={typed}
                invalid={invalid}
                readOnly={inline.stateOf(TARGET_KEY) === 'saving'}
                aria-describedby={invalid || error ? errorId : undefined}
                onChange={(e) => { setTyped(e.target.value); setAsked(false); }}
                onKeyDown={onKeyDown}
                onBlur={() => commit('blur')}
                // `.rt-target-input` (`:524-527`): Inter 20px bold in a 7px box, inside the tile.
                className="h-auto w-full rounded-[7px] px-1.5 py-px font-body text-2xl font-bold"
              />
            </InlineSaveField>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              {saved === null
                ? <p className="text-md font-semibold text-muted">{targetValueWords(saved, language)}</p>
                : <Value>{targetValueWords(saved, language)}</Value>}
              {showEdit && (
                <button
                  ref={editButton}
                  type="button"
                  disabled={readOnly}
                  aria-label={t.editTarget}
                  onClick={open}
                  className={cn(
                    'text-sm font-semibold text-amber-ink underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:no-underline',
                    TEXT_TAP,
                  )}
                >
                  {t.edit}
                </button>
              )}
            </div>
          )}
        </RecruitTile>
        <RecruitTile label={t.lastMonth}>
          <Value>{recruitment.closedLastMonth}</Value>
        </RecruitTile>
        <RecruitTile label={t.pipelineNow}>
          <Value>{recruitment.pipelineNow}</Value>
        </RecruitTile>
      </div>

      {(invalid || error) && (
        <p id={errorId} role="alert" className="mb-2 text-sm text-alert">
          {invalid ? t.targetInvalid : `${t.targetNotSaved} ${error?.message ?? ''}`.trim()}
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
      {/* *Target saved ✓* (OD-200's toast): the shell's region inside a shell, this card's own outside one. */}
      <Toast toast={toast} />
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
