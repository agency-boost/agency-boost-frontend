'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { groupsMessages } from '@/i18n/messages/groups';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readInformalGroups, type InformalGroupAb, type InformalGroupsView } from '@/lib/informal-groups';
import { GroupCardMenu } from './group-actions';
import { GroupDialog } from './group-dialog';
import { TargetDialog } from './target-dialog';

/**
 * **One informal group's AB groups, each with its *Target* and *Group*** (P19.17-T4; ADR-0270; parity I-1077): what
 * Advanced analytics › *Informal group*'s rows open until that tab is rebuilt with the AB-group rows of the approved
 * mockup. The group's — or *Tanpa group*'s — ABs, *n orang di grupnya*, and on each the target card (`TargetDialog`) and
 * the Group dialog (`GroupDialog`); on a real group, its ⋯ (`GroupCardMenu`). Every change re-reads the groups and tells
 * the page (`onChanged`), whose figures move with them.
 */
export function GroupAbsSheet({
  groupId, title, onClose, onChanged,
}: {
  /** The group, or `null` for *Tanpa group*. */
  groupId: string | null;
  /** The row's name, for the sheet's title while it reads. */
  title: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useMessages(groupsMessages);
  const [view, setView] = useState<InformalGroupsView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [open, setOpen] = useState<null | { kind: 'target' | 'group'; ab: InformalGroupAb }>(null);

  const load = useCallback(() => {
    setError(null);
    return readInformalGroups().then(setView).catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changed = (next?: InformalGroupsView) => {
    setOpen(null);
    if (next) setView(next);
    else void load();
    onChanged();
  };

  const group = view && groupId !== null ? view.groups.find((g) => g.groupId === groupId) ?? null : null;
  const abs = view ? (groupId === null ? view.ungrouped.abs : group?.abs ?? []) : [];
  const counts = view ? (groupId === null ? view.ungrouped.counts : group?.counts) : undefined;
  const name = group?.name ?? title;

  return (
    <>
      <ResponsiveSheet
        open={open === null}
        title={t.sheet.open({ name })}
        description={counts ? t.sheet.line({ abs: counts.abGroups, n: counts.people }) : undefined}
        onClose={onClose}
      >
        <div data-group-abs="" className="pb-2">
          {group && view?.canWrite && (
            <div className="mb-2 flex justify-end">
              <GroupCardMenu group={group} onChanged={(next) => { changed(next); if (!next.groups.some((g) => g.groupId === group.groupId)) onClose(); }} />
            </div>
          )}
          {view ? (
            abs.length === 0 ? (
              <p className="text-md text-muted">{t.sheet.none}</p>
            ) : (
              <ul className="divide-y divide-divider">
                {abs.map((ab) => (
                  <li key={ab.membershipId} className="flex min-h-14 flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-navy [overflow-wrap:anywhere]">
                        <span className="mr-1 text-sm font-bold text-primary-ink">AB</span>{ab.name}
                      </span>
                      <span className="block text-sm text-muted">
                        {t.sheet.inGroup({ n: ab.people })}
                        {ab.isGroupLeader && <span className="ml-2 font-bold text-primary-ink">{t.card.groupLeader}</span>}
                      </span>
                    </span>
                    {view.canWrite && (
                      <span className="flex gap-2">
                        <Button variant="secondary" className="min-h-11 rounded-pill px-3 text-sm" aria-label={t.sheet.targetOf({ name: ab.name })}
                          onClick={() => setOpen({ kind: 'target', ab })}>{t.sheet.target}</Button>
                        <Button variant="secondary" className="min-h-11 rounded-pill px-3 text-sm" aria-label={t.sheet.groupOf({ name: ab.name })}
                          onClick={() => setOpen({ kind: 'group', ab })}>{t.sheet.group}</Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : !error && (
            <Skeleton label={t.loading}>
              <div className="space-y-2"><SkeletonBar className="h-14 w-full" /><SkeletonBar className="h-14 w-full" /></div>
            </Skeleton>
          )}
          {error && <ErrorBanner {...error} />}
        </div>
      </ResponsiveSheet>
      {open?.kind === 'target' && (
        <TargetDialog ab={{ membershipId: open.ab.membershipId, name: open.ab.name }} onClose={() => setOpen(null)} onSaved={() => changed()} />
      )}
      {open?.kind === 'group' && (
        <GroupDialog
          ab={{ membershipId: open.ab.membershipId, name: open.ab.name, people: open.ab.people }}
          onClose={() => setOpen(null)}
          onSaved={(next) => changed(next)}
        />
      )}
    </>
  );
}

export default GroupAbsSheet;
