'use client';

import { useEffect, useState } from 'react';
import { ProductProposalEditor, proposalToSave, type ProposalSettings } from '@/components/product-proposal-editor';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataMessages } from '@/i18n/messages/product-data';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { formatCalendarDay, formatRupiahCompact } from '@/lib/format';
import { PRODUCT_CURRENCIES, type ProductCurrency, type ProductPayFrequency, type ProposalCalcType } from '@/lib/admin';
import { saveProductRules, type ProductDataDetail, type ProductRules, type RateRules } from '@/lib/product-data';

const CALC_TYPES: readonly ProposalCalcType[] = ['up_premium', 'goal', 'premium_benefit', 'plan_priced', 'manual'];
const FREQUENCIES: readonly ProductPayFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual', 'single'];
const NEEDS = ['HOSPITAL', 'CRITICAL_INCOME', 'FAMILY', 'EDUCATION', 'FUTURE'] as const;
const CARD = 'rounded-lg border border-hairline bg-card p-4';
const H4 = 'font-display text-md font-bold text-navy';

/** Whole rupiah as typed, as minor units; empty is `null`. */
const minorOf = (text: string) => (text.replace(/\D/g, '') === '' ? null : Number(text.replace(/\D/g, '')) * 100);
const rupiahOf = (minor: number | null) => (minor === null ? '' : String(Math.round(minor / 100)));
const ageOf = (text: string) => (text.replace(/\D/g, '') === '' ? null : Number(text.replace(/\D/g, '')));

/**
 * ***Isian*: the product's proposal setup, as forms** (P19.15-T1 AC-4; ADR-0258 §7; the P1b spec's *Tab "Isian"*):
 *
 * - **The fields** — type, options, default, *tampil di ringkasan*, the syariah label, ↑ / ↓ — and the plans, through the
 *   catalogue's own editor (`ProductProposalEditor`, *Isian* mode: no FAQ and no page-2 blocks, which are the catalogue
 *   editor's and *Ilustrasi*'s).
 * - **The calculation**, where the catalogue editor shows *Perhitungan* read-only: *Cara hitung*, *Mata uang*, *Merokok
 *   berpengaruh?*, *Usia masuk*, *Masa bayar* with each one's maximum entry age, *Cara bayar*, the UP and premium limits,
 *   *Aturan plan otomatis* and *Kebutuhan*.
 * - **The rules of the table in force**, read-only beside them: a table brings its own (§3).
 *
 * One save, pinned to the product's version; the server checks every rule and names the path it broke; it audits the
 * change with before and after. Read-only for a reader who may not manage the company.
 */
