'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Select } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NavIcon } from '@/components/ui/nav-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  readDemographics, readDemographicsFile, uploadDemographics,
  type AbOption, type Demographics, type DemographicsMember, type DemographicsUploadResult, type DimensionCount,
} from '@/lib/advanced-analytics-page';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatNumber, formatPercent } from '@/lib/format';
import { whatsAppHref } from '@/lib/phone-number';
import { BlockTitle, MonthPicker, NoData, PersonName, SectionError, SectionLoading, TabControls, useMonthText } from './shared';

/** The twelve months up to `month`, newest first — the month filter's choices. */
export function monthsUpTo(month: string, count = 12): string[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const index = y * 12 + (m - 1) - i;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

/**
 * **The AB filter and, where a section takes one, the month** — two native selects, as *Event* reads them: every AB of
 * the office, then *Seluruh KPM*; the months up to this one.
 */
export function SectionFilters({
  abs, ab, onAb, months, month, onMonth, extra,
}: {
  abs: readonly AbOption[];
  ab: string | undefined;
  onAb: (id: string | undefined) => void;
  months?: readonly { value: string; label: string }[];
  month?: string;
  onMonth?: (value: string | undefined) => void;
  extra?: ReactNode;
}) {
  const t = useMessages(advancedAnalyticsPageMessages).filters;
  const abId = useId();
  const monthId = useId();
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      {months && onMonth && (
        <label htmlFor={monthId} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-navy">
          {t.month}
          <Select id={monthId} value={month ?? ''} onChange={(e) => onMonth(e.target.value || undefined)} className="min-w-[10rem]">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </label>
      )}
      <label htmlFor={abId} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-navy">
        {t.ab}
        <Select id={abId} value={ab ?? ''} onChange={(e) => onAb(e.target.value || undefined)} className="min-w-[12rem]">
          <option value="">{t.allAbs}</option>
          {abs.map((a) => <option key={a.membershipId} value={a.membershipId}>{a.name}</option>)}
        </Select>
      </label>
      {extra}
    </div>
  );
}

type DimKey = 'role' | 'workStatus' | 'tenureBand' | 'ageBand' | 'gender';
type SourceKey = 'auto' | 'profile' | 'joinDate' | 'birthDate';

/** *Komposisi anggota*'s rows, in the mockup's order, each with where its values come from. */
const DIMS: { key: DimKey; source: SourceKey }[] = [
  { key: 'role', source: 'auto' },
  { key: 'workStatus', source: 'profile' },
  { key: 'tenureBand', source: 'joinDate' },
  { key: 'ageBand', source: 'birthDate' },
  { key: 'gender', source: 'profile' },
];

/** Each row's segment colours, in order, and whether its words are light — tokens only; *Belum diisi* is always grey. */
const PALETTE: Record<DimKey, { fill: string; light: boolean }[]> = {
  role: [{ fill: 'bg-secondary', light: true }, { fill: 'bg-secondary-hover', light: true }, { fill: 'bg-on-navy-lavender', light: false }, { fill: 'bg-lavender', light: true }],
  workStatus: [{ fill: 'bg-signal-green', light: true }, { fill: 'bg-on-navy-green', light: false }],
  tenureBand: [{ fill: 'bg-today', light: false }, { fill: 'bg-primary', light: false }, { fill: 'bg-primary-deep', light: true }, { fill: 'bg-primary-ink', light: true }],
  ageBand: [{ fill: 'bg-on-navy-lavender', light: false }, { fill: 'bg-lavender', light: true }, { fill: 'bg-club-chairman', light: true }],
  gender: [{ fill: 'bg-info', light: true }, { fill: 'bg-on-navy-red', light: false }],
};
const UNSET_FILL = { fill: 'bg-line', light: false };

