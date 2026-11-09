'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { AgeStepper, GenderButtons } from '@/components/client-age-gender';
import { ErrorBanner } from '@/components/ui/field';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonBar, Skeleton } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { proposalMessages } from '@/i18n/messages/proposal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  createLead, LEAD_AGE_MAX, LEAD_AGE_MIN, LEAD_NAME_MIN, listLeads, readLead, updateLead, type Lead, type LeadGender,
} from '@/lib/leads';
import { useDebounced } from '@/lib/use-debounced';
import { useSession } from '@/lib/session';
import { StepHeading } from './proposal-frame';

/** What step 1 keeps in the tab until *Lanjut* (ADR-0221 §3: a per-tab convenience, never the record). */
interface Held {
  mode: 'lead' | 'new';
  leadId: string | null;
  name: string;
  age: string;
  gender: LeadGender | null;
}

const HELD_KEY = 'ab.proposal.step1';

function readHeld(): Partial<Held> | null {
  try {
    const raw = window.sessionStorage.getItem(HELD_KEY);
    return raw ? (JSON.parse(raw) as Partial<Held>) : null;
  } catch {
    return null;
  }
}

function writeHeld(held: Held | null): void {
  try {
    if (held) window.sessionStorage.setItem(HELD_KEY, JSON.stringify(held));
    else window.sessionStorage.removeItem(HELD_KEY);
  } catch {
    // A private window, or storage refused: the three fields are only a convenience.
  }
}

const lacks = (lead: Lead) => lead.age === null || lead.age === undefined || lead.gender === null || lead.gender === undefined;
const validAge = (text: string) => {
  const n = Number(text);
  return text !== '' && Number.isInteger(n) && n >= LEAD_AGE_MIN && n <= LEAD_AGE_MAX;
};

/**
 * **Step 1, *Untuk siapa?*** (AC-3, AC-4; Acc. 2, Acc. 3, Acc. 6; ADR-0221 §3, ADR-0224).
 *
 * - **The reader's own Sales leads**, newest first, with a search box (`GET /leads?owner={self}&type=sales`). A lead with
 *   no age or no gender carries the amber ***Umur belum ada*** (a fixed status colour). Picking one opens a card under the
 *   list, on the same screen, with the stepper and the two buttons; *Lanjut* saves both to the lead — *"Umur tersimpan
 *   di lead"* — so the next proposal does not ask.
 * - ***Klien baru*** asks three fields only: *Nama*, *Umur ulang tahun berikutnya* (− / +, the keypad, no slider) and
 *   *Laki-laki / Perempuan*. *Lanjut* saves it as a Sales lead first. With no Sales lead at all it is already open.
 * - **Nothing is stored until *Lanjut*** on `/proposal/new`: the three fields live in the tab (`remember`).
 */
