'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useState } from 'react';
import { GroupCardMenu } from '@/components/groups/group-actions';
import { Avatar } from '@/components/ui/avatar';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  monthsBetween, readSubgroup, type DriverFigure, type InformalAbGroup, type InformalDrivers, type InformalGroupCard,
  type SheetDriver, type Subgroup,
} from '@/lib/advanced-analytics-page';
import { cn } from '@/lib/cn';
import { formatMonth, formatNumber, formatPercent } from '@/lib/format';
import type { InformalGroup } from '@/lib/informal-groups';
import { MonthPicker, NoData, PersonName, ProgressBar, SectionError, SectionLoading, TabControls, TONE_OUTLINE, TONE_TILE } from './shared';

/** The sheets and the two dialogs load when they are opened (the bundle). */
const InformalGroupSheet = dynamic(() => import('./informal-group-sheet').then((m) => m.InformalGroupSheet), { ssr: false });
const GroupDialog = dynamic(() => import('@/components/groups/group-dialog'), { ssr: false });

/** How far back the month picker goes: two years. */
const PICKER_MONTHS = 24;

/** A driver's figure as a tile or a pill writes it: *5/8*, *8,5/16*, *74%*; *–* for a missing half. */
function figureText(f: DriverFigure, language: Language, decimals = 0): { value: string; target: string | null } {
  return {
    value: f.value === null ? '–' : formatNumber(f.value, { maxDecimals: decimals }, language),
    target: f.target === null ? null : formatNumber(f.target, { maxDecimals: decimals }, language),
  };
}

/**
 * ***Informal group*** (P19.22-T5; ADR-0275 §5; the approved `advanced-analytics-*` frames 30–40) — *Perbaikan
 * sub-group*, renamed. A month dropdown and *"Sama dengan Overview › Performa vs target"* only. The navy **Total KPM** with
 * four drivers coloured by progress (green ≥ 100%, yellow ≥ 67%, red below): Monthly Active Agent, Pemakaian
 * AgencyBoost, 1-on-1 per minggu, Rekrut YTD. Then **one card per informal group** — its Group Leaders, *n leader · n
 * orang*, *n AB group*, ⋯ (*Ubah nama · Ubah group leader · Hapus group*) — the drivers as bars on the orange tint, the
 * first open; open, **its AB groups**, each with the four drivers as outlined pills that open the people behind them and
 * a *Group* button (the Group dialog).
 *
 * **The forum shows it as it is** (P19.22-T8, ADR-0276): `components/leader-forum/forum-screen.tsx` imports this.
 * `canUpload` only adds *Unggah data* to the empty state. Nothing writable in a Super Admin's platform read.
 */
