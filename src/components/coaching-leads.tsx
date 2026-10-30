'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LeadContactButtons } from '@/components/contact-buttons';
import { DateField } from '@/components/ui/date-field';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { leadsMessages } from '@/i18n/messages/leads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { leadGap, sessionLeadOrder, SESSION_LEADS_SHOWN, type Coachee } from '@/lib/coaching';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  countByType, listEveryLead, nameMatches, nextActionState, updateLead, type Lead, type LeadType, type LeadTypeChip,
} from '@/lib/leads';
import { useCan } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';

/** The lead sheet, downloaded when a lead is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const LeadSheet = dynamic(() => import('@/components/lead-sheet').then((m) => m.LeadSheet), { ssr: false });

/**
 * **A coachee's leads, compact** (UI V1, UI-062, UI-081, UI-029; D-10, D-19): the Coaching Session's *Leads* card and the
 * coachee's *Leads* tab. One read — `GET /leads?owner=` (ADR-0076: answered only for somebody the reader coaches, 404
 * across offices, audited once per page read) — every lead the coachee holds, page after page (`listEveryLead`); the open
 * ones are the rows, the closed ones the one *Ditutup* line.
 *
 * **A row** (`CoacheeLeadRow`): the avatar, the NAME, the type and stage pills, **one next-action line** — the date bold
 * and the note — and **WhatsApp and Call**, always enabled (UI-081: with no number they ask for one first). A lead with
 * no next action **never drops out**: in the line's place, in red, ***Isi tindakan*** (no note, no date — opens the lead
 * sheet) or ***Isi tanggal*** (a note, no date — opens the date picker, and the date is saved to the lead). The whole row
 * opens the lead sheet (`LeadSheet`, the Leads agent's, T12) — read-only where the session is finalized and on the tab.
 */

/**
 * Every lead the coachee holds, and the writes that change one. Asked for only once `enabled` — the session's card waits
 * for a session to be open, since the pre-start state reads nothing about the person (each read is audited).
 */
export function useCoacheeLeads(owner: string, enabled = true) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    let held: Lead[] = [];
    setLeads(null);
    setError(null);
    listEveryLead(
      { owner },
      (rows, _total, first) => {
        const seen = new Set((first ? [] : held).map((l) => l.id));
        held = [...(first ? [] : held), ...rows.filter((r) => !seen.has(r.id))];
        setLeads(held);
      },
      () => live,
    ).catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [owner, enabled]);

  /** A lead as the server now has it: in place, or added on top when it is new. */
  const put = useCallback((lead: Lead) => {
    setLeads((now) => {
      const list = now ?? [];
      return list.some((l) => l.id === lead.id) ? list.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...list];
    });
  }, []);

  return { leads, error, put };
}

/** A ladder's stages by type, from the office's configuration. */
function useLadders() {
  const { config } = useTenantConfig();
  return useCallback(
    (type: LeadType | null): LeadStatusRow[] =>
      (type ? config?.leadPipelines?.find((p) => p.pipeline === type)?.statuses ?? [] : []),
    [config],
  );
}

/** The office's today, for a word on screen (*Hari ini*, the year beside a date) — never a computation over data. */
const officeToday = () => dayInZone(OFFICE_TIME_ZONE, new Date());

/**
 * One lead, compact. **The name is the row's button**, stretched over the row, so a tap anywhere but the controls opens
 * the sheet and a screen reader meets one control named for the lead; *Isi tindakan*, *Isi tanggal*, WhatsApp and Call
 * sit above it, each its own target.
 */
