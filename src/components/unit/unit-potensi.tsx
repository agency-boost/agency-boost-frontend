'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { stageTone } from '@/components/lead-card';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar, initialsFor } from '@/components/ui/avatar';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { rungShort } from '@/components/ui/role-badge';
import { RungTag, useIsLeaderRung } from '@/components/ui/rung-tag';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { MessagesOf } from '@/i18n/catalogue';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { unitPotensiMessages } from '@/i18n/messages/unit-potensi';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, formatShortDay } from '@/lib/format';
import type { AddAgentResult } from '@/lib/invites';
import { saveMemberPhone, whatsAppHref } from '@/lib/phone-number';
import { useCan, useSession } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useOpenedOnce } from '@/lib/use-opened-once';
import {
  cardCounts, marksOf, pastCounts, potensiMonths, readPotensiPerson, readUnitPotensi,
  type PotensiKandidat, type PotensiPerson, type PotensiUnit, type PotensiView, type UnitPotensiPersonView,
  type UnitPotensiView, type UnitView,
} from '@/lib/unit-dashboard';

/** *+ Add agent*'s form, downloaded when *Tambahkan ke unit ›* is first pressed. */
const AddAgentDialog = dynamic(() => import('@/components/add-agent-form').then((m) => m.AddAgentDialog), { ssr: false });
/** *Isi nomor WhatsApp*, downloaded when *Chat Agent {name}* is pressed for somebody with no number (UI-081). */
const PhoneNumberSheet = dynamic(() => import('@/components/phone-number-sheet').then((m) => m.PhoneNumberSheet), { ssr: false });

/** The dashboard's words, as `useMessages(unitDashboardMessages)` gives them: the groups' names are the Overview's. */
type DashboardWords = MessagesOf<(typeof unitDashboardMessages)['en']>;

/** *November 2026*: the month's name in full and its year, in the figures' language. */
const monthTitle = (month: string, figures: ReturnType<typeof useFigureLanguage>) =>
  `${formatMonthLong(month, figures)} ${month.slice(0, 4)}`;

/** A first name, for *Chat Agent Rina*. */
const firstName = (name: string) => name.split(' ')[0] ?? name;

/**
 * **The Unit Dashboard's *Potensi* tab** (P19.1-T6; UI-155, UI-159 item 4; ADR-0193 — and, since the owner's mobile review
 * of 7 November 2026, P19.8-T4: MOB UI-171, UI-179, UI-182, UI-186; ADR-0229 §1, §4, §8; `unit-mobile-stopmotion-2026-11-07`
 * `?tab=potensi`): who in the reader's unit may become active and which kandidat may join this month, from the switch every
 * agent sets on their own leads (UI-153). The leader types nothing.
 *
 * - **The month picker** (*November 2026 ⌄*), the row under the slider: this month on open — the shared `PickerMenu`, a
 *   menu under its button, never a native select (MOB UI-171, ADR-0227 §2).
 * - **Two tiles that are the switch** (a radio group): ***Active Agent*** (was *AA*), chosen on open, and ***Rekrut*** —
 *   each its number and, under it, ***potensi x***: the people with a lead of that type switched on for the month,
 *   whatever became of it (MOB UI-186). The chosen one navy. Not *dari 12*. A small legend under them.
 * - **One list design, every month** (MOB UI-182): **the whole team, under each group**, in the Overview's order and with
 *   its names — ***Unit Anda*** first, then ***Unit <AAB name>*** (MOB UI-179); each card's leader first with the navy role
 *   tag, then everybody in the roster's order, the same in both views. Each header keeps its words: *1 potensi · 0 AA*, and
 *   in an earlier month *potensi 2/2 · 4 AA*, *potensi 0/1 rekrut*.
 * - **A person's mark** (MOB UI-186): **an orange number**, their potensi; **a green ✓**, *Active Agent* this month on the
 *   first tile or a rekrut this month on the second; both together; or **a grey ✕** with neither. Every row that opens has
 *   ›, in any month.
 * - **A row opens a read-only sheet** for the month on screen: *Agent RINA · n potensi* with their switched-on clients (Q-2:
 *   names), or *Agent RINA · n potensi · n rekrut* with their kandidat — *New Hires ›* for one linked to a member,
 *   *Tambahkan ke unit ›* (the add-agent form, the name typed in) for one who is not yet — and *Chat Agent Rina*.
 *
 * Tablet and laptop lay the same cards out two to a row (no mockup draws them; the parity row says so).
 */
