'use client';

import type { ReactNode } from 'react';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { cn } from '@/lib/cn';
import {
  campaignDateLabel, campaignGroups, campaignOf, campaignTag, dayWords, eventGroups, eventTag,
  skillsWithModules, type ComplianceCampaign, type ComplianceEvent, type ComplianceModule, type ComplianceSkill,
  type ComplianceTrainingCategory,
} from '@/lib/kpm-compliance';
import { TypeTag } from './compliance-parts';

/**
 * **Training's three rows of tabs** (`KPM_Owner.html:3502-3567`, CSS `:116-131`): the office's categories in
 * its order, the skills of the chosen one that hold a module, then that skill's modules. Each tab is a button
 * saying whether it is the one shown (`aria-pressed`; the prototype's module tabs are `div`s, contradiction 16),
 * each row a group named for what it holds.
 *
 * - **A category holding no module** is drawn muted, as the prototype draws it (`.disabled-tab`, `:121`), but at
 *   a contrast that clears 4.5:1 (its 55% grey is about 2.4:1, contradiction 16) and still pressable: pressing it
 *   shows *"Modules for {name} are coming soon."* in place of the tree (`:4026-4034`).
 * - **The chosen category and skill are navy** (ADR-0137 §2, §3): a selection, and the skill tab is shaped like a
 *   button, which the prototype paints amber (`.module-tab.active`, `:127`). **The chosen module keeps its amber
 *   rule** (`.item-tab.active`, `:139`): ADR-0137 §3, *"The underline tabs keep their amber rule"*, as the analytics'
 *   own tab strip above it does.
 */