export function CoacheeLeadRow({
  lead, ladder, editable, onOpen, onSaved,
}: {
  lead: Lead;
  ladder: readonly LeadStatusRow[];
  /** The session is open and the reader may change the lead: *Isi tindakan* and *Isi tanggal* act. */
  editable: boolean;
  /** `nextAction`: *Isi tindakan* opens the sheet on *Tindakan berikutnya* (`LeadSheet`'s `focus`). */
  onOpen: (focus?: 'nextAction') => void;
  onSaved: (lead: Lead) => void;
}) {
  const t = useMessages(leadsMessages);
  const s = useMessages(coachingSessionMessages).leadsCard;
  const figures = useFigureLanguage();
  const today = officeToday();
  const gap = leadGap(lead);
  const state = nextActionState(lead, today);
  const late = state === 'overdue';
  const stage = ladder.find((row) => row.code === lead.statusCode)?.label ?? null;
  const [dating, setDating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function date(day: string) {
    if (!day || dating) return;
    setDating(true);
    setError(null);
    try {
      onSaved(await updateLead(lead.id, { nextActionDate: day }, lead.version));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setDating(false);
    }
  }

  const gapWords = gap === 'date' ? t.list.fillDate : t.list.fillAction;
  const RED = 'flex min-h-6 items-center gap-1.5 text-base font-semibold text-pill-red-ink';

  return (
    <li data-coachee-lead={lead.id} data-gap={gap ?? undefined} className="relative flex items-center gap-2.5 py-2.5">
      <Avatar name={lead.name} seed={lead.id} size={36} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen()}
          aria-haspopup="dialog"
          className="block w-full truncate text-left text-md font-bold uppercase text-ink after:absolute after:inset-0 after:rounded-row after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-amber"
        >
          {lead.name}
        </button>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {lead.type && (
            <span
              className={cn(
                'inline-flex items-center rounded-pill px-2 py-px text-xs font-semibold',
                lead.type === 'sales' ? 'bg-amber/[0.12] text-amber-ink' : 'bg-lavender/20 text-navy',
              )}
            >
              {t.types[lead.type]}
            </span>
          )}
          {stage && <TonePill tone="grey" className="max-w-full truncate px-2 py-px">{stage}</TonePill>}
        </div>
        {gap === null ? (
          <p data-next-action={state} className={cn('mt-1 flex min-w-0 items-center gap-1.5 text-base', late ? 'text-signal-red' : 'text-pill-grey-ink')}>
            <LineIcon name="calendar" className="h-3.5 w-3.5 shrink-0" />
            <strong className={cn('shrink-0 font-semibold', !late && 'text-ink')}>
              {state === 'today' ? t.list.nextActionToday : formatShortDay(lead.nextActionDate!, { year: lead.nextActionDate!.slice(0, 4) !== today.slice(0, 4) }, figures)}
            </strong>
            {late && <span className="sr-only">, {t.list.overdue}</span>}
            {lead.nextActionNote && <span className="min-w-0 truncate">· {lead.nextActionNote}</span>}
          </p>
        ) : !editable ? (
          <p data-next-action="missing" className={cn(RED, 'mt-1')}>
            <LineIcon name="calendarPlus" className="h-3.5 w-3.5 shrink-0" />
            {gapWords}
            {lead.nextActionNote && <span className="min-w-0 truncate font-normal text-pill-grey-ink">· {lead.nextActionNote}</span>}
          </p>
        ) : gap === 'action' ? (
          // *Isi tindakan* (UI-062): the sheet, where the next action is written.
          <button type="button" data-next-action="missing" onClick={() => onOpen('nextAction')} className={cn(RED, 'relative z-[1] mt-1 max-lg:min-h-11')}>
            <LineIcon name="calendarPlus" className="h-3.5 w-3.5 shrink-0" />
            {gapWords}
          </button>
        ) : (
          // *Isi tanggal* (UI-062): the date picker, and the day chosen saved to the lead.
          <div data-next-action="missing" className="relative z-[1] mt-1 flex min-w-0 items-center gap-1.5 max-lg:min-h-11">
            <LineIcon name="calendarPlus" className="h-3.5 w-3.5 shrink-0 text-pill-red-ink" />
            <DateField
              value={null}
              onChange={(day) => void date(day)}
              min={today}
              disabled={dating}
              aria-label={s.pickDate({ name: lead.name })}
              density="text"
              glyph="none"
              emptyText={gapWords}
              faceClassName="text-base font-semibold no-underline max-md:text-base [&>span]:text-pill-red-ink"
            />
            <span className="min-w-0 truncate text-base text-pill-grey-ink">· {lead.nextActionNote}</span>
          </div>
        )}
        {error && <div className="relative z-[1] mt-1.5"><ErrorBanner {...error} /></div>}
      </div>
      <LeadContactButtons lead={lead} size={36} onSaved={onSaved} className="self-center" />
    </li>
  );
}

