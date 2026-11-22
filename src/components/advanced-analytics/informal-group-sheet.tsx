'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  readInformalSheet, type DriverFigure, type InformalAbGroup, type InformalSheet, type SheetDriver, type SheetPerson,
} from '@/lib/advanced-analytics-page';
import { formatMonth, formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import { whatsAppHref } from '@/lib/phone-number';
import { PersonName, SectionError } from './shared';

const TargetDialog = dynamic(() => import('@/components/groups/target-dialog'), { ssr: false });

/** The AB's first name, as the WhatsApp button names them: *WhatsApp Agus · kirim daftar ini*. */
const firstName = (name: string) => {
  const word = name.trim().split(/\s+/)[0] ?? '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

/**
 * **The people behind one number of an AB group** (P19.22-T5 AC-4; ADR-0275 §5; the approved frames 32–37) — the sheet a
 * pill opens, the Unit Dashboard's tile sheets' pattern: **MAA** who is active (APE, polis) and who is not yet, nearest
 * first; **Pemakaian** who has not used the app or rarely, then the ones who do, power users ★ first; **1-on-1** never
 * (red), more than 14 days (yellow), within 14 days (green); **Rekrut** who joined this year and who recruited them, and
 * the recruit potential in Leads. Each with the green **WhatsApp {AB} · kirim daftar ini** — the message filled in with
 * the names, editable in WhatsApp before it is sent (`wa.me`, OD-359) — and MAA's and Rekrut's with **Ubah target** (the
 * target dialog; the group and Total KPM add up on save).
 */
export function InformalGroupSheet({
  ab, driver, month, canWrite, onClose, onTargetSaved,
}: {
  ab: InformalAbGroup['ab'];
  driver: SheetDriver;
  month: string;
  canWrite: boolean;
  onClose: () => void;
  onTargetSaved: () => void;
}) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const s = t.subgroup.sheet;
  const language = useFigureLanguage();
  const [view, setView] = useState<InformalSheet | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [target, setTarget] = useState(false);

  const load = useCallback((live: () => boolean = () => true) => {
    setError(null);
    readInformalSheet(ab.membershipId, driver, month)
      .then((answer) => { if (live()) setView(answer); })
      .catch((err) => { if (live()) setError(toDisplayError(err)); });
  }, [ab.membershipId, driver, month]);
  useEffect(() => {
    let live = true;
    load(() => live);
    return () => { live = false; };
  }, [load]);

  const name = ab.name.toUpperCase();
  const of = (f: DriverFigure, decimals = 0) => ({
    x: f.value === null ? '–' : formatNumber(f.value, { maxDecimals: decimals }, language),
    target: f.target === null ? s.noTarget : formatNumber(f.target, { maxDecimals: decimals }, language),
  });
  const pct = (v: number | null) => (v === null ? '–' : formatPercent(v, {}, language));
  const year = month.slice(0, 4);
  const monthText = formatMonth(month, language);
  const title = driver === 'maa' ? s.maaTitle({ month: monthText })
    : driver === 'usage' ? s.usageTitle
      : driver === 'coaching' ? s.coachingTitle({ month: monthText })
        : s.rekrutTitle({ year });
  const sub = !view ? undefined
    : driver === 'maa' ? s.maaSub({ ab: name, ...of(view.drivers.maa) })
      : driver === 'usage' ? s.usageSub({ ab: name, pct: pct(view.drivers.usage.downlinePct), leader: pct(view.drivers.usage.leaderPct) })
        : driver === 'coaching' ? s.coachingSub({ ab: name, ...of(view.drivers.oneOnOne, 1) })
          : s.rekrutSub({ ab: name, ...of(view.drivers.rekrut) });

  const ago = (days: number | null) => (days === null ? s.neverUsed : days === 0 ? s.today : days === 1 ? s.yesterday : s.daysAgo({ n: days }));
  const group = (heading: string, rows: { person: SheetPerson; meta?: ReactNode; pill?: { tone: PillTone; text: string } }[]) => (
    <section className="mb-3">
      <h3 className="mb-1 text-sm font-bold text-ink">{heading}</h3>
      {rows.length === 0 ? <p className="py-2 text-sm text-muted">{s.nobody}</p> : (
        <ul className="divide-y divide-divider">
          {rows.map((r) => (
            <li key={r.person.membershipId} className="flex items-center justify-between gap-3 py-2">
              <PersonName person={r.person} size={32} meta={r.meta} />
              {r.pill && <TonePill tone={r.pill.tone}>{r.pill.text}</TonePill>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  let body: ReactNode = null;
  let names: string[] = [];
  if (view?.maa) {
    names = [...view.maa.notYet, ...view.maa.active].map((r) => r.person.name.toUpperCase());
    body = (
      <>
        {group(s.active({ n: view.maa.active.length }), view.maa.active.map((r) => ({
          person: r.person,
          meta: r.policies === null ? undefined : s.policies({ n: r.policies }),
          pill: r.apeMinor === null ? undefined : { tone: 'green' as const, text: formatRupiahCompact(r.apeMinor, {}, language) },
        })))}
        {group(s.notYet({ n: view.maa.notYet.length }), view.maa.notYet.map((r) => ({
          person: r.person,
          meta: r.lastActiveMonth ? s.lastActive({ month: formatMonth(r.lastActiveMonth, language) }) : s.neverActive,
          pill: { tone: r.potensi > 0 ? 'amber' as const : 'red' as const, text: s.potensi({ n: r.potensi }) },
        })))}
      </>
    );
  } else if (view?.usage) {
    names = view.usage.notUsed.map((r) => r.person.name.toUpperCase());
    body = (
      <>
        {group(s.notUsed({ n: view.usage.notUsed.length }), view.usage.notUsed.map((r) => ({
          person: r.person,
          meta: s.lastOpened,
          pill: { tone: r.daysSince === null ? 'red' as const : 'amber' as const, text: ago(r.daysSince) },
        })))}
        {group(s.used({ n: view.usage.used.length }), view.usage.used.map((r) => ({
          person: r.person,
          meta: r.powerUser ? s.powerUser({ n: r.daysLogged }) : s.daysUsed({ n: r.daysLogged }),
          pill: { tone: 'green' as const, text: ago(r.daysSince) },
        })))}
      </>
    );
  } else if (view?.coaching) {
    const late = view.coaching.filter((r) => r.status !== 'recent');
    const recent = view.coaching.filter((r) => r.status === 'recent');
    names = late.map((r) => r.person.name.toUpperCase());
    body = (
      <>
        {group(s.notCoached({ n: late.length }), late.map((r) => ({
          person: r.person,
          pill: r.status === 'never'
            ? { tone: 'red' as const, text: s.neverCoached }
            : { tone: 'amber' as const, text: s.daysAgo({ n: r.daysSince ?? 0 }) },
        })))}
        {group(s.coached({ n: recent.length }), recent.map((r) => ({
          person: r.person, pill: { tone: 'green' as const, text: s.daysAgo({ n: r.daysSince ?? 0 }) },
        })))}
      </>
    );
  } else if (view?.rekrut) {
    names = view.rekrut.joined.map((r) => r.person.name.toUpperCase());
    body = (
      <>
        {group(s.joined({ n: view.rekrut.joined.length }), view.rekrut.joined.map((r) => ({
          person: r.person,
          meta: r.recruiter ? s.recruitedBy({ name: r.recruiter.name.toUpperCase() }) : undefined,
          pill: { tone: 'green' as const, text: formatMonth(r.joinDate.slice(0, 7), language) },
        })))}
        <section className="mb-3">
          <h3 className="text-sm font-bold text-ink">{s.potential({ n: view.rekrut.potential })}</h3>
        </section>
      </>
    );
  }

  const message = [title, sub ?? '', ...names.map((n) => `- ${n}`)].filter(Boolean).join('\n');
  const href = view ? whatsAppHref(view.ab.phone, message) : null;
  const first = firstName(ab.name);
  const footer = view && (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-2 md:flex-row">
        {canWrite && (driver === 'maa' || driver === 'rekrut') && (
          <Button variant="secondary" className="min-h-12 flex-1 rounded-pill" onClick={() => setTarget(true)}>{s.changeTarget}</Button>
        )}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-pill bg-whatsapp px-4 font-bold text-white"
          >
            <NavIcon name="whatsapp" className="h-5 w-5" />
            {s.whatsApp({ name: first })}
          </a>
        ) : (
          <p className="flex-[2] self-center text-center text-sm text-muted">{s.noPhone({ name: first })}</p>
        )}
      </div>
      {href && <p className="text-center text-sm text-muted">{s.whatsAppNote}</p>}
    </div>
  );

  return (
    <>
      <ResponsiveSheet open title={title} description={sub} onClose={onClose} footer={footer ?? undefined}>
        <div data-sheet={driver}>
          {error ? <SectionError error={error} /> : !view ? (
            <Skeleton label={t.loading}><div className="space-y-2"><SkeletonBar className="h-10" /><SkeletonBar className="h-10" /></div></Skeleton>
          ) : body}
        </div>
      </ResponsiveSheet>
      {target && (
        <TargetDialog
          ab={{ membershipId: ab.membershipId, name: ab.name, role: t.role.ab }}
          month={month}
          onClose={() => setTarget(false)}
          onSaved={() => { setTarget(false); load(); onTargetSaved(); }}
        />
      )}
    </>
  );
}
