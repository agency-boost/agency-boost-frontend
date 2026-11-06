'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { stageTone } from '@/components/lead-card';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar, initialsFor } from '@/components/ui/avatar';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { rungShort } from '@/components/ui/role-badge';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { MessagesOf } from '@/i18n/catalogue';
import { unitPotensiMessages } from '@/i18n/messages/unit-potensi';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatShortDay } from '@/lib/format';
import type { AddAgentResult } from '@/lib/invites';
import { saveMemberPhone, whatsAppHref } from '@/lib/phone-number';
import { useCan, useSession } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useOpenedOnce } from '@/lib/use-opened-once';
import {
  cardCounts, nothingIn, orderedPeople, pastCounts, pillsOf, potensiMonths, readPotensiPerson, readUnitPotensi,
  type PotensiKandidat, type PotensiPerson, type PotensiUnit, type PotensiView, type UnitPotensiPersonView,
  type UnitPotensiView,
} from '@/lib/unit-dashboard';

/** *+ Add agent*'s form, downloaded when *Tambahkan ke unit ›* is first pressed. */
const AddAgentDialog = dynamic(() => import('@/components/add-agent-form').then((m) => m.AddAgentDialog), { ssr: false });
/** *Isi nomor WhatsApp*, downloaded when *Chat Agent {name}* is pressed for somebody with no number (UI-081). */
const PhoneNumberSheet = dynamic(() => import('@/components/phone-number-sheet').then((m) => m.PhoneNumberSheet), { ssr: false });

/** The tab's words, as `useMessages(unitPotensiMessages)` gives them. */
type PotensiWords = MessagesOf<(typeof unitPotensiMessages)['en']>;

/** *November 2026*: the month's name in full and its year, in the figures' language. */
const monthTitle = (month: string, figures: ReturnType<typeof useFigureLanguage>) =>
  `${formatMonthLong(month, figures)} ${month.slice(0, 4)}`;

/** A first name, for *Langsung ke AB Agus*. */
const firstName = (name: string) => name.split(' ')[0] ?? name;

/**
 * **The Unit Dashboard's *Potensi* tab** (P19.1-T6; UI-155, UI-159 item 4; ADR-0193; the Potensi stop-motion, frames
 * 11–31): who in the reader's unit may become active and which kandidat may join this month, from the switch every agent
 * sets on their own leads (UI-153). The leader types nothing.
 *
 * - **A month picker** (*November 2026 ⌄*), this month on open — a native select, 16px on a phone. **No toggle.**
 * - **Two tiles that are the switch** (a radio group): *AA*, chosen on open, and *Rekrut* — one big number each, no total,
 *   no sub-line; the chosen one navy with white words. Choosing swaps the list below with no read: the answer holds both.
 * - **One list design for both**: a card per unit below the head (*UNIT AAB SARI PUSPITA*), then *LANGSUNG KE AB AGUS*;
 *   the leader first with a navy role tag; then potensi only, then ✓, then ✕; pills *n potensi* (yellow) then the ✓
 *   (green) — or ✕, the person greyed. A card's header *n potensi · n AA*. Every row that opens has ›.
 * - **A row opens a read-only sheet**: *Agent RINA · n potensi* with their switched-on clients (Q-2: names), or *Agent
 *   RINA · n potensi · n rekrut* with their kandidat — *New Hires ›* for one linked to a member, *Tambahkan ke unit ›*
 *   (the add-agent form, the name typed in) for one who is not yet — and *Chat Agent Rina*.
 * - **An earlier month**: the tiles, and one row per unit — *potensi x/y · n AA*, *potensi x/y rekrut*.
 * - **Empty**: *Belum ada potensi.* or *Belum ada potensi rekrut.* and *Agent menyalakannya di Leads.* — never an error;
 *   the tab is the role's whatever the downline (UI-159 item 4).
 *
 * Tablet and laptop lay the same cards out two to a row (no mockup draws them; the parity row says so).
 */
