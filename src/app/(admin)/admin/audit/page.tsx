'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { listTenants, readAudit, type AuditEntry, type Kpm } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */
const COLUMNS = ['When', 'Action', 'Target', 'Actor'] as const;

/** The append-only record. Read-only by construction — there is no edit or delete. */
/**
 * Rows written before the Company template rename (ADR-0023), shown under the new name.
 *
 * **Renamed here and not in the database.** `auditLog` is append-only evidence — the
 * schema's own first line calls it that, and PDP (UU 27/2022) is the reason. A record
 * whose contents are rewritten later so a rename looks tidy has stopped being a record.
 * So the rows keep the words they were written with, and one list reads consistently.
 */
const RENAMED = new Map([
  ['platform_template.draft_saved', 'company_template.draft_saved'],
  ['platform_template.published', 'company_template.published'],
  ['platformTemplates', 'companyTemplates'],
]);

const renamed = (value: string) => RENAMED.get(value) ?? value;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [tenants, setTenants] = useState<Kpm[]>([]);
  const [scope, setScope] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);

  useEffect(() => {
    void listTenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    setEntries(null);
    void readAudit(scope || undefined)
      .then(setEntries)
      .catch((err) => {
        setError(toDisplayError(err));
        setEntries([]);
      });
  }, [scope]);

  return (
    <Page
      title="Audit log"
      subtitle="Append-only. Provisioning, ownership changes and impersonation are recorded without exception."
      actions={
        <Field label="Scope" htmlFor="scope" className="w-64">
          <Select id="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Platform level (no KPM)</option>
            {tenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.code} · {t.branchName}
              </option>
            ))}
          </Select>
        </Field>
      }
    >
      {error && <ErrorBanner {...error} />}

      {entries === null && (
        <SkeletonTable caption="Audit entries, newest first" columns={COLUMNS} rows={8} />
      )}

      {entries?.length === 0 && !error && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState
            title={
              scope
                ? 'Nothing recorded for this office yet.'
                : 'Nothing recorded at platform level yet — create an office and it will appear here.'
            }
            variant={scope ? 'filtered' : 'empty'}
            action={scope ? <Button variant="secondary" onClick={() => setScope('')}>Show platform level</Button> : undefined}
          />
        </div>
      )}

      {entries && entries.length > 0 && (
        <DataTable caption="Audit entries, newest first" columns={COLUMNS}>
          {entries.map((e) => (
            <Row key={e._id}>
              <Cell className="whitespace-nowrap text-muted">
                <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString('en-GB')}</time>
              </Cell>
              <Cell className="font-semibold">{renamed(e.action)}</Cell>
              <Cell>
                {renamed(e.targetCollection)}
                {e.targetId ? <code className="ml-1 text-sm text-muted">{e.targetId}</code> : null}
              </Cell>
              <Cell>
                <code className="text-sm">{e.actorUserId}</code>
                {e.effectiveUserId && (
                  // Under impersonation both are recorded. Showing only one would
                  // attribute the action to the wrong person.
                  <span className="ml-1 text-sm text-alert">as {e.effectiveUserId}</span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </Page>
  );
}
