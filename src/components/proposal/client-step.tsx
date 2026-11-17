'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { AgeStepper, GenderButtons } from '@/components/client-age-gender';
import { ErrorBanner } from '@/components/ui/field';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { proposalMessages } from '@/i18n/messages/proposal';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  createLead, LEAD_AGE_MAX, LEAD_AGE_MIN, LEAD_NAME_MIN, listLeads, readLead, setLeadStatus, type Lead, type LeadGender,
} from '@/lib/leads';
import { normalisedPhone, PHONE_NATIONAL_DIGITS } from '@/lib/phone-number';
import {
  CLIENT_NEEDS, CLIENT_STATUSES, type ClientNeed, type ProposalClient, type ProposalClientDetails, type ProposalClientInput,
} from '@/lib/proposals';
import { useSession } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useDebounced } from '@/lib/use-debounced';
import { CHIP, CHIP_OFF, CHIP_ON } from './item-panel';
import { StepHeading } from './proposal-frame';

const EMPTY_DETAILS: ProposalClientDetails = {
  status: null, dependants: null, occupation: null, city: null, needs: [], needsOther: null,
};

/** What step 1 keeps in the tab until *Lanjut* (a per-tab convenience, never the record). */
interface Held {
  leadId: string | null;
  age: string;
  gender: LeadGender | null;
  details: ProposalClientDetails;
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
    // A private window, or storage refused: the fields are only a convenience.
  }
}

const validAge = (text: string) => {
  const n = Number(text);
  return text !== '' && Number.isInteger(n) && n >= LEAD_AGE_MIN && n <= LEAD_AGE_MAX;
};

/** A blank text box is no detail: `null`, as the server stores it. */
const filled = (text: string | null) => (text && text.trim() !== '' ? text.trim() : null);

/** What *Lanjut* hands on: the lead chosen, and the client this proposal is for. */
export interface ClientChoice {
  leadId: string;
  client: Required<Pick<ProposalClientInput, 'age' | 'gender' | 'details'>>;
}

/**
 * **Step 1, *Untuk siapa?*** (P19.14-T1 AC-2 to AC-5; ADR-0254; the 11 Nov spec's *Step 1*).
 *
 * - **1a — the lead.** A search box over the reader's own Sales leads, most recent first; **with no exact match, *+ Lead
 *   baru "{teks}"* sits directly under the box**: it asks *Nama* (the text typed) and an optional *No. HP*, saves a Sales
 *   lead (`POST /leads`), moves it to the office's first Sales stage, and chooses it. A proposal started from a lead (the
 *   card's or the sheet's *Buat proposal*, `?leadId=`) has it chosen already, so the pick is skipped; *Ganti* opens it.
 * - **1b — the client, under the chosen lead, on the same screen.** *Umur ulang tahun berikutnya* (− / + and the keypad,
 *   with the helper *"Lahir Mei 1991 → sekarang 35 → isi 36"*), *Laki-laki / Perempuan*, and *+ Detail klien
 *   (opsional)*, collapsed: *Status*, *Tanggungan*, *Pekerjaan*, *Kota*, *Yang dibahas*. **None of it is written to the
 *   lead** (AC-4): *Lanjut* hands it to the proposal.
 * - **The prefill** (AC-5): a lead with an earlier proposal starts from that proposal's client, the age moved up by the
 *   server (`lead.proposals.client`); a first proposal starts empty. A stored proposal's step 1 starts from its own.
 * - ***Lanjut* needs the age and the gender**; the button says why while it waits.
 */