/** The type chips' words: *Semua*, *Sales*, *Recruit*. */
function useTypeName() {
  const t = useMessages(leadsMessages);
  return (type: LeadTypeChip) => (type === 'all' ? t.list.all : t.types[type]);
}

/** The search pill: *Cari leads…*, 16px, the whole pill the field's target. */
function SearchPill({ value, onChange, filter }: { value: string; onChange: (next: string) => void; filter?: React.ReactNode }) {
  const t = useMessages(leadsMessages);
  return (
    <div role="search" className="flex gap-2" aria-label={t.searchAndFilter}>
      <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-pill bg-base px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-amber max-lg:min-h-11">
        <LineIcon name="search" className="h-[18px] w-[18px] shrink-0" />
        <span className="sr-only">{t.list.search}</span>
        <input
          type="search"
          value={value}
          placeholder={t.searchPlaceholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-signal-grey"
        />
      </label>
      {filter}
    </div>
  );
}

/** Open leads, in the card's order, narrowed by the search and the type. */
function useShownLeads(leads: readonly Lead[] | null, term: string, type: LeadTypeChip) {
  return useMemo(() => {
    const open = (leads ?? []).filter((l) => l.outcome === null);
    const narrowed = open.filter((l) => (type === 'all' || l.type === type) && (!term.trim() || nameMatches(l.name, term)));
    return { open, rows: sessionLeadOrder(narrowed) };
  }, [leads, term, type]);
}

/** *Ditutup: Berhasil 0 · Tidak berhasil 0* (UI-062) — hidden on a phone when both are 0 (D-08). */
function ClosedLine({ leads }: { leads: readonly Lead[] }) {
  const t = useMessages(coachingSessionMessages).leadsCard;
  const won = leads.filter((l) => l.outcome === 'won').length;
  const lost = leads.filter((l) => l.outcome === 'lost').length;
  return (
    <p data-closed-line="" className={cn('border-t border-divider pt-2.5 text-sm text-muted', won + lost === 0 && 'max-md:hidden')}>
      {t.closed({ won, lost })}
    </p>
  );
}

function LeadsSkeleton() {
  const t = useMessages(coachingSessionMessages).leadsCard;
  return (
    <Skeleton label={t.reading}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5 py-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-hairline" />
          <div className="flex-1"><SkeletonBar className="h-3.5 w-2/3" /><SkeletonBar className="mt-2 h-3 w-1/2" /></div>
        </div>
      ))}
    </Skeleton>
  );
}

/**
 * **The Coaching Session's *Leads* card** (UI-062): *Leads · 12* and *+ Tambah lead*; the search pill and a filter
 * button (the type, in a sheet); the rows, **the first five** — *Isi tindakan* / *Isi tanggal* first, then the overdue,
 * then by date — and ***Tampilkan semua (12)*** below them, ***Tampilkan lebih sedikit*** at the foot once open, which
 * scrolls back to the card's top; a search or a filter shows every match. Fewer than six, no toggle. Then the closed
 * leads in one line. `locked` (a finalized session, or one the reader did not lead) adds nothing and dates nothing.
 * The leads and the lead sheet are the workspace's (`useCoacheeLeads`), which *Dari leads* opens the same sheet from:
 * `onOpen(null)` is a new lead, `onSaved` every lead the server answers.
 */
