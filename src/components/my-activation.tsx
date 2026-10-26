'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ActivationSkeleton, AspectCard, AttributionMark, AutoBadge, ByHandBadge, DateField, GoToLink, ITEM_CHECKBOX, ITEM_ROW,
  ProgressHeading, ProgressSummary, RowError, useWriteQueue,
} from '@/components/activation-parts';
import { Dialog } from '@/components/ui/dialog';
import { Button, Card, ErrorBanner, TextInput } from '@/components/ui/field';
import { InlineSaveField, InlineSaveStatus, useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { Toast, useHostToast, useToast } from '@/components/ui/toast';
import {
  attributionOf, correctionOf, graduateMyActivation, isComplete, isManual, isTickedByHandLink, ITEM_NOTE_MAX, MY_COACHING_ACTIVATION_HREF, OWN_COPY,
  PROTOTYPE_COPY, readMyActivation, saveMyItem, type ActivationItemProgress, type ActivationView, type MyItemInput,
} from '@/lib/activation';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatOfficeDay, formatShortDay } from '@/lib/format';
import { landingFor } from '@/lib/landing';
import { useCan, useSession } from '@/lib/session';

/** Which of a row's three fields a write came from, for its own save confirmation. */
type ItemField = 'done' | 'note' | 'date';

/**
 * **The hire's own *90-Day Activation*** (`/activation`, `Overall.html:3270-3352`, logic `:6430-6694`;
 * P13-T4, T6, T7): their pinned checklist, ticked as they go.
 *
 * - **The header card**: *Your activation progress*, the *Start date* — read-only, since a leader
 *   corrects it and the hire does not (OD-118) — and *Mark activation complete →*, enabled at 100%
 *   (OD-28), asked in the product's dialog (F-72).
 * - **The progress**: *Day*, *Completed*, the bar and the aspect table, all served (P13-T2 AC-5).
 * - **A manual row**: a checkbox, and the chevron *Show note and date* opening the hire's own *Note
 *   (optional)* and date, each saved as the prototype saves them, on change (T4 AC-3).
 * - **A linked row**: the checkbox disabled, *Auto* with what it waits for, and *Go to {label} →*
 *   (T4 AC-4). Nobody ticks a live link (ADR-0031).
 * - **Who ticked it** on every done row, an `ⓘ` with the words (OD-121, T4 AC-5).
 * - **The leader's coaching note**, read-only, with who wrote it and when (OD-117, T6 AC-3).
 *
 * **A write shows at once and is settled by its answer**: the box ticks as it is clicked, the answer
 * replaces the whole activation, and a write the server refuses puts the row back and says why (T4
 * AC-7). Writes go out one at a time, so answers land in the order they were asked and an earlier one
 * never overwrites a later one. **The percentage waits for the answer**: the server computes it, and a
 * screen that worked it out could disagree with the leader's (exit criterion 2).
 *
 * **A read-only support session draws no write control** (T4 AC-9, the calendar's L-79): the boxes are
 * drawn disabled, the note and date read-only, and there is no button.
 */
