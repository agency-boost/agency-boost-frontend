'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LeadContactButtons } from '@/components/contact-buttons';
import { PotensiBadge } from '@/components/potensi-switch';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/avatar';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { cn } from '@/lib/cn';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { nextActionState, type Lead } from '@/lib/leads';
import { proposalHref } from '@/lib/proposals';
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
 * **The lead's proposal** (P19.11-T3 AC-1, AC-2; UX-9; UXQ3): the document icon as a round link left of WhatsApp,
 * **only on a lead with a finished proposal** (`proposals.done` ≥ 1, counted by the server) — drafts never count — and it
 * opens the one saved last (`proposals.latestDone`) at its step 3, named and tipped. The server sends `proposals` on the
 * reader's own leads alone, so a downline's card never has it. WhatsApp keeps its place at the right edge either way.
 * No product chip any more (the *"PRUMapan"* pill, P19.7-T2 AC-12, went with UX-9); `proposals.latest` stays in the
 * payload. *Buat proposal* lives in the lead's sheet, under its *Proposal*.
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
  const canReadProposals = useCan('proposal:read');
  const ladder = given ?? config?.leadPipelines.find((p) => p.pipeline === lead.type)?.statuses ?? [];
  const mine = lead.ownerMembershipId === me?.membership?.membershipId;
  // The finished proposal saved last (UX-9): `null` on a lead with drafts only, with none, or somebody else's.
  const finished = canReadProposals && (lead.proposals?.done ?? 0) > 0 ? lead.proposals?.latestDone ?? null : null;
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
        <LeadPills
          lead={lead}
          ladder={ladder}
          // *Milik Rina Wijaya* on a lead that is not the reader's (P19.9-T1 AC-4): a leader's card under *Tim*.
          owner={!mine && lead.owner?.name ? t.list.ownedBy({ name: lead.owner.name }) : null}
          className="mt-1"
        />
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
      {finished && (
        <Link
          href={proposalHref(finished.id, 3)}
          aria-label={t.list.openProposalFor({ who: lead.name })}
          title={t.list.openProposal}
          data-open-proposal={finished.id}
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
 * pane's head under the NAME (UI-116). **On the card, whose lead it is** when it is not the reader's (P19.9-T1 AC-4;
 * ADR-0232): *Milik Rina Wijaya*, in grey words at the line's end — no pill, so it is never read as a status.
 *
 * **A small muted *›* between the two** (P19.11-T3 AC-3; UX-9: *Sales › Approved, not paid*), hidden from a screen
 * reader, and only where both are drawn. It travels with the stage: the two are one unit of the line, so a stage that
 * wraps takes its *›* to the next line rather than leaving it at the end of this one.
 */
export function LeadPills({ lead, ladder, owner = null, className }: {
  lead: Pick<Lead, 'type' | 'statusCode'>;
  ladder: readonly LeadStatusRow[];
  /** *Milik {nama}* (P19.9-T1 AC-4), the card's, on a lead that is not the reader's; `null` draws nothing. */
  owner?: string | null;
  className?: string;
}) {
  const t = useMessages(leadsMessages);
  const stage = ladder.find((s) => s.code === lead.statusCode)?.label ?? (lead.statusCode ? t.retired({ code: lead.statusCode }) : null);
  return (
    <div className={cn(className, 'flex flex-wrap items-center gap-1.5')}>
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
      {stage && (
        <span data-lead-stage="" className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span aria-hidden="true" data-pill-separator="" className="shrink-0 text-xs font-semibold leading-5 text-muted">›</span>
          <TonePill tone={stageTone(ladder, lead.statusCode)} className="min-w-0 max-w-full shrink truncate">{stage}</TonePill>
        </span>
      )}
      {owner && <span data-lead-owner="" className="min-w-0 max-w-full truncate text-xs font-semibold leading-5 text-muted">{owner}</span>}
    </div>
  );
}
