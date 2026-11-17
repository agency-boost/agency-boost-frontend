'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { PdfPages } from '@/components/proposal/pdf-pages';
import { DateField } from '@/components/ui/date-field';
import { Button, Card, ErrorBanner, TextInput } from '@/components/ui/field';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataIntakeMessages } from '@/i18n/messages/product-data-intake';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { dayInZone, formatCalendarDay, formatRupiah, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  illustrationFileLink, previewIllustration, previewIllustrationPdf, publishIllustration, readIllustrations,
  saveIllustration, uploadIllustration,
  type BoxPreview, type Illustration, type IllustrationBlock, type IllustrationList, type PdfDetailBlockKind, type RowInput,
} from '@/lib/product-data-intake';
import { INTAKE_POLL_MS } from './intake-detail';

const STATUS_TONE: Record<string, PillTone> = { reading: 'grey', draft: 'amber', published: 'green', failed: 'red' };
const CHECK_TONE: Record<string, PillTone> = { match: 'green', mismatch: 'red', unchecked: 'grey' };
const BLOCK_ORDER: PdfDetailBlockKind[] = ['manfaat', 'jadwal', 'masa', 'pengecualian', 'nilai_tunai'];

/** Today in Asia/Jakarta, `YYYY-MM-DD`: the latest an illustration's date may be. */
const jakartaToday = () => dayInZone(OFFICE_TIME_ZONE, new Date());

/** A block as the editor holds it: each row's `id` kept, so the numbers it is checked against stay with it. */
type DraftRow = { id: string | null; key: string; label: string; note: string; value: string; mode: 'formula' | 'text' };
type DraftBlock = { block: PdfDetailBlockKind; rows: DraftRow[] };
let fresh = 0;
const draftOf = (blocks: IllustrationBlock[]): DraftBlock[] => blocks.map((b) => ({
  block: b.block,
  rows: b.rows.map((r) => ({
    id: r.id, key: r.id, label: r.label, note: r.note ?? '', value: r.formula ?? r.text ?? '', mode: r.formula !== null ? 'formula' : 'text',
  })),
}));

/** A row as the API takes it: its value a formula or a text by the row's own kind, an empty note `null`. */
const inputOf = (r: DraftRow): RowInput => ({
  id: r.id, label: r.label.trim(), note: r.note.trim() || null,
  formula: r.mode === 'formula' ? r.value.trim() || null : null,
  text: r.mode === 'text' ? r.value.trim() || null : null,
});

/**
 * **The *Ilustrasi* tab** (P19.15-T2; ADR-0259 §8; the P1b spec §3 *Ilustrasi*): upload the official illustration (PDF)
 * with its date; the app condenses it into the PDF's detail blocks, each with its source page; **every amount a formula**,
 * its check beside it — *Cocok*, *Tidak cocok*, *Belum dicek* — worked by the server against two numbers printed in the
 * illustration. The Super Admin (or a holder of *Kelola data produk*) edits the wording, previews **the product's PDF
 * box** — what two and three-or-four products keep, and the real file — and publishes; *Terbitkan* is disabled while a
 * formula does not match, and the server refuses it too. Read-only for those who may only read.
 */
