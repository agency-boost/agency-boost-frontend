'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Switch } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NavIcon } from '@/components/ui/nav-icon';
import { Pager } from '@/components/ui/pager';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ChoicePill, type ChoiceOption } from '@/components/ui/rows-and-sheets';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonPeople } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { addUserMessages } from '@/i18n/messages/add-user';
import { adminMembersMessages } from '@/i18n/messages/admin-members';
import { cancelInvitation, resendInvitation } from '@/lib/add-user';
import { insurersOf, listCompanies, listTenants, type Company, type TenantListRow } from '@/lib/admin';
import {
  readAnggota, readWaiting, type AnggotaChips, type AnggotaFilters, type AnggotaPage, type AnggotaRow, type MemberClass,
  type WaitingPage, type WaitingRow,
} from '@/lib/admin-members';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { dayInZone, formatMonth, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import type { MemberStatus } from '@/lib/platform-reads';
import { useMediaQuery } from '@/lib/use-media-query';
import { AddUserSheet, type AddUserDone, type SheetPerson } from './add-user-sheet';
import { MemberDetailSheet, MemberTags } from './member-detail-sheet';
import { MemberName } from './member-name';

const TABS: readonly ('all' | MemberClass)[] = ['all', 'ab', 'aab', 'agent'];
/** *Aktif · Menunggu · Keluar* (UI-209 (21 Nov)): the chips, *Aktif* first and the default. */
const CHIPS: readonly MemberStatus[] = ['active', 'pending', 'removed'];
/** The three columns and the chevron, as the mockup lays them (`saMem`: 1.6fr · 1.4fr · 1fr · 30px). */
const COLUMNS = 'grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_1.5rem]';
/** *Menunggu*'s rows from 768px: the same three, and the row's action where the chevron was. */
const WAITING_COLUMNS = 'grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]';
/** A search typed on a phone is sent once the typing pauses (UI-208: *search as you type*). */
const TYPING_MS = 350;

/**
 * ***Anggota* — every member of every KPM** (P19.23-T3 AC-1; the Super Admin spec §6; ADR-0277; *changed 2026-11-22*,
 * P19.28-T3, T2 AC-1: UI-208, UI-209, UI-213 (21 Nov), F-1; ADR-0286; stop motion A, B and D frames 7–8).
 *
 * - **The chips *Aktif n · Menunggu n · Keluar n*** (every size, UI-209), *Aktif* by default, and the switch ***Tampilkan
 *   akun tes***, where *Semua status* and its *Akun tes* were (OD-421 superseded). Each count is the server's
 *   (`chips`): *Aktif* the counted member (ADR-0284 §1); test accounts in none.
 * - **Every row that is not *Aktif* carries a pill with its date**: *Diundang · <date>* with ⋯ *Kirim ulang · Batalkan*;
 *   *Belum ada KPM* with a **Masukkan** button, which opens the shared sheet as *Masukkan ke KPM*, the KPM prefilled
 *   (OD-441); *Keluar <Mon YYYY>*. An owner carries *Owner*.
 * - **＋ Tambah user** floats at the foot, above the tab bar on a phone: the shared sheet (`AddUserSheet`).
 * - **Below 768px** (UI-208): 60px rows — photo · label + NAME · *KPM · company* · the pill · › — one row of search, as you
 *   type, and *Filter* (a sheet: company, KPM and role); *Owner & admin · Kelola data produk* under the list; *"Ketuk =
 *   detail anggota"* and *"Akun terdaftar…"* not drawn (UI-213). **From 768px the page is as it was**: the search with
 *   *Cari*, the company and KPM pills, the role tabs, the table.
 * - **Every state**: the people skeleton, empty and no-match, the server's refusal with *Coba lagi*.
 */
export function Anggota({ initial = {} }: { initial?: AnggotaFilters }) {
  const t = useMessages(adminMembersMessages);
  const s = useMessages(addUserMessages);
  const figures = useFigureLanguage();
  const router = useRouter();
  const { show } = useToast();
  const phone = useMediaQuery('phone', { beforePaint: true });
  const searchId = useId();
  const testId = useId();
  const [filters, setFilters] = useState<AnggotaFilters>({ ...initial, status: initial.status ?? 'active' });
  const [typed, setTyped] = useState(initial.q ?? '');
  const [page, setPage] = useState<AnggotaPage | null>(null);
  const [waiting, setWaiting] = useState<WaitingPage | null>(null);
  const [chips, setChips] = useState<AnggotaChips | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [offices, setOffices] = useState<TenantListRow[]>([]);
  const [open, setOpen] = useState<AnggotaRow | null>(null);
  const [sheet, setSheet] = useState<null | { mode: 'add' } | { mode: 'place'; person: SheetPerson }>(null);
  const [filtering, setFiltering] = useState(false);
  const chip: MemberStatus = filters.status ?? 'active';

  useEffect(() => {
    void listCompanies().then((rows) => setCompanies(insurersOf(rows))).catch(() => setCompanies([]));
    void listTenants().then(setOffices).catch(() => setOffices([]));
  }, []);

  useEffect(() => {
    let live = true;
    setError(null);
    if (chip === 'pending') {
      const { status: _status, ...rest } = filters;
      readWaiting(rest)
        .then((next) => { if (live) { setWaiting(next); setChips(next.chips); } })
        .catch((err) => { if (live) setError(toDisplayError(err)); });
    } else {
      readAnggota(filters)
        .then((next) => { if (live) { setPage(next); if (next.chips) setChips(next.chips); } })
        .catch((err) => { if (live) setError(toDisplayError(err)); });
    }
    return () => { live = false; };
  }, [filters, attempt, chip]);

  // UI-208: on a phone the search runs as it is typed, once the typing pauses — no *Cari*.
  useEffect(() => {
    if (!phone) return;
    const q = typed.trim();
    if (q.length === 1 || q === (filters.q ?? '')) return;
    const timer = setTimeout(() => set({ q: q || undefined }), TYPING_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `set` is stable in effect: it only writes the filters.
  }, [typed, phone]);

  const set = (next: Partial<AnggotaFilters>) => setFilters((now) => ({ ...now, ...next, page: next.page ?? 1 }));
  const reload = () => setAttempt((n) => n + 1);
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
  const testsShown = filters.testAccount === 'include';
  const filtered = Boolean(filters.q || filters.role || filters.companyId || filters.kpmId);
  const current = chip === 'pending' ? waiting : page;
  const pages = current ? Math.max(1, Math.ceil(current.total / current.pageSize)) : 1;
  const tab = filters.role ?? 'all';
  const today = dayInZone(OFFICE_TIME_ZONE, new Date());

  /** The toast the sheet's save earns, and the list read again on the chip that now holds the person. */
  const saved = (done: AddUserDone) => {
    setSheet(null);
    if (!done.whatsAppOpened && done.kind === 'invited') show(s.blocked);
    else if (done.kpm.created) {
      /*
       * *Buat KPM & jadikan owner* (stop motion B's last frame; F-1, F-2): the KPM list, the new KPM first, and the toast —
       * the shell's, so it stays on through the move. The list pins it from `?created=`.
       */
      show(s.createdWithOwner({ name: done.fullName, kpm: done.kpm.branch }));
      router.push(`/admin/tenants?created=${encodeURIComponent(done.kpm.id)}`);
      return;
    } else {
      const words = done.kind === 'invited' ? s.added : s.placed;
      show(words({ name: done.fullName, kpm: done.kpm.branch }), {
        action: { label: s.view, onAction: () => set({ status: done.kind === 'invited' ? 'pending' : 'active' }) },
      });
    }
    reload();
  };

  const resend = async (row: WaitingRow) => {
    try {
      const answer = await resendInvitation(row.invitationId!, row.kpm?.branch ?? '');
      show(answer.whatsAppOpened ? t.resent({ name: row.fullName }) : s.blocked);
      reload();
    } catch (err) {
      show(toDisplayError(err).message);
    }
  };
  const cancel = async (row: WaitingRow) => {
    try {
      await cancelInvitation(row.invitationId!);
      show(t.cancelled({ name: row.fullName }));
      reload();
    } catch (err) {
      show(toDisplayError(err).message);
    }
  };
  const masukkan = (row: WaitingRow) => setSheet({
    mode: 'place',
    person: {
      userId: row.userId!, fullName: row.fullName, email: row.email, avatarUrl: row.avatarUrl,
      kpm: row.kpm, companyId: row.company?.id ?? null, hasPhone: row.hasPhone,
    },
  });

  const filterPills = (
    <>
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
    </>
  );
  const stewardsLink = (
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
  );

  return (
    <div className="flex flex-col gap-3 max-md:pb-20" data-anggota-chip={chip}>
      <form onSubmit={search} role="search" className={cn('flex gap-2', phone ? 'items-center' : 'flex-wrap items-center')}>
        <div className={cn('flex min-w-0 items-center gap-2', phone ? 'flex-1' : 'min-w-[14rem] flex-1 basis-60')}>
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
          {!phone && <Button type="submit" variant="secondary" className="min-h-11 shrink-0">{t.searchButton}</Button>}
        </div>
        {phone ? (
          <button
            type="button"
            onClick={() => setFiltering(true)}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-base font-semibold',
              filters.companyId || filters.kpmId || filters.role ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink',
            )}
            data-anggota-filter=""
          >
            <LineIcon name="adjust" className="h-[18px] w-[18px]" />
            {t.filters}
          </button>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">{filterPills}</div>
            {/* *KPM Owners & Admins* (OD-419; ADR-0260's *Kelola data produk*): from 768px where it was (parity I-1186). */}
            {stewardsLink}
          </>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="radiogroup" aria-label={t.status} className="flex gap-1.5" data-anggota-chips="">
          {CHIPS.map((key) => {
            const on = chip === key;
            const n = chips ? chips[key] : null;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ status: key })}
                data-chip={key}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-pill px-3 text-base font-semibold',
                  on ? 'bg-secondary text-secondary-contrast' : 'border border-hairline bg-card text-ink',
                )}
              >
                {t.statuses[key]}
                {n !== null && <span className="opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
        <Switch
          id={testId}
          label={t.showTests}
          checked={testsShown}
          onChange={(next) => set({ testAccount: next ? 'include' : undefined })}
          phoneTarget
          tabletTarget
        />
      </div>

      <Segmented
        label={t.roleTabs}
        tabs={TABS.map((id) => ({ id, label: t.tabs[id] }))}
        active={tab}
        onSelect={(id) => set({ role: id === 'all' ? undefined : (id as MemberClass) })}
        phoneLayout="wrap"
        className="max-md:hidden"
        // On a phone the tabs are the filter sheet's: no room where they stood, the list one `gap-3` under the chips
        // (the integration round's walk, 2026-11-22: about 30px of nothing). From 768px as before.
        panelClassName="max-md:mt-0"
      >
        {() => (
          <div className="flex flex-col gap-3 pt-1 max-md:pt-0">
            {error && (
              <div className="flex flex-col gap-2">
                <ErrorBanner {...error} />
                <Button variant="secondary" className="min-h-11 self-start" onClick={reload}>{t.retry}</Button>
              </div>
            )}

            {!error && current === null && <SkeletonPeople count={6} label={t.loading} />}

            {current && current.total === 0 && (
              <div className="rounded-lg border border-card-edge bg-card">
                <EmptyState title={filtered ? t.noMatch : chip === 'pending' ? t.nobodyWaiting : chip === 'removed' ? t.nobodyLeft : t.empty} />
              </div>
            )}

            {chip === 'pending' && waiting && waiting.rows.length > 0 && (
              <WaitingList rows={waiting.rows} phone={phone} today={today} figures={figures} onResend={resend} onCancel={cancel} onPlace={masukkan} />
            )}

            {chip !== 'pending' && page && page.rows.length > 0 && (
              phone ? (
                <ul aria-label={t.caption} className="rounded-lg bg-card px-3.5 py-1">
                  {page.rows.map((row) => (
                    <li key={row.membershipId} className="border-b border-divider last:border-b-0">
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={t.openDetail({ name: row.fullName })}
                        onClick={() => setOpen(row)}
                        data-row={row.membershipId}
                        className="flex min-h-[60px] w-full items-center gap-2.5 py-2 text-left"
                      >
                        <Avatar name={row.fullName} photoUrl={row.avatarUrl} seed={row.userId} size={36} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <MemberName name={row.fullName} role={row.role} className="text-base" />
                            <MemberTags row={row} />
                          </span>
                          <span className="truncate text-base text-muted">{`${row.kpm.branch} · ${row.company.name}`}</span>
                          {row.status === 'removed' && <LeftPill row={row} figures={figures} />}
                        </span>
                        <LineIcon name="chevronRight" className="h-[18px] w-[18px] shrink-0 text-muted" />
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
                              <span className="flex min-h-4 flex-wrap gap-1">
                                <MemberTags row={row} />
                                {row.status === 'removed' && <LeftPill row={row} figures={figures} />}
                              </span>
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
              )
            )}

            {current && current.rows.length > 0 && (
              <Pager page={current.page} pages={pages} label={t.caption} onPage={(next) => set({ page: next })} />
            )}

            {page && chip !== 'pending' && (
              <p className="flex flex-col gap-1 text-xs text-muted sm:flex-row sm:flex-wrap sm:gap-x-4" aria-live="polite">
                <span>{t.note({ n: page.counted?.members ?? page.total, m: page.counted?.kpms ?? page.kpmCount })}</span>
                {/* UI-213 (21 Nov): neither line is drawn on a phone; from 768px both read as before. */}
                {!phone && page.rows.length > 0 && <span>{t.tapHint}</span>}
                {!phone && (
                  <Link href="/admin/members?tab=accounts" className="text-navy underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">
                    {t.accounts}
                  </Link>
                )}
              </p>
            )}
            {/* UI-208 (21 Nov): out of the filter area on a phone — under the list. */}
            {phone && stewardsLink}
          </div>
        )}
      </Segmented>

      <button
        type="button"
        onClick={() => setSheet({ mode: 'add' })}
        aria-haspopup="dialog"
        data-add-user-fab=""
        className={cn(
          'fixed z-30 inline-flex h-[52px] items-center gap-1.5 rounded-pill bg-primary px-[18px] text-row font-bold text-primary-contrast shadow-modal',
          'bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 md:bottom-8 md:right-8',
        )}
      >
        <NavIcon name="ti-plus" className="h-5 w-5" />
        {s.title}
      </button>

      {filtering && (
        <ResponsiveSheet open title={t.filters} onClose={() => setFiltering(false)} footer={(
          <Button className="w-full" onClick={() => setFiltering(false)}>{t.done}</Button>
        )}>
          <div className="flex flex-col gap-3" data-anggota-filter-sheet="">
            <FilterField label={t.company}>
              <PickerMenu
                label={t.company}
                value={filters.companyId ?? ''}
                options={[{ value: '', label: t.allCompanies }, ...companies.map((c) => ({ value: c._id, label: c.name }))]}
                onChange={(v) => set({ companyId: v || undefined, kpmId: undefined })}
                className="w-full"
              />
            </FilterField>
            <FilterField label={t.kpm}>
              <PickerMenu
                label={t.kpm}
                value={filters.kpmId ?? ''}
                options={[{ value: '', label: t.allKpms }, ...kpmChoices.map((k) => ({ value: k.key, label: k.label }))]}
                onChange={(v) => set({ kpmId: v || undefined })}
                className="w-full"
              />
            </FilterField>
            <FilterField label={t.roleTabs}>
              <div className="flex gap-1.5">
                {TABS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={tab === id}
                    onClick={() => set({ role: id === 'all' ? undefined : (id as MemberClass) })}
                    className={cn(
                      'min-h-11 flex-1 rounded-pill border text-base font-semibold',
                      tab === id ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink',
                    )}
                  >
                    {t.tabs[id]}
                  </button>
                ))}
              </div>
            </FilterField>
          </div>
        </ResponsiveSheet>
      )}

      {open && <MemberDetailSheet row={open} onClose={() => setOpen(null)} onTestAccountChanged={reload} />}
      {sheet?.mode === 'add' && <AddUserSheet mode="add" onClose={() => setSheet(null)} onDone={saved} />}
      {sheet?.mode === 'place' && (
        <AddUserSheet mode="place" person={sheet.person} onClose={() => setSheet(null)} onDone={saved} />
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-base font-semibold text-ink">{label}</span>
      {children}
    </div>
  );
}

/** ***Keluar <Mon YYYY>*** (UI-209): the month the membership ended, from the server's office day. */
function LeftPill({ row, figures }: { row: AnggotaRow; figures: ReturnType<typeof useFigureLanguage> }) {
  const t = useMessages(adminMembersMessages);
  return (
    <span className="inline-flex h-6 w-fit shrink-0 items-center rounded-pill bg-pill-grey px-2.5 text-sm font-semibold text-pill-grey-ink" data-pill="left">
      {row.leftOn ? t.leftOn({ month: formatMonth(row.leftOn.slice(0, 7), figures) }) : t.statuses.removed}
    </span>
  );
}

/**
 * ***Menunggu*'s rows** (UI-209; stop motion A frame 8, B frame 2): *Diundang · <date>* with ⋯ *Kirim ulang ·
 * Batalkan*, *Belum ada KPM* with **Masukkan**. Below 768px 60px rows in one card; from 768px the table's columns.
 */
function WaitingList({
  rows, phone, today, figures, onResend, onCancel, onPlace,
}: {
  rows: WaitingRow[];
  phone: boolean;
  today: string;
  figures: ReturnType<typeof useFigureLanguage>;
  onResend: (row: WaitingRow) => void;
  onCancel: (row: WaitingRow) => void;
  onPlace: (row: WaitingRow) => void;
}) {
  const t = useMessages(adminMembersMessages);
  const pill = (row: WaitingRow) => (
    <span
      className="inline-flex h-6 w-fit shrink-0 items-center rounded-pill bg-pill-amber px-2.5 text-sm font-semibold text-pill-amber-ink"
      data-pill={row.kind}
    >
      {row.kind === 'invited'
        ? t.invitedOn({ when: row.since === today ? t.today : formatShortDay(row.since, {}, figures) })
        : t.noKpm}
    </span>
  );
  const where = (row: WaitingRow) => (row.kind === 'unplaced' ? row.email ?? '' : `${row.kpm?.branch ?? ''} · ${row.company?.name ?? ''}`);
  const action = (row: WaitingRow) => (row.kind === 'invited' ? (
    <ActionMenu
      label={t.invitationMenu({ name: row.fullName })}
      glyph={<LineIcon name="more" className="h-5 w-5" />}
      triggerClassName="h-11 w-11"
      items={[
        { label: t.resend, onSelect: () => onResend(row) },
        { label: t.cancel, tone: 'alert', onSelect: () => onCancel(row) },
      ]}
    />
  ) : (
    <button
      type="button"
      onClick={() => onPlace(row)}
      aria-label={t.placeFor({ name: row.fullName })}
      data-masukkan={row.userId ?? ''}
      className="inline-flex min-h-11 shrink-0 items-center rounded-pill bg-primary px-3.5 text-base font-semibold text-primary-contrast"
    >
      {t.place}
    </button>
  ));
  const name = (row: WaitingRow) => (row.role
    ? <MemberName name={row.fullName} role={row.role} className={phone ? 'text-base' : undefined} />
    : <span className={cn('min-w-0 truncate font-bold uppercase tracking-[0.2px] text-ink', phone && 'text-base')}>{row.fullName}</span>);
  const key = (row: WaitingRow) => row.invitationId ?? row.membershipId ?? row.userId ?? row.fullName;

  if (phone) {
    return (
      <ul aria-label={t.waitingCaption} className="rounded-lg bg-card px-3.5 py-1">
        {rows.map((row) => (
          <li key={key(row)} className="flex min-h-[60px] items-center gap-2.5 border-b border-divider py-2 last:border-b-0" data-waiting={row.kind}>
            <Avatar name={row.fullName} photoUrl={row.avatarUrl} seed={row.userId ?? key(row)} size={36} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {name(row)}
              <span className="truncate text-base text-muted">{where(row)}</span>
              {pill(row)}
            </span>
            {action(row)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="rounded-lg border border-card-edge bg-card">
      <div aria-hidden="true" className={cn('grid gap-3 border-b border-hairline px-4 py-2.5 text-xs font-semibold text-muted', WAITING_COLUMNS)}>
        <span>{t.columns.member}</span>
        <span>{t.columns.kpm}</span>
        <span>{t.columns.company}</span>
        <span />
      </div>
      <ul aria-label={t.waitingCaption}>
        {rows.map((row) => (
          <li key={key(row)} className={cn('grid min-h-14 items-center gap-3 border-b border-hairline px-4 py-2 last:border-b-0', WAITING_COLUMNS)} data-waiting={row.kind}>
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar name={row.fullName} photoUrl={row.avatarUrl} seed={row.userId ?? key(row)} size={32} />
              <span className="flex min-w-0 flex-col gap-0.5">
                {name(row)}
                {pill(row)}
              </span>
            </span>
            <span className="min-w-0 truncate text-md text-ink">{row.kind === 'unplaced' ? row.email ?? '' : row.kpm?.branch ?? ''}</span>
            <span className="min-w-0 truncate text-md text-muted">{row.company?.name ?? ''}</span>
            {action(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
