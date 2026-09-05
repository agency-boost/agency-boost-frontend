'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select } from '@/components/ui/field';
import { listTenants, readAudit, type AuditEntry, type Kpm } from '@/lib/admin';
import { ApiRequestError } from '@/lib/api-client';

/** The append-only record. Read-only by construction — there is no edit or delete. */
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
        setError(err instanceof ApiRequestError ? err.error : null);
        setEntries([]);
      });
  }, [scope]);

  return (
    <AdminShell
      title="Audit log"
      subtitle="Append-only. Provisioning, ownership changes and impersonation are recorded without exception."
      actions={
        <Field label="Scope" htmlFor="scope" className="w-64">
          <Select id="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Platform level (no tenant)</option>
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
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
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
        <DataTable caption="Audit entries, newest first" columns={['When', 'Action', 'Target', 'Actor']}>
          {entries.map((e) => (
            <Row key={e._id}>
              <Cell className="whitespace-nowrap text-muted">
                <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString('en-GB')}</time>
              </Cell>
              <Cell className="font-semibold">{e.action}</Cell>
              <Cell>
                {e.targetCollection}
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
    </AdminShell>
  );
}