export function UnitPotensi({ forId, onHead, readOnly = false }: {
  forId?: string;
  onHead?: (head: { name: string }) => void;
  /** The office's read-only view of another leader's unit (P19.3-T3 AC-3): *Tambahkan ke unit ›* is not drawn. */
  readOnly?: boolean;
}) {
  const t = useMessages(unitPotensiMessages);
  const figures = useFigureLanguage();
  const tilesId = useId();
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<PotensiView>('aa');
  const [held, setHeld] = useState<{ key: string; data: UnitPotensiView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [person, setPerson] = useState<PotensiPerson | null>(null);
  const key = `${forId ?? ''}|${month ?? ''}`;

  useEffect(() => {
    let live = true;
    setError(null);
    readUnitPotensi({ month: month ?? undefined, for: forId })
      .then((data) => {
        if (!live) return;
        setHeld({ key, data });
        onHead?.(data.head);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [key, month, forId, attempt, onHead]);

  const data = held?.key === key ? held.data : held?.data ?? null;
  const past = !!data && data.month < data.currentMonth;
  const units = data?.units ?? [];
  const hasUnits = units.some((u) => u.kind === 'unit');

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
          <label className="relative inline-flex items-center">
            <span className="sr-only">{t.month}</span>
            <select
              value={data.month}
              onChange={(e) => { setMonth(e.target.value === data.currentMonth ? null : e.target.value); setPerson(null); }}
              className="h-11 cursor-pointer appearance-none rounded-pill border-0 bg-secondary py-0 pl-4 pr-9 text-lg font-semibold text-secondary-contrast md:text-base lg:h-9"
            >
              {potensiMonths(data.currentMonth).map((m) => <option key={m} value={m}>{monthTitle(m, figures)}</option>)}
            </select>
            <LineIcon name="chevronDown" className="pointer-events-none absolute right-3 h-4 w-4 text-secondary-contrast" />
          </label>

          <div role="radiogroup" aria-label={t.tiles} id={tilesId} className="mt-2.5 grid grid-cols-2 gap-2 md:max-w-[480px]">
            {(['aa', 'rekrut'] as const).map((which) => {
              const chosen = view === which;
              return (
                <button
                  key={which}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => setView(which)}
                  data-potensi-tile={which}
                  className={cn(
                    'min-h-[72px] rounded-lg border-2 px-3.5 py-2.5 text-left',
                    chosen ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-transparent bg-card text-ink',
                  )}
                >
                  <span className={cn('block text-xs font-semibold', chosen ? 'text-secondary-muted' : 'text-muted')}>
                    {which === 'aa' ? t.aa : t.rekrut}
                  </span>
                  <span className="block text-[28px] font-extrabold leading-tight">{data.tiles[which]}</span>
                </button>
              );
            })}
          </div>

          {past ? (
            <ul className="mt-2.5 overflow-hidden rounded-lg bg-card" aria-label={monthTitle(data.month, figures)}>
              {units.map((unit) => {
                const c = pastCounts(unit, view);
                return (
                  <li key={unit.leader.membershipId} className="flex min-h-14 items-center justify-between gap-2 border-t border-divider px-3 py-2 first:border-t-0">
                    <span className="text-sm font-bold uppercase text-ink">{unitTitle(unit, hasUnits, t)}</span>
                    <span className="shrink-0 text-xs font-semibold text-muted">
                      {view === 'aa' ? t.aaPast({ x: c.x, y: c.y, n: c.done }) : t.rekrutPast({ x: c.x, y: c.y, n: c.done })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : nothingIn(data, view) ? (
            <Card className="mt-2.5 px-4 py-6 text-center">
              <LineIcon name="target" className="mx-auto mb-1.5 h-8 w-8 text-signal-grey" />
              <p className="text-md font-bold text-ink">{view === 'aa' ? t.emptyAa : t.emptyRekrut}</p>
              <p className="text-md text-muted">{t.emptyLine}</p>
            </Card>
          ) : (
            <div className="mt-2 grid gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
              {units.map((unit) => (
                <UnitCard key={unit.leader.membershipId} unit={unit} view={view} hasUnits={hasUnits} onOpen={setPerson} />
              ))}
            </div>
          )}

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

/** A card's title: *Unit AAB Sari Puspita*, or the head's own *Langsung ke AB Agus* beside units — upper case on screen. */
function unitTitle(unit: PotensiUnit, hasUnits: boolean, t: PotensiWords): string {
  const role = rungShort(unit.leader.rung);
  return unit.kind === 'direct' && hasUnits
    ? t.direct({ role, name: firstName(unit.leader.name) })
    : t.unit({ role, name: unit.leader.name });
}

/** One unit's card (AC-3, AC-4): its header and its rows, in the view's order. */
function UnitCard({
  unit, view, hasUnits, onOpen,
}: { unit: PotensiUnit; view: PotensiView; hasUnits: boolean; onOpen: (p: PotensiPerson) => void }) {
  const t = useMessages(unitPotensiMessages);
  const counts = cardCounts(unit, view);
  const title = unitTitle(unit, hasUnits, t);
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg bg-card" data-potensi-unit={unit.kind}>
      <header className="flex items-center justify-between gap-1.5 bg-hover-row px-3 py-2 text-xs font-extrabold uppercase tracking-[0.02em] text-ink">
        <span className="min-w-0">{title}</span>
        <span className="shrink-0 font-semibold normal-case tracking-normal text-muted">
          {view === 'aa' ? t.aaCounts({ potensi: counts.potensi, aa: counts.done }) : t.rekrutCounts({ potensi: counts.potensi, rekrut: counts.done })}
        </span>
      </header>
      <ul>
        {orderedPeople(unit, view).map((p) => <PersonRow key={p.membershipId} person={p} view={view} onOpen={onOpen} />)}
      </ul>
    </section>
  );
}

/** One person's row: avatar, the role tag for a leader, the name in full (two lines at most, never cut), the pills, ›. */
function PersonRow({ person, view, onOpen }: { person: PotensiPerson; view: PotensiView; onOpen: (p: PotensiPerson) => void }) {
  const t = useMessages(unitPotensiMessages);
  const { potensi, done, none } = pillsOf(person, view);
  const face = (
    <>
      {done > 0 || none ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
            done > 0 ? 'bg-pill-green text-pill-green-ink' : 'bg-pill-grey text-pill-grey-ink',
          )}
        >
          {initialsFor(person.name)}
        </span>
      ) : (
        <Avatar name={person.name} photoUrl={person.photoUrl} seed={person.membershipId} size={36} />
      )}
      <span data-potensi-name="" className={cn('min-w-0 flex-1 text-sm font-bold uppercase leading-snug', none ? 'text-pill-grey-ink' : 'text-ink')}>
        {person.isLeader && (
          <span className="mr-1.5 inline-block rounded-[4px] bg-secondary px-1.5 py-px align-[1px] text-xs font-bold text-secondary-contrast">
            {rungShort(person.rung)}
          </span>
        )}
        {person.name}
      </span>
      <span data-potensi-pills="" className="flex shrink-0 flex-wrap justify-end gap-1">
        {potensi > 0 && <span className="rounded-pill bg-potensi px-2 py-px text-xs font-semibold text-potensi-ink">{t.potensi({ n: potensi })}</span>}
        {done > 0 && (
          <span className="rounded-pill bg-pill-green px-2 py-px text-xs font-semibold text-pill-green-ink">
            {view === 'aa' ? `${t.aa} ✓` : t.rekrutDone({ n: done })}
          </span>
        )}
        {none && (
          <span role="img" aria-label={t.neither} title={t.neither} className="min-w-7 rounded-pill bg-pill-grey px-2 py-px text-center text-xs font-semibold text-pill-grey-ink">
            ✕
          </span>
        )}
      </span>
    </>
  );
  const ROW = 'flex min-h-14 w-full items-center gap-2.5 border-t border-divider px-3 py-1.5 text-left';
  return (
    <li className="first:[&>*]:border-t-0" data-potensi-row={none ? 'none' : done > 0 ? 'done' : potensi > 0 ? 'potensi' : 'leader'}>
      {person.opens ? (
        <button type="button" aria-label={t.open({ name: person.name })} onClick={() => onOpen(person)} className={cn(ROW, 'hover:bg-hover-row')}>
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
