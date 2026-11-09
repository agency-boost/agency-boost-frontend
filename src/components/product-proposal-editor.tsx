'use client';

import { DateField } from '@/components/ui/date-field';
import {
  FaqList, PROPOSAL_CARD as CARD, PROPOSAL_H4 as H4, moveRow as move, replaceRow as replace, withoutRow as without,
} from '@/components/faq-list';
import { Button, Field, Select, TextInput } from '@/components/ui/field';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { TonePill } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import { adminProductProposalMessages } from '@/i18n/messages/admin-product-proposal';
import {
  PDF_DETAIL_BLOCKS, PRODUCT_CURRENCIES, PROPOSAL_FIELD_TYPES, PROPOSAL_LIMITS,
  type FaqEntry, type PdfDetailBlock, type PdfDetailBlockKind, type PlanOption, type Product, type ProductCurrency,
  type ProposalField, type ProposalFieldType, type ProposalOption,
} from '@/lib/admin';

/** Everything the section edits, as the product stores it and the save sends it (ADR-0225 §1). */
export interface ProposalSettings {
  proposalFields: ProposalField[];
  planOptions: PlanOption[];
  faq: FaqEntry[];
  pdfDetail: PdfDetailBlock[];
  syariahName: string | null;
  defaultInsured: 'client' | 'child' | null;
  proposalTypeLabel: string | null;
}

/** The PDF's type label a category prints when the product names none (ADR-0225 §1; the API's own table). */
const TYPE_LABEL_BY_CATEGORY: Record<string, string> = {
  life: 'JIWA', health: 'KESEHATAN', ci: 'PENYAKIT KRITIS', education: 'DANA PENDIDIKAN', investment: 'INVESTASI',
};

/** A product's proposal settings, as read. */
export function proposalSettingsOf(product: Product): ProposalSettings {
  return structuredClone({
    proposalFields: product.proposalFields ?? [],
    planOptions: product.planOptions ?? [],
    faq: product.faq ?? [],
    pdfDetail: product.pdfDetail ?? [],
    syariahName: product.syariahName ?? null,
    defaultInsured: product.defaultInsured ?? null,
    proposalTypeLabel: product.proposalTypeLabel ?? null,
  });
}

/** The settings as the API takes them: blanks cleared, nothing else changed — the API holds every rule (ADR-0225 §2). */
export function proposalToSave(settings: ProposalSettings): ProposalSettings {
  const blank = (text: string | null) => (text === null || text.trim() === '' ? null : text.trim());
  return {
    ...settings,
    syariahName: blank(settings.syariahName),
    proposalTypeLabel: blank(settings.proposalTypeLabel),
    proposalFields: settings.proposalFields.map((field) => ({ ...field, labelSyariah: blank(field.labelSyariah) })),
    pdfDetail: settings.pdfDetail.map((block) => ({
      ...block,
      rows: block.rows.map((row) => ({ ...row, note: blank(row.note), formula: blank(row.formula), text: blank(row.text) })),
    })),
  };
}


/** Whole rupiah as typed, as minor units; anything that is not a number is left out. */
const amountsOf = (text: string) => text.split(',').map((part) => part.replace(/\D/g, ''))
  .filter((part) => part !== '').map((part) => Number(part) * 100);
const rupiahOf = (minor: number[]) => minor.map((m) => String(Math.round(m / 100))).join(', ');


/**
 * **A product's *Proposal* section** (P19.7-T1 AC-3, Acc. 8; ADR-0225 §1, §2, §5): what the agent fills in for the
 * product on a proposal — its fields in order, its plan cards, its *Tanya-jawab*, page 2's detail blocks — and the
 * product's own words for it, each added, edited, removed and moved with **↑ / ↓**, saved with the product (*Save
 * product*, pinned to its version). A field the Prudential draft left *[cek]* reads ***Perlu dicek*** here and nowhere an
 * agent looks. The API holds every rule, refusing a save with the path it broke; the section stops at the counts.
 *
 * Controlled: `ProductEditor` holds the settings and sends them only when they changed.
 */
