'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { KpmReportSlot } from '@/components/admin/kpm-report-slot';
import { KpmMembersCard } from '@/components/admin/kpm-members-card';
import { KpmOwnerAdminSection } from '@/components/admin/kpm-owner-admin-section';
import { KpmPhoneHeader } from '@/components/admin/kpm-phone-header';
import { InsideKpmBar, KpmSwitcher } from '@/components/admin/kpm-switcher';
import { ViewAsCards } from '@/components/admin/view-as-cards';
import { Page } from '@/components/page';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages, type AdminConsoleWords } from '@/i18n/messages/admin-console';
import { readKpmPeople, type ConsoleKpmPeople } from '@/lib/admin-console';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, formatRupiahCompact } from '@/lib/format';
import { readOverviewPerformance, type OverviewPerformanceView } from '@/lib/kpm-overview';
import { useCan } from '@/lib/session';
import { enterKpm } from '@/lib/super-admin-kpm';
import { savedTemplateSentence } from '@/lib/templates';
import { usePhone } from '@/lib/use-phone';

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
 * - ***Owner & admin*** (`KpmOwnerAdminSection`: *KPM Owner · n* with *＋ Tambah owner*, *Admin*, *Core leader*; P19.27,
 *   ADR-0285) and ***Anggota***
 *   (the first five, *Import people*, *Lihat semua*) — the KPM's people (`GET /admin/tenants/:id/people`).
 * - **The eight owner pages**, and ***Lihat sebagai***.
 *
 * *Changed 2026-11-22 (P19.29-T1, T4; UI-200, UI-211, UI-213 (21 Nov); ADR-0287):* **below 768px only** — the title is the
 * switcher, with one 44px row of the pill, *PDF* and ⋯ (`KpmPhoneHeader`), *Simpan sebagai template* in ⋯; the navy card
 * names the month alone; the owner pages are 44px rows; *Lihat sebagai* is one card; the two notes are not drawn. From
 * 768px the page is as it was.
 */
