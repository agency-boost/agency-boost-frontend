'use client';

import { useId, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill, type PillTone as V1Tone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { cn } from '@/lib/cn';
import {
  complianceLabels, dayWords, pillOf, sortRows, trainingPathOf, treeKindOf,
  type ComplianceCategory, type ComplianceRow, type ComplianceSection, type ComplianceTrainingCategory,
  type ComplianceView, type PillWords, type SortDirection,
} from '@/lib/kpm-compliance';
import { useSession } from '@/lib/session';
import { CampaignPicker, EventPicker } from './compliance-pickers';

/**
 * **KPM Analytics' Compliance on a phone, in the field shell** (UI V1, 2026-10-30; UI-109; `kpm-mobile` 3):
 *
 * - *28 orang · 5 unit AB*, then **the six tiles three across**, each its count over its people and a bar — red below
 *   50% done, green from 80%, the accent between (`view.thresholds`, the server's) — and each the category's switch;
 * - the training module as **one picker** (*Modul Training · Building Your Prospect List ⌄*: category › skill › module
 *   inside a sheet) in place of three chip rows; an event's or a campaign's picker as it was;
 * - *Per AB* with the sort pill (*Perlu perhatian lebih dulu*), **one row per AB** — *x / y selesai* and its bar — that
 *   opens to its units (*Unit Arief Hidayat · AAB 1 / 3*) and their people, 44px each: the name (*Pribadi* on a
 *   leader's own line), the status as a tinted pill — *Selesai* green, *Berjalan* amber, *Belum dimulai* grey — and the
 *   day it was done on the right. Two pills on an event's or a campaign's row, as its two columns.
 *
 * The reader's own agency starts open. The office console and wider screens keep the tree as it was, the override of a
 * campaign standing included (the Owner's and the Admins', who read it there).
 */
export function V1Compliance({
  view, fresh, category, selected, emptyCategory, direction, onCategory, onTraining, onItem, onToggle,
}: {
  view: ComplianceView;
  fresh: boolean;
  category: ComplianceCategory;
  selected: string | null;
  emptyCategory: string | null;
  direction: SortDirection;
  onCategory: (category: ComplianceCategory) => void;
  onTraining: (category: ComplianceTrainingCategory) => void;
  onItem: (item: string) => void;
  onToggle: () => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const headId = useId();
  const listId = useId();
  const kind = treeKindOf(category);
  return (
    <div className="min-w-0" data-v1-compliance="">
      {view.units > 0 && <h2 id={headId} className="mx-0.5 mb-2 mt-1 text-md font-bold text-navy">{t.v1.head({ people: view.people, units: view.units })}</h2>}
      <div role="group" aria-label={t.chipsName} className="grid grid-cols-3 gap-2">
        {view.summary.map((chip) => (
          <Tile
            key={chip.category}
            label={t.chips[chip.category]}
            count={chip.count}
            of={chip.of}
            on={chip.category === category}
            thresholds={view.thresholds}
            onChoose={() => onCategory(chip.category)}
          />
        ))}
      </div>

      <Picker view={view} category={category} selected={selected} emptyCategory={emptyCategory} onTraining={onTraining} onItem={onItem} />

      {fresh && view.tree.length > 0 && (
        <>
          <div className="mx-0.5 mb-2 mt-3.5 flex min-h-11 items-center justify-between gap-3">
            <h2 id={listId} className="text-md font-bold text-navy">{t.v1.perAb}</h2>
            <button
              type="button"
              onClick={onToggle}
              className="flex min-h-11 items-center gap-1 rounded-pill bg-card px-3 text-base font-semibold text-navy"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
              </svg>
              {t.sort[kind][direction]}
            </button>
          </div>
          <Sections view={view} kind={kind} direction={direction} labelledBy={listId} />
        </>
      )}
    </div>
  );
}

/** A share's colour by the server's split: red below `lowBelowPct`, green from `highFromPct`, the accent between. */
function barTone(done: number, of: number, thresholds: ComplianceView['thresholds']): 'red' | 'green' | 'accent' | 'none' {
  if (of === 0) return 'none';
  const pct = (done / of) * 100;
  return pct < thresholds.lowBelowPct ? 'red' : pct >= thresholds.highFromPct ? 'green' : 'accent';
}

const BAR: Record<ReturnType<typeof barTone>, string> = {
  red: 'bg-signal-red', green: 'bg-signal-green', accent: 'bg-amber', none: 'bg-transparent',
};

function Bar({ done, of, thresholds, className }: { done: number; of: number; thresholds: ComplianceView['thresholds']; className?: string }) {
  const tone = barTone(done, of, thresholds);
  return (
    <span aria-hidden="true" className={cn('block h-1.5 overflow-hidden rounded-sm bg-base', className)} data-bar-tone={tone}>
      <span className={cn('block h-full', BAR[tone])} style={{ width: `${of === 0 ? 0 : Math.round((done / of) * 100)}%` }} />
    </span>
  );
}

/** One of the six: the category's name, *2 / 28*, the bar; pressed is the one the tree below reads. */
function Tile({
  label, count, of, on, thresholds, onChoose,
}: {
  label: string; count: number; of: number; on: boolean; thresholds: ComplianceView['thresholds']; onChoose: () => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onChoose}
      className={cn('min-h-11 rounded-lg bg-card p-2.5 text-left', on && 'ring-2 ring-inset ring-navy')}
    >
      <span className="block truncate text-sm text-muted">{label}</span>
      <span className="mt-0.5 block whitespace-nowrap text-xl font-bold leading-tight text-ink">
        {of === 0 ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t.noRate}</span>
          </>
        ) : (
          <>
            {count}
            <span className="ml-1 text-sm font-normal text-signal-grey">/ {of}</span>
          </>
        )}
      </span>
      <Bar done={count} of={of} thresholds={thresholds} className="mt-1.5" />
    </button>
  );
}

