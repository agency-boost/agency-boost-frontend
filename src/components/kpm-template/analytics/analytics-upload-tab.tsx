'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, Card, Field, Select, TextInput } from '@/components/ui/field';
import { ChoiceField } from '@/components/ui/rows-and-sheets';
import { TonePill } from '@/components/ui/tone-pill';
import { checkAgentCodes } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import {
  columnErrors, csvHeader, freshKodes, kodeTyped, monthLabel, pairIn,
  type AdvancedAnalyticsConfig, type UploadField, type UploadUnit, type YtdRule,
} from '@/lib/advanced-analytics';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';
import { Kode, NumberBox, RowHead, Tag, useContentLanguage, type AnalyticsTabProps } from './analytics-shared';

/** The sample row's name in the CSV preview: the mockup's, a made-up agent. */
const SAMPLE_NAME = 'Budi Santoso';
/** The derived value's permanent kode (spec §3), drawn beside its name. */
const MAA_KODE = 'MAA_ACTIVE';
const UNITS: UploadUnit[] = ['rp_million', 'percent', 'count'];
const YTDS: YtdRule[] = ['sum', 'upload', 'none'];
/** How long the pattern rests before it is tested over the registered codes. */
const CHECK_AFTER_MS = 400;

/**
 * **Data upload** (P19.5-T1 AC-5 to AC-12; AA UI-011, UI-017, UI-018, UI-024; spec §6): the monthly columns — a table on
 * a desktop, cards below 768 px with 44 px targets — the column form, *Hapus* and the archive, *Nilai turunan*, *Aturan
 * unggahan* with the agent-code format tested as it is typed, and exactly the CSV header a KPM downloads.
 *
 * Every rule here is the server's too (`ANALYTICS_SYSTEM_COLUMN`, `ANALYTICS_UNIT_LOCKED`, …): the form says a mistake
 * under its field before anything is sent, and the API refuses what slips past.
 */
