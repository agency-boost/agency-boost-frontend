'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KpmReportSlot, KPM_REPORT_READY } from '@/components/admin/kpm-report-slot';
import { OwnerWhatsAppInviteButton } from '@/components/admin/owner-whatsapp-invite';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink, ErrorBanner } from '@/components/ui/field';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages, type AdminConsoleWords } from '@/i18n/messages/admin-console';
import {
  countsFor, issueTarget, readConsoleDashboard, sumUsage, toneOf, TONE_PILL, wholePct,
  type Audience, type ConsoleDashboard, type ConsoleKpm, type ConsoleScale, type FunnelStep, type UsageCounts,
} from '@/lib/admin-console';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthName, formatNumber } from '@/lib/format';
import { enterKpm, leaveKpm } from '@/lib/super-admin-kpm';

type Words = AdminConsoleWords['dashboard'];

/** *Langganan*'s calculator for one KPM (P19.23-T5, ADR-0279), loaded when *Perpanjang* first opens it. */
const CalculatorDialog = dynamic(
  () => import('@/components/admin/billing/calculator-dialog').then((m) => m.CalculatorDialog), { ssr: false },
);

/**
 * **The console's Dashboard** (`/admin`; P19.23-T1 AC-2 to AC-4; ADR-0277 §1, §2; the Super Admin spec §3,
 * `superadmin-tablet-stopmotion-2026-11-19` f01–f04, `superadmin-mobile-…` f01–f04).
 *
 * - **The navy summary**: *Keseluruhan*'s four tiles — *KPM* (+n bulan ini), *Perusahaan*, *KPM aktif dari n*,
 *   *Anggota* (leader · agent) — and *Pemakaian AgencyBoost*: Anggota → Pernah pakai → Pakai 14 hari terakhir → Power
 *   user, each with its count, its share and its change on the same day last month.
 * - ***Perlu tindakan***: one row per issue, every KPM named by its name and company, one button straight to where it
 *   is acted on — inside that KPM (the owner page), the invitation by WhatsApp, *Langganan*, *Persetujuan*.
 * - ***Adopsi per KPM***: company first with its totals, its active KPMs beneath (name, the code small); *Semua · Leader
 *   · Agent* changes every number; a KPM's name goes inside it. The pills on the server's scale (`scale`).
 *
 * The page is outside every KPM: arriving here leaves the one a tab had entered (`leaveKpm`).
 */
export default function ConsoleDashboardPage() {
  const t = useMessages(adminConsoleMessages).dashboard;
  const [data, setData] = useState<ConsoleDashboard | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await readConsoleDashboard());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => {
    leaveKpm();
    void load();
  }, [load]);

  return (
    <Page title={t.title}>
      {error && <ErrorBanner {...error} />}
      {!data && !error && <SkeletonCards count={3} label={t.loading} />}
      {data && (
        <div className="flex flex-col gap-6">
          <Summary data={data} t={t} />
          <Attention data={data} t={t} onChanged={load} />
          <Adoption data={data} t={t} />
        </div>
      )}
    </Page>
  );
}

