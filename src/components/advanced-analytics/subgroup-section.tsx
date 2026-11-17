'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { YtdFigure } from '@/components/ytd-cell';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { buttonClass } from '@/components/ui/field';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readSubgroup, type Subgroup } from '@/lib/advanced-analytics-page';
import { useCan } from '@/lib/session';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatNumber, formatPercent } from '@/lib/format';
import { NoData, SectionError, SectionLoading } from './shared';

const figure = (value: number | null, language: Language, maxDecimals = 0) =>
  (value === null ? '—' : formatNumber(value, { maxDecimals }, language));

/** A target met to `subgroupOkPct` is green (ADR-0215 §7); below it, grey; with no figure, nothing. */
function Attainment({ pct, ok }: { pct: number | null; ok: boolean | null }) {
  const t = useMessages(advancedAnalyticsPageMessages).subgroup;
  const language = useFigureLanguage();
  if (pct === null) return null;
  return <TonePill tone={ok ? 'green' : 'grey'}>{t.met({ pct: formatPercent(pct, {}, language) })}</TonePill>;
}

/**
 * ***Perbaikan sub-group*** (P19.5-T3 AC-10; ADR-0215 §7; the data sources' Sub-group rows) — **one row per informal
 * group, then *Tidak ada group*** since P19.13-T3 (UI-199; ADR-0253 §5): each group's name with its ★ group leader (or
 * *Belum ada group leader*), every person in the row of their nearest leader, so the rows sum to the office. Manpower and
 * leaders, MAA as last year's average, last month and this month as of its upload (D8), the AA and recruitment targets —
 * **the sum of the row's leaders' targets**, the template's 3 and 6 each until set — adoption, power users, one-on-ones a
 * week, the weekly activity target, and recruitment last year and this year. A target met to the template's share is
 * green.
 *
 * **The targets are a leader's, edited on *Core leaders & groups*** (the report's *Conflicts resolved*): *Ubah target* on
 * a row opens that page on the row's group, where each leader's edit holds theirs, and ***Grouping*** above the table
 * opens the page itself — for the Owner and the Admins (`member:read_tags`), never a Super Admin's platform read.
 */
export function SubgroupSection({ platformKpmId, canUpload }: { platformKpmId?: string; canUpload: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const language = useFigureLanguage();
  const [view, setView] = useState<Subgroup | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const grouping = useCan('member:read_tags') && platformKpmId === undefined;

  useEffect(() => {
    let live = true;
    setError(null);
    readSubgroup(platformKpmId)
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const s = t.subgroup;
  const year = view.month.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  const write = view.canWrite && platformKpmId === undefined;

  return (
    <div data-section="subgroup">
      {grouping && (
        <div className="mb-3 flex justify-end">
          <Link href="/people/core-leaders" className={buttonClass('secondary')}>{s.grouping} ›</Link>
        </div>
      )}
      {view.rows.length === 0 ? (
        <NoData canUpload={canUpload} />
      ) : (
        <DataTable
          caption={t.sections.subgroup}
          columns={[s.head, s.manpower, s.maa, s.aaTarget, s.adoption, s.powerUsers, s.oneOnOnes, s.weeklyTarget, s.recruitment]}
        >
          {view.rows.map((row) => (
            <Row key={row.group?.groupId ?? 'none'} data-row={row.group?.groupId ?? 'none'}>
              <Cell className="min-w-[10rem] align-top font-semibold">
                {row.group?.name ?? s.noGroup}
                {row.group && (
                  <div className={cn('text-sm font-normal', row.head ? 'text-muted' : 'text-pill-amber-ink')}>
                    {row.head ? `★ ${row.head.name}` : s.noHead}
                  </div>
                )}
                {write && (
                  <div className="mt-1">
                    <Link
                      href={`/people/core-leaders?group=${encodeURIComponent(row.group?.groupId ?? 'none')}`}
                      className={cn(buttonClass('secondary'), 'min-h-9 px-2.5 text-sm')}
                    >
                      {s.edit}
                    </Link>
                  </div>
                )}
              </Cell>
              <Cell className="align-top tabular-nums">
                {figure(row.manpower, language)}
                <div className="text-xs text-muted">{`${s.leaders}: ${figure(row.leaders, language)}`}</div>
              </Cell>
              <Cell className="min-w-[9rem] align-top text-sm tabular-nums">
                <div>{`${s.baseline({ year: lastYear })}: ${figure(row.maa.baseline, language, 1)}`}</div>
                <div>{`${s.lastMonth}: ${figure(row.maa.lastMonth, language)}`}</div>
                <div className="font-semibold">
                  {`${s.mtd}: ${figure(row.maa.mtd, language)}`}
                  {row.maa.asOf && <span className="ml-1 font-normal text-muted">{s.asOf({ date: formatCalendarDay(row.maa.asOf, language) })}</span>}
                </div>
              </Cell>
              <Cell className="min-w-[9rem] align-top text-sm tabular-nums">
                <div>{`${s.aaTarget}: ${figure(row.targets.aa, language)}`}</div>
                <div>{`${s.recTarget}: ${figure(row.targets.rec, language)}`}</div>
                {row.targets.isDefault && <div className="text-xs text-muted">{s.defaultTarget}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Attainment pct={row.attainment.aaPct} ok={row.attainment.aaOk} />
                </div>
              </Cell>
              <Cell className="min-w-[9rem] align-top text-sm">
                {row.adoption.headDays !== null && <div>{s.headDays({ n: row.adoption.headDays })}</div>}
                <div>{s.downline({ pct: row.adoption.downlinePct === null ? '—' : formatPercent(row.adoption.downlinePct, {}, language) })}</div>
              </Cell>
              <Cell className="align-top tabular-nums">{figure(row.powerUsers, language)}</Cell>
              <Cell className="align-top tabular-nums">{figure(row.oneOnOnesPerWeek, language, 1)}</Cell>
              <Cell className="align-top tabular-nums">{figure(row.weeklyActivityTarget, language, 1)}</Cell>
              <Cell className="min-w-[9rem] align-top text-sm tabular-nums">
                <div>{`${s.baseline({ year: lastYear })}: ${figure(row.recruitment.baseline, language)}`}</div>
                <div className="flex items-center gap-1">
                  <span>{`${s.recYtd({ year })}:`}</span>
                  <YtdFigure
                    text={row.recruitment.ytd === null ? null : formatNumber(row.recruitment.ytd, {}, language)}
                    calculated
                    missingMonths={row.recruitment.missingMonths}
                  />
                </div>
                <div className="mt-1"><Attainment pct={row.attainment.recPct} ok={row.attainment.recOk} /></div>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
