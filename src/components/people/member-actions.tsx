'use client';

import { useId, useState } from 'react';
import { LeaderLimitNotice, isLeaderLimit } from '@/components/leader-limit-notice';
import { LeaderPicker } from '@/components/leader-picker';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { rungLabel, useLadder } from '@/components/ui/role-badge';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { memberSheetMessages } from '@/i18n/messages/member-sheet';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { appointGroupLeader, removeGroupLeader } from '@/lib/informal-groups';
import { askLeaderLimitApproval } from '@/lib/leader-limit-requests';
import { changeRole, REMOVAL_CONFIRMATION, removeMember, setCoreLeader } from '@/lib/org';
import type { RosterMember } from '@/lib/people';

/** A destructive main action, filled red (`DESIGN-RULES.md`, *Dialogs*; the Dialog's `dangerFill`). */
export const RED_FILL = 'border-alert bg-alert text-white hover:bg-alert/90';

/**
 * **A roster row's ⋯** (P19.20-T1 AC-3; the People mockup's frames 7–9): *Jadikan core leader* / *Hapus dari core leader*
 * (the Owner, an Admin, the Super Admin — `canTagCoreLeader`), *Jadikan group leader · <group>* (adds) / *Hapus sebagai
 * group leader* and *Ubah group* (an AB's, a steward's), *Ubah peran / leader* (`roleChoices`, `canChangeLeader`), and
 * *Keluarkan dari KPM* in red (`canRemove`). Each item is offered only where the row says so; the server refuses
 * regardless. The menu is `ActionMenu`'s: fixed to the window, it opens down near the top and up near the bottom, never
 * clipped. `onChanged` after any write, so the page reads its rows again; `onChangeGroup` opens the Group dialog.
 */
