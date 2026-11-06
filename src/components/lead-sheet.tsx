'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { LeadContactButtons } from '@/components/contact-buttons';
import { PhoneNumberSheet } from '@/components/phone-number-sheet';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { DateField } from '@/components/ui/date-field';
import { Dialog } from '@/components/ui/dialog';
import { ErrorBanner, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/avatar';
import { TonePill } from '@/components/ui/tone-pill';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SaveStateLabel, useSaveState } from '@/components/ui/save-state';
import { useToast } from '@/components/ui/toast';
import { useDestructiveAction } from '@/components/ui/destructive-action';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { dayInZone, formatMoneyInFull, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  ageOfText, createLead, deleteLead, finalStageOf, readLead, setLeadOutcome, setLeadStatus, updateLead, LEAD_AGE_MAX,
  LEAD_AGE_MIN, LEAD_NAME_MIN, type Lead, type LeadGender, type LeadHistoryEntry, type LeadOutcome, type LeadType,
} from '@/lib/leads';
import { listProposals, newProposalHref, proposalHref, type ProposalRow } from '@/lib/proposals';
import { LeadPills } from '@/components/lead-card';
import { AgeStepper, GenderButtons } from '@/components/client-age-gender';
import { PotensiSwitch } from '@/components/potensi-switch';
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
  /** *Umur ulang tahun berikutnya*, as the box holds it: digits, or empty (P19.7-T1 AC-1). */
  age: string;
  gender: LeadGender | null;
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
  // The server's reading of today's age (ADR-0224 §2): saving it unchanged moves nothing.
  age: lead?.age == null ? '' : String(lead.age),
  gender: lead?.gender ?? null,
});

