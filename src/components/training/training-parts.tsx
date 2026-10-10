import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/field';
import { NumberBadge } from '@/components/ui/number-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/cn';
import {
  FORMAT_LABEL, OWN_COPY, PROTOTYPE_COPY, STATUS_LABEL, trainingModuleHref,
  type TrainingItemKind, type TrainingSkillProgress, type TrainingStatus,
} from '@/lib/training';

/**
 * **The parts the learner's list and a person's *Training* tab share** (`Overall.html:7768-7810`, the
 * renderer `:7663-7765`): the numbered skill card, its five-column table, the status pill and the
 * *Format* chips. One component per part, so the coach's tab and the learner's list cannot draw the same
 * module two ways (T4 AC-4) — the prototype draws them with two renderers over two sources (F-12).
 *
 * **A real table** (contradiction 8, a Fix: WCAG 2.1.1): the prototype's rows are `display: contents`
 * divs that a pointer clicks anywhere on and a keyboard cannot reach. Here the module's title is a link on
 * the learner's list, and plain text on a person's tab, where the rows do nothing (contradiction 13): no
 * pointer, no hover tint. **It scrolls inside its card on a phone** (F-124), so the page never does.
 */

/** The prototype's three glyphs (`FORMAT_META`, `:7652-7656`), drawn in the chip and on the tile. */
export function FormatIcon({ kind, size = 13 }: { kind: TrainingItemKind; size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" className="shrink-0">
      {kind === 'file' && (
        <>
          <path d="M13.5 2H6.8A1.8 1.8 0 0 0 5 3.8v16.4A1.8 1.8 0 0 0 6.8 22h10.4a1.8 1.8 0 0 0 1.8-1.8V7.5L13.5 2z" />
          <path d="M13 2.3V7a1 1 0 0 0 1 1h4.7" />
        </>
      )}
      {kind === 'video' && (
        <>
          <rect x="2.5" y="6" width="13" height="12" rx="2" />
          <path d="M15.5 10.5l6-3.2v9.4l-6-3.2z" />
        </>
      )}
      {kind === 'link' && (
        <>
          <path d="M9.5 14.5a4 4 0 0 0 5.6 0l2.3-2.3a4 4 0 0 0-5.6-5.6l-1.2 1.2" />
          <path d="M14.5 9.5a4 4 0 0 0-5.6 0l-2.3 2.3a4 4 0 0 0 5.6 5.6l1.2-1.2" />
        </>
      )}
    </svg>
  );
}

/**
 * `.format-chip` (`:1807-1808`): one per kind the module's content holds, *File · Video · Link* order
 * (contradiction 5) — the prototype's one chip per module had one resource of one type. A module with no
 * content shows *—*.
 */
export function FormatChips({ formats }: { formats: readonly TrainingItemKind[] }) {
  if (formats.length === 0) {
    return (
      <span className="text-muted">
        <span aria-hidden="true">{OWN_COPY.noFormat}</span>
        <span className="sr-only">{OWN_COPY.noFormatName}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {formats.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-soft">
          <FormatIcon kind={kind} />
          {FORMAT_LABEL[kind]}
        </span>
      ))}
    </span>
  );
}

/**
 * `.status-pill` (`:7657-7661`): *Not started* in the quiet neutral, *Done* green, and *In progress* in
 * F-126's paint — navy words on the amber tint, since the prototype's amber-dark on a 14% amber clears no
 * contrast floor (I-116). The word is always drawn: the colour is never the only cue.
 */
export function TrainingStatusPill({ status }: { status: TrainingStatus }) {
  const label = STATUS_LABEL[status];
  const pill = 'whitespace-nowrap px-2.5 py-1 text-xs font-semibold normal-case tracking-normal';
  if (status === 'in_progress') return <StatusPill status="watch" label={label} className={pill} />;
  return <StatusPill status={status === 'done' ? 'success' : 'neutral'} label={label} className={pill} />;
}

/** `.skill-tag` (`:1802-1806`): a skill's name in a warm pill. */
export function SkillTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-pill border border-hairline bg-base px-3 py-1 text-xs font-semibold leading-tight text-navy',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * One skill's card (`.goal-card.newhire-group-card`, `:7793-7807`): its number among the cards, the
 * skill's name, and the table. `categoryCode` makes each module's title a link to its page — the
 * learner's list; without it the rows are read-only — a person's tab, which also draws the skill's
 * D-history rows after the offered ones: *Done* and the word *Archived* in the Status cell it already has
 * (ADR-0062 §2, form 5), outside every count.
 */
export function SkillCard({
  n, skill, categoryCode, withArchived = false,
}: {
  n: number;
  skill: TrainingSkillProgress;
  categoryCode?: string;
  withArchived?: boolean;
}) {
  const HEAD = 'border-b border-hairline px-2 pb-2.5 text-left text-2xs font-bold uppercase tracking-wide text-muted first:pl-0 last:pr-0';
  const CELL = 'border-b border-hairline px-2 py-3 align-middle text-base font-medium text-navy first:pl-0 last:pr-0';
  const rows = [
    ...skill.modules.map((m) => ({ ...m, archived: false })),
    // A withdrawn module's Format is its own kinds of material, served on the history row — never *No material yet*.
    ...(withArchived ? skill.archived.map((m) => ({ ...m, archived: true })) : []),
  ];
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2.5 font-display text-md font-bold text-navy">
        <NumberBadge n={n} size="md" />
        {skill.label}
      </h3>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-collapse">
          <caption className="sr-only">{OWN_COPY.tableCaption(skill.label)}</caption>
          {/* `.training-table`'s columns (`:1786`), 0.4 · 1.3 · 2.2 · 1 · 1.2. */}
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[21%]" />
            <col className="w-[36%]" />
            <col className="w-[16%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.columns.no}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.columns.skill}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.columns.module}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.columns.format}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.columns.status}</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>*]:border-b-0">
            {rows.map((row, i) => (
              <tr key={`${row.archived ? 'archived' : 'offered'}-${row.code}`} data-code={row.code}>
                <td className={cn(CELL, 'font-semibold text-muted')}>{i + 1}</td>
                <td className={CELL}><SkillTag>{skill.label}</SkillTag></td>
                <th scope="row" className={cn(CELL, 'text-left')}>
                  {categoryCode && !row.archived ? (
                    <Link href={trainingModuleHref(categoryCode, row.code)} className="text-navy hover:underline">
                      {row.title}
                    </Link>
                  ) : row.title}
                </th>
                <td className={CELL}>{row.formats && <FormatChips formats={row.formats} />}</td>
                <td className={CELL}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <TrainingStatusPill status={row.status} />
                    {row.archived && <span className="text-xs font-semibold text-muted">{OWN_COPY.archived}</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * One category's skill cards, each numbered from 1 (`:7793`). On the learner's list (`categoryCode` set)
 * only the skills with a module offered; on a person's tab every skill the read serves, D-history rows
 * included.
 */
export function SkillCards({
  skills, categoryCode,
}: {
  skills: readonly TrainingSkillProgress[];
  categoryCode?: string;
}) {
  const learner = categoryCode !== undefined;
  const shown = learner ? skills.filter((s) => s.offered && s.modules.length > 0) : skills;
  return (
    <div className="flex flex-col gap-4">
      {shown.map((skill, i) => (
        <SkillCard key={skill.code} n={i + 1} skill={skill} categoryCode={categoryCode} withArchived={!learner} />
      ))}
    </div>
  );
}
