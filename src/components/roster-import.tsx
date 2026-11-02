'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Button, Card, ErrorBanner, Field, Textarea } from '@/components/ui/field';
import { ConsoleCode } from '@/components/ui/console-code';
import { useMessages } from '@/i18n/language-provider';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { errorReference } from '@/lib/browser-errors';
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
  type ImportedPerson,
  type RosterPreview,
  type RosterTemplateFormat,
} from '@/lib/admin';

/**
 * **What is typed in a cell** — the import's contract, read by the parser (backend `roster-csv.ts`), so the same in
 * both languages: never words of the screen's (P18.98-T3 AC-4, *files are not words*).
 */
const FILE = {
  ab: 'AB', aab: 'AAB', agent: 'Agent', day: 'YYYY-MM-DD', month: 'YYYY-MM',
  fullTime: 'full-time', partTime: 'part-time', male: 'male', female: 'female',
} as const;

/**
 * **The file's nine columns, in its order, and what each holds** (P18.97-T4 AC-4, ADR-0176 §6; the client's UI-025:
 * the 120 words of instructions above the import, *Remove* at every size, become *"a short table of required columns
 * … and a Download template button"*). The names are the client's; what each holds is the rule the parser applies,
 * which the Excel template's *Petunjuk* sheet spells out in full (ADR-0184; backend `roster-file.ts`). A code in a cell
 * is what is typed in the file, in either language.
 */
function columnGuide(t: { columns: typeof rosterImportMessages.en.columns; holds: typeof rosterImportMessages.en.holds })
  : readonly { column: string; holds: React.ReactNode }[] {
  const code = (typed: string) => <code>{typed}</code>;
  return [
    { column: t.columns.name, holds: t.holds.name },
    { column: t.columns.email, holds: t.holds.email },
    { column: t.columns.agentCode, holds: t.holds.agentCode },
    { column: t.columns.role, holds: t.holds.role({ ab: code(FILE.ab), aab: code(FILE.aab), agent: code(FILE.agent) }) },
    { column: t.columns.leader, holds: t.holds.leader },
    { column: t.columns.dateOfBirth, holds: t.holds.dateOfBirth({ shape: code(FILE.day) }) },
    { column: t.columns.joinMonth, holds: t.holds.joinMonth({ shape: code(FILE.month) }) },
    { column: t.columns.workStatus, holds: t.holds.either({ a: code(FILE.fullTime), b: code(FILE.partTime) }) },
    { column: t.columns.gender, holds: t.holds.either({ a: code(FILE.male), b: code(FILE.female) }) },
  ];
}

/**
 * Filling an office from a spreadsheet (P3.6-T4).
 *
 * Rendered by two routes: `/admin/tenants/[kpmId]/roster`, where a Super Admin names the
 * office, and `/people/import`, where an Owner or Admin does not have to because their
 * session already says which one. One component, because the two differ only in where the
 * office id comes from — and a second copy is how the two would drift.
 *
 * **Three parts, the guide apart from the data** (ADR-0184; the developer for the product owner, 2026-11-01): *Unduh
 * template* — Excel, recommended, and CSV; *Panduan pengisian* — the file's columns (UI-025) and three rules, open on a
 * desktop and folded on a phone; *Unggah* — the filled file, `.xlsx` or `.csv`, sent as it is for the server to read,
 * or the paste, kept. **Template, upload, preview, commit** — the shape P9-T2/T3 specifies for the production import,
 * on purpose: two importers that behave differently are two things to learn.
 *
 * The screen's job is to make *all-or-nothing* legible. The server refuses the whole file
 * for one bad row, so a preview that said "9 of 10 will import" would be describing
 * something that cannot happen. It says how many rows the file has, and then either
 * everything that is wrong with it or nothing at all.
 *
 * The passwords come back **once**. They are not stored, not in the audit row, and not
 * recoverable — so the screen keeps them on the page until the operator navigates away,
 * says so plainly, and offers them as text to copy in one go rather than one at a time.
 */