export function ClientStep({
  initialLeadId,
  remember,
  readOnly,
  browseWhenReadOnly = false,
  onContinue,
}: {
  initialLeadId: string | null;
  remember: boolean;
  readOnly: boolean;
  /** A stored proposal in a view-only session: *Lanjut* still walks on to step 2, writing nothing (Acc. 22). */
  browseWhenReadOnly?: boolean;
  onContinue: (lead: { id: string; age: number }) => Promise<void>;
}) {
  const t = useMessages(proposalMessages);
  const words = useMessages(leadsMessages).sheet;
  const { me } = useSession();
  const { show } = useToast();
  const uid = useId();
  const owner = me?.membership?.membershipId;

  const held = useMemo(() => (remember ? readHeld() : null), [remember]);
  const [mode, setMode] = useState<'lead' | 'new'>(held?.mode ?? 'lead');
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId ?? held?.leadId ?? null);
  const [name, setName] = useState(held?.name ?? '');
  const [age, setAge] = useState(held?.age ?? '');
  const [gender, setGender] = useState<LeadGender | null>(held?.gender ?? null);
  const [term, setTerm] = useState('');
  const search = useDebounced(term.trim());
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [chosen, setChosen] = useState<Lead | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [working, setWorking] = useState(false);

  // The reader's own Sales leads, newest first; searched on the server.
  useEffect(() => {
    if (!owner) return;
    let live = true;
    listLeads({ owner, type: 'sales', sort: 'dateRegistered', dir: 'desc', search: search || undefined, pageSize: 50 })
      .then((page) => {
        if (!live) return;
        setLeads(page.rows);
        // Nobody to pick, and nothing searched: *Klien baru* is already open (`functional/proposal.md`, *States*).
        if (page.rows.length === 0 && !search && !held?.mode) setMode('new');
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [owner, search, held]);

  // The lead chosen, even when the page of leads does not hold it (`?leadId=` of an older lead).
  useEffect(() => {
    if (!selectedId) { setChosen(null); return; }
    // Once the list has answered: most of the time it holds the lead, and a read before it would be one too many.
    if (leads === null) return;
    const inList = leads.find((l) => l.id === selectedId);
    if (inList) { setChosen(inList); return; }
    if (chosen?.id === selectedId) return;
    let live = true;
    readLead(selectedId).then((lead) => { if (live) setChosen(lead); }).catch(() => { if (live) setSelectedId(null); });
    return () => { live = false; };
  }, [selectedId, leads, chosen?.id]);

  // The card's two fields start from what the lead already has.
  useEffect(() => {
    if (!chosen || mode !== 'lead' || !lacks(chosen)) return;
    setAge((current) => current || (chosen.age ? String(chosen.age) : ''));
    setGender((current) => current ?? chosen.gender ?? null);
  }, [chosen, mode]);

  useEffect(() => {
    if (remember) writeHeld({ mode, leadId: selectedId, name, age, gender });
  }, [remember, mode, selectedId, name, age, gender]);

  const lacking = mode === 'lead' && chosen !== null && lacks(chosen);
  const ready = mode === 'new'
    ? name.trim().length >= LEAD_NAME_MIN && validAge(age) && gender !== null
    : chosen !== null && (!lacking || (validAge(age) && gender !== null));

  const browsing = readOnly && browseWhenReadOnly && mode === 'lead' && chosen !== null;
  const go = async () => {
    if (browsing) { await onContinue({ id: chosen!.id, age: chosen!.age ?? 0 }); return; }
    if (!ready || working || readOnly) return;
    setWorking(true);
    setError(null);
    try {
      let lead: Lead;
      if (mode === 'new') {
        lead = await createLead({ name: name.trim(), type: 'sales', age: Number(age), gender });
      } else if (lacking) {
        lead = await updateLead(chosen!.id, { age: Number(age), gender }, chosen!.version);
        show(t.client.ageSaved);
      } else {
        lead = chosen!;
      }
      await onContinue({ id: lead.id, age: lead.age ?? Number(age) });
      if (remember) writeHeld(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setWorking(false);
    }
  };

  // The lead chosen by `?leadId=` stays in view, first, when the page of leads does not hold it.
  const shown = leads === null ? [] : chosen && !search && !leads.some((l) => l.id === chosen.id) ? [chosen, ...leads] : leads;
  return (
    <div className={FLOATING_BAR_ROOM}>
      <StepHeading>{t.client.heading}</StepHeading>

      <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label={t.client.heading}>
        {(['lead', 'new'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={readOnly}
            onClick={() => setMode(m)}
            className={cn(
              'flex min-h-12 items-center justify-center gap-1.5 rounded-pill px-4 text-md font-semibold disabled:opacity-40',
              mode === m ? 'bg-secondary text-secondary-contrast' : 'bg-card text-navy hover:bg-secondary/[0.06]',
            )}
          >
            {m === 'new' && <LineIcon name="plus" className="h-4 w-4" />}
            {m === 'new' ? t.client.newClient : t.client.fromLeads}
          </button>
        ))}
      </div>

      {mode === 'lead' && (
        <>
          <div className="relative mb-3">
            <LineIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-signal-grey" />
            <input
              type="search"
              aria-label={t.client.searchName}
              placeholder={t.client.searchPlaceholder}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="h-12 w-full rounded-pill border-0 bg-card pl-11 pr-4 text-md text-ink"
            />
          </div>
          {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
          {leads === null && !error && (
            <Skeleton label={t.client.loading}>
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="rounded-lg bg-card p-4"><SkeletonBar className="w-1/2" /></div>)}
              </div>
            </Skeleton>
          )}
          {leads !== null && shown.length === 0 && search && (
            <p className="px-1 py-6 text-center text-md text-muted">{t.client.noLeadMatch({ term: search })}</p>
          )}
          {shown.length > 0 && (
            <div role="radiogroup" aria-label={t.client.leadsLabel} className="flex flex-col gap-2">
              {shown.map((lead) => {
                const on = lead.id === selectedId;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={readOnly}
                    onClick={() => { setSelectedId(lead.id); setAge(''); setGender(null); }}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-lg border-[1.5px] bg-card px-4 py-2 text-left disabled:cursor-not-allowed',
                      on ? 'border-secondary' : 'border-transparent hover:border-hairline',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-md font-semibold text-ink">{lead.name}</span>
                    {lacks(lead) && <TonePill tone="amber">{t.client.ageMissing}</TonePill>}
                  </button>
                );
              })}
            </div>
          )}
          {lacking && (
            <div data-missing-card="" className="mt-3 flex flex-col gap-3 rounded-lg bg-card p-4">
              <p className="text-md text-ink">{t.client.missingCard}</p>
              <div>
                <label id={`${uid}-age-label`} htmlFor={`${uid}-age`} className="mb-2 block text-sm font-semibold text-navy">{words.age}</label>
                <AgeStepper id={`${uid}-age`} value={age} onChange={setAge} disabled={readOnly} />
              </div>
              <div>
                <p id={`${uid}-gender-label`} className="mb-2 text-sm font-semibold text-navy">{words.gender}</p>
                <GenderButtons labelledBy={`${uid}-gender-label`} value={gender} onChange={setGender} disabled={readOnly} />
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'new' && (
        <div data-new-client="" className="flex flex-col gap-4 rounded-lg bg-card p-4">
          <div>
            <label htmlFor={`${uid}-name`} className="mb-2 block text-sm font-semibold text-navy">{t.client.name}</label>
            <input
              id={`${uid}-name`}
              type="text"
              autoComplete="off"
              maxLength={120}
              value={name}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
              className="h-12 w-full rounded-pill border-0 bg-hover-row px-4 text-md text-ink disabled:opacity-40"
            />
          </div>
          <div>
            <label id={`${uid}-age-label`} htmlFor={`${uid}-age`} className="mb-2 block text-sm font-semibold text-navy">{words.age}</label>
            <AgeStepper id={`${uid}-age`} value={age} onChange={setAge} disabled={readOnly} />
          </div>
          <div>
            <p id={`${uid}-gender-label`} className="mb-2 text-sm font-semibold text-navy">{words.gender}</p>
            <GenderButtons labelledBy={`${uid}-gender-label`} value={gender} onChange={setGender} disabled={readOnly} />
          </div>
          {error && <ErrorBanner {...error} />}
        </div>
      )}

      <FloatingBar wide="pill" pillClassName="justify-end">
        <button type="button" className={cn(FLOATING_BAR_BUTTON, 'min-h-12 flex-1')} disabled={browsing ? false : !ready || working || readOnly} onClick={() => { void go(); }}>
          {t.next}
        </button>
      </FloatingBar>
    </div>
  );
}
