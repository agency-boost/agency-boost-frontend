'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SubscriptionDialog } from '@/components/subscription-dialog';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, ErrorBanner } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { RowMenu } from '@/components/ui/rows-and-sheets';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import {
  leadersOver, leadersSaid, leadersWord, listTenants, tenantStatusTone, tenantStatusWord, type OwnerState,
  type TenantListRow,
} from '@/lib/admin';
import type { Language } from '@/i18n/language';
import type { MessagesOf } from '@/i18n/catalogue';
import { toDisplayError } from '@/lib/api-client';
import { formatMonth, formatNumber, formatShortDay } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */
/*
 * *End date* and *Leaders*, and a last column of one action, are the client's (ADR-0112 §2, P13.2-T3
 * AC-7): the subscription is entered *"directly from here"*. The action column has a name nobody sees,
 * so a screen reader moving by column is told what is in it.
 */
function useColumns(): readonly Column[] {
  const c = useMessages(adminOfficesMessages).list.columns;
  const p = useMessages(adminPlatformReadsMessages).list.columns;
  // P19.4-T3 AC-8 (the setup spec's A2): *KPM · Pemilik · Anggota · Data terakhir · Perlu tindakan*; the client's earlier
  // columns kept beside them — the company, the status, *End date*, *Leaders* and *Edit subscription* (P13.2-T3 AC-7).
  return [
    p.kpm, c.company, p.owner, p.members, p.lastData, p.action, c.status, c.endDate, c.leaders,
    { label: c.subscription, visuallyHidden: true },
  ];
}

/**
 * **All KPMs** (P3.1-T14; P13.2-T3 AC-7; P19.4-T3 AC-8; P19.2-T2 AC-1, AC-5 — UI-126, UI-135).
 *
 * - **Below 1024px no table** (UI-126: *no sideways scroll inside any /admin table or list*): one row per KPM, in the
 *   companies list's idiom — *code · branch* opening the KPM, *company · n members · latest data* under it, then its
 *   Owner and what needs doing; its state on the right, and ⋯ holding *Ubah langganan* (and *Tetapkan pemilik* where
 *   there is none), so nothing a finger aims at is under 44px (UI-135). Past the limit, its leaders and *n over* (ADR-0157
 *   §4). **From 1024px the table** as before.
 * - The subscription dialog is the same from either.
 */
