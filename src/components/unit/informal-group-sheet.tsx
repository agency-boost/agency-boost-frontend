'use client';

import { useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { createGroup } from '@/lib/org';
import { addGroupMembers, firstName, type GroupMembersAdded, type UnitInformal } from '@/lib/unit-dashboard';

/**
 * ***+ Tambah ke grup*** (the client's message of 11 November 2026, item 7; ADR-0249 §4; `functional/unit-dashboard.md`,
 * *Views*): from *Grup informal*'s line, the Owner or an Admin (`member:tag_group`) ticks the ABs below the head who are
 * in none of the head's groups, and adds them to one — **in place**, on the dashboard, rather than one person at a time
 * in *People › Groups*.
 *
 * - **The ABs** are the server's (`informal.abs`, A to Z), each a 44px row with its checkbox; nobody is ticked to begin.
 * - **The group**: the head's live groups, the first chosen — a picker when there are several. **With none**, adding
 *   makes one, ***"Grup {first name}"***, owned by the head (`POST /members/groups`), then tags into it.
 * - **The add** is one request (`POST /members/groups/:groupId/members`): the server checks every id and the group
 *   before it writes anything, and records one entry per person. A tag is a label; nobody sees more for it.
 *
 * Its states (L-01): the add waits with its button disabled; a refusal stays in the sheet, in `toDisplayError`'s words.
 */
export function InformalGroupSheet({
  informal, head, onClose, onAdded,
}: {
  informal: UnitInformal;
  head: { membershipId: string; name: string };
  onClose: () => void;
  onAdded: (result: GroupMembersAdded) => void;
}) {
  const t = useMessages(unitDashboardMessages).views;
  const listId = useId();
  const abs = informal.abs ?? [];
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const [groupId, setGroupId] = useState<string | null>(informal.groups[0]?.groupId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const newName = t.sheet.newGroupName({ first: firstName(head.name) });

  const toggle = (id: string, on: boolean) => setTicked((now) => {
    const next = new Set(now);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });

  const add = async () => {
    if (ticked.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      let target = groupId;
      if (target === null) {
        // The head owns none: one is made for them, named after them, and the ABs go into it.
        const groups = await createGroup(newName, head.membershipId);
        target = groups.find((g) => g.name === newName && g.ownerMembershipId === head.membershipId)?.groupId ?? null;
        if (target === null) throw new Error(t.sheet.failed);
        setGroupId(target);
      }
      onAdded(await addGroupMembers(target, [...ticked]));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveSheet
      open
      title={t.sheet.title}
      description={t.sheet.line({ name: head.name })}
      onClose={onClose}
      footer={(
        <Button className="w-full max-lg:min-h-11" disabled={ticked.size === 0 || busy} onClick={add}>
          {t.sheet.add({ n: ticked.size })}
        </Button>
      )}
    >
      <div data-informal-sheet="" className="space-y-3">
        {informal.groups.length > 1 ? (
          <PickerMenu
            label={t.sheet.group}
            value={groupId ?? informal.groups[0].groupId}
            options={informal.groups.map((g) => ({ value: g.groupId, label: g.name }))}
            onChange={setGroupId}
          />
        ) : informal.groups.length === 1 ? (
          <p className="text-md text-ink">
            <span className="text-muted">{t.sheet.group}: </span>
            <span className="font-semibold">{informal.groups[0].name}</span>
          </p>
        ) : (
          <p data-new-group="" className="text-md text-muted">{t.sheet.newGroup({ head: head.name, name: newName })}</p>
        )}

        <fieldset aria-describedby={ticked.size === 0 ? `${listId}-hint` : undefined}>
          <legend className="text-sm font-semibold text-muted">{t.sheet.people}</legend>
          <ul className="mt-1 divide-y divide-divider">
            {abs.map((p) => (
              <li key={p.membershipId}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-md text-ink">
                  <input
                    type="checkbox"
                    checked={ticked.has(p.membershipId)}
                    onChange={(e) => toggle(p.membershipId, e.target.checked)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-secondary"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
          {ticked.size === 0 && <p id={`${listId}-hint`} className="mt-1 text-sm text-muted">{t.sheet.chooseOne}</p>}
        </fieldset>

        {error && <ErrorBanner {...error} />}
      </div>
    </ResponsiveSheet>
  );
}

export default InformalGroupSheet;
