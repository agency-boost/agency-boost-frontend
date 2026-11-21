'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatMonthName, formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import {
  everyRow, goalShare, missingWords, namesMissing, namesNewHires, newHireWords, totalNote,
  type UnitDashboardView, type UnitPeriod,
} from '@/lib/unit-dashboard';

/** Which sheet a navy tile opens (P19.18-T1 AC-4). */
export type UnitTileSheetKind = 'activeAgent' | 'recruitment';

/** The three numbers' size, in px: 24, stepping down together to 16 (the brief: *"must fit 4 digits"*). */
export const PANEL_NUMBER_MAX_PX = 24;
export const PANEL_NUMBER_MIN_PX = 16;

/**
 * **The orange panel** (P19.18-T1 AC-3; ADR-0271 §3; the brief of 19 November 2026, part A; `unit-overview-*` frame 3,
 * laptop frame 1): one panel in the accent, its words in the accent's contrast (navy).
 *
 * - ***Produksi Group*** with the navy % pill, *Rp 2,2 M* realised ***dari*** *Rp 8,2 M* and a navy bar — the server's
 *   paired total (ADR-0165 §1). *Belum diunggah* with nothing held, *Goal belum diatur* with no target; never 0. The ⓘ
 *   still names who holds no figure and the new hires it leaves out.
 * - **Three short tiles**: ***Tim Anda*** (white), ***Active Agent · Nov*** and ***Recruitment · Nov*** (navy, the number in
 *   the accent) — one number and one label each; **no split chips** (the downline filter does that), **no "/total"**.
 *   Columns 0.86 : 1.07 : 1.07, 6px apart. **The three numbers share one size** — 24px, stepping down together to 16px
 *   until all three fit (`useSharedFit`, the mockup's `fitNums`), so four digits line up. The month chip sits at the right
 *   of the number row, centred.
 * - ***Active Agent*** is the upload's count for the office's month (ADR-0267 §2): *–* while the month is not uploaded.
 *   ***Recruitment*** is the new hires who joined this month (ADR-0267 §3). Each navy tile is a button that opens the
 *   people behind its number (`onOpen`).
 * - **Phone**: the production on top and the tiles under it; **from 1024px** Produksi left and the tiles right, 400px.
 *
 * Every figure is the server's (`GET /unit/dashboard`'s `tiles`).
 */
export function UnitTiles({
  view, period, onOpen,
}: { view: UnitDashboardView; period: UnitPeriod; onOpen?: (kind: UnitTileSheetKind) => void }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const { team, directGroupProduction: production, activeAgent, recruitment } = view.tiles;
  const rows = everyRow(view);
  const number = (n: number) => formatNumber(n, {}, figures);

  const missing = totalNote(
    missingWords(production.missing, namesMissing(rows, language), language),
    newHireWords(team.newHires, namesNewHires(rows, language), language),
  );
  const held = production.actualMinor !== null;
  const target = production.targetMinor;
  const sub = !held
    ? target !== null && target > 0 ? t.goal.ofTarget({ sum: formatRupiahCompact(target, {}, figures) }) : null
    : target === null ? t.own.noGoal
      : target === 0 ? t.own.targetMade
        : t.v1.of({ of: formatRupiahCompact(target, {}, figures) });
  const pct = held && production.attainmentPct !== null && target ? production.attainmentPct : null;
  const bar = goalShare({ ...production, set: target !== null });
  const monthShort = formatMonthName(view.month, figures);
  const monthLong = formatMonthLong(view.month, figures);
  // Nobody to count, or the month not uploaded (MOB UI-181; ADR-0267 §2): *–*, never a 0 that was not counted.
  const activeValue = view.empty || activeAgent.count === null ? '–' : number(activeAgent.count);
  const recruitValue = view.empty ? '–' : number(recruitment.count);
  const values = [view.empty ? '0' : number(team.total), activeValue, recruitValue];
  const [box, size] = useSharedFit(values.join('|'));

  return (
    <section
      aria-label={t.overview.panelLabel}
      data-unit-panel=""
      className="rounded-[20px] bg-primary px-3 pb-3 pt-3.5 text-primary-contrast lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center lg:gap-4 lg:p-4"
    >
      <div className="min-w-0 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="inline-flex min-w-0 items-center gap-1 text-[0.9375rem] font-bold">
            <span>{t.v1.groupProduction}</span>
            {missing && <TippedGlyph glyph="ⓘ" name={missing} tip={missing} align="fit" className="-my-1" />}
          </h2>
          {pct !== null && (
            <span data-panel-pct="" className="ml-auto shrink-0 rounded-pill bg-secondary px-2.5 py-1 text-base font-bold leading-none text-secondary-contrast">
              {formatPercent(pct, {}, figures)}
            </span>
          )}
        </div>
        <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <b data-panel-production="" className={cn('font-extrabold', held ? 'text-[1.625rem] leading-tight' : 'text-lg')}>
            {held ? formatRupiahCompact(production.actualMinor!, {}, figures) : t.own.notUploaded}
          </b>
          {sub !== null && (
            <span className="text-base font-semibold">{period === '7d' ? `${sub} · ${t.own.thisMonth}` : sub}</span>
          )}
        </p>
        <div aria-hidden="true" data-panel-bar={bar ?? 'none'} className="mb-3 mt-2 h-2 overflow-hidden rounded bg-card/55 lg:mb-0.5">
          {bar !== null && <span className="block h-full rounded bg-secondary" style={{ width: `${bar}%` }} />}
        </div>
      </div>

      <div ref={box} data-panel-tiles="" className="grid grid-cols-[0.86fr_1.07fr_1.07fr] gap-1.5">
        <PanelTile tone="white" value={values[0]} size={size} label={t.prototype.yourTeam} />
        <PanelTile
          tone="navy"
          value={activeValue}
          size={size}
          month={monthShort}
          label={t.v1.activeAgentShort}
          name={`${t.v1.activeAgent({ month: monthLong })}: ${activeValue}`}
          onOpen={onOpen && !view.empty ? () => onOpen('activeAgent') : undefined}
          sheet="activeAgent"
        />
        <PanelTile
          tone="navy"
          value={recruitValue}
          size={size}
          month={monthShort}
          label={t.v1.recruitmentShort}
          name={`${t.v1.recruitment({ month: monthLong })}: ${recruitValue}`}
          onOpen={onOpen && !view.empty ? () => onOpen('recruitment') : undefined}
          sheet="recruitment"
        />
      </div>
    </section>
  );
}