export function SubgroupSection({ platformKpmId, canUpload = false }: { platformKpmId?: string; canUpload?: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const s = t.subgroup;
  const language = useFigureLanguage();
  const monthId = useId();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [view, setView] = useState<Subgroup | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [sheet, setSheet] = useState<null | { ab: InformalAbGroup['ab']; driver: SheetDriver }>(null);
  const [grouping, setGrouping] = useState<InformalAbGroup | null>(null);

  const load = useCallback((live: () => boolean = () => true) => {
    setError(null);
    readSubgroup({ month }, platformKpmId)
      .then((answer) => { if (live()) setView(answer); })
      .catch((err) => { if (live()) setError(toDisplayError(err)); });
  }, [month, platformKpmId]);
  useEffect(() => {
    let live = true;
    load(() => live);
    return () => { live = false; };
  }, [load]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const write = view.canWrite && platformKpmId === undefined;
  const keyOf = (card: InformalGroupCard) => card.group?.groupId ?? 'none';
  const opened = open ?? new Set(view.groups.slice(0, 1).map(keyOf));
  const toggle = (key: string) => setOpen(() => {
    const next = new Set(opened);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const year = view.month.slice(0, 4);
  const earliest = monthsBetween(view.earliestMonth, view.currentMonth).slice(0, PICKER_MONTHS);

  return (
    <div data-section="subgroup">
      <TabControls note={s.note}>
        <MonthPicker
          id={monthId}
          label={t.filters.month}
          months={earliest}
          value={view.month}
          onChange={setMonth}
          format={(x) => formatMonth(x, language)}
        />
      </TabControls>

      <section data-total="" className="mb-4 rounded-card bg-secondary p-4 text-secondary-contrast">
        <h2 className="mb-3 font-bold">{s.total({ groups: view.total.groups, leaders: view.total.leaders, people: view.total.people })}</h2>
        <DriverTiles drivers={view.total.drivers} year={year} variant="total" />
      </section>

      {view.groups.length === 0 ? (
        <div className="rounded-card bg-card">
          <p className="px-4 pt-4 text-center text-md text-muted">{s.empty}</p>
          <NoData canUpload={canUpload && platformKpmId === undefined} />
        </div>
      ) : (
        <div className="space-y-3">
          {view.groups.map((card) => (
            <GroupCard
              key={keyOf(card)}
              card={card}
              year={year}
              open={opened.has(keyOf(card))}
              onToggle={() => toggle(keyOf(card))}
              canWrite={write}
              onChanged={() => load()}
              onSheet={platformKpmId === undefined ? (ab, driver) => setSheet({ ab, driver }) : undefined}
              onGroup={setGrouping}
            />
          ))}
        </div>
      )}

      {sheet && (
        <InformalGroupSheet
          ab={sheet.ab}
          driver={sheet.driver}
          month={view.month}
          canWrite={write}
          onClose={() => setSheet(null)}
          onTargetSaved={() => load()}
        />
      )}
      {grouping && (
        <GroupDialog
          ab={{ membershipId: grouping.ab.membershipId, name: grouping.ab.name, role: t.role.ab, people: grouping.people }}
          onClose={() => setGrouping(null)}
          onSaved={() => { setGrouping(null); load(); }}
        />
      )}
    </div>
  );
}

/** The forum's name for it: the informal-group section is this one. */
export const InformalGroupSection = SubgroupSection;

/** The four drivers as tiles: on navy (*Total KPM*, coloured by progress) or on the orange tint (a group card, a bar). */
function DriverTiles({ drivers, year, variant }: { drivers: InformalDrivers; year: string; variant: 'total' | 'card' }) {
  const s = useMessages(advancedAnalyticsPageMessages).subgroup;
  const language = useFigureLanguage();
  const pct = (v: number | null) => (v === null ? '–' : formatPercent(v, {}, language));
  const total = variant === 'total';
  const tile = (key: string, label: string, f: { value: string; target: string | null }, tone: DriverFigure['tone'], barPct: number | null, sub: string) => (
    <div
      key={key}
      data-driver={key}
      data-tone={tone ?? 'none'}
      className={cn('rounded-row p-3', total ? (tone ? TONE_TILE[tone] : 'bg-pill-grey text-pill-grey-ink') : 'bg-today text-navy')}
    >
      <p className="text-sm font-bold">{label}</p>
      <p className={cn('font-extrabold tabular-nums', total ? 'text-2xl md:text-3xl' : 'text-xl')}>
        {f.value}
        {f.target !== null && <span className={cn('font-semibold', total ? 'text-xl' : 'text-md text-muted')}>{`/${f.target}`}</span>}
      </p>
      {!total && <ProgressBar pct={barPct} tone={tone} className="my-1.5" track="bg-card" />}
      <p className={cn('text-sm', total ? 'font-semibold' : 'text-muted')}>{sub}</p>
    </div>
  );
  const usage = drivers.usage;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tile('maa', s.drivers.maa, figureText(drivers.maa, language), drivers.maa.tone, drivers.maa.pct, total ? s.maaSub : s.mtd)}
      {tile('usage', total ? s.drivers.usage : s.drivers.usageShort, { value: pct(usage.downlinePct ?? usage.leaderPct), target: null }, usage.tone,
        usage.downlinePct ?? usage.leaderPct, s.usageSub({ pct: pct(usage.leaderPct) }))}
      {tile('oneOnOne', total ? s.drivers.oneOnOne : s.drivers.oneOnOneCard, figureText(drivers.oneOnOne, language, 1), drivers.oneOnOne.tone,
        drivers.oneOnOne.pct, s.oneOnOneSub)}
      {tile('rekrut', total ? s.drivers.rekrut({ year }) : s.drivers.rekrutCard, figureText(drivers.rekrut, language), drivers.rekrut.tone,
        drivers.rekrut.pct, s.rekrutSub)}
    </div>
  );
}

/** One informal group's card: its head, the four drivers, and — open — its AB groups. */
function GroupCard({
  card, year, open, onToggle, canWrite, onChanged, onSheet, onGroup,
}: {
  card: InformalGroupCard;
  year: string;
  open: boolean;
  onToggle: () => void;
  canWrite: boolean;
  onChanged: () => void;
  onSheet?: (ab: InformalAbGroup['ab'], driver: SheetDriver) => void;
  onGroup: (row: InformalAbGroup) => void;
}) {
  const s = useMessages(advancedAnalyticsPageMessages).subgroup;
  const listId = useId();
  const name = card.group?.name ?? s.noGroup;
  const leaders = card.leaders.map((l) => l.name.toUpperCase()).join(', ');
  const asGroup: InformalGroup | null = card.group && {
    groupId: card.group.groupId,
    name: card.group.name,
    leaders: card.leaders.map((l) => ({ membershipId: l.membershipId, name: l.name })),
    abs: card.abGroups.map((r) => ({
      membershipId: r.ab.membershipId, name: r.ab.name, agentCode: r.ab.agentCode, isGroupLeader: r.ab.isGroupLeader,
      isCoreLeader: r.ab.isCoreLeader, people: r.people, leaders: r.leaders,
    })),
    counts: card.counts,
  };
  const head = card.leaders[0];
  return (
    <section
      data-group={card.group?.groupId ?? 'none'}
      className={cn('relative overflow-hidden rounded-card bg-card', open && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[""]')}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        {head
          ? <Avatar name={head.name} photoUrl={head.photoUrl} seed={head.membershipId} size={36} />
          : <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full bg-pill-grey" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-navy">{name}</h3>
          <p className="text-sm text-muted">
            {card.group && `${card.leaders.length > 0 ? s.groupLeaders({ names: leaders }) : s.noGroupLeader} · `}
            {s.counts({ leaders: card.counts.leaders, people: card.counts.people })}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-sm font-bold text-primary-ink">{s.abGroups({ n: card.counts.abGroups })}</span>
        {canWrite && asGroup && <GroupCardMenu group={asGroup} onChanged={() => onChanged()} />}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? s.closeCard({ name }) : s.openCard({ name })}
          onClick={onToggle}
          className="-mr-2 -mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center text-primary-ink"
        >
          <LineIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-5 w-5" />
        </button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <DriverTiles drivers={card.drivers} year={year} variant="card" />
      </div>
      {open && (
        <ul id={listId} className="divide-y divide-divider border-t border-divider">
          {card.abGroups.map((row) => (
            <AbGroupRow key={row.ab.membershipId} row={row} canWrite={canWrite} onSheet={onSheet} onGroup={() => onGroup(row)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One AB group: the AB, *n orang di grupnya*, the four drivers as outlined pills, and *Group*. */
function AbGroupRow({ row, canWrite, onSheet, onGroup }: {
  row: InformalAbGroup;
  canWrite: boolean;
  onSheet?: (ab: InformalAbGroup['ab'], driver: SheetDriver) => void;
  onGroup: () => void;
}) {
  const s = useMessages(advancedAnalyticsPageMessages).subgroup;
  const language = useFigureLanguage();
  const d = row.drivers;
  const ratio = (f: DriverFigure, decimals = 0) => {
    const x = figureText(f, language, decimals);
    return x.target === null ? x.value : `${x.value} / ${x.target}`;
  };
  const usage = d.usage.downlinePct ?? d.usage.leaderPct;
  const pills: { driver: SheetDriver; label: string; text: string; tone: DriverFigure['tone'] }[] = [
    { driver: 'maa', label: s.drivers.maaShort, text: ratio(d.maa), tone: d.maa.tone },
    { driver: 'usage', label: s.drivers.usageShort, text: usage === null ? '–' : formatPercent(usage, {}, language), tone: d.usage.tone },
    { driver: 'coaching', label: s.drivers.oneOnOneShort, text: ratio(d.oneOnOne, 1), tone: d.oneOnOne.tone },
    { driver: 'rekrut', label: s.drivers.rekrutShort, text: ratio(d.rekrut), tone: d.rekrut.tone },
  ];
  return (
    <li data-ab-group={row.ab.membershipId} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,14rem)_repeat(4,minmax(0,1fr))_auto] md:items-center">
      <PersonName person={row.ab} size={32} meta={s.inGroup({ n: row.people })} />
      <div className="grid grid-cols-2 gap-2 md:contents">
        {pills.map((p) => (
          <div key={p.driver} className="min-w-0">
            <p className="text-xs text-muted">{p.label}</p>
            {onSheet ? (
              <button
                type="button"
                onClick={() => onSheet(row.ab, p.driver)}
                aria-label={s.openSheet({ what: `${p.label} ${p.text}`, name: row.ab.name })}
                className={cn('mt-0.5 inline-flex min-h-9 items-center rounded-pill border-2 bg-card px-2.5 text-sm font-bold tabular-nums', p.tone ? TONE_OUTLINE[p.tone] : 'border-line text-ink')}
              >
                {p.text}
              </button>
            ) : (
              <span className={cn('mt-0.5 inline-flex min-h-9 items-center rounded-pill border-2 px-2.5 text-sm font-bold tabular-nums', p.tone ? TONE_OUTLINE[p.tone] : 'border-line text-ink')}>
                {p.text}
              </span>
            )}
          </div>
        ))}
      </div>
      {canWrite && (
        <button type="button" onClick={onGroup} className="inline-flex min-h-11 items-center gap-1 justify-self-start text-sm font-semibold text-navy md:justify-self-end">
          <LineIcon name="link" className="h-4 w-4" />
          {s.groupButton}
        </button>
      )}
    </li>
  );
}