export function MyActivation() {
  const { me, reload } = useSession();
  const router = useRouter();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const mayTick = useCan('activation:update_manual_item') && !readOnly;
  const mayGraduate = useCan('activation:graduate') && !readOnly;
  const mayReadCoaching = useCan('coaching_session:read');
  const hostToast = useHostToast();
  const local = useToast();
  const queue = useWriteQueue();
  /**
   * The tick, the note and the date each say *Saving… → Saved ✓* beside them, or *Couldn't save — retry*
   * (P18.95-T1 AC-5, ADR-0167 §5; UI-007), above the row's *Not saved.* which still says why.
   */
  const { save: track, statusOf } = useInlineSave();

  const [view, setView] = useState<ActivationView | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Readonly<Record<string, MyItemInput>>>({});
  const [failed, setFailed] = useState<Readonly<Record<string, string>>>({});
  const [resets, setResets] = useState<Readonly<Record<string, number>>>({});
  const asked = useRef<Record<string, number>>({});
  const [asking, setAsking] = useState(false);
  const [graduating, setGraduating] = useState(false);
  const [graduateError, setGraduateError] = useState<ApiError | null>(null);
  /*
   * The nav's amber check, as the session last read it (`me.activation.complete`). A write whose answer
   * disagrees with it — the last item ticked, or the first one unticked after — reads the session again,
   * so the check follows at once rather than on the next load (L-87). Every other tick leaves it alone.
   * `undefined` when the session carries no activation of the reader's, and then nothing is re-read.
   */
  const navComplete = useRef<boolean | undefined>(me?.activation?.complete);
  useEffect(() => { navComplete.current = me?.activation?.complete; }, [me]);

  useEffect(() => {
    let live = true;
    setError(null);
    readMyActivation()
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [attempt]);

  const write = useCallback((code: string, patch: MyItemInput): Promise<boolean> => {
    const ask = (asked.current[code] ?? 0) + 1;
    asked.current[code] = ask;
    setPending((p) => ({ ...p, [code]: { ...p[code], ...patch } }));
    setFailed(({ [code]: _gone, ...rest }) => rest);
    return queue(async () => {
      try {
        const next = await saveMyItem(code, patch);
        setView(next);
        const complete = isComplete(next);
        if (navComplete.current !== undefined && navComplete.current !== complete) {
          // Held at the answer's value until the session lands, so a second write meanwhile asks once.
          navComplete.current = complete;
          void reload();
        }
        return true;
      } catch (err) {
        setFailed((f) => ({ ...f, [code]: toDisplayError(err).message }));
        setResets((r) => ({ ...r, [code]: (r[code] ?? 0) + 1 }));
        return false;
      } finally {
        // A later write to the same row keeps its own pending state until its own answer.
        if (asked.current[code] === ask) setPending(({ [code]: _done, ...rest }) => rest);
      }
    });
  }, [queue, reload]);

  /** One field's write, with its confirmation; a retry sends the same patch again (AC-5). */
  const save = useCallback((code: string, patch: MyItemInput, field: ItemField) => {
    void track(`${code}\n${field}`, () => write(code, patch));
  }, [track, write]);

  const graduate = async () => {
    setAsking(false);
    setGraduating(true);
    setGraduateError(null);
    try {
      await graduateMyActivation();
      (hostToast ?? local.show)(PROTOTYPE_COPY.graduated);
      // The reader's landing, in place of the prototype's *New hires* (`:6687`; contradiction 4, a Fix):
      // a hire with no hires has no such page. Replaced, so Back does not return to a page no longer offered.
      router.replace(landingFor(me));
      // The session's facts, so the nav drops the item (P13-T7 AC-3).
      void reload();
    } catch (err) {
      setGraduateError(toDisplayError(err));
      setGraduating(false);
    }
  };

  if (missing || (view && view.state !== 'open')) {
    return <NotOffered view={missing ? null : view} coachingLink={mayReadCoaching} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <ActivationSkeleton label={OWN_COPY.loading} />}

      {view && (
        <>
          <Card density="compact">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
              <ProgressHeading>{PROTOTYPE_COPY.progressHeading}</ProgressHeading>
              <div className="flex flex-wrap items-end gap-2.5">
                <StartDate view={view} reader={me?.membership?.membershipId} />
                {mayGraduate && (
                  <Button
                    variant="secondary"
                    disabled={view.pct < 100 || graduating}
                    onClick={() => setAsking(true)}
                    className="h-auto px-4 py-[9px] text-base"
                  >
                    {PROTOTYPE_COPY.graduate}
                  </Button>
                )}
              </div>
            </div>
            {graduateError && <div className="mb-4"><ErrorBanner {...graduateError} /></div>}
            <ProgressSummary view={view} label={PROTOTYPE_COPY.progressHeading} />
          </Card>

          {view.aspects.map((aspect, i) => (
            <AspectCard key={aspect.code} n={i + 1} label={aspect.label}>
              {aspect.items.map((item) => (
                <MyItemRow
                  key={item.code}
                  item={{ ...item, ...pending[item.code] }}
                  reader={me?.membership?.membershipId}
                  writable={mayTick}
                  onSave={(patch, field) => save(item.code, patch, field)}
                  status={(field) => statusOf(`${item.code}\n${field}`)}
                  error={failed[item.code]}
                  resetKey={resets[item.code] ?? 0}
                />
              ))}
            </AspectCard>
          ))}

          {view.note && <NoteFromLeader view={view} reader={me?.membership?.membershipId} />}

          <p className="mt-1 text-center text-sm leading-relaxed text-muted">{PROTOTYPE_COPY.footer}</p>

          <Dialog
            open={asking}
            message={PROTOTYPE_COPY.graduateQuestion}
            confirmLabel={PROTOTYPE_COPY.confirm}
            cancelLabel={PROTOTYPE_COPY.cancel}
            onConfirm={() => void graduate()}
            onCancel={() => setAsking(false)}
          />
        </>
      )}
      {!hostToast && <Toast toast={local.toast} />}
    </div>
  );
}

