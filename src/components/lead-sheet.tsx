'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { LeadContactButtons } from '@/components/contact-buttons';
import { PhoneNumberSheet } from '@/components/phone-number-sheet';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { DateField } from '@/components/ui/date-field';
import { Dialog } from '@/components/ui/dialog';
import { ErrorBanner, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SaveStateLabel, useSaveState } from '@/components/ui/save-state';
import { useToast } from '@/components/ui/toast';
import { useDestructiveAction } from '@/components/ui/destructive-action';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  createLead, deleteLead, readLead, setLeadOutcome, setLeadStatus, updateLead, LEAD_NAME_MIN,
  type Lead, type LeadMove, type LeadOutcome, type LeadType,
} from '@/lib/leads';
import { saveLeadPhone } from '@/lib/phone-number';
import { useCan, useSession } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';

/** What the sheet's form holds: every field a lead has that the sheet edits, as text where a box holds it. */
interface LeadForm {
  name: string;
  type: LeadType | null;
  statusCode: string | null;
  thisMonth: boolean;
  nextActionDate: string;
  nextActionNote: string;
  remarks: string;
  email: string;
  source: string;
}

const formOf = (lead: Lead | null): LeadForm => ({
  name: lead?.name ?? '',
  type: lead?.type ?? null,
  statusCode: lead?.statusCode ?? null,
  thisMonth: lead?.thisMonth ?? false,
  nextActionDate: lead?.nextActionDate ?? '',
  nextActionNote: lead?.nextActionNote ?? '',
  remarks: lead?.remarks ?? '',
  email: lead?.contact.email ?? '',
  source: lead?.source ?? '',
});

/** A box's text as the server keeps it: trimmed, and nothing as `null`. */
const stored = (text: string): string | null => (text.trim() === '' ? null : text.trim());

/** Two forms the same by what would be saved: a box's trailing space is not a change. */
const sameForm = (a: LeadForm, b: LeadForm) => (Object.keys(a) as (keyof LeadForm)[]).every((key) => {
  const x = a[key];
  const y = b[key];
  return typeof x === 'string' && typeof y === 'string' ? x.trim() === y.trim() : x === y;
});

/** The office's day an instant fell on, short: *27 Okt*. For a word on screen, never a computation over data. */
const shortDayOf = (iso: string, figures: Parameters<typeof formatShortDay>[2]) =>
  formatShortDay(dayInZone(OFFICE_TIME_ZONE, new Date(iso)), {}, figures);

/**
 * **The lead sheet** (UI V1, UI-105; D-19, D-07, D-01): one lead, or a new one, in a bottom sheet on a phone and a
 * tablet and a centred modal on a desktop (`ResponsiveSheet`). `/leads` opens it from a card and from its **+**; the
 * coaching session's leads open it too (`open`, `onClose`, `lead`, with `owner` for a coachee's new lead and `readOnly`
 * for a finalized session).
 *
 * - **The head**: the NAME in capitals, *stage · type* under it, the ✕. **The contact line** under it: the avatar, the
 *   WhatsApp number — a tap edits it (UI-081: *editable later in the lead sheet*) — and the WhatsApp button.
 * - **Jenis**: *Sales | Recruit*. Switching shows that type's stages with **the first one chosen** (the report); the
 *   server clears the stage and the month's commitment as it changes the type, and the sheet then sets the stage chosen.
 * - **Status as choice rows**, never a dropdown (D-07); *Closing / Rekrut bulan ini* beneath them, the lead's own
 *   commitment, once it has a type.
 * - **Tindakan berikutnya**: a date pill and the note, side by side. **Keterangan** here only — never on the card.
 * - **Hasil** for an open lead: *Tandai berhasil* at the ladder's last stage, *Tandai tidak berhasil* at any — each asks
 *   first. **Detail**: the name, the email and where the lead came from (`LeadDetailsDialog`'s fields, D-10's sheet).
 * - **Riwayat**: the stage moves the server kept (`GET /leads/:id`'s `history`) and the day the lead was added.
 * - **The pinned foot** (D-01): the save state above (*Belum disimpan* / *Tersimpan*), the white **Hapus** (red words,
 *   a bin, asks to confirm) left of **Simpan**. Hapus only where the reader may delete the lead — their own (`lead:delete`
 *   is `own`, roles §3.7); D-10: an action that is not available is not shown.
 *
 * **One explicit save** (the report's *Simpan* with its save state): the form holds the changes, and *Simpan* writes
 * them through the lead's own routes in order — the type, the stage, then the fields in one patch — each pinned by the
 * version the last answered (P11-T4 AC-3). A refusal stays in the sheet with the form as typed; a version another hand
 * moved re-reads the lead. Closing with unsaved changes asks first.
 */
