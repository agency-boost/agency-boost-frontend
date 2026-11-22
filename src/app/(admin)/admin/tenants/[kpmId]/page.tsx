'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { KpmReportSlot } from '@/components/admin/kpm-report-slot';
import { InsideKpmBar, KpmSwitcher } from '@/components/admin/kpm-switcher';
import { MemberName } from '@/components/admin/member-name';
import { OwnerWhatsAppInviteButton } from '@/components/admin/owner-whatsapp-invite';
import { ViewAsCards } from '@/components/admin/view-as-cards';
import { Page } from '@/components/page';
import { Button, ErrorBanner } from '@/components/ui/field';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages, type AdminConsoleWords } from '@/i18n/messages/admin-console';
import { readKpmPeople, type ConsoleKpmPeople, type ConsolePerson } from '@/lib/admin-console';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, formatRupiahCompact } from '@/lib/format';
import { readOverviewPerformance, type OverviewPerformanceView } from '@/lib/kpm-overview';
import { useCan } from '@/lib/session';
import { enterKpm } from '@/lib/super-admin-kpm';
import { savedTemplateSentence } from '@/lib/templates';

/** *Simpan sebagai template*'s dialog, loaded the first time it opens. */
const SaveAsTemplateDialog = dynamic(
  () => import('@/components/save-as-template-dialog').then((m) => m.SaveAsTemplateDialog), { ssr: false },
);

type Words = AdminConsoleWords['inside'];

/** The eight owner pages (spec §5), in the mockup's order, each the Owner's own address. */
const OWNER_PAGES: readonly { key: keyof Words['pages']; href: string; icon: NavIconName }[] = [
  { key: 'overview', href: '/kpm/overview', icon: 'ti-layout-dashboard' },
  { key: 'advancedAnalytics', href: '/kpm/advanced-analytics', icon: 'ti-chart-dots' },
  { key: 'forum', href: '/leader-meetings', icon: 'ti-presentation' },
  { key: 'dataUpload', href: '/kpm/data-upload', icon: 'ti-upload' },
  { key: 'allMembers', href: '/people/members', icon: 'ti-users' },
  { key: 'orgTree', href: '/people/org-tree', icon: 'ti-hierarchy-2' },
  { key: 'kpmAdmins', href: '/people/admins', icon: 'ti-user-shield' },
  { key: 'settings', href: '/kpm/settings', icon: 'ti-settings' },
];

/**
 * **Inside a KPM** (`/admin/tenants/[kpmId]`; P19.23-T2 AC-4 to AC-7; ADR-0277 §3; the Super Admin spec §5;
 * `superadmin-tablet` f11–f13, f23).
 *
 * Opening it **enters the KPM** (`enterKpm`, ADR-0268 §3): from here every request names it, so the Super Admin is its
 * Owner on every owner page it links to — the same pages, menu and rights the Owner has — and each change they make is
 * audited with them as the actor.
 *
 * - **The header**: the KPM's name, the switcher chip and the thin bar *"Anda di dalam KPM ini sebagai Super Admin ·
 *   semua akses owner · tercatat di audit log"*.
 * - **The numbers** (navy tiles, orange numbers): *Anggota*, and the month's *Active Agent*, *Rekrut* and *APE* against
 *   their targets — the KPM Overview's own *Performa vs target* (`GET /kpm/overview/performance`), read as the Owner.
 * - ***Owner & admin*** (*KPM Owner*, *Admin*, *Core leader* with *Ganti* / *Atur*; *+ Tambah admin*) and ***Anggota***
 *   (the first five, *Import people*, *Lihat semua*) — the KPM's people (`GET /admin/tenants/:id/people`).
 * - **The eight owner pages**, and ***Lihat sebagai***.
 */