export function UnitPotensi({
  forId, onHead, readOnly = false, scope = null, reload = 0, onAnswered, viewPicker, informalLine,
}: {
  forId?: string;
  onHead?: (head: { name: string }) => void;
  /** The office's read-only view of another leader's unit (P19.3-T3 AC-3): *Tambahkan ke unit ›* is not drawn. */
  readOnly?: boolean;
  /**
   * **The view** (ADR-0249): the Overview's, chosen on the dashboard — `null` asks for the reader's default. The read
   * answers which it is, and the views offered, through `onAnswered`, so the dashboard draws one picker for both tabs.
   */
  scope?: UnitView | null;
  /** Bumped by the dashboard to read again — after *+ Tambah ke grup* (ADR-0249 §4). */
  reload?: number;
  onAnswered?: (answer: Pick<UnitPotensiView, 'scope' | 'scopes' | 'informal'>) => void;
  /** The view picker, drawn beside the month picker; nothing when only one view is offered. */
  viewPicker?: ReactNode;
  /** *Grup informal*'s line, under the pickers (ADR-0249 §4); the dashboard's, the same on both tabs. */
  informalLine?: ReactNode;
}) {
  const t = useMessages(unitPotensiMessages);
  const figures = useFigureLanguage();
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<PotensiView>('aa');
  const [held, setHeld] = useState<{ key: string; data: UnitPotensiView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [person, setPerson] = useState<PotensiPerson | null>(null);
  const key = `${forId ?? ''}|${month ?? ''}|${scope ?? ''}`;

  useEffect(() => {
    let live = true;
    setError(null);
    readUnitPotensi({ month: month ?? undefined, for: forId, scope })
      .then((data) => {
        if (!live) return;
        setHeld({ key, data });
        onHead?.(data.head);
        onAnswered?.({ scope: data.scope, scopes: data.scopes, informal: data.informal });
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [key, month, forId, scope, attempt, reload, onHead, onAnswered]);

  const data = held?.key === key ? held.data : held?.data ?? null;
  const past = !!data && data.month < data.currentMonth;

  return (
    <div data-potensi-tab="">
      {error && (
        <div className="mt-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!data && !error && <PotensiSkeleton />}
      {data && (
        <>
          {/* The month and — the client's item 7 — the view beside it, on one row (ADR-0249). */}
          <div className="flex flex-wrap items-center gap-2">
            <PickerMenu
              label={t.month}
              value={data.month}
              options={potensiMonths(data.currentMonth).map((m) => ({ value: m, label: monthTitle(m, figures) }))}
              onChange={(m) => { setMonth(m === data.currentMonth ? null : m); setPerson(null); }}
            />
            {viewPicker}
          </div>
          {informalLine}

          <Tiles data={data} view={view} onView={setView} />

          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.units.map((unit) => (
              <UnitCard key={`${unit.kind}:${unit.leader?.membershipId ?? ''}`} unit={unit} head={data.head} view={view} past={past} onOpen={setPerson} />
            ))}
          </div>

          {person && (
            <PersonSheet
              person={person}
              view={view}
              month={data.month}
              today={data.today}
              head={data.head}
              onClose={() => setPerson(null)}
              onLinked={() => setAttempt((n) => n + 1)}
              readOnly={readOnly}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * ***Active Agent*** and ***Rekrut*** (MOB UI-186): the switch, each tile its number and *potensi x* under it, the chosen
 * one navy — and the legend under them, for the marks of the view chosen.
 */
function Tiles({ data, view, onView }: { data: UnitPotensiView; view: PotensiView; onView: (v: PotensiView) => void }) {
  const t = useMessages(unitPotensiMessages);
  const figures = useFigureLanguage();
  const tilesId = useId();
  return (
    <>
      <div role="radiogroup" aria-label={t.tiles} id={tilesId} className="mt-3 grid grid-cols-2 gap-2 md:max-w-[480px]">
        {(['aa', 'rekrut'] as const).map((which) => {
          const chosen = view === which;
          return (
            <button
              key={which}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => onView(which)}
              data-potensi-tile={which}
              className={cn(
                'min-h-[72px] rounded-lg px-3 pb-3 pt-2.5 text-left',
                chosen ? 'bg-secondary text-secondary-contrast' : 'bg-card text-ink',
              )}
            >
              <span className={cn('block text-base', chosen ? 'text-secondary-muted' : 'text-muted')}>
                {which === 'aa' ? t.aa : t.rekrut}
              </span>
              <span className="mt-1 block text-[1.625rem] font-semibold leading-tight tabular-nums">
                {formatNumber(data.tiles[which], {}, figures)}
              </span>
              <span data-tile-potensi="" className={cn('mt-1 block text-sm', chosen ? 'text-secondary-muted' : 'text-muted')}>
                {t.tilePotensi({ n: data.tiles.potensi[which] })}
              </span>
            </button>
          );
        })}
      </div>
      <p aria-label={t.legend} data-potensi-legend="" className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-muted">
        {view === 'aa' && (
          <span className="inline-flex items-center gap-1.5">
            <DoneMark small />
            {t.legendDone}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <NumberMark n={1} small />
          {t.legendNumber({ rekrut: view === 'rekrut' })}
        </span>
      </p>
    </>
  );
}

/** The green ✓: *Active Agent* this month, or a rekrut. Drawn; its words are the row's. */
function DoneMark({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-pill-green text-pill-green-ink',
        small ? 'h-[22px] w-[22px]' : 'h-7 w-7',
      )}
    >
      <LineIcon name="check" className={small ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
    </span>
  );
}

/** The orange number: a person's potensi. Drawn; its words are the row's. */
function NumberMark({ n, small = false }: { n: number; small?: boolean }) {
  const figures = useFigureLanguage();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill bg-primary-50 font-bold tabular-nums text-primary-deep',
        small ? 'h-[22px] min-w-[22px] text-sm' : 'h-7 min-w-7 px-2 text-base',
      )}
    >
      {formatNumber(n, {}, figures)}
    </span>
  );
}

/**
 * A card's title (MOB UI-179): ***Unit Anda*** for the head's own — *Unit {name}* when the unit is not the reader's — and
 * ***Unit {AAB name}*** for each unit below, in sentence case, as the Overview names them.
 */
function cardTitle(unit: PotensiUnit, head: UnitPotensiView['head'], words: DashboardWords): string {
  // ADR-0249 §2: the office-wide view's people with no leader, one card with no leader, last.
  if (unit.kind === 'unled' || unit.leader === null) return words.views.unled;
  if (unit.kind === 'direct') return head.isReader ? words.prototype.yourUnitGroup : words.unitOf({ name: unit.leader.name });
  return words.unitOf({ name: unit.leader.name });
}

/** One group's card: its header, which keeps its words, and the whole team under it, in the roster's order. */
function UnitCard({
  unit, head, view, past, onOpen,
}: {
  unit: PotensiUnit; head: UnitPotensiView['head']; view: PotensiView; past: boolean; onOpen: (p: PotensiPerson) => void;
}) {
  const t = useMessages(unitPotensiMessages);
  const words = useMessages(unitDashboardMessages);
  const title = cardTitle(unit, head, words);
  const counts = cardCounts(unit, view);
  const was = pastCounts(unit, view);
  const line = past
    ? view === 'aa' ? t.aaPast({ x: was.x, y: was.y, n: was.done }) : t.rekrutPast({ x: was.x, y: was.y, n: was.done })
    : view === 'aa' ? t.aaCounts({ potensi: counts.potensi, aa: counts.done }) : t.rekrutCounts({ potensi: counts.potensi, rekrut: counts.done });
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg bg-card" data-potensi-unit={unit.kind}>
      <header className="flex items-center justify-between gap-2 bg-hover-row px-3.5 py-2.5">
        <h2 className="min-w-0 text-md font-bold text-ink">{title}</h2>
        <span className="shrink-0 text-sm font-semibold text-muted">{line}</span>
      </header>
      <ul>
        {unit.people.map((p) => <PersonRow key={p.membershipId} person={p} view={view} onOpen={onOpen} />)}
      </ul>
    </section>
  );
}

/** One person's row: avatar, the role tag for a leader, the name in full (two lines at most, never cut), the marks, ›. */
function PersonRow({ person, view, onOpen }: { person: PotensiPerson; view: PotensiView; onOpen: (p: PotensiPerson) => void }) {
  const t = useMessages(unitPotensiMessages);
  const isLeader = useIsLeaderRung();
  const { potensi, done, none } = marksOf(person, view);
  const said = [
    potensi > 0 ? t.potensi({ n: potensi }) : null,
    done ? t.done({ rekrut: view === 'rekrut' }) : null,
    none ? t.neither : null,
  ].filter(Boolean).join(', ');
  const face = (
    <>
      <Avatar name={person.name} photoUrl={person.photoUrl} seed={person.membershipId} size={36} />
      <span data-potensi-name="" className="min-w-0 flex-1 text-base font-bold uppercase leading-snug text-ink [overflow-wrap:anywhere]">
        {/*
          * The shared level tag (P19.9-T4 AC-1), on the card's leader — and, one rule with the Overview's roster, only
          * where their rung is a leader's (P19.11-T6 AC-4; UXQ10): a card led by somebody on an Agent's rung draws none.
          */}
        {person.isLeader && isLeader(person.rung) && <RungTag rung={person.rung} className="mr-1.5" />}
        {person.name}
      </span>
      <span data-potensi-marks="" className="flex shrink-0 items-center gap-1.5">
        {potensi > 0 && <NumberMark n={potensi} />}
        {done && <DoneMark />}
        {none && (
          <span aria-hidden="true" className="inline-flex w-7 justify-center text-signal-grey">
            <LineIcon name="close" className="h-5 w-5" />
          </span>
        )}
        <span className="sr-only">{said}</span>
      </span>
    </>
  );
  const ROW = 'flex min-h-14 w-full items-center gap-2.5 border-t border-divider px-3.5 py-1.5 text-left';
  return (
    <li className="first:[&>*]:border-t-0" data-potensi-row={none ? 'none' : done ? 'done' : 'potensi'}>
      {person.opens ? (
        <button type="button" aria-label={`${t.open({ name: person.name })}: ${said}`} onClick={() => onOpen(person)} className={cn(ROW, 'hover:bg-hover-row')}>
          {face}
          <LineIcon name="chevronRight" className="h-[18px] w-[18px] shrink-0 text-signal-grey" />
        </button>
      ) : (
        <div className={ROW}>{face}</div>
      )}
    </li>
  );
}

/**
 * **A person's read-only sheet** (AC-6, AC-7): the AA view's switched-on clients, or the Rekrut view's kandidat, and
 * *Chat {role} {name}*. Read on opening (`GET /unit/dashboard/potensi/:membershipId`), which the server records as a read
 * of their leads.
 */
function PersonSheet({
  person, view, month, today, head, onClose, onLinked, readOnly,
}: {
  person: PotensiPerson; view: PotensiView; month: string; today: string;
  head: UnitPotensiView['head']; onClose: () => void; onLinked: () => void;
  /** The office's read-only view (P19.3-T3 AC-3): no *Tambahkan ke unit ›*, and no number saved for a chat. */
  readOnly: boolean;
}) {
  const t = useMessages(unitPotensiMessages);
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const { me } = useSession();
  const mayInvite = useCan('member:invite') && !me?.impersonationReadOnly && !readOnly;
  const [sheet, setSheet] = useState<UnitPotensiPersonView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [adding, setAdding] = useState<PotensiKandidat | null>(null);
  const addOpened = useOpenedOnce(adding !== null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    readPotensiPerson(person.membershipId, { month })
      .then((answer) => { if (live) setSheet(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [person.membershipId, month, reload]);

  const role = rungShort(person.rung);
  const n = view === 'aa' ? person.aa.potensi : person.rekrut.potensi;
  const title = view === 'aa'
    ? t.aaSheet({ role, name: person.name, n })
    : t.rekrutSheet({ role, name: person.name, n, r: person.rekrut.rekrut });
  const stageOf = (type: 'sales' | 'recruitment', code: string | null) => {
    const ladder = config?.leadPipelines.find((p) => p.pipeline === type)?.statuses ?? [];
    const label = ladder.find((s) => s.code === code)?.label ?? null;
    return label ? <TonePill tone={stageTone(ladder, code)} className="max-w-[45%] truncate">{label}</TonePill> : null;
  };
  const day = (d: string) => formatShortDay(d, { year: d.slice(0, 4) !== today.slice(0, 4) }, figures);
  const added = (result: AddAgentResult) => {
    if (result.outcome === 'linked') {
      setAdding(null);
      setReload((r) => r + 1);
      onLinked();
    }
  };

  return (
    <>
      <ResponsiveSheet
        open
        title={title}
        description={sheet?.unit ? t.unit({ role: rungShort(sheet.unit.rung), name: sheet.unit.name }) : undefined}
        onClose={onClose}
        // Read-only, a chat opens only with a number on file: saving one is a write (P19.3-T3 AC-3).
        footer={sheet && (!readOnly || sheet.person.phone)
          ? <ChatButton person={sheet.person} label={t.chat({ role, name: firstName(person.name) })} /> : undefined}
      >
        {error && <ErrorBanner {...error} />}
        {!sheet && !error && <Skeleton label={t.loadingSheet}><SkeletonBar className="h-12 w-full" /></Skeleton>}
        {sheet && view === 'aa' && (
          sheet.sales.length === 0 ? <p className="py-2 text-md text-muted">{t.noSales}</p> : (
            <ul data-potensi-sheet="aa">
              {sheet.sales.map((lead) => (
                <li key={lead.id} className="flex min-h-14 items-center gap-2.5 border-t border-divider py-1.5 first:border-t-0">
                  <Avatar name={lead.name} seed={lead.id} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold uppercase leading-snug text-ink">{lead.name}</span>
                    {(lead.nextActionDate || lead.nextActionNote) && (
                      <span className="block truncate text-xs text-muted">
                        {[lead.nextActionDate ? day(lead.nextActionDate) : null, lead.nextActionNote].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {stageOf('sales', lead.statusCode)}
                </li>
              ))}
            </ul>
          )
        )}
        {sheet && view === 'rekrut' && (
          sheet.kandidat.length === 0 ? <p className="py-2 text-md text-muted">{t.noKandidat}</p> : (
            <ul data-potensi-sheet="rekrut">
              {sheet.kandidat.map((k) => (
                <li key={k.leadId} className="flex min-h-14 items-center gap-2.5 border-t border-divider py-1.5 first:border-t-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                      k.state === 'rekrut' ? 'bg-pill-green text-pill-green-ink' : 'bg-kandidat text-kandidat-ink',
                    )}
                  >
                    {initialsFor(k.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold uppercase leading-snug text-ink">{k.name}</span>
                    <span className="mt-0.5 block">
                      {k.state === 'rekrut' ? (
                        <span className="rounded-pill bg-pill-green px-2 py-px text-xs font-semibold text-pill-green-ink">
                          {t.rekrutOn({ day: k.rekrutOn ? day(k.rekrutOn) : '' })}
                        </span>
                      ) : (
                        <span className="rounded-pill bg-potensi px-2 py-px text-xs font-semibold text-potensi-ink">{t.kandidatPotensi}</span>
                      )}
                    </span>
                  </span>
                  {k.state === 'potensi' ? stageOf('recruitment', k.statusCode) : k.newHireMembershipId ? (
                    <Link
                      href={`/new-hires/${encodeURIComponent(k.newHireMembershipId)}`}
                      className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-pill border border-secondary px-2.5 text-sm font-bold text-navy"
                    >
                      {t.newHires} ›
                    </Link>
                  ) : mayInvite ? (
                    <button
                      type="button"
                      onClick={() => setAdding(k)}
                      className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-pill border border-secondary px-2.5 text-sm font-bold text-navy"
                    >
                      {t.addToUnit} ›
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        )}
      </ResponsiveSheet>
      {addOpened && (
        <AddAgentDialog
          open={adding !== null}
          today={today}
          leader={head.isReader ? null : { membershipId: head.membershipId, name: head.name }}
          fromRecruit={adding ? { fullName: adding.name, leadId: adding.leadId } : null}
          onClose={() => setAdding(null)}
          onAdded={added}
        />
      )}
    </>
  );
}

/**
 * ***Chat {role} {name}*** (AC-6): WhatsApp to the agent — straight through with a number on file, else the existing
 * *Isi nomor WhatsApp* (UI-081), which saves it to their account (`PUT /members/:membershipId/phone`) and then opens it.
 */
function ChatButton({ person, label }: { person: UnitPotensiPersonView['person']; label: string }) {
  const [phone, setPhone] = useState(person.phone);
  const [asking, setAsking] = useState(false);
  const opened = useOpenedOnce(asking);
  const href = whatsAppHref(phone);
  const FACE = 'flex min-h-12 w-full items-center justify-center gap-1.5 rounded-pill bg-whatsapp px-4 text-md font-bold text-white';
  return (
    <>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={FACE}>
          <LineIcon name="whatsapp" className="h-5 w-5" />{label}
        </a>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={FACE}>
          <LineIcon name="whatsapp" className="h-5 w-5" />{label}
        </button>
      )}
      {opened && (
        <PhoneNumberSheet
          open={asking}
          name={person.name}
          phone={phone}
          onClose={() => setAsking(false)}
          onSave={async (typed) => (await saveMemberPhone(person.membershipId, typed)).phone}
          onSaved={(stored) => { setPhone(stored); setAsking(false); }}
        />
      )}
    </>
  );
}

/** The tiles and a card, in outline, while the tab is read. */
function PotensiSkeleton() {
  const t = useMessages(unitPotensiMessages);
  return (
    <Skeleton label={t.loading}>
      <SkeletonBar className="h-11 w-44 rounded-pill" />
      <div className="mt-2.5 grid grid-cols-2 gap-2 md:max-w-[480px]">
        <div className="min-h-[72px] rounded-lg bg-card" />
        <div className="min-h-[72px] rounded-lg bg-card" />
      </div>
      <div className="mt-2 h-48 rounded-lg bg-card" />
    </Skeleton>
  );
}