export default function TenantsPage() {
  const t = useMessages(adminOfficesMessages);
  const p = useMessages(adminPlatformReadsMessages).list;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const COLUMNS = useColumns();
  const rows = useMediaQuery(['phone', 'tablet']);
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantListRow[] | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  /** The office whose subscription is open in the dialog. */
  const [editing, setEditing] = useState<TenantListRow | null>(null);
  /** What the dialog said it saved, for the row's own live region. */
  const [saved, setSaved] = useState<string>('');

  // One request. The company name used to be joined here from a second call, which meant
  // a KPM whose company was missing from that list rendered a raw ObjectId in the column
  // — and cost a round trip to do it. The payload carries the name now.
  useEffect(() => {
    void listTenants()
      .then(setTenants)
      .catch((err) => {
        setError(toDisplayError(err));
        setTenants([]);
      });
  }, []);

  return (
    <Page
      title={t.list.title}
      actions={
        <ButtonLink href="/admin/tenants/new">{t.list.newOffice}</ButtonLink>
      }
    >
      {error && <ErrorBanner {...error} />}

      {tenants === null && (
        <SkeletonTable caption={t.list.caption} columns={COLUMNS} rows={5} />
      )}

      {tenants?.length === 0 && !error && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState
            title={t.list.empty}
            action={
              <Link href="/admin/tenants/new" className="text-md text-navy underline">
                {t.list.createFirst}
              </Link>
            }
          />
        </div>
      )}

      {tenants && tenants.length > 0 && rows && (
        <ListCard label={t.list.caption}>
          {tenants.map((row) => {
            const owner = row.ownerName ?? row.pendingOwner?.fullName ?? null;
            const needs = needsAction(row, p, figures);
            const over = leadersOver(row);
            return (
              <ListRow
                key={row._id}
                data-row={row._id}
                href={`/admin/tenants/${row._id}`}
                title={`${row.code} · ${row.branchName}`}
                meta={t.list.rowMeta({
                  company: row.companyName,
                  n: row.memberCount,
                  members: formatNumber(row.memberCount, {}, figures),
                  data: row.dataStatus?.latestMonth ? formatMonth(row.dataStatus.latestMonth, figures) : null,
                })}
                note={(owner || needs.length > 0 || over > 0) && (
                  <span className="flex flex-col gap-1">
                    {owner && (
                      <span className="flex flex-wrap items-center gap-1.5 text-navy">
                        {t.list.ownerIs({ name: owner })}
                        <StatusPill status={OWNER_TONE[row.ownerState]} label={p.ownerState[row.ownerState]} />
                      </span>
                    )}
                    {over > 0 && (
                      <span className="flex flex-wrap items-center gap-1.5 text-navy">
                        <span aria-hidden="true">{t.list.leadersAre({ count: leadersWord(row) })}</span>
                        <StatusPill status="watch" label={t.list.over({ n: over })} />
                        <span className="sr-only">{leadersSaid(row, language)}</span>
                      </span>
                    )}
                    {needs.length > 0 && (
                      <span className="flex flex-col text-alert">
                        {needs.map((line) => <span key={line}>{line}</span>)}
                      </span>
                    )}
                  </span>
                )}
                trailing={(
                  <>
                    <StatusPill status={tenantStatusTone(row)} label={tenantStatusWord(row, language)} />
                    <RowMenu
                      name={`${row.code} · ${row.branchName}`}
                      items={[
                        { label: t.list.editSubscription, onSelect: () => setEditing(row) },
                        ...(!owner ? [{ label: t.list.assignOwner, onSelect: () => router.push(`/admin/tenants/${row._id}/owner`) }] : []),
                      ]}
                    />
                  </>
                )}
              />
            );
          })}
        </ListCard>
      )}

      {tenants && tenants.length > 0 && !rows && (
        <DataTable
          caption={t.list.caption}
          columns={COLUMNS}
        >
          {tenants.map((row) => (
            <Row key={row._id}>
              <Cell className="font-semibold">
                <Link href={`/admin/tenants/${row._id}`} className="underline">
                  {row.code}
                </Link>
                <span className="block text-sm font-normal text-muted">{row.branchName}</span>
              </Cell>
              <Cell>{row.companyName}</Cell>
              <Cell>
                {row.ownerName || row.pendingOwner ? (
                  <span className="flex flex-col items-start gap-1">
                    <span className="text-navy">{row.ownerName ?? row.pendingOwner?.fullName}</span>
                    {row.ownerEmail && <span className="text-sm text-muted">{row.ownerEmail}</span>}
                    <StatusPill status={OWNER_TONE[row.ownerState]} label={p.ownerState[row.ownerState]} />
                  </span>
                ) : (
                  <Link href={`/admin/tenants/${row._id}/owner`} className="text-alert underline">
                    {t.list.assignOwner}
                  </Link>
                )}
              </Cell>
              <Cell className="tabular-nums">{formatNumber(row.memberCount, {}, figures)}</Cell>
              <Cell className="whitespace-nowrap">
                {row.dataStatus?.latestMonth ? formatMonth(row.dataStatus.latestMonth, figures) : p.noData}
              </Cell>
              <Cell>
                {needsAction(row, p, figures).length === 0
                  ? <span className="text-muted">{p.nothing}</span>
                  : (
                    <ul className="flex flex-col gap-0.5 text-sm text-alert">
                      {needsAction(row, p, figures).map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  )}
              </Cell>
              <Cell>
                <StatusPill status={tenantStatusTone(row)} label={tenantStatusWord(row, language)} />
              </Cell>
              <Cell className="whitespace-nowrap">
                {row.subscription?.endDate ? formatShortDay(row.subscription.endDate, { year: true }, figures) : '—'}
              </Cell>
              <Cell className="whitespace-nowrap">
                {/* ADR-0157 §4: past the limit — AgencyBoost approved leaders beyond it — the count reads above
                    it, and *3 over* says by how much in the warning paint. Said once, whole, to a screen reader. */}
                <span aria-hidden="true">
                  {leadersWord(row)}
                  {leadersOver(row) > 0 && (
                    <StatusPill status="watch" label={t.list.over({ n: leadersOver(row) })} className="ml-2" />
                  )}
                </span>
                <span className="sr-only">{leadersSaid(row, language)}</span>
              </Cell>
              <Cell>
                <Button
                  variant="secondary"
                  className="whitespace-nowrap"
                  aria-label={t.list.editSubscriptionFor({ code: row.code, branch: row.branchName })}
                  onClick={() => setEditing(row)}
                >
                  {t.list.editSubscription}
                </Button>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <p role="status" className="sr-only">{saved}</p>

      {editing && (
        <SubscriptionDialog
          row={editing}
          open
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            // The answer is the row as this list reads it, so it is drawn from that, not re-read.
            setTenants((rows) => rows?.map((r) => (r._id === saved._id ? { ...r, ...saved } : r)) ?? rows);
            setSaved(t.list.savedFor({ code: saved.code }));
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}

/** The list's words in the reader's language. */
type ListWords = MessagesOf<typeof adminPlatformReadsMessages.en>['list'];

/** The Owner's chip (ADR-0212 §2): *Aktif* green, the rest plain — each a word, never a colour alone. */
const OWNER_TONE: Record<OwnerState, 'success' | 'neutral' | 'alert'> = {
  active: 'success', invited: 'neutral', not_invited: 'neutral', none: 'alert',
};

/**
 * ***Perlu tindakan*** (P19.4-T3 AC-8; SA R5; A2): *"Pemilik belum menerima undangan"* — an Owner named who has not signed
 * in — or *"Belum ada pemilik"*; *"Belum ada anggota"* — nobody but the Owner; *"Data <bulan> belum diunggah"* — the last
 * ended month missing from the KPM's file. An archived KPM needs nothing.
 */
function needsAction(row: TenantListRow, p: ListWords, figures: Language): string[] {
  if (row.status === 'archived') return [];
  const lines: string[] = [];
  if (row.ownerState === 'none') lines.push(p.actions.noOwner);
  else if (row.ownerState !== 'active') lines.push(p.actions.ownerNotInvited);
  if (row.membersBesidesOwner === 0) lines.push(p.actions.noMembers);
  if (row.dataStatus?.missingMonth) lines.push(p.actions.dataMissing({ month: formatMonth(row.dataStatus.missingMonth, figures) }));
  return lines;
}