export function RulesTab({ companyId, detail, canManage, onSaved }: {
  companyId: string; detail: ProductDataDetail; canManage: boolean; onSaved: (next: ProductDataDetail) => void;
}) {
  const t = useMessages(productDataMessages);
  const figures = useFigureLanguage();
  const product = detail.product;
  const [rules, setRules] = useState<ProductRules>(() => structuredClone(product.rules));
  const [settings, setSettings] = useState<ProposalSettings>(() => settingsOf(product.rules));
  const [error, setError] = useState<ApiError | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');

  useEffect(() => {
    setRules(structuredClone(product.rules));
    setSettings(settingsOf(product.rules));
  }, [product]);

  const set = <K extends keyof ProductRules>(key: K, value: ProductRules[K]) => setRules((r) => ({ ...r, [key]: value }));
  const disabled = !canManage || state === 'saving';
  const chips = settings.proposalFields.filter((f) => f.type === 'chips');
  const derived = settings.proposalFields.find((f) => f.type === 'derived') ?? null;

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      const words = proposalToSave(settings);
      const next = await saveProductRules(companyId, product.id, product.version, {
        proposalFields: words.proposalFields, planOptions: words.planOptions, syariahName: words.syariahName,
        defaultInsured: words.defaultInsured, proposalTypeLabel: words.proposalTypeLabel,
        currencies: rules.currencies, calcType: rules.calcType, entryAge: rules.entryAge, payTerms: rules.payTerms,
        frequencies: rules.frequencies, smokerRated: rules.smokerRated,
        planRule: derived ? rules.planRule : null,
        upStep: rules.upStep, upMin: rules.upMin, upMax: rules.upMax, premiumMin: rules.premiumMin, premiumMax: rules.premiumMax,
        needTag: rules.needTag,
      });
      onSaved(next);
      setState('saved');
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setState('conflict');
        return;
      }
      setError(toDisplayError(err));
      setState('idle');
    }
  };

  const calculation = (
    <div data-isian-calc="" className={`mt-4 flex flex-col gap-4 ${CARD}`}>
      <div className="flex flex-wrap gap-3">
        <Field label={t.isian.calcType} htmlFor="isian-calc" className="min-w-48">
          <Select id="isian-calc" value={rules.calcType} disabled={disabled} onChange={(e) => set('calcType', e.target.value as ProposalCalcType)}>
            {CALC_TYPES.map((c) => <option key={c} value={c}>{t.calcTypes[c]}</option>)}
          </Select>
        </Field>
        <fieldset className="min-w-48">
          <legend className="mb-1 text-sm font-semibold text-navy">{t.isian.currencies}</legend>
          <div className="flex gap-4">
            {PRODUCT_CURRENCIES.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2 text-md text-navy">
                <input
                  type="checkbox"
                  checked={rules.currencies.includes(c)}
                  disabled={disabled}
                  onChange={(e) => set('currencies', e.target.checked
                    ? PRODUCT_CURRENCIES.filter((x) => x === c || rules.currencies.includes(x)) as ProductCurrency[]
                    : rules.currencies.filter((x) => x !== c))}
                />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-2 self-end text-md text-navy">
          <input type="checkbox" checked={rules.smokerRated} disabled={disabled} onChange={(e) => set('smokerRated', e.target.checked)} />
          {t.isian.smokerRated}
        </label>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-navy">{t.isian.entryAge}</legend>
        <div className="flex flex-wrap gap-3">
          <Field label={t.isian.entryAgeMin} htmlFor="isian-age-min" className="w-28">
            <TextInput id="isian-age-min" inputMode="numeric" value={rules.entryAge?.min ?? ''} disabled={disabled}
              onChange={(e) => {
                const min = ageOf(e.target.value);
                set('entryAge', min === null && rules.entryAge?.max == null ? null : { min: min ?? 0, max: rules.entryAge?.max ?? 100 });
              }} />
          </Field>
          <Field label={t.isian.entryAgeMax} htmlFor="isian-age-max" className="w-28">
            <TextInput id="isian-age-max" inputMode="numeric" value={rules.entryAge?.max ?? ''} disabled={disabled}
              onChange={(e) => {
                const max = ageOf(e.target.value);
                set('entryAge', max === null && rules.entryAge?.min == null ? null : { min: rules.entryAge?.min ?? 1, max: max ?? 100 });
              }} />
          </Field>
        </div>
      </fieldset>

      <fieldset data-isian-pay-terms="">
        <legend className={H4}>{t.isian.payTerms}</legend>
        <ul className="mt-2 flex flex-col gap-2">
          {rules.payTerms.map((term, at) => {
            const update = (next: Partial<typeof term>) => set('payTerms', rules.payTerms.map((p, i) => (i === at ? { ...p, ...next } : p)));
            return (
              <li key={at} className="flex flex-wrap items-end gap-2">
                <Field label={t.isian.payTermLabel} htmlFor={`isian-term-${at}-label`} className="min-w-40 flex-1">
                  <TextInput id={`isian-term-${at}-label`} value={term.label} maxLength={60} disabled={disabled} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label={t.isian.payTermKey} htmlFor={`isian-term-${at}-key`} className="w-28">
                  <TextInput id={`isian-term-${at}-key`} value={term.key} maxLength={40} disabled={disabled} onChange={(e) => update({ key: e.target.value.toLowerCase() })} />
                </Field>
                <Field label={t.isian.payTermYears} htmlFor={`isian-term-${at}-years`} className="w-24">
                  <TextInput id={`isian-term-${at}-years`} inputMode="numeric" value={term.years ?? ''} disabled={disabled || term.single}
                    onChange={(e) => update({ years: ageOf(e.target.value) })} />
                </Field>
                <Field label={t.isian.payTermMax} htmlFor={`isian-term-${at}-max`} className="w-32">
                  <TextInput id={`isian-term-${at}-max`} inputMode="numeric" value={term.maxEntryAge ?? ''} disabled={disabled}
                    onChange={(e) => update({ maxEntryAge: ageOf(e.target.value) })} />
                </Field>
                <label className="flex min-h-11 items-center gap-2 text-md text-navy">
                  <input type="radio" name="isian-term-default" checked={term.default} disabled={disabled}
                    onChange={() => set('payTerms', rules.payTerms.map((p, i) => ({ ...p, default: i === at })))} />
                  {t.isian.payTermDefault}
                </label>
                <Button variant="inlineDanger" disabled={disabled} onClick={() => set('payTerms', rules.payTerms.filter((_, i) => i !== at))}>
                  {t.isian.removePayTerm({ label: term.label || term.key })}
                </Button>
              </li>
            );
          })}
        </ul>
        <Button variant="inline" className="mt-1" disabled={disabled}
          onClick={() => set('payTerms', [...rules.payTerms, { key: '', label: '', years: null, toAge: null, single: false, maxEntryAge: null, default: false }])}>
          {t.isian.addPayTerm}
        </Button>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-navy">{t.isian.frequencies}</legend>
        <div className="flex flex-wrap gap-x-4">
          {FREQUENCIES.map((f) => (
            <label key={f} className="flex min-h-11 items-center gap-2 text-md text-navy">
              <input type="checkbox" checked={rules.frequencies.includes(f)} disabled={disabled}
                onChange={(e) => set('frequencies', e.target.checked
                  ? FREQUENCIES.filter((x) => x === f || rules.frequencies.includes(x))
                  : rules.frequencies.filter((x) => x !== f))} />
              {t.isian.frequencyNames[f]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-navy">{t.isian.upStep} · {t.isian.upMin} · {t.isian.premiumMin}</legend>
        <p className="text-sm text-muted">{t.isian.limitsHint}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {(['upStep', 'upMin', 'upMax', 'premiumMin', 'premiumMax'] as const).map((key) => (
            <Field key={key} label={t.isian[key]} htmlFor={`isian-${key}`} className="w-44">
              <TextInput id={`isian-${key}`} inputMode="numeric" value={rupiahOf(rules[key])} disabled={disabled}
                onChange={(e) => set(key, minorOf(e.target.value))} />
            </Field>
          ))}
        </div>
      </fieldset>

      {derived && (
        <fieldset data-isian-plan-rule="">
          <legend className={H4}>{t.isian.planRule}</legend>
          <p className="text-sm text-muted">{t.isian.planRuleHint}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {(rules.planRule?.rules ?? []).map((rule, at) => {
              const update = (next: typeof rule) => set('planRule', {
                field: derived.key, rules: (rules.planRule?.rules ?? []).map((r, i) => (i === at ? next : r)),
              });
              return (
                <li key={at} className="flex flex-wrap items-end gap-2">
                  {chips.map((field) => (
                    <Field key={field.key} label={t.isian.planRuleWhen({ field: field.label })} htmlFor={`isian-rule-${at}-${field.key}`} className="min-w-36">
                      <Select id={`isian-rule-${at}-${field.key}`} value={rule.when[field.key] ?? ''} disabled={disabled}
                        onChange={(e) => {
                          const when = { ...rule.when };
                          if (e.target.value) when[field.key] = e.target.value; else delete when[field.key];
                          update({ ...rule, when });
                        }}>
                        <option value="">{t.isian.any}</option>
                        {field.options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                      </Select>
                    </Field>
                  ))}
                  <Field label={t.isian.planRuleThen} htmlFor={`isian-rule-${at}-value`} className="min-w-36">
                    <Select id={`isian-rule-${at}-value`} value={rule.value} disabled={disabled} onChange={(e) => update({ ...rule, value: e.target.value })}>
                      <option value="" disabled>—</option>
                      {derived.options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                    </Select>
                  </Field>
                  <Button variant="inlineDanger" disabled={disabled}
                    onClick={() => set('planRule', { field: derived.key, rules: (rules.planRule?.rules ?? []).filter((_, i) => i !== at) })}>
                    {t.isian.removeRule({ n: at + 1 })}
                  </Button>
                </li>
              );
            })}
          </ol>
          <Button variant="inline" className="mt-1" disabled={disabled}
            onClick={() => set('planRule', { field: derived.key, rules: [...(rules.planRule?.rules ?? []), { when: {}, value: '' }] })}>
            {t.isian.addRule}
          </Button>
        </fieldset>
      )}

      <Field label={t.isian.needTag} htmlFor="isian-need" className="max-w-sm">
        <Select id="isian-need" value={rules.needTag ?? ''} disabled={disabled} onChange={(e) => set('needTag', (e.target.value || null) as ProductRules['needTag'])}>
          <option value="">{t.isian.needAuto}</option>
          {NEEDS.map((n) => <option key={n} value={n}>{t.isian.needs[n]}</option>)}
        </Select>
      </Field>
    </div>
  );

  return (
    <div data-rules-tab="" className="flex max-w-form flex-col gap-4">
      <p className="text-sm text-muted">{t.isian.lead}</p>
      {detail.inForce && inForceRules(detail.inForce.rules, detail.inForce.version, detail.inForce.effectiveFrom)}
      <ProductProposalEditor
        isian
        product={{ id: product.id, name: product.name, ...rules }}
        channel={product.channel}
        category={product.category}
        currencies={rules.currencies}
        value={settings}
        onChange={setSettings}
        disabled={disabled}
        calculation={calculation}
      />
      {error && <ErrorBanner {...error} />}
      {state === 'conflict' && <p role="alert" className="text-sm text-alert">{t.isian.conflict}</p>}
      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { void save(); }} disabled={disabled}>{t.isian.save}</Button>
          {state === 'saved' && <span role="status" className="text-sm text-success">{t.isian.saved}</span>}
        </div>
      )}
    </div>
  );

  function inForceRules(r: RateRules, version: number, from: string) {
    const money = (minor: number | null) => (minor === null ? '–' : formatRupiahCompact(minor, { lossless: true }, figures));
    return (
      <div data-in-force-rules="" className={CARD}>
        <p className="text-sm font-semibold text-navy">{t.isian.inForce({ version, date: formatCalendarDay(from, figures) })}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
          {(['upStep', 'upMin', 'upMax', 'premiumMin', 'premiumMax'] as const).map((key) => (
            <div key={key}><dt className="text-muted">{t.isian[key]}</dt><dd className="font-semibold text-navy">{money(r[key])}</dd></div>
          ))}
          <div>
            <dt className="text-muted">{t.isian.entryAge}</dt>
            <dd className="font-semibold text-navy">{r.entryAgeMin ?? '–'}–{r.entryAgeMax ?? '–'}</dd>
          </div>
        </dl>
      </div>
    );
  }
}

/** The fields and words *Isian* edits through the catalogue's editor; the FAQ and page 2's blocks stay as stored. */
function settingsOf(rules: ProductRules): ProposalSettings {
  return structuredClone({
    proposalFields: rules.proposalFields ?? [],
    planOptions: rules.planOptions ?? [],
    faq: [],
    pdfDetail: [],
    syariahName: rules.syariahName ?? null,
    defaultInsured: rules.defaultInsured ?? null,
    proposalTypeLabel: rules.proposalTypeLabel ?? null,
  });
}
