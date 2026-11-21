'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { LineIcon } from '@/components/ui/line-icon';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatMonthLong } from '@/lib/format';
import {
  lockMonth, readTemplate, readTemplateWorkbook, reopenMonth, templateHref, workbookFilename,
  type MonthState, type MonthView,
} from '@/lib/production';
import { saveFile } from '@/lib/save-file';
import { useCan } from '@/lib/session';

/** *November 2026*: a month named in full, as the card and the dialogs title it. */
export const monthTitle = (month: string, figures: Language) => `${formatMonthLong(month, figures)} ${month.slice(0, 4)}`;

/**
 * **The selected month, as a navy card** (P19.21-T1 AC-2; frame 1): *"n dari N anggota sudah punya angka"* and its bar;
 * whether the month takes an upload — *Terbuka sampai 7 Des 2026 · lalu terkunci otomatis · Kunci sekarang*, or
 * *Terkunci* with *sudah diunggah* / *belum diunggah, masih bisa diunggah*; *Unggah data* (orange) and *Unduh template*
 * with the template's name and version under it. The three stacked banners it replaced are gone.
 *
 * - **A month never uploaded since January 2024 is shown *Terkunci* but takes an upload** (ADR-0274 §3; the server's
 *   `reason: 'history'`): the mockup's *"belum diunggah, masih bisa diunggah"*, so a missing past month is uploaded from
 *   here by the Owner, an Admin, a core leader or a Super Admin in the KPM.
 * - **Reopening a locked month stays** (ADR-0050; the owner's rule that fidelity work never strips a feature): *Buka
 *   kembali* beside *Terkunci*, for whoever holds `data_upload:reopen_month` — inside the chip's line, no new block.
 * - **The CSV stays** beside the workbook (ADR-0184): *CSV* after the template's name, one word on its line.
 */
export function MonthCard({
  view, onUpload, onChanged,
}: {
  view: MonthView;
  onUpload: () => void;
  /** The month's lock moved: the page reads the month again and says so. */
  onChanged: (state: MonthState) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const canUpload = useCan('data_upload:upload_and_preview');
  const canLock = useCan('data_upload:lock_month');
  const canReopen = useCan('data_upload:reopen_month');
  const canTemplate = useCan('data_upload:download_template');
  const [asking, setAsking] = useState<'lock' | 'reopen' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const { state, month } = view;
  const total = view.rows.length;
  const have = view.withData;
  const share = total === 0 ? 0 : Math.round((have / total) * 100);
  const missing = view.completeness.status === 'missing';
  const history = !state.locked && state.reason === 'history';
  const open = !state.locked && !history;
  const templateName = t.templateOf({ name: view.config.templateName ?? t.defaultTemplate, version: view.config.version });
  const label = monthTitle(month, figures);

  const act = async (which: 'lock' | 'reopen') => {
    setAsking(null);
    setError(null);
    try {
      onChanged(which === 'lock' ? await lockMonth(month) : await reopenMonth(month));
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  const download = async (format: 'xlsx' | 'csv') => {
    setSaving(true);
    setError(null);
    try {
      const file = await readTemplate(month);
      if (format === 'xlsx') {
        saveFile(await readTemplateWorkbook(month), workbookFilename(file));
      } else {
        const link = document.createElement('a');
        link.href = templateHref(file);
        link.download = file.filename;
        link.click();
      }
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      data-month-card={month}
      aria-label={label}
      className="flex flex-col gap-4 rounded-lg bg-secondary p-4 text-secondary-contrast md:flex-row md:items-center md:p-5"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-md font-bold text-secondary-contrast">{label}</h2>
        <p className="mt-1 flex items-end gap-2.5">
          <b className="font-display text-4xl font-extrabold leading-none text-primary-on-secondary tabular-nums">{have}</b>
          <span className="pb-1 text-md font-semibold">{t.haveFigures({ total })}</span>
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={have}
          aria-label={`${have} ${t.haveFigures({ total })}`}
          className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-pill bg-on-navy-line"
        >
          <div className="h-full rounded-pill bg-primary" style={{ width: `${share}%` }} />
        </div>
        <p data-lock={state.reason} className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1 rounded-pill bg-on-navy-line px-2.5 py-1 font-bold">
            <LineIcon name="lock" className="h-3.5 w-3.5" />
            {open
              ? state.reason === 'reopened' ? t.reopened : t.openUntil({ day: formatCalendarDay(state.editableUntil, figures) })
              : t.locked}
          </span>
          {open && state.reason === 'open' && <span className="text-on-navy-muted">{t.thenLocks}</span>}
          {open && canLock && (
            <button type="button" onClick={() => setAsking('lock')} className="min-h-11 underline underline-offset-2 lg:min-h-0">
              {t.lockNow}
            </button>
          )}
          {!open && <span className="text-on-navy-muted">{missing ? t.lockedMissing : t.lockedUploaded}</span>}
          {state.locked && canReopen && (
            <button type="button" onClick={() => setAsking('reopen')} className="min-h-11 underline underline-offset-2 lg:min-h-0">
              {t.reopen}
            </button>
          )}
        </p>
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-on-navy-red">{error.message}</p>}
      </div>
      <div className="flex flex-col gap-2 max-md:flex-row max-md:flex-wrap md:w-52">
        {canUpload && (
          <Button onClick={onUpload} disabled={state.locked} className="justify-center gap-1.5 max-md:flex-1">
            <LineIcon name="upload" className="h-4 w-4" />{t.upload}
          </Button>
        )}
        {canTemplate && (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void download('xlsx')}
              className={cn(
                'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill bg-on-navy-line px-4 text-base font-bold',
                'text-secondary-contrast hover:bg-secondary-hover disabled:opacity-40 max-md:flex-1 lg:min-h-9',
              )}
            >
              <LineIcon name="download" className="h-4 w-4" />{t.downloadTemplate}
            </button>
            <p className="text-center text-xs text-on-navy-muted max-md:w-full max-md:text-left">
              {templateName}
              {' · '}
              <button type="button" onClick={() => void download('csv')} className="underline underline-offset-2">
                {t.templateCsv}
              </button>
            </p>
          </>
        )}
      </div>
      <Dialog
        open={asking !== null}
        message={asking === 'reopen' ? t.askReopen({ month: label }) : t.askLock({ month: label })}
        confirmLabel={asking === 'reopen' ? t.reopen : t.lockNow}
        cancelLabel={t.cancel}
        onConfirm={() => void act(asking ?? 'lock')}
        onCancel={() => setAsking(null)}
      />
    </section>
  );
}
