'use client';

import { useEffect, useId, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import {
  columnLabel, correctCell, restoreCell, type CorrectionResult, type MetricCell,
} from '@/lib/production';
import { useCan } from '@/lib/session';
import { formatFigure, parseFigure, typedFigure, unitWord } from './figure-marks';
import type { Tapped } from './members-table';

/**
 * **Koreksi** (P19.21-T1 AC-4; frames 9–10): the person's photo and *Koreksi <column> · NAME*, *"<Bulan YYYY> · dari
 * file: Rp 1.412.000"*, the exact new value, *Alasan (wajib)*, and *"Tercatat: siapa, kapan, alasan. Bisa dikembalikan ke
 * angka dari file."* — *Batal* / *Simpan koreksi*. `PATCH /kpm/data-upload/cell`, with the month's revision the page
 * read.
 *
 * - **A corrected figure says who, when and why** (one line), and offers **the way back to the file's number** —
 *   *Kembalikan ke angka dari file (Rp …)*, `POST /kpm/data-upload/cell/restore` — where an upload gave it.
 * - **An empty value clears the figure** (ADR-0051: the only way one is cleared), with the reason like any correction.
 */
export function CorrectionDialog({
  tapped, month, title, revision, zone, onClose, onDone,
}: {
  tapped: Tapped | null;
  month: string;
  /** *November 2026*. */
  title: string;
  revision: number;
  zone: string;
  onClose: () => void;
  onDone: (result: CorrectionResult, restored: boolean) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const canCorrect = useCan('data_upload:correct_cell');
  const valueId = useId();
  const reasonId = useId();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [invalid, setInvalid] = useState<{ value?: string; reason?: string }>({});

  const cell: MetricCell | null = tapped
    ? (tapped.ytd ? tapped.row.ytd[tapped.column.kode] : tapped.row.values[tapped.column.kode]) ?? null
    : null;

  useEffect(() => {
    if (!tapped) return;
    setValue(typedFigure(tapped.column.unit, cell?.value ?? null, figures));
    setReason('');
    setError(null);
    setInvalid({});
    setBusy(null);
    // A new tap is a new correction: what the last one typed does not carry over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapped]);

  if (!tapped) return null;
  const { row, column, ytd } = tapped;
  const name = columnLabel(column, language);
  const unit = unitWord(column.unit);
  const fixed = cell?.provenance === 'corrected';
  // The file's number: the figure itself when the file gave it, the one behind a correction when somebody changed it.
  const fileValue = fixed ? cell?.correction?.fileValue ?? null : cell?.provenance === 'imported' ? cell.value : null;
  const fromFile = fileValue === null ? null : formatFigure(column.unit, fileValue, figures);

  const save = async () => {
    const parsed = parseFigure(column.unit, value);
    const why = reason.trim();
    const problems = { value: parsed === undefined ? t.notANumber : undefined, reason: why ? undefined : t.reasonNeeded };
    setInvalid(problems);
    if (problems.value || problems.reason) return;
    setBusy('save');
    setError(null);
    try {
      onDone(await correctCell({
        month, membershipId: row.membershipId, kode: column.kode, ytd, value: parsed ?? null, revision, reason: why,
      }), false);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    setError(null);
    try {
      onDone(await restoreCell({ month, membershipId: row.membershipId, kode: column.kode, ytd, revision }), true);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(null);
    }
  };

  const footer = (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" onClick={onClose} className="justify-center">{t.cancel}</Button>
      <Button onClick={() => void save()} disabled={!canCorrect || busy !== null} className="justify-center">
        {busy === 'save' ? t.saving : t.saveCorrection}
      </Button>
    </div>
  );

  return (
    <Modal
      open
      title={t.correctTitle({ column: ytd ? `${name} ${t.ytd}` : name, name: row.name })}
      eyebrow={<Avatar name={row.name} photoUrl={row.photoUrl ?? null} seed={row.membershipId} size={32} />}
      onClose={onClose}
      placement="responsive"
      closeLabel={t.cancel}
      footer={footer}
    >
      <p className="-mt-1 text-sm text-muted">{fromFile ? t.fromFile({ month: title, value: fromFile }) : title}</p>
      {fixed && cell?.correction && (
        <p className="mt-2 text-sm text-navy" data-corrected-by="">
          {t.correctedBy({
            who: cell.correction.by,
            when: cell.correction.at ? formatDateTime(cell.correction.at, zone, figures) : '',
            reason: cell.correction.reason,
          })}
        </p>
      )}
      <Field label={unit ? t.valueIn({ column: name, unit }) : name} htmlFor={valueId} error={invalid.value} hint={t.emptyClears} className="mt-3">
        <TextInput
          id={valueId}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-center text-xl font-bold tabular-nums"
        />
      </Field>
      <Field label={t.reason} htmlFor={reasonId} error={invalid.reason} className="mt-3">
        <TextInput id={reasonId} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="mt-2 text-sm text-muted">{t.logged}</p>
      {fixed && fromFile && canCorrect && (
        <Button variant="inline" onClick={() => void restore()} disabled={busy !== null} className="mt-2 min-h-11 font-semibold text-primary-ink">
          {busy === 'restore' ? t.restoring : t.restore({ value: fromFile })}
        </Button>
      )}
      {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
    </Modal>
  );
}
