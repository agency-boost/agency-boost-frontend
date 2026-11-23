'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { KpmStructure } from '@/components/org-tree/kpm-tree';
import { MemberSheet } from '@/components/people/member-sheet';
import { HIT_AREA } from '@/components/people/people-parts';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { temporaryPasswordsMessages } from '@/i18n/messages/temporary-passwords';
import {
  downloadRosterTemplate, importRosterFile, previewRosterFile, ROSTER_TEMPLATE_FILENAME,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { inviteWhatsAppLink } from '@/lib/invites';
import { readOrgTree, type OrgTree } from '@/lib/org';
import {
  previewPeopleRows, readRosterImports, rowsToCsv, savePeopleRows, type PeoplePreview, type PeopleRow, type PeopleSaved,
  type RosterImportView,
} from '@/lib/people';
import { saveFile } from '@/lib/save-file';
import { useCan } from '@/lib/session';

/** *Unduh akun & password (PDF)*'s confirmation, loaded the first time it opens (P19.30-T2 AC-2). */
const TemporaryPasswordsDialog = dynamic(
  () => import('@/components/temporary-passwords-dialog').then((m) => m.TemporaryPasswordsDialog), { ssr: false },
);

/**
 * **How new people get in** (P19.30-T2 AC-1; ADR-0288 §5, restoring ADR-0205 §10's tick): *Kirim undangan email* — each
 * new person emailed a link to choose their password, the default — or *Password sementara (PDF)*: nobody emailed, and
 * the *Akun & password* PDF of the accounts just made offered at once.
 */
type Access = 'invite' | 'temporary';

/** The template's eleven columns, in its order — the file's contract (ADR-0205 §5), the same in both languages. */
const COLUMNS = [
  'Kode agen', 'Nama', 'Peran', 'Kode upline', 'No. WhatsApp', 'Email', 'Tanggal bergabung', 'Waktu', 'Tanggal lahir',
  'Jenis kelamin', 'Bulan bergabung di perusahaan',
] as const;
/** What a column takes, where its hint is the file's own shape — the contract, the same in both languages (ADR-0205 §5). */
const FORMATS: Readonly<Record<string, string>> = {
  Peran: 'Agent / AAB / AB',
  'Tanggal bergabung': 'DD/MM/YYYY',
  Waktu: 'Full-time / Part-time',
  'Tanggal lahir': 'DD/MM/YYYY',
  'Jenis kelamin': 'L / P',
  'Bulan bergabung di perusahaan': 'YYYY-MM',
};
const hintOf = (words: Record<string, string>, column: string): string | undefined => words[column] ?? FORMATS[column];

/** The three a row cannot do without (*wajib*). */
const REQUIRED = new Set<string>(['Kode agen', 'Nama', 'Peran']);

/** What a row comes to, as its pill says it: *Baru*, *Diperbarui*, *Perlu dicek* — or *Dilewati*. */
type RowState = 'new' | 'updated' | 'check' | 'skipped';
const STATE_TONE: Record<RowState, PillTone> = { new: 'green', updated: 'blue', check: 'amber', skipped: 'red' };
const stateOf = (row: PeopleRow): RowState =>
  row.outcome === 'skipped' ? 'skipped' : row.flagged.length > 0 ? 'check' : row.outcome === 'updated' ? 'updated' : 'new';

/**
 * **Import people** (P19.20-T5; ADR-0273 §6, amending ADR-0205 §5–§11 and ADR-0250 for the screen; the People mockup's
 * frames 13–21) — the same pattern as Data upload.
 *
 * - **One navy card** (AC-1): *Tambah banyak anggota sekaligus · Isi template, lalu unggah*, *"Satu baris per orang ·
 *   wajib: kode agen, nama, peran · Lihat kolom"*, *Unggah file* and *Unduh template* — nothing else. *Lihat kolom* opens a
 *   compact three-column grid of the eleven columns, the required marked *, a short hint each.
 * - **After *Unggah*** (AC-2): *Unggah anggota* — the file and *Ganti*, the tiles *orang baru · diperbarui · perlu dicek ·
 *   semua disimpan*, the rows with a status pill; **a tapped row opens its cells to fix or fill**, the unreadable field in
 *   yellow; *Periksa lagi* checks the corrected rows again, and ***Simpan semua (n orang)*** saves — the file as it came,
 *   or the corrected rows with its name (`roster`, `fileName`). The same agent code updates, never duplicates; an
 *   unreadable optional cell is left empty, *perlu dicek*, and the person still added; new people are invited by email or
 *   WhatsApp — the WhatsApp ones shared from here once saved. *Since P19.30-T2 (ADR-0288 §5):* the step asks how new
 *   people get in — ***Kirim undangan email*** (the default) or ***Password sementara (PDF)*** — and with the second
 *   nobody is emailed (`invite: false`) and the *Akun & password* PDF of the accounts just made is offered at once
 *   (`membershipIds`), and again from a card above the structure.
 * - **Below** (AC-3): ***Struktur saat ini*** — the KPM's tree, AB → AAB → Agent under each leader, *Lihat seluruh struktur
 *   di Org tree ›*; after a save the new people under their upline with a green *Baru* on a light green row — then
 *   ***Riwayat unggah*** (`GET /people/imports`). A row of the tree opens the member sheet.
 * - The Owner, the Admins, a core leader and the Super Admin inside the KPM (AC-4): `kpm:import_roster`, the page's gate.
 *   **No word *impor* on the screen.**
 */
export function RosterImport({ kpmId }: { kpmId: string }) {
  const t = useMessages(rosterImportMessages);
  const figures = useFigureLanguage();
  const { show } = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PeoplePreview | null>(null);
  const [cells, setCells] = useState<string[][]>([]);
  /** Rows changed since the file came: saved as corrected text, not the file. */
  const [dirty, setDirty] = useState(false);
  /** Rows changed since the last check: *Periksa lagi* is offered. */
  const [edited, setEdited] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | 'reading' | 'checking' | 'saving'>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState<PeopleSaved | null>(null);
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [history, setHistory] = useState<RosterImportView[] | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>('invite');
  /*
   * **Only a reader who may download the PDF is asked** (OD-485's default): the KPM's Owners and the Super Admin inside it
   * (`member:issue_temporary_password`). An Admin or a core leader importing invites by email, as before — a choice whose
   * PDF they would then be refused is a dead end; the Owner hands out the passwords from *All members* ⋯ afterwards.
   */
  const mayIssue = useCan('member:issue_temporary_password');
  /** The accounts a *Password sementara* save made, for their PDF (P19.30-T2 AC-2); `null` when none is offered. */
  const [madeForPdf, setMadeForPdf] = useState<string[] | null>(null);
  const [issuing, setIssuing] = useState(false);
  const p = useMessages(temporaryPasswordsMessages);
  const accessName = useId();

  const loadBelow = useCallback(async () => {
    const [read, files] = await Promise.all([
      readOrgTree(undefined, 'kpm').catch(() => null),
      readRosterImports().catch(() => [] as RosterImportView[]),
    ]);
    setTree(read);
    setHistory(files);
    return read;
  }, []);
  useEffect(() => { void loadBelow(); }, [loadBelow]);

  const answered = (next: PeoplePreview) => {
    setPreview(next);
    setCells(next.rows.map((r) => [...r.cells]));
  };

  async function choose(chosen: File | undefined) {
    if (!chosen) return;
    setFile(chosen);
    setMadeForPdf(null);
    setDirty(false);
    setEdited(false);
    setOpenRow(null);
    setError(null);
    setBusy('reading');
    try {
      answered(await previewRosterFile(kpmId, chosen) as PeoplePreview);
    } catch (err) {
      setError(toDisplayError(err));
      setPreview(null);
    } finally {
      setBusy(null);
      if (picker.current) picker.current.value = '';
    }
  }

  async function recheck() {
    if (!preview) return;
    setBusy('checking');
    setError(null);
    try {
      answered(await previewPeopleRows(kpmId, rowsToCsv(preview.header, cells)));
      setEdited(false);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveAll() {
    if (!preview || !file) return;
    setBusy('saving');
    setError(null);
    const invite = !mayIssue || access === 'invite' || preview.counts.imported === 0;
    try {
      const result = dirty
        ? await savePeopleRows(kpmId, rowsToCsv(preview.header, cells), file.name, invite)
        : await importRosterFile(kpmId, file, invite) as PeopleSaved;
      // *Password sementara (PDF)*: the PDF of the accounts just made, offered at once (P19.30-T2 AC-2).
      const made = result.membershipIds ?? [];
      setMadeForPdf(!invite && made.length > 0 ? made : null);
      setIssuing(!invite && made.length > 0);
      const created = result.counts.imported + result.counts.invited;
      show(t.done({ created, updated: result.counts.updated }));
      setSaved(result);
      setPreview(null);
      setFile(null);
      const read = await loadBelow();
      const newCodes = new Set(result.rows.filter((r) => r.outcome === 'imported').map((r) => r.agentCode));
      setFresh(new Set((read?.nodes ?? []).filter((n) => newCodes.has(n.agentCode)).map((n) => n.membershipId)));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function template() {
    try {
      saveFile(await downloadRosterTemplate('xlsx', kpmId), ROSTER_TEMPLATE_FILENAME.xlsx);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  const rows = preview?.rows ?? [];
  const toSave = preview ? preview.counts.imported + preview.counts.invited + preview.counts.updated : 0;
  const invites = (saved?.rows ?? []).filter((r) => r.invite);

  return (
    <div className="flex flex-col gap-5">
      {/* ── The navy card (AC-1) ── */}
      <section className="flex flex-col gap-3 rounded-lg bg-secondary px-5 py-4 text-secondary-contrast md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-secondary-muted">{t.eyebrow}</p>
          <h2 className="font-display text-xl font-bold text-primary">{t.title}</h2>
          <p className="text-sm">
            {t.line}{' · '}
            <button type="button" className={cn('underline', HIT_AREA)} aria-expanded={columnsOpen} onClick={() => setColumnsOpen((o) => !o)}>
              {t.seeColumns}
            </button>
          </p>
        </div>
        <div className="flex flex-col gap-2 max-md:w-full">
          <input ref={picker} type="file" accept=".xlsx,.csv" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => void choose(e.target.files?.[0])} />
          <Button className="min-h-11 rounded-pill" disabled={busy !== null} onClick={() => picker.current?.click()}>
            <LineIcon name="upload" className="h-4 w-4" />{busy === 'reading' ? t.reading : t.upload}
          </Button>
          <button type="button" onClick={() => void template()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-secondary-contrast/10 px-4 font-semibold text-secondary-contrast hover:bg-secondary-contrast/20">
            <LineIcon name="download" className="h-4 w-4" />{t.template}
          </button>
        </div>
      </section>

      {error && !preview && <ErrorBanner {...error} />}

      {columnsOpen && (
        <section aria-labelledby="columns-title" className="rounded-lg bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="columns-title" className="text-md font-bold text-navy">{t.columnsTitle}</h2>
            <button type="button" aria-label={t.closeColumns} onClick={() => setColumnsOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-pill text-muted hover:bg-hover-row">
              <LineIcon name="close" className="h-4 w-4" />
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column}>
                <dt className="text-md font-bold text-navy">
                  {column}{REQUIRED.has(column) && <span className="text-alert" aria-hidden="true"> *</span>}
                </dt>
                {hintOf(t.hints, column) && <dd className="text-sm text-muted">{hintOf(t.hints, column)}</dd>}
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-muted"><span className="text-alert" aria-hidden="true">*</span>{t.columnsNote.slice(1)}</p>
        </section>
      )}

      {madeForPdf && (
        /*
         * P19.30-T2 AC-2 (ADR-0288 §5): the save chose *Password sementara (PDF)* — the accounts it made, their PDF a tap
         * away (the confirmation opens by itself once; this brings it back).
         */
        <section
          aria-labelledby="temporary-title"
          // On a phone the button goes under the words, full width (the P19.30 browser walk: at 375 it left the words a word wide).
          className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-4 max-md:flex-col max-md:items-stretch"
          data-roster-temporary=""
        >
          <div className="min-w-0 flex-1">
            <h2 id="temporary-title" className="text-md font-bold text-navy">{p.title}</h2>
            <p className="text-sm text-muted">{t.madeForPdf({ n: madeForPdf.length })}</p>
          </div>
          <Button className="min-h-11 rounded-pill max-md:w-full" onClick={() => setIssuing(true)}>
            <LineIcon name="download" className="h-4 w-4" />{p.item}
          </Button>
        </section>
      )}

      {invites.length > 0 && (
        <section aria-labelledby="invites-title" className="rounded-lg bg-card p-4">
          <h2 id="invites-title" className="mb-2 text-md font-bold text-navy">{t.whatsAppTitle}</h2>
          <ul className="flex flex-col gap-1.5">
            {invites.map((r) => {
              const link = r.invite ? inviteWhatsAppLink(r.invite.phone, r.fullName, r.invite.link) : null;
              return (
                <li key={r.line} className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold uppercase text-ink">{r.fullName}</span>
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" aria-label={t.sendOnWhatsApp({ name: r.fullName })}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-white">
                      <LineIcon name="whatsapp" className="h-5 w-5" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Struktur saat ini (AC-3) ── */}
      <section aria-labelledby="structure-title">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="structure-title" className="text-md font-bold text-navy">{t.structureTitle}</h2>
          <span className="text-sm text-muted">{fresh.size > 0 ? t.structureFresh({ n: fresh.size }) : t.structureNote}</span>
        </div>
        {tree === null ? <SkeletonCards count={3} label={t.structureLoading} /> : (
          <KpmStructure
            tree={tree}
            fresh={fresh}
            onOpen={setSheet}
            footer={(
              <Link href="/people/org-tree" className="flex min-h-11 items-center justify-center border-t border-divider text-md font-semibold text-navy hover:bg-hover-row">
                {t.seeOrgTree}
              </Link>
            )}
          />
        )}
      </section>

      {/* ── Riwayat unggah (AC-3) ── */}
      <section aria-labelledby="history-title">
        <h2 id="history-title" className="mb-2 text-md font-bold text-navy">{t.historyTitle}</h2>
        {history === null ? null : history.length === 0 ? (
          <p className="rounded-lg bg-card px-4 py-3 text-md text-muted">{t.historyEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider overflow-hidden rounded-lg bg-card">
            {history.map((h) => (
              <li key={h.importId} data-import={h.importId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <LineIcon name="document" className="h-5 w-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-md font-semibold text-navy">{h.fileName ?? t.noFileName}</p>
                  <p className="text-sm text-muted">
                    {t.historyLine({ date: formatOfficeDay(h.importedAt, OFFICE_TIME_ZONE, figures), by: h.byName?.toUpperCase() ?? null })}
                  </p>
                </div>
                <span className="flex gap-1.5">
                  <TonePill tone="green">{t.newN({ n: h.created })}</TonePill>
                  <TonePill tone="blue">{t.updatedN({ n: h.updated })}</TonePill>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Unggah anggota (AC-2) ── */}
      {preview && file && (
        <Modal
          open
          title={t.dialogTitle}
          onClose={() => { setPreview(null); setFile(null); setError(null); }}
          className="max-w-[40rem]"
          footer={(
            <div className="flex flex-col gap-2">
              {edited ? (
                <Button variant="secondary" className="min-h-11 w-full rounded-pill" disabled={busy !== null} onClick={() => void recheck()}>
                  {t.recheck}
                </Button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="min-h-11 w-full rounded-pill" onClick={() => { setPreview(null); setFile(null); }}>{t.cancel}</Button>
                <Button className="min-h-11 w-full rounded-pill" disabled={busy !== null || toSave === 0 || preview.issues.length > 0}
                  onClick={() => void saveAll()}>
                  {busy === 'saving' ? t.saving : t.saveAll({ n: toSave })}
                </Button>
              </div>
            </div>
          )}
        >
          <div className="flex flex-col gap-3 pb-2">
            {error && <ErrorBanner {...error} />}
            <div className="flex items-center gap-3 border-b border-divider pb-2">
              <LineIcon name="document" className="h-6 w-6 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-md font-semibold text-navy">{file.name}</p>
                <p className="text-sm text-muted">{t.rowsN({ n: rows.length })}</p>
              </div>
              <button type="button" className="min-h-11 px-2 text-md text-navy underline" onClick={() => picker.current?.click()}>{t.change}</button>
            </div>
            {preview.issues.length > 0 ? (
              <div role="alert" className="rounded-md bg-pill-red px-3 py-2 text-sm text-pill-red-ink">
                <p className="font-semibold">{t.unreadable}</p>
                <ul className="list-disc pl-5">{preview.issues.map((i) => <li key={`${i.line}-${i.column}`}>{i.message}</li>)}</ul>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile n={preview.counts.imported + preview.counts.invited} label={t.tiles.created} tone="bg-pill-green text-pill-green-ink" />
                  <Tile n={preview.counts.updated} label={t.tiles.updated} tone="bg-pill-blue text-pill-blue-ink" />
                  <Tile n={rows.filter((r) => stateOf(r) === 'check' || stateOf(r) === 'skipped').length} label={t.tiles.check} tone="bg-pill-amber text-pill-amber-ink" />
                  <Tile n={toSave} label={t.tiles.saved} tone="bg-base text-navy" />
                </div>
                <ul className="flex flex-col divide-y divide-divider rounded-md border border-hairline">
                  {rows.map((row, index) => (
                    <PreviewRow
                      key={row.line}
                      row={row}
                      header={preview.header}
                      cells={cells[index] ?? row.cells}
                      open={openRow === index}
                      onToggle={() => setOpenRow(openRow === index ? null : index)}
                      onCell={(column, value) => {
                        setCells((now) => now.map((c, i) => (i === index ? c.map((v, j) => (j === column ? value : v)) : c)));
                        setDirty(true);
                        setEdited(true);
                      }}
                    />
                  ))}
                </ul>
                {mayIssue && preview.counts.imported > 0 && (
                  /*
                   * P19.30-T2 AC-1 (ADR-0288 §5; ADR-0205 §10's tick restored): how the new people get in — only when the
                   * file makes anybody new with an email, the people it is about.
                   */
                  <fieldset className="flex flex-col gap-1 rounded-md border border-hairline px-3 py-2" data-roster-access="">
                    <legend className="px-1 text-sm font-semibold text-muted">{t.access.legend}</legend>
                    {(['invite', 'temporary'] as const).map((choice) => (
                      <label key={choice} className="flex min-h-11 cursor-pointer items-center gap-3">
                        <input
                          type="radio"
                          name={accessName}
                          value={choice}
                          checked={access === choice}
                          onChange={() => setAccess(choice)}
                          className="h-5 w-5 shrink-0 accent-secondary"
                        />
                        <span className="text-md font-semibold text-navy">{t.access[choice]}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <p className="text-sm text-muted">{mayIssue && access === 'temporary' && preview.counts.imported > 0 ? t.noteTemporary : t.note}</p>
              </>
            )}
          </div>
        </Modal>
      )}

      {sheet && <MemberSheet membershipId={sheet} onClose={() => setSheet(null)} onChanged={() => void loadBelow()} />}
      {issuing && madeForPdf && <TemporaryPasswordsDialog membershipIds={madeForPdf} onClose={() => setIssuing(false)} />}
    </div>
  );
}

function Tile({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={cn('rounded-md px-3 py-2', tone)}>
      <div className="font-display text-xl font-bold">{n}</div>
      <div className="text-sm font-semibold">{label}</div>
    </div>
  );
}

/** One row of the file: the NAME, what it comes to, and — tapped — its cells to fix or fill. */
function PreviewRow({
  row, header, cells, open, onToggle, onCell,
}: {
  row: PeopleRow;
  header: readonly string[];
  cells: readonly string[];
  open: boolean;
  onToggle: () => void;
  onCell: (column: number, value: string) => void;
}) {
  const t = useMessages(rosterImportMessages);
  const id = useId();
  const state = stateOf(row);
  const line = [row.role, row.leaderAgentCode ? t.upline({ code: row.leaderAgentCode }) : null, ...row.messages, ...row.warnings]
    .filter(Boolean).join(' · ');
  return (
    <li data-preview-row={row.line} data-state={state}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} aria-label={t.rowOpen({ name: row.fullName })}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover-row">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold uppercase text-ink">{row.fullName || row.agentCode}</p>
          <p className="truncate text-sm text-muted">{line}</p>
        </div>
        <TonePill tone={STATE_TONE[state]}>{t.pill[state]}</TonePill>
        <LineIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <div id={id} className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-3">
          {header.map((column, index) => {
            const flagged = row.flagged.includes(column);
            const inputId = `${id}-${index}`;
            return (
              <div key={column} className={cn('rounded-md border px-2.5 py-1.5', flagged ? 'border-primary bg-pill-amber' : 'border-hairline bg-card')}>
                <label htmlFor={inputId} className="block text-xs text-muted">{column}</label>
                <input id={inputId} value={cells[index] ?? ''} onChange={(e) => onCell(index, e.target.value)}
                  className={cn('min-h-11 w-full bg-transparent text-md font-bold text-navy placeholder:font-normal placeholder:text-muted focus:outline-none')}
                  placeholder={hintOf(t.hints, column)} />
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}
