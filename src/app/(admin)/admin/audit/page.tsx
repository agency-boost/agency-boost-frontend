'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { listTenants, readAudit, type AuditEntry, type Kpm } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminAuditMessages } from '@/i18n/messages/admin-audit';
import { formatDateTime, OFFICE_TIME_ZONE } from '@/lib/format';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */

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
  const t = useMessages(adminAuditMessages);
  const figures = useFigureLanguage();
  const COLUMNS = [t.columns.when, t.columns.action, t.columns.target, t.columns.actor];
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
    // The nav item's words (P18.95-T9 AC-2; UI-027): *Audit / role change log* (`Superadmin.html:197`).
    <Page
      title={t.title}
      subtitle={t.subtitle}
      actions={
        <Field label={t.scope} htmlFor="scope" className="w-64">
          <Select id="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">{t.platformLevel}</option>
            {tenants.map((tenant) => (
              <option key={tenant._id} value={tenant._id}>
                {tenant.code} · {tenant.branchName}
              </option>
            ))}
          </Select>
        </Field>
      }
    >
      {error && <ErrorBanner {...error} />}

      {entries === null && (
        <SkeletonTable caption={t.caption} columns={COLUMNS} rows={8} />
      )}

      {entries?.length === 0 && !error && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState
            title={
              scope ? t.emptyOffice : t.emptyPlatform
            }
            variant={scope ? 'filtered' : 'empty'}
            action={scope ? <Button variant="secondary" onClick={() => setScope('')}>{t.showPlatform}</Button> : undefined}
          />
        </div>
      )}

      {entries && entries.length > 0 && (
        <DataTable caption={t.caption} columns={COLUMNS}>
          {entries.map((e) => (
            <Row key={e._id}>
              <Cell className="whitespace-nowrap text-muted">
                <time dateTime={e.createdAt}>{formatDateTime(e.createdAt, OFFICE_TIME_ZONE, figures)}</time>
              </Cell>
              <Cell className="font-semibold">{renamed(e.action)}</Cell>
              <Cell>
                {/*
                  * **The name first, the id only when there is no name.** Every row used to
                  * read `memberships 68f3c1a9…`, so answering *"who suspended Surabaya?"*
                  * meant three lookups in a database shell — which is the question this
                  * screen exists to answer.
                  *
                  * An unresolved id is still shown rather than blanked: a collection nothing
                  * names yet is *this is all we know*, not *nothing happened*.
                  */}
                <span className="text-muted">{renamed(e.targetCollection)}</span>
                {e.targetLabel
                  ? <span className="ml-1 font-semibold text-navy">{e.targetLabel}</span>
                  : e.targetId
                    ? <code className="ml-1 text-sm text-muted">{e.targetId}</code>
                    : null}
              </Cell>
              <Cell>
                {e.actorName
                  ? <span className="font-semibold text-navy">{e.actorName}</span>
                  : <code className="text-sm">{e.actorUserId ?? '—'}</code>}
                {e.effectiveUserId && (
                  // Under impersonation both are recorded. Showing only one would
                  // attribute the action to the wrong person.
                  <span className="ml-1 text-sm text-alert">
                    {t.actingAs({ name: e.effectiveName ?? e.effectiveUserId })}
                  </span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </Page>
  );
}
