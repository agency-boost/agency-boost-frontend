'use client';

import { useCallback, useEffect, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataMessages } from '@/i18n/messages/product-data';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { formatCalendarDay, formatDateTime, formatMoneyInFull, formatRupiahCompact } from '@/lib/format';
import {
  activateRateTable, deleteRateTable, RATE_COLUMN_ROLES, RATE_TEST_PROFILES, rateTemplate, readRateTable, setRateTests,
  turnOffRateTable, updateRateTable, uploadRateTable,
  type FrequencyFactors, type ProductDataDetail, type RateColumnRole, type RateGap, type RateRules, type RateTableStatus,
  type RateTableView, type RateTestInput,
} from '@/lib/product-data';
import { saveFile } from '@/lib/save-file';

const CARD = 'rounded-lg border border-hairline bg-card p-4';
const H4 = 'font-display text-md font-bold text-navy';
const STATUS_TONE: Record<RateTableStatus, PillTone> = { draft: 'grey', scheduled: 'blue', active: 'green', old: 'grey', off: 'red' };
const FACTOR_KEYS = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
const RULE_AMOUNTS = ['upStep', 'upMin', 'upMax', 'premiumMin', 'premiumMax'] as const;

type Problem = { row: number; column: string; value: string; reason: keyof typeof REASON_KEYS };
const REASON_KEYS = {
  number: 1, age: 1, gender: 1, smoker: 1, plan: 1, payTerm: 1, currency: 1, frequency: 1, duplicate: 1, band: 1, range: 1,
} as const;

/** A test profile as the form holds it: the amounts in whole rupiah, as typed. */
interface TestRow { age: string; gender: 'male' | 'female'; smoker: boolean | null; plan: string; payTerm: string; payFrequency: string; amount: string; expected: string }

/**
 * ***Tabel premi*** (P19.15-T1 AC-1 to AC-4; ADR-0258 §2 to §6; the P1b spec's *Tab "Tabel premi"*): what to upload, in
 * plain words, with the product's own template; then **four short steps on one page** for the newest draft —
 *
 * 1. **Upload** the Excel or CSV with *Berlaku mulai* and an optional *Berlaku sampai*;
 * 2. ***Cocokkan kolom***: each column's meaning, suggested, confirmed or changed — every cell the server cannot read
 *    named by its row;
 * 3. ***Cek kelengkapan***: every gap in plain words, blocking nothing; and the ***Ketentuan*** the table brings, old →
 *    new, saved by a person (read from the file's sheet where it has one);
 * 4. ***Uji 3 contoh***: three cases from the illustration, the app's result beside each, ✓ within Rp1 — and *Aktifkan*,
 *    which the server allows only when all three match or a reason is written.
 *
 * Then **every version**: *Berlaku*, *Terjadwal*, *Lama*, *Mati*, *Draf*, who uploaded it, its three results — *Matikan*
 * for one activated, *Hapus* for one no proposal used. Read-only for a reader who may not manage the company.
 */