export default function KpmPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const t = useMessages(adminConsoleMessages).inside;
  const [people, setPeople] = useState<ConsoleKpmPeople | null>(null);
  const [performance, setPerformance] = useState<OverviewPerformanceView | null | 'unread'>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const phone = usePhone();
  const canTemplate = useCan('company_template:write');
  const [savingTemplate, setSavingTemplate] = useState(false);

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
  const report = { kpmId, name: kpm.name, code: kpm.code, companyName: kpm.companyName, owners: people.owners.owners.length };
  return (
    <Page
      // P19.29-T1 (UI-200 (21 Nov)): on a phone the title row is `KpmPhoneHeader`'s, whose title is the switcher.
      title={phone ? undefined : kpm.name}
      actions={phone ? undefined : (
        <div className="flex items-center gap-2">
          <KpmReportSlot kpm={report} placement="header" />
          <KpmSwitcher current={current} className="w-80" />
        </div>
      )}
    >
      {phone && (
        <KpmPhoneHeader
          kpm={report}
          menu={canTemplate ? [{ label: t.saveAsTemplate, onSelect: () => setSavingTemplate(true) }] : []}
        />
      )}
      <div className="flex flex-col gap-5" data-kpm-page={kpmId}>
        {!phone && (
          <div className="flex flex-col gap-2">
            <KpmSwitcher current={current} className="lg:hidden" />
            <InsideKpmBar />
          </div>
        )}
        <Tiles people={people} performance={performance} t={t} phone={phone} />
        {/*
          * `grid-cols-1`, one `minmax(0, 1fr)` column, where the implicit column was `auto`: an auto track grows to its
          * widest card's min-content, and an owner's unbroken *"Owner sejak … · Belum diundang"* made every card 379px
          * at 360 — the page scrolled sideways (the integration round's walk, 2026-11-22). The cards' contents truncate
          * within the column now. Two columns from 1024px as before.
          */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-kpm-people-grid="">
          <KpmOwnerAdminSection people={people} onChanged={load} />
          <KpmMembersCard people={people} onChanged={load} />
        </div>
        {phone ? (
          /*
           * P19.29-T4 AC-2 (UI-211 (21 Nov); the stop motion's *Halaman owner*, section D frames 4 and 12): one card of
           * 44px rows — the icon in its 32px square, the page's name, › — where two columns of tiles wrapped to three lines.
           */
          <section aria-labelledby="owner-pages-heading" className="rounded-xl bg-card px-3.5 pb-1 pt-2.5">
            <h2 id="owner-pages-heading" className="mb-1 text-row font-bold text-navy">{t.ownerPagesShort}</h2>
            <ul data-owner-pages="" data-owner-page-rows="">
              {OWNER_PAGES.map((page) => (
                <li key={page.key} className="border-b border-divider last:border-b-0">
                  <Link href={page.href} className="flex min-h-11 items-center gap-2.5 py-1">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-pill-grey text-navy">
                      <NavIcon name={page.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-row font-semibold text-navy">{t.pages[page.key]}</span>
                    <LineIcon name="chevronRight" className="h-[18px] w-[18px] text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
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
        )}
        <ViewAsCards people={people.viewAs} kpmName={kpm.name} />
        {/* P19.29-T4 AC-3 (UI-213 (21 Nov)): neither note is drawn on a phone; from 768px both read as before. */}
        <ul className={cn('flex flex-col gap-1 text-sm text-muted md:flex-row md:gap-x-5', REMOVED_ON_PHONE)} data-kpm-notes="">
          <li>{t.notes.tap}</li>
          <li>{t.notes.change}</li>
        </ul>
        <SaveAsTemplate
          kpm={{ _id: kpmId, code: kpm.code, companyId: kpm.companyId, companyName: kpm.companyName }}
          t={t}
          open={savingTemplate}
          onOpen={() => setSavingTemplate(true)}
          onClose={() => setSavingTemplate(false)}
          button={!phone}
        />
      </div>
    </Page>
  );
}

/** The navy tiles: *Anggota*, *Active Agent*, *Rekrut*, *APE bulan ini* — the last three the Overview's month. */
function Tiles({ people, performance, t, phone = false }: {
  people: ConsoleKpmPeople; performance: OverviewPerformanceView | null | 'unread'; t: Words;
  /** P19.29-T1 AC-3 (UI-200 (21 Nov)): on a phone the card's header is the month alone — the KPM is named in the title. */
  phone?: boolean;
}) {
  const fig = useFigureLanguage();
  const n = (v: number) => formatNumber(v, {}, fig);
  const view = performance && performance !== 'unread' ? performance : null;
  const actual = view?.total.actual ?? null;
  const month = view ? `${formatMonthLong(view.month, fig)} ${view.month.slice(0, 4)}` : '';
  const dash = '–';
  const targetLine = (target: number | null | undefined) => (target ? t.tiles.ofTarget({ t: n(target) }) : t.tiles.noTarget);
  const tiles: [string, React.ReactNode, string][] = [
    [t.tiles.members, n(people.members.total), `${n(people.members.leaders)} leader · ${n(people.members.agents)} agent`],
    [
      t.tiles.activeAgent,
      actual?.activeAgents == null ? dash : n(actual.activeAgents),
      view && !view.held ? t.tiles.notUploaded : targetLine(view?.total.activeAgentTarget),
    ],
    [t.tiles.rekrut, actual ? n(actual.rekrut) : dash, targetLine(view?.total.rekrutTarget)],
    [
      t.tiles.ape,
      actual?.apeMinor == null ? dash : <MoneyFigure text={formatRupiahCompact(actual.apeMinor, {}, fig)} />,
      view && !view.held ? t.tiles.notUploaded : actual?.apePct == null ? t.tiles.noTarget : t.tiles.pctOfTarget({ p: n(actual.apePct) }),
    ],
  ];
  return (
    <section aria-label={people.kpm.name} className="rounded-[20px] bg-secondary p-4 text-secondary-contrast" data-kpm-tiles="">
      <p className="text-sm font-bold">{phone ? month : [people.kpm.name, people.kpm.companyName, month].filter(Boolean).join(' · ')}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="min-w-0 rounded-xl bg-secondary-contrast/[0.08] px-3 py-2">
            <dt className="text-sm font-semibold">{label}</dt>
            <dd>
              {/* P19.29-T1 (the phone type scale's *Big numbers 24/800*; stop motion D frame 2's light orange): below 768px. */}
              <b className="block text-[1.625rem] font-extrabold leading-tight text-primary max-md:whitespace-nowrap max-md:text-figure max-md:text-on-navy-orange">{performance === null && label !== t.tiles.members ? '…' : value}</b>
              <span className="block truncate text-xs text-secondary-contrast/75">{sub}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * **A compact rupiah figure on one line on a phone** (the integration round's walk, 2026-11-22: BSD's *Rp 647,3 Jt* on two
 * lines at 375). The digits keep the phone scale's *Big numbers 24/800*; below 768px the currency mark and the unit are
 * 15px (`text-row`), so *Rp 888,8 Jt* — the widest a compact sum is — takes about 108px of a 360px tile's 120. From
 * 768px every part is the figure's own size, as before. A figure the pattern does not read is drawn whole.
 */
function MoneyFigure({ text }: { text: string }) {
  const parts = /^(-?)(\D+?)\s([\d.,]+)(\s?)(\D*)$/.exec(text);
  if (!parts) return <>{text}</>;
  const [, sign, mark, figure, gap, unit] = parts;
  return (
    <>
      <span className="max-md:text-row">{`${sign}${mark} `}</span>
      {figure}
      {unit && <span className="max-md:text-row">{`${gap}${unit}`}</span>}
    </>
  );
}

/**
 * ***Simpan sebagai template*** (P13.2-T7, ADR-0115 §5 — kept from the KPM page it was on; parity I-1183): this KPM's
 * published settings as one of its company's templates. The Super Admin's alone (`company_template:write`).
 *
 * *Changed 2026-11-22 (P19.29-T1 AC-2; UI-200, UI-211 (21 Nov)):* the dialog is opened by the page — from this button at
 * the foot from 768px (`button`), from the phone header's ⋯ below it.
 */
function SaveAsTemplate({ kpm, t, open, onOpen, onClose, button }: {
  kpm: { _id: string; code: string; companyId: string; companyName: string }; t: Words;
  open: boolean; onOpen: () => void; onClose: () => void;
  /** The inline button at the page's foot: from 768px; on a phone the header's ⋯ holds it. */
  button: boolean;
}) {
  const can = useCan('company_template:write');
  const language = useLanguage();
  const { show } = useToast();
  if (!can) return null;
  return (
    <>
      {button && (
        <div className="flex justify-end">
          <Button variant="inline" onClick={onOpen}>{t.saveAsTemplate}</Button>
        </div>
      )}
      {open && (
        <SaveAsTemplateDialog
          open
          kpm={kpm}
          onClose={onClose}
          onSaved={(template, company) => {
            onClose();
            show(savedTemplateSentence(template, company?.name ?? kpm.companyName, language));
          }}
        />
      )}
    </>
  );
}
