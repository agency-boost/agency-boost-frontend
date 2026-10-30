'use client';

import { useId, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, Switch, Textarea, TextInput } from '@/components/ui/field';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  calendarWordsIn, createEntry, ENTRY_TYPES, initialsOf, INVITEES_MAX, placeBlock, readEntry, updateEntry,
  type CalendarEntry, type EntryType,
} from '@/lib/calendar';
import {
  blankForm, formFromEntry, formWords, toInput, validateForm, violationsToErrors, type EntryForm, type FormErrors, type Slot,
} from '@/lib/calendar-form';
import { cn } from '@/lib/cn';
import { Avatar } from './calendar-parts';
import { InviteField, type Picked } from './invite-field';

/** What the entry dialog is opened for (`openEventModal`, `:708-773`). */
export type EditorState =
  /**
   * `preset`: the new entry opened for somebody — `/new-hires`' *Schedule 1:1* (P18.96-T6 AC-4), a *1:1 coaching* entry
   * titled with their name and them invited. Every field can still be changed.
   */
  | { mode: 'new'; slot: Slot; preset?: { type: EntryType; title: string; invitee: Picked | null } }
  | { mode: 'edit'; entry: CalendarEntry }
  /** *Block time* on a member the reader coaches (ADR-0098), from a compared pane. */
  | { mode: 'block'; slot: Slot; member: Picked };

const pickedOf = (entry: CalendarEntry, placed: boolean): Picked[] =>
  entry.invitees.filter((i) => i.placed === placed).map(({ membershipId, name }) => ({ membershipId, name }));

function initial(state: EditorState, language: Language): EntryForm {
  if (state.mode === 'edit') return formFromEntry(state.entry);
  // *Block time* presets *1:1 coaching* and *"1:1 with {full name}"* — the full name where the
  // prototype has the first (`:748`), as L-65 settled for coaching. Both can be changed. Written once, in the
  // writer's words, into a field they then save as typed.
  if (state.mode === 'block') return blankForm(state.slot, 'coaching', calendarWordsIn(language).oneOnOneWith({ name: state.member.name }));
  if (state.preset) return blankForm(state.slot, state.preset.type, state.preset.title);
  return blankForm(state.slot);
}

/**
 * The entry dialog: *New event*, *Edit event* and *Block time — {name}* (`Calendar_Section.html:354-420`,
 * `:686-815`; P12-T2 AC-4, AC-5, AC-8; P12-T4; P12-T5 AC-6).
 *
 * **Mounted afresh for every open**, so every field starts from its seed (contradiction 18). The
 * fields are the prototype's, in its order: *Type*, *Title*, *Invite*, the timing its type needs —
 * *Date*, *Start* and *End*, or Travel's *Departure date* and *Return date* — and *Notes / location*,
 * whose placeholder asks for nothing more than the prototype's (ADR-0093).
 *
 * **Nothing is saved that the server would refuse unseen**: each rule says what is wrong under its own
 * field, a stale edit reads the entry again and says so, and an invitee who can no longer be invited is
 * marked on their chip. A failed save keeps the dialog open (L-01, a Fill). **No toast**: the page moves
 * to the week holding the entry and draws it, as the prototype's edit does (`:801`).
 */
