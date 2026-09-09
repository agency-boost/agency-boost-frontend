'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Button, Card, ErrorBanner, Field } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  importRoster,
  previewRoster,
  rosterTemplate,
  type ImportedPerson,
  type RosterPreview,
} from '@/lib/admin';

/**
 * Filling a new office from a spreadsheet (P3.6-T4).
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
export default function RosterImportPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [created, setCreated] = useState<ImportedPerson[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [header, setHeader] = useState<string | null>(null);

  // The header comes from the API rather than being written here twice. A template the
  // screen composed itself would drift from the one the parser demands, and the failure
  // would read as "download the template" on a file downloaded from this very screen.
  useEffect(() => {
    let live = true;
    rosterTemplate()
      .then((t) => { if (live) setHeader(t.header); })
      .catch(() => { if (live) setHeader(null); });
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
    reader.onload = () => setCsv(String(reader.result ?? ''));
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
      setPreview(await previewRoster(kpmId, csv));
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
      const result = await importRoster(kpmId, csv);
      setCreated(result.created);
      setPreview(null);
      setCsv('');
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

  const templateHref = header
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(`${header}\n`)}`
    : null;

  return (
    <Page
      title="Import a roster"
      subtitle="Create everybody in this office from a spreadsheet."
      permission="kpm:import_roster"
    >
      {error && <ErrorBanner {...error} />}

      {created ? (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">
            {`${created.length} ${created.length === 1 ? 'person' : 'people'} created`}
          </h2>
          <p className="mt-1 text-md text-muted">
            Send each person their password. <strong>This is the only time it is shown</strong> —
            it is not stored anywhere and cannot be looked up. If you lose one, that person can
            use <em>Forgot your password</em> on the sign-in page instead.
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

          <Link
            href={`/admin/tenants/${kpmId}`}
            className="mt-4 inline-block text-md font-semibold text-navy underline"
          >
            Back to the office
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

          {templateHref ? (
            <a
              href={templateHref}
              download="roster-template.csv"
              className="mt-3 inline-block text-md font-semibold text-navy underline"
            >
              Download the template
            </a>
          ) : (
            <p className="mt-3 text-sm text-muted">Loading the template…</p>
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void check()} disabled={!csv || busy !== null}>
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
    </Page>
  );
}
