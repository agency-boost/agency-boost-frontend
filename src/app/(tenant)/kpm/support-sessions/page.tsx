'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readImpersonationLog, type ImpersonationLogEntry } from '@/lib/admin';
import { useSession } from '@/lib/session';

const COLUMNS = ['When', 'Who was helped', 'Operator', 'What they could do', 'Why'] as const;

function when(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Support sessions run inside this office (P4-T10, §3.13).
 *
 * **An Owner reads their own tenant's.** Support that an office cannot see is support an
 * office cannot question — and the people whose screens a session touched are exactly the
 * ones with a reason to look.
 *
 * It shows the reason twice where a session was elevated: once for why somebody needed to
 * look, and once for why looking was not enough. They are different questions, answered by
 * different people.
 */
export default function SupportSessionsPage() {
  const { me } = useSession();
  const kpmId = me?.membership?.kpmId ?? null;
  const [rows, setRows] = useState<ImpersonationLogEntry[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!kpmId) return;
    readImpersonationLog(kpmId).then(setRows).catch((err) => setError(toDisplayError(err)));
  }, [kpmId]);

  return (
    <Page
      title="Support sessions"
      subtitle="When somebody from AgencyBoost acted as a member of this office."
      permission="impersonation:read_session_log"
    >
      {error && <ErrorBanner {...error} />}

      {rows === null ? (
        <SkeletonTable caption="Support sessions" columns={COLUMNS} rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nobody has acted as a member of this office" />
      ) : (
        <DataTable
          caption="Support sessions run in this office, newest first"
          columns={COLUMNS}
        >
          {rows.map((row) => (
            <Row key={row.sessionId}>
              <Cell>
                {when(row.startedAt)}
                <span className="block text-sm text-muted">
                  {row.endedAt ? `ended ${when(row.endedAt)}` : 'still running'}
                </span>
              </Cell>
              <Cell className="font-semibold">{row.subjectName}</Cell>
              <Cell>{row.operatorName}</Cell>
              <Cell>
                {row.readOnly ? (
                  <StatusPill status="neutral" label="Look only" />
                ) : (
                  <>
                    <StatusPill status="alert" label="Could make changes" />
                    {row.elevatedByName && (
                      <span className="block text-sm text-muted">
                        approved by {row.elevatedByName}
                      </span>
                    )}
                  </>
                )}
              </Cell>
              <Cell>
                {row.reason}
                {row.elevationReason && (
                  <span className="block text-sm text-muted">
                    To make changes: {row.elevationReason}
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
