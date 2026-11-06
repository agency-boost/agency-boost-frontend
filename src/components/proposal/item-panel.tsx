'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import { formatMoneyInFull } from '@/lib/format';
import { LEAD_AGE_MAX, LEAD_AGE_MIN } from '@/lib/leads';
import {
  fieldLabel, INSURED_RELATIONS, type CatalogProduct, type InsuredRelation, type Proposal, type ProposalFieldView,
  type ProposalItem, type ProposalItemPatch,
} from '@/lib/proposals';
import { CategoryIcon } from './proposal-frame';
import { MoneyInput, TYPED_SAVE_MS } from './money-input';
import { FaqSheet, PlanSheet } from './product-sheets';

/** One-tap choices: the selection colour on the chosen one, 48px targets, pills (FINAL V1). */
export const CHIP = 'min-h-12 rounded-pill px-4 text-md font-semibold disabled:cursor-not-allowed disabled:opacity-40';
export const CHIP_ON = 'bg-secondary text-secondary-contrast';
export const CHIP_OFF = 'bg-hover-row text-navy hover:bg-secondary/[0.08]';

/** A small heading inside the panel. */
const LABEL = 'mb-2 block text-sm font-semibold text-navy';

/**
 * **An added product's panel** (AC-7; Acc. 7, Acc. 12; ADR-0221 §3, ADR-0225 §6–§8): drawn from the item's own snapshot,
 * which never changes after it was added, so an old proposal reads as it was made.
 *
 * 1. ***Tertanggung*** first: *Klien · Pasangan · Anak · Orang lain*, the product's default already chosen by the server
 *    (*Anak* for an education product). Anything but *Klien* asks for a name and an age on one line.
 * 2. **The product's own fields, in the catalogue's order**: a `chips` field one tap, preselected; a `money` field the
 *    keypad and its quick amounts; a field with one option, or a `fixed` one, plain text.
 * 3. ***Premi per {cara bayar}*** last — *Kontribusi* on a *Syariah* proposal — with *"Lihat di ilustrasi resmi"*, and the
 *    server's *"Total dibayar selama N tahun"* under it, hidden where the term is not whole years.
 *
 * Then *"Bisa ditambah: …"* under a base with riders, *Lihat semua plan* where it has plans, and *Tanya-jawab* where it
 * has an FAQ — all three from the catalogue's read, for the agent only.
 */
