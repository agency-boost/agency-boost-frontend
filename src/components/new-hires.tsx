'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivationSkeleton, AspectCard, AttributionMark, AutoBadge, ByHandBadge, DateField, ITEM_CHECKBOX, ITEM_ROW, ProgressHeading,
  ProgressSummary, RowError, useWriteQueue,
} from '@/components/activation-parts';
import { PageHeader } from '@/components/app-shell';
import { Button, Card, ErrorBanner, Textarea } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import {
  ACTIVATION_NOTE_MAX, attributionOf, correctionOf, correctStartDate, dayShown, earliestStart, groupTitle, isManual, isTickedByHandLink,
  newHireHref, OWN_COPY, PROTOTYPE_COPY, readNewHire, readNewHires, saveActivationNote, saveHireItem,
  startDateAllowed, startDateRangeText, type ActivationItemProgress, type ActivationView, type NewHireGroup,
  type NewHiresRoster,
} from '@/lib/activation';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatOfficeDay, formatShortDay } from '@/lib/format';
import { useCan, useSession } from '@/lib/session';

/*
 * ── The roster ───────────────────────────────────────────────────────────────────────────────────
 */

/**
 * **Your New Hires** (`/new-hires`, `Overall.html:3354-3361`, logic `:6698-6783`; P13-T5): every open
 * activation the reader reaches, a card per group — *Direct Unit*, then *AAB: {name}* for each AAB below
 * them (D-group) — each hire under their nearest AAB, by day, highest first. The server groups and
 * orders; this draws what it is served.
 *
 * **Each hire's name is a link to their detail** (contradiction 10): the prototype's rows are table rows
 * with a click handler, which a keyboard cannot reach. **The table scrolls inside its card** on a phone
 * (`.table-scroll`, `:6778`; AC-9), so the page never does.
 */