export function AnalyticsUploadTab(props: AnalyticsTabProps) {
  const { config, view, published, onChange, disabled } = props;
  const words = useMessages(adminTemplateAnalyticsMessages);
  const t = words.upload;
  const lang = useContentLanguage();
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UploadField | null>(null);
  const fresh = useMemo(() => freshKodes(published, config), [published, config]);
  const held = view?.held ?? {};
  const readers = (kode: string) => view?.readers[kode] ?? [];
  // One list at a time, so a row's form — and its fields' ids — is in the document once.
  // The cards below 1024px since P19.2-T2 AC-1 (UI-126: *no table on a phone or a tablet*); a phone's alone before.
  const phone = useMediaQuery(['phone', 'tablet']);

  const save = (field: UploadField, isNew: boolean) => {
    if (isNew) {
      onChange({
        ...config,
        uploadFields: [...config.uploadFields, field],
        // An archived kode added again is restored (AT-13): out of the archive, its values back.
        archivedFields: config.archivedFields.filter((f) => f.kode !== field.kode),
      });
    } else {
      onChange({ ...config, uploadFields: config.uploadFields.map((f) => (f.kode === field.kode ? field : f)) });
    }
    setEditing(null);
  };

  const remove = (field: UploadField) => {
    onChange({
      ...config,
      uploadFields: config.uploadFields.filter((f) => f.kode !== field.kode),
      archivedFields: [...config.archivedFields.filter((f) => f.kode !== field.kode), field],
    });
    setRemoving(null);
  };

  const badges = (f: UploadField) => (
    <>
      {f.system && (
        <span title={t.systemTip}><TonePill tone="grey">{t.system}</TonePill></span>
      )}
      {fresh.has(f.kode) && <TonePill tone="blue">{t.fresh({ month: monthLabel(f.effectiveFrom, lang) })}</TonePill>}
    </>
  );
  const subline = (f: UploadField) => [
    t.units[f.unit],
    f.max !== null && f.unit !== 'percent' ? `${f.min ?? 0}–${f.max}` : null,
    f.required ? t.required : null,
  ].filter(Boolean).join(' · ');
  const usedBy = (f: UploadField) => (readers(f.kode).length
    ? <span className="flex flex-wrap gap-1.5">{readers(f.kode).map((r) => <Tag key={r.id}>{lang === 'en' ? r.en : r.id}</Tag>)}</span>
    : <span className="text-sm text-muted">{t.unused}</span>);
  const actions = (f: UploadField) => {
    const name = pairIn(f.label, lang);
    return (
      <span className="flex items-center gap-1 md:gap-3">
        <Button variant="inline" className="max-md:min-h-11 max-md:min-w-11" aria-label={t.editName({ name })}
          disabled={disabled} onClick={() => setEditing(f.kode)}>
          {t.edit}
        </Button>
        {f.system ? (
          // Not pressable by mouse or keyboard, and it says why (AA UI-011).
          <Button variant="inline" className="max-md:min-h-11 max-md:min-w-11" disabled title={t.removeSystem}
            aria-label={t.removeSystemName({ name })}>
            {t.remove}
          </Button>
        ) : (
          <Button variant="inline" className="max-md:min-h-11 max-md:min-w-11 hover:text-alert"
            aria-label={t.removeName({ name })} disabled={disabled} onClick={() => setRemoving(f)}>
            {t.remove}
          </Button>
        )}
      </span>
    );
  };
  const form = (f: UploadField | null) => (
    <ColumnForm
      field={f}
      config={config}
      locked={f ? f.kode in held : false}
      nextMonth={view?.nextMonth ?? null}
      onSave={(next) => save(next, f === null)}
      onCancel={() => setEditing(null)}
      disabled={disabled}
    />
  );

  return (
    <>
      <RowHead title={t.heading} hint={t.hint}>
        <Button variant="secondary" disabled={disabled || editing === '__new'} onClick={() => setEditing('__new')}>
          {t.add}
        </Button>
      </RowHead>
      {editing === '__new' && (
        <Card className="mb-3">
          <h3 className="text-md font-bold text-navy">{t.newColumn}</h3>
          {form(null)}
        </Card>
      )}

      {/* A desktop's table. */}
      {!phone && (
      <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
        <table aria-label={t.heading} className="relative w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-divider text-xs font-bold uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2.5">{t.column}</th>
              <th scope="col" className="px-3 py-2.5">{t.ytd}</th>
              <th scope="col" className="px-3 py-2.5">{t.usedIn}</th>
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">{t.edit}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {config.uploadFields.map((f) => (editing === f.kode ? (
              <tr key={f.kode} className="bg-hover-row"><td colSpan={4} className="p-0">{form(f)}</td></tr>
            ) : (
              <tr key={f.kode} className="align-top">
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-md font-semibold text-navy">
                    {pairIn(f.label, lang)} {badges(f)}
                  </div>
                  <div className="mt-0.5 text-sm text-muted"><Kode>{f.kode}</Kode> · {subline(f)}</div>
                </td>
                <td className="px-3 py-3 text-sm text-muted">{t.ytdRules[f.ytd]}</td>
                <td className="px-3 py-3">{usedBy(f)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{actions(f)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      )}

      {/* Below 768 px, cards with 44 px targets (§6 *Screen sizes*). */}
      {phone && (
      <ul aria-label={t.heading} className="flex flex-col gap-2.5">
        {config.uploadFields.map((f) => (
          <li key={f.kode}>
            <Card>
              {editing === f.kode ? form(f) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 text-md font-semibold text-navy">
                    {pairIn(f.label, lang)} {badges(f)}
                  </div>
                  <p className="mt-0.5 text-sm text-muted"><Kode>{f.kode}</Kode> · {t.units[f.unit]} · {t.ytdRules[f.ytd]}</p>
                  <div className="mt-2">{usedBy(f)}</div>
                  <div className="mt-1.5">{actions(f)}</div>
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>
      )}

      <RowHead title={t.derivedHeading} hint={t.derivedHint} />
      <Card>
        <p className="text-md font-semibold text-navy">{t.maa} <Kode>{MAA_KODE}</Kode></p>
        <p className="mt-0.5 text-sm text-muted">{t.maaLead}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {config.uploadFields.filter((f) => f.system).map((f) => (
            <label key={f.kode} className="flex min-h-11 items-center gap-2 rounded-md border border-hairline px-2.5 text-md text-navy">
              {/* Fixed at APE and POLICY_COUNT (decision 1(b)): drawn, never changed. */}
              <input type="checkbox" disabled checked={config.derived.maaActiveIfAnyPositive.includes(f.kode)} readOnly />
              {pairIn(f.label, lang)}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t.maaHelp}</p>
      </Card>

      <RowHead title={t.rulesHeading} />
      <UploadRules {...props} />

      <RowHead id="analytics-csv-preview" title={t.previewHeading} hint={t.previewHint} />
      <CsvPreview config={config} fresh={fresh} />

      <Modal
        open={removing !== null}
        title={removing ? t.removeTitle({ name: pairIn(removing.label, lang) }) : ''}
        onClose={() => setRemoving(null)}
        className="max-w-[30rem]"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>{words.form.cancel}</Button>
            <Button variant="danger" onClick={() => removing && remove(removing)}>{t.removeConfirm}</Button>
          </div>
        )}
      >
        {removing && readers(removing.kode).length > 0 && (
          <p className="text-md text-navy">
            {t.removeUsed({ readers: readers(removing.kode).map((r) => (lang === 'en' ? r.en : r.id)).join(', ') })}
          </p>
        )}
        {removing && <p className="mt-2 text-sm text-muted">{t.removeKept({ kode: removing.kode })}</p>}
      </Modal>
    </>
  );
}

/**
 * ***Kolom baru* / *Ubah*** (AC-6, AC-7): *Kode* editable only when created; *Satuan* locked for a system column or once
 * a KPM holds data; *Berlaku mulai* a month picker, next month by default, read-only once there is data; every error
 * under its field.
 */
function ColumnForm({
  field,
  config,
  locked,
  nextMonth,
  onSave,
  onCancel,
  disabled,
}: {
  field: UploadField | null;
  config: AdvancedAnalyticsConfig;
  /** A KPM on the template holds a value for this kode. */
  locked: boolean;
  nextMonth: string | null;
  onSave: (field: UploadField) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const t = useMessages(adminTemplateAnalyticsMessages).form;
  const units = useMessages(adminTemplateAnalyticsMessages).upload;
  const lang = useContentLanguage();
  const isNew = field === null;
  const [kode, setKode] = useState(field?.kode ?? '');
  const [labelId, setLabelId] = useState(field?.label.id ?? '');
  const [labelEn, setLabelEn] = useState(field?.label.en ?? '');
  const [unit, setUnit] = useState<UploadUnit>(field?.unit ?? 'count');
  const [ytd, setYtd] = useState<YtdRule>(field?.ytd ?? 'sum');
  const [min, setMin] = useState<number | null>(field ? field.min : 0);
  const [max, setMax] = useState<number | null>(field ? field.max : null);
  const [tip, setTip] = useState(field ? pairIn(field.tip, lang) : '');
  const [from, setFrom] = useState(field?.effectiveFrom ?? nextMonth ?? '');
  const [required, setRequired] = useState(field?.required ?? false);
  const [tried, setTried] = useState(false);

  const archived = isNew ? config.archivedFields.find((f) => f.kode === kode) : undefined;
  // A system column's unit is fixed; an archived one comes back with its own (ADR-0214 §2); data locks either.
  const unitFixed = field?.system || locked || Boolean(archived);
  const taken = new Set(config.uploadFields.map((f) => f.kode));
  const errors = columnErrors({ kode, label: { id: labelId, en: labelEn }, unit, min, max }, isNew, taken);
  const say = (key: keyof typeof errors) => (tried && errors[key] ? t.errors[errors[key]!] : undefined);
  const id = (name: string) => `analytics-column-${field?.kode ?? 'new'}-${name}`;
  /** **No native select below 1024px** (P19.2-T2 AC-4; UI-134): *Satuan*'s three as choice rows. */
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  // *Tambah kolom* puts the reader in *Kode*, as the mockup's does.
  useEffect(() => { if (isNew) document.getElementById(`analytics-column-new-kode`)?.focus(); }, [isNew]);

  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length > 0) return;
    const base: UploadField = archived ?? field ?? {
      kode, system: false, label: { id: '', en: '' }, labelAliases: [], unit, ytd, min, max, required,
      rows: 'all', effectiveFrom: from, tip: { id: '', en: '' },
    };
    onSave({
      ...base,
      kode: field?.kode ?? kode,
      label: { id: labelId.trim(), en: labelEn.trim() },
      unit: unitFixed ? base.unit : unit,
      ytd: field?.system ? 'sum' : ytd,
      min: unit === 'percent' && min === null ? 0 : min,
      max: unit === 'percent' && max === null ? 100 : max,
      required,
      effectiveFrom: locked || archived ? base.effectiveFrom : from,
      tip: { ...base.tip, [lang]: tip.trim() },
    });
  };

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 py-3 md:grid-cols-2 md:p-4">
      <Field label={t.kode} htmlFor={id('kode')} hint={isNew ? t.kodeHelpNew : t.kodeHelpSaved} error={say('kode')}>
        <TextInput
          id={id('kode')}
          value={kode}
          readOnly={!isNew}
          placeholder={t.kodePlaceholder}
          invalid={Boolean(say('kode'))}
          onChange={(e) => setKode(kodeTyped(e.target.value))}
        />
      </Field>
      {belowLaptop ? (
        <ChoiceField<UploadUnit>
          id={id('unit')}
          label={t.unit}
          hint={field?.system ? t.unitSystem : unitFixed ? t.unitLocked : undefined}
          value={unitFixed ? (archived ?? field)!.unit : unit}
          disabled={unitFixed}
          onChange={setUnit}
          options={UNITS.map((u) => ({ key: u, label: units.units[u] }))}
        />
      ) : (
        <Field
          label={t.unit}
          htmlFor={id('unit')}
          hint={field?.system ? t.unitSystem : unitFixed ? t.unitLocked : undefined}
        >
          <Select id={id('unit')} value={unitFixed ? (archived ?? field)!.unit : unit} disabled={unitFixed}
            onChange={(e) => setUnit(e.target.value as UploadUnit)}>
            {UNITS.map((u) => <option key={u} value={u}>{units.units[u]}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t.nameId} htmlFor={id('id')} error={say('labelId')}>
        <TextInput id={id('id')} value={labelId} invalid={Boolean(say('labelId'))} onChange={(e) => setLabelId(e.target.value)} />
      </Field>
      <Field label={t.nameEn} htmlFor={id('en')}>
        <TextInput id={id('en')} value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
      </Field>
      <fieldset className="md:col-span-2" aria-describedby={id('ytd-help')}>
        <legend className="mb-1 text-sm font-semibold text-navy">{t.ytd}</legend>
        <div className="flex flex-wrap gap-1.5">
          {YTDS.map((rule) => (
            <label key={rule} className={cn(
              'flex min-h-11 items-center gap-2 rounded-md border bg-card px-2.5 text-md text-navy md:min-h-9',
              (field?.system ? 'sum' : ytd) === rule ? 'border-secondary' : 'border-hairline',
            )}>
              <input type="radio" name={id('ytd')} value={rule} checked={(field?.system ? 'sum' : ytd) === rule}
                disabled={field?.system} onChange={() => setYtd(rule)} />
              {units.ytdRules[rule]}
            </label>
          ))}
        </div>
        <p id={id('ytd-help')} className="mt-1 text-xs text-muted">{t.ytdHelp}</p>
      </fieldset>
      <Field label={t.min} htmlFor={id('min')} error={say('min')}>
        <NumberBox id={id('min')} value={min} nullable step={0.01} onValue={setMin} invalid={Boolean(say('min'))}
          className="w-full text-left" />
      </Field>
      <Field label={t.max} htmlFor={id('max')} error={say('max')}>
        <NumberBox id={id('max')} value={max} nullable step={0.01} onValue={setMax} placeholder={t.maxPlaceholder}
          invalid={Boolean(say('max'))} className="w-full text-left" />
      </Field>
      <Field label={t.tip} htmlFor={id('tip')} className="md:col-span-2">
        <TextInput id={id('tip')} value={tip} onChange={(e) => setTip(e.target.value)} />
      </Field>
      <Field label={t.from} htmlFor={id('from')} hint={locked ? t.fromLocked : t.fromHelp}>
        <TextInput id={id('from')} type="month" value={from} readOnly={locked || Boolean(archived)}
          onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <div className="flex flex-col justify-end gap-1">
        <label className="flex min-h-11 items-center gap-2 text-md text-navy">
          <input type="checkbox" checked={required} aria-describedby={id('req-help')} onChange={(e) => setRequired(e.target.checked)} />
          {t.required}
        </label>
        <p id={id('req-help')} className="text-xs text-muted">{t.requiredHelp}</p>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button onClick={submit} disabled={disabled}>{t.save}</Button>
        <Button variant="secondary" onClick={onCancel}>{t.cancel}</Button>
      </div>
    </div>
  );
}

/**
 * ***Aturan unggahan*** (AC-11; AA UI-016, UI-018, AT-10): the agent-code format and its example, tested over every
 * registered code of every KPM on the template as they are typed, and saved into the draft only once the server takes
 * both; what an unregistered code does; the history, read-only; the share of agents that completes a month; and the
 * YTD check's tolerance, only while a column's YTD is uploaded.
 */
function UploadRules({ config, view, onChange, disabled, companyId, templateId }: AnalyticsTabProps) {
  const t = useMessages(adminTemplateAnalyticsMessages).upload;
  const rules = config.uploadRules;
  /** **No native select below 1024px** (P19.2-T2 AC-4; UI-134): what an unregistered code does, two choice rows. */
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [pattern, setPattern] = useState(rules.agentCodePattern);
  const [example, setExample] = useState(rules.agentCodeExample);
  const [check, setCheck] = useState<
    | { state: 'checking' }
    | { state: 'done'; mismatched: number; total: number; examples: string[]; exampleMatches: boolean }
    | { state: 'refused'; message: string }
  >({ state: 'checking' });
  const latest = useRef({ config, onChange });
  latest.current = { config, onChange };

  useEffect(() => {
    let live = true;
    setCheck({ state: 'checking' });
    const timer = setTimeout(() => {
      checkAgentCodes(companyId, templateId, pattern, example)
        .then((answer) => {
          if (!live) return;
          const exampleMatches = answer.exampleMatches !== false;
          setCheck({ state: 'done', ...answer, exampleMatches });
          const now = latest.current.config;
          // Into the draft once the server reads the pattern and the example matches it: never a refusal on save.
          if (exampleMatches && (now.uploadRules.agentCodePattern !== pattern || now.uploadRules.agentCodeExample !== example)) {
            latest.current.onChange({ ...now, uploadRules: { ...now.uploadRules, agentCodePattern: pattern, agentCodeExample: example } });
          }
        })
        .catch((err) => { if (live) setCheck({ state: 'refused', message: toDisplayError(err).message }); });
    }, CHECK_AFTER_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [companyId, templateId, pattern, example]);

  const set = (change: Partial<AdvancedAnalyticsConfig['uploadRules']>) =>
    onChange({ ...config, uploadRules: { ...rules, ...change } });
  const mismatch = check.state === 'done' && check.mismatched > 0;
  const bad = mismatch || check.state === 'refused';
  const limits = view?.limits;

  return (
    <Card className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="analytics-code-format" className="text-sm font-semibold text-navy">{t.codeFormat}</label>
        <TextInput
          id="analytics-code-format"
          value={pattern}
          invalid={bad}
          disabled={disabled}
          maxLength={limits?.codePatternMaxLength}
          aria-describedby="analytics-code-format-help analytics-code-format-check"
          className="font-mono"
          onChange={(e) => setPattern(e.target.value)}
        />
        <p id="analytics-code-format-help" className="text-xs text-muted">{t.codeFormatHelp({ example })}</p>
        <p id="analytics-code-format-check" role="status" className={cn('text-xs', bad ? 'font-semibold text-alert' : 'text-muted')}>
          {check.state === 'checking' && t.codeChecking}
          {check.state === 'refused' && check.message}
          {check.state === 'done' && (check.mismatched > 0
            ? t.codeMismatch({ n: check.mismatched, total: check.total, examples: check.examples.join(', ') })
            : t.codeAllMatch({ total: check.total }))}
        </p>
      </div>
      <Field
        label={t.example}
        htmlFor="analytics-code-example"
        error={check.state === 'done' && !check.exampleMatches ? t.exampleMismatch : undefined}
      >
        <TextInput id="analytics-code-example" value={example} disabled={disabled} className="font-mono"
          invalid={check.state === 'done' && !check.exampleMatches} onChange={(e) => setExample(e.target.value)} />
      </Field>
      {belowLaptop ? (
        <ChoiceField<'flag' | 'reject'>
          id="analytics-unknown-agent"
          label={t.unknownAgent}
          value={rules.unknownAgent}
          disabled={disabled}
          onChange={(unknownAgent) => set({ unknownAgent })}
          options={[{ key: 'flag', label: t.unknownFlag }, { key: 'reject', label: t.unknownReject }]}
        />
      ) : (
        <Field label={t.unknownAgent} htmlFor="analytics-unknown-agent">
          <Select id="analytics-unknown-agent" value={rules.unknownAgent} disabled={disabled}
            onChange={(e) => set({ unknownAgent: e.target.value as 'flag' | 'reject' })}>
            <option value="flag">{t.unknownFlag}</option>
            <option value="reject">{t.unknownReject}</option>
          </Select>
        </Field>
      )}
      <div className="flex flex-col gap-1">
        <span id="analytics-history" className="text-sm font-semibold text-navy">{t.history}</span>
        <p aria-labelledby="analytics-history" className="flex h-10 items-center rounded-md bg-pill-grey px-3 text-md text-muted">
          {t.historyValue({ n: rules.historyMonthsBeforeJoin })}
        </p>
        <p className="text-xs text-muted">{t.historyHelp}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="analytics-complete" className="text-sm font-semibold text-navy">{t.complete}</label>
        <span className="flex items-center gap-2 text-md text-navy">
          <NumberBox id="analytics-complete" value={rules.completePct} min={limits?.completePctMin} max={limits?.completePctMax}
            disabled={disabled} onValue={(n) => n !== null && set({ completePct: n })} className="w-24" />
          {t.completeUnit}
        </span>
      </div>
      {config.uploadFields.some((f) => f.ytd === 'upload') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="analytics-tolerance" className="text-sm font-semibold text-navy">{t.tolerance}</label>
          <span className="flex items-center gap-2 text-md text-navy">
            <NumberBox id="analytics-tolerance" value={rules.ytdTolerancePct} min={0} max={limits?.ytdTolerancePctMax}
              step={0.5} disabled={disabled} onValue={(n) => n !== null && set({ ytdTolerancePct: n })} className="w-24"
              describedBy="analytics-tolerance-help" />
            %
          </span>
          <p id="analytics-tolerance-help" className="text-xs text-muted">{t.toleranceHelp}</p>
        </div>
      )}
    </Card>
  );
}

/** ***Pratinjau template CSV*** (AC-12): exactly the header a KPM downloads, a new column marked, and one sample row. */
function CsvPreview({ config, fresh }: { config: AdvancedAnalyticsConfig; fresh: ReadonlySet<string> }) {
  const lang = useContentLanguage();
  const header = csvHeader(config, lang, fresh);
  return (
    <div className="overflow-x-auto rounded-lg border border-card-edge bg-card">
      <table aria-labelledby="analytics-csv-preview" className="relative min-w-full border-collapse font-mono text-xs">
        <thead>
          <tr>
            {header.map((h) => (
              <th key={h.text} scope="col" className={cn(
                'whitespace-nowrap border-r border-divider px-2.5 py-2 text-left font-semibold text-navy',
                h.fresh ? 'bg-pill-blue' : 'bg-pill-grey',
              )}>
                {h.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {header.map((h, i) => (
              <td key={h.text} className="whitespace-nowrap border-r border-divider px-2.5 py-2 text-muted">
                {i === 0 ? config.uploadRules.agentCodeExample : i === 1 ? SAMPLE_NAME : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