export function ProductProposalEditor({
  product,
  channel,
  category,
  currencies,
  value,
  onChange,
  disabled = false,
}: {
  product: Pick<Product, 'id' | 'name'>;
  /** The channel and category as the editor holds them now: `syariahName` is a conventional product's. */
  channel: string;
  category: string;
  currencies: readonly ProductCurrency[];
  value: ProposalSettings;
  onChange: (next: ProposalSettings) => void;
  disabled?: boolean;
}) {
  const t = useMessages(adminProductProposalMessages);
  const id = (part: string) => `proposal-${product.id}-${part}`;
  const set = <K extends keyof ProposalSettings>(key: K, next: ProposalSettings[K]) => onChange({ ...value, [key]: next });
  const fields = value.proposalFields;
  const planField = fields.find((f) => f.plan);
  const setField = (at: number, next: Partial<ProposalField>) => set('proposalFields', replace(fields, at, { ...fields[at], ...next }));
  const fallbackLabel = TYPE_LABEL_BY_CATEGORY[category] ?? category.toUpperCase();

  return (
    <section aria-labelledby={id('title')} data-proposal-editor="">
      <h3 id={id('title')} className="mt-5 font-display text-md font-bold text-navy">{t.title}</h3>
      <p className="text-sm text-muted">{t.lead}</p>

      <div className="mt-3 flex flex-wrap gap-3">
        <Field label={t.typeLabel} htmlFor={id('type-label')} hint={t.typeLabelHint({ fallback: fallbackLabel })} className="min-w-48">
          <TextInput
            id={id('type-label')}
            value={value.proposalTypeLabel ?? ''}
            maxLength={30}
            placeholder={fallbackLabel}
            disabled={disabled}
            onChange={(e) => set('proposalTypeLabel', e.target.value)}
          />
        </Field>
        <Field label={t.defaultInsured} htmlFor={id('insured')} className="min-w-48">
          <Select
            id={id('insured')}
            value={value.defaultInsured ?? ''}
            disabled={disabled}
            onChange={(e) => set('defaultInsured', (e.target.value || null) as ProposalSettings['defaultInsured'])}
          >
            <option value="">{t.insured.category({ who: category === 'education' ? t.insured.child : t.insured.client })}</option>
            <option value="client">{t.insured.client}</option>
            <option value="child">{t.insured.child}</option>
          </Select>
        </Field>
        {channel === 'conventional' && (
          <Field label={t.syariahName} htmlFor={id('syariah-name')} hint={t.syariahNameHint} className="min-w-60 flex-1">
            <TextInput
              id={id('syariah-name')}
              value={value.syariahName ?? ''}
              maxLength={80}
              disabled={disabled}
              onChange={(e) => set('syariahName', e.target.value)}
            />
          </Field>
        )}
      </div>

      {/* The fields, in the order the agent fills them in. */}
      <h4 className={`mt-4 ${H4}`}>{t.fields}</h4>
      <p className="text-sm text-muted">{t.fieldsHint({ max: PROPOSAL_LIMITS.FIELDS })}</p>
      {fields.length === 0 && <p className="mt-2 text-sm text-muted">{t.noFields}</p>}
      <ol className="flex flex-col">
        {fields.map((field, at) => {
          const name = t.fieldName({ n: at + 1, label: field.label || field.key });
          const fid = (part: string) => id(`field-${at}-${part}`);
          const setOption = (o: number, next: Partial<ProposalOption>) =>
            setField(at, { options: replace(field.options, o, { ...field.options[o], ...next }) });
          return (
            <li key={at} className={CARD} data-proposal-field={field.key}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-md font-semibold text-navy">{at + 1}. {field.label || field.key}</span>
                {field.draft && <TonePill tone="amber">{t.toCheck}</TonePill>}
                <span className="ml-auto flex items-center">
                  <ReorderArrows
                    label={name}
                    index={at}
                    count={fields.length}
                    disabled={disabled}
                    onMove={(by) => set('proposalFields', move(fields, at, by))}
                  />
                  <Button variant="inlineDanger" disabled={disabled} onClick={() => set('proposalFields', without(fields, at))}>
                    {t.removeField({ label: field.label || field.key })}
                  </Button>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Field label={t.key} htmlFor={fid('key')} hint={t.keyHint} className="min-w-40">
                  <TextInput
                    id={fid('key')}
                    value={field.key}
                    maxLength={40}
                    disabled={disabled}
                    onChange={(e) => setField(at, { key: e.target.value.toLowerCase() })}
                  />
                </Field>
                <Field label={t.label} htmlFor={fid('label')} className="min-w-48 flex-1">
                  <TextInput id={fid('label')} value={field.label} maxLength={60} disabled={disabled}
                    onChange={(e) => setField(at, { label: e.target.value })} />
                </Field>
                <Field label={t.labelSyariah} htmlFor={fid('label-syariah')} className="min-w-48 flex-1">
                  <TextInput id={fid('label-syariah')} value={field.labelSyariah ?? ''} maxLength={60} disabled={disabled}
                    onChange={(e) => setField(at, { labelSyariah: e.target.value })} />
                </Field>
                <Field label={t.type} htmlFor={fid('type')} className="min-w-40">
                  <Select
                    id={fid('type')}
                    value={field.type}
                    disabled={disabled}
                    onChange={(e) => {
                      const type = e.target.value as ProposalFieldType;
                      // A type's own parts only: a money field has no options, a choice no quick amounts.
                      setField(at, type === 'money'
                        ? { type, options: [], default: null, plan: false, currency: false, paymentYears: false }
                        : { type, quickAmounts: [], minMinor: null, options: field.options.length ? field.options : [{ label: '', years: null, currency: null }] });
                    }}
                  >
                    {PROPOSAL_FIELD_TYPES.map((type) => <option key={type} value={type}>{t.types[type]}</option>)}
                  </Select>
                </Field>
              </div>

              {field.type !== 'money' ? (
                <fieldset className="mt-2">
                  <legend className="text-sm font-semibold text-muted">{t.options}</legend>
                  <ul className="flex flex-col gap-2">
                    {field.options.map((option, o) => (
                      <li key={o} className="flex flex-wrap items-center gap-2">
                        <TextInput aria-label={t.optionLabel({ n: o + 1 })} value={option.label} maxLength={40} disabled={disabled}
                          className="min-w-40 flex-1" onChange={(e) => setOption(o, { label: e.target.value })} />
                        {field.paymentYears && (
                          <TextInput
                            aria-label={t.years({ n: o + 1 })}
                            inputMode="numeric"
                            className="w-24"
                            value={option.years === null ? '' : String(option.years)}
                            disabled={disabled}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              setOption(o, { years: digits === '' ? null : Number(digits) });
                            }}
                          />
                        )}
                        {field.currency && (
                          <Select aria-label={t.optionCurrency({ n: o + 1 })} value={option.currency ?? ''} disabled={disabled}
                            onChange={(e) => setOption(o, { currency: (e.target.value || null) as ProductCurrency | null })}>
                            <option value="">{t.noCurrency}</option>
                            {PRODUCT_CURRENCIES.filter((c) => currencies.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        )}
                        {field.type === 'chips' && (
                          <Button variant="inline" disabled={disabled} onClick={() => setField(at, { options: without(field.options, o) })}>
                            {t.removeOption({ n: o + 1 })}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {field.type === 'chips' && (
                    <Button
                      variant="inline"
                      className="mt-1"
                      disabled={disabled || field.options.length >= PROPOSAL_LIMITS.CHIP_OPTIONS}
                      onClick={() => setField(at, { options: [...field.options, { label: '', years: null, currency: null }] })}
                    >
                      {t.addOption}
                    </Button>
                  )}
                  {field.type === 'chips' && (
                    <Field label={t.default} htmlFor={fid('default')} className="mt-2 max-w-xs">
                      <Select id={fid('default')} value={field.default ?? ''} disabled={disabled}
                        onChange={(e) => setField(at, { default: e.target.value || null })}>
                        <option value="" disabled>—</option>
                        {field.options.filter((o) => o.label.trim()).map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                      </Select>
                    </Field>
                  )}
                </fieldset>
              ) : (
                <div className="mt-2 flex flex-wrap gap-3">
                  <Field label={t.quickAmounts} htmlFor={fid('quick')} className="min-w-60 flex-1">
                    {/* Committed on leaving the box; keyed by what it holds, so a reorder shows the moved field's own. */}
                    <TextInput key={`${field.key}:${rupiahOf(field.quickAmounts)}`} id={fid('quick')} inputMode="numeric"
                      defaultValue={rupiahOf(field.quickAmounts)} disabled={disabled}
                      onBlur={(e) => setField(at, { quickAmounts: amountsOf(e.target.value) })} />
                  </Field>
                  <Field label={t.minimum} htmlFor={fid('min')} className="min-w-40">
                    <TextInput
                      id={fid('min')}
                      inputMode="numeric"
                      value={field.minMinor === null ? '' : String(Math.round(field.minMinor / 100))}
                      disabled={disabled}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setField(at, { minMinor: digits === '' ? null : Number(digits) * 100 });
                      }}
                    />
                  </Field>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {(['showOnPdf', 'showOnSummary', 'paymentYears', 'plan', 'currency', 'draft'] as const)
                  .filter((flag) => field.type !== 'money' || !['paymentYears', 'plan', 'currency'].includes(flag))
                  .filter((flag) => field.type !== 'fixed' || !['plan', 'currency'].includes(flag))
                  .map((flag) => (
                    <label key={flag} className="flex items-center gap-2 text-md text-navy">
                      <input type="checkbox" checked={field[flag]} disabled={disabled}
                        onChange={(e) => setField(at, { [flag]: e.target.checked })} />
                      {t.flags[flag]}
                    </label>
                  ))}
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        variant="inline"
        className="mt-2"
        disabled={disabled || fields.length >= PROPOSAL_LIMITS.FIELDS}
        onClick={() => set('proposalFields', [...fields, {
          key: '', label: '', labelSyariah: null, type: 'chips', options: [{ label: '', years: null, currency: null }],
          default: null, quickAmounts: [], minMinor: null, showOnPdf: true, showOnSummary: false, paymentYears: false,
          plan: false, currency: false, draft: false,
        }])}
      >
        {t.addField}
      </Button>

      {/* The plan cards, cheapest first, each an option of the field that names the plans. */}
      <h4 className={`mt-4 ${H4}`}>{t.plans}</h4>
      <p className="text-sm text-muted">{planField ? t.plansHint : t.noPlanField}</p>
      <ol className="flex flex-col">
        {value.planOptions.map((plan, at) => {
          const setPlan = (next: Partial<PlanOption>) => set('planOptions', replace(value.planOptions, at, { ...plan, ...next }));
          return (
            <li key={at} className={CARD} data-plan-card={plan.name}>
              <div className="flex flex-wrap items-center gap-2">
                <Select aria-label={t.planName({ n: at + 1 })} value={plan.name} disabled={disabled} onChange={(e) => setPlan({ name: e.target.value })}>
                  <option value="" disabled>—</option>
                  {/* A card kept for a name the plan field no longer has, so the save says so rather than this hiding it. */}
                  {[...new Set([...(planField?.options.map((o) => o.label) ?? []), plan.name].filter(Boolean))]
                    .map((label) => <option key={label} value={label}>{label}</option>)}
                </Select>
                <label className="flex items-center gap-2 text-md text-navy">
                  <input type="checkbox" checked={plan.popular} disabled={disabled} onChange={(e) => setPlan({ popular: e.target.checked })} />
                  {t.popular}
                </label>
                <span className="ml-auto flex items-center">
                  <ReorderArrows label={t.planCard({ name: plan.name || String(at + 1) })} index={at} count={value.planOptions.length}
                    disabled={disabled} onMove={(by) => set('planOptions', move(value.planOptions, at, by))} />
                  <Button variant="inlineDanger" disabled={disabled} onClick={() => set('planOptions', without(value.planOptions, at))}>
                    {t.removePlan({ name: plan.name || String(at + 1) })}
                  </Button>
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-2" aria-label={t.highlights}>
                {plan.highlights.map((h, n) => (
                  <li key={n} className="flex flex-wrap items-center gap-2">
                    <TextInput aria-label={t.highlightLabel({ n: n + 1 })} value={h.label} maxLength={30} disabled={disabled} className="min-w-40 flex-1"
                      onChange={(e) => setPlan({ highlights: replace(plan.highlights, n, { ...h, label: e.target.value }) })} />
                    <TextInput aria-label={t.highlightValue({ n: n + 1 })} value={h.value} maxLength={40} disabled={disabled} className="min-w-40 flex-1"
                      onChange={(e) => setPlan({ highlights: replace(plan.highlights, n, { ...h, value: e.target.value }) })} />
                    <Button variant="inline" disabled={disabled} onClick={() => setPlan({ highlights: without(plan.highlights, n) })}>
                      {t.removeHighlight({ n: n + 1 })}
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="inline" className="mt-1" disabled={disabled || plan.highlights.length >= PROPOSAL_LIMITS.PLAN_HIGHLIGHTS}
                onClick={() => setPlan({ highlights: [...plan.highlights, { label: '', value: '' }] })}>
                {t.addHighlight}
              </Button>
            </li>
          );
        })}
      </ol>
      <Button
        variant="inline"
        className="mt-2"
        disabled={disabled || !planField || value.planOptions.length >= PROPOSAL_LIMITS.PLAN_OPTIONS}
        onClick={() => set('planOptions', [...value.planOptions, {
          name: planField?.options.map((o) => o.label).find((label) => !value.planOptions.some((p) => p.name === label)) ?? '',
          highlights: [{ label: '', value: '' }], popular: false,
        }])}
      >
        {t.addPlan}
      </Button>

      <FaqList
        idPrefix={id('faq')}
        entries={value.faq}
        onChange={(faq) => set('faq', faq)}
        disabled={disabled}
      />

      {/* Page 2's detail blocks, each once, with the illustration it was read from. */}
      <h4 className={`mt-4 ${H4}`}>{t.detail}</h4>
      <p className="text-sm text-muted">{t.detailHint}</p>
      <ol className="flex flex-col">
        {value.pdfDetail.map((block, at) => {
          const setBlock = (next: Partial<PdfDetailBlock>) => set('pdfDetail', replace(value.pdfDetail, at, { ...block, ...next }));
          const bid = (part: string) => id(`block-${at}-${part}`);
          const blockName = t.blocks[block.block];
          return (
            <li key={at} className={CARD} data-detail-block={block.block}>
              <div className="flex flex-wrap items-center gap-2">
                <Select aria-label={t.block} value={block.block} disabled={disabled}
                  onChange={(e) => setBlock({ block: e.target.value as PdfDetailBlockKind, notGuaranteed: false })}>
                  {PDF_DETAIL_BLOCKS.map((kind) => <option key={kind} value={kind}>{t.blocks[kind]}</option>)}
                </Select>
                {block.block === 'nilai_tunai' && (
                  <label className="flex items-center gap-2 text-md text-navy">
                    <input type="checkbox" checked={block.notGuaranteed} disabled={disabled} onChange={(e) => setBlock({ notGuaranteed: e.target.checked })} />
                    {t.notGuaranteed}
                  </label>
                )}
                <span className="ml-auto flex items-center">
                  <ReorderArrows label={t.blockName({ name: blockName })} index={at} count={value.pdfDetail.length}
                    disabled={disabled} onMove={(by) => set('pdfDetail', move(value.pdfDetail, at, by))} />
                  <Button variant="inlineDanger" disabled={disabled} onClick={() => set('pdfDetail', without(value.pdfDetail, at))}>
                    {t.removeBlock({ name: blockName })}
                  </Button>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Field label={t.sourceFile} htmlFor={bid('file')} className="min-w-60 flex-1">
                  <TextInput id={bid('file')} value={block.source.file} maxLength={120} disabled={disabled}
                    onChange={(e) => setBlock({ source: { ...block.source, file: e.target.value } })} />
                </Field>
                <Field label={t.sourcePage} htmlFor={bid('page')} className="w-24">
                  <TextInput id={bid('page')} inputMode="numeric" value={String(block.source.page || '')} disabled={disabled}
                    onChange={(e) => setBlock({ source: { ...block.source, page: Number(e.target.value.replace(/\D/g, '')) || 0 } })} />
                </Field>
                <Field label={t.sourceDate} htmlFor={bid('date')} className="min-w-40">
                  {/* The app's own date field (ADR-0173 D12): a past day, as the API takes it. */}
                  <DateField id={bid('date')} value={block.source.date} disabled={disabled}
                    max={dayInZone(OFFICE_TIME_ZONE, new Date())}
                    onChange={(date) => setBlock({ source: { ...block.source, date } })} />
                </Field>
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {block.rows.map((row, n) => {
                  const kind = row.text !== null && row.formula === null ? 'text' : 'formula';
                  const setRow = (next: Partial<typeof row>) => setBlock({ rows: replace(block.rows, n, { ...row, ...next }) });
                  return (
                    <li key={n} className="flex flex-wrap items-center gap-2">
                      <TextInput aria-label={t.rowLabel({ n: n + 1 })} value={row.label} maxLength={80} disabled={disabled} className="min-w-48 flex-1"
                        onChange={(e) => setRow({ label: e.target.value })} />
                      <Select aria-label={t.rowKind({ n: n + 1 })} value={kind} disabled={disabled}
                        onChange={(e) => (e.target.value === 'text'
                          ? setRow({ text: row.formula ?? '', formula: null })
                          : setRow({ formula: row.text ?? '', text: null }))}>
                        <option value="formula">{t.kinds.formula}</option>
                        <option value="text">{t.kinds.text}</option>
                      </Select>
                      <TextInput aria-label={t.rowValue({ n: n + 1 })} value={(kind === 'text' ? row.text : row.formula) ?? ''}
                        maxLength={kind === 'text' ? 80 : 120} disabled={disabled} className="min-w-40 flex-1"
                        onChange={(e) => setRow(kind === 'text' ? { text: e.target.value } : { formula: e.target.value })} />
                      <TextInput aria-label={t.rowNote({ n: n + 1 })} value={row.note ?? ''} maxLength={40} disabled={disabled} className="w-40"
                        onChange={(e) => setRow({ note: e.target.value })} />
                      <Button variant="inline" disabled={disabled} onClick={() => setBlock({ rows: without(block.rows, n) })}>
                        {t.removeRow({ n: n + 1 })}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <Button variant="inline" className="mt-1"
                disabled={disabled || block.rows.length >= (block.block === 'pengecualian' ? 3 : PROPOSAL_LIMITS.DETAIL_ROWS)}
                onClick={() => setBlock({ rows: [...block.rows, { label: '', note: null, formula: '', text: null }] })}>
                {t.addRow}
              </Button>
            </li>
          );
        })}
      </ol>
      <Button
        variant="inline"
        className="mt-2"
        disabled={disabled || value.pdfDetail.length >= PDF_DETAIL_BLOCKS.length}
        onClick={() => set('pdfDetail', [...value.pdfDetail, {
          block: PDF_DETAIL_BLOCKS.find((kind) => !value.pdfDetail.some((b) => b.block === kind)) ?? 'manfaat',
          rows: [{ label: '', note: null, formula: '', text: null }],
          source: { file: '', page: 1, date: '' },
          notGuaranteed: false,
        }])}
      >
        {t.addBlock}
      </Button>
    </section>
  );
}

