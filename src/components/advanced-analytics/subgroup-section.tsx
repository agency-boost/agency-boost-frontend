'use client';

import { useEffect, useId, useState } from 'react';
import { YtdFigure } from '@/components/ytd-cell';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { Button, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readSubgroup, saveSubgroupTarget, type Subgroup, type SubgroupRow } from '@/lib/advanced-analytics-page';
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

/** *Ubah target*: a head's AA and recruitment targets, whole numbers from 0 to 1000; audited by the server. */
function TargetsDialog({ row, onClose, onSaved }: { row: SubgroupRow; onClose: () => void; onSaved: () => void }) {
  const t = useMessages(advancedAnalyticsPageMessages).subgroup;
  const aaId = useId();
  const recId = useId();
  const [aa, setAa] = useState(String(row.targets.aa));
  const [rec, setRec] = useState(String(row.targets.rec));
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const whole = (text: string) => (/^\d{1,4}$/.test(text.trim()) && Number(text) <= 1000 ? Number(text) : null);
  const save = async () => {
    const [a, r] = [whole(aa), whole(rec)];
    if (a === null || r === null) { setInvalid(true); return; }
    setSaving(true);
    try {
      await saveSubgroupTarget(row.head.membershipId, a, r);
      onSaved();
    } catch (err) {
      setError(toDisplayError(err));
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={t.targetsTitle({ name: row.head.name })}
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button onClick={() => { void save(); }} disabled={saving}>{t.save}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <label htmlFor={aaId} className="flex flex-col gap-1 text-sm font-semibold text-navy">
          {t.aaTarget}
          <TextInput id={aaId} inputMode="numeric" value={aa} invalid={invalid} onChange={(e) => setAa(e.target.value)} />
        </label>
        <label htmlFor={recId} className="flex flex-col gap-1 text-sm font-semibold text-navy">
          {t.recTarget}
          <TextInput id={recId} inputMode="numeric" value={rec} invalid={invalid} onChange={(e) => setRec(e.target.value)} />
        </label>
        {invalid && <p role="alert" className="text-sm text-alert">{t.invalid}</p>}
        {error && <p role="alert" className="text-sm text-alert">{error.message}</p>}
      </div>
    </Modal>
  );
}

/**
 * ***Perbaikan sub-group*** (P19.5-T3 AC-10; ADR-0215 §7; the data sources' Sub-group rows): **one row per AB's agency**
 * — the AB and everybody below down to the next AB, so the rows sum to the office — with its manpower and leaders, MAA
 * as last year's average, last month and this month as of its upload (D8), the AA and recruitment targets (the
 * template's 3 and 6 until the KPM sets its own, *Ubah target* for the Owner and the Admins), adoption, power users,
 * one-on-ones a week, the weekly activity target, and recruitment last year and this year — the year the shared *Belum
 * lengkap* cell. A target met to the template's share is green. **Built without the KPM-side mockup** (OD-268).
 */
export function SubgroupSection({ platformKpmId, canUpload }: { platformKpmId?: string; canUpload: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const language = useFigureLanguage();
  const [view, setView] = useState<Subgroup | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<SubgroupRow | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readSubgroup(platformKpmId)
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [platformKpmId, attempt]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const s = t.subgroup;
  const year = view.month.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  const write = view.canWrite && platformKpmId === undefined;

  return (
    <div data-section="subgroup">
      {view.rows.length === 0 ? (
        <NoData canUpload={canUpload} />
      ) : (
        <DataTable
          caption={t.sections.subgroup}
          columns={[s.head, s.manpower, s.maa, s.aaTarget, s.adoption, s.powerUsers, s.oneOnOnes, s.weeklyTarget, s.recruitment]}
        >
          {view.rows.map((row) => (
            <Row key={row.head.membershipId} data-row={row.head.membershipId}>
              <Cell className="min-w-[10rem] align-top font-semibold">
                {row.head.name}
                {write && (
                  <div className="mt-1">
                    <Button variant="secondary" className="min-h-9 px-2.5 text-sm" onClick={() => setEditing(row)}>{s.edit}</Button>
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
                <div>{s.headDays({ n: row.adoption.headDays })}</div>
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
      {editing && (
        <TargetsDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setAttempt((n) => n + 1); }}
        />
      )}
    </div>
  );
}