/**
 * **One of the panel's three tiles**: the number and the month chip on one row, the label under it on one line. A navy
 * tile that opens a sheet is a button, named by its label, its month in full and its number.
 */
function PanelTile({
  tone, value, size, month, label, name, onOpen, sheet,
}: {
  tone: 'white' | 'navy';
  value: string;
  size: number;
  month?: string;
  label: ReactNode;
  name?: string;
  onOpen?: () => void;
  sheet?: UnitTileSheetKind;
}) {
  const body = (
    <>
      <span data-panel-number="" className="flex h-[1.875rem] min-w-0 items-center gap-0.5 overflow-hidden">
        <b
          data-number-size={size}
          className={cn('whitespace-nowrap font-extrabold leading-none tabular-nums', tone === 'navy' ? 'text-primary-on-secondary' : 'text-ink')}
          style={{ fontSize: size }}
        >
          {value}
        </b>
        {month && (
          <em
            aria-hidden="true"
            className={cn(
              'ml-auto shrink-0 self-center rounded-pill px-[5px] text-xs font-bold not-italic leading-[1.125rem]',
              tone === 'navy' ? 'bg-card/15 text-secondary-muted' : 'bg-hover-row text-muted',
            )}
          >
            {month}
          </em>
        )}
      </span>
      <span className="mt-0.5 block whitespace-nowrap text-sm font-bold">{label}</span>
    </>
  );
  const face = cn(
    'min-w-0 rounded-[14px] py-2 pl-2.5 pr-2 text-left',
    tone === 'navy' ? 'bg-secondary text-secondary-contrast' : 'bg-card text-ink',
  );
  if (!onOpen) {
    return <div data-panel-tile={sheet ?? 'team'} className={face}>{body}</div>;
  }
  return (
    <button
      type="button"
      data-panel-tile={sheet}
      aria-haspopup="dialog"
      aria-label={name}
      onClick={onOpen}
      className={cn(face, 'hover:bg-secondary-hover')}
    >
      {body}
    </button>
  );
}

/**
 * **One size for the three numbers** (the brief: *"the three numbers always share one size (24px, all three step down
 * together, minimum 16px) so they line up"*; the mockup's `fitNums`): the largest size at which none of the three rows
 * overflows its tile, measured after each layout and on every resize. A browser that cannot measure (a test) keeps 24.
 */
function useSharedFit(key: string): [React.RefObject<HTMLDivElement | null>, number] {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(PANEL_NUMBER_MAX_PX);
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return undefined;
    const fit = () => {
      const rowsOf = () => [...root.querySelectorAll<HTMLElement>('[data-panel-number]')];
      const numbers = () => [...root.querySelectorAll<HTMLElement>('[data-number-size]')];
      let next = PANEL_NUMBER_MAX_PX;
      const apply = (px: number) => numbers().forEach((n) => { n.style.fontSize = `${px}px`; });
      apply(next);
      while (next > PANEL_NUMBER_MIN_PX && rowsOf().some((row) => row.scrollWidth > row.clientWidth)) {
        next -= 1;
        apply(next);
      }
      setSize(next);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watch = new ResizeObserver(fit);
    watch.observe(root);
    return () => watch.disconnect();
  }, [key]);
  return [box, size];
}

/** *4 direct · 8 under AABs*: the head's own unit, then the rest of their *Grup langsung*, heads included (row 19). */
export const teamLine = (team: { direct: number; aab: number }, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(unitDashboardMessages, language).teamLine({ direct: team.direct, under: team.aab });
