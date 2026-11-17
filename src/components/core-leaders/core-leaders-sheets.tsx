'use client';

import { useEffect, useId, useState } from 'react';
import { Button, Switch, TextInput } from '@/components/ui/field';
import { ChoiceRows } from '@/components/ui/rows-and-sheets';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Stepper } from '@/components/ui/stepper';
import { useMessages } from '@/i18n/language-provider';
import { coreLeadersMessages } from '@/i18n/messages/core-leaders';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { CoreLeader, CoreLeaderGroup, CoreLeadersView } from '@/lib/core-leaders';

/** A choice row's key for *Tanpa group*, and for *+ Group baru* — never a group's id. */
export const NO_GROUP = '__none__';
const NEW_GROUP = '__new__';

/** A sheet's refusal, inside it: the page's banner is behind the sheet. */
function SheetError({ error }: { error: ApiError | null }) {
  return error ? <p role="alert" className="mt-3 text-sm text-alert">{error.message}</p> : null;
}

/** The pinned footer's one wide button (D-01). */
const WIDE = 'w-full justify-center';

export interface LeaderEdit {
  groupId: string | null;
  isGroupLeader: boolean;
  isCoreLeader: boolean;
  aa: number;
  rec: number;
}

/**
 * **One leader's edit** (UI-199: *Row tap → bottom sheet (name + code)*; the desktop's › popup): **Group** as choice rows —
 * each group, *Tanpa group*, *+ Group baru* — the **★ Group leader** switch (held off without a group), the **Core
 * leader** switch, **Target {year}** with − n + (Target AA, Target rekrutmen) where the KPM reads them, and *Simpan*
 * pinned (D-01). A bottom sheet on a phone and a tablet, a centred popup on a desktop (`ResponsiveSheet`).
 */
export function LeaderEditSheet({
  leader, view, busy, error, onSave, onNewGroup, onClose,
}: {
  leader: CoreLeader;
  view: CoreLeadersView;
  busy: boolean;
  error: ApiError | null;
  onSave: (edit: LeaderEdit) => void;
  onNewGroup: () => void;
  onClose: () => void;
}) {
  const t = useMessages(coreLeadersMessages);
  const ids = useId();
  const [edit, setEdit] = useState<LeaderEdit>({
    groupId: leader.groupId, isGroupLeader: leader.isGroupLeader, isCoreLeader: leader.isCoreLeader,
    aa: leader.targets?.aa ?? 0, rec: leader.targets?.rec ?? 0,
  });
  const group = view.groups.find((g) => g.groupId === edit.groupId) ?? null;
  const options = [
    ...view.groups.map((g) => ({ key: g.groupId, label: g.name, hint: t.leaders({ n: g.leaders }) })),
    { key: NO_GROUP, label: t.noGroup },
    { key: NEW_GROUP, label: t.newGroup },
  ];
  return (
    <ResponsiveSheet
      open
      title={leader.name}
      description={leader.agentCode ?? undefined}
      onClose={onClose}
      footer={<Button className={WIDE} disabled={busy} onClick={() => onSave(edit)}>{t.save}</Button>}
    >
      <h3 id={`${ids}-group`} className="mb-2 text-md font-bold text-ink">{t.group}</h3>
      <ChoiceRows
        labelledBy={`${ids}-group`}
        options={options}
        value={edit.groupId ?? NO_GROUP}
        onChange={(key) => {
          if (key === NEW_GROUP) { onNewGroup(); return; }
          const groupId = key === NO_GROUP ? null : key;
          setEdit((e) => ({ ...e, groupId, isGroupLeader: groupId === null ? false : e.isGroupLeader }));
        }}
      />
      <h3 className="mb-2 mt-4 text-md font-bold text-ink">{t.tags}</h3>
      <div className="flex flex-col gap-2 rounded-row bg-card px-3 py-2">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-md font-semibold text-ink">★ {t.groupLeader}</span>
            <span id={`${ids}-lead`} className="block text-sm text-muted">
              {group ? t.leadsGroup({ name: group.name }) : t.chooseGroupFirst}
            </span>
          </span>
          <Switch
            id={`${ids}-head`}
            label={`★ ${t.groupLeader}`}
            className="[&>label]:sr-only"
            describedBy={`${ids}-lead`}
            checked={edit.isGroupLeader}
            disabled={group === null}
            phoneTarget
            tabletTarget
            onChange={(isGroupLeader) => setEdit((e) => ({ ...e, isGroupLeader }))}
          />
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-md font-semibold text-ink">{t.coreLeader}</span>
          <Switch
            id={`${ids}-core`}
            label={t.coreLeader}
            className="[&>label]:sr-only"
            checked={edit.isCoreLeader}
            phoneTarget
            tabletTarget
            onChange={(isCoreLeader) => setEdit((e) => ({ ...e, isCoreLeader }))}
          />
        </div>
      </div>
      {leader.targets !== null && view.canEditTargets && (
        <>
          <h3 className="mb-2 mt-4 text-md font-bold text-ink">{t.targetYear({ year: view.year })}</h3>
          <div className="flex flex-col gap-2 rounded-row bg-card px-3 py-2">
            {([['aa', t.aaTarget], ['rec', t.recTarget]] as const).map(([key, label]) => (
              <div key={key} className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-md font-semibold text-ink">{label}</span>
                <Stepper label={label} value={edit[key]} min={0} max={1000} onChange={(n) => setEdit((e) => ({ ...e, [key]: n }))} />
              </div>
            ))}
          </div>
        </>
      )}
      <SheetError error={error} />
    </ResponsiveSheet>
  );
}

