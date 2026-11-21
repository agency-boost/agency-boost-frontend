'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GroupDialog } from '@/components/groups/group-dialog';
import { LeaderPicker } from '@/components/leader-picker';
import { Avatar } from '@/components/ui/avatar';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { rungLabel, rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { memberSheetMessages } from '@/i18n/messages/member-sheet';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { dayInZone, formatCalendarDay, formatMonth, OFFICE_TIME_ZONE } from '@/lib/format';
import { changeRole, readTags, type MemberTags } from '@/lib/org';
import { ageOn, readSheetMember, saveMemberDetail, type RosterMember, type SheetField } from '@/lib/people';
import { whatsAppLink } from '@/lib/phone-number';
import { useSession } from '@/lib/session';
import { insideKpm } from '@/lib/super-admin-kpm';
import { HIT_AFTER, HIT_AREA, PersonName } from './people-parts';

/**
 * **The member sheet's contract** (P19.20-T2; ADR-0273 §1) — what All members, Import people, the Org tree, and the Super
 * Admin's console inside a KPM (19.23) open:
 *
 * - `membershipId` — whom it shows. It reads `GET /members/:id` itself: a reader who may not open them (a core leader
 *   outside their downline) is answered `404`, and the sheet says so.
 * - `onClose()` — ✕, Escape, the backdrop.
 * - `onChanged(member)` — after any change it saved (a field, the role, the leader, the group): the member as they now
 *   read, so the caller refreshes its row. Optional.
 *
 * Who may change what is the server's (`canEditDetails`, `roleChoices`, `canChangeLeader`, the group routes' own grants):
 * the sheet offers a pencil only where the read says so, and every write is refused regardless.
 */
export interface MemberSheetProps {
  membershipId: string;
  onClose: () => void;
  onChanged?: (member: RosterMember) => void;
}

/** A field being changed, and what is typed. */
type Editing = { field: SheetField | 'role'; draft: string } | null;

/** The fields a steward fills, in the note's order: what *n data belum diisi* counts. */
const COUNTED: readonly SheetField[] = ['dateOfBirth', 'companyJoinMonth', 'joinDate', 'workStatus', 'gender', 'phone'];

/**
 * **The member sheet** (P19.20-T2; the People mockups, frames 16–17 and 24): photo, the AB / AAB label and the NAME (★ for
 * a core leader), *"role · agent code · melapor ke …"*; ***Profil*** — Peran, Leader (melapor ke) with their photo, Group
 * (an AAB's or an agent's *Group · ikut AB*, no pencil), Bergabung di KPM, Bergabung di perusahaan (*Nov 2023*), Waktu,
 * Kode agen, Unit; ***Demografi*** — Umur (with the birth date), Jenis kelamin, No. WhatsApp, Email.
 *
 * - **Every field editable** by the Owner, the Admins, the Super Admin inside the KPM and a core leader for somebody below
 *   them (AC-2): a pencil, or an orange *+ Isi* when empty → the field's own input with ✓ (`PATCH …/personal`). *Peran*
 *   is the rung select (`PATCH …/role`); *Leader* opens the leader picker — a move, as on All members (`PUT …/leader`);
 *   an AB's *Group* the Group dialog. *Unit* is counted from the tree and has no pencil (OD-402); an email somebody signs
 *   in with has none either (OD-400). Every change is logged on the server, before and after.
 * - **Missing data** (AC-3): *+ Isi* in orange and the yellow note *"n data belum diisi · … · ketuk untuk mengisi"*, which
 *   opens the first; then green *WhatsApp* and orange *Buka profil* — the Personal Summary, which a Super Admin inside
 *   the KPM is not offered: it is a member's page (OD-377; parity I-1231).
 * - **A centred dialog at every size**, as the mockups draw it on a phone too; the content scrolls under its head.
 */
export function MemberSheet({ membershipId, onClose, onChanged }: MemberSheetProps) {
  const t = useMessages(memberSheetMessages);
  const figures = useFigureLanguage();
  const ladder = useLadder();
  const { show } = useToast();
  const [member, setMember] = useState<RosterMember | null>(null);
  const [tags, setTags] = useState<MemberTags | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [fieldError, setFieldError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | 'leader' | 'group'>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const { me } = useSession();
  const superAdminInside = me !== null && insideKpm(me);

  const load = useCallback(async () => {
    setError(null);
    try {
      const read = await readSheetMember(membershipId);
      if (!live.current) return read;
      setMember(read);
      // The group and the AB they follow: the steward's read (`member:tag_group`); without it the cell reads the row's.
      readTags(membershipId).then((answer) => { if (live.current) setTags(answer); }).catch(() => undefined);
      return read;
    } catch (err) {
      if (live.current) setError(toDisplayError(err));
      return null;
    }
  }, [membershipId]);
  useEffect(() => { void load(); }, [load]);

  const changed = async () => {
    const read = await load();
    if (read) onChanged?.(read);
  };

  async function save() {
    if (!member || !editing) return;
    const value = editing.draft.trim();
    if (!value) return;
    setBusy(true);
    setFieldError(null);
    try {
      if (editing.field === 'role') {
        await changeRole(member.membershipId, value);
        await changed();
      } else {
        const saved = await saveMemberDetail(member.membershipId, { [editing.field]: value });
        setMember(saved.member);
        onChanged?.(saved.member);
      }
      setEditing(null);
      show(t.saved);
    } catch (err) {
      setFieldError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const today = dayInZone(OFFICE_TIME_ZONE, new Date());
  const name = member ? displayName(member) : '';
  const rung = member ? (member.orgLevelCode ?? member.role.toUpperCase()) : '';
  const editable = Boolean(member?.canEditDetails);
  const personal = member?.personal;

  const heading = member ? (
    <span className="flex min-w-0 flex-col">
      <PersonName name={name} role={member.role} rungCode={rung} coreLeader={member.isCoreLeader} className="text-lg" />
      <span className="mt-0.5 text-sm font-normal text-muted">
        {t.headLine({ role: rungLabel(rung, ladder), code: member.agentCode, leader: member.leaderName?.toUpperCase() ?? null })}
      </span>
    </span>
  ) : t.loading;

  /** Each counted field that is empty, by its note name. */
  const missing = member && personal ? COUNTED.filter((f) => {
    if (f === 'joinDate') return !member.joinDate;
    return !personal[f as keyof typeof personal];
  }) : [];
  const missingName = (f: SheetField) => t.missingNames[f] ?? t.fields[f as keyof typeof t.fields];

  const startEdit = (field: SheetField | 'role', draft = '') => {
    setFieldError(null);
    setEditing({ field, draft });
  };

  const valueOf = (field: SheetField): string | null => {
    if (!member) return null;
    switch (field) {
      case 'joinDate': return member.joinDate ?? null;
      case 'agentCode': return member.agentCode || null;
      case 'email': return member.email || null;
      default: return (personal?.[field as keyof NonNullable<typeof personal>] as string | null | undefined) ?? null;
    }
  };

  const shown = (field: SheetField, value: string): string => {
    switch (field) {
      case 'joinDate': return formatCalendarDay(value, figures);
      case 'companyJoinMonth': return formatMonth(value, figures);
      case 'workStatus': return value === 'full_time' ? t.fullTime : t.partTime;
      case 'gender': return value === 'male' ? t.male : t.female;
      case 'dateOfBirth': return t.ageLine({ years: ageOn(value, today), date: formatCalendarDay(value, figures) });
      default: return value;
    }
  };

  /** One editable cell: its value, *+ Isi* when empty, a pencil — or, while changed, its input and ✓. */
  const cell = (field: SheetField, opts: { pencil?: boolean; title?: string } = {}) => {
    const label = t.fields[field as keyof typeof t.fields];
    const value = valueOf(field);
    const mayEdit = editable && (opts.pencil ?? true);
    if (editing?.field === field) {
      return (
        <EditCell key={field} label={label} field={field} draft={editing.draft} busy={busy} today={today}
          onDraft={(draft) => setEditing({ field, draft })} onSave={() => void save()} onCancel={() => setEditing(null)}
          error={fieldError} saveLabel={t.save({ field: label })} cancelLabel={t.cancel} words={t} />
      );
    }
    return (
      <Cell key={field} label={label} title={opts.title}
        action={mayEdit && value !== null ? { label: t.edit({ field: label }), onClick: () => startEdit(field, value) } : undefined}>
        {value !== null ? shown(field, value) : mayEdit ? (
          <button type="button" className={cn('font-bold text-primary-ink hover:underline', HIT_AREA)} onClick={() => startEdit(field)}>
            {t.fill}<span className="sr-only"> {label}</span>
          </button>
        ) : '—'}
      </Cell>
    );
  };

  const isAb = member?.role === 'ab';
  const group = tags?.group ?? member?.groupPlace?.group ?? null;
  const phone = whatsAppLink(personal?.phone);

  return (
    <>
      <Modal
        open
        // The sheet's head: the label, the NAME and ★, and the line under them (DESIGN-RULES, *Names*). `Modal` writes its
        // title in an `h2`; a node is what it is given here, read as the dialog's name.
        title={heading as unknown as string}
        eyebrow={member ? (
          <span className="float-left mr-3 mt-2">
            <Avatar name={name} photoUrl={member.photoUrl} seed={member.membershipId} size={52} />
          </span>
        ) : undefined}
        onClose={onClose}
        closeLabel={t.close}
        className="max-w-[40rem]"
      >
        {error && <ErrorBanner {...error} />}
        {!member && !error && <SkeletonCards count={2} label={t.loading} />}
        {member && (
          <div className="flex flex-col gap-3 pb-2" data-member-sheet={member.membershipId}>
            <h3 className="clear-both text-xs font-bold uppercase tracking-wide text-muted">{t.profile}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {editing?.field === 'role' ? (
                <RoleCell label={t.fields.role} draft={editing.draft} choices={member.roleChoices ?? []} ladder={ladder}
                  busy={busy} error={fieldError} words={t}
                  onDraft={(draft) => setEditing({ field: 'role', draft })} onSave={() => void save()} onCancel={() => setEditing(null)} />
              ) : (
                <Cell label={t.fields.role} action={member.canChangeRole
                  ? { label: t.edit({ field: t.fields.role }), onClick: () => startEdit('role', rung.toLowerCase()) } : undefined}>
                  {rungLabel(rung, ladder)}
                </Cell>
              )}
              <Cell label={t.fields.leader} action={member.canChangeLeader
                ? { label: t.edit({ field: t.fields.leader }), onClick: () => setOpen('leader') } : undefined}>
                {member.leaderName ? <span className="truncate uppercase">{member.leaderName}</span> : '—'}
              </Cell>
              {isAb ? (
                <Cell label={t.fields.group} action={editable || tags !== null
                  ? { label: t.edit({ field: t.fields.group }), onClick: () => setOpen('group') } : undefined}>
                  <span className="truncate">{group?.name ?? t.noGroup}</span>
                </Cell>
              ) : (
                <Cell label={t.fields.groupFollows}>
                  <span className="truncate">{group?.name ?? t.noGroup}</span>
                </Cell>
              )}
              {cell('joinDate')}
              {cell('companyJoinMonth')}
              {cell('workStatus')}
              {cell('agentCode')}
              <Cell label={t.fields.unit}>
                {member.isLeader ? t.unitLine({ direct: member.directCount, unit: member.subtreeCount }) : '—'}
              </Cell>
            </div>

            <h3 className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{t.demography}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cell('dateOfBirth')}
              {cell('gender')}
              {cell('phone')}
              {cell('email', { pencil: member.invitation !== 'signed_in', title: member.invitation === 'signed_in' ? t.emailSignedIn : undefined })}
            </div>

            {editable && missing.length > 0 && (
              <button
                type="button"
                onClick={() => startEdit(missing[0]!)}
                className="min-h-11 rounded-md bg-pill-amber px-3 py-2 text-left text-sm text-pill-amber-ink"
              >
                <strong>{t.missing({ n: missing.length })}</strong>
                {t.missingTail({ list: missing.map(missingName).join(', ') })}
              </button>
            )}
            {editable && <p className="text-sm text-muted">{t.whoMayEdit}</p>}

            <div className="grid grid-cols-2 gap-2">
              {phone ? (
                <a href={phone} target="_blank" rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-success px-4 font-semibold text-white">
                  <LineIcon name="whatsapp" className="h-4 w-4" />{t.whatsapp}
                </a>
              ) : <span aria-hidden="true" />}
              {/*
               * Not for a Super Admin inside the KPM (found 2026-11-20; OD-377, parity I-1231): the Personal Summary is a
               * member's page, which the KPM's Owner who is nobody's member cannot open — the link sent them out of the KPM.
               */}
              {!superAdminInside && (
                <Link href={`/coaching/${encodeURIComponent(member.membershipId)}/summary`}
                  className="inline-flex min-h-11 items-center justify-center rounded-pill bg-primary px-4 font-semibold text-primary-contrast">
                  {t.openProfile}
                </Link>
              )}
            </div>
          </div>
        )}
      </Modal>

      {member && (
        <LeaderPicker
          open={open === 'leader'}
          membershipId={member.membershipId}
          memberName={name}
          downlineCount={member.subtreeCount}
          mode="office"
          onDone={() => { setOpen(null); void changed(); }}
          onClose={() => setOpen(null)}
        />
      )}
      {member && open === 'group' && (
        <GroupDialog
          ab={{ membershipId: member.membershipId, name, role: rungShort(rung, ladder), people: member.subtreeCount + 1 }}
          manageHref={null}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); void changed(); }}
        />
      )}
    </>
  );
}

