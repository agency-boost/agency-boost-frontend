'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { DataTable, Cell, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { Pager } from '@/components/ui/pager';
import { ChoicePill, type ChoiceOption } from '@/components/ui/rows-and-sheets';
import { CardField, CardFields, RowCard, RowCards } from '@/components/ui/row-cards';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { listCompanies, listTenants, insurersOf, type Company, type TenantListRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatShortDay } from '@/lib/format';
import {
  readMembers, type MemberRoleFilter, type MemberStatus, type MembersFilters, type PlatformMemberRow, type PlatformMembersPage,
} from '@/lib/platform-reads';
import { useMediaQuery } from '@/lib/use-media-query';

const ROLES: readonly MemberRoleFilter[] = ['ab', 'aab', 'agent'];
const STATUSES: readonly MemberStatus[] = ['active', 'pending', 'removed'];
const STATUS_TONE: Record<MemberStatus, PillTone> = { active: 'success', pending: 'watch', removed: 'neutral' };

/**
 * ***All members*** (P19.4-T3 AC-1, AC-2; SA UI-010, SA R1; ADR-0207 §2): one row per membership, filtered, searched and
 * paged **on the server** — by company, KPM, role and status, and by a name, a phone number or an email, neither of
 * which comes back. **View-only** (OD-260 OQ2): a row links to its KPM's page, never to an edit of the person. Rows are
 * cards on a phone.
 *
 * `kpmId` set, it is the KPM page's *Anggota* tab: that KPM's members, the company and KPM filters gone. `initial`
 * carries the address's filters (`/admin/members?role=AB` from *ABS* on the overview).
 *
 * **Below 1024px** (P19.2-T2 AC-1, AC-4; UI-126, UI-134): the cards a phone had, on a tablet too, so no table scrolls
 * sideways; and no native select — the four filters are pills under the search, each saying its filter's name until it
 * narrows the list, then its choice in navy. A laptop keeps its table and its selects.
 */
