'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Button, Card, ErrorBanner, Field, Textarea } from '@/components/ui/field';
import { ConsoleCode } from '@/components/ui/console-code';
import { Toast, useToast } from '@/components/ui/toast';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { errorReference } from '@/lib/browser-errors';
import { cn } from '@/lib/cn';
import { saveFile } from '@/lib/save-file';
import { useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import { LeaderLimitNotice, isLeaderLimit } from './leader-limit-notice';
import {
  downloadRosterTemplate,
  importRoster,
  importRosterFile,
  previewRoster,
  previewRosterFile,
  ROSTER_TEMPLATE_FILENAME,
  rosterTemplate,
  SKIPPED_ROWS_FILENAME,
  type RosterImportResult,
  type RosterOutcome,
  type RosterPreview,
  type RosterTemplateFormat,
} from '@/lib/admin';

/**
 * **The file's columns, in its order, and what each holds** (P18.9-T4 AC-4, ADR-0176 §6; A3's since P19.3-T4, ADR-0205
 * §5). The names are the file's header — *Kode agen*, *Nama*, *Peran* … — the same in both languages, because they are
 * what the file holds (P18.10-T3 AC-4); what each holds is the rule the import applies, which the Excel template's
 * *Petunjuk* sheet spells out in full.
 */
const COLUMNS = [
  ['Kode agen', 'agentCode'], ['Nama', 'fullName'], ['Peran', 'role'], ['Kode upline', 'upline'], ['No. WhatsApp', 'phone'],
  ['Email', 'email'], ['Tanggal bergabung', 'joinDate'], ['Waktu', 'workStatus'], ['Tanggal lahir', 'dateOfBirth'],
  ['Jenis kelamin', 'gender'], ['Bulan bergabung di perusahaan', 'companyJoinMonth'],
] as const;

/** A3's chips: *Masuk* green, *Diperbarui* blue, *Dilewati* red — each with its words, never the colour alone. */
const OUTCOME_TONE: Record<RosterOutcome, PillTone> = { imported: 'green', updated: 'blue', skipped: 'red' };

/**
 * Filling and updating an office from a spreadsheet (P3.2-T4; the setup spec's §A3 since P19.3-T4, ADR-0205).
 *
 * Rendered by two routes: `/admin/tenants/[kpmId]/roster`, where a Super Admin names the office, and `/people/import`,
 * where an Owner or an Admin does not have to because their session already says which one. One component, because the
 * two differ only in where the office id comes from.
 *
 * **Three parts, the guide apart from the data** (ADR-0184): *Unduh template* — Excel, recommended, and CSV; *Panduan
 * pengisian* — the file's columns and its rules, open on a desktop and folded on a phone; *Unggah* — the filled file,
 * `.xlsx` or `.csv`, sent as it is for the server to read, or the paste. **Template, upload, preview, import.**
 *
 * **Under A3 each row has a result** (AC-10): *Masuk*, *Diperbarui* or *Dilewati*, with the server's reason, and the
 * line above them — *"N orang baru siap diimpor, M diperbarui, K baris dilewati."* The skipped rows download as the same
 * columns with an *Alasan* column, built by the server so the browser never splits a CSV. *Impor N orang* writes the
 * valid rows as one unit; *Kirim undangan lewat email* (on by default) mails each new person a one-time link to choose
 * their password. **No password is ever shown** (ADR-0205 §10).
 */
export function RosterImport({
  kpmId,
  backHref,
  touchTargets = false,
}: {
  kpmId: string;
  backHref: string;
  /**
   * **Every control of its own 44px tall below 1024px** (P19.2-T3 AC-4; UI-142) on `/people/*`. Opt-in, so
   * `/admin/tenants/[kpmId]/roster` — the Super Admin's, another ticket's (UI-135) — draws what it drew.
   */
  touchTargets?: boolean;
}) {
  const t = useMessages(rosterImportMessages);
  /** A line a finger aims at, 44px tall below 1024px, where `touchTargets` asks for it. */
  const line = touchTargets ? 'max-lg:min-h-11' : undefined;
  const phone = usePhone();
  const recommendedId = useId();
  const guideHeadingId = useId();
  const inviteHintId = useId();
  const { toast, show } = useToast();
  // The leader limit's words differ by reader (P13.2-T4 AC-5): the Super Admin can raise it.
  const { me } = useSession();
  const audience = me?.user.platformRole === 'super_admin' ? 'platform' : 'office';
  // The filled file first: the Excel template is the recommended way in (ADR-0184). The paste stays, second.
  const [how, setHow] = useState<'file' | 'paste'>('file');
  const [rows, setRows] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [done, setDone] = useState<RosterImportResult | null>(null);
  /** A3's checkbox, on by default. */
  const [invite, setInvite] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [examples, setExamples] = useState<string[][]>([]);
  /** The template being fetched, and why the last one could not be — said beside the buttons, with a way to ask again. */
  const [saving, setSaving] = useState<RosterTemplateFormat | null>(null);
  const [templateError, setTemplateError] = useState<{ format: RosterTemplateFormat; error: ApiError } | null>(null);
  /** The guide is open on a desktop and folded on a phone, where the upload would otherwise be a long scroll away. */
  const [guideOpen, setGuideOpen] = useState(true);
  useEffect(() => { setGuideOpen(!phone); }, [phone]);

  /*
   * The three worked examples, for the paste box's placeholder. Read from the API rather than written here: an example
   * the screen composed could disagree with the parser. A placeholder is all they are, so a read that fails leaves the
   * box without one and asks nothing of the reader.
   */
  useEffect(() => {
    let live = true;
    rosterTemplate()
      .then((template) => { if (live) setExamples(template.examples); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  /** **The template as a file, fetched with the token and saved** (ADR-0184), the office named for its ladder. */
  async function download(format: RosterTemplateFormat) {
    setSaving(format);
    setTemplateError(null);
    try {
      saveFile(await downloadRosterTemplate(format, kpmId), ROSTER_TEMPLATE_FILENAME[format]);
    } catch (err) {
      setTemplateError({ format, error: toDisplayError(err) });
    } finally {
      setSaving(null);
    }
  }

  /** The file is kept as it was chosen and sent as bytes: the server reads a workbook or a CSV, the browser neither. */
  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError(null);
    setPreview(null);
    setDone(null);
    setFile(chosen);
  }

  const ready = how === 'file' ? file !== null : rows.trim() !== '';

  async function check() {
    setBusy('preview');
    setError(null);
    try {
      setPreview(how === 'file' && file ? await previewRosterFile(kpmId, file) : await previewRoster(kpmId, rows));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    setBusy('commit');
    setError(null);
    try {
      const result = how === 'file' && file ? await importRosterFile(kpmId, file, invite) : await importRoster(kpmId, rows, invite);
      setDone(result);
      setPreview(null);
      setRows('');
      setFile(null);
      // A3's toast, naming email (ADR-0205 §7).
      show(t.toast({ imported: result.counts.imported, updated: result.counts.updated, invited: result.invited > 0 }));
    } catch (err) {
      setError(toDisplayError(err));
      // A file the server could not read carries its issues: the list reappears rather than a bare refusal.
      // `err.error.details`, not `err.details`: `ApiRequestError` carries the envelope on an `error` field.
      const issues = (err as { error?: { details?: { issues?: RosterPreview['issues'] } } })?.error?.details?.issues;
      if (issues) setPreview({ issues, header: [], counts: { imported: 0, updated: 0, skipped: 0 }, rows: [], skippedCsv: null });
    } finally {
      setBusy(null);
    }
  }

  /** *"⬇ Unduh baris yang dilewati"*: the server's CSV — the file's columns and *Alasan* — saved as it is. */
  function downloadSkipped(csv: string) {
    saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), SKIPPED_ROWS_FILENAME);
  }

  /* The paste box shows the same three people the template does, tab-separated — what a clipboard carries. */
  const placeholder = examples.map((cells) => cells.join('\t')).join('\n');
  const code = (typed: string) => <code>{typed}</code>;
  const writes = preview ? preview.counts.imported + preview.counts.updated : 0;

  return (
    <>
      <Toast toast={toast} />
      {/* The office filled up while the import was written (P13.2-T4 AC-4): said in the limit's words, never its code. */}
      {error && (isLeaderLimit(error)
        ? <LeaderLimitNotice error={error} audience={audience} action="roster" />
        : <ErrorBanner {...error} />)}

      {done ? (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">
            {t.done({ imported: done.counts.imported, updated: done.counts.updated })}
          </h2>
          <p className="mt-1 text-md text-muted">
            {done.invited > 0 ? t.invitedLine({ n: done.invited }) : done.counts.imported > 0 ? t.notInvitedLine : null}
          </p>
          {done.skippedCsv && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-md text-navy">{t.skippedLine({ n: done.counts.skipped })}</p>
              <Button variant="secondary" className={line} onClick={() => downloadSkipped(done.skippedCsv as string)}>
                {t.downloadSkipped}
              </Button>
            </div>
          )}
          <Results rows={done.rows} />
          <Link
            href={backHref}
            className={cn('mt-4 inline-block text-md font-semibold text-navy underline', touchTargets && 'max-lg:inline-flex max-lg:min-h-11 max-lg:items-center')}
          >
            {t.back}
          </Link>
        </Card>
      ) : (
        <>
          {/* 1 · The template: Excel, recommended, and CSV (ADR-0184). Always in view (P18.9-T4 AC-4). */}
          <Card>
            <h2 className="font-display text-lg font-bold text-navy">{t.downloadHeading}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button
                className="gap-1"
                onClick={() => void download('xlsx')}
                disabled={saving !== null}
                aria-describedby={recommendedId}
              >
                <span aria-hidden="true">⬇</span>{saving === 'xlsx' ? t.preparing : t.downloadExcel}
              </Button>
              <span id={recommendedId} className="text-sm font-semibold text-success">{t.recommended}</span>
              <Button variant="secondary" onClick={() => void download('csv')} disabled={saving !== null}>
                {saving === 'csv' ? t.preparing : t.downloadCsv}
              </Button>
            </div>
            {templateError && (
              <p role="alert" className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-alert">
                <span>{t.templateFailed({ message: templateError.error.message })}</span>
                <Button variant="inline" onClick={() => void download(templateError.format)}>{t.tryAgain}</Button>
                {/* A server's code and request id for support; none for a failure the browser detected (AC-10). */}
                {errorReference(templateError.error) === null
                  ? <ConsoleCode code={templateError.error.code} message={templateError.error.message} />
                  : <span className="text-2xs text-muted">{errorReference(templateError.error)}</span>}
              </p>
            )}
          </Card>

          {/* 2 · The fill-in guide, apart from the data: open on a desktop, folded on a phone. */}
          <Card className="mt-4">
            <details
              open={guideOpen}
              onToggle={(e) => setGuideOpen(e.currentTarget.open)}
              aria-labelledby={guideHeadingId}
              className="group"
            >
              <summary className={cn('flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden', line)}>
                <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">›</span>
                <h2 id={guideHeadingId} className="font-display text-lg font-bold text-navy">{t.guideHeading}</h2>
              </summary>
              {/* One row per person, these columns in this order (A3): the file's header names, and what each holds. */}
              <DataTable className="mt-3" caption={t.guideCaption} columns={[t.guideColumns.column, t.guideColumns.holds]}>
                {COLUMNS.map(([column, key]) => {
                  const holds = t.holds[key];
                  return (
                    <Row key={column}>
                      <Cell className="font-semibold">{column}</Cell>
                      <Cell className="text-muted">{typeof holds === 'function' ? holds({ code }) : holds}</Cell>
                    </Row>
                  );
                })}
              </DataTable>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>{t.ruleRequired}</li>
                <li>{t.ruleOnePerRow}</li>
                <li>{t.ruleUplines}</li>
                <li>{t.ruleSkipped}</li>
              </ul>
            </details>
          </Card>

          {/* 3 · The upload: the filled file first, sent as it is; the paste second, which needs no file at all. */}
          <Card className="mt-4">
            <h2 className="font-display text-lg font-bold text-navy">{t.uploadHeading}</h2>
            <fieldset className="mt-3">
              <legend className="text-md font-semibold text-navy">{t.how}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {([
                  ['file', t.upload],
                  ['paste', t.paste],
                ] as const).map(([value, label]) => (
                  <label key={value} className={cn('flex items-center gap-2 text-md text-navy', line)}>
                    <input
                      type="radio"
                      name="how"
                      value={value}
                      checked={how === value}
                      onChange={() => {
                        // Switching wipes what was there: checking a paste and importing a file chosen earlier is not
                        // a thing anybody means to do.
                        setHow(value);
                        setRows('');
                        setFile(null);
                        setPreview(null);
                        setError(null);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {how === 'file' ? (
              <Field label={t.rosterFile} htmlFor="roster" className="mt-4">
                <input
                  id="roster"
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={choose}
                  className={cn('text-md text-navy', line)}
                />
              </Field>
            ) : (
              <Field label={t.rows} htmlFor="rows" hint={t.rowsHint} className="mt-4">
                <Textarea
                  id="rows"
                  rows={8}
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  placeholder={placeholder}
                  className="font-mono text-sm"
                />
              </Field>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void check()} disabled={!ready || busy !== null}>
                {busy === 'preview' ? t.checking : t.check}
              </Button>
              {how === 'file' && file && <span className="text-sm text-muted">{file.name}</span>}
            </div>

            {/* The file could not be read at all: its problems, and nothing to import. */}
            {preview && preview.issues.length > 0 && (
              <div className="mt-4">
                <h3 className="font-display text-md font-bold text-navy">{t.unreadable({ n: preview.issues.length })}</h3>
                <p className="mt-1 text-sm text-muted">{t.unreadableLine}</p>
                <DataTable
                  className="mt-3"
                  caption={t.problemsCaption}
                  columns={[t.problemColumns.line, t.problemColumns.column, t.problemColumns.problem]}
                >
                  {preview.issues.map((issue) => (
                    <Row key={`${issue.line}-${issue.column}-${issue.message}`}>
                      <Cell>{issue.line}</Cell>
                      <Cell className="text-muted">{issue.column}</Cell>
                      <Cell>{issue.message}</Cell>
                    </Row>
                  ))}
                </DataTable>
              </div>
            )}

            {/* A3's preview: the line, a result per row, the invitation, and the three actions. */}
            {preview && preview.issues.length === 0 && (
              <div className="mt-4">
                <p role="status" className="font-semibold text-navy">{t.ready(preview.counts)}</p>
                <Results rows={preview.rows} />
                {preview.counts.imported > 0 && (
                  <div className="mt-3">
                    <label className={cn('flex items-center gap-2 text-md text-navy', line)}>
                      <input
                        type="checkbox"
                        checked={invite}
                        onChange={(e) => setInvite(e.target.checked)}
                        aria-describedby={inviteHintId}
                      />
                      {t.invite({ n: preview.counts.imported })}
                    </label>
                    <p id={inviteHintId} className="mt-1 text-sm text-muted">{t.inviteHint}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button onClick={() => void commit()} disabled={busy !== null || writes === 0}>
                    {busy === 'commit' ? t.importing : t.importN({ n: writes })}
                  </Button>
                  <Button variant="secondary" disabled={busy !== null} onClick={() => setPreview(null)}>{t.cancel}</Button>
                  {preview.skippedCsv && (
                    <Button variant="secondary" onClick={() => downloadSkipped(preview.skippedCsv as string)}>
                      {t.downloadSkipped}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

/** **Each row and what it comes to** (A3): *Kode agen · Nama · Peran · Kode upline · Hasil*, the server's words beside the chip. */
function Results({ rows }: { rows: RosterPreview['rows'] }) {
  const t = useMessages(rosterImportMessages);
  if (rows.length === 0) return null;
  return (
    <DataTable
      className="mt-3"
      caption={t.resultsCaption}
      columns={[t.resultColumns.agentCode, t.resultColumns.name, t.resultColumns.role, t.resultColumns.upline, t.resultColumns.result]}
    >
      {rows.map((row) => (
        <Row key={row.line}>
          <Cell className="whitespace-nowrap"><code className="text-sm">{row.agentCode}</code></Cell>
          <Cell>{row.fullName}</Cell>
          <Cell>{row.role}</Cell>
          <Cell className="whitespace-nowrap">{row.leaderAgentCode ? <code className="text-sm">{row.leaderAgentCode}</code> : t.none}</Cell>
          <Cell>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TonePill tone={OUTCOME_TONE[row.outcome]}>{t.outcome[row.outcome]}</TonePill>
              {row.messages.length > 0 && <span className="text-sm text-muted">{row.messages.join(' ')}</span>}
            </span>
          </Cell>
        </Row>
      ))}
    </DataTable>
  );
}