/** The navy summary (AC-2): the four tiles and the funnel. */
function Summary({ data, t }: { data: ConsoleDashboard; t: Words }) {
  const fig = useFigureLanguage();
  const n = (value: number) => formatNumber(value, {}, fig);
  const { overall, funnel } = data;
  // The insurers with the most KPMs first, as the tile names them.
  const companyNames = useMemo(() => {
    const count = new Map<string, number>();
    for (const k of data.kpms) count.set(k.companyId, (count.get(k.companyId) ?? 0) + 1);
    return [...data.companies]
      .sort((a, b) => (count.get(b.companyId) ?? 0) - (count.get(a.companyId) ?? 0) || a.name.localeCompare(b.name))
      .map((c) => c.name.split(' ')[0]!);
  }, [data]);

  const tile = (label: string, value: string, sub: React.ReactNode) => (
    <div className="min-w-0 rounded-xl bg-secondary-contrast/[0.08] px-3 py-2">
      <dt className="text-sm font-semibold">{label}</dt>
      <dd>
        <b className="block text-[1.625rem] font-extrabold leading-tight text-primary">{value}</b>
        <span className="block truncate text-xs text-secondary-contrast/75">{sub}</span>
      </dd>
    </div>
  );

  return (
    <section
      aria-labelledby="console-overall"
      data-console-summary=""
      className="rounded-[20px] bg-secondary p-4 text-secondary-contrast md:p-5 lg:grid lg:grid-cols-2 lg:gap-6"
    >
      <div>
        <h2 id="console-overall" className="text-md font-bold">{t.overall}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {tile(t.kpm, n(overall.kpms), t.newThisMonth({ n: n(overall.kpmsNewThisMonth) }))}
          {tile(t.companies, n(overall.companies), (
            <>
              <span className="md:hidden">
                {companyNames.length > 1
                  ? t.moreCompanies({ first: companyNames[0]!, n: n(companyNames.length - 1) })
                  : companyNames[0] ?? ''}
              </span>
              <span className="max-md:hidden">{companyNames.join(' · ')}</span>
            </>
          ))}
          {tile(t.activeKpms, n(overall.activeKpms), t.ofKpms({ n: n(overall.kpms) }))}
          {tile(t.members, n(overall.leaders + overall.agents), t.leadersAgents({ l: n(overall.leaders), a: n(overall.agents) }))}
        </dl>
      </div>
      <div className="mt-4 border-t border-secondary-contrast/15 pt-4 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <h2 className="text-md font-bold">{t.usageOf({ n: n(funnel.members) })}</h2>
        <ul className="mt-2 divide-y divide-secondary-contrast/10" data-console-funnel="">
          <FunnelRow label={t.step.members} count={funnel.members} pct={100} first t={t} />
          <FunnelRow label={t.step.everUsed} count={funnel.everUsed.count} pct={funnel.everUsed.pct} change={countChange(funnel.everUsed, t, n)} t={t} />
          <FunnelRow label={t.step.used14} count={funnel.used14.count} pct={funnel.used14.pct} change={pointChange(funnel.used14, t, n)} t={t} />
          <FunnelRow label={t.step.powerUsers} count={funnel.powerUsers.count} pct={funnel.powerUsers.pct} change={countChange(funnel.powerUsers, t, n)} t={t} />
        </ul>
      </div>
    </section>
  );
}

interface Change { text: string; up: boolean }

/** A count's change on last month: *▲ 3*, nothing when it held. */
function countChange(step: FunnelStep, t: Words, n: (v: number) => string): Change | null {
  const d = step.count - step.previousCount;
  if (d === 0) return null;
  return { text: d > 0 ? t.up({ n: n(d) }) : t.down({ n: n(-d) }), up: d > 0 };
}

/** A share's change on last month, in points: *▲ 5 poin*. */
function pointChange(step: FunnelStep, t: Words, n: (v: number) => string): Change | null {
  const d = step.pct - step.previousPct;
  if (d === 0) return null;
  return { text: d > 0 ? t.upPoints({ n: n(d) }) : t.downPoints({ n: n(-d) }), up: d > 0 };
}

/**
 * One step of the funnel: on a phone the name (with its change) and the share and count, the bar under them
 * (`superadmin-mobile` f01); from 768px one line — name, bar, count, share, change (`superadmin-tablet` f01).
 */
