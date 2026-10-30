import Link from 'next/link';
import type { ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { TonePill } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { trainingMessages } from '@/i18n/messages/training';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  trainingModuleHref,
  type TrainingItemKind, type TrainingSkillProgress, type TrainingStatus,
} from '@/lib/training';

/**
 * **The parts the learner's list and a person's *Training* tab share** (`Overall.html:7768-7810`; redrawn by Phase 18.99
 * T10 after the UI V1 report, UI-064 to UI-066): the skill list, its rows, the status pill and the *Format* labels. One
 * component per part, so the coach's tab and the learner's list cannot draw the same module two ways (P18.5-T4 AC-4).
 *
 * - **Below 1024px — a phone and a tablet — one white card for every skill** (UI-065, UI-066's tablet): a 40px header
 *   per skill on the hover ground (its number in a navy ring, its name, *done/total*), then a row per module at least
 *   44px tall: the name (wrapping, never cut), the status pill and ›.
 * - **From 1024px, a card per skill in two columns** (UI-066), aligned with the title: the same header, then
 *   *Module · Format · Status · ›* — *No.* and *Skill* are gone, the card's heading says the skill.
 * - **The whole row is the link** (UI-064, D-09): a tap anywhere on it opens the module, a desktop row tints on hover,
 *   the keyboard reaches each row and its focus ring is the row's. The status pill stays a label. On a person's tab the
 *   rows open nothing (contradiction 13): no link, no ›, no hover, and a module the office withdrew after it was done
 *   stays under its skill with *Archived* after its pill (D-history).
 */

/** A module with no material: the *Format* cell's dash, drawn — its name is the catalogue's (`noFormatName`). */
const NO_FORMAT = '—';

/** The prototype's three glyphs (`FORMAT_META`, `:7652-7656`), drawn as line icons beside their words. */
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
 * The *Format* cell (UI-066): a line icon and its word per kind the module's content holds, *File · Video · Tautan*
 * order (contradiction 5). A module with no content shows *—*, named *No material yet* for a screen reader.
 */
export function FormatChips({ formats }: { formats: readonly TrainingItemKind[] }) {
  const t = useMessages(trainingMessages);
  if (formats.length === 0) {
    return (
      <span className="text-muted">
        <span aria-hidden="true">{NO_FORMAT}</span>
        <span className="sr-only">{t.noFormatName}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-1">
      {formats.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5 text-base text-muted">
          <FormatIcon kind={kind} size={15} />
          {t.format[kind]}
        </span>
      ))}
    </span>
  );
}

/**
 * A module's status as a tinted pill (UI-005's, UI-065): *Selesai* green, *Belum dimulai* grey, *Berjalan* in its
 * existing paint — navy on the accent's tint (F-126; I-116). The words always drawn: the colour never the only cue.
 */
export function TrainingStatusPill({ status }: { status: TrainingStatus }) {
  const label = useMessages(trainingMessages).status[status];
  if (status === 'in_progress') return <TonePill tone="grey" className="bg-amber/15 text-navy">{label}</TonePill>;
  return <TonePill tone={status === 'done' ? 'green' : 'grey'}>{label}</TonePill>;
}

/** A skill's number among the cards (UI-065): in a 1.5px navy ring, never a filled dot. */
function SkillNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-navy text-xs font-semibold text-navy lg:h-6 lg:w-6"
    >
      {n}
    </span>
  );
}

/** One row to draw: an offered module, or — on a person's tab — one done and since withdrawn. */
interface Row {
  code: string;
  title: string;
  formats: readonly TrainingItemKind[];
  status: TrainingStatus;
  archived: boolean;
}

const rowsOf = (skill: TrainingSkillProgress, withArchived: boolean): Row[] => [
  ...skill.modules.map((m) => ({ ...m, archived: false })),
  // A withdrawn module's Format is its own kinds of material, served on the history row — never *No material yet*.
  ...(withArchived ? skill.archived.map((m) => ({ ...m, archived: true })) : []),
];

/** The pill, and *Archived* after it on a history row. */
function StatusCell({ row }: { row: Row }) {
  const t = useMessages(trainingMessages);
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 lg:justify-start">
      <TrainingStatusPill status={row.status} />
      {row.archived && <span className="text-xs font-semibold text-muted">{t.archived}</span>}
    </span>
  );
}

/**
 * The skill's head (UI-065, UI-066): its number, its name, and *done/total* on the right. A heading under the page's
 * title on the learner's list (`h2`, now *Skills List* is gone), under its category's on a person's tab (`h3`).
 */
function SkillHead({ n, skill, level, className }: { n: number; skill: TrainingSkillProgress; level: 2 | 3; className?: string }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <Heading className={cn('flex items-center gap-2.5 font-semibold text-navy', className)}>
      <SkillNumber n={n} />
      <span className="min-w-0">{skill.label}</span>
      <span className="ml-auto shrink-0 text-xs font-medium text-signal-grey">{skill.done}/{skill.total}</span>
    </Heading>
  );
}

/**
 * **Below 1024px: one card, every skill in it** (UI-065). A row is the module's link where `categoryCode` is given —
 * the learner's list — and plain text with no › on a person's tab.
 */