/**
 * *Start date* (`:3283-3287`), **read-only for the hire** (OD-118): the prototype's input lets anybody
 * reset their own ninety days and hide an overdue, so the date is shown, not offered. When a leader moved
 * it, the marker beside it says who and when.
 */
function StartDate({ view, reader }: { view: ActivationView; reader: string | null | undefined }) {
  const corrected = correctionOf(view, reader);
  return (
    <dl className="flex items-center gap-2">
      <dt className="whitespace-nowrap text-xs font-semibold text-navy">{PROTOTYPE_COPY.startDate}</dt>
      <dd className="flex h-[34px] items-center rounded-md border-[1.5px] border-hairline bg-base px-3 text-base text-navy">
        <time dateTime={view.startDate}>{formatShortDay(view.startDate, { year: true })}</time>
      </dd>
      {corrected && <dd><AttributionMark words={corrected} /></dd>}
    </dl>
  );
}

/**
 * One of the hire's rows (`:6570-6607`). A live link is *Auto*, disabled, with its *Go to* link, and so is
 * an item its link already completed (its *Go to* gone once the module is not offered); anything else — no
 * link, or a training link whose module is not offered (D-orphan, *Ticked by hand*) — is ticked by hand,
 * with the chevron opening the hire's own note and date.
 */
function MyItemRow({
  item, reader, writable, onSave, status, error, resetKey,
}: {
  item: ActivationItemProgress;
  reader: string | null | undefined;
  writable: boolean;
  onSave: (patch: MyItemInput, field: ItemField) => void;
  /** Each field's save confirmation (P18.95-T1 AC-5). */
  status: (field: ItemField) => InlineSaveStatusProps;
  error: string | undefined;
  resetKey: number;
}) {
  const [open, setOpen] = useState(false);
  const metaId = useId();
  const words = attributionOf(item, reader);

  if (!isManual(item) && item.link) {
    return (
      <div className={ITEM_ROW} data-code={item.code}>
        <div className="flex items-center gap-2.5">
          <label className="flex min-w-0 items-center gap-2.5 text-md font-medium text-navy">
            <input type="checkbox" checked={item.done} disabled className={ITEM_CHECKBOX} />
            <span>{item.label}</span>
          </label>
          <AutoBadge link={item.link} />
          <AttributionMark words={words} />
        </div>
        {/* Not to a module no longer offered (D-orphan): its link already completed the item, and its page is gone. */}
        {item.link.live && (
          <div className="ml-[26px] mt-[9px] flex flex-wrap gap-2">
            <GoToLink link={item.link} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={ITEM_ROW} data-code={item.code}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <label className="flex min-w-0 items-center gap-2.5 text-md font-medium text-navy">
            <input
              type="checkbox"
              checked={item.done}
              disabled={!writable}
              onChange={(e) => onSave({ done: e.target.checked }, 'done')}
              className={ITEM_CHECKBOX}
            />
            <span>{item.label}</span>
          </label>
          {isTickedByHandLink(item) && <ByHandBadge />}
          <AttributionMark words={words} />
          {/* Beside the box it confirms, on the row's own line. */}
          <InlineSaveStatus {...status('done')} label={item.label} />
        </div>
        <button
          type="button"
          aria-label={PROTOTYPE_COPY.showNoteAndDate}
          aria-expanded={open}
          aria-controls={metaId}
          onClick={() => setOpen((was) => !was)}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-transform hover:bg-navy/[0.06] hover:text-navy',
            open && 'rotate-180 text-navy',
          )}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {/* `hidden` alone loses to Tailwind's `flex`, which sets `display`: the class goes with the state. */}
      <div id={metaId} hidden={!open} className={cn('ml-[26px] mt-2.5 flex-wrap gap-2', open ? 'flex' : 'hidden')}>
        <InlineSaveField status={status('note')} label={OWN_COPY.itemNoteName(item.label)} className="min-w-0 flex-[1_1_170px]">
          <NoteInput item={item} writable={writable} onSave={(patch) => onSave(patch, 'note')} resetKey={resetKey} />
        </InlineSaveField>
        <InlineSaveField status={status('date')} label={OWN_COPY.itemDateName(item.label)}>
          <DateField
            value={item.date}
            clearable
            readOnly={!writable}
            resetKey={resetKey}
            aria-label={OWN_COPY.itemDateName(item.label)}
            onCommit={(date) => onSave({ done: item.done, date }, 'date')}
          />
        </InlineSaveField>
      </div>
      <RowError message={error} />
    </div>
  );
}

/**
 * *Note (optional)* (`:6603`): saved when the field is left, as the prototype's `change` fires, and only
 * when it changed. Emptied, it is cleared.
 */
function NoteInput({
  item, writable, onSave, resetKey,
}: { item: ActivationItemProgress; writable: boolean; onSave: (patch: MyItemInput) => void; resetKey: number }) {
  const [draft, setDraft] = useState(item.note ?? '');
  useEffect(() => { setDraft(item.note ?? ''); }, [item.note, resetKey]);
  return (
    <TextInput
      type="text"
      value={draft}
      readOnly={!writable}
      maxLength={ITEM_NOTE_MAX}
      placeholder={PROTOTYPE_COPY.notePlaceholder}
      aria-label={OWN_COPY.itemNoteName(item.label)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next === (item.note ?? '')) return;
        onSave({ done: item.done, note: next === '' ? null : next });
      }}
      // The row's flex share is its save confirmation's box's now (P18.95-T1 AC-5); the box fills it.
      className="h-[34px] w-full min-w-0 text-base"
    />
  );
}