export function RosterImport({ kpmId, backHref }: { kpmId: string; backHref: string }) {
  const t = useMessages(rosterImportMessages);
  const phone = usePhone();
  const recommendedId = useId();
  const guideHeadingId = useId();
  // The leader limit's words differ by reader (P13.2-T4 AC-5): the Super Admin can raise it.
  const { me } = useSession();
  const audience = me?.user.platformRole === 'super_admin' ? 'platform' : 'office';
  // The filled file first: the Excel template is the recommended way in (ADR-0184). The paste stays, second.
  const [how, setHow] = useState<'file' | 'paste'>('file');
  const [rows, setRows] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [created, setCreated] = useState<ImportedPerson[] | null>(null);
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
   * the screen composed could disagree with the parser over the quoted row it is there to show. A placeholder is all
   * they are, so a read that fails leaves the box without one and asks nothing of the reader.
   */
  useEffect(() => {
    let live = true;
    rosterTemplate()
      .then((template) => { if (live) setExamples(template.examples); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  /**
   * **The template as a file, fetched with the token and saved** (ADR-0184). Not a link: the token lives in memory, and
   * a link to the API would arrive without it. The office is named so the workbook's role column lists its ladder.
   */
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
    setCreated(null);
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
      const result = how === 'file' && file ? await importRosterFile(kpmId, file) : await importRoster(kpmId, rows);
      setCreated(result.created);
      setPreview(null);
      setRows('');
      setFile(null);
    } catch (err) {
      setError(toDisplayError(err));
      // The refusal carries the row-level issues, so the list reappears rather than the
      // operator being told "something was wrong" and having to guess.
      // `err.error.details`, not `err.details`: `ApiRequestError` carries the envelope on
      // an `error` field, and reading the shorter path silently found nothing.
      const issues = (err as { error?: { details?: { issues?: RosterPreview['issues'] } } })
        ?.error?.details?.issues;
      if (issues) setPreview({ issues, willCreate: 0, rows: preview?.rows ?? [] });
    } finally {
      setBusy(null);
    }
  }

  /*
   * The paste box shows the same three people the template does, tab-separated — because
   * that is what a clipboard carries, and a placeholder in the wrong shape teaches the
   * wrong shape.
   *
   * Three rather than one, and this is the whole point: a single row can only demonstrate
   * an *empty* leader column, which is the case nobody gets wrong. Agus leads Sari leads
   * Rina, so the column is visibly a code rather than a name, and visibly blank only at
   * the top of the office.
   */
  const placeholder = examples.map((cells) => cells.join('\t')).join('\n');
  const code = (typed: string) => <code>{typed}</code>;

  return (
    <>
      {/* The office filled up between the preview and the import (P13.2-T4 AC-4): said in the
          limit's words, which name it and who can raise it, never its code. */}
      {error && (isLeaderLimit(error)
        ? <LeaderLimitNotice error={error} audience={audience} action="roster" />
        : <ErrorBanner {...error} />)}

      {created ? (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.created({ n: created.length })}</h2>
          <p className="mt-1 text-md text-muted">
            {t.sendPasswords({ strong: (words) => <strong>{words}</strong>, em: (words) => <em>{words}</em> })}
          </p>
          <p className="mt-2 text-md text-muted">{t.firstSignIn}</p>

          <DataTable
            className="mt-4"
            caption={t.createdCaption}
            columns={[t.createdColumns.name, t.createdColumns.email, t.createdColumns.agentCode, t.createdColumns.password]}
          >
            {created.map((person) => (
              <Row key={person.email}>
                <Cell>{person.fullName}</Cell>
                <Cell className="text-muted">{person.email}</Cell>
                <Cell><code className="text-sm">{person.agentCode}</code></Cell>
                <Cell><code className="text-sm font-semibold">{person.temporaryPassword}</code></Cell>
              </Row>
            ))}
          </DataTable>

          <Link href={backHref} className="mt-4 inline-block text-md font-semibold text-navy underline">
            {t.back}
          </Link>
        </Card>
      ) : (
        <>
          {/* 1 · The template: Excel, recommended, and CSV (ADR-0184). Always in view (P18.97-T4 AC-4). */}
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
              <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">›</span>
                <h2 id={guideHeadingId} className="font-display text-lg font-bold text-navy">{t.guideHeading}</h2>
              </summary>
              {/* One row per person, these columns in this order (P18.97-T4 AC-4): the paragraph's every fact, a row each. */}
              <DataTable
                className="mt-3"
                caption={t.guideCaption}
                columns={[t.guideColumns.column, t.guideColumns.holds]}
              >
                {columnGuide(t).map(({ column, holds }) => (
                  <Row key={column}>
                    <Cell className="font-semibold">{column}</Cell>
                    <Cell className="text-muted">{holds}</Cell>
                  </Row>
                ))}
              </DataTable>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>{t.ruleOnePerRow}</li>
                <li>{t.ruleLeaders}</li>
                <li>{t.ruleDates({ day: code(FILE.day), month: code(FILE.month) })}</li>
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
                  <label key={value} className="flex items-center gap-2 text-md text-navy">
                    <input
                      type="radio"
                      name="how"
                      value={value}
                      checked={how === value}
                      onChange={() => {
                        setHow(value);
                        // Switching wipes what was there. Checking a paste and then
                        // importing a file that was chosen earlier is not a thing anybody
                        // means to do.
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
                  className="text-md text-navy"
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
              <Button
                variant="secondary"
                onClick={() => void commit()}
                // Only after a clean preview. The server checks again regardless — this is
                // so the operator is never a single click from a refusal they could have
                // seen coming.
                disabled={busy !== null || !preview || preview.issues.length > 0}
              >
                {busy === 'commit' ? t.importing : t.importN({ n: preview?.willCreate ?? 0 })}
              </Button>
              {how === 'file' && file && <span className="text-sm text-muted">{file.name}</span>}
            </div>

            {preview && preview.issues.length === 0 && (
              <p role="status" className="mt-4 text-md font-semibold text-success">
                {t.ready({ n: preview.willCreate })}
              </p>
            )}

            {preview && preview.issues.length > 0 && (
              <div className="mt-4">
                <h3 className="font-display text-md font-bold text-navy">{t.problems({ n: preview.issues.length })}</h3>
                <p className="mt-1 text-sm text-muted">{t.allOrNothing}</p>
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
          </Card>
        </>
      )}
    </>
  );
}
