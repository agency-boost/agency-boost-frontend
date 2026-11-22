'use client';

import { useId, useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { groupsMessages } from '@/i18n/messages/groups';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  appointGroupLeader, deleteInformalGroup, removeGroupLeader, renameInformalGroup, type InformalGroup, type InformalGroupsView,
} from '@/lib/informal-groups';

/**
 * **A group card's ⋯ — *Ubah nama · Ubah group leader · Hapus group*** (P19.17-T4; ADR-0270 §2, §3; the brief of 19
 * November, *Informal groups and Group Leaders* (3)): the menu and its three dialogs, for Advanced analytics › *Informal
 * group*'s cards and any page that lists the groups. Each answers the groups as they now stand (`onChanged`).
 *
 * - ***Ubah nama*** — `PUT /members/groups/:id`; the ABs follow (they carry its id).
 * - ***Ubah group leader*** — the group's ABs, each ticked while a Group Leader: **several may be**; *Simpan* appoints the
 *   newly ticked (`PUT …/leaders/:ab`) and removes the unticked (`DELETE …/leaders/:ab`). Only an AB of the group is
 *   offered, as the server requires.
 * - ***Hapus group*** — *"Hapus group {name}?"*, its ABs and their teams to *Tanpa group* (`DELETE /members/groups/:id`).
 *
 * The server refuses anybody who is not a steward of the KPM; the caller shows the ⋯ only with `canWrite`.
 */
export function GroupCardMenu({ group, onChanged }: { group: InformalGroup; onChanged: (view: InformalGroupsView) => void }) {
  const t = useMessages(groupsMessages).card;
  const [open, setOpen] = useState<null | 'rename' | 'leaders' | 'remove'>(null);
  const done = (view: InformalGroupsView) => {
    setOpen(null);
    onChanged(view);
  };
  return (
    <>
      <ActionMenu
        label={t.more({ name: group.name })}
        glyph="⋯"
        items={[
          { label: t.rename, onSelect: () => setOpen('rename') },
          { label: t.leaders, onSelect: () => setOpen('leaders') },
          { label: t.remove, tone: 'alert', onSelect: () => setOpen('remove') },
        ]}
      />
      {open === 'rename' && <RenameGroupDialog group={group} onClose={() => setOpen(null)} onSaved={done} />}
      {open === 'leaders' && <GroupLeadersDialog group={group} onClose={() => setOpen(null)} onSaved={done} />}
      {open === 'remove' && <DeleteGroupDialog group={group} onClose={() => setOpen(null)} onDeleted={done} />}
    </>
  );
}

function Footer({ formId, busy, label, onCancel }: { formId: string; busy: boolean; label: string; onCancel: () => void }) {
  const t = useMessages(groupsMessages);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" className="min-h-12 w-full rounded-pill" onClick={onCancel}>{t.cancel}</Button>
      <Button type="submit" form={formId} className="min-h-12 w-full rounded-pill" disabled={busy}>{busy ? t.saving : label}</Button>
    </div>
  );
}

/** ***Ubah nama***: the group's name, typed again. */
export function RenameGroupDialog({
  group, onClose, onSaved,
}: { group: { groupId: string; name: string }; onClose: () => void; onSaved: (view: InformalGroupsView) => void }) {
  const t = useMessages(groupsMessages);
  const formId = useId();
  const nameId = useId();
  const [name, setName] = useState(group.name);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const typed = name.trim();
    if (!typed) {
      setMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await renameInformalGroup(group.groupId, typed));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveSheet open title={t.card.renameTitle} description={group.name} onClose={onClose}
      footer={<Footer formId={formId} busy={busy} label={t.save} onCancel={onClose} />}>
      <form id={formId} onSubmit={submit} noValidate data-rename-group="" className="pb-2">
        <label htmlFor={nameId} className="mb-1.5 block text-base font-semibold text-navy">{t.group.name}</label>
        <TextInput
          id={nameId}
          value={name}
          maxLength={80}
          invalid={missing}
          aria-describedby={missing ? `${nameId}-missing` : undefined}
          onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setMissing(false); }}
        />
        {missing && <p id={`${nameId}-missing`} className="mt-1 text-sm text-alert">{t.group.nameMissing}</p>}
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </ResponsiveSheet>
  );
}

/** ***Ubah group leader***: the group's ABs, several of whom may be its Group Leaders. */
export function GroupLeadersDialog({
  group, onClose, onSaved,
}: { group: InformalGroup; onClose: () => void; onSaved: (view: InformalGroupsView) => void }) {
  const t = useMessages(groupsMessages);
  const formId = useId();
  const was = new Set(group.leaders.map((l) => l.membershipId));
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(was));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toggle = (id: string, on: boolean) => setTicked((now) => {
    const next = new Set(now);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const adding = [...ticked].filter((id) => !was.has(id));
    const removing = [...was].filter((id) => !ticked.has(id));
    if (adding.length === 0 && removing.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let view: InformalGroupsView | null = null;
      for (const id of adding) view = await appointGroupLeader(group.groupId, id);
      for (const id of removing) view = await removeGroupLeader(group.groupId, id);
      onSaved(view!);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ResponsiveSheet open title={t.card.leadersTitle} description={group.name} onClose={onClose}
      footer={<Footer formId={formId} busy={busy} label={t.save} onCancel={onClose} />}>
      <form id={formId} onSubmit={submit} noValidate data-group-leaders="" className="pb-2">
        <p className="mb-2 text-sm text-muted">{t.card.leadersLine}</p>
        {group.abs.length === 0 ? (
          <p className="text-md text-muted">{t.card.noAbs}</p>
        ) : (
          <fieldset>
            <legend className="sr-only">{t.card.leadersTitle}</legend>
            <ul className="divide-y divide-divider">
              {group.abs.map((a) => (
                <li key={a.membershipId}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1 text-md text-ink">
                    <input
                      type="checkbox"
                      checked={ticked.has(a.membershipId)}
                      onChange={(e) => toggle(a.membershipId, e.target.checked)}
                      className="h-5 w-5 shrink-0 cursor-pointer accent-secondary"
                    />
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span className="mr-1 text-sm font-bold text-primary-ink">AB</span>{a.name}
                    </span>
                    {ticked.has(a.membershipId) && <span className="text-sm font-bold text-primary-ink">{t.card.groupLeader}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </ResponsiveSheet>
  );
}

/** ***Hapus group***: asked once; its ABs and their teams to *Tanpa group*. */
export function DeleteGroupDialog({
  group, onClose, onDeleted,
}: { group: InformalGroup; onClose: () => void; onDeleted: (view: InformalGroupsView) => void }) {
  const t = useMessages(groupsMessages).card;
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      onDeleted(await deleteInformalGroup(group.groupId));
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open={!error}
        message={t.removeTitle({ name: group.name })}
        detail={t.removeLine({ n: group.counts.abGroups })}
        confirmLabel={busy ? t.removing : t.removeAction}
        tone="danger"
        onConfirm={() => void confirm()}
        onCancel={onClose}
      />
      {error && (
        <ResponsiveSheet open title={t.remove} description={group.name} onClose={onClose}>
          <ErrorBanner {...error} />
        </ResponsiveSheet>
      )}
    </>
  );
}
