'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NavIcon } from '@/components/ui/nav-icon';
import { Pager } from '@/components/ui/pager';
import { ChoicePill, type ChoiceOption } from '@/components/ui/rows-and-sheets';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonPeople } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { adminMembersMessages } from '@/i18n/messages/admin-members';
import { insurersOf, listCompanies, listTenants, type Company, type TenantListRow } from '@/lib/admin';
import {
  readAnggota, statusChoiceOf, statusFilters, type AnggotaFilters, type AnggotaPage, type AnggotaRow, type MemberClass,
  type StatusChoice,
} from '@/lib/admin-members';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import { MemberDetailSheet, MemberTags } from './member-detail-sheet';
import { MemberName } from './member-name';

const TABS: readonly ('all' | MemberClass)[] = ['all', 'ab', 'aab', 'agent'];
const STATUS_CHOICES: readonly StatusChoice[] = ['active', 'pending', 'removed', 'test'];
/** The three columns and the chevron, as the mockup lays them (`saMem`: 1.6fr · 1.4fr · 1fr · 30px). */
const COLUMNS = 'grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_1.5rem]';

/**
 * ***Anggota* — every member of every KPM** (P19.23-T3 AC-1; the Super Admin spec §6; mockup `saMem`, tablet and phone
 * frame 25; ADR-0277; OD-421).
 *
 * - **The search and three filters in one row** — *Cari nama, telepon, email*, then *Semua perusahaan · Semua KPM · Semua
 *   status* as pills that open their choices (below 768px under the search, §12) — **then the tabs** *Semua · AB · AAB ·
 *   Agent*, one row of equal widths at every size. The search, the filters and the tabs are the server's (`GET
 *   /admin/members`); a phone number is found however it was typed.
 * - **One row per membership**: the photo, the orange label and the NAME, *Owner* (or *Admin*) beside it, then the KPM —
 *   by its name, never its code alone — and the company; a chevron. **Tapping a row opens the detail**
 *   (`MemberDetailSheet`). Below 768px each row is a card, the column's name above each value (§12).
 * - **Test accounts are in no row and no count** (ADR-0267 §1); *Semua status* › *Akun tes* lists them alone, each tagged,
 *   so one flagged by mistake can be found and unflagged (OD-421). The line under the list: *"n anggota di m KPM · akun
 *   tes tidak dihitung"*.
 * - ***Akun terdaftar*** (ADR-0245 §1, the client's request of 11 November 2026) — accounts with no KPM, whom a list of
 *   memberships cannot show — stays one link away under the list (parity I-1187).
 * - **Every state**: the people skeleton while it reads, an empty and a no-match state, the server's refusal with *Coba
 *   lagi*.
 */
