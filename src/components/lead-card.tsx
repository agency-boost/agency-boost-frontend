'use client';

import { LeadContactButtons } from '@/components/contact-buttons';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/person-row';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { cn } from '@/lib/cn';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { nextActionState, type Lead } from '@/lib/leads';
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
 * One lead, compact (UI-105): the avatar, the NAME in capitals, the type and stage pills, one next-action line, and
 * WhatsApp alone. **The name is the card's button**, stretched over the whole card, so a tap anywhere but WhatsApp opens
 * the sheet and a screen reader meets one control named for the lead; WhatsApp sits above it, its own target.
 */
export function LeadCard({
  lead, ladder: given, today = dayInZone(OFFICE_TIME_ZONE, new Date()), onOpen, onSaved,
}: {
  lead: Lead;
  /** The lead's own ladder; the office's, from the published configuration, where none is given. */
  ladder?: readonly LeadStatusRow[];
  /** The office's today (`dayInZone`), for *Hari ini*. */
  today?: string;
  onOpen: () => void;
  /** A number saved through WhatsApp's *Isi nomor WhatsApp* (UI-081): the lead as the server now has it. */
  onSaved: (lead: Lead) => void;
}) {
  const t = useMessages(leadsMessages);
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const ladder = given ?? config?.leadPipelines.find((p) => p.pipeline === lead.type)?.statuses ?? [];
  const state = nextActionState(lead, today);
  const stage = ladder.find((s) => s.code === lead.statusCode)?.label ?? (lead.statusCode ? t.retired({ code: lead.statusCode }) : null);
  const late = state === 'overdue';
  const day = lead.nextActionDate
    ? state === 'today' ? t.list.nextActionToday
      : formatShortDay(lead.nextActionDate, { year: lead.nextActionDate.slice(0, 4) !== today.slice(0, 4) }, figures)
    : null;

  return (
    <li data-lead-card={lead.id} className="relative flex items-center gap-2.5 rounded-row bg-card px-3 py-2.5 hover:bg-hover-row">
      <Avatar name={lead.name} seed={lead.id} size={36} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="block w-full truncate text-left text-md font-bold uppercase text-ink after:absolute after:inset-0 after:rounded-row after:content-['']"
        >
          {lead.name}
        </button>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {lead.type ? (
            <span
              className={cn(
                'inline-flex items-center rounded-pill px-2 py-px text-xs font-semibold',
                lead.type === 'sales' ? 'bg-amber/[0.12] text-amber-ink' : 'bg-lavender/20 text-navy',
              )}
            >
              {t.types[lead.type]}
            </span>
          ) : (
            <TonePill tone="grey">{t.noType}</TonePill>
          )}
          {stage && <TonePill tone={stageTone(ladder, lead.statusCode)} className="max-w-full truncate">{stage}</TonePill>}
        </div>
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
      <LeadContactButtons lead={lead} channels={['whatsapp']} size={36} onSaved={onSaved} />
    </li>
  );
}