/** Whether a typed age is one the API takes: empty, or a whole number from 1 to 100. */
const ageAllowed = (text: string) => {
  const age = ageOfText(text);
  return age === null || (Number.isInteger(age) && age >= LEAD_AGE_MIN && age <= LEAD_AGE_MAX);
};

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
 * - **Status as choice rows**, never a dropdown (D-07); beneath them, once the lead has a type, **the *Potensi* switch**
 *   (P19.1-T2, UI-153): *Potensi closing / rekrut bulan ini*, the lead's own commitment for the month, a 44px switch card.
 * - **Tindakan berikutnya**: a date pill and the note, side by side. **Keterangan** here only — never on the card.
 * - **Hasil** for an open lead (P19.1-T2, UI-160): *Tandai berhasil* and *Tandai tidak berhasil* side by side, always —
 *   the first at the office's final stage, the second below it, each held otherwise with the reason; each asks first. **Detail**: the name, the email and where the lead came from (`LeadDetailsDialog`'s fields, D-10's sheet).
 * - **Proposal** (P19.7-T2 AC-12; ADR-0221 §6), above *Riwayat*, on the reader's own lead alone: each of its proposals
 *   — the day, the products with their plan, the premium per currency, *Draf* or *Selesai* — a tap opening it at its
 *   step 3, and ***+ Buat proposal*** with this lead chosen. A leader reading a downline's lead sees none (decision 4).
 * - **Riwayat**: the stage moves the server kept (`GET /leads/:id`'s `history`) and the day the lead was added — and,
 *   on the owner's own lead, *"Proposal dibuat · {produk}"* for each proposal first saved as a PDF (AC-11), linked
 *   while that proposal exists.
 * - **The pinned foot** (D-01): the save state above (*Belum disimpan* / *Tersimpan*), the white **Hapus** (red words,
 *   a bin, asks to confirm) left of **Simpan**. Hapus only where the reader may delete the lead — their own (`lead:delete`
 *   is `own`, roles §3.7); D-10: an action that is not available is not shown.
 * - **The calendar's *Hapus tugas*** (`offerClearTask`; the staging review of 2026-10-31), in Hapus's place, which the
 *   calendar never offers: the reader's own open lead's next action — its date and note, the calendar's and Home's task —
 *   cleared through `PATCH /leads/:id`, pinned, after the same kind of question. The lead stays. What else is typed in
 *   the sheet stays typed: the sheet closes only when nothing else is left unsaved.
 *
 * **One explicit save** (the report's *Simpan* with its save state): the form holds the changes, and *Simpan* writes
 * them through the lead's own routes in order — the type, the stage, then the fields in one patch — each pinned by the
 * version the last answered (P11-T4 AC-3). A refusal stays in the sheet with the form as typed; a version another hand
 * moved re-reads the lead. Closing with unsaved changes asks first.
 *
 * **The same lead as a pane, from 1024px** (P19.1-T2 AC-3, UI-116): `LeadPane` — one editor, two frames.
 */
export function LeadSheet(props: LeadEditorProps) {
  return <LeadEditor {...props} variant="sheet" />;
}

/**
 * **The lead sheet as a pane** (P19.1-T2 AC-3, AC-4; UI-116; `leads-tablet-desktop` frames 1 and 1b): `/leads` from
 * 1024px, beside the list, *like WhatsApp*. **The sheet's own editor in another frame** — every field, rule, write and
 * question is `LeadSheet`'s; what the frame changes:
 *
 * - **The head**: the 48px avatar, the NAME (18px, 800), the type and stage pills (`LeadPills`, the card's), and
 *   WhatsApp on the right — where the sheet has the NAME, *stage · type* and a ✕. The WhatsApp number the sheet edits on
 *   its contact line (UI-081) is a line of its own under the head.
 * - **The status choices two to a row** (the report: *status choice rows 2 per row*).
 * - **The foot**: *Hapus* left, *Tersimpan ✓* (the save state), *Simpan* right — and **a save leaves the pane open**, the
 *   save state saying *Tersimpan ✓* where the sheet closes with a toast.
 * - ***Terakhir diubah oleh {name}*** under *Riwayat* when the last change was not the owner's (ADR-0044, F-63): the lead
 *   details dialog's line, which the table's ⋮ opened on a desktop until UI-116 (P13.1-T4 AC-2, the client's request of
 *   2026-10-07). A phone's sheet never had it.
 * - **No ✕**: the list closes it — another card, Escape — and asks first when there are unsaved changes, which the pane
 *   reports through `onDirtyChange`.
 */
export function LeadPane(props: Omit<LeadEditorProps, 'open' | 'focus' | 'offerClearTask'> & {
  /** Whether the pane holds changes not yet saved — the list asks before another card or Escape discards them. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  return <LeadEditor {...props} open variant="pane" />;
}

interface LeadEditorProps {
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
  /** The calendar's: *Hapus tugas*, clearing the reader's own lead's next action (never somebody else's). */
  offerClearTask?: boolean;
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
}

/** One lead's editor, in the sheet's frame or the pane's (`LeadSheet`, `LeadPane`). */
function LeadEditor({
  open,
  onClose,
  lead,
  owner,
  readOnly = false,
  offerDelete = true,
  offerClearTask = false,
  onSaved,
  onDeleted,
  onClosedLead,
  focus,
  variant,
  onDirtyChange,
}: LeadEditorProps & { variant: 'sheet' | 'pane'; onDirtyChange?: (dirty: boolean) => void }) {
  const pane = variant === 'pane';
  const t = useMessages(leadsMessages);
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const { me } = useSession();
  const canMarkOutcome = useCan('lead:mark_outcome');
  const canDelete = useCan('lead:delete');
  const canUpdate = useCan('lead:update');
  const canReadProposals = useCan('proposal:read');
  const canCreateProposal = useCan('proposal:create');
  const { show } = useToast();
  const uid = useId();

  /** The lead as last answered: the prop, then its own read, then each save — so every write pins the newest version. */
  const [current, setCurrent] = useState<Lead | null>(lead);
  const [history, setHistory] = useState<LeadHistoryEntry[] | null>(null);
  /** The lead's proposals (P19.7-T2 AC-12): `null` until read; read only on the reader's own lead. */
  const [proposals, setProposals] = useState<ProposalRow[] | null>(null);
  const [proposalsError, setProposalsError] = useState<ApiError | null>(null);
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

  /* The pane tells the list what another card or Escape would discard (AC-4). */
  const unsaved = dirty && !readOnly;
  useEffect(() => { onDirtyChange?.(unsaved); }, [unsaved, onDirtyChange]);
  // A pane taken away — its lead deleted or closed — leaves nothing behind to ask about.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  // *+ Tambah lead* in the pane: the name box takes the focus once it is drawn (the pane was showing a lead until now).
  const blank = current === null;
  useEffect(() => {
    if (pane && blank) document.getElementById(`${uid}-name`)?.focus();
  }, [pane, blank, uid]);

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
  /*
   * **The lead's proposals, on the reader's own lead** (P19.7-T2 AC-12; ADR-0221 §6): `GET /proposals?leadId=`, read when
   * the sheet opens on it. Never on somebody else's — the server answers none to a leader, and the section is not drawn.
   */
  const proposalLeadId = current !== null && mine && canReadProposals ? current.id : null;
  useEffect(() => {
    setProposals(null);
    setProposalsError(null);
    if (!open || proposalLeadId === null) return undefined;
    let live = true;
    listProposals({ leadId: proposalLeadId, pageSize: 50 })
      .then((page) => { if (live) setProposals(page.rows); })
      .catch((err) => { if (live) setProposalsError(toDisplayError(err)); });
    return () => { live = false; };
  }, [open, proposalLeadId]);
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
    // An age outside 1–100 is said under the box, and the API would refuse it too (P19.7-T1 AC-1).
    if (!ageAllowed(form.age)) {
      document.getElementById(`${uid}-age`)?.focus();
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
          ...(ageOfText(form.age) !== null ? { age: ageOfText(form.age) } : {}),
          ...(form.gender ? { gender: form.gender } : {}),
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
        // Sent only when changed from today's reading, so the day it was recorded stays put (ADR-0224 §3).
        if (ageOfText(form.age) !== (saved.age ?? null)) patch.age = ageOfText(form.age);
        if (form.gender !== (saved.gender ?? null)) patch.gender = form.gender;
        if (Object.keys(patch).length > 0) saved = await updateLead(saved.id, patch, saved.version);
      }
      setCurrent(saved);
      setForm(formOf(saved));
      onSaved?.(saved);
      // The pane stays on the lead, its foot saying *Tersimpan ✓* (AC-4); the sheet closes, and the toast says it.
      if (!pane) {
        show(t.sheet.saved);
        onClose();
      }
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

  /** *Hapus tugas*: the next action cleared and nothing else, pinned to the version last read. */
  async function clearTask() {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const cleared = await updateLead(current.id, { nextActionDate: null, nextActionNote: null }, current.version);
      const rest = { ...form, nextActionDate: '', nextActionNote: '' };
      setCurrent(cleared);
      setForm(rest);
      onSaved?.(cleared);
      show(t.sheet.taskCleared);
      if (sameForm(rest, formOf(cleared))) onClose();
    } catch (err) {
      await caughtUp(err);
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
  const clearing = useDestructiveAction({
    label: t.sheet.clearTask,
    message: t.sheet.clearTaskAsk({ who: name }),
    confirmLabel: t.sheet.clearTask,
    onConfirm: () => void clearTask(),
    disabled: saving,
  });
  const holdsTask = Boolean(current?.nextActionDate || current?.nextActionNote?.trim());
  const offerClear = !offerHapus && offerClearTask && !isNew && editable && canUpdate && mine
    && current?.outcome === null && holdsTask;
  const offerOutcome = !isNew && editable && canMarkOutcome && current?.outcome === null;

  /** Closing asks first when something typed would be lost. */
  const requestClose = () => {
    if (dirty && editable) setAskingClose(true);
    else onClose();
  };

  const LABEL = 'mb-1.5 mt-4 block text-xs font-bold text-muted';
  const PILL = 'min-h-12 w-full rounded-pill border-0 bg-hover-row px-4 text-md text-ink';

  /*
   * The foot. The sheet's: the save state above, *Hapus* left of a wide *Simpan*. The pane's (UI-116): one row, *Hapus*
   * left, the save state — *Tersimpan ✓* — then *Simpan*, as `leads-tablet-desktop` draws it; 44px, a laptop's.
   */
  const saveLabel = <SaveStateLabel state={isNew && !dirty ? 'unsaved' : state} className={pane ? 'ml-auto' : 'w-full'} />;
  const footer = editable ? (
    <div className={pane ? 'flex items-center gap-2.5' : 'flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pb-1'}>
      {!pane && saveLabel}
      {(offerHapus || offerClear) && (
        <button
          type="button"
          onClick={offerHapus ? destructive.ask : clearing.ask}
          disabled={saving}
          className={cn(
            `inline-flex ${pane ? 'min-h-11' : 'min-h-[52px]'} shrink-0 items-center gap-1.5 rounded-pill border-[1.5px] border-line bg-card px-[18px]`,
            'text-md font-bold text-pill-red-ink hover:bg-pill-red disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <LineIcon name="trash" className="h-5 w-5" />
          {offerHapus ? t.sheet.delete : t.sheet.clearTask}
        </button>
      )}
      {pane && saveLabel}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || (!isNew && !dirty)}
        // The pane's *Simpan* is the accent, as frame 1 draws it — its white words on the accent fail 4.5:1, so navy (ADR-0137).
        className={pane
          ? 'min-h-11 shrink-0 rounded-pill bg-primary px-6 text-md font-bold text-primary-contrast hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40'
          : 'min-h-[52px] min-w-0 flex-1 rounded-pill bg-secondary px-5 text-md font-bold text-secondary-contrast hover:bg-secondary-hover disabled:cursor-not-allowed disabled:opacity-40'}
      >
        {t.sheet.save}
      </button>
    </div>
  ) : undefined;

  /**
   * Riwayat, newest first: each move the server kept and — on the owner's own lead — each proposal first saved as a PDF
   * (P19.7-T2 AC-11; *"Proposal dibuat · {produk}"*, linked while it exists), then the day the lead was added.
   */
  const timeline: { key: string; day: string; at: string; text: string; href?: string }[] = [
    ...[...(history ?? [])].reverse().map((entry) => (entry.kind === 'proposal' ? {
      key: `${entry.at}-proposal-${entry.proposalId ?? ''}`,
      day: shortDayOf(entry.at, figures),
      at: entry.at,
      text: t.sheet.proposalMade({ products: entry.products.join(', ') }),
      href: entry.proposalId ? proposalHref(entry.proposalId, 3) : undefined,
    } : {
      key: `${entry.at}-${entry.toStatusCode}`,
      day: shortDayOf(entry.at, figures),
      at: entry.at,
      // A code names one stage across both ladders, so a move made before a type change still reads by its name.
      text: t.sheet.moved({
        stage: pipelines.flatMap((p) => p.statuses).find((s) => s.code === entry.toStatusCode)?.label ?? entry.toStatusCode,
      }),
    })),
    ...(current?.dateRegistered ? [{
      key: 'added', day: shortDayOf(current.dateRegistered, figures), at: current.dateRegistered, text: t.sheet.added,
    }] : []),
  ];

  /**
   * ***Proposal***, above *Riwayat* (P19.7-T2 AC-12): on the reader's own lead, a Sales lead or one that has a proposal.
   * Each row the day, the products with their plan, the premium per currency — never added across two — and *Draf* or
   * *Selesai* in their fixed colours; a tap opens the proposal at step 3. *+ Buat proposal* starts one with this lead
   * chosen, on a Sales lead.
   */
  const proposalSection = proposalLeadId !== null && current !== null
    && (current.type === 'sales' || (current.proposals ?? null) !== null || (proposals?.length ?? 0) > 0) ? (
      <section aria-labelledby={`${uid}-proposals`} data-lead-proposals="">
        <h3 id={`${uid}-proposals`} className={LABEL}>{t.sheet.proposals}</h3>
        {proposalsError ? <ErrorBanner {...proposalsError} /> : proposals === null ? (
          <p className="text-base text-muted">{t.sheet.proposalsLoading}</p>
        ) : proposals.length > 0 && (
          <ul role="list" className="flex flex-col gap-1.5">
            {proposals.map((row) => {
              const total = row.totals.map((sum) => formatMoneyInFull(sum.amountMinor, sum.currency, figures)).join(' · ');
              return (
                <li key={row.id}>
                  <Link
                    href={proposalHref(row.id, 3)}
                    data-proposal-row={row.id}
                    className="flex min-h-11 items-center gap-2.5 rounded-row bg-hover-row px-3 py-2 hover:bg-divider"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-md font-semibold text-ink">
                        {row.products.map((p) => (p.plan ? `${p.name} · ${p.plan}` : p.name)).join(', ') || row.client.name}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        <time dateTime={row.date}>
                          {formatShortDay(row.date, { year: row.date.slice(0, 4) !== dayInZone(OFFICE_TIME_ZONE, new Date()).slice(0, 4) }, figures)}
                        </time>
                        {total ? ` · ${total}` : ''}
                      </span>
                    </span>
                    <TonePill tone={row.status === 'done' ? 'green' : 'grey'}>{t.sheet.proposalStatus[row.status]}</TonePill>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {current.type === 'sales' && canCreateProposal && (
          <Link
            href={newProposalHref(current.id)}
            data-new-proposal=""
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-pill border-[1.5px] border-line bg-card px-4 text-md font-semibold text-navy hover:bg-hover-row"
          >
            <LineIcon name="plus" className="h-4 w-4" />
            {t.sheet.newProposal}
          </Link>
        )}
      </section>
    ) : null;

  /** The WhatsApp number: a tap edits it (UI-081). On the sheet's contact line, and a line of its own in the pane. */
  const phoneLine = current && (editable ? (
    <button
      type="button"
      onClick={() => setEditingPhone(true)}
      className={pane
        ? 'mt-3 flex min-h-11 w-full min-w-0 flex-col justify-center rounded-row px-2 text-left hover:bg-hover-row'
        : 'flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-row text-left hover:bg-hover-row'}
    >
      <span className="text-xs font-bold text-muted">{t.sheet.phone}</span>
      <span className="flex items-center gap-1.5 truncate text-md text-ink">
        {current.contact.phone || <span className="text-signal-grey">{t.sheet.phone}</span>}
        <LineIcon name="pencil" className="h-4 w-4 shrink-0 text-signal-grey" />
      </span>
    </button>
  ) : pane ? (
    current.contact.phone ? <p className="mt-3 truncate px-2 text-md text-ink">{current.contact.phone}</p> : null
  ) : (
    <span className="min-w-0 flex-1 truncate text-md text-ink">{current.contact.phone ?? ''}</span>
  ));
  const whatsApp = current && (
    <LeadContactButtons
      lead={current}
      channels={['whatsapp']}
      onSaved={(next) => { setCurrent(next); onSaved?.(next); }}
    />
  );
  /**
   * ADR-0044's line, the pane's alone (the table's rule, `editedByOf`): who last changed the lead, when the server names a
   * change that was not the owner's and the reader did not make it.
   */
  const editedBy = pane && current?.lastEditedBy && current.lastEditedBy.membershipId !== me?.membership?.membershipId
    ? t.editedBy({ name: current.lastEditedBy.name ?? (owner ? t.someoneElse : t.someoneInYourOffice) })
    : null;

  const fields = (
    <>
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
                    form.type === type ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
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
              // Two to a row in the pane (UI-116: *status choice rows 2 per row*, ≥ 540px wide at 1024).
              <div className={pane ? 'grid grid-cols-2 gap-1.5' : 'flex flex-col gap-1.5'}>
                {[...ladder.map((s) => ({ code: s.code, label: s.label })),
                  ...(retiredRow ? [{ code: retiredRow, label: t.retired({ code: retiredRow }) }] : [])].map((stage) => {
                  const chosen = form.statusCode === stage.code;
                  return (
                    <label
                      key={stage.code}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-row px-3 text-md text-ink',
                        chosen ? 'bg-primary/[0.12] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-primary)]' : 'bg-hover-row',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${uid}-status`}
                        value={stage.code}
                        checked={chosen}
                        onChange={() => change({ statusCode: stage.code })}
                        className="h-[18px] w-[18px] shrink-0 accent-primary"
                      />
                      {stage.label}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/*
           * **The *Potensi* switch** (P19.1-T2 AC-5; UI-153 items 0–2): the old *Closing bulan ini* box's place, between
           * *Status* and *Tindakan berikutnya*, as one 44px switch card — never a checkbox, never a status option. Once the
           * lead has a type: the promise says which of the two it is. Saved with *Simpan*, as every field here.
           */}
          {form.type !== null && (
            <div className="mt-3.5">
              <PotensiSwitch
                type={form.type}
                checked={form.thisMonth}
                disabled={!editable || saving}
                onChange={(thisMonth) => change({ thisMonth })}
              />
            </div>
          )}

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

          {/*
           * **Hasil: two buttons, always, side by side and the same size** (P19.1-T2 AC-9; UI-160 items 1–3; ADR-0194;
           * rule R5). At the office's final stage *Tandai berhasil* is the next step — the action amber, navy words
           * (ADR-0137) — and *Tandai tidak berhasil* is held with why; below it, the mirror: *Tandai berhasil* held with
           * *Aktif setelah status {the office's final stage}*. The API refuses the same two (`LEAD_STATUS_NOT_FINAL`,
           * `LEAD_STATUS_FINAL`). Both wait for the sheet's own changes to be saved first.
           */}
          {offerOutcome && current && (
            <>
              <p className={LABEL}>{t.sheet.outcome}</p>
              <div className="grid grid-cols-2 items-start gap-2" data-outcome-buttons="">
                <div>
                  <button
                    type="button"
                    disabled={saving || dirty || !savedTerminal}
                    aria-describedby={savedTerminal ? undefined : `${uid}-won-held`}
                    onClick={() => setAskingOutcome('won')}
                    className={cn(
                      'min-h-11 w-full rounded-pill px-3 text-md font-semibold disabled:cursor-not-allowed disabled:opacity-40',
                      savedTerminal ? 'bg-primary text-primary-contrast hover:bg-primary/90' : 'bg-pill-green text-pill-green-ink',
                    )}
                  >
                    {t.menu.markWon}
                  </button>
                  {!savedTerminal && (
                    <p id={`${uid}-won-held`} className="mt-1 text-xs text-muted">
                      {t.menu.wonHeld({ stage: finalStageOf(ladderFor(current.type))?.label ?? '' })}
                    </p>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    disabled={saving || dirty || savedTerminal}
                    aria-describedby={savedTerminal ? `${uid}-lost-held` : undefined}
                    onClick={() => setAskingOutcome('lost')}
                    className="min-h-11 w-full rounded-pill bg-pill-grey px-3 text-md font-semibold text-pill-grey-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.menu.markLost}
                  </button>
                  {savedTerminal && current.type && (
                    <p id={`${uid}-lost-held`} className="mt-1 text-xs text-muted">{t.menu.lostHeld[current.type]}</p>
                  )}
                </div>
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

          {/*
           * **The client's age and gender** (P19.7-T1 AC-1; the proposal spec's step 1; ADR-0224): optional, below the
           * details and above *Riwayat*, in *+ Tambah lead* and on a lead — so an agent can fill them early, and the
           * proposal does not ask again. *Umur ulang tahun berikutnya* with − / + and the number keypad; *Laki-laki /
           * Perempuan* as two buttons. No birth date (minimisation).
           */}
          <div data-client-fields="">
            <label id={`${uid}-age-label`} htmlFor={`${uid}-age`} className={LABEL}>{t.sheet.age}</label>
            <AgeStepper
              id={`${uid}-age`}
              value={form.age}
              disabled={!editable || saving}
              onChange={(age) => change({ age })}
            />
            <p id={`${uid}-gender-label`} className={LABEL}>{t.sheet.gender}</p>
            <GenderButtons
              labelledBy={`${uid}-gender-label`}
              value={form.gender}
              disabled={!editable || saving}
              onChange={(gender) => change({ gender })}
            />
          </div>

          {proposalSection}

          {!isNew && (
            <section aria-labelledby={`${uid}-history`}>
              <h3 id={`${uid}-history`} className={LABEL}>{t.sheet.history}</h3>
              {history === null ? (
                <p className="text-base text-muted">{t.sheet.historyLoading}</p>
              ) : (
                <ol className="flex flex-col gap-2 pl-4 text-base text-ink">
                  {timeline.map((entry) => (
                    <li key={entry.key} className="relative">
                      <span aria-hidden="true" className="absolute -left-4 top-[5px] h-2 w-2 rounded-[2px] bg-primary" />
                      <time dateTime={entry.at} className="font-bold">{entry.day}</time> · {entry.href ? (
                        <Link href={entry.href} className="font-semibold text-navy underline underline-offset-2">{entry.text}</Link>
                      ) : entry.text}
                    </li>
                  ))}
                </ol>
              )}
              {editedBy && <p className="mt-2 text-base text-muted" data-edited-by="">{editedBy}</p>}
            </section>
          )}

          {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
    </>
  );

  const dialogs = (
    <>
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
      {clearing.dialog}
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

  if (pane) {
    /*
     * **The pane's frame** (UI-116): a white card the height the list gives it, the lead scrolling inside and the foot
     * pinned under it. Its name is the lead's NAME — or *Lead baru* — the head's heading.
     */
    return (
      <>
        <section aria-labelledby={`${uid}-pane-title`} data-lead-pane="" className="flex h-full min-h-0 flex-col rounded-lg bg-card">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-5">
            <div className="flex items-center gap-3">
              {current && <Avatar name={current.name} seed={current.id} size={48} />}
              <div className="min-w-0 flex-1">
                <h2 id={`${uid}-pane-title`} className="truncate text-xl font-extrabold uppercase text-ink">
                  {isNew ? t.sheet.newTitle : name}
                </h2>
                {current && <LeadPills lead={current} ladder={ladderFor(current.type)} className="mt-1" />}
              </div>
              {whatsApp}
            </div>
            {phoneLine}
            <div data-lead-sheet="">{fields}</div>
          </div>
          {footer && <div data-pane-foot="" className="border-t border-line px-5 py-3.5">{footer}</div>}
        </section>
        {dialogs}
      </>
    );
  }

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
              {phoneLine}
              {whatsApp}
            </div>
          )}
          {fields}
        </div>
      </ResponsiveSheet>
      {dialogs}
    </>
  );
}
