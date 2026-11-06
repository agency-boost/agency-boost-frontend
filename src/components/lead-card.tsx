'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LeadContactButtons } from '@/components/contact-buttons';
import { PotensiBadge } from '@/components/potensi-switch';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/person-row';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { cn } from '@/lib/cn';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { nextActionState, type Lead } from '@/lib/leads';
import { newProposalHref, productsPill } from '@/lib/proposals';
import { useCan, useSession } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';

/**
 * Where a stage sits on its own ladder, as a pill's tone (UI-005's tones; D-27, never a dot): the first stage grey, the
 * ladder's last green, a late stage (`isLateStage`, ADR-0043) amber, any other blue — by the stage's own attributes,
 * never by its code or its name.
 */
export function stageTone(ladder: readonly LeadStatusRow[], code: string | null): PillTone {
  const at = ladder.findIndex((stage) => stage.code === code);
  if (at <= 0) return 'grey';
  const stage = ladder[at];
  if (stage.isTerminal) return 'green';
  return stage.isLateStage ? 'amber' : 'blue';
}

/**
 * One lead, compact (UI-105): the avatar — with the *Potensi* ✓ badge on it since P19.1-T2 (UI-153 item 5) — the NAME in
 * capitals, the type and stage pills, one next-action line, and WhatsApp alone. **The name is the card's button**, stretched over the whole card, so a tap anywhere but WhatsApp opens
 * the sheet and a screen reader meets one control named for the lead; WhatsApp sits above it, its own target.
 *
 * **The same card at every size** (P19.1-T2 AC-1, UI-116): two to a row on a tablet, and the list beside the pane from
 * 1024px, where a tap opens the lead **in the pane** (`inPane`) — no dialog — and the open one wears a 2px outline in the
 * accent (`selected`, `aria-current`). There, on the reader's own lead while the list is in their saved order, the drag
 * handle stands before the avatar (`order`; I-295, the client's request of 2026-10-26, which the table carried).
 *
 * **The lead's proposal** (P19.7-T2 AC-1, AC-12; ADR-0221 §6, §8; the proposal spec, *Proposals on the Leads page*): a
 * document icon and the latest proposal's first product, with *+n* for the rest (*"PRUWell Medical +1"*), as a third pill
 * beside the type and the stage — only where the server sends `proposals`, which it does on the reader's own leads
 * alone; nothing extra on a lead with none. And ***Buat proposal*** on the reader's own Sales lead: the document icon as
 * a round link beside WhatsApp, named and tipped, to step 1 with this lead chosen (`newProposalHref`).
 */
export function LeadCard({
  lead, ladder: given, today = dayInZone(OFFICE_TIME_ZONE, new Date()), onOpen, onSaved, inPane = false, selected = false, order,
}: {
  lead: Lead;
  /** The lead's own ladder; the office's, from the published configuration, where none is given. */
  ladder?: readonly LeadStatusRow[];
  /** The office's today (`dayInZone`), for *Hari ini*. */
  today?: string;
  onOpen: () => void;
  /** A number saved through WhatsApp's *Isi nomor WhatsApp* (UI-081): the lead as the server now has it. */
  onSaved: (lead: Lead) => void;
  /** From 1024px: the tap opens the lead in the pane beside the list, not a dialog (UI-116). */
  inPane?: boolean;
  /** The lead open in the pane: the accent's 2px outline (UI-116). */
  selected?: boolean;
  /** The reader's own order (I-295): the handle, and the card as a place to drop a dragged one. */
  order?: {
    handle: ReactNode;
    /** Another card is being dragged over this one; this one is the one dragged. */
    over: boolean;
    lifted: boolean;
    target: {
      onDragOver: (e: React.DragEvent) => void;
      onDragLeave: () => void;
      onDrop: (e: React.DragEvent) => void;
    };
  };
}) {
  const t = useMessages(leadsMessages);
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const { me } = useSession();
  const canPropose = useCan('proposal:create');
  const ladder = given ?? config?.leadPipelines.find((p) => p.pipeline === lead.type)?.statuses ?? [];
  // *Buat proposal* on the reader's own Sales lead (ADR-0221 §3: a proposal is for one of the owner's own Sales leads).
  const proposable = canPropose && lead.type === 'sales' && lead.ownerMembershipId === me?.membership?.membershipId;
  const state = nextActionState(lead, today);
  const late = state === 'overdue';
  const day = lead.nextActionDate
    ? state === 'today' ? t.list.nextActionToday
      : formatShortDay(lead.nextActionDate, { year: lead.nextActionDate.slice(0, 4) !== today.slice(0, 4) }, figures)
    : null;

  const CARD = 'relative flex items-center gap-2.5 rounded-row bg-card px-3 py-2.5 hover:bg-hover-row';

  return (
    <li
      data-lead-card={lead.id}
      // The phone's card as it was: only the laptop's list adds the outline, the drop look and the drop target.
      className={inPane ? cn(
        CARD,
        selected && 'shadow-[inset_0_0_0_2px_var(--color-primary)]',
        order?.over && !order.lifted && 'bg-hover-row',
        order?.lifted && 'opacity-40',
      ) : CARD}
      {...(order ? { 'data-row': lead.id, ...order.target } : {})}
    >
      {order?.handle}
      {/* UI-153 item 5 (P19.1-T2 AC-8): the ✓ badge on the avatar's top-right, the card's size unchanged. */}
      <span className="relative shrink-0">
        <Avatar name={lead.name} seed={lead.id} size={36} />
        <PotensiBadge lead={lead} />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup={inPane ? undefined : 'dialog'}
          aria-current={inPane && selected ? 'true' : undefined}
          className="block w-full truncate text-left text-md font-bold uppercase text-ink after:absolute after:inset-0 after:rounded-row after:content-['']"
        >
          {lead.name}
        </button>
        <LeadPills lead={lead} ladder={ladder} proposals className="mt-1" />
        <p
          data-next-action={state}
          className={cn('mt-1 flex min-w-0 items-center gap-1.5 text-base', late || state === 'missing' ? 'text-signal-red' : 'text-pill-grey-ink')}
        >
          <LineIcon name={day ? 'calendar' : 'calendarPlus'} className="h-4 w-4 shrink-0" />
          {day ? (
            <>
              <strong className={cn('shrink-0 font-semibold', !late && 'text-ink')}>{day}</strong>
              {late && <span className="sr-only">, {t.list.overdue}</span>}
              {lead.nextActionNote && <span className="min-w-0 truncate">{lead.nextActionNote}</span>}
            </>
          ) : (
            <>
              <strong className="shrink-0 font-semibold">{lead.nextActionNote ? t.list.fillDate : t.list.fillAction}</strong>
              {lead.nextActionNote && <span className="min-w-0 truncate text-pill-grey-ink">{lead.nextActionNote}</span>}
            </>
          )}
        </p>
      </div>
      {proposable && (
        <Link
          href={newProposalHref(lead.id)}
          aria-label={t.list.makeProposalFor({ who: lead.name })}
          title={t.list.makeProposal}
          data-make-proposal={lead.id}
          className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-hover-row text-navy">
            <LineIcon name="document" className="h-[18px] w-[18px]" />
          </span>
        </Link>
      )}
      <LeadContactButtons lead={lead} channels={['whatsapp']} size={36} onSaved={onSaved} />
    </li>
  );
}