export function ItemPanel({
  proposal,
  item,
  offered,
  open,
  readOnly,
  onToggle,
  onPatch,
  onRemove,
}: {
  proposal: Proposal;
  item: ProposalItem;
  /** The product as the catalogue offers it now, for its riders, plans and FAQ; `null` when it is no longer offered. */
  offered: CatalogProduct | null;
  open: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onPatch: (body: ProposalItemPatch) => void;
  onRemove: () => void;
}) {
  const t = useMessages(proposalMessages);
  const figures = useFigureLanguage();
  const uid = useId();
  const [sheet, setSheet] = useState<'plans' | 'faq' | null>(null);
  const channel = proposal.channel;
  const planField = item.snapshot.fields.find((f) => f.plan && f.type === 'chips') ?? null;
  const plans = offered?.plans ?? [];
  const faq = offered?.faq ?? [];
  const riders = offered?.riders ?? [];
  const premiumLabel = (channel === 'syariah' ? t.panel.contributionPer : t.panel.premiumPer)[proposal.payFrequency];
  const headingId = `${uid}-name`;

  return (
    <section data-proposal-item={item.productCode} aria-labelledby={headingId} className="overflow-hidden rounded-lg bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <CategoryIcon category={item.snapshot.category} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${uid}-body`}
          onClick={onToggle}
          className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center text-left"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{item.snapshot.typeLabel}</span>
          <span id={headingId} className="truncate text-md font-bold text-ink">
            {item.name}{item.plan ? ` · ${item.plan}` : ''}
          </span>
        </button>
        <button
          type="button"
          disabled={readOnly}
          aria-label={t.panel.remove({ product: item.name })}
          onClick={onRemove}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-muted hover:bg-alert/5 hover:text-alert disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LineIcon name="trash" className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div id={`${uid}-body`} className="flex flex-col gap-4 border-t border-divider px-4 pb-4 pt-3">
          <Insured item={item} readOnly={readOnly} onPatch={onPatch} />

          {item.snapshot.fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              item={item}
              label={fieldLabel(field, channel)}
              readOnly={readOnly}
              onPatch={onPatch}
            />
          ))}

          <div>
            <label id={`${uid}-premium-label`} htmlFor={`${uid}-premium`} className={LABEL}>{premiumLabel}</label>
            <MoneyInput
              id={`${uid}-premium`}
              labelledBy={`${uid}-premium-label`}
              currency={item.premium.currency}
              valueMinor={item.premium.amountMinor}
              disabled={readOnly}
              onCommit={(amountMinor) => onPatch({ premium: { amountMinor } })}
            />
            <p className="mt-1 text-sm text-muted">{t.panel.premiumHint}</p>
            {item.totalPaid && (
              <p data-total-paid="" className="mt-2 text-md font-semibold text-navy">
                {t.panel.totalPaid({
                  years: item.totalPaid.years,
                  amount: formatMoneyInFull(item.totalPaid.amountMinor, item.premium.currency, figures),
                })}
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
      )}

      {planField && (
        <PlanSheet
          open={sheet === 'plans'}
          product={item.name}
          plans={plans}
          channel={channel}
          chosen={typeof item.fieldValues[planField.key] === 'string' ? String(item.fieldValues[planField.key]) : null}
          readOnly={readOnly}
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

/** ***Tertanggung*** (AC-7 item 1): who is insured, and — for anybody but *Klien* — their name and age on one line. */
function Insured({ item, readOnly, onPatch }: { item: ProposalItem; readOnly: boolean; onPatch: (body: ProposalItemPatch) => void }) {
  const t = useMessages(proposalMessages).panel;
  const ageWords = useMessages(leadsMessages).sheet;
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

  return (
    <div>
      <p id={`${uid}-label`} className={LABEL}>{t.insured}</p>
      <div role="group" aria-labelledby={`${uid}-label`} className="flex flex-wrap gap-2">
        {INSURED_RELATIONS.map((r: InsuredRelation) => (
          <button
            key={r}
            type="button"
            aria-pressed={relation === r}
            disabled={readOnly}
            onClick={() => { if (r !== relation) onPatch({ insured: { relation: r } }); }}
            className={cn(CHIP, relation === r ? CHIP_ON : CHIP_OFF)}
          >
            {t.relations[r]}
          </button>
        ))}
      </div>
      {relation !== 'client' && (
        <div className="mt-2 flex items-start gap-2">
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
          <label className="w-24 shrink-0">
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
              className="h-12 w-full rounded-pill border-0 bg-hover-row px-4 text-center text-md font-bold text-ink disabled:opacity-40"
            />
          </label>
        </div>
      )}
      {relation !== 'client' && ageOut && (
        <p className="mt-1 text-sm text-alert">{ageWords.ageOutOfRange({ min: LEAD_AGE_MIN, max: LEAD_AGE_MAX })}</p>
      )}
    </div>
  );
}

/** One of the product's own fields, as its type draws it (AC-7 item 2; ADR-0225 §1). */
function FieldRow({
  field, item, label, readOnly, onPatch,
}: {
  field: ProposalFieldView;
  item: ProposalItem;
  label: string;
  readOnly: boolean;
  onPatch: (body: ProposalItemPatch) => void;
}) {
  const uid = useId();
  const value = item.fieldValues[field.key];

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
        onCommit={(minor) => onPatch({ fieldValues: { [field.key]: minor } })}
      />
    </div>
  );
}