export function RateTableTab({ companyId, detail, canManage, onChanged }: {
  companyId: string; detail: ProductDataDetail; canManage: boolean; onChanged: () => Promise<void> | void;
}) {
  const t = useMessages(productDataMessages).table;
  const figures = useFigureLanguage();
  const product = detail.product;
  const draftRow = detail.versions.find((v) => v.status === 'draft') ?? null;
  const [draft, setDraft] = useState<RateTableView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [problems, setProblems] = useState<{ list: Problem[]; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'off' | 'delete'; id: string } | null>(null);
  const day = (d: string | null) => (d ? formatCalendarDay(d, figures) : '');

  const loadDraft = useCallback(async () => {
    if (!draftRow) { setDraft(null); return; }
    try {
      setDraft(await readRateTable(companyId, draftRow.id));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId, draftRow]);
  useEffect(() => { void loadDraft(); }, [loadDraft]);

  /** Every write: the answer is the draft, then the product read again, so the version list agrees. */
  const run = async (call: () => Promise<RateTableView | void>) => {
    setBusy(true);
    setError(null);
    setProblems(null);
    try {
      const answer = await call();
      if (answer && answer.status === 'draft') setDraft(answer);
      await onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.code === 'RATE_TABLE_ROWS_INVALID') {
        const details = err.error.details as { problems: Problem[]; count: number };
        setProblems({ list: details.problems, count: details.count });
      } else {
        setError(toDisplayError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const template = async (format: 'xlsx' | 'csv') => {
    try {
      saveFile(await rateTemplate(companyId, product.id, format), `Tabel-premi-${product.code}.${format}`);
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  return (
    <div data-rate-table-tab="" className="flex flex-col gap-4">
      <div className={CARD}>
        <h4 className={H4}>{t.title}</h4>
        <p className="mt-1 text-sm text-navy">{t.what}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { void template('xlsx'); }}>{t.template}</Button>
          <Button variant="inline" onClick={() => { void template('csv'); }}>{t.templateCsv}</Button>
        </div>
        <p data-in-force="" className="mt-3 text-sm font-semibold text-navy">
          {detail.inForce ? t.inForce({ version: detail.inForce.version, date: day(detail.inForce.effectiveFrom) }) : t.none}
          {detail.scheduled && <span className="block font-normal text-muted">{t.scheduled({ version: detail.scheduled.version, date: day(detail.scheduled.effectiveFrom) })}</span>}
        </p>
      </div>

      {error && <ErrorBanner {...error} />}

      {canManage && !draftRow && <UploadStep companyId={companyId} productId={product.id} busy={busy} onUpload={run} />}

      {canManage && draft && (
        <DraftSteps
          companyId={companyId}
          draft={draft}
          detail={detail}
          busy={busy}
          problems={problems}
          run={run}
          onDelete={() => setConfirm({ kind: 'delete', id: draft.id })}
        />
      )}

      <section aria-labelledby="rate-versions" className={CARD}>
        <h4 id="rate-versions" className={H4}>{t.versions}</h4>
        <ul className="mt-2 flex flex-col divide-y divide-divider">
          {detail.versions.map((v) => (
            <li key={v.id} data-version={v.version} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-navy">{t.version({ n: v.version })}</span>
                  <TonePill tone={STATUS_TONE[v.status]}>{t.statuses[v.status]}</TonePill>
                </span>
                <span className="text-sm text-navy">
                  {v.effectiveTo ? t.range({ from: day(v.effectiveFrom), to: day(v.effectiveTo) }) : t.openEnded({ from: day(v.effectiveFrom) })}
                  {' · '}{v.source.fileName}
                </span>
                <span className="text-sm text-muted">
                  {t.uploadedBy({ name: v.uploadedBy.name ?? t.unknown, date: formatDateTime(v.uploadedAt, undefined, figures) })}
                </span>
                {v.testCases.length > 0 && (
                  <span className="text-sm text-muted">{t.testsResult({ n: v.testCases.filter((c) => c.match).length, of: v.testCases.length })}</span>
                )}
                {v.overrideReason && <span className="text-sm text-muted">{t.overridden({ reason: v.overrideReason })}</span>}
              </div>
              {canManage && v.status !== 'draft' && (
                <div className="flex flex-wrap gap-2">
                  {(v.status === 'active' || v.status === 'scheduled') && (
                    <Button variant="danger" disabled={busy} onClick={() => setConfirm({ kind: 'off', id: v.id })}>{t.turnOff}</Button>
                  )}
                  {!v.used && <Button variant="inlineDanger" disabled={busy} onClick={() => setConfirm({ kind: 'delete', id: v.id })}>{t.remove}</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Modal
        open={confirm !== null}
        title={confirm?.kind === 'off' ? t.turnOffTitle : t.removeTitle}
        description={confirm?.kind === 'off' ? t.turnOffBody : t.removeBody}
        onClose={() => setConfirm(null)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)}>{t.cancel}</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const target = confirm!;
                setConfirm(null);
                void run(() => (target.kind === 'off' ? turnOffRateTable(companyId, target.id) : deleteRateTable(companyId, target.id)));
              }}
            >
              {confirm?.kind === 'off' ? t.turnOff : t.remove}
            </Button>
          </div>
        )}
      >
        <span />
      </Modal>
    </div>
  );
}

/** Step 1: the file and its dates. */
function UploadStep({ companyId, productId, busy, onUpload }: {
  companyId: string; productId: string; busy: boolean; onUpload: (call: () => Promise<RateTableView>) => Promise<void>;
}) {
  const t = useMessages(productDataMessages).table;
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <section aria-labelledby="rate-step-1" data-step="1" className={CARD}>
      <h4 id="rate-step-1" className={H4}>{t.step1}</h4>
      <div className="mt-2 flex max-w-form flex-wrap items-end gap-3">
        <Field label={t.file} htmlFor="rate-file" className="min-w-60 flex-1">
          <input id="rate-file" type="file" accept=".xlsx,.csv" disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="min-h-11 text-md text-navy" />
        </Field>
        <Field label={t.effectiveFrom} htmlFor="rate-from" className="w-48">
          <DateField id="rate-from" value={from} onChange={setFrom} />
        </Field>
        <Field label={t.effectiveTo} htmlFor="rate-to" className="w-48">
          <DateField id="rate-to" value={to} onChange={setTo} />
        </Field>
        <Button disabled={busy || !file || !from} onClick={() => { void onUpload(() => uploadRateTable(companyId, productId, file!, from, to || null)); }}>
          {busy ? t.uploading : t.upload}
        </Button>
      </div>
    </section>
  );
}

/** Steps 2 to 4 for the newest draft. */
function DraftSteps({ companyId, draft, detail, busy, problems, run, onDelete }: {
  companyId: string;
  draft: RateTableView;
  detail: ProductDataDetail;
  busy: boolean;
  problems: { list: Problem[]; count: number } | null;
  run: (call: () => Promise<RateTableView>) => Promise<void>;
  onDelete: () => void;
}) {
  const words = useMessages(productDataMessages);
  const t = words.table;
  const isian = words.isian;
  const figures = useFigureLanguage();
  const product = detail.product;
  const [map, setMap] = useState<Record<string, RateColumnRole>>(draft.file?.columnMap ?? {});
  const [rules, setRules] = useState<RateRules>(draft.rules);
  const [factors, setFactors] = useState<FrequencyFactors>(draft.frequencies);
  const [tests, setTests] = useState<TestRow[]>(() => testsOf(draft, product.rules.payTerms[0]?.key ?? ''));
  const [reason, setReason] = useState(draft.overrideReason ?? '');

  useEffect(() => {
    setMap(draft.file?.columnMap ?? {});
    setRules(draft.rules);
    setFactors(draft.frequencies);
  }, [draft]);

  const money = (minor: number | null) => (minor === null ? '–' : formatRupiahCompact(minor, { lossless: true }, figures));
  const plans = product.rules.proposalFields.find((f) => f.plan)?.options.map((o) => o.label) ?? [];
  const allMatch = draft.testCases.length === RATE_TEST_PROFILES && draft.testCases.every((c) => c.match);

  return (
    <div data-draft={draft.version} className="flex flex-col gap-4">
      {draft.file && (
        <section aria-labelledby="rate-step-2" data-step="2" className={CARD}>
          <h4 id="rate-step-2" className={H4}>{t.step2}</h4>
          <p className="text-sm text-muted">{t.step2Hint}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="relative min-w-full text-sm">
              <caption className="sr-only">{t.preview({ n: draft.file.rows })}</caption>
              <thead>
                <tr>
                  {draft.file.header.map((column, i) => (
                    <th key={i} scope="col" className="px-2 py-1 text-left align-bottom">
                      <span className="block font-semibold text-navy">{column || '–'}</span>
                      <Select aria-label={column || `#${i + 1}`} value={map[column] ?? 'ignore'} disabled={busy}
                        onChange={(e) => setMap({ ...map, [column]: e.target.value as RateColumnRole })}>
                        {RATE_COLUMN_ROLES.map((role) => <option key={role} value={role}>{t.roles[role]}</option>)}
                      </Select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.file.preview.map((row, r) => (
                  <tr key={r} className="border-t border-divider">
                    {draft.file!.header.map((_, c) => <td key={c} className="px-2 py-1 text-navy">{row[c] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-sm text-muted">{t.preview({ n: draft.file.rows })}</p>
          {problems && (
            <div role="alert" data-problems="" className="mt-2 text-sm text-alert">
              <p className="font-semibold">{t.problems}</p>
              <ul className="list-disc pl-5">
                {problems.list.map((p, i) => (
                  <li key={i}>{t.problem({ row: p.row, column: p.column, value: p.value })} — {t.reasons[p.reason in REASON_KEYS ? p.reason : 'number']}</li>
                ))}
              </ul>
              {problems.count > problems.list.length && <p>{t.moreGaps({ n: problems.count - problems.list.length })}</p>}
            </div>
          )}
          <Button className="mt-3" disabled={busy} onClick={() => { void run(() => updateRateTable(companyId, draft.id, { columnMap: map })); }}>
            {t.confirmColumns}
          </Button>
        </section>
      )}

      {draft.mapped && (
        <section aria-labelledby="rate-step-3" data-step="3" className={CARD}>
          <h4 id="rate-step-3" className={H4}>{t.step3}</h4>
          <p className="text-sm text-navy">{t.rows({ n: draft.rowCount })}</p>
          {draft.gapCount === 0 ? (
            <p data-gaps="0" className="mt-1 text-sm text-success">{t.noGaps}</p>
          ) : (
            <>
              <ul data-gaps={draft.gapCount} className="mt-1 list-disc pl-5 text-sm text-navy">
                {draft.gaps.map((gap, i) => <li key={i}>{gapWords(gap, t.gaps)}</li>)}
              </ul>
              {draft.gapCount > draft.gaps.length && <p className="text-sm text-muted">{t.moreGaps({ n: draft.gapCount - draft.gaps.length })}</p>}
              <p className="mt-1 text-sm text-muted">{t.gapsHint}</p>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="rate-rules" data-rules={draft.rulesConfirmed ? 'confirmed' : 'to-confirm'} className={CARD}>
        <h4 id="rate-rules" className={H4}>{t.rules}</h4>
        <p className="text-sm text-muted">{draft.rulesSource === 'ketentuan' && !draft.rulesConfirmed ? t.rulesFromFile : t.rulesHint}</p>
        {draft.file && draft.file.ketentuanProblems.length > 0 && (
          <div className="mt-1 text-sm text-alert">
            <p>{t.ketentuanProblems}</p>
            <ul className="list-disc pl-5">{draft.file.ketentuanProblems.map((p) => <li key={p.row}>{p.label}: “{p.value}”</li>)}</ul>
          </div>
        )}
        <div className="mt-3 flex max-w-form flex-col gap-2">
          {RULE_AMOUNTS.map((key) => {
            const changed = draft.previous.rules[key] !== rules[key];
            return (
              <div key={key} className="flex flex-wrap items-end gap-3" data-rule={key} data-changed={changed ? '' : undefined}>
                <Field label={isian[key]} htmlFor={`rule-${key}`} className="w-48">
                  <TextInput id={`rule-${key}`} inputMode="numeric" disabled={busy}
                    value={rules[key] === null ? '' : String(Math.round(rules[key]! / 100))}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setRules({ ...rules, [key]: digits === '' ? null : Number(digits) * 100 });
                    }} />
                </Field>
                <span className={changed ? 'text-sm font-semibold text-navy' : 'text-sm text-muted'}>
                  {t.old}: {money(draft.previous.rules[key])} → {t.new}: {money(rules[key])}
                </span>
              </div>
            );
          })}
          <p className="mt-2 text-sm font-semibold text-navy">{t.factors}</p>
          <p className="text-sm text-muted">{t.factorHint}</p>
          <div className="flex flex-wrap gap-3">
            {FACTOR_KEYS.map((key) => (
              <Field key={key} label={isian.frequencyNames[key]} htmlFor={`factor-${key}`} className="w-32">
                <TextInput id={`factor-${key}`} inputMode="decimal" disabled={busy}
                  value={factors[key] === null ? '' : String(factors[key]).replace('.', figures === 'id' ? ',' : '.')}
                  onChange={(e) => {
                    const text = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                    setFactors({ ...factors, [key]: text === '' ? null : Number(text) });
                  }} />
              </Field>
            ))}
          </div>
          <Button variant="secondary" className="mt-2 self-start" disabled={busy}
            onClick={() => { void run(() => updateRateTable(companyId, draft.id, { rules, frequencies: factors })); }}>
            {t.saveRules}
          </Button>
        </div>
      </section>

      {draft.mapped && (
        <section aria-labelledby="rate-step-4" data-step="4" className={CARD}>
          <h4 id="rate-step-4" className={H4}>{t.step4}</h4>
          <p className="text-sm text-muted">{t.step4Hint}</p>
          <ol className="mt-3 flex flex-col gap-3">
            {tests.map((test, i) => {
              const result = draft.testCases[i];
              const update = (next: Partial<TestRow>) => setTests(tests.map((x, j) => (j === i ? { ...x, ...next } : x)));
              const fid = (part: string) => `test-${i}-${part}`;
              return (
                <li key={i} data-test={i + 1} className="flex flex-col gap-2 rounded-md bg-hover-row p-3">
                  <span className="text-sm font-semibold text-navy">{t.test({ n: i + 1 })}</span>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label={t.testAge} htmlFor={fid('age')} className="w-20">
                      <TextInput id={fid('age')} inputMode="numeric" value={test.age} disabled={busy} onChange={(e) => update({ age: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <Field label={t.testGender} htmlFor={fid('gender')} className="w-36">
                      <Select id={fid('gender')} value={test.gender} disabled={busy} onChange={(e) => update({ gender: e.target.value as 'male' | 'female' })}>
                        <option value="male">{t.gaps.genders.male}</option>
                        <option value="female">{t.gaps.genders.female}</option>
                      </Select>
                    </Field>
                    {product.rules.smokerRated && (
                      <label className="flex min-h-11 items-center gap-2 text-sm text-navy">
                        <input type="checkbox" checked={test.smoker === true} disabled={busy} onChange={(e) => update({ smoker: e.target.checked })} />
                        {t.testSmoker}
                      </label>
                    )}
                    {plans.length > 0 && (
                      <Field label={t.testPlan} htmlFor={fid('plan')} className="w-36">
                        <Select id={fid('plan')} value={test.plan} disabled={busy} onChange={(e) => update({ plan: e.target.value })}>
                          <option value="">–</option>
                          {plans.map((p) => <option key={p} value={p}>{p}</option>)}
                        </Select>
                      </Field>
                    )}
                    {product.rules.payTerms.length > 0 && (
                      <Field label={t.testTerm} htmlFor={fid('term')} className="w-40">
                        <Select id={fid('term')} value={test.payTerm} disabled={busy} onChange={(e) => update({ payTerm: e.target.value })}>
                          {product.rules.payTerms.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </Select>
                      </Field>
                    )}
                    <Field label={t.testFrequency} htmlFor={fid('freq')} className="w-36">
                      <Select id={fid('freq')} value={test.payFrequency} disabled={busy} onChange={(e) => update({ payFrequency: e.target.value })}>
                        {(['monthly', 'quarterly', 'semiannual', 'annual', 'single'] as const).map((f) => <option key={f} value={f}>{isian.frequencyNames[f]}</option>)}
                      </Select>
                    </Field>
                    <Field label={t.testAmount} htmlFor={fid('amount')} className="w-40">
                      <TextInput id={fid('amount')} inputMode="numeric" value={test.amount} disabled={busy} onChange={(e) => update({ amount: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <Field label={t.testExpected} htmlFor={fid('expected')} className="w-40">
                      <TextInput id={fid('expected')} inputMode="numeric" value={test.expected} disabled={busy} onChange={(e) => update({ expected: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                  </div>
                  {result && (
                    <p data-test-result={result.match ? 'match' : 'differs'} className="text-sm text-navy">
                      {t.testActual}: {result.actualMinor === null ? t.noResult : formatMoneyInFull(result.actualMinor, product.currencies[0] ?? 'IDR', figures)}
                      {' '}<TonePill tone={result.match ? 'green' : 'red'}>{result.match ? `✓ ${t.matches}` : t.differs}</TonePill>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <Button variant="secondary" className="mt-3" disabled={busy || tests.some((x) => !x.age || !x.amount || !x.expected)}
            onClick={() => { void run(() => setRateTests(companyId, draft.id, tests.map(inputOfRow))); }}>
            {t.runTests}
          </Button>

          {!allMatch && (
            <Field label={t.reason} htmlFor="rate-reason" hint={t.reasonHint} className="mt-4 max-w-form">
              <Textarea id="rate-reason" value={reason} maxLength={500} disabled={busy} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          <p className="mt-3 text-sm text-muted">{t.activateNote}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy || (!allMatch && reason.trim() === '')}
              onClick={() => { void run(() => activateRateTable(companyId, draft.id, allMatch ? null : reason.trim())); }}>
              {t.activate}
            </Button>
            <Button variant="inlineDanger" disabled={busy} onClick={onDelete}>{t.remove}</Button>
          </div>
        </section>
      )}
    </div>
  );
}

/** The draft's stored profiles as the form holds them, else three empty rows on the product's first pay term. */
function testsOf(draft: RateTableView, payTerm: string): TestRow[] {
  return Array.from({ length: RATE_TEST_PROFILES }, (_, i) => {
    const c = draft.testCases[i];
    return c
      ? {
        age: String(c.inputs.age), gender: c.inputs.gender, smoker: c.inputs.smoker, plan: c.inputs.plan ?? '',
        payTerm: c.inputs.payTerm ?? payTerm, payFrequency: c.inputs.payFrequency,
        amount: String(Math.round(c.inputs.amountMinor / 100)), expected: String(Math.round(c.expectedMinor / 100)),
      }
      : { age: '', gender: 'male', smoker: null, plan: '', payTerm, payFrequency: 'monthly', amount: '', expected: '' };
  });
}

function inputOfRow(row: TestRow): RateTestInput & { expectedMinor: number } {
  return {
    age: Number(row.age), gender: row.gender, smoker: row.smoker, plan: row.plan || null, payTerm: row.payTerm || null,
    payFrequency: row.payFrequency as RateTestInput['payFrequency'], amountMinor: Number(row.amount) * 100,
    expectedMinor: Number(row.expected) * 100,
  };
}

/** **A gap in plain words** (*Cek kelengkapan*): *"Usia 61–65 tidak ada di tabel"*, *"Plan MAX, bayar 15 tahun tidak ada"*. */
export function gapWords(gap: RateGap, g: GapWords): string {
  const term = gap.payTermLabel ?? gap.payTerm ?? '';
  switch (gap.kind) {
    case 'ages': {
      const what = [
        gap.plan ? `Plan ${gap.plan}` : null,
        term || null,
        gap.gender ? g.genders[gap.gender] : null,
        gap.smoker === true ? g.smokerWord : gap.smoker === false ? g.nonSmokerWord : null,
      ].filter(Boolean).join(', ');
      return what ? g.agesFor({ from: gap.from ?? 0, to: gap.to ?? 0, what }) : g.ages({ from: gap.from ?? 0, to: gap.to ?? 0 });
    }
    case 'combination': return g.combination({ plan: gap.plan ?? '', term });
    case 'smoker': return g.smoker;
    case 'gender': return g.gender({ gender: g.genders[gap.gender ?? 'female'] });
    case 'plan': return g.plan({ plan: gap.plan ?? '' });
    case 'payTerm': return g.payTerm({ term });
    default: return g.currency({ currency: gap.currency ?? '' });
  }
}
type GapWords = (typeof productDataMessages)['en']['table']['gaps'];