/**
 * **A lead's type and stage, as two pills** (UI-105): *Sales* or *Recruit* in the type's tint — *No type yet* in grey —
 * and the stage in its ladder's tone (`stageTone`), a stage the office retired by its code. The card's line, and the
 * pane's head under the NAME (UI-116).
 */
export function LeadPills({ lead, ladder, proposals = false, className }: {
  lead: Pick<Lead, 'type' | 'statusCode' | 'proposals'>;
  ladder: readonly LeadStatusRow[];
  /** The card's third pill, the lead's proposal (P19.7-T2 AC-12). The pane's head leaves it to its *Proposal* section. */
  proposals?: boolean;
  className?: string;
}) {
  const t = useMessages(leadsMessages);
  const stage = ladder.find((s) => s.code === lead.statusCode)?.label ?? (lead.statusCode ? t.retired({ code: lead.statusCode }) : null);
  return (
    <div className={cn(className, 'flex flex-wrap gap-1.5')}>
      {lead.type ? (
        <span
          className={cn(
            'inline-flex items-center rounded-pill px-2 py-px text-xs font-semibold',
            lead.type === 'sales' ? 'bg-primary/[0.12] text-primary-ink' : 'bg-lavender/20 text-navy',
          )}
        >
          {t.types[lead.type]}
        </span>
      ) : (
        <TonePill tone="grey">{t.noType}</TonePill>
      )}
      {stage && <TonePill tone={stageTone(ladder, lead.statusCode)} className="max-w-full truncate">{stage}</TonePill>}
      {proposals && lead.proposals && <ProposalPill proposals={lead.proposals} />}
    </div>
  );
}

/**
 * ***"PRUWell Medical +1"*** (P19.7-T2 AC-12; Acc. 4): the document icon and the latest proposal's first product, then how
 * many more it holds. A lead whose proposals are all still empty drafts has no name to show: the icon alone, named by
 * the count. In the neutral grey of a pill, never a status colour (the spec's fixed colours are *Draf* and *Selesai*'s).
 */
function ProposalPill({ proposals }: { proposals: NonNullable<Lead['proposals']> }) {
  const t = useMessages(leadsMessages);
  const text = productsPill(proposals.latest.products);
  return (
    <span data-proposal-pill="" className="inline-flex max-w-full items-center gap-1 rounded-pill bg-hover-row px-2 py-px text-xs font-semibold text-navy">
      <LineIcon name="document" className="h-3.5 w-3.5 shrink-0" />
      {text ? (
        <>
          <span className="sr-only">{t.list.filters.proposal}: </span>
          <span className="truncate">{text}</span>
        </>
      ) : (
        <span className="sr-only">{t.list.proposalCount({ n: proposals.count })}</span>
      )}
    </span>
  );
}