function FunnelRow({ label, count, pct, change, first = false, t }: {
  label: string; count: number; pct: number; change?: Change | null; first?: boolean; t: Words;
}) {
  const fig = useFigureLanguage();
  const changeNode = change ? (
    <span className={cn('whitespace-nowrap text-xs font-bold', change.up ? 'text-on-navy-green' : 'text-on-navy-red')}>
      <span aria-hidden="true">{change.text}</span>
      <span className="sr-only">{t.changeSaid({ change: change.text })}</span>
    </span>
  ) : null;
  return (
    <li
      className={cn(
        'grid items-center gap-x-3 gap-y-1.5 py-2',
        "grid-cols-[minmax(0,1fr)_auto_auto] [grid-template-areas:'label_pct_count''bar_bar_bar']",
        "md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2.75rem_3rem_5rem] md:[grid-template-areas:'label_bar_count_pct_change']",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-md font-bold [grid-area:label]">
        <span className="truncate">{label}</span>
        <span className="md:hidden">{changeNode}</span>
      </span>
      <span aria-hidden="true" className="block h-2 overflow-hidden rounded-pill bg-secondary-contrast/15 [grid-area:bar]">
        <span className="block h-full rounded-pill bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </span>
      <b className="text-right text-lg font-extrabold tabular-nums [grid-area:count]">{formatNumber(count, {}, fig)}</b>
      <span className={cn('text-right text-md font-bold tabular-nums text-primary [grid-area:pct]', first && 'md:invisible')}>{pct}%</span>
      <span className="text-right max-md:hidden md:[grid-area:change]">{changeNode}</span>
    </li>
  );
}

interface AttentionRow {
  key: string;
  icon: NavIconName;
  tone: 'red' | 'amber' | 'navy';
  text: string;
  action: React.ReactNode;
}

const ROW_TONE: Record<AttentionRow['tone'], string> = {
  red: 'bg-pill-red text-pill-red-ink',
  amber: 'bg-pill-amber text-pill-amber-ink',
  navy: 'bg-secondary-50 text-secondary-ink',
};

/** *Perlu tindakan · n* (AC-3): one row per issue, the KPM's name and company, one button. Hidden with nothing to do. */
function Attention({ data, t, onChanged }: { data: ConsoleDashboard; t: Words; onChanged: () => void }) {
  const fig = useFigureLanguage();
  const rows: AttentionRow[] = [];
  for (const kpm of data.kpms) {
    const named = `${kpm.name} · ${kpm.companyName}`;
    for (const issue of kpm.issues) {
      const key = `${kpm.kpmId}-${issue}`;
      if (issue === 'no_members') {
        rows.push({ key, icon: 'ti-user-x', tone: 'red', text: t.noMembers({ kpm: named }), action: <Inside kpm={kpm} issue={issue} label={t.openPeople} /> });
      } else if (issue === 'owner_not_invited') {
        rows.push({
          key, icon: 'ti-mail-off', tone: 'red', text: t.ownerNotInvited({ kpm: named }),
          action: <OwnerWhatsAppInviteButton kpmId={kpm.kpmId} ownerName={kpm.ownerName ?? undefined} label={t.sendInvite} variant="outline" onSent={onChanged} />,
        });
      } else if (issue === 'data_missing' && kpm.missingMonth) {
        rows.push({
          key, icon: 'ti-upload', tone: 'amber', text: t.dataMissing({ month: formatMonthName(kpm.missingMonth, fig), kpm: named }),
          action: <Inside kpm={kpm} issue={issue} label={t.open} />,
        });
      } else if (issue === 'subscription_ended') {
        rows.push({
          key, icon: 'ti-credit-card', tone: 'amber', text: t.subscriptionEnded({ kpm: named }),
          action: <Renew kpmId={kpm.kpmId} label={t.renew} onChanged={onChanged} />,
        });
      }
    }
  }
  if (data.approvalsPending > 0) {
    rows.push({
      key: 'approvals', icon: 'ti-checklist', tone: 'navy', text: t.approvals({ n: formatNumber(data.approvalsPending, {}, fig) }),
      action: <ButtonLink href="/admin/approvals" variant="secondary" className="h-10 px-3 text-sm">{t.open}</ButtonLink>,
    });
  }
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="console-attention">
      <h2 id="console-attention" className="mb-2 text-md font-bold text-navy">{t.attention({ n: formatNumber(rows.length, {}, fig) })}</h2>
      <ul className="grid gap-2 md:grid-cols-2" data-console-attention="">
        {rows.map((row) => (
          <li key={row.key} data-attention-row={row.key} className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5">
            <span aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ROW_TONE[row.tone])}>
              <NavIcon name={row.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold text-navy">{row.text}</span>
            <span className="shrink-0">{row.action}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * ***Perpanjang***: *Langganan*'s calculator for that KPM, in a dialog over the Dashboard (P19.23-T1 AC-3; ADR-0279's
 * `CalculatorDialog`, which reads its own prices and the KPM's row); confirmed, the Dashboard reads again.
 */
function Renew({ kpmId, label, onChanged }: { kpmId: string; label: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-renew-kpm={kpmId}
        className="inline-flex h-10 items-center justify-center rounded-md border border-hairline bg-card px-3 text-sm font-semibold text-navy"
      >
        {label}
      </button>
      {open && (
        <CalculatorDialog kpmId={kpmId} onClose={() => setOpen(false)} onConfirmed={() => { setOpen(false); onChanged(); }} />
      )}
    </>
  );
}

/** A button that goes inside the KPM to the owner page where the issue is acted on (AC-3). */
function Inside({ kpm, issue, label }: { kpm: ConsoleKpm; issue: ConsoleKpm['issues'][number]; label: string }) {
  const target = issueTarget(issue)!;
  return (
    <Link
      href={target.href}
      onClick={() => enterKpm(kpm.kpmId)}
      data-enter-kpm={kpm.kpmId}
      className="inline-flex h-10 items-center justify-center rounded-md border border-hairline bg-card px-3 text-sm font-semibold text-navy"
    >
      {label}
    </Link>
  );
}

/** *Adopsi per KPM* (AC-4). */
function Adoption({ data, t }: { data: ConsoleDashboard; t: Words }) {
  const [audience, setAudience] = useState<Audience>('all');
  const groups = useMemo(() => data.companies.map((company) => ({
    company,
    kpms: data.kpms.filter((k) => k.active && k.companyId === company.companyId),
  })), [data]);
  const tabs = [{ id: 'all', label: t.all }, { id: 'leader', label: t.leader }, { id: 'agent', label: t.agent }];
  return (
    <section aria-labelledby="console-adoption">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="console-adoption" className="text-md font-bold text-navy">{t.adoption}</h2>
      </div>
      <Segmented label={t.audience} tabs={tabs} active={audience} onSelect={(id) => setAudience(id as Audience)} phoneLayout="wrap">
        {() => (
          groups.every((g) => g.kpms.length === 0)
            ? <EmptyState title={t.empty} />
            : <AdoptionTree groups={groups} audience={audience} scale={data.scale} t={t} />
        )}
      </Segmented>
      <ul className="mt-3 flex flex-col gap-1 text-sm text-muted md:flex-row md:flex-wrap md:gap-x-5">
        <li>{t.notes.everUsed}</li>
        <li>{t.notes.used14}</li>
        <li>{t.notes.powerUsers}</li>
        <li>{t.notes.tap}</li>
      </ul>
    </section>
  );
}

type Group = { company: { companyId: string; name: string }; kpms: ConsoleKpm[] };

/**
 * The tree: a table from 768px (company rows, their KPMs indented beneath), and on a phone a card per company with a
 * card per KPM, each figure under its column's name (§12).
 */
function AdoptionTree({ groups, audience, scale, t }: { groups: Group[]; audience: Audience; scale: ConsoleScale; t: Words }) {
  const fig = useFigureLanguage();
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setClosed((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const n = (v: number) => formatNumber(v, {}, fig);

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl bg-card max-md:hidden">
        <table className="relative w-full table-fixed text-left text-sm" data-console-adoption="">
          <thead className="border-b border-divider text-xs font-bold text-muted">
            <tr>
              <th scope="col" className="w-[30%] px-4 py-2.5">{t.columns.kpm}</th>
              <th scope="col" className="w-[12%] px-2 py-2.5">{t.columns.members}</th>
              <th scope="col" className="px-2 py-2.5">{t.columns.everUsed}</th>
              <th scope="col" className="px-2 py-2.5">{t.columns.used14}</th>
              <th scope="col" className="px-2 py-2.5">{t.columns.powerUsers}</th>
              {KPM_REPORT_READY && <th scope="col" className="w-16 px-2 py-2.5 text-center">{t.columns.report}</th>}
            </tr>
          </thead>
          {groups.map(({ company, kpms }) => {
            const total = countsFor(sumUsage(kpms), audience);
            const split = sumUsage(kpms);
            const open = !closed.has(company.companyId);
            return (
              <tbody key={company.companyId} data-adoption-company={company.name} className="border-b border-divider last:border-b-0">
                <tr className="bg-pill-grey/40">
                  <th scope="rowgroup" className="px-4 py-2.5 font-normal">
                    <button
                      type="button"
                      onClick={() => toggle(company.companyId)}
                      aria-expanded={kpms.length > 0 ? open : undefined}
                      disabled={kpms.length === 0}
                      className="flex min-h-10 w-full items-center gap-2 text-left"
                    >
                      <NavIcon name="ti-chevron-down" className={cn('h-4 w-4 shrink-0 text-muted transition-transform', !open && '-rotate-90')} />
                      <span className="min-w-0">
                        <b className="block truncate text-md text-navy">{company.name}</b>
                        <span className="block text-xs text-muted">{t.kpmCount({ n: n(kpms.length) })}</span>
                      </span>
                    </button>
                  </th>
                  <td className="px-2 py-2.5"><MembersCell total={total.members} split={split} name={company.name} t={t} /></td>
                  {kpms.length === 0 ? (
                    <td colSpan={KPM_REPORT_READY ? 4 : 3} className="px-2 py-2.5 text-muted">{t.noKpmYet}</td>
                  ) : (
                    <>
                      <td className="px-2 py-2.5"><PctCell part={total.everUsed} of={total.members} scale={scale} t={t} /></td>
                      <td className="px-2 py-2.5"><PctCell part={total.used14} of={total.members} scale={scale} t={t} /></td>
                      <td className="px-2 py-2.5"><PctCell part={total.powerUsers} of={total.members} scale={scale} t={t} /></td>
                      {KPM_REPORT_READY && <td />}
                    </>
                  )}
                </tr>
                {open && kpms.map((kpm) => {
                  const c = countsFor(kpm.usage, audience);
                  return (
                    <tr key={kpm.kpmId} data-adoption-kpm={kpm.kpmId}>
                      <td className="py-2.5 pl-10 pr-2">
                        <Link href={`/admin/tenants/${kpm.kpmId}`} aria-label={t.enter({ kpm: kpm.name })} className="block min-w-0 rounded-md">
                          <b className="block truncate text-md text-navy">{kpm.name}</b>
                          <span className="block text-xs text-muted">{t.code({ code: kpm.code })}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2.5"><MembersCell total={c.members} split={kpm.usage} name={kpm.name} t={t} /></td>
                      <td className="px-2 py-2.5"><PctCell part={c.everUsed} of={c.members} scale={scale} t={t} /></td>
                      <td className="px-2 py-2.5"><PctCell part={c.used14} of={c.members} scale={scale} t={t} /></td>
                      <td className="px-2 py-2.5"><PctCell part={c.powerUsers} of={c.members} scale={scale} t={t} /></td>
                      {KPM_REPORT_READY && (
                        <td className="px-2 py-2.5 text-center">
                          <KpmReportSlot kpm={{ kpmId: kpm.kpmId, name: kpm.name, code: kpm.code, companyName: kpm.companyName }} placement="row" />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Below 768px (§12): no table — a card per company, a card per KPM, the column's name above each figure. */}
      <div className="mt-3 flex flex-col gap-4 md:hidden" data-console-adoption-cards="">
        {groups.map(({ company, kpms }) => {
          const total = countsFor(sumUsage(kpms), audience);
          return (
            <section key={company.companyId} aria-label={company.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="min-w-0">
                  <b className="block truncate text-md text-navy">{company.name}</b>
                  <span className="block text-xs text-muted">{kpms.length === 0 ? t.noKpmYet : t.kpmCount({ n: n(kpms.length) })}</span>
                </span>
                {kpms.length > 0 && <MembersCell total={total.members} split={sumUsage(kpms)} name={company.name} t={t} />}
              </div>
              {kpms.map((kpm) => {
                const c = countsFor(kpm.usage, audience);
                return (
                  <div key={kpm.kpmId} className="rounded-xl bg-card p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/admin/tenants/${kpm.kpmId}`} aria-label={t.enter({ kpm: kpm.name })} className="min-h-10 min-w-0">
                        <b className="block truncate text-md text-navy">{kpm.name}</b>
                        <span className="block text-xs text-muted">{t.code({ code: kpm.code })}</span>
                      </Link>
                      {KPM_REPORT_READY && (
                        <KpmReportSlot kpm={{ kpmId: kpm.kpmId, name: kpm.name, code: kpm.code, companyName: kpm.companyName }} placement="row" />
                      )}
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                      <div><dt className="text-xs font-semibold text-muted">{t.columns.members}</dt><dd><MembersCell total={c.members} split={kpm.usage} name={kpm.name} t={t} /></dd></div>
                      <div><dt className="text-xs font-semibold text-muted">{t.columns.everUsed}</dt><dd><PctCell part={c.everUsed} of={c.members} scale={scale} t={t} /></dd></div>
                      <div><dt className="text-xs font-semibold text-muted">{t.columns.used14}</dt><dd><PctCell part={c.used14} of={c.members} scale={scale} t={t} /></dd></div>
                      <div><dt className="text-xs font-semibold text-muted">{t.columns.powerUsers}</dt><dd><PctCell part={c.powerUsers} of={c.members} scale={scale} t={t} /></dd></div>
                    </dl>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** A share as the scale colours it, and *n dari t* beside it. */
function PctCell({ part, of, scale, t }: { part: number; of: number; scale: ConsoleScale; t: Words }) {
  const fig = useFigureLanguage();
  const pct = wholePct(part, of);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5" data-pct={pct}>
      <span className={cn('rounded-pill px-2 py-0.5 text-sm font-bold tabular-nums', TONE_PILL[toneOf(pct, scale)])}>{pct}%</span>
      <span className="text-xs text-muted">{t.nOf({ n: formatNumber(part, {}, fig), of: formatNumber(of, {}, fig) })}</span>
    </span>
  );
}

/** *Anggota* and its ⓘ: a tap shows *Leader x · Agent y* (`superadmin-tablet` f04). */
function MembersCell({ total, split, name, t }: { total: number; split: { leader: UsageCounts; agent: UsageCounts }; name: string; t: Words }) {
  const fig = useFigureLanguage();
  const [open, setOpen] = useState(false);
  const words = t.split({ l: formatNumber(split.leader.members, {}, fig), a: formatNumber(split.agent.members, {}, fig) });
  return (
    <span className="relative inline-flex items-center gap-1">
      <b className="text-md tabular-nums text-navy">{formatNumber(total, {}, fig)}</b>
      <button
        type="button"
        aria-label={t.splitOf({ name })}
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        onBlur={() => setOpen(false)}
        className="-m-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-navy"
      >
        <NavIcon name="ti-info-circle" className="h-4 w-4" />
      </button>
      {open && (
        <span role="status" className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-secondary-contrast shadow-md">
          {words}
        </span>
      )}
    </span>
  );
}
