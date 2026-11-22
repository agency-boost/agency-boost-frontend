'use client';

import type { ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { surveyAnalyticsMessages } from '@/i18n/messages/surveys-analytics';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import type { NpsShares, SurveyQuote } from '@/lib/surveys';

/*
 * **The pieces NPS, *Analisa kualitatif* and *Survei baru* share** (P19.22-T6, T7; ADR-0276): the pill switches of the
 * mockups' `.seg`, the period dropdown, the promoter · passive · detractor bar, the four-quarter trend, the navy response
 * panel, a quote with its *Leader / Agent* tag, the *% masalah* pill and *semester lalu*'s arrow. Tokens only
 * (`nps-*`, `survey-*`, `tenure-*`; DESIGN-RULES).
 */

/** A whole percentage in the reader's figures — *62%* — or *—* for none. */
export function usePct(): (n: number | null | undefined) => string {
  const figures = useFigureLanguage();
  return (n) => (n === null || n === undefined ? '—' : formatPercent(n, {}, figures));
}

/** A change in *poin* with its sign: *+5*, *−2*, *0*. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/**
 * **The mockups' `.seg`**: two or three pills on a white track, the one on navy — *Hasil | Survei baru*, *Semua | Leader |
 * Agent*, *Semua · Sudah · Belum*. Buttons with `aria-pressed` in a named group: each switches what the page shows, and
 * none of them is a tab with a panel of its own.
 */
export function SegmentPills<T extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex shrink-0 rounded-pill border border-card-edge bg-card p-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn(
            'min-h-9 whitespace-nowrap rounded-pill px-3.5 text-md font-semibold',
            o.id === value ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** **The period dropdown** (*Q3 2026 ⌄*, *Jun 2026 ⌄*, *Semua group ⌄*): a native select, so it always opens inside the screen. */
export function PillSelect<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="min-h-11 shrink-0 rounded-pill border border-card-edge bg-card px-4 text-md font-semibold text-ink"
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

/**
 * **The promoter · passive · detractor bar** — green, yellow, red, each with its share written on it when there is room
 * (DESIGN-RULES *NPS bars*). The shares are also its accessible name: colour is never the only cue.
 */
export function ShareBar({ shares, slim = false }: { shares: NpsShares; slim?: boolean }) {
  const t = useMessages(surveyAnalyticsMessages).nps;
  const pct = usePct();
  const parts = [
    { key: 'p', value: shares.promoterPct, cls: 'bg-nps-promoter text-white' },
    { key: 'pa', value: shares.passivePct, cls: 'bg-nps-passive text-navy' },
    { key: 'd', value: shares.detractorPct, cls: 'bg-nps-detractor text-white' },
  ];
  return (
    <div
      role="img"
      aria-label={t.shareName({ p: shares.promoterPct, pa: shares.passivePct, d: shares.detractorPct })}
      className={cn('flex w-full overflow-hidden rounded-sm', slim ? 'h-1.5' : 'h-5')}
    >
      {parts.filter((x) => x.value > 0).map((x) => (
        <span key={x.key} style={{ width: `${x.value}%` }} className={cn('flex items-center justify-center text-2xs font-bold', x.cls)}>
          {!slim && x.value >= 7 ? pct(x.value) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * **The four-quarter trend**: one bar per run, the last one stressed (orange on navy, navy on white); a hidden run an
 * empty slot. Its name reads the figures, oldest first.
 */
export function TrendBars({ values, onNavy = false }: { values: readonly (number | null)[]; onNavy?: boolean }) {
  const t = useMessages(surveyAnalyticsMessages).nps;
  const pct = usePct();
  const shown = values.filter((v): v is number => v !== null);
  const low = Math.min(0, ...shown);
  const high = Math.max(1, ...shown);
  const height = (v: number) => 30 + Math.round((70 * (v - low)) / (high - low || 1));
  return (
    <div role="img" aria-label={t.trendName({ values: values.map((v) => pct(v)).join(' → ') })} className="flex h-6 w-28 items-end gap-1">
      {values.map((v, i) => (
        <span
          // The trend's place, not its value, is the key: two quarters can score alike.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          style={{ height: v === null ? '12%' : `${height(v)}%` }}
          className={cn(
            'flex-1 rounded-[3px]',
            i === values.length - 1
              ? (onNavy ? 'bg-primary' : 'bg-secondary')
              : (onNavy ? 'bg-secondary-contrast/25' : 'bg-secondary/20'),
            v === null && 'bg-transparent outline outline-1 outline-dashed outline-secondary/30',
          )}
        />
      ))}
    </div>
  );
}

/**
 * **The navy response-rate panel** (brief line 70; P19.22-T6 AC-3, T7 AC-1): *63%*, *x dari y menjawab*, *n leader · n
 * agent*, and one bar — leaders orange, agents light orange, not answered faint white — with its legend.
 */
export function ResponsePanel({ sent, invited, leaders, agents, title }: {
  sent: number; invited: number; leaders: number; agents: number; title?: string;
}) {
  const t = useMessages(surveyAnalyticsMessages).response;
  const pct = usePct();
  const share = (n: number) => (invited === 0 ? 0 : (100 * n) / invited);
  const notYet = Math.max(0, invited - sent);
  return (
    <section data-response-panel="" className="flex flex-col gap-3 rounded-lg bg-secondary px-4 py-4 text-secondary-contrast md:flex-row md:items-center md:gap-5">
      <div className="shrink-0">
        <p className="text-xs font-semibold text-secondary-contrast/75">{title ?? t.title}</p>
        <p className="text-[34px] font-extrabold leading-none">{pct(invited === 0 ? null : Math.round(share(sent)))}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap justify-between gap-x-3 text-md font-bold">
          <span>{t.answered({ n: sent, m: invited })}</span>
          <span className="text-xs font-semibold">{t.split({ l: leaders, a: agents })}</span>
        </p>
        <div className="mt-2 flex h-3 overflow-hidden rounded-pill bg-secondary-contrast/20" aria-hidden="true">
          <span style={{ width: `${share(leaders)}%` }} className="bg-primary" />
          <span style={{ width: `${share(agents)}%` }} className="bg-survey-agent" />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-primary" />{t.leader}</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-survey-agent" />{t.agent}</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-secondary-contrast/40" />{t.notYet({ n: notYet })}</span>
        </p>
      </div>
    </section>
  );
}

/** One quote, its writer's class in front where the server gives it (ADR-0276 §3). */
export function Quote({ quote }: { quote: SurveyQuote }) {
  const t = useMessages(surveyAnalyticsMessages).quoteWho;
  return (
    <li className="flex items-start gap-2 rounded-row bg-hover-row px-3 py-2 text-md italic text-ink">
      {quote.who && <span className="shrink-0 rounded-pill bg-card px-2 py-0.5 text-xs font-bold not-italic text-navy">{t[quote.who]}</span>}
      <span>“{quote.text}”</span>
    </li>
  );
}

/** *% masalah*: red at the template's big threshold, yellow at its watch one, green below (the server's `severity`). */
export function IssuePill({ pct, severity }: { pct: number | null; severity: 'big' | 'watch' | null }) {
  const show = usePct();
  return (
    <span className={cn(
      'inline-block min-w-12 rounded-pill px-2 py-0.5 text-center text-xs font-bold',
      pct === null ? 'bg-pill-grey text-pill-grey-ink'
        : severity === 'big' ? 'bg-pill-red text-pill-red-ink'
          : severity === 'watch' ? 'bg-pill-amber text-pill-amber-ink' : 'bg-pill-green text-pill-green-ink',
    )}
    >
      {show(pct)}
    </span>
  );
}

/** *Semester lalu*: last half's figure and ▲ worse (red) · ▼ better (green). */
export function LastHalf({ pct, trend }: { pct: number | null; trend: 'worse' | 'better' | 'same' | null }) {
  const t = useMessages(surveyAnalyticsMessages).qual.trend;
  const show = usePct();
  if (pct === null) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      {show(pct)}
      {trend && trend !== 'same' && (
        <b aria-label={t[trend]} className={trend === 'worse' ? 'text-signal-red' : 'text-signal-green'}>{trend === 'worse' ? '▲' : '▼'}</b>
      )}
    </span>
  );
}

/** A section's title row: its name, and a small right-hand note (*N = 19*, *hanya leader*). */
export function SectionHead({ title, note, id }: { title: ReactNode; note?: ReactNode; id?: string }) {
  return (
    <div className="mb-1.5 mt-4 flex items-baseline justify-between gap-2 first:mt-0">
      <h3 id={id} className="text-md font-bold text-navy">{title}</h3>
      {note && <span className="text-xs font-semibold text-muted">{note}</span>}
    </div>
  );
}

/** A stacked bar of counts with their legend: *Status kerja*, *Lama di KPM*. */
export function CountStack({ parts }: { parts: readonly { key: string; n: number; label: string; cls: string; ink?: string }[] }) {
  const pct = usePct();
  const total = parts.reduce((s, p) => s + p.n, 0);
  return (
    <>
      <div className="flex h-5 overflow-hidden rounded-sm" aria-hidden="true">
        {parts.filter((p) => p.n > 0).map((p) => (
          <span key={p.key} style={{ width: `${(100 * p.n) / (total || 1)}%` }} className={cn('flex items-center justify-center text-2xs font-bold', p.cls, p.ink ?? 'text-white')}>
            {(100 * p.n) / (total || 1) >= 9 ? pct(Math.round((100 * p.n) / (total || 1))) : null}
          </span>
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1"><i aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-sm', p.cls)} />{p.label}</li>
        ))}
      </ul>
    </>
  );
}