export function SessionLeadsCard({
  leads, error, locked, onOpen, onSaved, className,
}: {
  leads: readonly Lead[] | null;
  error: ApiError | null;
  locked: boolean;
  onOpen: (lead: Lead | null, focus?: 'nextAction') => void;
  onSaved: (lead: Lead) => void;
  className?: string;
}) {
  const t = useMessages(leadsMessages);
  const s = useMessages(coachingSessionMessages);
  const typeName = useTypeName();
  const ladderFor = useLadders();
  const canCreate = useCan('lead:create');
  const canUpdate = useCan('lead:update');
  const [term, setTerm] = useState('');
  const [type, setType] = useState<LeadTypeChip>('all');
  const [all, setAll] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const top = useRef<HTMLElement>(null);
  const titleId = useId();
  const { open, rows } = useShownLeads(leads, term, type);
  const narrowing = term.trim() !== '' || type !== 'all';
  const shown = all || narrowing ? rows : rows.slice(0, SESSION_LEADS_SHOWN);
  const toggles = !narrowing && rows.length > SESSION_LEADS_SHOWN;
  const counts = countByType(open);

  return (
    <section
      ref={top}
      id="session-leads"
      aria-labelledby={titleId}
      data-session-card="leads"
      className={cn('scroll-mt-4 rounded-lg border border-card-edge bg-card p-3.5', className)}
    >
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
        <h2 id={titleId} className="text-lg font-bold text-navy">
          {s.leads}
          {leads && <span className="ml-1 text-md font-normal text-muted">· {open.length}</span>}
        </h2>
        {!locked && canCreate && (
          <button
            type="button"
            onClick={() => onOpen(null)}
            className="inline-flex min-h-9 items-center rounded-pill border border-amber px-3 text-base font-semibold text-amber-ink hover:bg-amber/10 max-lg:min-h-11"
          >
            {t.add}
          </button>
        )}
      </div>

      <SearchPill
        value={term}
        onChange={setTerm}
        filter={(
          <button
            type="button"
            onClick={() => setFiltering(true)}
            aria-label={type !== 'all' ? t.list.filterOn : t.list.filter}
            aria-haspopup="dialog"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base text-navy hover:bg-hover-row max-lg:h-11 max-lg:w-11"
          >
            <LineIcon name="adjust" className="h-5 w-5" />
            {type !== 'all' && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber" />}
          </button>
        )}
      />

      {error && <div className="mt-2.5"><ErrorBanner {...error} /></div>}
      {!leads && !error && <LeadsSkeleton />}
      {leads && (
        <>
          {rows.length === 0 ? (
            <p className="py-3 text-base text-muted">{narrowing ? s.leadsCard.noMatch : s.leadsCard.none}</p>
          ) : (
            <ul role="list" className="mt-1 divide-y divide-divider">
              {shown.map((lead) => (
                <CoacheeLeadRow
                  key={lead.id}
                  lead={lead}
                  ladder={ladderFor(lead.type)}
                  editable={!locked && canUpdate}
                  onOpen={(focus) => onOpen(lead, focus)}
                  onSaved={onSaved}
                />
              ))}
            </ul>
          )}
          {toggles && (
            <button
              type="button"
              aria-expanded={all}
              onClick={() => {
                if (all) top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
                setAll((v) => !v);
              }}
              className="flex h-11 w-full items-center justify-center gap-1.5 border-t border-divider text-md font-semibold text-navy-soft hover:bg-hover-row"
            >
              {all ? s.leadsCard.showFewer : s.leadsCard.showAll({ n: rows.length })}
              <LineIcon name={all ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" />
            </button>
          )}
          <ClosedLine leads={leads} />
        </>
      )}

      <ResponsiveSheet open={filtering} title={t.list.filters.title} onClose={() => setFiltering(false)}>
        <div role="group" aria-label={t.list.chips} className="flex flex-wrap gap-1.5 pb-2">
          {(['all', 'sales', 'recruitment'] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              aria-pressed={type === chip}
              aria-label={t.list.chipSaid({ label: typeName(chip), n: counts[chip] })}
              onClick={() => { setType(chip); setFiltering(false); }}
              className={cn(
                'flex min-h-11 items-center gap-1.5 rounded-pill px-3.5 text-base font-semibold',
                type === chip ? 'bg-navy text-white' : 'bg-base text-navy hover:bg-hover-row',
              )}
            >
              {typeName(chip)}
              <span className={cn('text-xs font-semibold', type === chip ? 'text-on-navy-muted' : 'text-muted')}>{counts[chip]}</span>
            </button>
          ))}
        </div>
      </ResponsiveSheet>
    </section>
  );
}

/**
 * **The coachee's *Leads* tab** (UI V1, UI-029): that agent's leads, **read-only**, in the same compact rows — the search
 * pill, the type chips with their counts, every open lead in the card's order, the closed leads in one line. A row opens
 * the lead sheet read-only. WhatsApp and Call stay live (UI-081: no disabled button anywhere), and a number typed for a
 * lead with none is saved to it, as everywhere they are drawn.
 */
export function CoacheeLeadsTab({ coachee }: { coachee: Coachee }) {
  const t = useMessages(leadsMessages);
  const typeName = useTypeName();
  const ladderFor = useLadders();
  const s = useMessages(coachingSessionMessages).leadsCard;
  const { leads, error, put } = useCoacheeLeads(coachee.membershipId);
  const [term, setTerm] = useState('');
  const [type, setType] = useState<LeadTypeChip>('all');
  const [sheet, setSheet] = useState<Lead | null>(null);
  const sheetOpened = useOpenedOnce(sheet !== null);
  const { open, rows } = useShownLeads(leads, term, type);
  const counts = countByType(open);

  return (
    <div data-coachee-leads="" className="flex flex-col gap-2.5">
      <SearchPill value={term} onChange={setTerm} />
      <div role="group" aria-label={t.list.chips} className="flex gap-1.5">
        {(['all', 'sales', 'recruitment'] as const).map((chip) => (
          <button
            key={chip}
            type="button"
            aria-pressed={type === chip}
            aria-label={t.list.chipSaid({ label: typeName(chip), n: counts[chip] })}
            onClick={() => setType(chip)}
            className={cn(
              'flex min-h-9 items-center gap-1.5 rounded-pill px-3.5 text-base font-semibold max-lg:min-h-11',
              type === chip ? 'bg-navy text-white' : 'bg-card text-navy hover:bg-hover-row',
            )}
          >
            {typeName(chip)}
            <span className={cn('text-xs font-semibold', type === chip ? 'text-on-navy-muted' : 'text-muted')}>{leads ? counts[chip] : ''}</span>
          </button>
        ))}
      </div>
      <section aria-label={t.list.title} className="rounded-lg border border-card-edge bg-card px-3.5 py-1.5">
        {error && <div className="py-2"><ErrorBanner {...error} /></div>}
        {!leads && !error && <LeadsSkeleton />}
        {leads && (rows.length === 0 ? (
          <p className="py-3 text-base text-muted">{term.trim() || type !== 'all' ? s.noMatch : s.none}</p>
        ) : (
          <ul role="list" className="divide-y divide-divider">
            {rows.map((lead) => (
              <CoacheeLeadRow
                key={lead.id}
                lead={lead}
                ladder={ladderFor(lead.type)}
                editable={false}
                onOpen={() => setSheet(lead)}
                onSaved={put}
              />
            ))}
          </ul>
        ))}
        {leads && <div className="pb-2"><ClosedLine leads={leads} /></div>}
      </section>
      {sheetOpened && (
        <LeadSheet
          open={sheet !== null}
          lead={sheet}
          owner={coachee.membershipId}
          readOnly
          offerDelete={false}
          onClose={() => setSheet(null)}
          onSaved={put}
        />
      )}
    </div>
  );
}
