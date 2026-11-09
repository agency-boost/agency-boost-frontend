'use client';

import { useState, type ReactNode } from 'react';
import { TonePill } from '@/components/ui/tone-pill';
import type { AnalyticsThresholds, SectionKode } from '@/lib/advanced-analytics';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';
import { NumberBox, type AnalyticsTabProps } from './analytics-shared';

/**
 * **Ambang & benchmark** (P19.5-T1 AC-14; ADR-0215 §8): one card per section, each *Aktif* or *Mati*, holding the
 * section's thresholds. Two columns on a desktop, one on a tablet and a phone. *Minimal KPM pembanding* is fixed at *3
 * KPM* (R3) and Demographics' roles come *Otomatis* from the ladder; *"Pembanding: median KPM lain di perusahaan ini"* is
 * Appendix A's copy (UI-014).
 *
 * A pair that must stay ordered — *Perlu perhatian* below *Masalah besar*, *cukup* below *puas* — is held here, said
 * under the card, and saved only once it is in order.
 */
export function AnalyticsThresholdsTab({ config, view, onChange, disabled }: AnalyticsTabProps) {
  const words = useMessages(adminTemplateAnalyticsMessages);
  const t = words.thresholds;
  const th = config.thresholds;
  const [qual, setQual] = useState({ big: th.qualBigPct, watch: th.qualWatchPct });
  const [support, setSupport] = useState({ prom: th.supportPromMin, pas: th.supportPasMin });
  const set = (change: Partial<AnalyticsThresholds>) => onChange({ ...config, thresholds: { ...th, ...change } });
  const on = (kode: SectionKode) => config.sections.find((s) => s.kode === kode)?.enabled ?? false;
  const floor = view?.limits.ageLabelFloor ?? th.ageBandUpper[0];

  const card = (kode: SectionKode, title: string, body: ReactNode) => (
    <section aria-labelledby={`analytics-th-${kode}`} className="overflow-hidden rounded-lg border border-card-edge bg-card">
      <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5">
        <h2 id={`analytics-th-${kode}`} className="text-md font-bold text-navy">{title}</h2>
        <span className="ml-auto"><TonePill tone={on(kode) ? 'green' : 'grey'}>{on(kode) ? t.on : t.off}</TonePill></span>
      </div>
      <div className="divide-y divide-divider">{body}</div>
    </section>
  );
  const row = (label: ReactNode, sub: ReactNode, value: ReactNode) => (
    <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 md:flex-nowrap">
      <div className="min-w-0 flex-1 text-md text-navy">
        {label}
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-md text-navy">{value}</div>
    </div>
  );
  const fixed = (text: string) => <TonePill tone="grey">{text}</TonePill>;
  const num = (
    value: number, label: string, onValue: (n: number) => void,
    bounds: { min?: number; max?: number; step?: number } = {}, invalid = false,
  ) => (
    <NumberBox value={value} label={label} disabled={disabled} invalid={invalid} className="w-16" {...bounds}
      onValue={(n) => n !== null && onValue(n)} />
  );

  const qualCrossed = qual.watch >= qual.big;
  const supportCrossed = support.pas >= support.prom;
  const setQualPair = (next: typeof qual) => {
    setQual(next);
    if (next.watch < next.big) set({ qualBigPct: next.big, qualWatchPct: next.watch });
  };
  const setSupportPair = (next: typeof support) => {
    setSupport(next);
    if (next.pas < next.prom) set({ supportPromMin: next.prom, supportPasMin: next.pas });
  };
  const [ageZ, ageY] = th.ageBandUpper;

  return (
    <>
      <p className="mb-3.5 text-sm text-muted">{t.hint}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {card('DEMOGRAPHICS', t.demographics, <>
          {row(t.ageBands, t.ageBandsLine({ floor, a: ageZ, b: ageY }), <>
            {num(ageZ, t.ageTopZ, (n) => n < ageY && set({ ageBandUpper: [n, ageY] }), { min: floor + 1, max: 98 })}
            {num(ageY, t.ageTopY, (n) => n > ageZ && set({ ageBandUpper: [ageZ, n] }), { min: floor + 2, max: 99 })}
          </>)}
          {row(t.tenure, `<${th.tenureBands[0]} · ${th.tenureBands[0]}–${th.tenureBands[1]} · ${th.tenureBands[1]}–${th.tenureBands[2]} · >${th.tenureBands[2]}`,
            th.tenureBands.map((v, i) => (
              <span key={i}>{num(v, t.tenureName({ n: i + 1 }), (n) => {
                const next = [...th.tenureBands] as [number, number, number];
                next[i] = n;
                if (next[0] < next[1] && next[1] < next[2]) set({ tenureBands: next });
              }, { min: 1, max: 60 })}</span>
            )))}
          {row(t.roles, t.rolesLine, fixed(t.automatic))}
        </>)}

        {card('QUANT', t.quant, <>
          {row(t.quantBand, t.peers, <>±{num(th.quantPeerBandPct, t.quantBandName, (n) => set({ quantPeerBandPct: n }),
            { min: 0, max: view?.limits.peerBandPctMax, step: 0.5 })}%</>)}
          <div aria-hidden="true" className="mx-4 mb-3 mt-1 flex h-2 overflow-hidden rounded-pill">
            <span className="flex-1 bg-alert" />
            <span className="bg-hairline" style={{ flexGrow: Math.max(th.quantPeerBandPct, 0.5) / 5 }} />
            <span className="flex-1 bg-success" />
          </div>
          {row(t.quantDiff, t.quantDiffLine, <>±{num(th.quantDiffBand, t.quantDiffName, (n) => set({ quantDiffBand: n }), { min: 0, max: 1000 })}</>)}
          {row(t.minPeers, t.minPeersLine, fixed(t.minPeersValue({ n: th.quantMinPeers })))}
          {row(t.runs, t.runsLine, fixed(t.runsValue))}
        </>)}

        {card('QUAL', t.qual, <>
          {row(t.issue, t.issueLine, num(th.qualIssueMaxRating, t.issueName, (n) => set({ qualIssueMaxRating: n }), { min: 1, max: 4 }))}
          {row(<><Dot tone="alert" /> {t.big}</>, t.bigLine,
            <>{num(qual.big, t.bigName, (n) => setQualPair({ ...qual, big: n }), { min: 0, max: 100 }, qualCrossed)}%</>)}
          {row(<><Dot tone="amber" /> {t.watch}</>, null,
            <>{num(qual.watch, t.watchName, (n) => setQualPair({ ...qual, watch: n }), { min: 0, max: 100 }, qualCrossed)}%</>)}
          {qualCrossed && <p role="alert" className="px-4 py-2 text-xs font-semibold text-alert">{t.watchBelow}</p>}
          {row(t.support, t.supportLine, <>
            {num(support.prom, t.supportProm, (n) => setSupportPair({ ...support, prom: n }), { min: 1, max: 10 }, supportCrossed)}
            {num(support.pas, t.supportPas, (n) => setSupportPair({ ...support, pas: n }), { min: 0, max: 9 }, supportCrossed)}
          </>)}
          {supportCrossed && <p role="alert" className="px-4 py-2 text-xs font-semibold text-alert">{t.supportBelow}</p>}
          {row(t.coaching, null, <>{num(th.coachingGoodPct, t.coachingName, (n) => set({ coachingGoodPct: n }), { min: 0, max: 100 })}%</>)}
        </>)}

        {card('SUBGROUP', t.subgroup, <>
          {row(<><Dot tone="success" /> {t.subgroupOk}</>, null,
            <>{num(th.subgroupOkPct, t.subgroupOkName, (n) => set({ subgroupOkPct: n }), { min: 0, max: 100 })}%</>)}
          {row(t.powerUser, t.powerUserLine({ window: th.powerUserWindow }),
            num(th.powerUserDays, t.powerUserName, (n) => set({ powerUserDays: n }), { min: 1, max: th.powerUserWindow }))}
          {row(t.weekly, t.weeklyLine, <>×{num(th.subgroupWeekMultiplier, t.weeklyName, (n) => set({ subgroupWeekMultiplier: n }),
            { min: 1, max: 100, step: 0.5 })}</>)}
          {row(t.heads, t.headsLine, <>
            {t.headAa} {num(th.subgroupHeadDefaults.aa, t.headAaName,
              (n) => set({ subgroupHeadDefaults: { ...th.subgroupHeadDefaults, aa: n } }), { min: 0, max: 1000 })}
            {t.headRec} {num(th.subgroupHeadDefaults.rec, t.headRecName,
              (n) => set({ subgroupHeadDefaults: { ...th.subgroupHeadDefaults, rec: n } }), { min: 0, max: 1000 })}
          </>)}
        </>)}

        {card('MAPA', t.mapa, <>
          {row(t.mapaRows, t.mapaRowsLine, fixed(t.fromUpload))}
          {row(t.mapaTargets, t.mapaTargetsLine, fixed(t.byKpm))}
        </>)}

        {card('NPS', t.nps, <>
          {row(t.npsCutoffs, t.npsCutoffsLine, (
            // 44px below 1024px (P19.2-T2 AC-5; UI-135), its words centred in it.
            <a href="#survei" className="text-sm font-semibold text-muted underline-offset-2 hover:text-navy hover:underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">
              {`${config.nps.promoterMin}–10 · ${config.nps.passiveMin}–${config.nps.promoterMin - 1} · 0–${config.nps.passiveMin - 1}`}
            </a>
          ))}
          {row(t.npsChange, t.npsChangeLine, fixed(t.fixed))}
        </>)}
      </div>
    </>
  );
}

/** A band's colour beside its words — never the only cue: the words are always there. */
function Dot({ tone }: { tone: 'alert' | 'amber' | 'success' }) {
  const colour = tone === 'alert' ? 'bg-alert' : tone === 'amber' ? 'bg-amber' : 'bg-success';
  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full align-middle ${colour}`} />;
}