export default function KpmPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const t = useMessages(adminConsoleMessages).inside;
  const [people, setPeople] = useState<ConsoleKpmPeople | null>(null);
  const [performance, setPerformance] = useState<OverviewPerformanceView | null | 'unread'>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      // Inside the KPM first, so the Owner's own read below names it (`X-Kpm-Id`).
      enterKpm(kpmId);
    } catch (err) {
      setError(toDisplayError(err));
      return;
    }
    try {
      setPeople(await readKpmPeople(kpmId));
    } catch (err) {
      setError(toDisplayError(err));
      return;
    }
    // The tiles are the Overview's; a KPM that cannot answer them (no file, suspended) shows *–*, never the page's error.
    readOverviewPerformance().then(setPerformance).catch(() => setPerformance('unread'));
  }, [kpmId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Page title={t.loading}>
        <ErrorBanner {...error} />
      </Page>
    );
  }
  if (!people) {
    return (
      <Page title="">
        <SkeletonCards count={4} label={t.loading} />
      </Page>
    );
  }

  const kpm = people.kpm;
  const current = { kpmId, name: kpm.name, companyName: kpm.companyName };
  return (
    <Page
      title={kpm.name}
      actions={(
        <div className="flex items-center gap-2">
          <KpmReportSlot kpm={{ kpmId, name: kpm.name, code: kpm.code, companyName: kpm.companyName }} placement="header" />
          <KpmSwitcher current={current} className="w-80" />
        </div>
      )}
    >
      <div className="flex flex-col gap-5" data-kpm-page={kpmId}>
        <div className="flex flex-col gap-2">
          <KpmSwitcher current={current} className="lg:hidden" />
          <InsideKpmBar />
        </div>
        <Tiles people={people} performance={performance} t={t} />
        <div className="grid gap-4 lg:grid-cols-2">
          <OwnersCard people={people} t={t} onChanged={load} />
          <MembersCard people={people} t={t} />
        </div>
        <section aria-labelledby="owner-pages-heading">
          <h2 id="owner-pages-heading" className="mb-2 text-md font-bold text-navy">{t.ownerPages}</h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-owner-pages="">
            {OWNER_PAGES.map((page) => (
              <li key={page.key}>
                <Link href={page.href} className="flex min-h-16 items-center gap-3 rounded-xl bg-card px-3.5 py-3 hover:bg-hover-row">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pill-grey text-secondary-ink">
                    <NavIcon name={page.icon} className="h-5 w-5" />
                  </span>
                  <b className="min-w-0 text-md leading-snug text-navy">{t.pages[page.key]}</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <ViewAsCards people={people.viewAs} kpmName={kpm.name} />
        <ul className="flex flex-col gap-1 text-sm text-muted md:flex-row md:gap-x-5">
          <li>{t.notes.tap}</li>
          <li>{t.notes.change}</li>
        </ul>
        <SaveAsTemplate kpm={{ _id: kpmId, code: kpm.code, companyId: kpm.companyId, companyName: kpm.companyName }} t={t} />
      </div>
    </Page>
  );
}

/** The navy tiles: *Anggota*, *Active Agent*, *Rekrut*, *APE bulan ini* — the last three the Overview's month. */
function Tiles({ people, performance, t }: { people: ConsoleKpmPeople; performance: OverviewPerformanceView | null | 'unread'; t: Words }) {
  const fig = useFigureLanguage();
  const n = (v: number) => formatNumber(v, {}, fig);
  const view = performance && performance !== 'unread' ? performance : null;
  const actual = view?.total.actual ?? null;
  const month = view ? `${formatMonthLong(view.month, fig)} ${view.month.slice(0, 4)}` : '';
  const dash = '–';
  const targetLine = (target: number | null | undefined) => (target ? t.tiles.ofTarget({ t: n(target) }) : t.tiles.noTarget);
  const tiles: [string, string, string][] = [
    [t.tiles.members, n(people.members.total), `${n(people.members.leaders)} leader · ${n(people.members.agents)} agent`],
    [
      t.tiles.activeAgent,
      actual?.activeAgents == null ? dash : n(actual.activeAgents),
      view && !view.held ? t.tiles.notUploaded : targetLine(view?.total.activeAgentTarget),
    ],
    [t.tiles.rekrut, actual ? n(actual.rekrut) : dash, targetLine(view?.total.rekrutTarget)],
    [
      t.tiles.ape,
      actual?.apeMinor == null ? dash : formatRupiahCompact(actual.apeMinor, {}, fig),
      view && !view.held ? t.tiles.notUploaded : actual?.apePct == null ? t.tiles.noTarget : t.tiles.pctOfTarget({ p: n(actual.apePct) }),
    ],
  ];
  return (
    <section aria-label={people.kpm.name} className="rounded-[20px] bg-secondary p-4 text-secondary-contrast" data-kpm-tiles="">
      <p className="text-sm font-bold">{[people.kpm.name, people.kpm.companyName, month].filter(Boolean).join(' · ')}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="min-w-0 rounded-xl bg-secondary-contrast/[0.08] px-3 py-2">
            <dt className="text-sm font-semibold">{label}</dt>
            <dd>
              <b className="block text-[1.625rem] font-extrabold leading-tight text-primary">{performance === null && label !== t.tiles.members ? '…' : value}</b>
              <span className="block truncate text-xs text-secondary-contrast/75">{sub}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const asRole = (p: ConsolePerson) => ({ code: p.class.toUpperCase(), label: p.class.toUpperCase(), class: p.class });

/** ***Owner & admin*** (AC-4, AC-6): the Owner, the Admins and the core leaders, with *Ganti* / *Atur* and *+ Tambah admin*. */
function OwnersCard({ people, t, onChanged }: { people: ConsoleKpmPeople; t: Words; onChanged: () => void }) {
  const kpmId = people.kpm.kpmId;
  const owner = people.owner;
  const uninvited = owner.state === 'none' || owner.state === 'not_invited';
  const names = (list: ConsolePerson[]) => (list.length === 0
    ? <span className="text-sm text-muted">{t.noneYet}</span>
    : list.map((p) => <MemberName key={p.membershipId} name={p.fullName} role={asRole(p)} className="flex" />));
  const row = (role: string, who: React.ReactNode, action: { href: string; label: string }) => (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-start gap-2 border-b border-divider py-2.5 last:border-b-0">
      <span className="text-sm text-muted">{role}</span>
      <span className="flex min-w-0 flex-col gap-1 text-sm">{who}</span>
      <Link href={action.href} className="inline-flex min-h-10 items-center text-sm font-bold text-primary-ink">{action.label}</Link>
    </div>
  );
  return (
    <section aria-labelledby="owners-heading" className="rounded-xl bg-card p-4" data-owners-card="">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 id="owners-heading" className="text-md font-bold text-navy">{t.owners}</h2>
        <Link href="/people/admins" className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-hairline px-3.5 text-sm font-semibold text-navy">
          <NavIcon name="ti-plus" className="h-4 w-4" />
          {t.addAdmin}
        </Link>
      </div>
      {row(
        t.ownerRole,
        owner.person ? (
          <>
            <MemberName name={owner.person.fullName} role={asRole(owner.person)} className="flex" />
            {uninvited && <OwnerWhatsAppInviteButton kpmId={kpmId} ownerName={owner.person.fullName} variant="outline" onSent={onChanged} />}
          </>
        ) : owner.pendingName ? (
          <>
            <span className="font-bold uppercase text-ink">{t.pendingOwner({ name: owner.pendingName })}</span>
            {uninvited && <OwnerWhatsAppInviteButton kpmId={kpmId} ownerName={owner.pendingName} variant="outline" onSent={onChanged} />}
          </>
        ) : <span className="text-sm text-muted">{t.noneYet}</span>,
        { href: `/admin/tenants/${kpmId}/owner`, label: t.change },
      )}
      {row(t.adminRole, names(people.admins), { href: '/people/admins', label: t.change })}
      {row(t.coreRole, names(people.coreLeaders), { href: '/people/admins', label: t.manage })}
    </section>
  );
}

/** ***Anggota · n*** (AC-4): the first five, their group and when they last used the app; *Import people*, *Lihat semua*. */
function MembersCard({ people, t }: { people: ConsoleKpmPeople; t: Words }) {
  const fig = useFigureLanguage();
  const used = (p: ConsoleKpmPeople['members']['first'][number]) => {
    const text = p.lastUsedDays === null ? t.never : p.lastUsedDays === 0 ? t.today : t.daysAgo({ n: formatNumber(p.lastUsedDays, {}, fig) });
    return (
      <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold', p.lastUsedStatus === 'recent' ? 'bg-pill-green text-pill-green-ink' : 'bg-pill-red text-pill-red-ink')}>
        {text}
      </span>
    );
  };
  return (
    <section aria-labelledby="members-heading" className="rounded-xl bg-card p-4" data-members-card="">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="members-heading" className="text-md font-bold text-navy">{t.membersCard({ n: formatNumber(people.members.total, {}, fig) })}</h2>
        <span className="flex items-center gap-3">
          <Link href="/people/import" className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-hairline px-3.5 text-sm font-semibold text-navy">
            <NavIcon name="ti-file-import" className="h-4 w-4" />
            {t.importPeople}
          </Link>
          <Link href="/people/members" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-primary-ink">
            {t.seeAll}
            <NavIcon name="ti-arrow-right" className="h-4 w-4" />
          </Link>
        </span>
      </div>
      {people.members.first.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t.noMembers}</p>
      ) : (
        <ul>
          {people.members.first.map((p) => (
            <li key={p.membershipId} className="flex items-center gap-2 border-b border-divider py-2 text-sm last:border-b-0">
              <MemberName name={p.fullName} role={asRole(p)} className="min-w-0 flex-1" />
              <span className="hidden min-w-0 truncate text-xs text-muted sm:block">{p.groupName ?? t.noGroup}</span>
              {used(p)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * ***Simpan sebagai template*** (P13.2-T7, ADR-0115 §5 — kept from the KPM page it was on; parity I-1183): this KPM's
 * published settings as one of its company's templates. The Super Admin's alone (`company_template:write`).
 */
function SaveAsTemplate({ kpm, t }: { kpm: { _id: string; code: string; companyId: string; companyName: string }; t: Words }) {
  const can = useCan('company_template:write');
  const language = useLanguage();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  if (!can) return null;
  return (
    <div className="flex justify-end">
      <Button variant="inline" onClick={() => setOpen(true)}>{t.saveAsTemplate}</Button>
      {open && (
        <SaveAsTemplateDialog
          open
          kpm={kpm}
          onClose={() => setOpen(false)}
          onSaved={(template, company) => {
            setOpen(false);
            show(savedTemplateSentence(template, company?.name ?? kpm.companyName, language));
          }}
        />
      )}
    </div>
  );
}