/**
 * The leader's *Coaching note*, which the detail's hint and toast promise the hire reads here
 * (`:3409`, `:6891`; OD-117, T6 AC-3): read-only, in the leader card's idiom (`.notes-card`, `:148-150`),
 * with who wrote it and when as its one line. No form smaller would do: a note is words to read, not a
 * fact a tooltip can carry.
 */
function NoteFromLeader({ view, reader }: { view: ActivationView; reader: string | null | undefined }) {
  const note = view.note!;
  const who = note.by.membershipId === reader ? OWN_COPY.you : note.by.name;
  return (
    <section aria-labelledby="activation-note" className="rounded-lg border border-hairline bg-card p-[18px]">
      <h2 id="activation-note" className="font-display text-md font-bold text-navy">{PROTOTYPE_COPY.noteHeading}</h2>
      <p className="mt-2 whitespace-pre-line text-md text-navy">{note.text}</p>
      <p className="mt-2 text-sm text-muted">{OWN_COPY.noteFrom(who, formatOfficeDay(note.at))}</p>
    </section>
  );
}

/**
 * `/activation` for a reader it is not offered to (T4 AC-7, a Fill): somebody with no activation, and a
 * hire whose activation is graduated or ended (OD-28, OD-120). The page says which, in a card of the
 * product's own, and — where there is a checklist to read — where it now lives: the reader's own
 * coaching, whose *Activation* tab keeps it (D-coaching-me).
 */
function NotOffered({ view, coachingLink }: { view: ActivationView | null; coachingLink: boolean }) {
  const [title, line] = !view
    ? [OWN_COPY.noneTitle, OWN_COPY.noneLine]
    : view.state === 'graduated'
      ? [OWN_COPY.graduatedTitle, OWN_COPY.graduatedLine(view.graduatedAt ? formatOfficeDay(view.graduatedAt) : formatShortDay(view.today, { year: true }))]
      : [OWN_COPY.expiredTitle, OWN_COPY.expiredLine(formatShortDay(view.endsOn, { year: true }))];
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      <p className="mt-1 text-md text-muted">{line}</p>
      {view && coachingLink && (
        <p className="mt-1 text-md text-muted">
          {OWN_COPY.checklistElsewhere}{' '}
          <Link href={MY_COACHING_ACTIVATION_HREF} className="font-semibold text-navy underline">{OWN_COPY.ownCoaching}</Link>
        </p>
      )}
    </Card>
  );
}