export function IllustrationPanel({ companyId, productId, canManage }: { companyId: string; productId: string; canManage: boolean }) {
  const t = useMessages(productDataIntakeMessages).illustration;
  const language = useFigureLanguage();
  const [list, setList] = useState<IllustrationList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await readIllustrations(companyId, productId));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId, productId]);

  useEffect(() => { void load(); }, [load]);

  const current = list?.illustrations.find((i) => !i.supersededAt) ?? null;
  useEffect(() => {
    if (current?.status !== 'reading') return undefined;
    const timer = setTimeout(() => { void load(); }, INTAKE_POLL_MS);
    return () => clearTimeout(timer);
  }, [current, load]);

  const earlier = (list?.illustrations ?? []).filter((i) => i !== current);

  return (
    <section aria-label={t.title} className="flex flex-col gap-4">
      {error && <ErrorBanner {...error} />}
      {canManage && list && (list.aiReading
        ? <UploadForm companyId={companyId} productId={productId} onUploaded={() => void load()} />
        : <p className="text-sm text-muted">{t.off}</p>)}
      {!canManage && <p className="text-sm text-muted">{t.readOnly}</p>}
      {list && !current && <p className="text-md text-muted">{t.empty}</p>}
      {current && (
        <IllustrationView
          key={`${current.id}-${current.status}`}
          companyId={companyId}
          illustration={current}
          canManage={canManage}
          onChanged={(next) => setList((now) => (now ? { ...now, illustrations: now.illustrations.map((i) => (i.id === next.id ? next : i)) } : now))}
          reload={() => void load()}
        />
      )}
      {earlier.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-navy">{t.versions}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
            {earlier.map((i) => (
              <li key={i.id}>
                {t.dated({ date: formatCalendarDay(i.illustrationDate, language) })} · {t.status[i.status]}
                {i.plan ? ` · ${i.plan}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function UploadForm({ companyId, productId, onUploaded }: { companyId: string; productId: string; onUploaded: () => void }) {
  const t = useMessages(productDataIntakeMessages).illustration;
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState('');
  const [plan, setPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await uploadIllustration(companyId, productId, file, date, plan.trim() || null);
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card density="compact" className="flex flex-col gap-3">
      <p className="text-md text-ink">{t.hint}</p>
      {error && <ErrorBanner {...error} />}
      <label htmlFor={`${id}-file`} className="flex flex-col gap-1 text-sm font-semibold text-navy">
        {t.file}
        <input
          id={`${id}-file`}
          type="file"
          accept="application/pdf,.pdf"
          className="text-md text-ink file:mr-3 file:min-h-11 file:rounded-md file:border file:border-hairline file:bg-card file:px-3 file:text-navy"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {/* The label beside the field, not around it: the field's face is text of its own (`DateField`). */}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-date`} className="text-sm font-semibold text-navy">{t.date}</label>
          <DateField id={`${id}-date`} max={jakartaToday()} value={date} onChange={setDate} />
        </div>
        <label htmlFor={`${id}-plan`} className="flex flex-col gap-1 text-sm font-semibold text-navy">
          {t.plan}
          <TextInput id={`${id}-plan`} value={plan} maxLength={60} onChange={(e) => setPlan(e.target.value)} />
        </label>
      </div>
      <div className="flex">
        <Button onClick={() => void send()} disabled={saving || !file || !date} className="max-md:flex-1">
          {saving ? t.uploading : t.upload}
        </Button>
      </div>
    </Card>
  );
}

function IllustrationView({
  companyId, illustration, canManage, onChanged, reload,
}: { companyId: string; illustration: Illustration; canManage: boolean; onChanged: (next: Illustration) => void; reload: () => void }) {
  const t = useMessages(productDataIntakeMessages).illustration;
  const d = useMessages(productDataIntakeMessages).detail;
  const language = useFigureLanguage();
  const editable = canManage && illustration.status === 'draft';
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => draftOf(illustration.blocks));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const checks = new Map(illustration.blocks.flatMap((b) => b.rows).map((r) => [r.id, r]));

  const edit = (bi: number, ri: number, field: 'label' | 'note' | 'value', value: string) => {
    setDirty(true);
    setBlocks((now) => now.map((b, i) => (i !== bi ? b : {
      ...b, rows: b.rows.map((r, j) => (j !== ri ? r : { ...r, [field]: value })),
    })));
  };
  const remove = (bi: number, ri: number) => {
    setDirty(true);
    setBlocks((now) => now.map((b, i) => (i !== bi ? b : { ...b, rows: b.rows.filter((_, j) => j !== ri) })));
  };
  const add = (bi: number) => {
    setDirty(true);
    fresh += 1;
    const mode = illustration.formulaNames.length > 0 && blocks[bi].block !== 'masa' && blocks[bi].block !== 'pengecualian' ? 'formula' : 'text';
    setBlocks((now) => now.map((b, i) => (i !== bi ? b : {
      ...b, rows: [...b.rows, { id: null, key: `new-${fresh}`, label: '', note: '', value: '', mode }],
    })));
  };

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      const next = await saveIllustration(companyId, illustration.id, blocks.map((b) => ({
        block: b.block, rows: b.rows.map(inputOf),
      })));
      onChanged(next);
      setBlocks(draftOf(next.blocks));
      setDirty(false);
      setNotice(t.saved);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy('publish');
    setError(null);
    try {
      onChanged(await publishIllustration(companyId, illustration.id));
      setNotice(t.published);
      reload();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  };

  const openFile = async () => {
    const { url } = await illustrationFileLink(companyId, illustration.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card density="compact" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-md font-semibold text-navy">
            {t.dated({ date: formatCalendarDay(illustration.illustrationDate, language) })}{illustration.plan ? ` · ${illustration.plan}` : ''}
          </h3>
          <p className="text-sm text-muted">
            {illustration.hasFile
              ? <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => void openFile()}>{illustration.fileName}</button>
              : illustration.fileName}
          </p>
        </div>
        <TonePill tone={STATUS_TONE[illustration.status] ?? 'grey'}>{t.status[illustration.status]}</TonePill>
      </div>
      {illustration.status === 'reading' && <p role="status" className="text-md text-navy">{t.reading}</p>}
      {illustration.status === 'failed' && (
        <p className="text-md text-alert">{t.failed({ reason: d.failure[illustration.failure ?? 'unreadable'] ?? d.failure.unreadable })}</p>
      )}
      {(illustration.status === 'draft' || illustration.status === 'published') && (
        <>
          {editable && illustration.formulaNames.length > 0 && (
            <p className="text-xs text-muted">{t.names({ names: illustration.formulaNames.join(', ') })}</p>
          )}
          {BLOCK_ORDER.map((kind) => {
            const bi = blocks.findIndex((b) => b.block === kind);
            if (bi < 0) return null;
            const block = blocks[bi];
            const page = illustration.blocks.find((b) => b.block === kind)?.page ?? null;
            return (
              <fieldset key={kind} className="flex flex-col gap-2 rounded-md border border-card-edge p-3" disabled={!editable || busy !== null}>
                <legend className="px-1 text-sm font-semibold text-navy">
                  {t.block[kind]}{kind === 'nilai_tunai' ? ` (${t.notGuaranteed})` : ''}{page ? ` · ${t.page({ page })}` : ''}
                </legend>
                {block.rows.map((row, ri) => (
                  <RowEditor
                    key={row.key}
                    row={row}
                    check={row.id && !dirty ? checks.get(row.id)?.check ?? null : null}
                    page={row.id ? checks.get(row.id)?.page ?? null : null}
                    editable={editable}
                    onEdit={(field, value) => edit(bi, ri, field, value)}
                    onRemove={() => remove(bi, ri)}
                  />
                ))}
                {editable && <div><Button variant="secondary" onClick={() => add(bi)}>{t.addRow}</Button></div>}
              </fieldset>
            );
          })}
          {illustration.dropped.length > 0 && (
            <p className="text-xs text-muted">{t.droppedFromFile}: {illustration.dropped.join('; ')}</p>
          )}
          {error && <ErrorBanner {...error} />}
          {notice && <p role="status" className="text-sm text-success">{notice}</p>}
          {editable && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-2 max-md:[&>button]:flex-1">
                <Button variant="secondary" onClick={() => void save()} disabled={!dirty || busy !== null}>{busy === 'save' ? t.saving : t.save}</Button>
                <Button onClick={() => void publish()} disabled={dirty || busy !== null || illustration.mismatches > 0}>
                  {busy === 'publish' ? t.publishing : t.publish}
                </Button>
              </div>
              {illustration.mismatches > 0 && <p className="text-xs text-alert">{t.mismatchFirst({ count: illustration.mismatches })}</p>}
            </div>
          )}
          <BoxPreviewSection companyId={companyId} illustrationId={illustration.id} stale={dirty} />
        </>
      )}
    </Card>
  );
}

function RowEditor({
  row, check, page, editable, onEdit, onRemove,
}: {
  row: DraftRow;
  check: Illustration['blocks'][number]['rows'][number]['check'];
  page: number | null;
  editable: boolean;
  onEdit: (field: 'label' | 'note' | 'value', value: string) => void;
  onRemove: () => void;
}) {
  const t = useMessages(productDataIntakeMessages).illustration;
  const language = useFigureLanguage();
  const id = useId();
  const isFormula = row.mode === 'formula';
  const why = check?.reason ? t.checkWhy[check.reason] : null;
  return (
    <div className="flex flex-col gap-2 border-b border-divider pb-2 last:border-b-0">
      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
        <label htmlFor={`${id}-label`} className="flex flex-col gap-1 text-xs text-muted">
          {t.label}
          <TextInput id={`${id}-label`} maxLength={80} value={row.label} readOnly={!editable} onChange={(e) => onEdit('label', e.target.value)} />
        </label>
        <label htmlFor={`${id}-note`} className="flex flex-col gap-1 text-xs text-muted">
          {t.note}
          <TextInput id={`${id}-note`} maxLength={40} value={row.note} readOnly={!editable} onChange={(e) => onEdit('note', e.target.value)} />
        </label>
      </div>
      <label htmlFor={`${id}-value`} className="flex flex-col gap-1 text-xs text-muted">
        {isFormula ? t.formula : t.textValue}
        <TextInput
          id={`${id}-value`}
          maxLength={isFormula ? 120 : 80}
          value={row.value}
          readOnly={!editable}
          onChange={(e) => onEdit('value', e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {page && <span className="text-xs text-muted">{t.page({ page })}</span>}
        {check && (
          <TonePill tone={CHECK_TONE[check.state]}>
            {t.check[check.state]}
          </TonePill>
        )}
        {why && <span className="text-xs text-muted">{why}</span>}
        {check?.samples.filter((s) => !s.match).map((s, i) => (
          <span key={i} className="text-xs text-alert">
            {t.sample({ printed: formatRupiah(s.printedMinor, language), computed: s.computedMinor === null ? '—' : formatRupiah(s.computedMinor, language) })}
          </span>
        ))}
        {editable && (
          <Button variant="secondary" className="ml-auto" onClick={onRemove} aria-label={t.removeRow({ label: row.label || '—' })}>✕</Button>
        )}
      </div>
    </div>
  );
}

/** **The product's PDF box**: every row, what two and three-or-four products keep, and the real file on demand. */
function BoxPreviewSection({ companyId, illustrationId, stale }: { companyId: string; illustrationId: string; stale: boolean }) {
  const t = useMessages(productDataIntakeMessages).illustration;
  const [preview, setPreview] = useState<BoxPreview | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [loading, setLoading] = useState<'box' | 'pdf' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);

  const run = async (what: 'box' | 'pdf') => {
    setLoading(what);
    setError(null);
    setPdfFailed(false);
    try {
      if (what === 'box') setPreview(await previewIllustration(companyId, illustrationId));
      else setPdf(await previewIllustrationPdf(companyId, illustrationId));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setLoading(null);
    }
  };

  const labels = (rows: BoxPreview['rows']) => rows.map((r) => r.label).join(', ');

  return (
    <div className="flex flex-col gap-2 border-t border-divider pt-3">
      <div className="flex flex-wrap gap-2 max-md:[&>button]:flex-1">
        <Button variant="secondary" onClick={() => void run('box')} disabled={stale || loading !== null}>{t.preview}</Button>
        <Button variant="secondary" onClick={() => void run('pdf')} disabled={stale || loading !== null}>
          {loading === 'pdf' ? t.loadingPdf : t.showPdf}
        </Button>
      </div>
      {error && <ErrorBanner {...error} />}
      {preview && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-navy">{t.previewTitle}</p>
          <dl className="flex flex-col divide-y divide-divider rounded-md border border-card-edge">
            {preview.rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="flex justify-between gap-3 px-3 py-1.5 text-sm">
                <dt className="text-ink">{r.label}</dt>
                <dd className="text-right font-semibold text-navy">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-ink">
            {t.withTwo}: {t.keeps({ kept: preview.withTwo.kept })}
            {preview.withTwo.dropped.length > 0 && <> · {t.dropped({ rows: labels(preview.withTwo.dropped) })}</>}
          </p>
          <p className="text-sm text-ink">
            {t.withMore}: {t.keeps({ kept: preview.withMore.kept })}
            {preview.withMore.dropped.length > 0 && <> · {t.dropped({ rows: labels(preview.withMore.dropped) })}</>}
          </p>
          {!preview.fits && <p role="status" className="text-sm font-semibold text-alert">{t.doesNotFit}</p>}
          {preview.missing.length > 0 && <p className="text-xs text-muted">{t.missing({ rows: preview.missing.join(', ') })}</p>}
        </div>
      )}
      {pdf && !pdfFailed && <PdfPages file={pdf} onFailed={() => setPdfFailed(true)} />}
      {pdfFailed && <p className="text-sm text-alert">{t.pdfFailed}</p>}
    </div>
  );
}