export function ClientStep({
  initialLeadId,
  stored = null,
  remember,
  readOnly,
  browseWhenReadOnly = false,
  onContinue,
}: {
  initialLeadId: string | null;
  /** A stored proposal's client: the fields start from it, never from the lead's prefill. */
  stored?: ProposalClient | null;
  remember: boolean;
  readOnly: boolean;
  /** A stored proposal in a view-only session: *Lanjut* still walks on to step 2, writing nothing. */
  browseWhenReadOnly?: boolean;
  onContinue: (choice: ClientChoice) => Promise<void>;
}) {
  const t = useMessages(proposalMessages);
  const words = useMessages(leadsMessages).sheet;
  const contactWords = useMessages(uiV1Messages).contact;
  const { me } = useSession();
  const { config } = useTenantConfig();
  const { show } = useToast();
  const uid = useId();
  const owner = me?.membership?.membershipId;

  const held = useMemo(() => (remember ? readHeld() : null), [remember]);
  const start = stored ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId ?? held?.leadId ?? null);
  const [picking, setPicking] = useState(!(initialLeadId ?? held?.leadId));
  const [age, setAge] = useState(start?.age != null ? String(start.age) : held?.age ?? '');
  const [gender, setGender] = useState<LeadGender | null>(start?.gender ?? held?.gender ?? null);
  const [details, setDetails] = useState<ProposalClientDetails>(start?.details ?? held?.details ?? EMPTY_DETAILS);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** The fields were set by hand, or from the stored proposal: a lead's prefill does not overwrite them. */
  const [touched, setTouched] = useState(Boolean(start) || Boolean(held?.age || held?.gender));
  const [term, setTerm] = useState('');
  const search = useDebounced(term.trim());
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [chosen, setChosen] = useState<Lead | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [working, setWorking] = useState(false);
  /** *+ Lead baru*'s two fields, open once tapped. */
  const [newLead, setNewLead] = useState<{ name: string; phone: string } | null>(null);
  const [phoneWrong, setPhoneWrong] = useState(false);

  // The reader's own Sales leads, most recent first; searched on the server.
  useEffect(() => {
    if (!owner || !picking) return;
    let live = true;
    listLeads({ owner, type: 'sales', sort: 'dateRegistered', dir: 'desc', search: search || undefined, pageSize: 50 })
      .then((page) => { if (live) setLeads(page.rows); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [owner, search, picking]);

  // The lead chosen, even when the page of leads does not hold it (`?leadId=`, or a stored proposal's).
  useEffect(() => {
    if (!selectedId) { setChosen(null); return; }
    const inList = leads?.find((l) => l.id === selectedId);
    if (inList) { setChosen(inList); return; }
    if (chosen?.id === selectedId) return;
    let live = true;
    readLead(selectedId).then((lead) => { if (live) setChosen(lead); }).catch(() => {
      if (!live) return;
      setSelectedId(null);
      setPicking(true);
    });
    return () => { live = false; };
  }, [selectedId, leads, chosen?.id]);

  // The prefill (AC-5): the lead's last proposal's client, the age moved up by the server; never over what was typed.
  useEffect(() => {
    if (!chosen || touched) return;
    const last = chosen.proposals?.client ?? null;
    setAge(last?.age != null ? String(last.age) : '');
    setGender(last?.gender ?? null);
    setDetails(last ? { ...EMPTY_DETAILS, ...last.details, needs: [...last.details.needs] } : EMPTY_DETAILS);
  }, [chosen, touched]);

  useEffect(() => {
    if (remember) writeHeld({ leadId: selectedId, age, gender, details });
  }, [remember, selectedId, age, gender, details]);

  const choose = (lead: Lead) => {
    setTouched(false);
    setChosen(lead);
    setSelectedId(lead.id);
    setPicking(false);
    setNewLead(null);
    setTerm('');
  };

  const firstSalesStage = config?.leadPipelines.find((p) => p.pipeline === 'sales')?.statuses
    .find((s) => s.status === 'active')?.code ?? null;

  /** *+ Lead baru*: a Sales lead with the name and the phone, at the first stage, then chosen. */
  const saveNewLead = async () => {
    if (!newLead || working || readOnly) return;
    const phone = newLead.phone.trim() === '' ? null : normalisedPhone(newLead.phone);
    if (newLead.phone.trim() !== '' && phone === null) { setPhoneWrong(true); return; }
    setWorking(true);
    setError(null);
    try {
      let lead = await createLead({ name: newLead.name.trim(), type: 'sales', contact: { phone, email: null } });
      if (firstSalesStage) lead = await setLeadStatus(lead.id, firstSalesStage, lead.version);
      show(t.client.leadSaved);
      choose(lead);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setWorking(false);
    }
  };

  const ready = chosen !== null && validAge(age) && gender !== null;
  const browsing = readOnly && browseWhenReadOnly && chosen !== null;
  const go = async () => {
    if (!chosen || (!browsing && (!ready || working || readOnly))) return;
    setWorking(true);
    setError(null);
    try {
      const cleaned: ProposalClientDetails = {
        status: details.status,
        dependants: filled(details.dependants),
        occupation: filled(details.occupation),
        city: filled(details.city),
        needs: CLIENT_NEEDS.filter((need) => details.needs.includes(need)),
        needsOther: details.needs.includes('OTHER') ? filled(details.needsOther) : null,
      };
      await onContinue({ leadId: chosen.id, client: { age: Number(age), gender: gender as LeadGender, details: cleaned } });
      if (remember) writeHeld(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setWorking(false);
    }
  };

  const change = (next: Partial<ProposalClientDetails>) => {
    setTouched(true);
    setDetails((current) => ({ ...current, ...next }));
  };
  const toggleNeed = (need: ClientNeed) => change({
    needs: details.needs.includes(need) ? details.needs.filter((n) => n !== need) : [...details.needs, need],
  });

  const typed = term.trim();
  const exact = typed !== '' && (leads ?? []).some((l) => l.name.trim().toLowerCase() === typed.toLowerCase());
  const waitId = `${uid}-wait`;
  const TEXT = 'h-12 w-full rounded-pill border-0 bg-hover-row px-4 text-md text-ink disabled:opacity-40';

  return (
    <div className={FLOATING_BAR_ROOM}>
      <StepHeading>{t.client.heading}</StepHeading>

      {picking && (
        <div data-lead-pick="">
          <div className="relative mb-2">
            <LineIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-signal-grey" />
            <input
              type="search"
              aria-label={t.client.searchName}
              placeholder={t.client.searchPlaceholder}
              value={term}
              disabled={readOnly}
              onChange={(e) => { setTerm(e.target.value); setNewLead(null); }}
              className="h-12 w-full rounded-pill border-0 bg-card pl-11 pr-4 text-md text-ink"
            />
          </div>
          {/* The spec: directly under the search box, never at the end of a long list. */}
          {typed !== '' && !exact && !newLead && (
            <button
              type="button"
              data-new-lead=""
              disabled={readOnly}
              onClick={() => setNewLead({ name: typed, phone: '' })}
              className="mb-2 flex min-h-12 w-full items-center rounded-lg bg-card px-4 text-left text-md font-semibold text-navy hover:bg-secondary/[0.06] disabled:opacity-40"
            >
              {t.client.newLead({ text: typed })}
            </button>
          )}
          {newLead && (
            <div data-new-lead-form="" className="mb-3 flex flex-col gap-3 rounded-lg bg-card p-4">
              <div>
                <label htmlFor={`${uid}-new-name`} className="mb-2 block text-sm font-semibold text-navy">{t.client.name}</label>
                <input
                  id={`${uid}-new-name`}
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  className={TEXT}
                />
              </div>
              <div>
                <label htmlFor={`${uid}-new-phone`} className="mb-2 block text-sm font-semibold text-navy">{t.client.phone}</label>
                <input
                  id={`${uid}-new-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  maxLength={20}
                  value={newLead.phone}
                  aria-invalid={phoneWrong || undefined}
                  aria-describedby={phoneWrong ? `${uid}-new-phone-error` : undefined}
                  onChange={(e) => { setPhoneWrong(false); setNewLead({ ...newLead, phone: e.target.value }); }}
                  className={TEXT}
                />
                {phoneWrong && <p id={`${uid}-new-phone-error`} className="mt-1 text-sm text-alert">{contactWords.invalid(PHONE_NATIONAL_DIGITS)}</p>}
              </div>
              <button
                type="button"
                className={cn(CHIP, CHIP_ON, 'self-start px-5')}
                disabled={readOnly || working || newLead.name.trim().length < LEAD_NAME_MIN}
                onClick={() => { void saveNewLead(); }}
              >
                {t.client.saveLead}
              </button>
            </div>
          )}
          {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
          {leads === null && !error && (
            <Skeleton label={t.client.loading}>
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="rounded-lg bg-card p-4"><SkeletonBar className="w-1/2" /></div>)}
              </div>
            </Skeleton>
          )}
          {leads !== null && leads.length > 0 && (
            <ul aria-label={t.client.leadsLabel} className="flex flex-col gap-2">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => choose(lead)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg border-[1.5px] border-transparent bg-card px-4 py-2 text-left hover:border-hairline disabled:cursor-not-allowed"
                  >
                    <span className="min-w-0 flex-1 truncate text-md font-semibold text-ink">{lead.name}</span>
                    <LineIcon name="chevronRight" className="h-4 w-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!picking && chosen && (
        <div data-chosen-lead={chosen.id} className="mb-3 flex min-h-14 items-center gap-3 rounded-lg border-[1.5px] border-secondary bg-card px-4 py-2">
          <LineIcon name="check" className="h-5 w-5 shrink-0 text-navy" />
          <span className="min-w-0 flex-1">
            <span className="sr-only">{t.client.chosen}: </span>
            <span className="block truncate text-md font-bold text-ink">{chosen.name}</span>
          </span>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => { setPicking(true); setLeads(null); }}
            className="min-h-12 shrink-0 rounded-pill px-3 text-md font-semibold text-navy hover:bg-secondary/[0.06] disabled:opacity-40"
          >
            {t.client.change}
          </button>
        </div>
      )}
      {!picking && !chosen && (
        <Skeleton label={t.client.loading}><div className="mb-3 rounded-lg bg-card p-4"><SkeletonBar className="w-1/2" /></div></Skeleton>
      )}

      {!picking && chosen && (
        <section data-client-box="" aria-labelledby={`${uid}-client`} className="flex flex-col gap-4 rounded-lg bg-card p-4">
          <h3 id={`${uid}-client`} className="text-md font-bold text-navy">{t.client.clientHeading}</h3>
          <div>
            <label id={`${uid}-age-label`} htmlFor={`${uid}-age`} className="mb-1 block text-sm font-semibold text-navy">{words.age}</label>
            <p id={`${uid}-age-help`} className="mb-2 text-sm text-muted">{t.client.ageHelp}</p>
            <AgeStepper
              id={`${uid}-age`}
              value={age}
              onChange={(next) => { setTouched(true); setAge(next); }}
              disabled={readOnly}
              describedBy={`${uid}-age-help`}
            />
          </div>
          <div>
            <p id={`${uid}-gender-label`} className="mb-2 text-sm font-semibold text-navy">{words.gender}</p>
            <GenderButtons
              labelledBy={`${uid}-gender-label`}
              value={gender}
              onChange={(next) => { setTouched(true); setGender(next); }}
              disabled={readOnly}
            />
          </div>

          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={`${uid}-details`}
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="-ml-1 min-h-12 w-fit rounded-pill px-1 text-left text-md font-semibold text-navy hover:text-primary-ink"
          >
            {detailsOpen ? t.client.detailsClose : t.client.detailsOpen}
          </button>
          {detailsOpen && (
            <div id={`${uid}-details`} data-client-details="" className="flex flex-col gap-4">
              <div>
                <p id={`${uid}-status`} className="mb-2 text-sm font-semibold text-navy">{t.client.status}</p>
                <div role="group" aria-labelledby={`${uid}-status`} className="flex flex-wrap gap-2">
                  {CLIENT_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={details.status === status}
                      disabled={readOnly}
                      onClick={() => change({ status: details.status === status ? null : status })}
                      className={cn(CHIP, details.status === status ? CHIP_ON : CHIP_OFF)}
                    >
                      {t.client.statuses[status]}
                    </button>
                  ))}
                </div>
              </div>
              {([
                ['dependants', t.client.dependants, t.client.dependantsHint, 80],
                ['occupation', t.client.occupation, undefined, 60],
                ['city', t.client.city, undefined, 60],
              ] as const).map(([key, label, hint, max]) => (
                <div key={key}>
                  <label htmlFor={`${uid}-${key}`} className="mb-2 block text-sm font-semibold text-navy">{label}</label>
                  <input
                    id={`${uid}-${key}`}
                    type="text"
                    autoComplete="off"
                    maxLength={max}
                    placeholder={hint}
                    disabled={readOnly}
                    value={details[key] ?? ''}
                    onChange={(e) => change({ [key]: e.target.value })}
                    className={TEXT}
                  />
                </div>
              ))}
              <div>
                <p id={`${uid}-needs`} className="mb-2 text-sm font-semibold text-navy">{t.client.needs}</p>
                <div role="group" aria-labelledby={`${uid}-needs`} className="flex flex-wrap gap-2">
                  {CLIENT_NEEDS.map((need) => (
                    <button
                      key={need}
                      type="button"
                      aria-pressed={details.needs.includes(need)}
                      disabled={readOnly}
                      onClick={() => toggleNeed(need)}
                      className={cn(CHIP, details.needs.includes(need) ? CHIP_ON : CHIP_OFF)}
                    >
                      {t.client.needOptions[need]}
                    </button>
                  ))}
                </div>
                {details.needs.includes('OTHER') && (
                  <input
                    type="text"
                    aria-label={t.client.needsOther}
                    placeholder={t.client.needsOther}
                    autoComplete="off"
                    maxLength={80}
                    disabled={readOnly}
                    value={details.needsOther ?? ''}
                    onChange={(e) => change({ needsOther: e.target.value })}
                    className={cn(TEXT, 'mt-2')}
                  />
                )}
              </div>
            </div>
          )}
          {error && <ErrorBanner {...error} />}
        </section>
      )}

      <FloatingBar wide="pill" pillClassName="justify-end">
        <button
          type="button"
          className={cn(FLOATING_BAR_BUTTON, 'min-h-12 flex-1')}
          disabled={browsing ? false : !ready || working || readOnly}
          aria-describedby={!ready && !browsing ? waitId : undefined}
          onClick={() => { void go(); }}
        >
          {t.next}
        </button>
        {!ready && !browsing && <span id={waitId} className="sr-only">{t.client.needsAgeGender}</span>}
      </FloatingBar>
    </div>
  );
}
