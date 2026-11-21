'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PickerMenu, type PickerItem } from '@/components/ui/picker-menu';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import {
  groupParam, MULTI_ITEM, readOverviewCompliance, visibleRows, type ComplianceCategory, type ComplianceCell,
  type ComplianceView, type KpmOverviewView, type OverviewGroupRef, type OverviewPerson,
} from '@/lib/kpm-overview';
import { FilterTiles, PeopleTree, StatusTile } from './people-tree';
import { AchievedCell } from './standing-override';

/** The module's words, as a type. */
type Words = MessagesOf<(typeof kpmOverviewMessages)['en']>;

/**
 * **A card's list** (P19.19-T3 AC-3): read for the card, and again for each item picked. The tree is the page's own
 * people, each drawn with their cell; a person the item does not apply to is shown only for their team, with no tile.
 */
export function ComplianceDialog({
  category, view, group: chosen, catalog, onClose,
}: {
  category: ComplianceCategory; view: KpmOverviewView; group: OverviewGroupRef | null; catalog: ComplianceView; onClose: () => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const [item, setItem] = useState<string | null>(null);
  const [read, setRead] = useState<ComplianceView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<'notDone' | 'done'>('notDone');
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const group = groupParam(chosen);

  useEffect(() => {
    let live = true;
    setError(null);
    readOverviewCompliance({ group, category, item })
      .then((next) => { if (live) setRead(next); })
      .catch((err: unknown) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [group, category, item, attempt]);

  const selected = read?.selected ?? null;
  const cells = useMemo(() => new Map((selected?.cells ?? []).map((c) => [c.membershipId, c])), [selected]);
  const cellOf = (p: OverviewPerson): ComplianceCell | undefined => cells.get(p.membershipId);
  const name = t.category[category];
  const groups = view.groups.filter((g) => view.group === null || g.groupId === view.group.groupId);
  const want = filter === 'done';
  const tree = selected ? visibleRows(view.people, groups, (p) => cellOf(p)?.done === want) : [];
  const counts = { done: selected?.done ?? 0, notDone: (selected?.of ?? 0) - (selected?.done ?? 0) };
  const campaign = category === 'campaigns' && selected?.item
    ? catalog.catalog.campaigns.find((c) => c.code === selected.item) ?? null : null;

  const picker = MULTI_ITEM.has(category) && read ? pickerFor(category, read, selected?.item ?? null, t) : null;
  const title = selected
    ? t.dialogTitle({ name, done: formatNumber(selected.done, {}, figures), of: formatNumber(selected.of, {}, figures) })
    : name;
  const scope = view.group === null ? t.allGroups : view.group.name ?? t.noGroup;

  return (
    <Modal open title={title} description={category === 'training' ? `${t.perModule} · ${scope}` : scope} onClose={onClose} closeLabel={t.close}>
      <div data-compliance-dialog={category} className="flex flex-col gap-2">
        {picker && (
          <PickerMenu
            label={t.pickItem}
            value={picker.value}
            options={picker.options}
            buttonLabel={picker.label}
            onChange={(v) => setItem(v === ALL ? null : v)}
            className="w-full"
          />
        )}
        {error ? (
          <>
            <ErrorBanner {...error} />
            <Button variant="secondary" onClick={reload}>{t.tryAgain}</Button>
          </>
        ) : !selected ? (
          <Skeleton label={t.loading}><SkeletonBar className="h-40 w-full" /></Skeleton>
        ) : (
          <div className="-mx-1 overflow-hidden rounded-lg">
            <FilterTiles
              label={title}
              value={filter}
              onChange={setFilter}
              tiles={[
                { key: 'notDone', label: t.notDone, tone: 'red', count: counts.notDone },
                { key: 'done', label: t.done, tone: 'green', count: counts.done },
              ]}
            />
            <PeopleTree
              preview={false}
              label={want ? t.done : t.notDone}
              tree={tree}
              tile={(p) => {
                const cell = cellOf(p);
                if (!cell || cell.done === null) return null;
                return (
                  <span className="flex items-center gap-1">
                    <StatusTile tone={cell.done ? 'green' : 'red'}>{cell.done ? t.done : t.notDone}</StatusTile>
                    {campaign && (cell.second || cell.overridable) && (
                      <AchievedCell
                        row={{ membershipId: p.membershipId, name: p.name, cell }}
                        campaign={{ code: campaign.code, title: campaign.title }}
                        canOverride={read?.can.override ?? false}
                        onChanged={reload}
                      />
                    )}
                  </span>
                );
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/** *Semua event* / *Semua campaign*: the card's own figure, every item at once. */
const ALL = '__all__';

/** The picker of a card that holds several items: Training's modules grouped by category, the events, the campaigns. */
function pickerFor(
  category: ComplianceCategory, read: ComplianceView, item: string | null,
  t: Words,
): { value: string; label: string; options: PickerItem<string>[] } | null {
  if (category === 'training') {
    const options = read.catalog.training
      .filter((c) => c.skills.some((s) => s.modules.length > 0))
      .map((c) => ({ group: c.label, options: c.skills.flatMap((s) => s.modules.map((m) => ({ value: m.code, label: m.title }))) }));
    const title = read.catalog.training.flatMap((c) => c.skills.flatMap((s) => s.modules)).find((m) => m.code === item)?.title;
    if (!item || !title) return null;
    return { value: item, label: t.module({ name: title }), options };
  }
  if (category === 'events') {
    const title = read.catalog.events.find((e) => e.id === item)?.title;
    return {
      value: item ?? ALL,
      label: title ? t.event({ name: title }) : t.allEvents,
      options: [{ value: ALL, label: t.allEvents }, ...read.catalog.events.map((e) => ({ value: e.id, label: e.title }))],
    };
  }
  const title = read.catalog.campaigns.find((c) => c.code === item)?.title;
  return {
    value: item ?? ALL,
    label: title ? t.campaign({ name: title }) : t.allCampaigns,
    options: [{ value: ALL, label: t.allCampaigns }, ...read.catalog.campaigns.map((c) => ({ value: c.code, label: c.title }))],
  };
}