export function NewHires() {
  const [roster, setRoster] = useState<NewHiresRoster | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readNewHires()
      .then((next) => { if (live) setRoster(next); })
      .catch((err) => {
        if (!live) return;
        // Nobody the reader reaches is in an open activation: the nav would not have offered the page.
        if (err instanceof ApiRequestError && err.status === 404) setEmpty(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [attempt]);

  if (empty || (roster && roster.groups.every((g) => g.hires.length === 0))) {
    return <Card><p className="text-center text-md text-muted">{OWN_COPY.rosterEmpty}</p></Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {!roster && !error && <SkeletonCards count={2} label={OWN_COPY.loadingRoster} />}
      {roster?.groups.filter((g) => g.hires.length > 0).map((group) => (
        <GroupCard key={group.leader?.membershipId ?? 'direct'} group={group} />
      ))}
    </div>
  );
}

/** `.newhire-table th` and `td` (`:1541-1545`). */
const TH = 'border-b border-hairline px-3 py-[9px] text-left text-xs font-semibold uppercase tracking-wide text-muted';
const TD = 'border-b border-hairline px-3 py-3.5 text-md font-medium text-navy';

/** One group's card (`.newhire-group-card`, `:6775-6789`): its heading, and its table. */
function GroupCard({ group }: { group: NewHireGroup }) {
  const title = groupTitle(group);
  return (
    <section aria-label={title} className="rounded-lg border border-hairline bg-card px-6 py-[22px]">
      <h2 className="mb-3 font-display text-md font-bold text-navy">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] table-fixed border-collapse">
          <caption className="sr-only">{title}</caption>
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[15%]" />
            <col className="w-[29%]" />
            <col className="w-[12%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={TH}>{PROTOTYPE_COPY.name}</th>
              <th scope="col" className={TH}>{PROTOTYPE_COPY.joined}</th>
              <th scope="col" className={TH}>{PROTOTYPE_COPY.progress}</th>
              <th scope="col" className={cn(TH, 'text-center')}>{PROTOTYPE_COPY.day}</th>
              <th scope="col" className={cn(TH, 'text-center')}>{PROTOTYPE_COPY.activeAgent}</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>*]:border-b-0">
            {group.hires.map((row) => {
              const width = Math.min(100, Math.max(0, row.pct));
              return (
                <tr key={row.hire.membershipId} className="hover:bg-navy/[0.03]">
                  <th scope="row" className={cn(TD, 'text-left')}>
                    <Link href={newHireHref(row.hire.membershipId)} className="text-navy hover:underline">{row.hire.name}</Link>
                  </th>
                  <td className={TD}>
                    <time dateTime={row.startDate}>{formatShortDay(row.startDate, { year: true })}</time>
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-[9px]">
                      <div aria-hidden="true" className="h-1.5 w-[90px] shrink-0 overflow-hidden rounded-sm border border-hairline bg-base">
                        <div className="h-full rounded-sm bg-gradient-to-r from-amber to-amber-dark" style={{ width: `${width}%` }} />
                      </div>
                      <span>{row.pct}%</span>
                    </div>
                  </td>
                  <td className={cn(TD, 'text-center', row.overdue && 'font-bold text-alert')} data-overdue={row.overdue || undefined}>
                    {dayShown(row.day, row.window)}
                    <span className="font-normal text-muted"> /{row.window}</span>
                    {/* The red and the bold say it to the eye; this says it to a screen reader. */}
                    {row.overdue && <span className="sr-only">{OWN_COPY.overdue}</span>}
                  </td>
                  <td className={cn(TD, 'text-center')}>
                    {row.firstCaseClosed ? (
                      <span
                        role="img"
                        aria-label={PROTOTYPE_COPY.closedFirstCase}
                        title={PROTOTYPE_COPY.closedFirstCase}
                        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-success/[0.12] text-success"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.8">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-sm text-muted">{PROTOTYPE_COPY.none}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/*
 * ── One hire ─────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * **One hire's activation, as a leader reads it** (`/new-hires/[membershipId]`, `Overall.html:3363-3416`,
 * logic `:6791-6892`; P13-T5, T6): the hire's name as the title, *Back to Your New Hires*, *Activation
 * progress* with the *Start date* the leader may correct (OD-118), the tiles — *Day* red when overdue
 * (`:6801`) — the bar and the table, the five aspect cards, and the *Coaching note*.
 *
 * - **Manual items are the leader's to tick and untick** (OD-121), each write toasting *"Activation
 *   status updated."* (`:6869`). **The linked items are disabled with *Auto***, as on the hire's page
 *   (contradiction 1, a Fix): nobody ticks a live link (ADR-0031). No note or date fields, as drawn —
 *   those are the hire's own, and no leader's read carries them (T2 AC-4).
 * - **Every done row says who ticked it** (OD-121), since the hire and every leader above them tick the
 *   same list.
 * - **A hire outside the reader's reach is a 404**, and the page says so without saying who exists.
 * - **An activation that is over** is read, and written no more (the server answers every write 409
 *   `ACTIVATION_CLOSED`, the note's included): its boxes, its date and its note are drawn read-only, with
 *   no *Save note*, and one line under the heading says how it ended.
 * - **A read-only support session draws no write control** (T5 AC-8).
 */
export function NewHireDetail({ membershipId }: { membershipId: string }) {
  const { me } = useSession();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const mayTick = useCan('activation:update_manual_item') && !readOnly;
  const mayCorrect = useCan('activation:set_start_date') && !readOnly;
  const mayNote = useCan('activation_note:write') && !readOnly;
  const reader = me?.membership?.membershipId;
  const { toast, show } = useToast();
  const queue = useWriteQueue();

  const [view, setView] = useState<ActivationView | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Readonly<Record<string, boolean>>>({});
  const [failed, setFailed] = useState<Readonly<Record<string, string>>>({});
  const asked = useRef<Record<string, number>>({});
  const [startError, setStartError] = useState<string | null>(null);
  const [startReset, setStartReset] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    setMissing(false);
    readNewHire(membershipId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [membershipId, attempt]);

  const tick = useCallback((code: string, done: boolean) => {
    const ask = (asked.current[code] ?? 0) + 1;
    asked.current[code] = ask;
    setPending((p) => ({ ...p, [code]: done }));
    setFailed(({ [code]: _gone, ...rest }) => rest);
    void queue(async () => {
      try {
        setView(await saveHireItem(membershipId, code, done));
        show(PROTOTYPE_COPY.statusUpdated);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        setFailed((f) => ({ ...f, [code]: toDisplayError(err).message }));
      } finally {
        if (asked.current[code] === ask) setPending(({ [code]: _done, ...rest }) => rest);
      }
    });
  }, [membershipId, queue, show]);

  const correct = useCallback((startDate: string) => {
    setStartError(null);
    void queue(async () => {
      try {
        setView(await correctStartDate(membershipId, startDate));
        show(OWN_COPY.startSaved);
      } catch (err) {
        setStartError(toDisplayError(err).message);
        setStartReset((n) => n + 1);
      }
    });
  }, [membershipId, queue, show]);

  if (missing) return <HireNotFound />;

  const open = view?.state === 'open';

  return (
    <div className="min-w-0">
      {/* The prototype's subtitle says the leader can update it, which is untrue once it is over: there
          the one line it already has says how it ended instead (ADR-0062 §2, form 5; parity L-89). */}
      {view && (
        <PageHeader
          title={view.hire.name}
          subtitle={view.state === 'open' ? PROTOTYPE_COPY.detailSubtitle : closedLine(view, reader)}
        />
      )}
      <BackToRoster />

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <ActivationSkeleton label={OWN_COPY.loadingHire} />}

      {view && (
        <div className="flex flex-col gap-4">
          <Card density="compact">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
              <ProgressHeading>{PROTOTYPE_COPY.detailHeading}</ProgressHeading>
              <StartDateField
                view={view}
                reader={reader}
                writable={mayCorrect && open}
                onCommit={correct}
                error={startError}
                resetKey={startReset}
              />
            </div>
            <ProgressSummary view={view} label={PROTOTYPE_COPY.detailHeading} markOverdue />
          </Card>

          {view.aspects.map((aspect, i) => (
            <AspectCard key={aspect.code} n={i + 1} label={aspect.label}>
              {aspect.items.map((item) => (
                <HireItemRow
                  key={item.code}
                  item={pending[item.code] === undefined ? item : { ...item, done: pending[item.code] }}
                  reader={reader}
                  writable={mayTick && open}
                  onTick={(done) => tick(item.code, done)}
                  error={failed[item.code]}
                />
              ))}
            </AspectCard>
          ))}

          <NoteCard
            key={view.note?.at ?? 'none'}
            view={view}
            reader={reader}
            writable={mayNote && open}
            onSaved={(note) => {
              setView((v) => (v ? { ...v, note } : v));
              show(PROTOTYPE_COPY.noteSaved(view.hire.name));
            }}
            onMissing={() => setMissing(true)}
          />
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}

/** *Back to Your New Hires* (`:3365-3368`, `.training-back-btn` `:1811-1816`): the prototype's chevron and words, as a link. */
function BackToRoster() {
  return (
    <Link
      href="/new-hires"
      className="mb-3.5 inline-flex items-center gap-1.5 py-1.5 text-base font-semibold text-navy-soft hover:text-navy"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {PROTOTYPE_COPY.back}
    </Link>
  );
}

/**
 * *Start date*, which a leader may correct (OD-118): the date field the hire's page draws, here, written
 * on change and audited by the server, within the contract's bounds — not after the office's today and
 * no more than a year before it. Beside it, who last corrected it and when.
 */
function StartDateField({
  view, reader, writable, onCommit, error, resetKey,
}: {
  view: ActivationView;
  reader: string | null | undefined;
  writable: boolean;
  onCommit: (startDate: string) => void;
  error: string | null;
  resetKey: number;
}) {
  const corrected = correctionOf(view, reader);
  if (!writable) {
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
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2">
        <label htmlFor="activation-start-date" className="whitespace-nowrap text-xs font-semibold text-navy">
          {PROTOTYPE_COPY.startDate}
        </label>
        <DateField
          id="activation-start-date"
          value={view.startDate}
          min={earliestStart(view.today)}
          max={view.today}
          allowed={(value) => startDateAllowed(value, view.today)}
          invalidText={startDateRangeText(view.today)}
          resetKey={resetKey}
          onCommit={(next) => { if (next) onCommit(next); }}
        />
        <AttributionMark words={corrected} />
      </div>
      <RowError message={error ?? undefined} />
    </div>
  );
}

/** How an activation that is over ended, in the subtitle's place (parity L-89). */
function closedLine(view: ActivationView, reader: string | null | undefined): string {
  return view.state === 'graduated'
    ? OWN_COPY.closedGraduated(
      view.graduatedBy ? (view.graduatedBy.membershipId === reader ? OWN_COPY.you : view.graduatedBy.name) : view.hire.name,
      view.graduatedAt ? formatOfficeDay(view.graduatedAt) : '',
    )
    : OWN_COPY.closedExpired(formatShortDay(view.endsOn, { year: true }));
}

/** A leader's row (`:6823-6840`): a box to tick for a manual item, *Auto* and inert for a live link. */
function HireItemRow({
  item, reader, writable, onTick, error,
}: {
  item: ActivationItemProgress;
  reader: string | null | undefined;
  writable: boolean;
  onTick: (done: boolean) => void;
  error: string | undefined;
}) {
  const manual = isManual(item);
  return (
    <div className={ITEM_ROW} data-code={item.code}>
      <div className="flex items-center gap-2.5">
        <label className={cn('flex min-w-0 items-center gap-2.5 text-md font-medium text-navy', manual && writable && 'cursor-pointer')}>
          <input
            type="checkbox"
            checked={item.done}
            disabled={!manual || !writable}
            onChange={(e) => onTick(e.target.checked)}
            className={ITEM_CHECKBOX}
          />
          <span>{item.label}</span>
        </label>
        {!manual && item.link && <AutoBadge link={item.link} />}
        {/* D-orphan (P18.5-T3 AC-4): a link that does not complete the item now — ticked by hand, as Settings says. */}
        {isTickedByHandLink(item) && <ByHandBadge />}
        <AttributionMark words={attributionOf(item, reader)} />
      </div>
      <RowError message={error} />
    </div>
  );
}

/**
 * *Coaching note* (`.notes-card`, `:3407-3414`; OD-117, T6 AC-1): the prototype's heading, hint,
 * example and button, verbatim. One note per hire, replaced on each save; beside the heading, who saved
 * the one there now and when, since any leader above the hire may write it (ADR-0074).
 */
function NoteCard({
  view, reader, writable, onSaved, onMissing,
}: {
  view: ActivationView;
  reader: string | null | undefined;
  writable: boolean;
  onSaved: (note: NonNullable<ActivationView['note']>) => void;
  onMissing: () => void;
}) {
  const [draft, setDraft] = useState(view.note?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedBy = view.note
    ? OWN_COPY.noteSavedBy(view.note.by.membershipId === reader ? OWN_COPY.you : view.note.by.name, formatOfficeDay(view.note.at))
    : null;

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      setError(OWN_COPY.noteEmpty);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { note } = await saveActivationNote(view.hire.membershipId, text);
      onSaved(note);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) onMissing();
      // Read as every other write on these pages reads a refusal (L-85): *Not saved. {why}*.
      setError(OWN_COPY.notSaved(toDisplayError(err).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="coaching-note" className="rounded-lg border border-hairline bg-card p-[18px]">
      <div className="flex items-center gap-1.5">
        <h2 id="coaching-note" className="font-display text-md font-bold text-navy">{PROTOTYPE_COPY.noteHeading}</h2>
        <AttributionMark words={savedBy} />
      </div>
      <p id="coaching-note-hint" className="mb-2.5 mt-1 text-sm text-muted">{PROTOTYPE_COPY.noteHint}</p>
      <Textarea
        aria-labelledby="coaching-note"
        aria-describedby="coaching-note-hint"
        value={draft}
        readOnly={!writable}
        maxLength={ACTIVATION_NOTE_MAX}
        placeholder={PROTOTYPE_COPY.noteExample}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        className="w-full resize-y text-md"
      />
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-alert">{error}</p>}
      {writable && (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? OWN_COPY.saving : PROTOTYPE_COPY.saveNote}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Outside the reader's reach, or no activation (T5 AC-8): the same words for each, naming nobody. */
function HireNotFound() {
  return (
    <div>
      <BackToRoster />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{OWN_COPY.hireNotFoundTitle}</h2>
        <p className="mt-1 text-md text-muted">{OWN_COPY.hireNotFoundLine}</p>
      </Card>
    </div>
  );
}