export function TrainingTabs({
  catalog, category, skill, module, onCategory, onSkill, onModule,
}: {
  catalog: readonly ComplianceTrainingCategory[];
  category: ComplianceTrainingCategory | null;
  skill: ComplianceSkill | null;
  module: string | null;
  onCategory: (category: ComplianceTrainingCategory) => void;
  onSkill: (skill: ComplianceSkill) => void;
  onModule: (module: ComplianceModule) => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const skills = category ? skillsWithModules(category) : [];
  return (
    <>
      <div role="group" aria-label={t.trainingCategoriesName} className="mb-2.5 flex flex-wrap gap-1.5">
        {catalog.map((c) => {
          const on = c.code === category?.code;
          const empty = skillsWithModules(c).length === 0;
          return (
            <button
              key={c.code}
              type="button"
              aria-pressed={on}
              onClick={() => onCategory(c)}
              data-empty={empty || undefined}
              className={cn(
                'rounded-pill border px-[13px] py-[7px] text-sm font-semibold',
                on ? 'border-navy bg-navy text-card' : 'border-hairline bg-card hover:text-navy',
                // `.disabled-tab`: lighter than its neighbours, and still at 4.5:1 on the card (pinned in the spec).
                !on && (empty ? 'text-muted/[0.86]' : 'text-muted'),
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {skills.length > 0 && (
        <div role="group" aria-label={t.skillsName} className="mb-2.5 flex flex-wrap gap-1.5">
          {skills.map((s) => {
            const on = s.code === skill?.code;
            return (
              <button
                key={s.code}
                type="button"
                aria-pressed={on}
                onClick={() => onSkill(s)}
                className={cn(
                  'rounded-[7px] border px-[11px] py-[5px] text-sm font-semibold',
                  on ? 'border-navy bg-navy text-card' : 'border-hairline bg-transparent text-muted hover:text-navy',
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {skill && skills.some((s) => s.code === skill.code) && (
        <div role="group" aria-label={t.modulesName} className={ITEM_ROW}>
          {skill.modules.map((m) => {
            const on = m.code === module;
            return (
              <button
                key={m.code}
                type="button"
                aria-pressed={on}
                onClick={() => onModule(m)}
                className={cn(ITEM_TAB, on ? 'border-amber text-navy' : 'border-transparent text-muted hover:text-navy')}
              >
                {m.title}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** `.item-tabs` (`:129-131`): the row under the tabs, its rule the hairline. */
const ITEM_ROW = 'mb-4 flex flex-wrap gap-x-5 gap-y-2 border-b border-hairline';
/** `.item-tab` (`:132`, `:139`): 13px semibold, a 2px amber rule under the chosen one sitting on the row's. */
const ITEM_TAB = '-mb-px border-b-2 px-0.5 pb-[9px] text-left text-base font-semibold';

/** `.category-tooltip-note` (`:103`, `:3549-3555`): Activity's tooltip, drawn under the tabs. */
export function TooltipNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 rounded-md border border-hairline bg-base px-3 py-2 text-sm text-muted">
      {children}
    </p>
  );
}

/** `.event-select` (`:134-135`): a native select, labelled, its options grouped. */
const SELECT = 'min-w-0 max-w-full cursor-pointer rounded-md border border-hairline bg-card px-3 py-[9px] text-md font-semibold text-navy sm:min-w-[260px] focus:border-amber';

/**
 * **The event picker** (`:3569-3590`; P18.6-T2 AC-1): *Upcoming*, soonest first — a running event among them
 * (contradiction 8) — and *Past*, the latest first, each option *"{title} — {date}"*; beside it the phase tag
 * and the event's office day. A labelled select (contradiction 16).
 */
export function EventPicker({
  events, selected, today, onChoose,
}: {
  events: readonly ComplianceEvent[];
  selected: string | null;
  today: string;
  onChoose: (id: string) => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const groups = eventGroups(events);
  const current = events.find((e) => e.id === selected) ?? null;
  // The event's title is the office's, shown as typed; its day a figure.
  const option = (e: ComplianceEvent) => (
    <option key={e.id} value={e.id}>{`${e.title} — ${dayWords(e.startsOn, today, figures)}`}</option>
  );
  const tag = current ? eventTag(current, language) : null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <select aria-label={t.eventName} value={current?.id ?? ''} onChange={(e) => onChoose(e.target.value)} className={SELECT}>
        {groups.upcoming.length > 0 && <optgroup label={t.eventGroups.upcoming}>{groups.upcoming.map(option)}</optgroup>}
        {groups.past.length > 0 && <optgroup label={t.eventGroups.past}>{groups.past.map(option)}</optgroup>}
      </select>
      {current && tag && (
        <>
          <TypeTag tone={tag.tone}>{tag.label}</TypeTag>
          <span className="text-sm text-muted">{dayWords(current.startsOn, today, figures)}</span>
        </>
      )}
    </div>
  );
}

/**
 * **The campaign picker** (`:3591-3608`; P18.6-T2 AC-4): *Structural*, *Seasonal — Ongoing* — an upcoming one
 * among them, tagged *Upcoming* (contradiction 8) — and *Seasonal — Past*; each option *"{title} — {date}"*,
 * the date *Always on*, *"Since {date}"* or *"Ended {date}"*; beside it the tag and the date.
 */
export function CampaignPicker({
  campaigns, selected, today, onChoose,
}: {
  campaigns: readonly ComplianceCampaign[];
  selected: string | null;
  today: string;
  onChoose: (code: string) => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const groups = campaignGroups(campaigns);
  const current = campaignOf(campaigns, selected);
  // The campaign's title is the company's or the office's, shown as typed; its date label the reader's.
  const option = (c: ComplianceCampaign) => (
    <option key={c.code} value={c.code}>{`${c.title} — ${campaignDateLabel(c, today, language, figures)}`}</option>
  );
  const tag = current ? campaignTag(current, language) : null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <select aria-label={t.campaignName} value={current?.code ?? ''} onChange={(e) => onChoose(e.target.value)} className={SELECT}>
        {groups.structural.length > 0 && <optgroup label={t.campaignGroups.structural}>{groups.structural.map(option)}</optgroup>}
        {groups.ongoing.length > 0 && <optgroup label={t.campaignGroups.ongoing}>{groups.ongoing.map(option)}</optgroup>}
        {groups.past.length > 0 && <optgroup label={t.campaignGroups.past}>{groups.past.map(option)}</optgroup>}
      </select>
      {current && tag && (
        <>
          <TypeTag tone={tag.tone}>{tag.label}</TypeTag>
          <span className="text-sm text-muted">{campaignDateLabel(current, today, language, figures)}</span>
        </>
      )}
    </div>
  );
}
