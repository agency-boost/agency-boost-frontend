'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { LeadCard } from '@/components/lead-card';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import type { Voice } from '@/i18n/messages/goal-words';
import { summaryMessages } from '@/i18n/messages/summary';
import { cn } from '@/lib/cn';
import type { Lead } from '@/lib/leads';
import { useCan, useSession } from '@/lib/session';
import type { Summary } from '@/lib/summary';
import { useOpenedOnce } from '@/lib/use-opened-once';

/** The lead sheet, downloaded when a lead is first opened and mounted from then on (`useOpenedOnce`; P18.11-T16). */
const LeadSheet = dynamic(() => import('@/components/lead-sheet').then((m) => m.LeadSheet), { ssr: false });

/**
 * ***Leads yang perlu perhatian Anda*** (P10-T6; **P19.11-T5**, UX-13 of the client's brief of 2026-11-09) — *Leads that
 * need her* about a coachee (`Overall.html:4115-4116`): the member's **own** open leads, **what needs attention first**.
 *
 * - **The Leads screen's own card** (`LeadCard`), so what UX-9 and UX-10 change there changes here: the avatar with the
 *   ***Potensi*** badge — the lead promised for this month, the *closes this month* signal (UXQ4's default) — the NAME,
 *   the type and stage pills and **one next-action line**: the date and note, or ***Isi tindakan*** in red where there is
 *   none. No red chips and no *Tanggal belum diatur* (UX-13): the card's own line says both.
 * - **The server's order** (AC-3): a dated next action first, the nearest on top (an overdue one nearest of all), then
 *   the leads with none, the one registered first first. Every open lead is sent; a closed one never is.
 * - **The top five** (`leads.shown`, the server's `SUMMARY.LEADS_SHOWN`; AC-2): with more, ***Lihat semua (N)*** — N
 *   every open lead — draws the rest in place, and ***Tampilkan lebih sedikit*** puts them away again, back at the
 *   section's top. Five or fewer, no control.
 * - **A tap opens the shared lead sheet** over the Summary (`LeadSheet`, the Leads screen's): editable as the reader's
 *   grants allow it — `lead:update`, as the coachee's *Leads* tab and the Calendar have it, and nothing in a read-only
 *   support session — and *Hapus* only on the reader's own lead, which the sheet decides. **A save, a close, a delete or
 *   a number saved through WhatsApp reads the Summary again** (`onChanged`), so the order and the insights follow.
 * - **About a coachee**, the card is in its not-mine form, as under *Leads milik: Tim*: *Milik {nama}*, WhatsApp, and
 *   no *Buat proposal* and no proposal pill — the server sends a coach none (decision 4).
 *
 * **The section pattern is the page's** (UI-050; `personal-summary.tsx`'s `Section`): the heading outside, 14px/700,
 * its tag on a desktop only (Appendix A); the cards on the page's surface, as `/leads` draws them. **Left out on a phone
 * while there is no open lead** (UI-055), and on a tablet too (UI-121, `hideWhenEmpty`); from 768px the empty card says
 * so, as before.
 */
export function SummaryLeads({ leads, voice, today, hideWhenEmpty = false, onChanged }: {
  leads: Summary['leads'];
  /** Who the page is about: the reader (`self`), or a coachee in their pronoun. */
  voice: Voice;
  /** The office's today, the Summary's (`summary.today`): the card's *Hari ini* and the year beside a date. */
  today: string;
  /** UI-121: a tablet draws the phone's blocks, so its empty card is left out too. */
  hideWhenEmpty?: boolean;
  /** The page reads the Summary again after a lead is saved, closed or deleted from here (AC-1). */
  onChanged?: () => void;
}) {
  const t = useMessages(summaryMessages);
  const { me } = useSession();
  // A support session that may look and not touch (§3.13): the sheet only to read, as the Calendar's and the tab's.
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const canUpdate = useCan('lead:update') && !readOnly;
  const [all, setAll] = useState(false);
  const [sheet, setSheet] = useState<Lead | null>(null);
  const sheetOpened = useOpenedOnce(sheet !== null);
  const top = useRef<HTMLElement>(null);
  const listId = useId();

  /*
   * **A leader's empty card says whose leads it counts** (P18.5-T15 AC-4, the client's UI review, UI-002). The card is
   * the reader's own leads only, while Leads Management shows a leader their unit's too, so an AB with 71 there read
   * *No active leads yet* here. A reader with none of their own whose unit holds some — `unitOpen`, the server's count
   * of what Leads Management lists them besides their own — is told where those are; anybody else keeps the
   * prototype's sentence.
   */
  const unitHasSome = voice.self && (leads.unitOpen ?? 0) > 0;
  const leadsLink = (words: string) => <Link href="/leads" className="font-semibold text-navy underline">{words}</Link>;
  const empty = leads.total === 0;
  // The server's count; without it (a reply from before P19.11) every row it sent.
  const limit = leads.shown ?? leads.rows.length;
  const toggles = leads.rows.length > limit;
  const drawn = all || !toggles ? leads.rows : leads.rows.slice(0, limit);

  return (
    <section
      ref={top}
      aria-labelledby="summary-leads"
      data-summary-leads=""
      className={cn('min-w-0 scroll-mt-4 print:break-inside-avoid', empty && (hideWhenEmpty ? 'hidden' : 'max-md:hidden'))}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="summary-leads" className="font-body text-md font-bold text-navy">{t.leads.title({ who: voice })}</h2>
        <span className="text-xs text-muted max-lg:hidden">{voice.self ? t.leads.tagOwn : t.leads.tagTheirs}</span>
      </div>
      {empty ? (
        <div className="rounded-lg border border-card-edge bg-card px-3.5 py-3">
          {voice.self ? (
            <p className="text-sm text-muted">
              {unitHasSome ? t.leads.unitHasSome({ link: leadsLink }) : t.leads.noneYet({ link: leadsLink })}
            </p>
          ) : (
            // The prototype's own empty line on a coachee's card (`Overall.html:10498`).
            <p className="text-sm text-muted">{t.leads.noneTheirs}</p>
          )}
        </div>
      ) : (
        <>
          <ul id={listId} role="list" className="flex flex-col gap-1.5">
            {drawn.map((lead) => (
              <LeadCard key={lead.id} lead={lead} today={today} onOpen={() => setSheet(lead)} onSaved={() => onChanged?.()} />
            ))}
          </ul>
          {toggles && (
            <button
              type="button"
              aria-expanded={all}
              aria-controls={listId}
              data-leads-toggle=""
              onClick={() => {
                if (all) top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
                setAll((open) => !open);
              }}
              className="mt-1.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-row bg-card text-md font-semibold text-navy-soft hover:bg-hover-row print:hidden"
            >
              {all ? t.leads.showLess : t.leads.showAll({ n: leads.total })}
              <LineIcon name={all ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" />
            </button>
          )}
        </>
      )}
      {sheetOpened && (
        <LeadSheet
          open={sheet !== null}
          lead={sheet}
          readOnly={!canUpdate}
          onClose={() => setSheet(null)}
          onSaved={() => onChanged?.()}
          onDeleted={() => onChanged?.()}
          onClosedLead={() => onChanged?.()}
        />
      )}
    </section>
  );
}