export function LeadSheet({
  open,
  onClose,
  lead,
  owner,
  readOnly = false,
  offerDelete = true,
  onSaved,
  onDeleted,
  onClosedLead,
  focus,
}: {
  open: boolean;
  onClose: () => void;
  /** The lead to show, or `null` for a new one. */
  lead: Lead | null;
  /** A coachee's membership: a new lead goes into their pipeline (`POST /leads?owner=`). Absent, the reader's own. */
  owner?: string;
  /** A finalized session's lock: the sheet reads, and writes nothing. */
  readOnly?: boolean;
  /** Whether *Hapus* may be offered at all — the coaching session offers none (`lead:delete` is the owner's). */
  offerDelete?: boolean;
  /** After a save or a new number lands: the lead as the server now has it. */
  onSaved?: (lead: Lead) => void;
  onDeleted?: (id: string) => void;
  /** After *Tandai berhasil* or *Tandai tidak berhasil*: the lead has left the open list. */
  onClosedLead?: (lead: Lead) => void;
  /**
   * **Where the sheet opens**: `nextAction` scrolls to *Tindakan berikutnya* and puts the focus in its note — UI-062's
   * *Isi tindakan*, which opens the sheet to write the action it names. Absent, the sheet opens at its head.
   */
  focus?: 'nextAction';
}) {
  const t = useMessages(leadsMessages);
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const { me } = useSession();
  const canMarkOutcome = useCan('lead:mark_outcome');
  const canDelete = useCan('lead:delete');
  const { show } = useToast();
  const uid = useId();

  /** The lead as last answered: the prop, then its own read, then each save — so every write pins the newest version. */
  const [current, setCurrent] = useState<Lead | null>(lead);
  const [history, setHistory] = useState<LeadMove[] | null>(null);
  const [form, setForm] = useState<LeadForm>(() => formOf(lead));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nameError, setNameError] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [askingClose, setAskingClose] = useState(false);
  const [askingOutcome, setAskingOutcome] = useState<LeadOutcome | null>(null);

  const base = useMemo(() => formOf(current), [current]);
  const { state, dirty, guard } = useSaveState(form, base, { saving, warnOnLeave: open && !readOnly, compare: sameForm });
  const leadId = lead?.id ?? null;

  /* A sheet opened, or opened on another lead: the form starts from that lead, and its moves are asked for. */
  useEffect(() => {
    if (!open) return undefined;
    setCurrent(lead);
    setForm(formOf(lead));
    setHistory(null);
    setError(null);
    setNameError(false);
    // A new lead opens on its name box (the modal's own focus, run first, lands on its ✕); *Isi tindakan* on the note.
    if (!lead) {
      document.getElementById(`${uid}-name`)?.focus();
      return undefined;
    }
    if (focus === 'nextAction') {
      const note = document.getElementById(`${uid}-next-note`);
      note?.closest('fieldset')?.scrollIntoView?.({ block: 'center' });
      note?.focus();
    }
    let live = true;
    readLead(lead.id)
      .then((detail) => {
        if (!live) return;
        setHistory(detail.history ?? []);
        // A newer version keeps what the reader has typed: only the version, and a form not yet touched, follow it.
        setCurrent(detail);
        setForm((typed) => (sameForm(typed, formOf(lead)) ? formOf(detail) : typed));
      })
      .catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
    // The lead's id, not its object: the list re-renders with a new object for the same lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  const pipelines = config?.leadPipelines ?? [];
  const ladderFor = (type: LeadType | null): LeadStatusRow[] =>
    (type ? pipelines.find((p) => p.pipeline === type)?.statuses.filter((s) => s.status === 'active') ?? [] : []);
  const ladder = ladderFor(form.type);
  const stageName = (type: LeadType | null, code: string | null) =>
    (code ? pipelines.find((p) => p.pipeline === type)?.statuses.find((s) => s.code === code)?.label ?? t.retired({ code }) : null);
  /** A stage the office has retired, which the lead still holds: a row of its own, so the choice shows it. */
  const retiredRow = form.statusCode && !ladder.some((s) => s.code === form.statusCode) ? form.statusCode : null;

  const isNew = current === null;
  const mine = current ? current.ownerMembershipId === me?.membership?.membershipId : true;
  const savedTerminal = current?.statusCode
    ? ladderFor(current.type).find((s) => s.code === current.statusCode)?.isTerminal ?? false
    : false;
  const editable = !readOnly;
  const name = current?.name || form.name.trim() || t.sheet.newTitle;
  const typeWord = (type: LeadType | null) => (type ? t.types[type] : t.noType);
  const meta = current ? t.sheet.meta({
    stage: stageName(current.type, current.statusCode) ?? t.sheet.noStage,
    type: typeWord(current.type),
  }) : undefined;

  const change = (next: Partial<LeadForm>) => setForm((was) => ({ ...was, ...next }));

  /** The type switched: that ladder's stages, its first chosen; no commitment until it is saved again. */
  const switchType = (type: LeadType) => {
    if (type === form.type) return;
    change({ type, statusCode: ladderFor(type)[0]?.code ?? null, thisMonth: false });
  };

  /** A refusal that means the lead moved under the reader: read it again, and keep the form as typed. */
  async function caughtUp(err: unknown) {
    const shown = toDisplayError(err);
    setError(shown);
    if (current && (shown.code === 'VERSION_CONFLICT' || shown.code === 'LEAD_ALREADY_CLOSED')) {
      try {
        setCurrent(await readLead(current.id));
      } catch { /* the banner already says what happened */ }
    }
  }

  async function save() {
    if (saving || readOnly) return;
    if (form.name.trim().length < LEAD_NAME_MIN) {
      setNameError(true);
      document.getElementById(`${uid}-name`)?.focus();
      return;
    }
    setNameError(false);
    setSaving(true);
    setError(null);
    try {
      let saved: Lead;
      if (!current) {
        saved = await createLead({
          name: form.name.trim(),
          type: form.type,
          remarks: stored(form.remarks),
          nextActionDate: form.nextActionDate || null,
          nextActionNote: stored(form.nextActionNote),
          contact: { phone: null, email: stored(form.email) },
          source: stored(form.source),
          ...(form.type ? { thisMonth: form.thisMonth } : {}),
        }, owner);
        if (form.statusCode) saved = await setLeadStatus(saved.id, form.statusCode, saved.version);
      } else {
        saved = current;
        if (form.type !== current.type) saved = await updateLead(saved.id, { type: form.type }, saved.version);
        if (form.statusCode && form.statusCode !== saved.statusCode) {
          saved = await setLeadStatus(saved.id, form.statusCode, saved.version);
        }
        const patch: Record<string, unknown> = {};
        if (form.name.trim() !== saved.name) patch.name = form.name.trim();
        if (stored(form.remarks) !== saved.remarks) patch.remarks = stored(form.remarks);
        if ((form.nextActionDate || null) !== saved.nextActionDate) patch.nextActionDate = form.nextActionDate || null;
        if (stored(form.nextActionNote) !== saved.nextActionNote) patch.nextActionNote = stored(form.nextActionNote);
        if (stored(form.email) !== saved.contact.email) patch.contact = { phone: saved.contact.phone, email: stored(form.email) };
        if (stored(form.source) !== saved.source) patch.source = stored(form.source);
        if (form.type && form.thisMonth !== saved.thisMonth) patch.thisMonth = form.thisMonth;
        if (Object.keys(patch).length > 0) saved = await updateLead(saved.id, patch, saved.version);
      }
      setCurrent(saved);
      setForm(formOf(saved));
      onSaved?.(saved);
      show(t.sheet.saved);
      onClose();
    } catch (err) {
      await caughtUp(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      await deleteLead(current.id);
      onDeleted?.(current.id);
      show(t.sheet.deleted);
      setForm(formOf(current));
      onClose();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  }

  async function closeAs(outcome: LeadOutcome) {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const closed = await setLeadOutcome(current.id, outcome, current.version);
      onClosedLead?.(closed);
      show(t.notices.markedAs({ name: closed.name, outcome: t.outcomes[outcome] }));
      setCurrent(closed);
      setForm(formOf(closed));
      onClose();
    } catch (err) {
      await caughtUp(err);
    } finally {
      setSaving(false);
    }
  }

  const destructive = useDestructiveAction({
    label: t.sheet.delete,
    message: t.sheet.deleteAsk({ who: name }),
    confirmLabel: t.sheet.delete,
    onConfirm: () => void remove(),
    disabled: saving,
  });
  const offerHapus = !isNew && editable && offerDelete && canDelete && mine;
  const offerOutcome = !isNew && editable && canMarkOutcome && current?.outcome === null;

  /** Closing asks first when something typed would be lost. */
  const requestClose = () => {
    if (dirty && editable) setAskingClose(true);
    else onClose();
  };

  const LABEL = 'mb-1.5 mt-4 block text-xs font-bold text-muted';
  const PILL = 'min-h-12 w-full rounded-pill border-0 bg-hover-row px-4 text-md text-ink';

  const footer = editable ? (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pb-1">
      <SaveStateLabel state={isNew && !dirty ? 'unsaved' : state} className="w-full" />
      {offerHapus && (
        <button
          type="button"
          onClick={destructive.ask}
          disabled={saving}
          className={cn(
            'inline-flex min-h-[52px] shrink-0 items-center gap-1.5 rounded-pill border-[1.5px] border-line bg-card px-[18px]',
            'text-md font-bold text-pill-red-ink hover:bg-pill-red disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <LineIcon name="trash" className="h-5 w-5" />
          {t.sheet.delete}
        </button>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || (!isNew && !dirty)}
        className="min-h-[52px] min-w-0 flex-1 rounded-pill bg-navy px-5 text-md font-bold text-white hover:bg-navy-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t.sheet.save}
      </button>
    </div>
  ) : undefined;

  /** Riwayat, newest first: each move the server kept, then the day the lead was added. */
  const timeline = [
    ...[...(history ?? [])].reverse().map((move) => ({
      key: `${move.at}-${move.toStatusCode}`,
      day: shortDayOf(move.at, figures),
      at: move.at,
      // A code names one stage across both ladders, so a move made before a type change still reads by its name.
      text: t.sheet.moved({
        stage: pipelines.flatMap((p) => p.statuses).find((s) => s.code === move.toStatusCode)?.label ?? move.toStatusCode,
      }),
    })),
    ...(current?.dateRegistered ? [{
      key: 'added', day: shortDayOf(current.dateRegistered, figures), at: current.dateRegistered, text: t.sheet.added,
    }] : []),
  ];

  return (
    <>
      <ResponsiveSheet
        open={open}
        title={isNew ? t.sheet.newTitle : name}
        description={meta}
        onClose={requestClose}
        footer={footer}
        className="[&_[data-modal-head]_h2]:uppercase"
      >
        <div data-lead-sheet="" className="pb-2">
          {!isNew && current && (
            <div className="flex items-center gap-2.5">
              <Avatar name={current.name} seed={current.id} size={44} />
              {editable ? (
                <button
                  type="button"
                  onClick={() => setEditingPhone(true)}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-row text-left hover:bg-hover-row"
                >
                  <span className="text-xs font-bold text-muted">{t.sheet.phone}</span>
                  <span className="flex items-center gap-1.5 truncate text-md text-ink">
                    {current.contact.phone || <span className="text-signal-grey">{t.sheet.phone}</span>}
                    <LineIcon name="pencil" className="h-4 w-4 shrink-0 text-signal-grey" />
                  </span>
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-md text-ink">{current.contact.phone ?? ''}</span>
              )}
              <LeadContactButtons
                lead={current}
                channels={['whatsapp']}
                onSaved={(next) => { setCurrent(next); onSaved?.(next); }}
              />
            </div>
          )}

          {isNew && (
            <>
              <label htmlFor={`${uid}-name`} className={cn(LABEL, 'mt-0')}>{t.sheet.name}</label>
              <TextInput
                id={`${uid}-name`}
                value={form.name}
                maxLength={120}
                invalid={nameError}
                aria-describedby={nameError ? `${uid}-name-error` : undefined}
                placeholder={t.namePlaceholder}
                onChange={(e) => change({ name: e.target.value })}
                className={PILL}
              />
              {nameError && (
                <p id={`${uid}-name-error`} className="mt-1 text-sm text-signal-red">{t.shortName({ min: LEAD_NAME_MIN })}</p>
              )}
            </>
          )}

          <fieldset disabled={!editable || saving}>
            <legend className={LABEL}>{t.sheet.type}</legend>
            <div role="radiogroup" aria-label={t.sheet.type} className="flex h-11 rounded-pill bg-hover-row p-[3px]">
              {(['sales', 'recruitment'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={form.type === type}
                  onClick={() => switchType(type)}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-pill text-md font-semibold',
                    form.type === type ? 'bg-navy text-white' : 'text-muted hover:text-navy',
                  )}
                >
                  {t.types[type]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={!editable || saving}>
            <legend className={LABEL}>{t.sheet.status}</legend>
            {form.type === null ? (
              <p className="text-base text-muted">{t.sheet.chooseTypeFirst}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {[...ladder.map((s) => ({ code: s.code, label: s.label })),
                  ...(retiredRow ? [{ code: retiredRow, label: t.retired({ code: retiredRow }) }] : [])].map((stage) => {
                  const chosen = form.statusCode === stage.code;
                  return (
                    <label
                      key={stage.code}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-row px-3 text-md text-ink',
                        chosen ? 'bg-amber/[0.12] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-amber)]' : 'bg-hover-row',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${uid}-status`}
                        value={stage.code}
                        checked={chosen}
                        onChange={() => change({ statusCode: stage.code })}
                        className="h-[18px] w-[18px] shrink-0 accent-amber"
                      />
                      {stage.label}
                    </label>
                  );
                })}
                <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5 px-1 text-md text-ink">
                  <input
                    type="checkbox"
                    checked={form.thisMonth}
                    onChange={(e) => change({ thisMonth: e.target.checked })}
                    className="h-5 w-5 shrink-0 accent-amber"
                  />
                  {form.type === 'recruitment' ? t.recruitThisMonth : t.closeThisMonth}
                </label>
              </div>
            )}
          </fieldset>

          <fieldset disabled={!editable || saving}>
            <legend className={LABEL}>{t.sheet.nextAction}</legend>
            <div className="flex gap-2">
              <DateField
                aria-label={t.sheet.nextActionDate}
                value={form.nextActionDate}
                onChange={(day) => change({ nextActionDate: day })}
                glyph="start"
                emptyText={t.sheet.pickDate}
                format={(day, language) => formatShortDay(day, { year: day.slice(0, 4) !== dayInZone(OFFICE_TIME_ZONE, new Date()).slice(0, 4) }, language)}
                className="w-[7.5rem] shrink-0"
                faceClassName="min-h-12 rounded-pill border-0 bg-hover-row px-4 text-md"
              />
              <TextInput
                id={`${uid}-next-note`}
                aria-label={t.nextActionNote}
                value={form.nextActionNote}
                placeholder={t.sheet.notePlaceholder}
                maxLength={500}
                onChange={(e) => change({ nextActionNote: e.target.value })}
                className={cn(PILL, 'min-w-0 flex-1')}
              />
            </div>
          </fieldset>

          <label htmlFor={`${uid}-remarks`} className={LABEL}>{t.sheet.remarks}</label>
          <AutoGrowTextarea
            id={`${uid}-remarks`}
            value={form.remarks}
            maxLength={2000}
            disabled={!editable || saving}
            onChange={(e) => change({ remarks: e.target.value })}
            className="min-h-12 w-full rounded-row border-0 bg-hover-row px-4 py-3 text-md text-ink"
          />

          {offerOutcome && (
            <>
              <p className={LABEL}>{t.sheet.outcome}</p>
              <div className="flex flex-wrap gap-2">
                {savedTerminal && (
                  <button
                    type="button"
                    disabled={saving || dirty}
                    onClick={() => setAskingOutcome('won')}
                    className="min-h-11 rounded-pill bg-pill-green px-4 text-md font-semibold text-pill-green-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.menu.markWon}
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving || dirty}
                  onClick={() => setAskingOutcome('lost')}
                  className="min-h-11 rounded-pill bg-pill-grey px-4 text-md font-semibold text-pill-grey-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.menu.markLost}
                </button>
              </div>
            </>
          )}

          <fieldset disabled={!editable || saving}>
            <legend className={LABEL}>{t.sheet.details}</legend>
            <div className="flex flex-col gap-2">
              {!isNew && (
                <>
                  <TextInput
                    id={`${uid}-name`}
                    aria-label={t.sheet.name}
                    value={form.name}
                    maxLength={120}
                    invalid={nameError}
                    aria-describedby={nameError ? `${uid}-name-error` : undefined}
                    onChange={(e) => change({ name: e.target.value })}
                    className={PILL}
                  />
                  {nameError && (
                    <p id={`${uid}-name-error`} className="text-sm text-signal-red">{t.shortName({ min: LEAD_NAME_MIN })}</p>
                  )}
                </>
              )}
              <TextInput
                type="email"
                aria-label={t.sheet.email}
                placeholder={t.sheet.email}
                value={form.email}
                onChange={(e) => change({ email: e.target.value })}
                className={PILL}
              />
              <TextInput
                aria-label={t.sheet.source}
                placeholder={t.details.sourcePlaceholder}
                value={form.source}
                onChange={(e) => change({ source: e.target.value })}
                className={PILL}
              />
            </div>
          </fieldset>

          {!isNew && (
            <section aria-labelledby={`${uid}-history`}>
              <h3 id={`${uid}-history`} className={LABEL}>{t.sheet.history}</h3>
              {history === null ? (
                <p className="text-base text-muted">{t.sheet.historyLoading}</p>
              ) : (
                <ol className="flex flex-col gap-2 pl-4 text-base text-ink">
                  {timeline.map((entry) => (
                    <li key={entry.key} className="relative">
                      <span aria-hidden="true" className="absolute -left-4 top-[5px] h-2 w-2 rounded-[2px] bg-amber" />
                      <time dateTime={entry.at} className="font-bold">{entry.day}</time> · {entry.text}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
        </div>
      </ResponsiveSheet>

      {current && editable && (
        <PhoneNumberSheet
          key={`${current.id}-${current.contact.phone ?? ''}`}
          open={editingPhone}
          name={current.name}
          phone={current.contact.phone}
          then={null}
          onClose={() => setEditingPhone(false)}
          onSave={async (phone) => {
            const next = await saveLeadPhone(current, phone);
            setCurrent(next);
            onSaved?.(next);
            return next.contact.phone ?? phone;
          }}
          onSaved={() => {
            setEditingPhone(false);
            show(t.sheet.saved);
          }}
        />
      )}

      {destructive.dialog}
      <Dialog
        open={askingClose}
        message={t.sheet.discard}
        confirmLabel={t.sheet.discardConfirm}
        tone="danger"
        onCancel={() => setAskingClose(false)}
        onConfirm={() => {
          setAskingClose(false);
          setForm(base);
          onClose();
        }}
      />
      <Dialog
        open={askingOutcome !== null}
        message={askingOutcome === 'won' ? t.confirm.won({ who: name }) : t.confirm.lost({ who: name })}
        confirmLabel={askingOutcome ? t.menu[askingOutcome === 'won' ? 'markWon' : 'markLost'] : ''}
        tone={askingOutcome === 'lost' ? 'danger' : undefined}
        onCancel={() => setAskingOutcome(null)}
        onConfirm={() => {
          const outcome = askingOutcome;
          setAskingOutcome(null);
          if (outcome) void closeAs(outcome);
        }}
      />
      {open && guard}
    </>
  );
}