export function PlatformMembers({ kpmId, initial = {} }: { kpmId?: string; initial?: MembersFilters }) {
  const t = useMessages(adminPlatformReadsMessages).members;
  const figures = useFigureLanguage();
  const phone = useMediaQuery(['phone', 'tablet'], { beforePaint: true });
  const searchId = useId();
  const [filters, setFilters] = useState<MembersFilters>({ ...initial, ...(kpmId ? { kpmId } : {}) });
  const [typed, setTyped] = useState(initial.q ?? '');
  const [page, setPage] = useState<PlatformMembersPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [offices, setOffices] = useState<TenantListRow[]>([]);

  // The choices for the two filters a KPM's own tab has no use for.
  useEffect(() => {
    if (kpmId) return;
    void listCompanies().then((rows) => setCompanies(insurersOf(rows))).catch(() => setCompanies([]));
    void listTenants().then(setOffices).catch(() => setOffices([]));
  }, [kpmId]);

  useEffect(() => {
    let live = true;
    setError(null);
    readMembers(filters)
      .then((next) => { if (live) setPage(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [filters, attempt]);

  const set = (next: Partial<MembersFilters>) => setFilters((now) => ({ ...now, ...next, page: next.page ?? 1 }));
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const q = typed.trim();
    // The shortest search is the server's to say (`PLATFORM_READ.SEARCH_MIN_LENGTH`): a shorter one is refused with its
    // sentence, shown above the list, and no limit is re-declared here (invariant §7).
    set({ q: q || undefined });
  };
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  const filtered = Boolean(filters.q || filters.role || filters.status || (!kpmId && (filters.companyId || filters.kpmId)));
  const day = (value: string | null) => (value ? formatShortDay(value, { year: true }, figures) : t.never);
  /** A filter's choices: *Semua* first, as the select's empty option was. */
  const any = <K extends string>(rest: ChoiceOption<K>[]): ChoiceOption<K | ''>[] => [{ key: '', label: t.any }, ...rest];

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={search}
        role="search"
        className={phone ? 'flex flex-col gap-3' : 'grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] md:items-end'}
      >
        <Field label={t.search} htmlFor={searchId} hint={t.searchHint}>
          <TextInput id={searchId} type="search" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </Field>
        {phone && (
          <div className="flex flex-wrap gap-1.5">
            {!kpmId && (
              <ChoicePill
                name={t.company}
                options={any(companies.map((c) => ({ key: c._id, label: c.name })))}
                value={filters.companyId ?? ''}
                onChange={(key) => set({ companyId: key || undefined, kpmId: undefined })}
                narrows={Boolean(filters.companyId)}
              />
            )}
            {!kpmId && (
              <ChoicePill
                name={t.kpm}
                options={any(offices.filter((o) => !filters.companyId || o.companyId === filters.companyId)
                  .map((o) => ({ key: o._id, label: `${o.code} · ${o.branchName}` })))}
                value={filters.kpmId ?? ''}
                onChange={(key) => set({ kpmId: key || undefined })}
                narrows={Boolean(filters.kpmId)}
              />
            )}
            <ChoicePill
              name={t.role}
              options={any(ROLES.map((role) => ({ key: role, label: t.roles[role] })))}
              value={filters.role ?? ''}
              onChange={(key) => set({ role: key || undefined })}
              narrows={Boolean(filters.role)}
            />
            <ChoicePill
              name={t.status}
              options={any(STATUSES.map((status) => ({ key: status, label: t.statuses[status] })))}
              value={filters.status ?? ''}
              onChange={(key) => set({ status: key || undefined })}
              narrows={Boolean(filters.status)}
            />
          </div>
        )}
        {!phone && !kpmId && (
          <Field label={t.company} htmlFor={`${searchId}-company`}>
            <Select
              id={`${searchId}-company`}
              value={filters.companyId ?? ''}
              onChange={(e) => set({ companyId: e.target.value || undefined, kpmId: undefined })}
            >
              <option value="">{t.any}</option>
              {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {!phone && !kpmId && (
          <Field label={t.kpm} htmlFor={`${searchId}-kpm`}>
            <Select id={`${searchId}-kpm`} value={filters.kpmId ?? ''} onChange={(e) => set({ kpmId: e.target.value || undefined })}>
              <option value="">{t.any}</option>
              {offices.filter((o) => !filters.companyId || o.companyId === filters.companyId).map((o) => (
                <option key={o._id} value={o._id}>{`${o.code} · ${o.branchName}`}</option>
              ))}
            </Select>
          </Field>
        )}
        {!phone && (
          <>
            <Field label={t.role} htmlFor={`${searchId}-role`}>
              <Select
                id={`${searchId}-role`}
                value={filters.role ?? ''}
                onChange={(e) => set({ role: (e.target.value || undefined) as MemberRoleFilter | undefined })}
              >
                <option value="">{t.any}</option>
                {ROLES.map((role) => <option key={role} value={role}>{t.roles[role]}</option>)}
              </Select>
            </Field>
            <Field label={t.status} htmlFor={`${searchId}-status`}>
              <Select
                id={`${searchId}-status`}
                value={filters.status ?? ''}
                onChange={(e) => set({ status: (e.target.value || undefined) as MemberStatus | undefined })}
              >
                <option value="">{t.any}</option>
                {STATUSES.map((status) => <option key={status} value={status}>{t.statuses[status]}</option>)}
              </Select>
            </Field>
          </>
        )}
      </form>

      {error && (
        <div className="flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}

      {!error && page === null && (
        <SkeletonTable caption={t.loading} columns={[t.columns.name, t.columns.kpm, t.columns.role, t.columns.status]} rows={5} />
      )}

      {page && page.total === 0 && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState
            title={filtered ? t.noMatch : t.empty}
            action={!kpmId && filters.q ? <FindInAccounts q={filters.q} /> : undefined}
          />
        </div>
      )}

      {page && page.rows.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">{t.total({ n: page.total })}</p>
          {phone ? (
            <RowCards label={t.caption}>
              {page.rows.map((row) => (
                <RowCard key={row.membershipId}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-navy">{row.fullName}</span>
                    <StatusPill status={STATUS_TONE[row.status]} label={t.statuses[row.status]} />
                  </div>
                  <CardFields>
                    <CardField label={t.columns.kpm}><KpmLink row={row} /></CardField>
                    <CardField label={t.columns.role}><RoleCell row={row} /></CardField>
                    <CardField label={t.columns.leader}>{row.leader?.fullName ?? '—'}</CardField>
                    <CardField label={t.columns.lastActive}>{day(row.lastActiveOn)}</CardField>
                  </CardFields>
                </RowCard>
              ))}
            </RowCards>
          ) : kpmId ? (
            /*
             * **A KPM's *Anggota*** (P19.4-T3 AC-9; A2): *Kode agen, Nama, Peran, Upline, Bergabung* and *Status* — *Aktif*
             * (signed in), *Diundang* or *Belum diundang* (ADR-0212 §2), a membership that ended *Keluar* — read-only.
             */
            <DataTable
              caption={t.caption}
              columns={[t.agentCode, t.columns.name, t.columns.role, t.columns.leader, t.joined, t.columns.status]}
            >
              {page.rows.map((row) => (
                <Row key={row.membershipId}>
                  <Cell className="tabular-nums">{row.agentCode}</Cell>
                  <Cell className="font-semibold text-navy">{row.fullName}</Cell>
                  <Cell><RoleCell row={row} /></Cell>
                  <Cell>{row.leader?.fullName ?? '—'}</Cell>
                  <Cell className="whitespace-nowrap">{row.joinedOn ? formatShortDay(row.joinedOn, { year: true }, figures) : '—'}</Cell>
                  <Cell><MemberState row={row} /></Cell>
                </Row>
              ))}
            </DataTable>
          ) : (
            <DataTable
              caption={t.caption}
              columns={[
                t.columns.name, t.columns.company, t.columns.kpm, t.columns.role, t.columns.leader,
                t.columns.status, t.columns.lastActive,
              ]}
            >
              {page.rows.map((row) => (
                <Row key={row.membershipId}>
                  <Cell className="font-semibold text-navy">
                    {row.fullName}
                    <span className="block text-sm font-normal text-muted">{row.agentCode}</span>
                  </Cell>
                  <Cell>{row.company.name}</Cell>
                  <Cell><KpmLink row={row} /></Cell>
                  <Cell><RoleCell row={row} /></Cell>
                  <Cell>{row.leader?.fullName ?? '—'}</Cell>
                  <Cell><StatusPill status={STATUS_TONE[row.status]} label={t.statuses[row.status]} /></Cell>
                  <Cell className="whitespace-nowrap">{day(row.lastActiveOn)}</Cell>
                </Row>
              ))}
            </DataTable>
          )}
          <Pager page={page.page} pages={pages} label={t.caption} onPage={(next) => set({ page: next })} />
        </>
      )}
    </div>
  );
}

/**
 * ***Cari di Akun terdaftar*** (P19.12-T2 AC-2; ADR-0245 §1): a search that finds no membership may name somebody who
 * registered and joined no KPM, whom only the *Akun terdaftar* tab lists — the same search, carried there. 44px below
 * 1024px (P19.2-T2 AC-5).
 */
function FindInAccounts({ q }: { q: string }) {
  const t = useMessages(adminPlatformReadsMessages).members;
  return (
    <Link
      href={`/admin/members?tab=accounts&q=${encodeURIComponent(q)}`}
      className="text-navy underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center"
    >
      {t.findInAccounts}
    </Link>
  );
}

/** The KPM, code and branch, linking to its page: the row's one way on (OD-260 OQ2). */
function KpmLink({ row }: { row: PlatformMemberRow }) {
  const t = useMessages(adminPlatformReadsMessages).members;
  return (
    // 44px below 1024px, where it is a card's (P19.2-T2 AC-5; UI-135).
    <Link
      href={`/admin/tenants/${row.kpm.id}`}
      className="text-navy underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center"
      aria-label={t.openKpm({ code: row.kpm.code })}
    >
      {`${row.kpm.code} · ${row.kpm.branch}`}
    </Link>
  );
}

/** The rung, with the *Owner* and *Admin* badges — each a word, never a colour alone. */
function RoleCell({ row }: { row: PlatformMemberRow }) {
  const t = useMessages(adminPlatformReadsMessages).members;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {row.role.label}
      {row.role.isOwner && <StatusPill status="neutral" label={t.owner} />}
      {row.role.isAdmin && <StatusPill status="neutral" label={t.admin} />}
    </span>
  );
}

/** *Aktif · Diundang · Belum diundang* (ADR-0212 §2) for a live membership; *Keluar* for one that ended. */
function MemberState({ row }: { row: PlatformMemberRow }) {
  const all = useMessages(adminPlatformReadsMessages);
  if (row.status === 'removed') return <StatusPill status="neutral" label={all.members.statuses.removed} />;
  const state = row.invitation === 'signed_in' ? 'active' : row.invitation;
  return <StatusPill status={state === 'active' ? 'success' : 'neutral'} label={all.kpm.adminState[state]} />;
}
