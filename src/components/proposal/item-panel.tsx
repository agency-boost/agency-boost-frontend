'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatMoneyInFull, formatRupiahCompact } from '@/lib/format';
import { LEAD_AGE_MAX, LEAD_AGE_MIN, type LeadGender } from '@/lib/leads';
import {
  fieldLabel, firstNameOf, INSURED_RELATIONS, PROPOSAL_RECALC_MS, type CatalogProduct, type InsuredRelation,
  type PayFrequency, type PayTermView, type Proposal, type ProposalCurrency, type ProposalFieldView, type ProposalItem,
  type ProposalItemPatch,
} from '@/lib/proposals';
import { CategoryIcon } from './proposal-frame';
import { MoneyInput, TYPED_SAVE_MS } from './money-input';
import { FaqSheet, PlanSheet } from './product-sheets';

/** One-tap choices: the selection colour on the chosen one, 48px targets, pills (FINAL V1). */
export const CHIP = 'min-h-12 rounded-pill px-4 text-md font-semibold disabled:cursor-not-allowed disabled:opacity-40';
export const CHIP_ON = 'bg-secondary text-secondary-contrast';
export const CHIP_OFF = 'bg-hover-row text-navy hover:bg-secondary/[0.08]';

/** A small heading inside the card. */
const LABEL = 'mb-2 block text-sm font-semibold text-navy';

/** The age the item's pay terms are held to: the client's for *Klien*, else the insured's (ADR-0255 §2). */
const insuredAge = (proposal: Proposal, item: ProposalItem) =>
  (item.insured.relation === 'client' ? proposal.client.age : item.insured.age);

const allowed = (term: PayTermView, age: number | null) => term.maxEntryAge === null || age === null || age <= term.maxEntryAge;

/** **Does the card calculate?** A premium table is in force for it (P19.15-T1; the server says so, `calc.mode`). */
export const calculates = (item: ProposalItem) => item.calc?.mode === 'table';

/** The goal's field: the product's first `money` field (P19.15-T1, ADR-0258 §5). */
const goalKeyOf = (item: ProposalItem) => item.snapshot.fields.find((f) => f.type === 'money')?.key ?? null;

/** A limit's or a chip's amount: *Rp 100 Jt* where that says it exactly, else in full; USD in full. */
function moneyWords(minor: number, currency: ProposalCurrency, figures: ReturnType<typeof useFigureLanguage>): string {
  return currency === 'IDR' ? formatRupiahCompact(minor, { lossless: true }, figures) : formatMoneyInFull(minor, currency, figures);
}

/**
 * **A product's card** (P19.14-T2 AC-3, AC-4; ADR-0255 §2–§4; the 11 Nov spec's *Each product card, top to bottom*),
 * drawn from the item's own snapshot, which never changes after it was added, so an old proposal reads as it was made.
 *
 * 1. The category label and the product's name, ✕ to remove.
 * 2. ***Tertanggung*** — *Peserta* on a syariah product — *{the client's first name} · Pasangan · Anak · Orang lain*, the
 *    product's default chosen by the server (*Anak* for education). Anyone but the client asks a name, an age and *L / P*
 *    on one row; that age decides the pay terms.
 * 3. **The product's own fields**, preselected: chips, money with its quick amounts, a fixed sentence, and a derived
 *    value as text marked *otomatis*.
 * 4. ***Masa bayar*** — a term the insured's age does not allow is crossed out; when the server moved the chosen one
 *    (the age changed), one line says so. ***Merokok?*** only on a smoker-rated product.
 * 5. ***Cara bayar***: only the product's own frequencies; *Sekali bayar* as text.
 * 6. **The amounts**: on an `up_premium` product the sum assured and the premium side by side, else the premium — typed
 *    by the agent while every product is `manual`, with *"Lihat di ilustrasi resmi"*, and *"Total dibayar selama N
 *    tahun"* under it. A syariah product reads *Kontribusi* and *Santunan asuransi*.
 *
 * Then *"Bisa ditambah: …"*, *Lihat semua plan* and *Tanya-jawab*, from the catalogue's read, for the agent only.
 */
