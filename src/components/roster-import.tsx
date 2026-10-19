'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Button, Card, ErrorBanner, Field, Textarea } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
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

  // The whole file comes from the API rather than being composed here. A template the
  // screen built itself would drift from the one the parser demands, and the failure
  // would read as "download the template" on a file downloaded from this very screen —
  // and the worked examples in it are the part most worth not paraphrasing.
  useEffect(() => {
    let live = true;
    rosterTemplate()
      .then((t) => { if (live) setTemplate({ file: t.template, examples: t.examples }); })
      .catch(() => { if (live) setTemplate(null); });
    return () => { live = false; };
  }, []);

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
      message: `Could not read ${file.name}. Try saving it again as CSV.`,
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
          <h2 className="font-display text-lg font-bold text-navy">
            {`${created.length} ${created.length === 1 ? 'person' : 'people'} created`}
          </h2>
          <p className="mt-1 text-md text-muted">
            Send each person their password — <strong>AgencyBoost does not email it for you</strong>.
            This is the only time it is shown: it is not stored anywhere and cannot be looked up.
            If you lose one, that person can use <em>Forgot your password</em> on the sign-in
            page instead.
          </p>
          <p className="mt-2 text-md text-muted">
            Everybody here is asked to choose their own password the first time they sign in, and
            can do nothing else until they have.
          </p>

          <DataTable
            className="mt-4"
            caption="The people created, and the password each one starts on"
            columns={['Name', 'Email', 'Agent code', 'Temporary password']}
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
            Back
          </Link>
        </Card>
      ) : (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">The file</h2>
          <p className="mt-1 text-md text-muted">
            One row per person: name, email, the agent code their insurer issued, their rung
            (<code>ab</code>, <code>aab</code> or <code>agent</code>), and the agent code of
            whoever they report to. Leave the last one empty for somebody who reports to nobody.
          </p>
          <p className="mt-2 text-md text-muted">
            A leader may be in the file or already in the office; order does not matter, because
            the import creates leaders first either way.
          </p>
          <p className="mt-2 text-md text-muted">
            You can paste the rows straight out of a spreadsheet, or download a template, fill it
            in and upload it. Pasting works from Excel, Google Sheets, LibreOffice and Numbers —
            select the rows, copy, and paste. The downloaded template carries three worked
            examples, <strong>commented out</strong> with a <code>#</code> so they are never
            imported.
          </p>

          {/* Two ways in, and the one that needs no file goes first. Copying cells out of
              a spreadsheet puts tab-separated text on the clipboard, so somebody can do
              this without meeting a file format at all. */}
          <fieldset className="mt-4">
            <legend className="text-md font-semibold text-navy">How are you adding them?</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {([
                ['paste', 'Paste from a spreadsheet'],
                ['file', 'Upload a CSV file'],
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
            <Field
              label="Rows from your spreadsheet"
              htmlFor="rows"
              hint="Select the rows in Excel, Google Sheets or Numbers, copy them, and paste here. The header row is optional."
              className="mt-4"
            >
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
              {templateHref ? (
                <a
                  href={templateHref}
                  download="roster-template.csv"
                  className="mt-4 inline-block text-md font-semibold text-navy underline"
                >
                  Download the template
                </a>
              ) : (
                <p className="mt-4 text-sm text-muted">Loading the template…</p>
              )}

              <Field label="Roster file" htmlFor="roster" className="mt-4">
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
              {busy === 'preview' ? 'Checking…' : 'Check the file'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void commit()}
              // Only after a clean preview. The server checks again regardless — this is
              // so the operator is never a single click from a refusal they could have
              // seen coming.
              disabled={busy !== null || !preview || preview.issues.length > 0}
            >
              {busy === 'commit' ? 'Importing…' : `Import ${preview?.willCreate ?? 0}`}
            </Button>
            {fileName && <span className="text-sm text-muted">{fileName}</span>}
          </div>

          {preview && preview.issues.length === 0 && (
            <p role="status" className="mt-4 text-md font-semibold text-success">
              {`${preview.willCreate} ${preview.willCreate === 1 ? 'person' : 'people'} ready `
                + 'to import. Nothing has been created yet.'}
            </p>
          )}

          {preview && preview.issues.length > 0 && (
            <div className="mt-4">
              <h3 className="font-display text-md font-bold text-navy">
                {`${preview.issues.length} `
                  + `${preview.issues.length === 1 ? 'problem' : 'problems'} `
                  + '— nothing will be created'}
              </h3>
              <p className="mt-1 text-sm text-muted">
                The import is all or nothing, so every one of these has to be fixed before any of
                the file lands. Line numbers count the header, the way a spreadsheet does.
              </p>
              <DataTable
                className="mt-3"
                caption="What is wrong with the file"
                columns={['Line', 'Column', 'Problem']}
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