/**
 * ***Atur group* for every ticked leader** (UI-199: *"Atur group" opens the Group choice sheet for all ticked leaders*):
 * the groups, *Tanpa group* and *+ Group baru* as choice rows, *Simpan* pinned. One request for them all.
 */
export function SetGroupSheet({
  view, count, busy, error, onSave, onNewGroup, onClose,
}: {
  view: CoreLeadersView;
  count: number;
  busy: boolean;
  error: ApiError | null;
  onSave: (groupId: string | null) => void;
  onNewGroup: () => void;
  onClose: () => void;
}) {
  const t = useMessages(coreLeadersMessages);
  const ids = useId();
  const [choice, setChoice] = useState<string>(view.groups[0]?.groupId ?? NO_GROUP);
  return (
    <ResponsiveSheet
      open
      title={t.setGroupTitle}
      description={t.setGroupLine({ n: count })}
      onClose={onClose}
      footer={<Button className={WIDE} disabled={busy} onClick={() => onSave(choice === NO_GROUP ? null : choice)}>{t.save}</Button>}
    >
      <h3 id={`${ids}-group`} className="mb-2 text-md font-bold text-ink">{t.group}</h3>
      <ChoiceRows
        labelledBy={`${ids}-group`}
        options={[
          ...view.groups.map((g) => ({ key: g.groupId, label: g.name, hint: t.leaders({ n: g.leaders }) })),
          { key: NO_GROUP, label: t.noGroup },
          { key: NEW_GROUP, label: t.newGroup },
        ]}
        value={choice}
        onChange={(key) => (key === NEW_GROUP ? onNewGroup() : setChoice(key))}
      />
      <SheetError error={error} />
    </ResponsiveSheet>
  );
}

/**
 * ***Kelola group*** on a phone and a tablet (UI-199): each group with *"★ HEAD · n leader"* — amber *Belum ada group
 * leader* when it has none — and *+ Group baru* pinned. A row opens its group.
 */