function SkillListCompact({
  skills, categoryCode, withArchived, level,
}: {
  skills: readonly TrainingSkillProgress[];
  categoryCode?: string;
  withArchived: boolean;
  level: 2 | 3;
}) {
  const t = useMessages(trainingMessages);
  return (
    <div className="overflow-hidden rounded-lg border border-card-edge bg-card" data-skill-list="compact">
      {skills.map((skill, i) => {
        return (
          // Not a landmark: the list under the heading is named by its skill already (`tableCaption`).
          <div key={skill.code} data-skill={skill.code}>
            <SkillHead n={i + 1} skill={skill} level={level} className="h-10 bg-hover-row px-4 text-md" />
            <ul role="list" aria-label={t.tableCaption({ skill: skill.label })}>
              {rowsOf(skill, withArchived).map((row) => {
                const content = (
                  <>
                    <span className="min-w-0 flex-1 break-words leading-snug">{row.title}</span>
                    <StatusCell row={row} />
                  </>
                );
                const linked = categoryCode !== undefined && !row.archived;
                return (
                  <li key={`${row.archived ? 'archived' : 'offered'}-${row.code}`} data-code={row.code} className="border-t border-divider">
                    {linked ? (
                      <Link
                        href={trainingModuleHref(categoryCode, row.code)}
                        className="flex min-h-11 items-center gap-2 py-1 pl-4 pr-3 text-md font-medium text-navy hover:bg-hover-row focus-visible:[outline-offset:-2px]"
                      >
                        {content}
                        <LineIcon name="chevronRight" className="h-[18px] w-[18px] text-signal-grey" />
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center gap-2 py-1 pl-4 pr-3 text-md font-medium text-navy">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** *Module · Format · Status · ›* (UI-066): the four columns a desktop row and its header share. */
const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_130px_110px_16px] items-center gap-2';

/**
 * **From 1024px: a card per skill, two to a row** (UI-066). The header row names the columns for the eye (12px/600);
 * each row is one link, so its name is what it says — the module, its format and its status — and a screen reader hears
 * the same three a sighted reader scans.
 */
function SkillGridWide({
  skills, categoryCode, withArchived, level,
}: {
  skills: readonly TrainingSkillProgress[];
  categoryCode?: string;
  withArchived: boolean;
  level: 2 | 3;
}) {
  const t = useMessages(trainingMessages);
  return (
    <div className="grid grid-cols-2 items-start gap-4" data-skill-list="wide">
      {skills.map((skill, i) => {
        return (
          <div key={skill.code} data-skill={skill.code} className="rounded-lg border border-card-edge bg-card px-5 py-4">
            <SkillHead n={i + 1} skill={skill} level={level} className="mb-1.5 text-[15px]" />
            <div aria-hidden="true" className={cn(COLUMNS, 'border-b border-divider px-2 py-1.5 text-xs font-semibold text-signal-grey')}>
              <span>{t.columns.module}</span>
              <span>{t.columns.format}</span>
              <span>{t.columns.status}</span>
              <span />
            </div>
            <ul role="list" aria-label={t.tableCaption({ skill: skill.label })}>
              {rowsOf(skill, withArchived).map((row) => {
                const linked = categoryCode !== undefined && !row.archived;
                const cells = (
                  <>
                    <span className="min-w-0 break-words leading-snug">{row.title}</span>
                    <FormatChips formats={row.formats} />
                    <StatusCell row={row} />
                    {linked ? <LineIcon name="chevronRight" className="h-4 w-4 text-signal-grey" /> : <span />}
                  </>
                );
                return (
                  <li key={`${row.archived ? 'archived' : 'offered'}-${row.code}`} data-code={row.code} className="border-b border-divider last:border-b-0">
                    {linked ? (
                      <Link
                        href={trainingModuleHref(categoryCode, row.code)}
                        className={cn(COLUMNS, 'min-h-[46px] rounded-md px-2 py-1 text-md font-medium text-navy hover:bg-hover-row')}
                      >
                        {cells}
                      </Link>
                    ) : (
                      <div className={cn(COLUMNS, 'min-h-[46px] px-2 py-1 text-md font-medium text-navy')}>{cells}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * One category's skills, each numbered from 1 (`:7793`). On the learner's list (`categoryCode` set) only the skills with
 * a module offered; on a person's tab every skill the read serves, D-history rows included.
 */
export function SkillCards({
  skills, categoryCode, compact,
}: {
  skills: readonly TrainingSkillProgress[];
  categoryCode?: string;
  /**
   * The window is a phone's or a tablet's (UI-065, UI-066). The learner's list passes the answer its layout already has,
   * so a category opened from another draws its rows at once; without it, asked here.
   */
  compact?: boolean;
}) {
  const asked = useMediaQuery(['phone', 'tablet']);
  const small = compact ?? asked;
  const learner = categoryCode !== undefined;
  const shown = learner ? skills.filter((s) => s.offered && s.modules.length > 0) : skills;
  const Body = small ? SkillListCompact : SkillGridWide;
  return <Body skills={shown} categoryCode={categoryCode} withArchived={!learner} level={learner ? 2 : 3} />;
}

/** A skill's name in a pill — *Skill: Prospecting* — on the lesson card's navy (UI-067). */
export function SkillTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center rounded-pill bg-white/[0.14] px-2.5 py-1 text-xs font-semibold leading-tight text-white', className)}>
      {children}
    </span>
  );
}
