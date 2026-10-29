'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import {
  AttributionMark, AutoBadge, ITEM_CHECKBOX, ITEM_ROW, RowError,
} from '@/components/activation-parts';
import { DateField } from '@/components/ui/date-field';
import { Button, TextInput } from '@/components/ui/field';
import { InlineSaveStatus, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { activationMessages } from '@/i18n/messages/activation';
import {
  attributionOf, isWholeDate, recordHref, sourceLineOf, takesHandWrite,
  type ActivationClosing, type ActivationItemProgress, type ActivationRecordInput,
} from '@/lib/activation';
import { toDisplayError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';

/** A lead's name and a note, at most: the contract's bound for the record's text. */
const RECORD_TEXT_MAX = 500;

/**
 * **A data-backed item's row** (P18.96-T4 AC-2 to AC-4; ADR-0171 §3; the client's report, UI-004): *Close first case
 * independently*, *Reach Independent Agent milestone* and *Weekly 1-on-1 check-in*, on the hire's `/activation` and the
 * leader's `/new-hires/[membershipId]` alike — one component, so the two cannot draw it two ways (AC-5).
 *
 * - **The prototype's row**: the box, the label and the *Auto* badge with what it waits for (`:6580`).
 * - **The source line**, under the label, once it is done (AC-2): *"Completed from Sales data · {date}"* or *"Completed
 *   from Coaching sessions · {date}"*, a link to the record where its reader has a page for it — or *"Ticked by {name},
 *   waiting for data"* (AC-4) for a tick its data has not confirmed, with the tick's own *"Ticked by {name} · {date}"*
 *   kept in the `ⓘ` beside the box. One line, the client's explicit request (parity I-464, I-466).
 * - **A hand tick opens its form in place** (AC-3) — *Which case?* or *Log 1:1* — and nothing is saved until it is
 *   sent: the tick and the record go in one request (`onSave`), and the box stays unticked if it fails. An untick of a
 *   tick saved by hand is saved at once; one the data completed is nobody's, and its box is inert.
 *
 * *Saving… → Saved ✓* beside the box, as on every row (P18.95-T1 AC-5; the client asked to keep it).
 *
 * **Closing the form leaves the reader where they were** (P18.96-T7 AC-2; UI-008): its *Save* or *Cancel* goes with
 * it, and the focus goes back to the box it opened from — or to the row, when the answer leaves the box inert — without
 * scrolling. Otherwise it fell to the page itself, and the next Tab started again from the top.
 *
 * **Its words are the catalogue's** (`i18n/messages/activation.ts`; P18.98-T4), its days written in the figures'
 * language.
 */
export function DataItemRow({
  item, reader, writable, audience, hireId, today, startDate, loadClosings, onSave, status, error,
}: {
  item: ActivationItemProgress;
  reader: string | null | undefined;
  writable: boolean;
  /** The hire's own page, or a leader's detail: which page the record's link opens. */
  audience: 'hire' | 'leader';
  hireId: string;
  /** The office's today and the join date: the record's day lies between them. */
  today: string;
  startDate: string;
  /** The member's closings, asked when *Which case?* opens. */
  loadClosings: () => Promise<ActivationClosing[]>;
  /** The write: an untick, or a tick with its record. Resolves `true` once it landed. */
  onSave: (done: boolean, record?: ActivationRecordInput) => Promise<boolean>;
  status: InlineSaveStatusProps;
  error: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const row = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  /** Set when the form closes, so the focus goes back once the row has drawn what the answer left. */
  const [refocus, setRefocus] = useState(0);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const editable = writable && takesHandWrite(item);
  const line = sourceLineOf(item, reader, language, figures);
  const href = recordHref(item, audience, hireId);
  // The tick's own history, kept beside the box while it waits: *"Ticked by {name} · {date}"*.
  const history = item.done && item.waiting ? attributionOf(item, reader, language, figures) : null;
  const form = item.link?.form ?? null;

  useEffect(() => {
    if (refocus === 0) return;
    // Only when the focus went with the form — to the page itself — never away from somewhere the reader moved it.
    const active = document.activeElement;
    if (active && active !== document.body && row.current && !row.current.contains(active)) return;
    const target = box.current && !box.current.disabled ? box.current : row.current;
    target?.focus({ preventScroll: true });
  }, [refocus]);

  const close = () => {
    setOpen(false);
    setRefocus((n) => n + 1);
  };
  const onBox = (checked: boolean) => {
    if (checked) {
      // The tick waits for its record: the form opens, and nothing is saved yet.
      setOpen(true);
      return;
    }
    setOpen(false);
    void onSave(false);
  };
  const submit = async (record: ActivationRecordInput) => {
    const landed = await onSave(true, record);
    if (landed) close();
    return landed;
  };

  return (
    // `tabIndex={-1}`: the focus's place when the form closes on a box the answer left inert — never in the Tab order.
    <div ref={row} tabIndex={-1} className={ITEM_ROW} data-code={item.code}>
      <div className="flex items-center gap-2.5">
        <label className={cn('flex min-w-0 items-center gap-2.5 text-md font-medium text-navy', editable && 'cursor-pointer')}>
          <input
            ref={box}
            type="checkbox"
            checked={item.done || open}
            disabled={!editable}
            onChange={(e) => onBox(e.target.checked)}
            className={ITEM_CHECKBOX}
          />
          <span>{item.label}</span>
        </label>
        {item.link && <AutoBadge link={item.link} />}
        <AttributionMark words={history} />
        <InlineSaveStatus {...status} label={item.label} />
      </div>
      {line && (
        <p className="ml-[26px] mt-1 text-xs text-muted" data-testid="source-line">
          {href
            ? <Link href={href} className="font-semibold text-navy-soft underline hover:text-navy">{line}</Link>
            : line}
        </p>
      )}
      {/* Kept while its write is out, so a refusal leaves what was typed in place to send again. */}
      {open && form === 'closing' && (
        <ClosingForm
          id={formId} label={item.label} today={today} startDate={startDate} loadClosings={loadClosings}
          onSubmit={submit} onCancel={close}
        />
      )}
      {open && form === 'one_on_one' && (
        <OneOnOneForm
          id={formId} label={item.label} today={today} startDate={startDate}
          onSubmit={submit} onCancel={close}
        />
      )}
      <RowError message={error} />
    </div>
  );
}

/** The form's frame: a fieldset under the row, named by its legend, its two buttons last. */
function RecordFrame({
  id, legend, children, onSave, onCancel, saving, problem,
}: {
  id: string;
  legend: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  problem: string | null;
}) {
  const t = useMessages(activationMessages);
  return (
    <fieldset id={id} className="ml-[26px] mt-2.5 flex min-w-0 flex-col gap-2.5 rounded-md border border-hairline bg-base p-3">
      <legend className="px-1 text-sm font-semibold text-navy">{legend}</legend>
      {children}
      {problem && <p role="alert" className="text-xs font-semibold text-alert">{problem}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving}>{saving ? t.saving : t.save}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>{t.cancel}</Button>
      </div>
    </fieldset>
  );
}

const FIELD_LABEL = 'text-xs font-semibold text-navy';

/**
 * ***Which case?*** (AC-3): one of the member's closings in Leads Management, or a new one — who it was sold to and the
 * day it was paid and issued, from the join date to today — logged in their leads with the tick.
 */
function ClosingForm({
  id, label, today, startDate, loadClosings, onSubmit, onCancel,
}: {
  id: string;
  label: string;
  today: string;
  startDate: string;
  loadClosings: () => Promise<ActivationClosing[]>;
  onSubmit: (record: ActivationRecordInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useMessages(activationMessages);
  const figures = useFigureLanguage();
  const [closings, setClosings] = useState<ActivationClosing[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>('new');
  const [name, setName] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const dateId = useId();
  const loader = useRef(loadClosings);

  useEffect(() => {
    let live = true;
    loader.current()
      .then((found) => {
        if (!live) return;
        setClosings(found);
        if (found.length > 0) setChoice(found[0].leadId);
      })
      .catch((err) => { if (live) { setClosings([]); setLoadError(toDisplayError(err).message); } });
    return () => { live = false; };
  }, []);
  useEffect(() => { first.current?.focus(); }, [closings]);

  const save = async () => {
    const record: ActivationRecordInput = choice === 'new'
      ? { kind: 'closing', name: name.trim(), date }
      : { kind: 'closing', leadId: choice };
    if (choice === 'new' && (!name.trim() || !isWholeDate(date))) {
      setProblem(t.recordIncomplete);
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      await onSubmit(record);
    } finally {
      setSaving(false);
    }
  };

  const group = `${id}-case`;
  return (
    <RecordFrame
      id={id} legend={t.whichCase} onSave={() => void save()} onCancel={onCancel} saving={saving} problem={problem}
    >
      <span className="sr-only">{label}</span>
      {closings === null && <Skeleton label={t.loadingClosings}><SkeletonText lines={2} /></Skeleton>}
      {loadError && <p role="alert" className="text-xs font-semibold text-alert">{t.notSaved({ why: loadError })}</p>}
      {closings !== null && closings.length === 0 && !loadError && <p className="text-sm text-muted">{t.noClosings}</p>}
      {closings?.map((closing, i) => (
        <label key={closing.leadId} className="flex items-center gap-2 text-md text-navy">
          <input
            ref={i === 0 ? first : undefined}
            type="radio"
            name={group}
            value={closing.leadId}
            checked={choice === closing.leadId}
            onChange={() => setChoice(closing.leadId)}
            className="h-4 w-4 accent-navy"
          />
          {closing.name} · {formatShortDay(closing.date, { year: true }, figures)}
        </label>
      ))}
      {closings !== null && (
        <label className="flex items-center gap-2 text-md text-navy">
          <input
            ref={closings.length === 0 ? first : undefined}
            type="radio"
            name={group}
            value="new"
            checked={choice === 'new'}
            onChange={() => setChoice('new')}
            className="h-4 w-4 accent-navy"
          />
          {t.newClosing}
        </label>
      )}
      {closings !== null && choice === 'new' && (
        <div className="ml-6 flex flex-wrap items-end gap-2.5">
          <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-1">
            <label htmlFor={nameId} className={FIELD_LABEL}>{t.closingName}</label>
            <TextInput
              id={nameId} value={name} maxLength={RECORD_TEXT_MAX}
              onChange={(e) => setName(e.target.value)} className="w-full"
            />
          </span>
          <span className="flex flex-col gap-1">
            <label htmlFor={dateId} className={FIELD_LABEL}>{t.closingDate}</label>
            <DateField id={dateId} value={date} min={startDate} max={today} onChange={setDate} className="w-[150px]" />
          </span>
        </div>
      )}
    </RecordFrame>
  );
}

/**
 * ***Log 1:1*** (AC-3): the day it was held, from the join date to today, and a note of what it covered. A leader's is
 * a coaching session with the hire; the hire's own, their date and note on the item.
 */
function OneOnOneForm({
  id, label, today, startDate, onSubmit, onCancel,
}: {
  id: string;
  label: string;
  today: string;
  startDate: string;
  onSubmit: (record: ActivationRecordInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const t = useMessages(activationMessages);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const dateId = useId();
  const noteId = useId();
  // Into the form it opened, for a keyboard and a screen reader alike.
  useEffect(() => { document.getElementById(noteId)?.focus(); }, [noteId]);

  const save = async () => {
    if (!note.trim() || !isWholeDate(date)) {
      setProblem(t.recordIncomplete);
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      await onSubmit({ kind: 'one_on_one', date, note: note.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordFrame
      id={id} legend={t.logOneOnOne} onSave={() => void save()} onCancel={onCancel} saving={saving} problem={problem}
    >
      <span className="sr-only">{label}</span>
      <div className="flex flex-wrap items-end gap-2.5">
        <span className="flex flex-col gap-1">
          <label htmlFor={dateId} className={FIELD_LABEL}>{t.oneOnOneDate}</label>
          <DateField id={dateId} value={date} min={startDate} max={today} onChange={setDate} className="w-[150px]" />
        </span>
        <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
          <label htmlFor={noteId} className={FIELD_LABEL}>{t.oneOnOneNote}</label>
          <TextInput
            id={noteId} value={note} maxLength={RECORD_TEXT_MAX}
            placeholder={t.oneOnOnePlaceholder} onChange={(e) => setNote(e.target.value)} className="w-full"
          />
        </span>
      </div>
    </RecordFrame>
  );
}