export function ManageGroupsSheet({
  view, onOpen, onNew, onClose,
}: {
  view: CoreLeadersView;
  onOpen: (group: CoreLeaderGroup) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const t = useMessages(coreLeadersMessages);
  return (
    <ResponsiveSheet
      open
      title={t.manage}
      description={t.manageSheetLine({ groups: view.groups.length, none: view.counts.withoutGroup })}
      onClose={onClose}
      footer={<Button className={WIDE} onClick={onNew}>{t.newGroup}</Button>}
    >
      <ul className="flex flex-col divide-y divide-divider rounded-row bg-card">
        {view.groups.map((g) => (
          <li key={g.groupId}>
            <button
              type="button"
              onClick={() => onOpen(g)}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover-row"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-md font-bold text-ink">{g.name}</span>
                <span className="block text-sm text-muted">
                  {g.headName !== null
                    ? <span className="uppercase">{t.headLine({ name: g.headName })}</span>
                    : <span className="text-pill-amber-ink">{t.noHead}</span>}
                  {` · ${t.leaders({ n: g.leaders })}`}
                </span>
              </span>
              <span aria-hidden="true" className="text-lg text-muted">›</span>
            </button>
          </li>
        ))}
      </ul>
    </ResponsiveSheet>
  );
}

/**
 * **One group** (UI-199's group sheet; the desktop's *Kelola group* popup): **Nama group** (typed in capitals), **★ Group
 * leader** as choice rows of its leaders — a Core leader marked *★ Core* — or *Belum ditunjuk*, **+ Tambah leader ke
 * group**, and a white red-outline *Hapus* beside the orange *Simpan*. A new group has no leader to appoint yet.
 */
export function GroupSheet({
  group, view, busy, error, onSave, onAddLeaders, onDelete, onClose,
}: {
  /** `null`: *+ Group baru*. */
  group: CoreLeaderGroup | null;
  view: CoreLeadersView;
  busy: boolean;
  error: ApiError | null;
  onSave: (name: string, headMembershipId: string | null) => void;
  onAddLeaders: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useMessages(coreLeadersMessages);
  const ids = useId();
  const [name, setName] = useState(group?.name ?? '');
  const [head, setHead] = useState<string>(group?.headMembershipId ?? NO_GROUP);
  const [missing, setMissing] = useState(false);
  useEffect(() => { setMissing(false); }, [name]);
  const members = group ? view.leaders.filter((l) => l.groupId === group.groupId) : [];
  const typed = name.trim().toUpperCase();
  const needName = (go: () => void) => () => (typed === '' ? setMissing(true) : go());
  return (
    <ResponsiveSheet
      open
      title={group?.name ?? t.newGroupTitle}
      description={t.leaders({ n: members.length })}
      onClose={onClose}
      footer={(
        <div className="flex gap-2">
          {group && (
            <Button variant="danger" className="shrink-0" disabled={busy} onClick={onDelete}>{t.delete}</Button>
          )}
          <Button
            className="flex-1 justify-center"
            disabled={busy}
            onClick={needName(() => onSave(typed, head === NO_GROUP ? null : head))}
          >
            {t.save}
          </Button>
        </div>
      )}
    >
      <label htmlFor={`${ids}-name`} className="mb-2 block text-md font-bold text-ink">{t.groupName}</label>
      <TextInput
        id={`${ids}-name`}
        value={name}
        placeholder={t.groupNameExample}
        maxLength={80}
        invalid={missing}
        aria-describedby={missing ? `${ids}-missing` : undefined}
        className="uppercase"
        onChange={(e) => setName(e.target.value)}
      />
      {missing && <p id={`${ids}-missing`} role="alert" className="mt-1 text-sm text-alert">{t.groupNameMissing}</p>}
      <h3 id={`${ids}-head`} className="mb-2 mt-4 text-md font-bold text-ink">★ {t.groupLeader}</h3>
      {members.length > 0 ? (
        <ChoiceRows
          labelledBy={`${ids}-head`}
          options={[
            ...members.map((l) => ({ key: l.membershipId, label: l.name, hint: l.isCoreLeader ? `★ ${t.core}` : undefined })),
            { key: NO_GROUP, label: t.notAppointed },
          ]}
          value={head}
          onChange={setHead}
        />
      ) : (
        <p className="rounded-row bg-card px-3 py-3 text-md text-muted">{t.noLeadersInGroup}</p>
      )}
      <Button variant="secondary" className={cn(WIDE, 'mt-3')} disabled={busy} onClick={needName(() => onAddLeaders(typed))}>
        {t.addLeaders}
      </Button>
      <SheetError error={error} />
    </ResponsiveSheet>
  );
}

/** ***Hapus* asks first** (UI-199): *"Hapus group X?"* · *"n leader di group ini akan jadi Tanpa group. Tag Core leader tetap."* · Batal · Hapus. */
export function DeleteGroupSheet({
  group, busy, error, onConfirm, onClose,
}: {
  group: CoreLeaderGroup;
  busy: boolean;
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useMessages(coreLeadersMessages);
  return (
    <ResponsiveSheet
      open
      title={t.deleteQuestion({ name: group.name })}
      onClose={onClose}
      footer={(
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 justify-center" disabled={busy} onClick={onClose}>{t.cancel}</Button>
          <Button variant="danger" className="flex-1 justify-center" disabled={busy} onClick={onConfirm}>{t.delete}</Button>
        </div>
      )}
    >
      <p className="text-md text-ink">{t.deleteLine({ n: group.leaders })}</p>
      <SheetError error={error} />
    </ResponsiveSheet>
  );
}
