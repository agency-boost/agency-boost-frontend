'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Button, buttonClass, Card, ErrorBanner, Field, Textarea } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { ConsoleCode } from '@/components/ui/console-code';
import { useMessages } from '@/i18n/language-provider';
import { rosterImportMessages } from '@/i18n/messages/roster-import';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { errorReference } from '@/lib/browser-errors';
import { useSession } from '@/lib/session';
import { LeaderLimitNotice, isLeaderLimit } from './leader-limit-notice';
import {
  importRoster,
  previewRoster,
  rosterTemplate,
  type ImportedPerson,
  type RosterPreview,
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
 * which the downloaded template spells out in full (`ROSTER_TEMPLATE`, backend `roster-csv.ts`). A code in a cell is
 * what is typed in the file, in either language.
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
 * **Template, upload, preview, commit** — the shape P9-T2/T3 specifies for the production
 * import, on purpose: two importers that behave differently are two things to learn.
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
  // The leader limit's words differ by reader (P13.2-T4 AC-5): the Super Admin can raise it.
  const { me } = useSession();
  const audience = me?.user.platformRole === 'super_admin' ? 'platform' : 'office';
  const [rows, setRows] = useState('');
  const [how, setHow] = useState<'paste' | 'file'>('paste');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [created, setCreated] = useState<ImportedPerson[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [template, setTemplate] = useState<{ file: string; examples: string[][] } | null>(null);
  /** Why the template could not be read, so *Download template* can say so beside a way to ask again. */
  const [templateError, setTemplateError] = useState<ApiError | null>(null);
  const [templateAttempt, setTemplateAttempt] = useState(0);

  // The whole file comes from the API rather than being composed here. A template the
  // screen built itself would drift from the one the parser demands, and the failure
  // would read as "download the template" on a file downloaded from this very screen —
  // and the worked examples in it are the part most worth not paraphrasing.
  useEffect(() => {
    let live = true;
    setTemplateError(null);
    rosterTemplate()
      .then((t) => { if (live) setTemplate({ file: t.template, examples: t.examples }); })
      .catch((err) => { if (live) setTemplateError(toDisplayError(err)); });
    return () => { live = false; };
  }, [templateAttempt]);

  /**
   * Read the chosen file.
   *
   * `FileReader` rather than `Blob.text()`. The latter is shorter and is what this had
   * first — and it is `undefined` in jsdom and in Safari before 14, where the screen
   * would take a file, set its name, and quietly never enable the button. A control that
   * looks like it worked and did nothing is the worst of the three outcomes.
   */
  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setCreated(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => setRows(String(reader.result ?? ''));
    reader.onerror = () => setError({
      code: 'FILE_UNREADABLE',
      message: t.unreadable({ file: file.name }),
      requestId: 'local',
    });
    reader.readAsText(file);
  }

  async function check() {
    setBusy('preview');
    setError(null);
    try {
      setPreview(await previewRoster(kpmId, rows));
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
      const result = await importRoster(kpmId, rows);
      setCreated(result.created);
      setPreview(null);
      setRows('');
      setFileName(null);
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

  const templateHref = template
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(template.file)}`
    : null;

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
  const placeholder = template?.examples.map((cells) => cells.join('\t')).join('\n');

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
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.file}</h2>
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

          {/*
            * **Always in view, above the choice of pasting or a file** (P18.97-T4 AC-4): the template was offered only
            * once *Upload a CSV file* was chosen, so a reader who meant to paste never met it. The prototype's control
            * and words, as Data upload's (`KPM_Owner.html:1301`); a wait is shaped like it, a failure says so beside a
            * way to ask again.
            */}
          <div className="mt-4 flex min-h-10 flex-wrap items-center gap-x-2">
            {templateHref ? (
              <a href={templateHref} download="roster-template.csv" className={buttonClass('secondary', 'gap-1')}>
                <span aria-hidden="true">⬇</span>{t.downloadTemplate}
              </a>
            ) : templateError ? (
              <p role="alert" className="flex flex-wrap items-center gap-x-2 text-sm text-alert">
                <span>{t.templateFailed({ message: templateError.message })}</span>
                <Button variant="inline" onClick={() => setTemplateAttempt((n) => n + 1)}>{t.tryAgain}</Button>
                {/* A server's code and request id for support; none for a failure the browser detected (AC-10). */}
                {errorReference(templateError) === null
                  ? <ConsoleCode code={templateError.code} message={templateError.message} />
                  : <span className="text-2xs text-muted">{errorReference(templateError)}</span>}
              </p>
            ) : (
              <Skeleton label={t.loadingTemplate}><SkeletonBar className="h-10 w-48" /></Skeleton>
            )}
          </div>

          {/* Two ways in, and the one that needs no file goes first. Copying cells out of
              a spreadsheet puts tab-separated text on the clipboard, so somebody can do
              this without meeting a file format at all. */}
          <fieldset className="mt-4">
            <legend className="text-md font-semibold text-navy">{t.how}</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {([
                ['paste', t.paste],
                ['file', t.upload],
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
                      setFileName(null);
                      setPreview(null);
                      setError(null);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {how === 'paste' ? (
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
          ) : (
            <>
              <Field label={t.rosterFile} htmlFor="roster" className="mt-4">
                <input
                  id="roster"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={choose}
                  className="text-md text-navy"
                />
              </Field>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void check()} disabled={!rows.trim() || busy !== null}>
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
            {fileName && <span className="text-sm text-muted">{fileName}</span>}
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
      )}
    </>
  );
}