/** The selection: one training-module picker, or the event's or the campaign's as it was; nothing for the other three. */
function Picker({
  view, category, selected, emptyCategory, onTraining, onItem,
}: {
  view: ComplianceView;
  category: ComplianceCategory;
  selected: string | null;
  emptyCategory: string | null;
  onTraining: (category: ComplianceTrainingCategory) => void;
  onItem: (item: string) => void;
}) {
  const { catalog, today } = view;
  if (category === 'training' && catalog.training.length > 0) {
    return <ModulePicker catalog={catalog.training} selected={selected} emptyCategory={emptyCategory} onTraining={onTraining} onItem={onItem} />;
  }
  if (category === 'events' && catalog.events.length > 0) {
    return <div className="mt-2"><EventPicker events={catalog.events} selected={selected} today={today} onChoose={onItem} /></div>;
  }
  if (category === 'campaigns' && catalog.campaigns.length > 0) {
    return <div className="mt-2"><CampaignPicker campaigns={catalog.campaigns} selected={selected} today={today} onChoose={onItem} /></div>;
  }
  return null;
}

/** *Modul Training · {module} ⌄*: a 44px field opening the sheet of every category › skill › module. */
function ModulePicker({
  catalog, selected, emptyCategory, onTraining, onItem,
}: {
  catalog: readonly ComplianceTrainingCategory[];
  selected: string | null;
  emptyCategory: string | null;
  onTraining: (category: ComplianceTrainingCategory) => void;
  onItem: (item: string) => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const [open, setOpen] = useState(false);
  const path = trainingPathOf(catalog, selected);
  const chosen = path?.skill.modules.find((m) => m.code === selected) ?? null;
  const empty = catalog.find((c) => c.code === emptyCategory) ?? null;
  const shown = empty ? t.comingSoon({ name: empty.label }) : chosen?.title ?? t.v1.choose;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-row bg-card px-3 py-1 text-left"
        data-module-picker=""
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-amber-ink" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-5 9 5-9 5-9-5zM7 11.2V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.8M21 9v6" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted">{t.v1.modulePicker}</span>
          <span className="block truncate text-base font-bold text-ink">{shown}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <ResponsiveSheet open={open} title={t.v1.modulePicker} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          {catalog.map((cat) => (
            <section key={cat.code} aria-label={cat.label}>
              <h3 className="mb-1 text-base font-bold text-navy">{cat.label}</h3>
              {cat.skills.length === 0 ? (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onTraining(cat); }}
                  className="min-h-11 w-full rounded-row px-3 text-left text-base text-muted hover:bg-hover-row"
                >
                  {t.comingSoon({ name: cat.label })}
                </button>
              ) : cat.skills.map((skill) => (
                <div key={skill.code} className="mt-1">
                  <p className="px-1 text-sm font-semibold text-muted">{skill.label}</p>
                  <div role="radiogroup" aria-label={skill.label} className="mt-0.5 flex flex-col gap-1">
                    {skill.modules.map((m) => {
                      const on = m.code === selected;
                      return (
                        <button
                          key={m.code}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => { setOpen(false); onItem(m.code); }}
                          className={cn(
                            'flex min-h-11 items-center rounded-row px-3 text-left text-base',
                            on ? 'bg-amber/[0.12] font-semibold text-ink ring-[1.5px] ring-inset ring-amber' : 'bg-hover-row text-ink',
                          )}
                        >
                          {m.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </ResponsiveSheet>
    </>
  );
}

/** The AB rows, sorted *needs attention first* by the share done (or the other way), each opening to its units. */
function Sections({
  view, kind, direction, labelledBy,
}: { view: ComplianceView; kind: ReturnType<typeof treeKindOf>; direction: SortDirection; labelledBy: string }) {
  const { me } = useSession();
  const mine = me?.membership?.membershipId ?? null;
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(mine ? [mine] : []));
  const sections = useMemo(() => {
    const share = (s: ComplianceSection) => (s.of === 0 ? null : s.done / s.of);
    const rated = view.tree.filter((s) => share(s) !== null)
      .sort((a, b) => (direction === 'worst' ? share(a)! - share(b)! : share(b)! - share(a)!) || a.head.name.localeCompare(b.head.name));
    return [...rated, ...view.tree.filter((s) => share(s) === null)];
  }, [view.tree, direction]);
  const flip = (id: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return (
    <ul aria-labelledby={labelledBy} className="overflow-hidden rounded-lg bg-card">
      {sections.map((section) => (
        <SectionRow
          key={section.head.membershipId}
          section={section}
          view={view}
          kind={kind}
          direction={direction}
          isReader={section.head.membershipId === mine}
          open={open.has(section.head.membershipId)}
          onToggle={() => flip(section.head.membershipId)}
        />
      ))}
    </ul>
  );
}

function SectionRow({
  section, view, kind, direction, isReader, open, onToggle,
}: {
  section: ComplianceSection;
  view: ComplianceView;
  kind: ReturnType<typeof treeKindOf>;
  direction: SortDirection;
  isReader: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const panelId = useId();
  const tone = barTone(section.done, section.of, view.thresholds);
  return (
    <li className="border-t border-divider first:border-t-0" data-v1-section={section.head.membershipId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-2.5 px-3 py-2 text-left"
      >
        <Avatar name={section.head.name} seed={section.head.membershipId} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-md font-bold uppercase tracking-[0.2px] text-ink">{section.head.name}</span>
            {isReader && <TonePill tone="blue">{t.v1.you}</TonePill>}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <Bar done={section.done} of={section.of} thresholds={view.thresholds} className="w-11" />
            <span className={cn(tone === 'red' && 'font-semibold text-signal-red', tone === 'green' && 'font-semibold text-signal-green')}>
              {section.of === 0 ? t.noRate : t.v1.doneOf({ done: section.done, of: section.of, verb: t.verb({ kind }) })}
            </span>
          </span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', open ? 'text-muted' : 'text-signal-grey')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
        </svg>
      </button>
      {open && (
        <div id={panelId}>
          {section.units.map((unit) => (
            <div key={unit.head.membershipId} data-v1-unit={unit.head.membershipId}>
              <p className="flex items-center justify-between gap-2 bg-base px-3 py-1.5 text-sm font-bold text-navy">
                <span className="min-w-0 truncate">{unit.rung === 'AAB' ? t.v1.unitAab({ name: unit.head.name }) : t.v1.unit({ name: unit.head.name })}</span>
                <span className="shrink-0 font-semibold text-muted">{unit.of === 0 ? '—' : `${unit.done} / ${unit.of}`}</span>
              </p>
              <ul>
                {sortRows(unit.rows, kind, direction).map((row) => (
                  <PersonLine key={row.membershipId} row={row} view={view} kind={kind} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

/** The registry's verdict as UI V1's tinted pill: done green, under way amber, everything else grey (UI-005, D-27). */
const TONE_OF: Record<PillWords['tone'], V1Tone> = { success: 'green', watch: 'amber', alert: 'grey', neutral: 'grey' };

function V1Pill({ words }: { words: PillWords }) {
  return <TonePill tone={TONE_OF[words.tone]}>{words.label}</TonePill>;
}

/** A person: 44px, the name (*Pribadi* on a leader's own line), the pill or pills, the day it was done. */
function PersonLine({ row, view, kind }: { row: ComplianceRow; view: ComplianceView; kind: ReturnType<typeof treeKindOf> }) {
  const t = useMessages(kpmComplianceMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const labels = complianceLabels(language);
  const category = view.selected.category;
  const { cell } = row;
  const pills = kind === 'status'
    ? [pillOf(labels[category as 'training' | 'goals' | 'activity' | 'activation'], cell.status)]
    : kind === 'events'
      ? [pillOf(labels.events.joined, cell.status), pillOf(labels.events.feedback, cell.second)]
      : [pillOf(labels.campaigns.chasing, cell.status), pillOf(labels.campaigns.achieved, cell.second)];
  const columns = kind === 'status' ? null : t.columns[kind];
  const day = kind === 'status' && cell.done === true && cell.on ? dayWords(cell.on, view.today, figures) : null;
  return (
    <li className="flex min-h-11 items-center gap-2 border-t border-divider px-3 text-base" data-row={row.membershipId}>
      <span className="min-w-0 flex-1 truncate text-ink">
        {row.name}
        {row.personal && <span className="ml-1 text-sm font-semibold text-muted">{t.personal}</span>}
      </span>
      {pills.map((words, i) => (
        <span key={i} className="shrink-0">
          {columns && <span className="sr-only">{i === 0 ? columns.first : columns.second}: </span>}
          <V1Pill words={words} />
        </span>
      ))}
      {kind === 'status' && <span className="w-11 shrink-0 text-right text-sm text-muted">{day ?? ''}</span>}
    </li>
  );
}