export function Anggota({ initial = {} }: { initial?: AnggotaFilters }) {
  const t = useMessages(adminMembersMessages);
  const phone = useMediaQuery('phone', { beforePaint: true });
  const searchId = useId();
  const [filters, setFilters] = useState<AnggotaFilters>(initial);
  const [typed, setTyped] = useState(initial.q ?? '');
  const [page, setPage] = useState<AnggotaPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [offices, setOffices] = useState<TenantListRow[]>([]);
  const [open, setOpen] = useState<AnggotaRow | null>(null);

  useEffect(() => {
    void listCompanies().then((rows) => setCompanies(insurersOf(rows))).catch(() => setCompanies([]));
    void listTenants().then(setOffices).catch(() => setOffices([]));
  }, []);

  useEffect(() => {
    let live = true;
    setError(null);
    readAnggota(filters)
      .then((next) => { if (live) setPage(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [filters, attempt]);

  const set = (next: Partial<AnggotaFilters>) => setFilters((now) => ({ ...now, ...next, page: next.page ?? 1 }));
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    // The shortest search is the server's to say (`PLATFORM_READ.SEARCH_MIN_LENGTH`): a shorter one is refused, in words.
    set({ q: typed.trim() || undefined });
  };
  const any = <K extends string>(all: string, rest: ChoiceOption<K>[]): ChoiceOption<K | ''>[] => [{ key: '', label: all }, ...rest];
  const kpmChoices = offices
    .filter((o) => !filters.companyId || o.companyId === filters.companyId)
    // A KPM by its name and its company, never its code alone.
    .map((o) => ({ key: o._id, label: `${o.branchName} · ${o.companyName}` }));
  const testOnly = filters.testAccount === 'only';
  const filtered = Boolean(filters.q || filters.role || filters.status || filters.companyId || filters.kpmId || testOnly);
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  const tab = filters.role ?? 'all';

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={search}
        role="search"
        className={cn('flex gap-2', phone ? 'flex-col' : 'flex-wrap items-center')}
      >
        <div className={cn('flex min-w-0 items-center gap-2', phone ? 'w-full' : 'min-w-[14rem] flex-1 basis-60')}>
          <label htmlFor={searchId} className="sr-only">{t.search}</label>
          <span className="relative flex min-w-0 flex-1 items-center">
            <NavIcon name="ti-search" className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <input
              id={searchId}
              type="search"
              value={typed}
              placeholder={t.search}
              onChange={(e) => setTyped(e.target.value)}
              className="h-11 w-full min-w-0 rounded-pill border border-hairline bg-card pl-9 pr-3 text-md text-ink placeholder:text-muted"
            />
          </span>
          <Button type="submit" variant="secondary" className="min-h-11 shrink-0">{t.searchButton}</Button>
        </div>
        <div className={cn('flex flex-wrap gap-1.5', phone && 'w-full')}>
          <ChoicePill
            name={t.allCompanies}
            options={any(t.allCompanies, companies.map((c) => ({ key: c._id, label: c.name })))}
            value={filters.companyId ?? ''}
            onChange={(key) => set({ companyId: key || undefined, kpmId: undefined })}
            narrows={Boolean(filters.companyId)}
          />
          <ChoicePill
            name={t.allKpms}
            options={any(t.allKpms, kpmChoices)}
            value={filters.kpmId ?? ''}
            onChange={(key) => set({ kpmId: key || undefined })}
            narrows={Boolean(filters.kpmId)}
          />
          <ChoicePill
            name={t.allStatuses}
            options={any(t.allStatuses, STATUS_CHOICES.map((s) => ({ key: s, label: t.statuses[s] })))}
            value={statusChoiceOf(filters)}
            onChange={(key) => set(statusFilters(key))}
            narrows={Boolean(filters.status || testOnly)}
          />
        </div>
        {/*
          * *KPM Owners & Admins* (OD-419; ADR-0260's *Kelola data produk*, kept): out of the menu, one link from here — at
          * the row's right end from 768px, under the filters on a phone (parity I-1186).
          */}
        <Link
          href="/admin/tenant-admins"
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-navy hover:underline',
            phone ? 'self-start' : 'ml-auto',
          )}
        >
          <NavIcon name="ti-user-shield" className="h-4 w-4" />
          {t.stewards}
          <LineIcon name="chevronRight" className="h-4 w-4" />
        </Link>
      </form>

      <Segmented
        label={t.roleTabs}
        tabs={TABS.map((id) => ({ id, label: t.tabs[id] }))}
        active={tab}
        onSelect={(id) => set({ role: id === 'all' ? undefined : (id as MemberClass) })}
        phoneLayout="wrap"
      >
        {() => (
          <div className="flex flex-col gap-3 pt-1">
            {error && (
              <div className="flex flex-col gap-2">
                <ErrorBanner {...error} />
                <Button variant="secondary" className="min-h-11 self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
              </div>
            )}

            {!error && page === null && <SkeletonPeople count={6} label={t.loading} />}

            {page && page.total === 0 && (
              <div className="rounded-lg border border-card-edge bg-card">
                <EmptyState title={filtered ? t.noMatch : t.empty} />
              </div>
            )}

            {page && page.rows.length > 0 && (
              <>
                {phone ? (
                  <ul aria-label={t.caption} className="flex flex-col gap-2">
                    {page.rows.map((row) => (
                      <li key={row.membershipId}>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-label={t.openDetail({ name: row.fullName })}
                          onClick={() => setOpen(row)}
                          data-row={row.membershipId}
                          className="flex min-h-11 w-full flex-col gap-2.5 rounded-lg border border-card-edge bg-card p-3.5 text-left"
                        >
                          <span className="flex w-full min-w-0 items-center gap-2.5">
                            <Avatar name={row.fullName} photoUrl={row.avatarUrl} seed={row.userId} size={36} />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <MemberName name={row.fullName} role={row.role} />
                              <span className="flex flex-wrap gap-1"><MemberTags row={row} /></span>
                            </span>
                            <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-muted" />
                          </span>
                          <span className="grid w-full grid-cols-1 gap-2">
                            <CardValue label={t.columns.kpm} value={row.kpm.branch} />
                            <CardValue label={t.columns.company} value={row.company.name} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-card-edge bg-card">
                    <div aria-hidden="true" className={cn('grid gap-3 border-b border-hairline px-4 py-2.5 text-xs font-semibold text-muted', COLUMNS)}>
                      <span>{t.columns.member}</span>
                      <span>{t.columns.kpm}</span>
                      <span>{t.columns.company}</span>
                      <span />
                    </div>
                    <ul aria-label={t.caption}>
                      {page.rows.map((row) => (
                        <li key={row.membershipId} className="border-b border-hairline last:border-b-0">
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={`${t.openDetail({ name: row.fullName })} · ${row.kpm.branch} · ${row.company.name}`}
                            onClick={() => setOpen(row)}
                            data-row={row.membershipId}
                            className={cn('grid min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-base', COLUMNS)}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <Avatar name={row.fullName} photoUrl={row.avatarUrl} seed={row.userId} size={32} />
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <MemberName name={row.fullName} role={row.role} />
                                <span className="flex min-h-4 flex-wrap gap-1"><MemberTags row={row} /></span>
                              </span>
                            </span>
                            <span className="min-w-0 truncate text-md text-ink">{row.kpm.branch}</span>
                            <span className="min-w-0 truncate text-md text-muted">{row.company.name}</span>
                            <LineIcon name="chevronRight" className="h-5 w-5 text-muted" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Pager page={page.page} pages={pages} label={t.caption} onPage={(next) => set({ page: next })} />
              </>
            )}

            {page && (
              <p className="flex flex-col gap-1 text-xs text-muted sm:flex-row sm:flex-wrap sm:gap-x-4" aria-live="polite">
                <span>{testOnly ? t.noteTest({ n: page.total }) : t.note({ n: page.total, m: page.kpmCount })}</span>
                {page.rows.length > 0 && <span>{t.tapHint}</span>}
                <Link
                  href="/admin/members?tab=accounts"
                  className="text-navy underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center"
                >
                  {t.accounts}
                </Link>
              </p>
            )}
          </div>
        )}
      </Segmented>

      {open && (
        <MemberDetailSheet
          row={open}
          onClose={() => setOpen(null)}
          onTestAccountChanged={() => setAttempt((n) => n + 1)}
        />
      )}
    </div>
  );
}

/** A card's value with its column's name above it (§12: *tables become cards with the column name above each value*). */
function CardValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="min-w-0 truncate text-md text-ink">{value}</span>
    </span>
  );
}
