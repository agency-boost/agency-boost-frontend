'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataIntakeMessages } from '@/i18n/messages/product-data-intake';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { readIntakes, uploadIntake, type Intake, type IntakeList } from '@/lib/product-data-intake';
import { useMediaQuery } from '@/lib/use-media-query';
import { IntakeDetailSheet } from './intake-detail';

/** What the file chooser offers: the five kinds read, and a ZIP of them (ADR-0259 §2). The server checks the bytes. */
export const INTAKE_ACCEPT = '.xlsx,.csv,.pdf,.png,.jpg,.jpeg,.webp,.docx,.zip';

const STATUS_TONE: Record<string, PillTone> = {
  reading: 'grey', needs_answers: 'amber', ready: 'blue', applied: 'green', rejected: 'grey', failed: 'red',
};

/**
 * ***Unggah file*** (P19.15-T3 AC-1, AC-5; ADR-0259; the P1b spec §0): the big button at the top of a company's
 * *Proposal* tab — and on *Perusahaan*, `companyId` `null`, for a file of any insurer. Several files at once; the upload
 * answers at once and *Yang kami pahami* opens, asking again until the reading is done.
 *
 * - **Without the Anthropic key** the button is disabled and one line says reading is not switched on, naming the
 *   premium table's own Excel/CSV upload, which still works.
 * - **A reader who may only read** (a KPM Owner or Admin without *Kelola data produk*) gets no button — the server refuses
 *   the upload too — and still opens the uploads to read them.
 * - **One line under it** opens the recent uploads, saying how many questions wait.
 */
export function IntakePanel({ companyId, canManage }: { companyId: string | null; canManage: boolean }) {
  const t = useMessages(productDataIntakeMessages).intake;
  const [list, setList] = useState<IntakeList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const offId = useId();

  const load = useCallback(async () => {
    try {
      setList(await readIntakes(companyId));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const waiting = list?.intakes.reduce((n, i) => n + i.open, 0) ?? 0;
  const off = list !== null && !list.aiReading;

  return (
    <div className="flex flex-col gap-1">
      {error && <ErrorBanner {...error} />}
      {canManage && (
        <div className="flex">
          <Button onClick={() => setUploading(true)} disabled={list === null || off} aria-describedby={off ? offId : undefined} className="max-md:flex-1">
            {t.button}
          </Button>
        </div>
      )}
      {canManage && off && <p id={offId} className="text-sm text-muted">{t.off}</p>}
      {list && list.intakes.length > 0 && (
        <button type="button" className="self-start text-sm text-navy underline underline-offset-2" onClick={() => setListOpen(true)}>
          {t.recent({ count: list.intakes.length })}
          {waiting > 0 && <> · {t.needsAnswers({ count: waiting })}</>}
        </button>
      )}
      {uploading && (
        <UploadDialog
          companyId={companyId}
          onClose={() => setUploading(false)}
          onUploaded={(intake) => {
            setUploading(false);
            setOpenId(intake.id);
            void load();
          }}
        />
      )}
      {listOpen && list && (
        <IntakeListDialog
          intakes={list.intakes}
          onClose={() => setListOpen(false)}
          onOpen={(id) => { setListOpen(false); setOpenId(id); }}
        />
      )}
      {openId && <IntakeDetailSheet intakeId={openId} onClose={() => { setOpenId(null); void load(); }} onChanged={() => void load()} />}
    </div>
  );
}

/** The files chosen, the privacy line, *Unggah*. */
function UploadDialog({ companyId, onClose, onUploaded }: { companyId: string | null; onClose: () => void; onUploaded: (intake: Intake) => void }) {
  const t = useMessages(productDataIntakeMessages).intake;
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      onUploaded(await uploadIntake(companyId, files));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t.sheetTitle}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className="flex justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button onClick={() => void send()} disabled={saving || files.length === 0}>{saving ? t.uploading : t.upload}</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-md text-ink">{t.sheetHint}</p>
        <p className="text-sm font-semibold text-navy">{t.privacy}</p>
        {error && <ErrorBanner {...error} />}
        <label htmlFor={inputId} className="flex flex-col gap-1 text-sm font-semibold text-navy">
          {t.choose}
          <input
            id={inputId}
            type="file"
            multiple
            accept={INTAKE_ACCEPT}
            className="text-md text-ink file:mr-3 file:min-h-11 file:rounded-md file:border file:border-hairline file:bg-card file:px-3 file:text-navy"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {files.length > 0 && (
          <div>
            <p className="text-sm text-muted">{t.chosen({ count: files.length })}</p>
            <ul className="list-disc pl-5 text-sm text-ink">{files.map((f) => <li key={`${f.name}-${f.size}`}>{f.name}</li>)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The recent uploads, newest first, each with its state and who uploaded it. */
function IntakeListDialog({ intakes, onClose, onOpen }: { intakes: Intake[]; onClose: () => void; onOpen: (id: string) => void }) {
  const t = useMessages(productDataIntakeMessages).intake;
  const ui = useMessages(uiV1Messages);
  const language = useFigureLanguage();
  const phone = useMediaQuery('phone');
  return (
    <Modal open title={t.listTitle} onClose={onClose} placement={phone ? 'sheet' : 'center'} handle={phone} closeLabel={ui.close}>
      {intakes.length === 0 ? <p className="text-md text-muted">{t.empty}</p> : (
        <ul className="flex flex-col divide-y divide-divider pb-2">
          {intakes.map((intake) => (
            <li key={intake.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-md font-semibold text-navy">{intake.files.map((f) => f.name).join(', ')}</p>
                <p className="text-sm text-muted">
                  {t.by({ name: intake.uploadedByName ?? '—', date: formatDateTime(intake.createdAt, undefined, language) })}
                  {intake.companyId === null ? '' : intake.companyName ? ` · ${intake.companyName}` : ''}
                </p>
                <TonePill tone={STATUS_TONE[intake.status] ?? 'grey'} className="mt-1">{t.status[intake.status]}</TonePill>
              </div>
              <Button variant="secondary" onClick={() => onOpen(intake.id)}>{t.open}</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
