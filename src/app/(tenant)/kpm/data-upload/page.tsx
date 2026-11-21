'use client';

import { useEffect, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ErrorBanner } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  figureLabel, readHistory, readMonth, type BatchView, type CorrectionResult, type ImportResult, type MonthState,
  type MonthView,
} from '@/lib/production';
import { useCan } from '@/lib/session';
import { readBranchInfo } from '@/lib/tenant-config';
import { CorrectionDialog } from './correction-dialog';
import { formatFigure } from './figure-marks';
import { MembersTable, type Tapped } from './members-table';
import { MonthCard, monthTitle } from './month-card';
import { MonthPicker } from './month-picker';
import { UploadDialog } from './upload-dialog';
import { UploadHistory } from './upload-history';

/** `YYYY-MM`, a real month. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * **Data upload** (P19.21-T1; ADR-0274; the client's 19 November redo, `data-upload-pengaturan-*-stopmotion-2026-11-19
 * .html` frames 1–10): one page that shows every month since January 2024, keeps every row of a file, and lets a number be
 * corrected with a reason. In order, on a phone, a tablet and a laptop alike:
 *
 * 1. **Pilih bulan** — the year switch and the year's months, green uploaded and red missing (`MonthPicker`);
 * 2. **the selected month, as a navy card** — how many members have figures, open until the 7th or locked, *Unggah data*
 *    and *Unduh template* (`MonthCard`);
 * 3. **the members** — *Bulan ini | YTD*, the filters and *Cari nama*, the table, *Belum jadi anggota* (`MembersTable`);
 * 4. **Riwayat unggah** for the month (`UploadHistory`).
 *
 * **The address names a month and a person** (AC-9): `?month=2026-11&q=Agus Prasetyo` — what Personal Summary's *Unggah
 * produksi →* and the KPM Overview open — selects the month and fills the search, so that person's row is the one shown.
 */
export default function DataUploadPage() {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const canRead = useCan('data_upload:read');
  const canHistory = useCan('data_upload:read_history');
  const canCorrect = useCan('data_upload:correct_cell');

  const [zone, setZone] = useState(OFFICE_TIME_ZONE);
  const today = dayInZone(zone, new Date());
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const [year, setYear] = useState(current.slice(0, 4));
  const [query, setQuery] = useState('');
  /** A month the address or the reader picked is never moved by the office's zone arriving afterwards. */
  const picked = useRef(false);

  const [view, setView] = useState<MonthView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [history, setHistory] = useState<BatchView[] | null>(null);
  const [generation, setGeneration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [tapped, setTapped] = useState<Tapped | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // The address, once, as the page opens (AC-9; P19.3-T2 AC-7's `?month=`).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get('month');
    if (asked && MONTH.test(asked)) {
      picked.current = true;
      setMonth(asked);
      setYear(asked.slice(0, 4));
    }
    const who = params.get('q');
    if (who) setQuery(who);
  }, []);

  // The office's zone (invariant §9): its month is the default; Jakarta for every office in v1 (ADR-0016).
  useEffect(() => {
    if (!canRead) return undefined;
    let live = true;
    readBranchInfo()
      .then((branch) => {
        if (!live || !branch.timezone) return;
        setZone(branch.timezone);
        if (!picked.current) {
          const own = dayInZone(branch.timezone, new Date()).slice(0, 7);
          setMonth(own);
          setYear(own.slice(0, 4));
        }
      })
      .catch(() => { /* Jakarta stands: the one zone v1 has */ });
    return () => { live = false; };
  }, [canRead]);

  useEffect(() => {
    // Nothing is asked for somebody the page refuses (`Page`'s permission): the server would refuse it too.
    if (!canRead) return undefined;
    let live = true;
    setError(null);
    readMonth(month)
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [month, generation, canRead]);

  useEffect(() => {
    if (!canHistory || !canRead) return undefined;
    let live = true;
    setHistory(null);
    readHistory(month)
      .then((next) => { if (live) setHistory(next.batches); })
      .catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, [month, generation, canHistory, canRead]);

  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);

  const pick = (next: string) => {
    picked.current = true;
    setNotice(null);
    if (next !== month) setView(null);
    setMonth(next);
  };
  const wrote = (sentence: string) => {
    setNotice(sentence);
    setGeneration((g) => g + 1);
  };
  const title = monthTitle(month, figures);
  const shown = view && view.month === month ? view : null;

  const saved = (result: ImportResult) => {
    setUploading(false);
    wrote(t.saved({ count: result.batch.rowCount, month: title }));
  };
  const relocked = (state: MonthState) => wrote(t.lockedNow({ month: title, locked: state.locked }));
  const corrected = (result: CorrectionResult, restored: boolean) => {
    const target = tapped;
    setTapped(null);
    if (!target) { setGeneration((g) => g + 1); return; }
    const label = figureLabel(target.column, target.ytd, language);
    const after = result.after.value === null ? '—' : formatFigure(target.column.unit, result.after.value, figures);
    wrote(restored ? t.restoredNotice({ label, who: target.row.name, after })
      : result.changed ? t.correctedNotice({ label, who: target.row.name, after })
        : t.unchangedNotice({ label, who: target.row.name }));
  };

  return (
    <Page title={t.title} permission="data_upload:read">
      <div className="flex flex-col gap-3">
        {/* The grid starts at the month read's own first month — January 2024 (ADR-0274 §3) — so it waits for it. */}
        {shown && (
          <MonthPicker
            year={year}
            month={month}
            current={current}
            historyFrom={shown.config.historyFrom}
            months={shown.months}
            onYear={setYear}
            onMonth={pick}
          />
        )}

        {notice && (
          <p ref={noticeRef} tabIndex={-1} role="status" className="rounded-md bg-pill-green px-3 py-2 text-md font-semibold text-pill-green-ink">
            {notice}
          </p>
        )}

        {error && !shown && (
          <div className="flex flex-col items-start gap-2">
            <ErrorBanner {...error} />
            <Button variant="secondary" onClick={() => setGeneration((g) => g + 1)}>{t.tryAgain}</Button>
          </div>
        )}

        {!shown && !error && <SkeletonCards count={3} label={t.title} />}

        {shown && (
          <>
            <MonthCard view={shown} onUpload={() => setUploading(true)} onChanged={relocked} />
            <MembersTable
              view={shown}
              query={query}
              onQuery={setQuery}
              correctable={canCorrect && !shown.state.locked}
              onTap={setTapped}
            />
            {canHistory && (
              <UploadHistory batches={history} title={title} zone={zone} locked={shown.state.locked} onUndone={(r) => wrote(t.undone({ filename: r.batch.filename }))} />
            )}
            <UploadDialog
              open={uploading}
              month={month}
              title={title}
              current={current}
              today={today}
              templateName={t.templateOf({ name: shown.config.templateName ?? t.defaultTemplate, version: shown.config.version })}
              onClose={() => setUploading(false)}
              onSaved={saved}
            />
            <CorrectionDialog
              tapped={tapped}
              month={month}
              title={title}
              revision={shown.state.revision}
              zone={zone}
              onClose={() => setTapped(null)}
              onDone={corrected}
            />
          </>
        )}
      </div>
    </Page>
  );
}