/** A field's box: its label, its value, and a pencil at its top right. */
function Cell({
  label, children, action, title,
}: {
  label: string;
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  title?: string;
}) {
  return (
    <div className="relative min-w-0 rounded-md bg-base px-3 py-2" title={title}>
      <div className="pr-6 text-xs text-muted">{label}</div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-md font-bold text-navy">{children}</div>
      {action && (
        <button type="button" onClick={action.onClick} aria-label={action.label}
          className={cn('absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-pill text-muted hover:bg-hover-row hover:text-navy', HIT_AFTER)}>
          <LineIcon name="pencil" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

type Words = ReturnType<typeof useMessages<typeof memberSheetMessages.en>>;

/** A field being changed: its own input — a date, a month, a choice, a number, an address — and ✓. */
function EditCell({
  label, field, draft, busy, today, onDraft, onSave, onCancel, error, saveLabel, cancelLabel, words,
}: {
  label: string;
  field: SheetField;
  draft: string;
  busy: boolean;
  today: string;
  onDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  error: ApiError | null;
  saveLabel: string;
  cancelLabel: string;
  words: Words;
}) {
  const inputId = useId();
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    if (e.key === 'Enter') { e.preventDefault(); onSave(); }
  };
  const base = 'min-h-11 min-w-0 flex-1 bg-transparent text-md font-bold text-navy focus:outline-none';
  const input = field === 'workStatus' || field === 'gender' ? (
    <select id={inputId} autoFocus value={draft} onChange={(e) => onDraft(e.target.value)} onKeyDown={keys} className={base}>
      <option value="" />
      {field === 'workStatus'
        ? (<><option value="full_time">{words.fullTime}</option><option value="part_time">{words.partTime}</option></>)
        : (<><option value="male">{words.male}</option><option value="female">{words.female}</option></>)}
    </select>
  ) : (
    <input
      id={inputId}
      autoFocus
      value={draft}
      onChange={(e) => onDraft(e.target.value)}
      onKeyDown={keys}
      className={base}
      type={field === 'joinDate' || field === 'dateOfBirth' ? 'date' : field === 'companyJoinMonth' ? 'month' : field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
      inputMode={field === 'agentCode' ? 'numeric' : undefined}
      max={field === 'joinDate' || field === 'dateOfBirth' ? today : field === 'companyJoinMonth' ? today.slice(0, 7) : undefined}
    />
  );
  return (
    <div className="col-span-2 min-w-0 rounded-md border-2 border-secondary bg-card px-3 py-1.5 sm:col-span-1">
      <label htmlFor={inputId} className="text-xs text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        {input}
        <button type="button" onClick={onSave} disabled={busy || !draft.trim()} aria-label={saveLabel}
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-contrast disabled:opacity-50', HIT_AREA)}>
          <LineIcon name="check" className="h-4 w-4" />
        </button>
        <button type="button" onClick={onCancel} aria-label={cancelLabel}
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover-row', HIT_AREA)}>
          <LineIcon name="close" className="h-4 w-4" />
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-alert">{error.message}</p>}
    </div>
  );
}

/** *Peran* being changed: the rungs this reader may put them on (`roleChoices`), and ✓. */
function RoleCell({
  label, draft, choices, ladder, busy, error, words, onDraft, onSave, onCancel,
}: {
  label: string;
  draft: string;
  choices: readonly string[];
  ladder: ReturnType<typeof useLadder>;
  busy: boolean;
  error: ApiError | null;
  words: Words;
  onDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  return (
    <div className="col-span-2 min-w-0 rounded-md border-2 border-secondary bg-card px-3 py-1.5 sm:col-span-1">
      <label htmlFor={id} className="text-xs text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <select id={id} autoFocus value={draft} onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-md font-bold text-navy focus:outline-none">
          {choices.map((code) => <option key={code} value={code.toLowerCase()}>{rungLabel(code, ladder)}</option>)}
        </select>
        <button type="button" onClick={onSave} disabled={busy} aria-label={words.save({ field: label })}
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-contrast disabled:opacity-50', HIT_AREA)}>
          <LineIcon name="check" className="h-4 w-4" />
        </button>
        <button type="button" onClick={onCancel} aria-label={words.cancel}
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover-row', HIT_AREA)}>
          <LineIcon name="close" className="h-4 w-4" />
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-alert">{error.message}</p>}
    </div>
  );
}
