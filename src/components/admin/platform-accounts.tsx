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
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatShortDay } from '@/lib/format';
import {
  readAccounts, type AccountKpmFilter, type AccountsFilters, type PlatformAccountRow, type PlatformAccountsPage,
} from '@/lib/platform-reads';
import { useMediaQuery } from '@/lib/use-media-query';

const KPM_FILTERS: readonly AccountKpmFilter[] = ['none', 'some'];

/**
 * ***Akun terdaftar*** (`/admin/members?tab=accounts`; P19.12-T2 AC-2; ADR-0245 §1; the client's message of 11 November
 * 2026, item 2): every registered account, one row each — a person who registered and joined no KPM included, whom the
 * *Anggota KPM* tab's memberships cannot list. Searched by a name or an email and filtered *Tanpa KPM* · *Punya KPM*
 * **on the server**, newest registration first, 50 a page. **View-only**: *n KPM* opens the *Anggota KPM* tab searched
 * for the account's email, and nothing changes a person.
 *
 * Built in *All members*' idiom (`PlatformMembers`): the same search and filter row, the table on a laptop, and **below
 * 1024px** row cards with the filter as a pill (P19.2-T2 AC-1, AC-4) — no table to scroll sideways, no native select.
 */
export function PlatformAccounts({ initial = {} }: { initial?: AccountsFilters }) {
  const t = useMessages(adminPlatformReadsMessages).accounts;
  const figures = useFigureLanguage();
  const phone = useMediaQuery(['phone', 'tablet'], { beforePaint: true });
  const searchId = useId();
  const [filters, setFilters] = useState<AccountsFilters>(initial);
  const [typed, setTyped] = useState(initial.q ?? '');
  const [page, setPage] = useState<PlatformAccountsPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readAccounts(filters)
      .then((next) => { if (live) setPage(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [filters, attempt]);

  const set = (next: Partial<AccountsFilters>) => setFilters((now) => ({ ...now, ...next, page: next.page ?? 1 }));
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    // The shortest search is the server's to say (`PLATFORM_READ.SEARCH_MIN_LENGTH`): its sentence is shown above the
    // list, and no limit is re-declared here (invariant §7).
    set({ q: typed.trim() || undefined });
  };
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  const filtered = Boolean(filters.q || filters.kpm);
  const day = (value: string | null) => (value ? formatShortDay(value, { year: true }, figures) : t.never);
  const choices: ChoiceOption<AccountKpmFilter | ''>[] = [
    { key: '', label: t.any }, ...KPM_FILTERS.map((key) => ({ key, label: t.kpmChoice[key] })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={search}
        role="search"
        className={phone ? 'flex flex-col gap-3' : 'grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-end'}
      >
        <Field label={t.search} htmlFor={searchId} hint={t.searchHint}>
          <TextInput id={searchId} type="search" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </Field>
        {phone ? (
          <div className="flex flex-wrap gap-1.5">
            <ChoicePill
              name={t.kpm}
              options={choices}
              value={filters.kpm ?? ''}
              onChange={(key) => set({ kpm: key || undefined })}
              narrows={Boolean(filters.kpm)}
            />
          </div>
        ) : (
          <Field label={t.kpm} htmlFor={`${searchId}-kpm`}>
            <Select
              id={`${searchId}-kpm`}
              value={filters.kpm ?? ''}
              onChange={(e) => set({ kpm: (e.target.value || undefined) as AccountKpmFilter | undefined })}
            >
              {choices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
        )}
      </form>

      {error && (
        <div className="flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}

      {!error && page === null && (
        <SkeletonTable
          caption={t.loading}
          columns={[t.columns.name, t.columns.company, t.columns.registered, t.columns.email, t.columns.kpm]}
          rows={5}
        />
      )}

      {page && page.total === 0 && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState title={filtered ? t.noMatch : t.empty} variant={filtered ? 'filtered' : 'empty'} />
        </div>
      )}

      {page && page.rows.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">{t.total({ n: page.total })}</p>
          {phone ? (
            <RowCards label={t.caption}>
              {page.rows.map((row) => (
                <RowCard key={row.userId}>
                  <div className="flex items-start justify-between gap-3">
                    <Person row={row} />
                    <KpmCell row={row} />
                  </div>
                  <CardFields>
                    <CardField label={t.columns.company}>{row.company?.name ?? '—'}</CardField>
                    <CardField label={t.columns.registered}>{day(row.registeredOn)}</CardField>
                    <CardField label={t.columns.email}><Verified row={row} /></CardField>
                    <CardField label={t.columns.lastSignIn}>{day(row.lastSignInOn)}</CardField>
                  </CardFields>
                </RowCard>
              ))}
            </RowCards>
          ) : (
            <DataTable
              caption={t.caption}
              columns={[
                t.columns.name, t.columns.company, t.columns.registered, t.columns.email, t.columns.lastSignIn, t.columns.kpm,
              ]}
            >
              {page.rows.map((row) => (
                <Row key={row.userId}>
                  <Cell><Person row={row} /></Cell>
                  <Cell>{row.company?.name ?? '—'}</Cell>
                  <Cell className="whitespace-nowrap">{day(row.registeredOn)}</Cell>
                  <Cell><Verified row={row} /></Cell>
                  <Cell className="whitespace-nowrap">{day(row.lastSignInOn)}</Cell>
                  <Cell><KpmCell row={row} /></Cell>
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

/** The name, and the email under it in muted ink: how the person was told to look for the account. */
function Person({ row }: { row: PlatformAccountRow }) {
  return (
    <span className="min-w-0">
      <span className="block font-semibold text-navy">{row.fullName}</span>
      <span className="block break-all text-sm text-muted">{row.email}</span>
    </span>
  );
}

/** *Terverifikasi* · *Belum diverifikasi*: a word on a pill, never the colour alone. */
function Verified({ row }: { row: PlatformAccountRow }) {
  const t = useMessages(adminPlatformReadsMessages).accounts;
  return row.emailVerified
    ? <StatusPill status="success" label={t.verified} />
    : <StatusPill status="watch" label={t.unverified} />;
}

/**
 * ***Belum punya KPM***, or ***n KPM*** opening the *Anggota KPM* tab searched for the account's email — the row's one way
 * on, view-only like the rest (OD-260 OQ2). 44px below 1024px, where it is a card's (P19.2-T2 AC-5; UI-135).
 */
function KpmCell({ row }: { row: PlatformAccountRow }) {
  const t = useMessages(adminPlatformReadsMessages).accounts;
  if (row.kpmCount === 0) return <StatusPill status="neutral" label={t.noKpm} />;
  return (
    <Link
      href={`/admin/members?q=${encodeURIComponent(row.email)}`}
      className="whitespace-nowrap text-navy underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center"
      aria-label={t.openKpms({ n: row.kpmCount, name: row.fullName })}
    >
      {t.kpms({ n: row.kpmCount })}
    </Link>
  );
}