/** A chosen file's text — `File.text()` where the browser has it, a `FileReader` where it does not (an older WebView). */
function textOf(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** The CSV as a file to save: UTF-8 with its byte-order mark, so a spreadsheet on Windows reads the header's words. */
const fileHref = (file: string) => `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(file)}`;

/**
 * ***Demografi*** (P19.22-T2 AC-1; ADR-0275 §2; the approved `advanced-analytics-*` frames 1–4): the month and the AB
 * filter, *Data dari profil anggota · {day}*; the orange **Ringkasan** (*Total manpower*, *Data lengkap*, *Perlu
 * melengkapi*); **Komposisi anggota** as stacked bars, each row naming where its values come from (*Otomatis / Profil /
 * Tanggal bergabung / Tanggal lahir*), with *Sembunyikan "Belum diisi"*; **Kelengkapan data** per field, Leader vs Agent;
 * **Upload data** in three steps (*Unduh daftar CSV · Lengkapi · Upload*); and **Data anggota**, filtered to *belum
 * lengkap*, with *Kirim pengingat ke n orang* (`wa.me`, one message per person — OD-359). Two columns from 1024px, one on
 * a phone, the same order.
 */
export function DemographicsSection({ platformKpmId, canUpload = false }: { platformKpmId?: string; canUpload?: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const d = t.demographics;
  const language = useFigureLanguage();
  const monthText = useMonthText();
  const monthId = useId();
  const abId = useId();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [ab, setAb] = useState<string | undefined>(undefined);
  const [thisMonth, setThisMonth] = useState<string | null>(null);
  const [view, setView] = useState<Demographics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback((live: () => boolean = () => true) => {
    setError(null);
    readDemographics({ month, ab }, platformKpmId)
      .then((answer) => {
        if (!live()) return;
        setView(answer);
        setThisMonth((m) => m ?? answer.month);
      })
      .catch((err) => { if (live()) setError(toDisplayError(err)); });
  }, [month, ab, platformKpmId]);
  useEffect(() => {
    let live = true;
    load(() => live);
    return () => { live = false; };
  }, [load]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const pct = (value: number | null) => (value === null ? '—' : formatPercent(value, {}, language));
  const writable = view.canUpload && platformKpmId === undefined;

  return (
    <div data-section="demographics">
      <TabControls note={d.dataFrom({ date: formatCalendarDay(view.asOf, language) })}>
        <MonthPicker
          id={monthId}
          label={t.filters.month}
          months={monthsUpTo(thisMonth ?? view.month)}
          value={view.month}
          onChange={setMonth}
          format={monthText}
        />
        <span className="relative inline-flex">
          <label htmlFor={abId} className="sr-only">{t.filters.ab}</label>
          <select
            id={abId}
            value={ab ?? ''}
            onChange={(e) => setAb(e.target.value || undefined)}
            className="h-11 max-w-[14rem] appearance-none truncate rounded-pill border border-hairline bg-card pl-4 pr-9 text-md font-semibold text-ink"
          >
            <option value="">{t.filters.allAbs}</option>
            {view.abs.map((a) => <option key={a.membershipId} value={a.membershipId}>{a.name}</option>)}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm">⌄</span>
        </span>
      </TabControls>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section aria-labelledby={`${monthId}-summary`}>
            <BlockTitle id={`${monthId}-summary`}>{d.summary}</BlockTitle>
            <div data-summary="" className="rounded-card bg-primary p-4 text-primary-contrast">
              <p className="font-bold">{d.totalManpower}</p>
              <p className="mb-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums">{formatNumber(view.summary.manpower, {}, language)}</span>
                <span className="font-semibold">{d.activeMembers}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-row bg-card p-3">
                  <p className="text-sm font-semibold text-ink">{d.complete}</p>
                  <p className="text-2xl font-extrabold tabular-nums text-navy">{formatNumber(view.summary.complete, {}, language)}</p>
                  <p className="text-sm text-muted">{pct(view.summary.completePct)}</p>
                </div>
                <div className="rounded-row bg-secondary p-3 text-secondary-contrast">
                  <p className="text-sm font-semibold">{d.incomplete}</p>
                  <p className="text-2xl font-extrabold tabular-nums text-primary">{formatNumber(view.summary.incomplete, {}, language)}</p>
                  <p className="text-sm font-semibold">{`${pct(view.summary.incompletePct)} · ${d.sendReminder}`}</p>
                </div>
              </div>
            </div>
          </section>
          <Composition view={view} />
        </div>

        <div className="space-y-5">
          <Completeness view={view} />
          {writable && <UploadSteps manpower={view.summary.manpower} onUploaded={() => load()} />}
          <MemberList view={view} canRemind={writable} />
        </div>
      </div>
      {view.manpower === 0 && <NoData canUpload={canUpload} />}
    </div>
  );
}

/** **Komposisi anggota**: one stacked bar per dimension, its source, and a legend; *Belum diisi* hidden on request. */
function Composition({ view }: { view: Demographics }) {
  const t = useMessages(advancedAnalyticsPageMessages).demographics;
  const language = useFigureLanguage();
  const switchId = useId();
  const [hideUnset, setHideUnset] = useState(false);
  const labelOf = (dim: DimKey, c: DimensionCount): string => {
    if (c.key === 'unset') return t.unset;
    if (dim === 'role') return c.label ?? c.key;
    if (dim === 'workStatus') return c.key === 'full_time' ? t.full_time : t.part_time;
    if (dim === 'gender') return c.key === 'male' ? t.male : t.female;
    if (dim === 'ageBand') {
      if (c.key === 'gen_z') return t.gen_z({ from: c.from ?? 0, to: c.to ?? 0 });
      if (c.key === 'gen_y') return t.gen_y({ from: c.from ?? 0, to: c.to ?? 0 });
      return t.gen_x({ from: c.from ?? 0 });
    }
    if (c.from === null || c.from === undefined) return t.tenureBelow({ to: c.to ?? 0 });
    if (c.to === null || c.to === undefined) return t.tenureAbove({ from: c.from });
    return t.tenureBetween({ from: c.from, to: c.to });
  };
  return (
    <section aria-labelledby={`${switchId}-title`}>
      <BlockTitle
        id={`${switchId}-title`}
        aside={(
          <label htmlFor={switchId} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
            <input
              id={switchId}
              type="checkbox"
              role="switch"
              checked={hideUnset}
              onChange={(e) => setHideUnset(e.target.checked)}
              className={cn(
                'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-pill border border-switch-off-edge bg-switch-off transition-colors',
                'before:absolute before:left-0.5 before:top-[1px] before:h-4 before:w-4 before:rounded-full before:bg-switch-off-edge before:transition-transform before:content-[""]',
                'checked:border-secondary checked:bg-secondary checked:before:translate-x-3.5 checked:before:bg-card',
              )}
            />
            {t.hideUnset}
          </label>
        )}
      >
        {t.composition}
      </BlockTitle>
      <div className="divide-y divide-divider rounded-card bg-card">
        {DIMS.map(({ key, source }) => {
          const all = view[key] as DimensionCount[];
          const named = all.filter((x) => x.key !== 'unset');
          const shown = all.filter((c) => c.count > 0 && !(hideUnset && c.key === 'unset'));
          const total = shown.reduce((s, c) => s + c.count, 0);
          const fillOf = (c: DimensionCount) => (c.key === 'unset' ? UNSET_FILL : PALETTE[key][named.indexOf(c) % PALETTE[key].length]);
          return (
            <div key={key} data-dim={key} className="px-4 py-3">
              <p className="mb-1.5 flex items-center gap-2">
                <span className="font-bold text-ink">{t.dims[key]}</span>
                <span className="rounded-pill bg-pill-grey px-2 text-xs font-semibold text-pill-grey-ink">{t.source[source]}</span>
              </p>
              <div aria-hidden="true" className="flex h-6 w-full overflow-hidden rounded-md bg-divider">
                {shown.map((c) => {
                  const share = total === 0 ? 0 : (c.count / total) * 100;
                  const fill = fillOf(c);
                  return (
                    <span
                      key={c.key}
                      className={cn('flex items-center justify-center overflow-hidden text-xs font-bold', fill.fill, fill.light ? 'text-secondary-contrast' : 'text-ink')}
                      style={{ width: `${share}%` }}
                    >
                      {share >= 9 ? `${Math.round(share)}%` : ''}
                    </span>
                  );
                })}
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink">
                {all.filter((c) => !(hideUnset && c.key === 'unset')).map((c) => (
                  <li key={c.key} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-sm', fillOf(c).fill)} />
                    {`${labelOf(key, c)} (${formatNumber(c.count, {}, language)})`}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** **Kelengkapan data**: each required field, *x dari y · %*, a bar, and *Leader % · Agent %*. */
function Completeness({ view }: { view: Demographics }) {
  const t = useMessages(advancedAnalyticsPageMessages).demographics;
  const language = useFigureLanguage();
  const id = useId();
  const pct = (value: number | null) => (value === null ? '—' : formatPercent(value, {}, language));
  return (
    <section aria-labelledby={id}>
      <BlockTitle id={id}>{t.completeness}</BlockTitle>
      <div className="divide-y divide-divider rounded-card bg-card">
        {view.completeness.map((c) => (
          <div key={c.field} data-field={c.field} className="px-4 py-3">
            <p className="flex items-center justify-between gap-2 font-bold text-ink">
              <span>{t.fields[c.field]}</span>
              <span className="tabular-nums text-navy">
                {t.ofTotal({ x: formatNumber(c.filled, {}, language), y: formatNumber(c.of, {}, language), pct: pct(c.pct) })}
              </span>
            </p>
            <span aria-hidden="true" className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-pill bg-divider">
              <span className="block h-full rounded-pill bg-secondary" style={{ width: `${c.pct ?? 0}%` }} />
            </span>
            <p className="mt-1 text-sm text-muted">{t.leaderAgent({ leader: pct(c.leaderPct), agent: pct(c.agentPct) })}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** **Upload data** in three steps: download the list, complete it, upload it — and what became of each row. */
function UploadSteps({ manpower, onUploaded }: { manpower: number; onUploaded: () => void }) {
  const t = useMessages(advancedAnalyticsPageMessages).demographics;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'download' | 'upload' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<DemographicsUploadResult | null>(null);

  const download = async () => {
    setBusy('download');
    setError(null);
    try {
      const { filename, file } = await readDemographicsFile();
      const a = document.createElement('a');
      a.href = fileHref(file);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    setError(null);
    setResult(null);
    try {
      const answer = await uploadDemographics(await textOf(file));
      setResult(answer);
      onUploaded();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };
  const problems = (result?.rows ?? []).filter((r) => r.status === 'not_found' || r.status === 'not_yours' || r.problems.length > 0);
  const step = (n: number, title: string, body: string, action?: ReactNode) => (
    <li className="flex gap-3 px-4 py-3">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-today font-bold text-today-ink">{n}</span>
      <div className="min-w-0">
        <p className="font-bold text-ink">{title}</p>
        <p className="text-sm text-muted">{body}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
  return (
    <section aria-labelledby={id}>
      <BlockTitle id={id}>{t.uploadTitle}</BlockTitle>
      <div className="rounded-card bg-card">
        <ol className="divide-y divide-divider">
          {step(1, t.step1, t.step1Body({ n: manpower }), (
            <Button variant="secondary" className="min-h-11 rounded-pill" disabled={busy !== null} onClick={() => { void download(); }}>
              <LineIcon name="download" className="mr-1.5 h-4 w-4" />
              {t.step1Button}
            </Button>
          ))}
          {step(2, t.step2, t.step2Body)}
          {step(3, t.step3, t.step3Body, (
            <>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                aria-label={t.step3Button}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => { void upload(e.target.files?.[0]); }}
              />
              <Button className="min-h-11 rounded-pill" disabled={busy !== null} onClick={() => input.current?.click()}>
                <NavIcon name="upload" className="mr-1.5 h-4 w-4" />
                {busy === 'upload' ? t.uploading : t.step3Button}
              </Button>
            </>
          ))}
        </ol>
        {error && <div className="px-4 pb-3"><SectionError error={error} /></div>}
        {result && (
          <div role="status" data-upload-result="" className="border-t border-divider px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{t.uploaded(result)}</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {problems.slice(0, 8).map((r) => (
                <li key={`${r.line}-${r.agentCode}`}>
                  {t.rowLine({
                    line: r.line,
                    code: r.agentCode,
                    status: r.problems.length > 0
                      ? `${t.rowStatus.invalid}: ${r.problems.map((p) => p.value).join(', ')}`
                      : t.rowStatus[r.status as 'not_found' | 'not_yours' | 'invalid'],
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** How many rows *Data anggota* shows before *Lihat semua*. */
const FIRST_ROWS = 5;

/** **Data anggota**: filtered to *belum lengkap* by default, a role filter, *Kirim pengingat*, the table. */
function MemberList({ view, canRemind }: { view: Demographics; canRemind: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const d = t.demographics;
  const id = useId();
  const [onlyIncomplete, setOnlyIncomplete] = useState(true);
  const [role, setRole] = useState<'all' | 'ab' | 'aab' | 'agent'>('all');
  const [all, setAll] = useState(false);
  const [remind, setRemind] = useState(false);
  const rows = view.members.filter((m) => (!onlyIncomplete || m.missing.length > 0) && (role === 'all' || m.role === role));
  const incomplete = view.members.filter((m) => m.missing.length > 0 && (role === 'all' || m.role === role));
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  const roleWord = (r: string) => (r === 'ab' ? t.role.ab : r === 'aab' ? t.role.aab : r === 'agent' ? t.role.agent : d.roleAll);
  const blank = <span className="font-semibold text-pill-red-ink">{d.unset}</span>;
  const ageWord = (m: DemographicsMember) => (m.ageBand === null ? blank : d.ageShort[m.ageBand]);
  return (
    <section aria-labelledby={id}>
      <BlockTitle id={id} aside={<span className="text-sm text-muted">{d.activeLeft({ active: view.summary.manpower, left: view.left })}</span>}>
        {d.members}
      </BlockTitle>
      <div className="rounded-card bg-card">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <select
            aria-label={d.filterIncomplete}
            value={onlyIncomplete ? 'incomplete' : 'all'}
            onChange={(e) => setOnlyIncomplete(e.target.value === 'incomplete')}
            className="h-10 rounded-pill border border-hairline bg-card px-3 text-sm font-semibold text-ink"
          >
            <option value="incomplete">{d.filterIncomplete}</option>
            <option value="all">{d.filterAll}</option>
          </select>
          <select
            aria-label={d.roleFilter({ role: d.roleAll })}
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="h-10 rounded-pill border border-hairline bg-card px-3 text-sm font-semibold text-ink"
          >
            {(['all', 'ab', 'aab', 'agent'] as const).map((r) => <option key={r} value={r}>{d.roleFilter({ role: roleWord(r) })}</option>)}
          </select>
          {canRemind && incomplete.length > 0 && (
            <Button className="ml-auto min-h-10 rounded-pill" onClick={() => setRemind(true)}>
              <NavIcon name="whatsapp" className="mr-1.5 h-4 w-4" />
              {d.remindN({ n: incomplete.length })}
            </Button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-md text-muted">{d.nobodyIncomplete}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="relative w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">{d.members}</caption>
              <thead className="text-xs font-semibold text-muted">
                <tr className="border-b border-divider">
                  <th scope="col" className="sticky left-0 z-[1] bg-card px-4 py-2">{d.colName}</th>
                  <th scope="col" className="px-2 py-2">{d.colRole}</th>
                  <th scope="col" className="px-2 py-2">{d.colUpline}</th>
                  <th scope="col" className="px-2 py-2">{d.colWorkStatus}</th>
                  <th scope="col" className="px-2 py-2 pr-4">{d.colAge}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.membershipId} data-member={m.membershipId} className="border-b border-divider last:border-b-0">
                    <th scope="row" className="sticky left-0 z-[1] min-w-[11rem] bg-card px-4 py-2 font-normal">
                      <PersonName person={m} size={28} nameClassName="text-sm" />
                    </th>
                    <td className="px-2 py-2 text-ink">{roleWord(m.role)}</td>
                    <td className="px-2 py-2 text-ink">{m.uplineName ?? '—'}</td>
                    <td className="px-2 py-2 text-ink">
                      {m.workStatus === null ? blank : m.workStatus === 'full_time' ? d.full_time : d.part_time}
                    </td>
                    <td className="px-2 py-2 pr-4 text-ink">{ageWord(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > FIRST_ROWS && (
          <div className="border-t border-divider px-4 py-2 text-center">
            <button type="button" className="min-h-11 text-sm font-bold text-navy" onClick={() => setAll((v) => !v)}>
              {all ? d.showLess : d.seeAll({ n: rows.length })}
            </button>
          </div>
        )}
      </div>
      {remind && <ReminderSheet people={incomplete} onClose={() => setRemind(false)} />}
    </section>
  );
}

/**
 * ***Kirim pengingat ke n orang*** (OD-359's default: `wa.me` from the reader's own WhatsApp, one message per person):
 * each person whose data is missing, with a WhatsApp button whose message names what to fill in.
 */
function ReminderSheet({ people, onClose }: { people: DemographicsMember[]; onClose: () => void }) {
  const t = useMessages(advancedAnalyticsPageMessages).demographics;
  return (
    <ResponsiveSheet open title={t.remindTitle} description={t.remindNote} onClose={onClose}>
      <ul className="divide-y divide-divider">
        {people.map((m) => {
          const fields = m.missing.map((f) => t.fields[f]);
          const href = whatsAppHref(m.phone, t.remindMessage({ name: m.name, fields: fields.join(', ') }));
          return (
            <li key={m.membershipId} className="flex items-center justify-between gap-3 py-2">
              <PersonName person={m} size={32} meta={fields.join(' · ')} />
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t.remindWhatsApp({ name: m.name })}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white"
                >
                  <NavIcon name="whatsapp" className="h-5 w-5" />
                </a>
              ) : (
                <span className="shrink-0 text-sm text-muted">{t.noPhone}</span>
              )}
            </li>
          );
        })}
      </ul>
    </ResponsiveSheet>
  );
}