export function MemberRowMenu({
  member, steward, onChanged, onChangeGroup,
}: {
  member: RosterMember;
  /** The reader changes groups (`member:tag_group`): the group items are offered. */
  steward: boolean;
  onChanged: () => void;
  onChangeGroup: () => void;
}) {
  const t = useMessages(memberSheetMessages);
  const { show } = useToast();
  const [open, setOpen] = useState<null | 'role' | 'leader' | 'remove'>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const name = displayName(member);
  const place = member.groupPlace;
  const isAb = member.role === 'ab';

  const run = async (write: () => Promise<unknown>) => {
    setError(null);
    try {
      await write();
      show(t.saved);
      onChanged();
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  const items: ActionMenuItem[] = [];
  if (member.canTagCoreLeader) {
    items.push({
      label: member.isCoreLeader ? t.removeCore : t.makeCore,
      onSelect: () => void run(() => setCoreLeader(member.membershipId, !member.isCoreLeader)),
    });
  }
  if (steward && isAb && place?.group) {
    const group = place.group;
    items.push(place.isGroupLeader
      ? { label: t.removeGroupLeader, onSelect: () => void run(() => removeGroupLeader(group.groupId, member.membershipId)) }
      : { label: t.makeGroupLeader({ group: group.name }), onSelect: () => void run(() => appointGroupLeader(group.groupId, member.membershipId)) });
  }
  if (steward && isAb && place) items.push({ label: t.changeGroup, onSelect: onChangeGroup });
  if (member.canChangeRole || member.canChangeLeader) items.push({ label: t.changeRoleLeader, onSelect: () => setOpen('role') });
  if (member.canRemove) items.push({ label: t.remove, tone: 'alert', onSelect: () => setOpen('remove') });

  if (items.length === 0) return null;
  return (
    <>
      <ActionMenu label={t.more({ name })} glyph="⋯" items={items} />
      {error && <span role="alert" className="sr-only">{error.message}</span>}
      {error && (
        <Modal open title={t.changeRoleLeader} onClose={() => setError(null)} placement="popup">
          <ErrorBanner {...error} />
        </Modal>
      )}
      {open === 'role' && (
        <RoleLeaderDialog
          member={member}
          onClose={() => setOpen(null)}
          onLeader={() => setOpen('leader')}
          onSaved={() => { setOpen(null); show(t.saved); onChanged(); }}
        />
      )}
      <LeaderPicker
        open={open === 'leader'}
        membershipId={member.membershipId}
        memberName={name}
        downlineCount={member.subtreeCount}
        mode="office"
        onDone={() => { setOpen(null); onChanged(); }}
        onClose={() => setOpen(null)}
      />
      {open === 'remove' && (
        <RemoveDialog member={member} onClose={() => setOpen(null)} onRemoved={() => { setOpen(null); onChanged(); }} />
      )}
    </>
  );
}

/**
 * ***Ubah peran / leader*** (P19.20-T2 AC-4; not drawn — SPEC-SUPERADMIN §13.1 — so in the sheet's idiom): a centred
 * dialog with the rung select (the rungs this reader may set, `roleChoices`), the leader they report to with *Ganti
 * leader* — the leader picker, a move with the whole team — and an optional reason, as today's role change asks one.
 * *Batal* + *Simpan*. The leader limit's refusal is said in its words, with *ask AgencyBoost* where it may be asked.
 */
export function RoleLeaderDialog({
  member, onClose, onLeader, onSaved,
}: {
  member: RosterMember;
  onClose: () => void;
  onLeader: () => void;
  onSaved: () => void;
}) {
  const t = useMessages(memberSheetMessages);
  const ladder = useLadder();
  const formId = useId();
  const current = (member.orgLevelCode ?? member.role).toLowerCase();
  const [toRole, setToRole] = useState(current);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState(false);
  const name = displayName(member);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (toRole === current) return;
    setBusy(true);
    setError(null);
    try {
      await changeRole(member.membershipId, toRole, reason.trim() || undefined);
      onSaved();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };
  const ask = async () => {
    setAsking(true);
    try {
      await askLeaderLimitApproval(member.membershipId, { action: 'promote', orgLevelCode: toRole, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      onSaved();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Modal
      open
      title={t.roleTitle({ name: name.toUpperCase() })}
      onClose={onClose}
      closeLabel={t.close}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-11 w-full rounded-pill" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" form={formId} className="min-h-11 w-full rounded-pill" disabled={busy || toRole === current}>
            {busy ? t.saving : t.saveAction}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3 pb-2" noValidate>
        {error && (isLeaderLimit(error)
          ? <LeaderLimitNotice error={error} audience="office" action="role" asking={asking} onAsk={() => void ask()} />
          : <ErrorBanner {...error} />)}
        {member.canChangeRole && (
          <Field label={t.newRole} htmlFor={`${formId}-role`}>
            <Select id={`${formId}-role`} value={toRole} onChange={(e) => setToRole(e.target.value)}>
              {(member.roleChoices ?? [current.toUpperCase()]).map((code) => (
                <option key={code} value={code.toLowerCase()}>{rungLabel(code, ladder)}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex items-center justify-between gap-3 rounded-md bg-base px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs text-muted">{t.fields.leader}</div>
            <div className="truncate font-bold uppercase text-navy">{member.leaderName ?? t.noLeader}</div>
          </div>
          {member.canChangeLeader && (
            <Button variant="secondary" className="min-h-11 shrink-0 rounded-pill" onClick={onLeader}>{t.changeLeader}</Button>
          )}
        </div>
        {member.canChangeRole && (
          <Field label={t.reason} htmlFor={`${formId}-reason`}>
            <TextInput id={`${formId}-reason`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </form>
    </Modal>
  );
}

/**
 * ***Keluarkan dari KPM*** (P19.20-T2 AC-4; not drawn — SPEC-SUPERADMIN §13.1 — so in the sheet's idiom): *"Keluarkan
 * {NAMA} dari KPM?"*, the one line that says nothing is lost, an optional reason as today's removal asks one, and — for
 * somebody who leads people — where their team goes: to the leader above them, or to no leader. *Batal* + a red
 * *Keluarkan*. The dialog is the confirmation, so it sends the API's literal (`REMOVE`) itself.
 */
export function RemoveDialog({
  member, onClose, onRemoved,
}: {
  member: RosterMember;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const t = useMessages(memberSheetMessages);
  const formId = useId();
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState<'reassign' | 'orphan'>(member.leaderId ? 'reassign' : 'orphan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const name = displayName(member).toUpperCase();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await removeMember(member.membershipId, {
        confirmation: REMOVAL_CONFIRMATION,
        reason: reason.trim() || undefined,
        ...(member.directCount > 0
          ? {
            subtree: disposition === 'reassign' && member.leaderId
              ? ({ action: 'reassign', toMembershipId: member.leaderId } as const)
              : ({ action: 'orphan' } as const),
          }
          : {}),
      });
      onRemoved();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={t.removeTitle({ name })}
      description={t.removeLine}
      onClose={onClose}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-11 w-full rounded-pill" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" form={formId} variant="secondary" className={cn('min-h-11 w-full rounded-pill', RED_FILL)} disabled={busy}>
            {busy ? t.removing : t.removeAction}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3 pb-2" noValidate>
        {error && <ErrorBanner {...error} />}
        {member.directCount > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm text-navy">{t.removeTeam({ n: member.subtreeCount })}</legend>
            {member.leaderId && member.leaderName && (
              <label className="flex min-h-11 items-center gap-2 text-md text-navy">
                <input type="radio" name={`${formId}-team`} checked={disposition === 'reassign'} onChange={() => setDisposition('reassign')} />
                {t.removeToLeader({ name: member.leaderName.toUpperCase() })}
              </label>
            )}
            <label className="flex min-h-11 items-center gap-2 text-md text-navy">
              <input type="radio" name={`${formId}-team`} checked={disposition === 'orphan'} onChange={() => setDisposition('orphan')} />
              {t.removeOrphan}
            </label>
          </fieldset>
        )}
        <Field label={t.reason} htmlFor={`${formId}-reason`}>
          <TextInput id={`${formId}-reason`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