export function EntryDialog({
  state,
  onClose,
  onSaved,
}: {
  state: EditorState;
  onClose: () => void;
  /** The entry saved, and in an edit the entry as last read before it: who was on it then. */
  onSaved: (entry: CalendarEntry, before: CalendarEntry | null) => void;
}) {
  const t = useMessages(calendarMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const words = formWords(language, figures);
  const ids = useId();
  const [form, setForm] = useState<EntryForm>(() => initial(state, language));
  const [invitees, setInvitees] = useState<Picked[]>(() => (state.mode === 'edit' ? pickedOf(state.entry, false)
    : state.mode === 'new' && state.preset?.invitee ? [state.preset.invitee] : []));
  // An edit's entry as last read: its version is what the save is pinned to, and its people are
  // whose calendars the save may take it off.
  const [base, setBase] = useState<CalendarEntry | null>(state.mode === 'edit' ? state.entry : null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refused, setRefused] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // The member a block is placed on is on it for good: no ✕, and never in the invitation list.
  const fixed: Picked[] = state.mode === 'block' ? [state.member] : state.mode === 'edit' ? pickedOf(state.entry, true) : [];

  const set = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const travel = form.type === 'travel';

  const title = state.mode === 'edit' ? t.editTitle
    : state.mode === 'block' ? t.blockTitle({ name: state.member.name })
      : t.newTitle;
  const description = state.mode === 'edit' ? t.editSub
    : state.mode === 'block' ? t.blockSub
      : t.newSub;

  async function save(e: FormEvent) {
    e.preventDefault();
    const problems = validateForm(form, invitees.length, words);
    setErrors(problems);
    setBanner(null);
    setNotice(null);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    const input = toInput(form, invitees.map((p) => p.membershipId));
    try {
      const saved = state.mode === 'edit'
        ? await updateEntry(state.entry.entryId, { ...input, version: base?.version ?? state.entry.version })
        : state.mode === 'block'
          ? await placeBlock({ ...input, membershipId: state.member.membershipId })
          : await createEntry(input);
      onSaved(saved, base);
    } catch (err) {
      await refusal(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function refusal(error: ApiError) {
    if (error.code === 'VERSION_CONFLICT' && state.mode === 'edit') {
      // Somebody else saved first: read it again, and say so (P12-T2 AC-8).
      try {
        const fresh = await readEntry(state.entry.entryId);
        setForm(formFromEntry(fresh));
        setInvitees(pickedOf(fresh, false));
        setBase(fresh);
        setNotice(t.conflict);
      } catch (again) {
        setBanner(toDisplayError(again));
      }
      return;
    }
    const placed = error.code === 'VALIDATION_FAILED' ? violationsToErrors(error.details, words) : null;
    if (placed) {
      setErrors(placed);
      return;
    }
    const gone = error.details?.inviteeIds;
    if (error.code === 'NOT_FOUND' && Array.isArray(gone) && gone.length > 0) {
      setRefused(new Set(gone.map(String)));
      setNotice(t.notInvitable);
      return;
    }
    setBanner(error);
  }

  const typeLabel = `${ids}-type`;

  return (
    <Modal
      open
      title={title}
      description={description}
      onClose={onClose}
      className="max-w-[420px]"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" form={`${ids}-form`} disabled={busy}>{t.saveEvent}</Button>
        </div>
      )}
    >
      <form id={`${ids}-form`} onSubmit={save} noValidate className="flex flex-col gap-[13px]">
        {state.mode === 'block' && (
          // The note, without the prototype's *" — they'll get a request to accept."* (ADR-0098): a block
          // is a placement, not a request.
          <div className="flex items-center gap-2 rounded-[9px] border border-hairline bg-base px-[11px] py-[9px] text-sm text-navy">
            <Avatar initials={initialsOf(state.member.name)} className="h-[22px] w-[22px]" />
            <span>
              {t.inviting({ name: <strong>{state.member.name}</strong> })}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p id={typeLabel} className="text-sm font-semibold text-navy">{t.type}</p>
          <div role="group" aria-labelledby={typeLabel} className="flex flex-wrap gap-1.5">
            {ENTRY_TYPES.map((type) => (
              <TypeButton key={type} type={type} on={form.type === type} onPick={() => set('type', type)} />
            ))}
          </div>
        </div>

        <Field label={t.fieldTitle} htmlFor={`${ids}-title`} error={errors.title}>
          <TextInput
            id={`${ids}-title`}
            value={form.title}
            invalid={!!errors.title}
            placeholder={t.titlePlaceholder}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <InviteField
          id={`${ids}-invite`}
          chosen={invitees}
          fixed={fixed}
          refused={refused}
          error={errors.invitees}
          onAdd={(person) => {
            if (invitees.some((p) => p.membershipId === person.membershipId)) return;
            // At most fifty (P12-T4 AC-1): the fifty-first is not added, and the field says why.
            if (invitees.length >= INVITEES_MAX) {
              setErrors((current) => ({ ...current, invitees: words.tooManyInvitees }));
              return;
            }
            setInvitees([...invitees, person]);
          }}
          onRemove={(membershipId) => {
            setInvitees(invitees.filter((p) => p.membershipId !== membershipId));
            setErrors((current) => ({ ...current, invitees: undefined }));
            setRefused((now) => new Set([...now].filter((id) => id !== membershipId)));
          }}
        />

        {travel && (
          // *Sepanjang hari* (UI V1, UI-104 point 8): on by default — the two dates; off — a date and a time on each.
          <Switch id={`${ids}-all-day`} label={t.allDay} checked={form.allDay} onChange={(on) => set('allDay', on)} phoneTarget />
        )}
        {travel && form.allDay ? (
          <div className="flex flex-wrap gap-2.5">
            <Field label={t.departure} htmlFor={`${ids}-starts`} error={errors.startsOn} className="min-w-[8rem] flex-1">
              <DateField id={`${ids}-starts`} value={form.startsOn} invalid={!!errors.startsOn} onChange={(v) => set('startsOn', v)} className="w-full" />
            </Field>
            <Field label={t.return} htmlFor={`${ids}-ends`} error={errors.endsOn} className="min-w-[8rem] flex-1">
              <DateField id={`${ids}-ends`} value={form.endsOn} invalid={!!errors.endsOn} onChange={(v) => set('endsOn', v)} className="w-full" />
            </Field>
          </div>
        ) : travel ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2.5">
              <Field label={t.startDate} htmlFor={`${ids}-starts`} error={errors.startsOn} className="min-w-[8rem] flex-[1.4]">
                <DateField id={`${ids}-starts`} value={form.startsOn} invalid={!!errors.startsOn} onChange={(v) => set('startsOn', v)} className="w-full" />
              </Field>
              <Field label={t.start} htmlFor={`${ids}-start`} className="min-w-[6rem] flex-1">
                <TextInput id={`${ids}-start`} type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Field label={t.endDate} htmlFor={`${ids}-ends`} error={errors.endsOn} className="min-w-[8rem] flex-[1.4]">
                <DateField id={`${ids}-ends`} value={form.endsOn} invalid={!!errors.endsOn} onChange={(v) => set('endsOn', v)} className="w-full" />
              </Field>
              <Field label={t.end} htmlFor={`${ids}-end`} error={errors.end} className="min-w-[6rem] flex-1">
                <TextInput id={`${ids}-end`} type="time" value={form.end} invalid={!!errors.end} onChange={(e) => set('end', e.target.value)} />
              </Field>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <Field label={t.date} htmlFor={`${ids}-date`} error={errors.date} className="min-w-[8rem] flex-[1.4]">
              <DateField id={`${ids}-date`} value={form.date} invalid={!!errors.date} onChange={(v) => set('date', v)} className="w-full" />
            </Field>
            <Field label={t.start} htmlFor={`${ids}-start`} className="min-w-[6rem] flex-1">
              <TextInput id={`${ids}-start`} type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
            </Field>
            <Field label={t.end} htmlFor={`${ids}-end`} error={errors.end} className="min-w-[6rem] flex-1">
              <TextInput id={`${ids}-end`} type="time" value={form.end} invalid={!!errors.end} onChange={(e) => set('end', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label={t.notesLabel} htmlFor={`${ids}-notes`} error={errors.notes}>
          <Textarea
            id={`${ids}-notes`}
            rows={2}
            value={form.notes}
            invalid={!!errors.notes}
            placeholder={t.notesPlaceholder}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        {notice && <p role="status" className="text-md font-semibold text-navy">{notice}</p>}
        {banner && <ErrorBanner {...banner} />}
      </form>
    </Modal>
  );
}

/** One of the five (`:367-376`): navy when chosen, teal for a chosen *Travel* (`:193-194`). */
function TypeButton({ type, on, onPick }: { type: EntryType; on: boolean; onPick: () => void }) {
  const t = useMessages(calendarMessages);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={cn(
        'min-w-[88px] flex-[1_1_30%] rounded-[7px] border-[1.3px] px-1 py-2 text-sm font-semibold',
        on
          ? type === 'travel' ? 'border-teal bg-teal text-white' : 'border-navy bg-navy text-white'
          : 'border-hairline bg-card text-muted hover:text-navy',
      )}
    >
      {t.types[type]}
    </button>
  );
}
