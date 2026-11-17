'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { ClosedLeads, type List } from '@/components/closed-leads';
import { officeToday, useCoacheeLeads, useLadders, useShownLeads } from '@/components/coaching-leads';
import { LeadCard } from '@/components/lead-card';
import { LeadSearch, LeadTypeChips } from '@/components/lead-list-controls';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { leadsMessages } from '@/i18n/messages/leads';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { leadGap, type Coachee } from '@/lib/coaching';
import { countByType, type Lead, type LeadOutcome, type LeadTypeChip } from '@/lib/leads';
import { useCan, useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';

/** The lead sheet, downloaded when a lead is first opened and mounted from then on (`useOpenedOnce`; P18.11-T16). */
const LeadSheet = dynamic(() => import('@/components/lead-sheet').then((m) => m.LeadSheet), { ssr: false });

/*
 * **Its own module** (P19.16-T4): the tab draws `/leads`' cards and closed lists, which the coaching session — whose page
 * imports `coaching-leads.tsx` for its compact *Leads* card — never draws, so they stay out of that page's first load.
 */

/** Nothing on the tab's closed lists is ever busy or refused: they only read (P19.16-T4 AC-3). */
const NOT_BUSY: Record<string, boolean> = {};
const NO_REFUSALS = (): ApiError[] => [];

/** Newest registration first, as `/leads` asks for its closed lists (`loadClosed`); a lead with no date last. */
const byRegisteredDesc = (a: Lead, b: Lead) => (b.dateRegistered ?? '').localeCompare(a.dateRegistered ?? '');

/**
 * The coachee's closed leads as `/leads`' two lists, *Berhasil* and *Tidak berhasil* — from the one read the tab already
 * made (`useCoacheeLeads`), never a second; `null` while it is on its way.
 */
function useClosedLists(leads: readonly Lead[] | null): Record<LeadOutcome, List | null> {
  return useMemo(() => {
    if (!leads) return { won: null, lost: null };
    const of = (outcome: LeadOutcome): List => {
      const rows = leads.filter((l) => l.outcome === outcome).sort(byRegisteredDesc);
      return { rows, total: rows.length };
    };
    return { won: of('won'), lost: of('lost') };
  }, [leads]);
}

/**
 * **The coachee's *Leads* tab** (UI V1, UI-029; the staging review of 2026-10-31; P19.16-T4): that agent's leads, drawn
 * **as `/leads` draws the reader's own** (the client's request of 2026-11-17: *the member's Leads tab looks like
 * `/leads`*) — the search pill and the type chips with their counts (`LeadSearch`, `LeadTypeChips`), a `LeadCard` per
 * open lead, one under the other on a phone and two to a row on a tablet, and below them ***Leads yang ditutup***, the
 * *Berhasil* and *Tidak berhasil* lists (`ClosedLeads`). No filter button, no pipeline strip, no order: the search and
 * the type are all it narrows by, and the order is the session card's (`sessionLeadOrder`: no next action first, then
 * the overdue, then by date).
 *
 * **A card is `/leads`' own**: the avatar with its *Potensi* badge, the NAME, *Sales › stage*, the next-action line —
 * red ***Isi tindakan*** / ***Isi tanggal*** where there is none, a lead that never drops out — and **WhatsApp alone**
 * (UI-081: with no number it asks for one first, and saves it to the lead). No *Milik …*: every lead is the coachee's,
 * and the shell above names them. No proposal pill and no *Buat proposal*: a proposal is its owner's (ADR-0257), and
 * the card decides that from whose lead it is. The closed lists read: nothing is reopened from here.
 *
 * **It writes, as the session's Leads card does** (`SessionLeadsCard`; the product owner, 2026-11-01: *add and edit,
 * never delete*), replacing UI-029's read-only tab. The floating **+** of `/leads` adds a lead to the coachee's pipeline
 * (`POST /leads?owner=`, `lead:create` resolved to `COACH`); a card opens the lead sheet to edit — on *Tindakan
 * berikutnya* where the lead has none — and each write is pinned to the version it read (P11-T4 AC-3). **No *Hapus***:
 * `lead:delete` is the owner's alone (§3.7). A read-only support session, or a reader the server granted no write, is
 * drawn none of it: the sheet opens to read.
 */
export function CoacheeLeadsTab({ coachee }: { coachee: Coachee }) {
  const t = useMessages(leadsMessages);
  const ladderFor = useLadders();
  const s = useMessages(coachingSessionMessages).leadsCard;
  const { me } = useSession();
  const { leads, error, put } = useCoacheeLeads(coachee.membershipId);
  const [term, setTerm] = useState('');
  const [type, setType] = useState<LeadTypeChip>('all');
  /** The lead sheet: a lead, or `null` for a new one in the coachee's pipeline. */
  const [sheet, setSheet] = useState<{ lead: Lead | null; focus?: 'nextAction' } | null>(null);
  const sheetOpened = useOpenedOnce(sheet !== null);
  // A support session that may look and not touch (§3.13): no add, no edit, the sheet only to read.
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const canCreate = useCan('lead:create') && !readOnly;
  const canUpdate = useCan('lead:update') && !readOnly;
  const { open, rows } = useShownLeads(leads, term, type);
  const counts = countByType(open);
  const closed = useClosedLists(leads);
  const today = officeToday();
  const stageLabel = (row: Lead) => ladderFor(row.type).find((stage) => stage.code === row.statusCode)?.label ?? null;

  return (
    // `/leads`' room below the list (`pb-20`), so the floating + never covers the last closed lead.
    <div data-coachee-leads="" className="pb-20">
      <LeadSearch value={term} onChange={setTerm} />
      <LeadTypeChips chip={type} onChip={setType} counts={counts} counted={leads !== null} />

      {error && <ErrorBanner {...error} />}
      {!leads && !error && <SkeletonCards count={4} label={s.reading} />}
      {leads && (rows.length === 0 ? (
        // `/leads`' empty and no-match look; the words the session card says of a coachee (none of `/leads`' *add your first one*).
        <div className="rounded-lg bg-card">
          <EmptyState
            title={open.length === 0 ? s.none : s.noMatch}
            boost={open.length === 0 ? 'thinking' : undefined}
            variant={open.length === 0 ? 'empty' : 'filtered'}
          />
        </div>
      ) : (
        // `/leads`' phone list: one under the other, two to a row on a tablet (P19.1-T2 AC-2; UI-113).
        <ul role="list" aria-label={t.list.title} className="flex flex-col gap-1.5 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-2">
          {rows.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              ladder={ladderFor(lead.type)}
              today={today}
              nameOwner={false}
              // *Isi tindakan* is the card's own words now: the sheet opens on the next action to write it (UI-062).
              onOpen={() => setSheet({ lead, focus: leadGap(lead) === 'action' ? 'nextAction' : undefined })}
              onSaved={put}
            />
          ))}
        </ul>
      ))}

      {/* A read that failed says so once, above; the closed lists come from the same read. */}
      {!(error && !leads) && (
        <ClosedLeads
          won={{ list: closed.won, error: null }}
          lost={{ list: closed.lost, error: null }}
          busy={NOT_BUSY}
          refusalsOf={NO_REFUSALS}
          stageLabel={stageLabel}
        />
      )}

      {canCreate && (
        /*
         * `/leads`' floating **+** (`leads-list.tsx`), at every width: the tab has no title row whose *+ Tambah lead* would
         * stand in for it on a desktop.
         */
        <button
          type="button"
          onClick={() => setSheet({ lead: null })}
          aria-label={t.list.add}
          className={cn(
            'fixed bottom-[calc(var(--tab-bar-space)+1rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full',
            'bg-primary text-primary-contrast shadow-modal hover:bg-primary-hover lg:bottom-6 lg:right-6',
          )}
        >
          <LineIcon name="plus" className="h-7 w-7" />
        </button>
      )}
      {sheetOpened && (
        <LeadSheet
          open={sheet !== null}
          lead={sheet?.lead ?? null}
          focus={sheet?.focus}
          owner={coachee.membershipId}
          readOnly={!canUpdate && !(sheet?.lead === null && canCreate)}
          offerDelete={false}
          onClose={() => setSheet(null)}
          onSaved={put}
          onClosedLead={put}
        />
      )}
    </div>
  );
}