export function ItemPanel({
  proposal,
  item,
  offered,
  readOnly,
  onPatch,
  onRemove,
  removable = true,
}: {
  proposal: Proposal;
  item: ProposalItem;
  /** The product as the catalogue offers it now, for its riders, plans and FAQ; `null` when it is no longer offered. */
  offered: CatalogProduct | null;
  readOnly: boolean;
  onPatch: (body: ProposalItemPatch) => void;
  onRemove: () => void;
  /** *Uji coba* (P19.15-T1 AC-7) draws the card with nothing to remove it from. */
  removable?: boolean;
}) {
  const t = useMessages(proposalMessages);
  const figures = useFigureLanguage();
  const uid = useId();
  const [sheet, setSheet] = useState<'plans' | 'faq' | null>(null);
  const syariah = item.snapshot.isSyariah;
  const planField = item.snapshot.fields.find((f) => f.plan && (f.type === 'chips' || f.type === 'derived')) ?? null;
  const plans = offered?.plans ?? [];
  const faq = offered?.faq ?? [];
  const riders = offered?.riders ?? [];
  const premiumLabel = (syariah ? t.panel.contributionPer : t.panel.premiumPer)[item.payFrequency];
  const headingId = `${uid}-name`;
  const showsUp = item.snapshot.calcType === 'up_premium';
  // P19.15-T1 AC-5 (ADR-0258 §5): a card with a premium table in force calculates on the server, ~300 ms after a figure.
  const calculating = calculates(item);
  const saveAfter = calculating ? PROPOSAL_RECALC_MS : TYPED_SAVE_MS;
  const premiumTyped = !calculating || item.snapshot.calcType === 'up_premium' || item.snapshot.calcType === 'premium_benefit';
  const calcMessage = calculating && (item.calc?.state !== 'ok' || item.calc?.limit !== null || item.calcNote !== null);

  return (
    <section data-proposal-item={item.productCode} aria-labelledby={headingId} className="overflow-hidden rounded-lg bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <CategoryIcon category={item.snapshot.category} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{item.snapshot.typeLabel}</span>
          <h3 id={headingId} className="truncate text-md font-bold text-ink">{item.name}{item.plan ? ` · ${item.plan}` : ''}</h3>
        </div>
        {removable && <button
          type="button"
          disabled={readOnly}
          aria-label={t.panel.remove({ product: item.name })}
          onClick={onRemove}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted hover:bg-alert/5 hover:text-alert disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LineIcon name="close" className="h-5 w-5" />
        </button>}
      </div>

      <div className="flex flex-col gap-4 border-t border-divider px-4 pb-4 pt-3">
        <Insured proposal={proposal} item={item} readOnly={readOnly} onPatch={onPatch} />

        {item.snapshot.fields.map((field) => (
          <FieldRow key={field.key} field={field} item={item} label={fieldLabel(field, syariah)} readOnly={readOnly} onPatch={onPatch} />
        ))}

        <PayTerm proposal={proposal} item={item} readOnly={readOnly} onPatch={onPatch} />

        {item.snapshot.smokerRated && (
          <div data-smoker="">
            <p id={`${uid}-smoker`} className={LABEL}>{t.panel.smoker}</p>
            <div role="group" aria-labelledby={`${uid}-smoker`} className="flex flex-wrap gap-2">
              {([false, true] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={item.smoker === value}
                  disabled={readOnly}
                  onClick={() => { if (item.smoker !== value) onPatch({ smoker: value }); }}
                  className={cn(CHIP, item.smoker === value ? CHIP_ON : CHIP_OFF)}
                >
                  {value ? t.panel.smokerOptions.yes : t.panel.smokerOptions.no}
                </button>
              ))}
            </div>
          </div>
        )}

        <CaraBayar item={item} readOnly={readOnly} onPatch={onPatch} />

        <div data-amounts="" className={cn('grid gap-3', showsUp && 'grid-cols-2')}>
          {showsUp && (
            <div data-up="" data-fixed={calculating && item.fixedField === 'up' ? '' : undefined} className="min-w-0">
              <label id={`${uid}-up-label`} htmlFor={`${uid}-up`} className={LABEL}>{syariah ? t.panel.upSyariah : t.panel.up}</label>
              <MoneyInput
                id={`${uid}-up`}
                labelledBy={`${uid}-up-label`}
                currency={item.currency}
                valueMinor={item.up?.amountMinor ?? null}
                disabled={readOnly}
                saveAfterMs={saveAfter}
                fixed={calculating && item.fixedField === 'up'}
                describedBy={calcMessage ? `${uid}-calc` : undefined}
                onCommit={(amountMinor) => onPatch({ up: { amountMinor } })}
              />
            </div>
          )}
          <div data-premium="" data-fixed={calculating && item.fixedField === 'premium' ? '' : undefined} className="min-w-0">
            <label id={`${uid}-premium-label`} htmlFor={`${uid}-premium`} className={LABEL}>{premiumLabel}</label>
            {premiumTyped ? (
              <MoneyInput
                id={`${uid}-premium`}
                labelledBy={`${uid}-premium-label`}
                currency={item.currency}
                valueMinor={item.premium?.amountMinor ?? null}
                disabled={readOnly}
                saveAfterMs={saveAfter}
                fixed={calculating && item.fixedField === 'premium'}
                describedBy={calcMessage ? `${uid}-calc` : undefined}
                onCommit={(amountMinor) => onPatch({ premium: { amountMinor } })}
              />
            ) : (
              // P19.15-T1: the premium a goal or a plan gives — the table's, never typed.
              <p id={`${uid}-premium`} aria-labelledby={`${uid}-premium-label`} className="flex h-12 items-center text-lg font-bold text-ink">
                {item.premium ? formatMoneyInFull(item.premium.amountMinor, item.premium.currency, figures) : '–'}
              </p>
            )}
          </div>
        </div>
        <div className="-mt-2">
          {calculating ? (
            <CalcLines item={item} id={`${uid}-calc`} age={insuredAge(proposal, item)} readOnly={readOnly} onPatch={onPatch} />
          ) : (
            <>
              {item.calcNote === 'table_off' && <p role="status" data-calc-note="table_off" className="mb-1 text-sm text-alert">{t.panel.calc.tableOff}</p>}
              <p className="text-sm text-muted">{t.panel.premiumHint}</p>
            </>
          )}
          {item.totalPaid && (
            <p data-total-paid="" className="mt-2 text-md font-semibold text-navy">
              {t.panel.totalPaid({ years: item.totalPaid.years, amount: formatMoneyInFull(item.totalPaid.amountMinor, item.currency, figures) })}
            </p>
          )}
        </div>

        {riders.length > 0 && (
          <p className="text-sm text-muted">
            <span className="font-semibold text-navy">{t.panel.canBeAdded}</span> {riders.map((r) => r.name).join(', ')}
          </p>
        )}

        {(planField && plans.length > 0) || faq.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {planField && plans.length > 0 && (
              <button type="button" onClick={() => setSheet('plans')} className={cn(CHIP, 'border border-hairline bg-card text-navy')}>
                {t.panel.seePlans}
              </button>
            )}
            {faq.length > 0 && (
              <button type="button" onClick={() => setSheet('faq')} className={cn(CHIP, 'border border-hairline bg-card text-navy')}>
                {t.panel.faq}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {planField && (
        <PlanSheet
          open={sheet === 'plans'}
          product={item.name}
          plans={plans}
          syariah={syariah}
          chosen={typeof item.fieldValues[planField.key] === 'string' ? String(item.fieldValues[planField.key]) : null}
          // A derived plan is compared, never chosen: the rule picks it from the other fields.
          readOnly={readOnly || planField.type === 'derived'}
          onChoose={(name) => {
            setSheet(null);
            onPatch({ fieldValues: { [planField.key]: name } });
          }}
          onClose={() => setSheet(null)}
        />
      )}
      <FaqSheet open={sheet === 'faq'} product={item.name} faq={faq} onClose={() => setSheet(null)} />
    </section>
  );
}

/**
 * ***Tertanggung* / *Peserta*** (P19.14-T2 AC-3): the client by their first name, *Pasangan*, *Anak*, *Orang lain* — and
 * for anyone but the client, a name, an age and *L / P* on one row.
 */
function Insured({ proposal, item, readOnly, onPatch }: {
  proposal: Proposal; item: ProposalItem; readOnly: boolean; onPatch: (body: ProposalItemPatch) => void;
}) {
  const t = useMessages(proposalMessages).panel;
  const sheetWords = useMessages(leadsMessages).sheet;
  const uid = useId();
  const relation = item.insured.relation;
  const [name, setName] = useState(item.insured.name ?? '');
  const [age, setAge] = useState(item.insured.age === null ? '' : String(item.insured.age));
  const typing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typing.current) return;
    setName(item.insured.name ?? '');
    setAge(item.insured.age === null ? '' : String(item.insured.age));
  }, [item.insured.name, item.insured.age]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const ageNumber = age === '' ? null : Number(age);
  const ageOut = ageNumber !== null && !(ageNumber >= LEAD_AGE_MIN && ageNumber <= LEAD_AGE_MAX);

  const send = (nextName: string, nextAge: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const n = nextAge === '' ? null : Number(nextAge);
    if (n !== null && !(n >= LEAD_AGE_MIN && n <= LEAD_AGE_MAX)) return;
    const trimmed = nextName.trim();
    if (trimmed === (item.insured.name ?? '') && n === item.insured.age) return;
    onPatch({ insured: { relation, name: trimmed === '' ? null : trimmed, age: n } });
  };
  const later = (nextName: string, nextAge: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => send(nextName, nextAge), TYPED_SAVE_MS);
  };
  const chipName = (r: InsuredRelation) => (r === 'client' ? firstNameOf(proposal.client.name) : t.relations[r]);
  const genders: LeadGender[] = ['male', 'female'];

  return (
    <div data-insured="">
      <p id={`${uid}-label`} className={LABEL}>{item.snapshot.isSyariah ? t.insuredSyariah : t.insured}</p>
      <div role="group" aria-labelledby={`${uid}-label`} className="flex flex-wrap gap-2">
        {INSURED_RELATIONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={relation === r}
            disabled={readOnly}
            onClick={() => { if (r !== relation) onPatch({ insured: { relation: r } }); }}
            className={cn(CHIP, relation === r ? CHIP_ON : CHIP_OFF)}
          >
            {chipName(r)}
          </button>
        ))}
      </div>
      {relation !== 'client' && (
        <div data-insured-row="" className="mt-2 flex items-start gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t.insuredName}</span>
            <input
              type="text"
              value={name}
              maxLength={120}
              disabled={readOnly}
              placeholder={t.insuredName}
              autoComplete="off"
              onFocus={() => { typing.current = true; }}
              onChange={(e) => { setName(e.target.value); later(e.target.value, age); }}
              onBlur={() => { typing.current = false; send(name, age); }}
              className="h-12 w-full rounded-pill border-0 bg-hover-row px-4 text-md text-ink disabled:opacity-40"
            />
          </label>
          <label className="w-16 shrink-0">
            <span className="sr-only">{t.insuredAge}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={age}
              disabled={readOnly}
              placeholder={t.insuredAge}
              aria-invalid={ageOut || undefined}
              autoComplete="off"
              onFocus={() => { typing.current = true; }}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setAge(digits);
                later(name, digits);
              }}
              onBlur={() => { typing.current = false; send(name, age); }}
              className="h-12 w-full rounded-pill border-0 bg-hover-row px-2 text-center text-md font-bold text-ink disabled:opacity-40"
            />
          </label>
          <div role="radiogroup" aria-label={sheetWords.gender} className="flex shrink-0 gap-1">
            {genders.map((gender) => {
              const on = item.insured.gender === gender;
              return (
                <button
                  key={gender}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={sheetWords.genders[gender]}
                  title={sheetWords.genders[gender]}
                  disabled={readOnly}
                  onClick={() => onPatch({ insured: { relation, gender: on ? null : gender } })}
                  className={cn('h-12 w-12 rounded-pill text-md font-bold disabled:opacity-40', on ? CHIP_ON : CHIP_OFF)}
                >
                  {/* The word's first letter, *L / P* (*M / F*): the one row's room; the whole word is its name. */}
                  {sheetWords.genders[gender].charAt(0)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {relation !== 'client' && ageOut && (
        <p className="mt-1 text-sm text-alert">{sheetWords.ageOutOfRange({ min: LEAD_AGE_MIN, max: LEAD_AGE_MAX })}</p>
      )}
    </div>
  );
}

/**
 * ***Masa bayar*** (P19.14-T2 AC-4): one term is a sentence; several are chips, a term the insured's age does not allow
 * crossed out and disabled, its reason in its accessible name. **When the server moved the chosen term** — the age
 * changed past its limit — one line says from which to which, until the next change.
 */
function PayTerm({ proposal, item, readOnly, onPatch }: {
  proposal: Proposal; item: ProposalItem; readOnly: boolean; onPatch: (body: ProposalItemPatch) => void;
}) {
  const t = useMessages(proposalMessages).panel;
  const uid = useId();
  const terms = item.snapshot.payTerms;
  const age = insuredAge(proposal, item);
  const chosenByHand = useRef<string | null>(null);
  const previous = useRef<{ term: string | null; age: number | null }>({ term: item.payTerm, age });
  const [moved, setMoved] = useState<{ from: string; to: string | null; age: number } | null>(null);

  useEffect(() => {
    const before = previous.current;
    if (before.term !== item.payTerm && chosenByHand.current !== item.payTerm && before.term !== null && age !== null) {
      const from = terms.find((term) => term.key === before.term)?.label ?? before.term;
      const to = terms.find((term) => term.key === item.payTerm)?.label ?? null;
      setMoved({ from, to, age });
    } else if (before.term !== item.payTerm) {
      setMoved(null);
    }
    chosenByHand.current = null;
    previous.current = { term: item.payTerm, age };
  }, [item.payTerm, age, terms]);

  if (terms.length === 0) return null;
  if (terms.length === 1) {
    return (
      <div data-pay-term="">
        <p className={LABEL}>{t.payTerm}</p>
        <p className="text-md text-ink">{terms[0].label}</p>
      </div>
    );
  }
  return (
    <div data-pay-term="">
      <p id={`${uid}-label`} className={LABEL}>{t.payTerm}</p>
      <div role="group" aria-labelledby={`${uid}-label`} className="flex flex-wrap gap-2">
        {terms.map((term) => {
          const on = item.payTerm === term.key;
          const blocked = !allowed(term, age);
          return (
            <button
              key={term.key}
              type="button"
              aria-pressed={on}
              disabled={readOnly || blocked}
              aria-label={blocked && term.maxEntryAge !== null ? `${term.label}, ${t.payTermBlocked({ max: term.maxEntryAge })}` : undefined}
              title={blocked && term.maxEntryAge !== null ? t.payTermBlocked({ max: term.maxEntryAge }) : undefined}
              onClick={() => {
                if (on) return;
                chosenByHand.current = term.key;
                onPatch({ payTerm: term.key });
              }}
              className={cn(CHIP, on ? CHIP_ON : CHIP_OFF, blocked && 'line-through')}
            >
              {term.label}
            </button>
          );
        })}
      </div>
      {moved && (
        <p role="status" data-pay-term-moved="" className="mt-2 text-sm text-navy">
          {moved.to ? t.payTermMoved({ from: moved.from, to: moved.to, age: moved.age }) : t.payTermNone({ age: moved.age })}
        </p>
      )}
      {!moved && item.payTerm === null && age !== null && <p className="mt-2 text-sm text-alert">{t.payTermNone({ age })}</p>}
    </div>
  );
}

/**
 * ***Cara bayar*** (P19.14-T2 AC-3): the product's own frequencies as chips, *Bulanan* first — a single pay term, or a
 * product paid once, reads *Sekali bayar* as text. A change empties this card's premium, and says so.
 */
function CaraBayar({ item, readOnly, onPatch }: { item: ProposalItem; readOnly: boolean; onPatch: (body: ProposalItemPatch) => void }) {
  const t = useMessages(proposalMessages).panel;
  const uid = useId();
  const singleTerm = item.snapshot.payTerms.find((term) => term.key === item.payTerm)?.single ?? false;
  const offered: PayFrequency[] = singleTerm
    ? ['single']
    : item.snapshot.frequencies.filter((f) => f !== 'single' || item.snapshot.payTerms.length === 0);
  // P19.15-T1 (ADR-0258 §4): on a calculating card, only what the premium table prices — never an assumed 12×.
  const priced = calculates(item) && item.calc && item.calc.frequencies.length > 0 ? item.calc.frequencies : null;
  if (offered.length <= 1) {
    return (
      <div data-pay-frequency="">
        <p className={LABEL}>{t.payFrequency}</p>
        <p className="text-md text-ink">{t.pay[offered[0] ?? item.payFrequency]}</p>
      </div>
    );
  }
  return (
    <div data-pay-frequency="">
      <p id={`${uid}-label`} className={LABEL}>{t.payFrequency}</p>
      <div role="group" aria-labelledby={`${uid}-label`} className="flex flex-wrap gap-2">
        {offered.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={item.payFrequency === f}
            disabled={readOnly || (priced !== null && !priced.includes(f) && item.payFrequency !== f)}
            title={priced !== null && !priced.includes(f) ? t.calc.noFrequency : undefined}
            onClick={() => { if (item.payFrequency !== f) onPatch({ payFrequency: f }); }}
            className={cn(CHIP, item.payFrequency === f ? CHIP_ON : CHIP_OFF)}
          >
            {t.pay[f]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One of the product's own fields, as its type draws it (ADR-0225 §1; ADR-0255 §3). */
function FieldRow({
  field, item, label, readOnly, onPatch,
}: {
  field: ProposalFieldView;
  item: ProposalItem;
  label: string;
  readOnly: boolean;
  onPatch: (body: ProposalItemPatch) => void;
}) {
  const t = useMessages(proposalMessages).panel;
  const uid = useId();
  const value = item.fieldValues[field.key];

  // Worked out from the other fields: text, *otomatis* — never chosen here.
  if (field.type === 'derived') {
    return (
      <div data-field={field.key}>
        <p className={LABEL}>{label}</p>
        <p className="flex flex-wrap items-center gap-2 text-md font-semibold text-ink">
          {typeof value === 'string' ? value : '–'}
          <TonePill tone="grey">{t.automatic}</TonePill>
        </p>
      </div>
    );
  }

  // One option, or a sentence: plain text, nothing to choose (the spec's *fixed*).
  if (field.type === 'fixed' || (field.type === 'chips' && field.options.length === 1)) {
    return (
      <div data-field={field.key}>
        <p className={LABEL}>{label}</p>
        <p className="text-md text-ink">{field.options[0]?.label ?? ''}</p>
      </div>
    );
  }

  if (field.type === 'chips') {
    return (
      <div data-field={field.key}>
        <p id={`${uid}-label`} className={LABEL}>{label}</p>
        <div role="group" aria-labelledby={`${uid}-label`} className="flex flex-wrap gap-2">
          {field.options.map((option) => {
            const on = value === option.label;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => { if (!on) onPatch({ fieldValues: { [field.key]: option.label } }); }}
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div data-field={field.key}>
      <label id={`${uid}-label`} htmlFor={`${uid}-money`} className={LABEL}>{label}</label>
      <MoneyInput
        id={`${uid}-money`}
        labelledBy={`${uid}-label`}
        currency={item.currency}
        valueMinor={typeof value === 'number' ? value : null}
        minMinor={field.minMinor}
        quickAmounts={field.quickAmounts}
        disabled={readOnly}
        saveAfterMs={calculates(item) ? PROPOSAL_RECALC_MS : TYPED_SAVE_MS}
        fixed={calculates(item) && item.fixedField === 'goal' && goalKeyOf(item) === field.key}
        onCommit={(minor) => onPatch({ fieldValues: { [field.key]: minor } })}
      />
    </div>
  );
}

/**
 * **What the calculation says, under the amounts** (P19.15-T1 AC-5, AC-6; the P1 spec's *How it behaves*):
 *
 * - why the calculated amount is empty — *"Kombinasi ini tidak ada di tabel tarif"*, a *Cara bayar* the table does not
 *   price, an age outside its entry ages, the insured's age or gender to fill in;
 * - a limit in one line, with **a chip for the nearest allowed value** — nothing is changed until it is tapped;
 * - *"Premi disesuaikan karena UP dibulatkan ke Rp1 jt"*, *"Premi diperbarui ke tarif {date}"*;
 * - the result line: *"Tabel tarif berlaku {tanggal}"*, *"sekali bayar"* for a single payment, and for a
 *   `premium_benefit` product the benefit the table gives.
 *
 * Every word the server's state, never worked out here.
 */
function CalcLines({ item, id, age, readOnly, onPatch }: {
  item: ProposalItem; id: string; age: number | null; readOnly: boolean; onPatch: (body: ProposalItemPatch) => void;
}) {
  const t = useMessages(proposalMessages).panel.calc;
  const figures = useFigureLanguage();
  const calc = item.calc!;
  const money = (minor: number) => moneyWords(minor, item.currency, figures);
  const reason = {
    ok: null,
    needs_amount: null,
    needs_input: calc.missing === 'gender' ? t.needsGender : t.needsAge,
    missing_combination: t.missing,
    no_frequency: t.noFrequency,
    age_outside: t.ageOutside({
      age: age ?? 0, min: calc.ageBounds?.min === null || !calc.ageBounds ? '–' : String(calc.ageBounds.min),
      max: calc.ageBounds?.max === null || !calc.ageBounds ? '–' : String(calc.ageBounds.max),
    }),
    table_off: t.tableOff,
  }[calc.state];
  const limit = calc.limit;
  const chip = limit?.chip ?? null;
  const goalKey = goalKeyOf(item);
  const applyChip = () => {
    if (!chip) return;
    if (chip.field === 'up') onPatch({ up: { amountMinor: chip.amountMinor } });
    else if (chip.field === 'premium') onPatch({ premium: { amountMinor: chip.amountMinor } });
    else if (goalKey) onPatch({ fieldValues: { [goalKey]: chip.amountMinor } });
  };
  const single = item.payFrequency === 'single';
  return (
    <div id={id} data-calc={calc.state} className="flex flex-col gap-1">
      {reason && <p role="status" data-calc-reason="" className="text-sm font-semibold text-alert">{reason}</p>}
      {limit && (
        <p role="status" data-calc-limit={limit.kind} className="flex flex-wrap items-center gap-2 text-sm text-navy">
          <span>{t.limits[limit.kind]({ limit: money(limit.limitMinor) })}</span>
          {chip && (
            <button
              type="button"
              disabled={readOnly}
              onClick={applyChip}
              className={cn(CHIP, CHIP_OFF, 'min-h-11 px-3 text-sm')}
            >
              — {chip.field === 'up' && limit.kind.startsWith('premium') ? t.useUp({ amount: money(chip.amountMinor) }) : t.use({ amount: money(chip.amountMinor) })}
            </button>
          )}
        </p>
      )}
      {item.calcNote === 'up_rounded' && calc.stepMinor !== null && (
        <p role="status" data-calc-note="up_rounded" className="text-sm text-navy">{t.adjusted({ step: money(calc.stepMinor) })}</p>
      )}
      {item.calcNote === 'rates_updated' && item.rateTableEffectiveFrom && (
        <p role="status" data-calc-note="rates_updated" className="text-sm text-navy">
          {t.updated({ date: formatCalendarDay(item.rateTableEffectiveFrom, figures) })}
        </p>
      )}
      {item.snapshot.calcType === 'premium_benefit' && item.up && calc.state === 'ok' && (
        <p data-calc-benefit="" className="text-md font-semibold text-navy">{t.benefit({ amount: formatMoneyInFull(item.up.amountMinor, item.currency, figures) })}</p>
      )}
      {calc.effectiveFrom && (
        <p data-calc-table="" className="text-sm text-muted">
          {t.tableFrom({ date: formatCalendarDay(calc.effectiveFrom, figures) })}{single ? ` · ${t.singlePayment}` : ''}
        </p>
      )}
    </div>
  );
}
