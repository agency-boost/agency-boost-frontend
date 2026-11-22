'use client';

import { useId, useRef, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  commitUpload, previewUpload, type ImportResult, type UploadPreview, type UploadProblem,
} from '@/lib/production';
import { useCan } from '@/lib/session';

/** At most this many names in the sentence about the rows kept for codes nobody holds yet; the rest are counted. */
const NAMES_SAID = 3;

/** The problems a preview found: every refused row, and every refused cell's issue (ADR-0274 §2). */
export function problemsOf(preview: UploadPreview): UploadProblem[] {
  return preview.rows.flatMap((row) => (row.status === 'refused' || row.cells.some((c) => c.status === 'refused')
    ? row.issues.map((i) => ({ line: row.line, agentCode: row.agentCode, code: i.code, message: i.message, kode: i.kode, ytd: i.ytd }))
    : []));
}

/**
 * **Unggah data** (P19.21-T1 AC-5; frames 5–7): pick a file of any row count — *Pilih file atau tarik ke sini* — then
 * *Lanjut*: the file is read (`POST /kpm/data-upload/preview`, which writes nothing) and summed up in three tiles, *n
 * anggota · n belum jadi anggota · n semua disimpan*, with the sentence naming who is not registered yet and that **the
 * file's figures replace earlier corrections by hand** (ADR-0274 §1). *Simpan semua (n baris)* saves it whole.
 *
 * **Nothing in the file is skipped** (§2): a file with a problem — a row with no code, a figure that is not one — lists
 * each problem, line by line, and *Simpan semua* stays off until a corrected file is chosen (*Ganti*); the server refuses
 * it whole too. **An upload into the running month carries its *as of* day** (D8; P19.5-T2 AC-9), today unless changed —
 * one field, only for this month.
 */
export function UploadDialog({
  open, month, title, current, today, templateName, onClose, onSaved,
}: {
  open: boolean;
  month: string;
  /** *November 2026*. */
  title: string;
  /** The office's current month: an upload into it carries an *as of* day. */
  current: string;
  /** The office's today, `YYYY-MM-DD`. */
  today: string;
  /** *Prudential template v1*. */
  templateName: string;
  onClose: () => void;
  onSaved: (result: ImportResult) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const canSave = useCan('data_upload:commit_import');
  const input = useRef<HTMLInputElement>(null);
  const asOfId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [refused, setRefused] = useState<UploadProblem[] | null>(null);
  const [asOf, setAsOf] = useState(today);
  const [dragging, setDragging] = useState(false);
  const running = month === current;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setRefused(null);
    setReading(false);
    setSaving(false);
    setAsOf(today);
  };
  const close = () => { reset(); onClose(); };

  const choose = (next: File | null | undefined) => {
    if (!next) return;
    setFile(next);
    setPreview(null);
    setError(null);
    setRefused(null);
  };

  const read = async () => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      setPreview(await previewUpload(month, file));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    if (!file || !preview) return;
    setSaving(true);
    setError(null);
    setRefused(null);
    try {
      const result = await commitUpload(month, preview.revision, file, running ? asOf : null);
      reset();
      onSaved(result);
    } catch (err) {
      const shown = toDisplayError(err);
      const listed = (shown.details?.problems as UploadProblem[] | undefined) ?? null;
      setError(shown);
      setRefused(listed);
      setSaving(false);
    }
  };

  const problems = refused ?? (preview ? problemsOf(preview) : []);
  const held = preview ? preview.rows.filter((r) => r.status === 'held') : [];
  const names = held.map((r) => r.fileName || r.agentCode);
  const said = names.length > NAMES_SAID
    ? `${names.slice(0, NAMES_SAID).join(', ')} ${t.andMore({ count: names.length - NAMES_SAID })}`
    : names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t.and} ${names.at(-1)}` : names[0] ?? '';

  const footer = (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" onClick={close} className="justify-center">{t.cancel}</Button>
      {preview ? (
        <Button
          onClick={() => void save()}
          disabled={!canSave || saving || problems.length > 0}
          className="justify-center"
        >
          {saving ? t.saving : t.saveAll({ count: preview.summary.rows })}
        </Button>
      ) : (
        <Button onClick={() => void read()} disabled={!file || reading} className="justify-center">
          {reading ? t.reading : t.next}
        </Button>
      )}
    </div>
  );

  return (
    <Modal open={open} title={t.uploadTitle({ month: title })} onClose={close} placement="responsive" closeLabel={t.cancel} footer={footer}>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }}
      />
      {!file ? (
        <button
          type="button"
          data-drop=""
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}
          className={cn(
            'flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-8 text-center',
            dragging ? 'bg-primary-50' : 'bg-base hover:bg-hover-row',
          )}
        >
          <LineIcon name="upload" className="h-6 w-6 text-navy" />
          <b className="text-md text-navy">{t.pickFile}</b>
          <small className="text-sm text-muted">{t.pickHint({ template: templateName })}</small>
        </button>
      ) : (
        <div className="flex items-center gap-3 border-b border-hairline pb-3">
          <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-hover-row text-navy">
            <LineIcon name="document" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-md text-navy">{file.name}</b>
            {preview && <small className="text-sm text-muted">{t.rowsCount({ count: preview.summary.rows })}</small>}
          </span>
          <Button variant="inline" onClick={() => input.current?.click()} className="min-h-11">{t.change}</Button>
        </div>
      )}

      {preview && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2" data-tiles="">
            <Tile tone="green" value={preview.summary.ready} label={t.tileMembers} />
            <Tile tone="blue" value={preview.summary.held} label={t.tileNotYet} />
            <Tile tone="grey" value={problems.length > 0 ? preview.summary.ready + preview.summary.held : preview.summary.rows} label={t.tileAll} />
          </div>
          {problems.length === 0 && (
            <p className="mt-3 text-sm text-muted">{held.length > 0 ? t.savedAllWithNotYet({ names: said }) : t.savedAll}</p>
          )}
          {preview.notes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
              {preview.notes.map((note) => <li key={`${note.code}:${note.kode ?? note.header}`}>{note.message}</li>)}
            </ul>
          )}
          {running && (
            <Field label={t.asOfDay} htmlFor={asOfId} className="mt-3">
              <DateField id={asOfId} value={asOf} onChange={(day) => setAsOf(day)} min={`${month}-01`} max={today} />
            </Field>
          )}
        </>
      )}

      {problems.length > 0 && (
        <div role="alert" className="mt-3 rounded-md bg-pill-red p-3 text-sm text-pill-red-ink" data-problems="">
          <p className="font-bold">{t.problems({ count: problems.length })}</p>
          <ul className="mt-1 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {problems.map((p, i) => (
              <li key={`${p.line}:${p.kode ?? ''}:${i}`}>
                <b>{t.problemLine({ line: p.line, code: p.agentCode })}</b> — {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && problems.length === 0 && <div className="mt-3"><ErrorBanner {...error} /></div>}
    </Modal>
  );
}

const TILE_TONE = {
  green: 'bg-pill-green text-pill-green-ink',
  blue: 'bg-secondary-50 text-navy',
  grey: 'bg-pill-grey text-navy',
} as const;

function Tile({ tone, value, label }: { tone: keyof typeof TILE_TONE; value: number; label: string }) {
  return (
    <div className={cn('rounded-md px-3 py-2', TILE_TONE[tone])}>
      <b className="block text-2xl font-extrabold tabular-nums">{value}</b>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
