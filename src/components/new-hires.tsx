'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ActivationSkeleton, AspectCard, AttributionMark, AutoSaveDateField, ByHandBadge, ITEM_ROW, ProgressHeading,
  ProgressSummary, RowError, useWriteQueue, V1_ITEM_CHECKBOX, V1_ITEM_ROW,
} from '@/components/activation-parts';
import { DataItemRow } from '@/components/activation-data-item';
import { PageHeader } from '@/components/app-shell';
import { ActionMenu } from '@/components/ui/action-menu';
import { AutoMarker } from '@/components/ui/auto-marker';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Textarea } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NumberBadge } from '@/components/ui/number-badge';
import { PersonRow, TreeIndent, TreeNode, TreeToggle } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonCards } from '@/components/ui/skeleton';
import { InlineSaveStatus, useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { TonePill } from '@/components/ui/tone-pill';
import { Toast, useToast } from '@/components/ui/toast';
import { messagesIn, type MessagesOf } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { activationMessages } from '@/i18n/messages/activation';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import {
  ACTIVATION_NOTE_MAX, aspectTitle, attributionOf, autoBadge, correctionOf, correctStartDate, earliestStart,
  FIRST_CASE_CLOSED, inFilter, isDataBacked, isManual, isTickedByHandLink, NEW_HIRE_FILTERS, newHireCounts,
  newHireGroups, newHireHref, readHireClosings, readNewHire, readNewHires, saveActivationNote, saveHireItem,
  startDateAllowed, startDateRangeText, takesHandWrite, type ActivationAspectProgress, type ActivationItemProgress,
  type ActivationRecordInput, type ActivationView, type NewHireDetail as NewHireDetailRead, type NewHireFilter,
  type NewHireGroup, type NewHireRow, type NewHiresRoster, type NewHireStanding, type NewHireStatus,
} from '@/lib/activation';
import { coachingSessionHref, oneOnOneHref } from '@/lib/hrefs';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatOfficeDay, formatPercent, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { saveMemberPhone, whatsAppHref } from '@/lib/phone-number';
import { useCan, useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { usePhone } from '@/lib/use-phone';

/** ***Isi nomor WhatsApp***, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const PhoneNumberSheet = dynamic(() => import('@/components/phone-number-sheet').then((m) => m.PhoneNumberSheet), { ssr: false });

/** The roster's and the detail's words (`i18n/messages/new-hires.ts`; P18.98-T4). */
type HiresWords = MessagesOf<typeof newHiresMessages.en>;

/*
 * ── The roster ───────────────────────────────────────────────────────────────────────────────────
 */

/** What the page's joining half lends the roster (UI-024): *Menunggu bergabung*'s count, its sheet, and its list. */
export interface WaitingSummary {
  /** Invites and transfers nobody has accepted or decided. */
  count: number;
  /** Opens the sheet that lists them (below 768px). */
  open: () => void;
  /** The list itself, for the right column from 768px. */
  list: ReactNode;
}

/**
 * **New Hires** (`/new-hires`; P13-T5, P18.96-T6 — ADR-0173; **UI V1, 2026-10-30: UI-023 to UI-026**, D-24): a year
 * of new hires **as a tree of their leaders**.
 *
 * - **At the top, two tiles**: *Aktivasi 3M* — the server's percentage alone, never *3/4* (rule A, ADR-0180 §6) — and
 *   *Menunggu bergabung n ›*, which opens the invitations (`waiting`; only for a reader who may add agents).
 * - **The filter** *Semua · Teraktivasi · Belum*, with counts: *Teraktivasi* is a first sale, late ones included;
 *   *Belum* everybody without one. A leader with nobody left under it is hidden.
 * - **Below 768px, a leader accordion** (UI-073's shared tree): the reader's own group open, the units below closed;
 *   a leader's row — avatar, NAME, *Anda · Direct Unit · 4* or *AAB · 3*, the group's *Aktivasi 3M* — and under it a
 *   row per person, newest joiner first: a status circle (green ✓ Teraktivasi, amber ✓ after day 90, empty when not
 *   yet), NAME, one line — *Pecah telor di hari ke-X* (amber after day 90) or *Hari ke-X* — and the checklist's % with
 *   a 40px bar. **The whole row opens the person**: their coaching page for a leader who coaches (UI-029), else their
 *   detail. No join date, first-sale date, agent code, status chip, *Keluar* or *terlambat* (UI-024 to UI-026).
 * - **From 768px the same tree as a table** — *Nama · Status · Checklist*, every leader open — with a right column:
 *   the *Aktivasi 3M* tile and the invitation list.
 *
 * **Every figure is the server's** (invariant §7): the status, the days and each group's share; the screen groups and
 * counts rows, and computes no percentage. **Its words are the catalogue's** (`new-hires.ts`), every percentage in the
 * figures' language.
 */
export function NewHires({ waiting }: { waiting?: WaitingSummary | null }) {
  const t = useMessages(newHiresMessages);
  const { me } = useSession();
  const mayCoach = useCan('coaching_session:create');
  const [roster, setRoster] = useState<NewHiresRoster | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<NewHireFilter>('all');
  const phone = usePhone();

  useEffect(() => {
    let live = true;
    setError(null);
    readNewHires()
      .then((next) => { if (live) { setRoster(next); setEmpty(false); } })
      .catch((err) => {
        if (!live) return;
        // Nobody the reader leads joined as a new hire in the year: the nav would not have offered the page.
        if (err instanceof ApiRequestError && err.status === 404) setEmpty(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [attempt]);

  if (empty) {
    return <Card><EmptyState title={t.empty} boost="thinking" /></Card>;
  }

  // A leader who coaches opens the person's coaching page on its Coaching Session (UI-029), its ‹ back to here; an
  // Agent who leads, their detail.
  const hrefOf = (membershipId: string) =>
    (mayCoach ? coachingSessionHref(membershipId, '/new-hires') : newHireHref(membershipId));
  const readerName = me?.user.fullName ?? '';
  const groups = roster
    ? newHireGroups(roster)
      .map((group) => ({ ...group, rows: group.rows.filter((row) => inFilter(row, filter)) }))
      .filter((group) => group.rows.length > 0)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!roster && !error && <SkeletonCards count={2} label={t.loading} />}
      {roster && phone && (
        <div className="flex flex-col gap-2.5" data-testid="new-hires-phone">
          <div className="grid grid-cols-2 gap-2">
            <ShareTile pct={roster.activation3M.all.pct} />
            {waiting && <WaitingTile count={waiting.count} onOpen={waiting.open} />}
          </div>
          <FilterBar roster={roster} filter={filter} onFilter={setFilter} />
          {groups.length === 0 && <p className="px-1 text-sm text-muted">{t.sectionEmpty}</p>}
          {groups.map((group, i) => (
            <GroupCard
              key={group.key}
              group={group}
              readerName={readerName}
              hrefOf={hrefOf}
              startOpen={group.key === 'direct' || (i === 0 && !groups.some((g) => g.key === 'direct'))}
            />
          ))}
        </div>
      )}
      {roster && !phone && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_19rem]" data-testid="new-hires-wide">
          <section aria-label={t.title} className="min-w-0 rounded-lg border border-card-edge bg-card p-4">
            <FilterBar roster={roster} filter={filter} onFilter={setFilter} />
            {groups.length === 0
              ? <p className="mt-3 text-sm text-muted">{t.sectionEmpty}</p>
              : <RosterTable groups={groups} readerName={readerName} hrefOf={hrefOf} />}
          </section>
          <div className="flex min-w-0 flex-col gap-4">
            <ShareTile pct={roster.activation3M.all.pct} />
            {waiting && (
              <section aria-labelledby="waiting-to-join" className="rounded-lg border border-card-edge bg-card px-4 py-3">
                <h2 id="waiting-to-join" className="text-md font-bold text-navy">{t.list.waiting}</h2>
                {waiting.count === 0 ? <p className="mt-1 text-sm text-muted">{t.list.noWaiting}</p> : waiting.list}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A share's figure, `—` with its words for a screen reader while nobody is decided. */
function ShareFigure({ pct, className }: { pct: number | null; className?: string }) {
  const t = useMessages(newHiresMessages);
  const figures = useFigureLanguage();
  if (pct === null) {
    return (
      <span className={className}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t.noFigureName}</span>
      </span>
    );
  }
  return <span className={className}>{formatPercent(pct, {}, figures)}</span>;
}

/** *Aktivasi 3M* (UI-023): the accent tile, the percentage alone; words on the accent are navy (parity I-542). */
function ShareTile({ pct }: { pct: number | null }) {
  const t = useMessages(newHiresMessages);
  return (
    <section aria-label={t.activation3M} className="flex min-h-[72px] flex-col justify-center rounded-row bg-amber px-3 py-2 text-navy">
      <h2 className="text-sm font-semibold">{t.activation3M}</h2>
      <ShareFigure pct={pct} className="text-[1.375rem] font-extrabold leading-tight" />
    </section>
  );
}

/** *Menunggu bergabung n ›* (UI-024): the tile that opens the invitations' sheet. */
function WaitingTile({ count, onOpen }: { count: number; onOpen: () => void }) {
  const t = useMessages(newHiresMessages);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={t.list.waitingOpen({ n: count })}
      className="flex min-h-[72px] flex-col justify-center rounded-row bg-card px-3 py-2 text-left text-navy hover:bg-hover-row"
    >
      <span aria-hidden="true" className="text-sm font-semibold">{t.list.waiting}</span>
      <span aria-hidden="true" className="flex w-full items-center justify-between text-[1.375rem] font-extrabold leading-tight">
        {count}
        <LineIcon name="chevronRight" className="h-5 w-5 text-signal-grey" />
      </span>
    </button>
  );
}

/** *Semua · Teraktivasi · Belum* with their counts (UI-024): a segmented choice, 40px, flex widths. */
function FilterBar({ roster, filter, onFilter }: { roster: NewHiresRoster; filter: NewHireFilter; onFilter: (f: NewHireFilter) => void }) {
  const t = useMessages(newHiresMessages).list;
  const counts = newHireCounts(roster);
  return (
    <div role="group" aria-label={t.filterName} className="flex rounded-pill bg-card p-1 md:bg-base">
      {NEW_HIRE_FILTERS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={filter === key}
          onClick={() => onFilter(key)}
          className={cn(
            'min-h-10 flex-1 whitespace-nowrap rounded-pill px-2 text-sm font-semibold max-md:min-h-11',
            filter === key ? 'bg-ink text-white' : 'text-ink hover:bg-hover-row',
          )}
        >
          {t.filter[key]({ n: counts[key] })}
        </button>
      ))}
    </div>
  );
}

/** A leader's name for their group: the reader's own for *Direct Unit*, else the unit's leader. */
const leaderNameOf = (group: NewHireGroup, readerName: string) => group.unit.leader?.name ?? readerName;

/** *Anda · Direct Unit · 4*, *AAB · 3*, *AB · 2* (UI-024). */
function groupMeta(group: NewHireGroup, t: HiresWords, n: number): string {
  if (group.key === 'direct') return t.list.ownGroup({ n });
  return group.unit.kind === 'ab' ? t.list.abGroup({ n }) : t.list.aabGroup({ n });
}

/** A person's one line (UI-024, Appendix A): *Pecah telor di hari ke-X*, or *Hari ke-X* while there is none. */
function personLine(row: NewHireRow, t: HiresWords): string {
  return row.firstSaleDay !== null && row.status !== 'not_yet'
    ? t.list.firstSaleOnDay({ day: row.firstSaleDay })
    : t.list.dayN({ day: row.day });
}

/** The status circle (UI-024): green ✓ *Teraktivasi*, amber ✓ after day 90, empty when not yet — named for a reader. */
function StatusCircle({ status }: { status: NewHireStatus }) {
  const t = useMessages(newHiresMessages).list;
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        status === 'activated' && 'bg-pill-green text-pill-green-ink',
        status === 'activated_late' && 'bg-pill-amber text-pill-amber-ink',
        status === 'not_yet' && 'border-2 border-line bg-card',
      )}
    >
      {status !== 'not_yet' && <LineIcon name="check" className="h-4 w-4" />}
      <span className="sr-only">{t.status[status]}</span>
    </span>
  );
}

/** The checklist's % over a 40px bar (UI-024), or *Tanpa checklist* for an AB or an AAB placed as a new hire. */
function ChecklistMini({ checklist, wide = false }: { checklist: NewHireRow['checklist']; wide?: boolean }) {
  const t = useMessages(newHiresMessages);
  const figures = useFigureLanguage();
  if (!checklist) return <span className="text-xs text-muted">{t.noChecklist}</span>;
  const width = Math.min(100, Math.max(0, checklist.pct));
  return (
    <span className={cn('flex shrink-0', wide ? 'items-center gap-2' : 'flex-col items-end gap-1')}>
      <span className="text-xs font-bold text-ink">{formatPercent(checklist.pct, {}, figures)}</span>
      <span aria-hidden="true" className={cn('block h-1 overflow-hidden rounded-pill bg-divider', wide ? 'w-24' : 'w-10')}>
        <span className="block h-full rounded-pill bg-amber" style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}

/** One leader's group below 768px (UI-024, UI-073): the leader's row with its ⌄, and its people on the shared tree. */
function GroupCard({
  group, readerName, hrefOf, startOpen,
}: {
  group: NewHireGroup;
  readerName: string;
  hrefOf: (membershipId: string) => string;
  startOpen: boolean;
}) {
  const t = useMessages(newHiresMessages);
  const [open, setOpen] = useState(startOpen);
  const listId = useId();
  const name = leaderNameOf(group, readerName);
  return (
    <div role="group" aria-label={name} className="rounded-lg border border-card-edge bg-card p-1">
      <PersonRow
        name={name}
        seed={group.key}
        avatarSize={32}
        meta={groupMeta(group, t, group.rows.length)}
        trailing={(
          <>
            <span className="text-md font-bold text-amber-ink" aria-label={t.list.groupShare({ name })}>
              <ShareFigure pct={group.unit.activation3M.all.pct} />
            </span>
            <TreeToggle name={name} open={open} onToggle={() => setOpen((o) => !o)} controls={listId} />
          </>
        )}
      />
      {open && (
        <TreeIndent id={listId} label={name} className="mb-1 mr-1">
          {group.rows.map((row) => (
            <TreeNode key={row.hire.membershipId}>
              <PersonRow
                name={row.hire.name}
                href={hrefOf(row.hire.membershipId)}
                chevron
                lead={<StatusCircle status={row.status} />}
                meta={<span className={cn(row.status === 'activated_late' && 'text-amber-ink')}>{personLine(row, t)}</span>}
                trailing={<ChecklistMini checklist={row.checklist} />}
              />
            </TreeNode>
          ))}
        </TreeIndent>
      )}
    </div>
  );
}

/** The status's tinted pill on the table (D-27: a pill, never a dot). */
const STATUS_TONE = { activated: 'green', activated_late: 'amber', not_yet: 'grey' } as const;

/**
 * **From 768px, the tree as a table** (UI-024, D-24): *Nama · Status · Checklist*, every leader open — a leader's row
 * spanning the table, their people under it, newest first. The name opens the person, as the phone's row does.
 */
function RosterTable({
  groups, readerName, hrefOf,
}: {
  groups: NewHireGroup[];
  readerName: string;
  hrefOf: (membershipId: string) => string;
}) {
  const t = useMessages(newHiresMessages);
  const TH = 'border-b border-divider px-3 py-2 text-left text-xs font-semibold text-muted';
  const TD = 'border-b border-divider px-3 py-2.5 align-middle';
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="relative w-full border-collapse">
        <caption className="sr-only">{t.title}</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>{t.list.columns.name}</th>
            <th scope="col" className={TH}>{t.list.columns.status}</th>
            <th scope="col" className={TH}>{t.list.columns.checklist}</th>
          </tr>
        </thead>
        {groups.map((group) => {
          const name = leaderNameOf(group, readerName);
          return (
            <tbody key={group.key}>
              <tr className="bg-base">
                <th scope="colgroup" colSpan={3} className="px-3 py-2 text-left">
                  <span className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-md font-bold uppercase text-ink">{name}</span>
                      <span className="block text-sm font-normal text-muted">{groupMeta(group, t, group.rows.length)}</span>
                    </span>
                    <span className="text-md font-bold text-amber-ink" aria-label={t.list.groupShare({ name })}>
                      <ShareFigure pct={group.unit.activation3M.all.pct} />
                    </span>
                  </span>
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.hire.membershipId} className="lg:hover:bg-hover-row">
                  <th scope="row" className={cn(TD, 'text-left')}>
                    <Link
                      href={hrefOf(row.hire.membershipId)}
                      className="inline-flex min-h-11 items-center gap-1 text-md font-bold uppercase text-ink hover:underline lg:min-h-8"
                    >
                      {row.hire.name}
                      <LineIcon name="chevronRight" className="h-4 w-4 text-signal-grey" />
                    </Link>
                  </th>
                  <td className={TD}>
                    <TonePill tone={STATUS_TONE[row.status]}>{t.list.status[row.status]}</TonePill>
                    <span className={cn('mt-0.5 block text-sm text-muted', row.status === 'activated_late' && 'text-amber-ink')}>
                      {personLine(row, t)}
                    </span>
                  </td>
                  <td className={TD}><ChecklistMini checklist={row.checklist} wide /></td>
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/*
 * ── One hire ─────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * **One hire's activation, as a leader reads it** (`/new-hires/[membershipId]`, P13-T5, T6; **UI V1, 2026-10-30:
 * UI-023, UI-025, UI-027**, D-25, D-26) — and **the coaching *Activation* tab** (UI-029), `embedded`, under the agent's
 * one header.
 *
 * - **At every size**: no subtitle, no *Aspek · Item · Status* table, no uppercase *OTOMATIS* sentence — an automatic
 *   item has a small ⚡ beside its name and its rule, with *Diselesaikan dari … oleh …*, behind ⓘ (`AutoMarker`); **the
 *   pecah telor strip** once they are *Teraktivasi* (green, amber after day 90), the server's status (UI-023); and
 *   ***Jadwalkan 1:1*** and ***WhatsApp*** — the shared number flow (UI-081) when there is no number yet.
 * - **Below 768px, the mockup's page** (UI-027): ‹ · NAME · ⋯ (*Koreksi tanggal bergabung*, which keeps its
 *   *dikoreksi oleh*) and *AAB Arief · Bergabung 3 Agu 2026*; the strip; two tiles — *Hari 88 /90* (*3M selesai* past
 *   day 90) and *Activation checklist* with its bar; the two buttons; the sections as 44px rows, **only the current
 *   one open**, items 44px with 22px boxes and names that wrap; the coaching note.
 * - **From 768px, today's layout** with those removals and additions: the title, *Back to New Hires*, *Activation
 *   progress* with the join date and its tiles, the aspect cards, the note.
 * - **First Sale's *Close first case independently*** shows its date as a pill — *1 Sep 2026 ✎*, or the accent's *Isi
 *   tanggal ›* when there is none — and **a tap opens *Kapan pecah telor?*** (D-26): a date between the join date and
 *   today, *Simpan* pinned; saved as the item's tick with a closing on that day (the API names it), the strip and its
 *   colour following. *Dicatat oleh* is the tick's: who and when, behind ⓘ. **A first sale from the sales data is the
 *   data's**: its date shows, with no ✎. A first sale only ever moves earlier (ADR-0171 §1), so with one recorded by
 *   hand the sheet offers the days up to it.
 * - **Every figure is served**, and every write answers the whole activation and the strip in place, nothing jumping
 *   (P18.96-T7). A hire outside the reader's reach is a 404, named for nobody; a read-only support session draws no
 *   write control.
 */
export function NewHireDetail({
  membershipId, embedded = false, notFound,
}: {
  membershipId: string;
  /** The coaching *Activation* tab (UI-029): no header and no way back — the agent's header is above it. */
  embedded?: boolean;
  /** What an embedded tab says for somebody with no activation, in its place. */
  notFound?: ReactNode;
}) {
  const t = useMessages(newHiresMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const phone = usePhone();
  const { me } = useSession();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const mayTick = useCan('activation:update_manual_item') && !readOnly;
  // P18.96-T4 AC-3: a data-backed item's hand tick carries its record, which only a leader who runs sessions writes.
  const mayRecord = useCan('coaching_session:create') && mayTick;
  const mayCorrect = useCan('activation:set_start_date') && !readOnly;
  const mayNote = useCan('activation_note:write') && !readOnly;
  const maySchedule = useCan('calendar_entry:create') && !readOnly;
  const mayPhone = useCan('member:update_phone') && !readOnly;
  const reader = me?.membership?.membershipId;
  const { toast, show } = useToast();
  const queue = useWriteQueue();
  const { save: track, statusOf } = useInlineSave();

  const [view, setView] = useState<NewHireDetailRead | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Readonly<Record<string, boolean>>>({});
  const [failed, setFailed] = useState<Readonly<Record<string, string>>>({});
  const asked = useRef<Record<string, number>>({});
  const [startError, setStartError] = useState<string | null>(null);
  const [startReset, setStartReset] = useState(0);
  const [sheet, setSheet] = useState<'firstSale' | 'joinDate' | 'phone' | null>(null);
  const phoneSheetOpened = useOpenedOnce(sheet === 'phone');
  const [savedPhone, setSavedPhone] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // P18.96-T7 AC-1: only ever this hire's settled read; the skeleton until it lands, never another hire's figures.
    setView(null);
    setPending((p) => (Object.keys(p).length === 0 ? p : {}));
    setFailed((f) => (Object.keys(f).length === 0 ? f : {}));
    setError(null);
    setMissing(false);
    readNewHire(membershipId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [membershipId, attempt]);

  /** A write's answer: the activation and the strip; a write that answered no strip keeps the one there. */
  const land = useCallback((next: NewHireDetailRead) => {
    setView((prev) => ({ ...next, newHire: next.newHire !== undefined ? next.newHire : prev?.newHire ?? null }));
  }, []);

  const tick = useCallback((code: string, done: boolean, record?: ActivationRecordInput, saved?: string) => {
    return track(`${code}\ndone`, () => {
      const ask = (asked.current[code] ?? 0) + 1;
      asked.current[code] = ask;
      setPending((p) => ({ ...p, [code]: done }));
      setFailed(({ [code]: _gone, ...rest }) => rest);
      return queue(async () => {
        try {
          land(await saveHireItem(membershipId, code, done, record));
          show(saved ?? t.detail.statusUpdated);
          return true;
        } catch (err) {
          const gone = err instanceof ApiRequestError && err.status === 404;
          if (gone) setMissing(true);
          setFailed((f) => ({ ...f, [code]: toDisplayError(err).message }));
          return gone ? null : false;
        } finally {
          if (asked.current[code] === ask) setPending(({ [code]: _done, ...rest }) => rest);
        }
      });
    });
  }, [land, membershipId, queue, show, track, t]);
  const loadClosings = useCallback(async () => (await readHireClosings(membershipId)).closings, [membershipId]);

  const correct = useCallback((startDate: string) => {
    void track('startDate', () => {
      setStartError(null);
      return queue(async () => {
        try {
          land(await correctStartDate(membershipId, startDate));
          show(t.detail.startSaved);
          return true;
        } catch (err) {
          setStartError(toDisplayError(err).message);
          setStartReset((n) => n + 1);
          return false;
        }
      });
    });
  }, [land, membershipId, queue, show, track, t]);

  if (missing) {
    return embedded && notFound ? <>{notFound}</> : <HireNotFound />;
  }

  const open = view?.state === 'open';
  const standing = view?.newHire ?? null;
  const firstCase = view?.aspects.flatMap((aspect) => aspect.items).find((it) => it.code === FIRST_CASE_CLOSED) ?? null;
  // D-26: the pecah telor's sheet, for a leader who may record it and a first case the data has not completed.
  const mayDate = !!firstCase && mayRecord && open && takesHandWrite(firstCase);
  const hirePhone = savedPhone ?? standing?.phone ?? null;
  const hireName = view?.hire.name ?? '';
  const joinLine = view && standing ? headerLine(standing, reader, t, figures) : null;
  const closed = view && view.state !== 'open' ? closedLine(view, reader, language, figures) : null;

  const renderItem = (item: ActivationItemProgress) => {
    const shown = pending[item.code] === undefined ? item : { ...item, done: pending[item.code] };
    if (item.code === FIRST_CASE_CLOSED && isDataBacked(item)) {
      return (
        <FirstSaleRow
          key={item.code}
          item={shown}
          standing={standing}
          reader={reader}
          writable={mayDate}
          onOpen={() => setSheet('firstSale')}
          status={statusOf(`${item.code}\ndone`)}
          error={failed[item.code]}
        />
      );
    }
    if (isDataBacked(item)) {
      return (
        <DataItemRow
          key={item.code}
          item={shown}
          reader={reader}
          writable={mayRecord && open}
          audience="leader"
          hireId={view!.hire.membershipId}
          today={view!.today}
          startDate={view!.startDate}
          loadClosings={loadClosings}
          onSave={(done, record) => tick(item.code, done, record)}
          status={statusOf(`${item.code}\ndone`)}
          error={failed[item.code]}
          marker="bolt"
        />
      );
    }
    return (
      <HireItemRow
        key={item.code}
        item={shown}
        reader={reader}
        writable={mayTick && open}
        onTick={(done) => { void tick(item.code, done); }}
        status={statusOf(`${item.code}\ndone`)}
        error={failed[item.code]}
      />
    );
  };

  const moreMenu = mayCorrect && open && view ? (
    <ActionMenu label={t.hire.more({ name: hireName })} items={[{ label: t.hire.correctJoinDate, onSelect: () => setSheet('joinDate') }]} />
  ) : null;

  return (
    <div className="min-w-0">
      {/* Below 768px (UI-027): ‹ · NAME · ⋯, and the leader and join date under the name. */}
      {view && phone && !embedded && (
        <header className="mb-3 flex items-start gap-1" data-testid="hire-header-phone">
          <Link href="/new-hires" aria-label={t.hire.back} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-navy">
            <LineIcon name="chevronLeft" className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1 pt-1.5">
            <h1 className="break-words text-[1.0625rem] font-extrabold uppercase leading-tight text-ink">{hireName}</h1>
            {joinLine && <p className="mt-0.5 text-sm text-muted">{joinLine}</p>}
          </div>
          {moreMenu}
        </header>
      )}
      {view && phone && embedded && (joinLine || moreMenu) && (
        <div className="mb-2 flex items-center gap-2">
          {joinLine && <p className="min-w-0 flex-1 text-sm text-muted">{joinLine}</p>}
          {moreMenu}
        </div>
      )}
      {/* From 768px: today's header and way back (UI-027: the subtitle goes at every size). */}
      {view && !phone && !embedded && <PageHeader title={hireName} subtitle={closed ?? undefined} />}
      {!phone && !embedded && <BackToRoster />}

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <ActivationSkeleton label={t.detail.loading} />}

      {view && (
        <div className="flex flex-col gap-2.5 md:gap-4">
          {/* How an activation that is over ended (parity L-89), where the subtitle no longer is. */}
          {closed && (phone || embedded) && <p className="text-sm text-muted">{closed}</p>}
          {standing && standing.status !== 'not_yet' && (
            <FirstSaleStrip standing={standing} onOpen={mayDate ? () => setSheet('firstSale') : null} />
          )}

          {phone ? (
            <div className="grid grid-cols-2 gap-2">
              <DayTile day={standing?.day ?? view.day} window={view.window} overdue={view.overdue} />
              <ChecklistTile pct={view.pct} />
            </div>
          ) : (
            <Card density="compact">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
                <ProgressHeading>{t.detail.heading}</ProgressHeading>
                <JoinDateField
                  view={view}
                  reader={reader}
                  writable={mayCorrect && open}
                  onCommit={correct}
                  status={statusOf('startDate')}
                  error={startError}
                  resetKey={startReset}
                />
              </div>
              <ProgressSummary view={view} label={t.detail.heading} markOverdue table={false} />
            </Card>
          )}

          <HireButtons
            membershipId={view.hire.membershipId}
            name={hireName}
            schedule={maySchedule}
            phone={hirePhone}
            mayAskPhone={mayPhone}
            onAskPhone={() => setSheet('phone')}
          />

          {phone
            ? <SectionList aspects={view.aspects} renderItem={renderItem} />
            : view.aspects.map((aspect, i) => (
              <AspectCard key={aspect.code} n={i + 1} label={`${aspect.label} · ${aspect.done}/${aspect.total}`}>
                {aspect.items.map(renderItem)}
              </AspectCard>
            ))}

          <NoteCard
            key={view.note?.at ?? 'none'}
            view={view}
            reader={reader}
            writable={mayNote && open}
            onSaved={(note) => {
              setView((v) => (v ? { ...v, note } : v));
              show(t.note.saved({ name: view.hire.name }));
            }}
            onMissing={() => setMissing(true)}
          />
        </div>
      )}

      {view && mayDate && (
        <FirstSaleSheet
          open={sheet === 'firstSale'}
          view={view}
          standing={standing}
          onClose={() => setSheet(null)}
          onSave={async (date) => {
            const landed = await tick(FIRST_CASE_CLOSED, true, { kind: 'closing', date }, t.hire.saved);
            if (landed) setSheet(null);
            return landed === true;
          }}
        />
      )}
      {view && mayCorrect && open && (
        <ResponsiveSheet open={sheet === 'joinDate'} title={t.hire.correctJoinDate} onClose={() => setSheet(null)}>
          <div className="py-2">
            <JoinDateField
              view={view}
              reader={reader}
              writable
              onCommit={correct}
              status={statusOf('startDate')}
              error={startError}
              resetKey={startReset}
            />
          </div>
        </ResponsiveSheet>
      )}
      {view && mayPhone && phoneSheetOpened && (
        <PhoneNumberSheet
          open={sheet === 'phone'}
          name={hireName}
          phone={hirePhone}
          onClose={() => setSheet(null)}
          onSave={async (typed) => (await saveMemberPhone(view.hire.membershipId, typed)).phone}
          onSaved={(stored) => { setSavedPhone(stored); setSheet(null); }}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

/** *AAB Arief Hidayat · Bergabung 3 Agu 2026* (UI-027), or *Anda · …* when the reader is their leader. */
function headerLine(standing: NewHireStanding, reader: string | null | undefined, t: HiresWords, figures: Language): string {
  const on = formatShortDay(standing.joinDate, { year: true }, figures);
  if (!standing.leader) return t.hire.joined({ on });
  if (standing.leader.membershipId === reader) return t.hire.joinedUnderYou({ on });
  return t.hire.joinedUnder({ role: standing.leader.role.toUpperCase(), leader: standing.leader.name, on });
}

/**
 * **The pecah telor strip** (UI-023, UI-027): one line, green — amber with *lewat 3M* after day 90 — the day of the
 * first sale and its short date; a tap reopens *Kapan pecah telor?* where the leader may change it (D-26).
 */
function FirstSaleStrip({ standing, onOpen }: { standing: NewHireStanding; onOpen: (() => void) | null }) {
  const t = useMessages(newHiresMessages).hire;
  const figures = useFigureLanguage();
  const late = standing.status === 'activated_late';
  const day = standing.firstSaleDay ?? 0;
  const words = late ? t.stripLate({ day }) : t.strip({ day });
  const date = standing.firstSaleDate ? formatShortDay(standing.firstSaleDate, {}, figures) : null;
  const face = cn(
    'flex min-h-9 w-full items-center gap-2 rounded-row px-3 py-1.5 text-left text-sm font-semibold',
    late ? 'bg-pill-amber text-pill-amber-ink' : 'bg-pill-green text-pill-green-ink',
  );
  const body = (
    <>
      <LineIcon name="check" className="h-[18px] w-[18px] shrink-0" />
      <span className="min-w-0 flex-1">{words}</span>
      {date && <span className="shrink-0 font-medium">{date}</span>}
    </>
  );
  return onOpen
    ? <button type="button" data-testid="first-sale-strip" data-status={standing.status} aria-haspopup="dialog" aria-label={`${words}${date ? `, ${date}` : ''}. ${t.stripChange}`} onClick={onOpen} className={cn(face, 'max-md:min-h-11')}>{body}</button>
    : <p data-testid="first-sale-strip" data-status={standing.status} className={face}>{body}</p>;
}

/** *Hari 88 /90* — *3M selesai* past day 90 (UI-027). */
function DayTile({ day, window, overdue }: { day: number; window: number; overdue: boolean }) {
  const t = useMessages(newHiresMessages).hire;
  const a = useMessages(activationMessages);
  return (
    <div className="flex min-h-[72px] flex-col justify-center rounded-row bg-card px-3 py-2">
      <p className="text-sm font-semibold text-navy">{t.day}</p>
      {day > window
        ? <p className="text-lg font-extrabold text-ink">{t.threeMDone}</p>
        : (
          <p className="text-[1.375rem] font-extrabold leading-tight text-ink">
            {day} <span className="text-sm font-medium text-muted">/{window}</span>
            {overdue && <span className="sr-only">{a.overdue}</span>}
          </p>
        )}
    </div>
  );
}

/** *Activation checklist 38% ▓▓░* (UI-027). */
function ChecklistTile({ pct }: { pct: number }) {
  const t = useMessages(newHiresMessages).hire;
  const figures = useFigureLanguage();
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex min-h-[72px] flex-col justify-center rounded-row bg-card px-3 py-2">
      <p className="text-sm font-semibold text-navy">{t.checklist}</p>
      <div className="flex items-center gap-2">
        <span className="text-[1.375rem] font-extrabold leading-tight text-ink">{formatPercent(pct, {}, figures)}</span>
        <span aria-hidden="true" className="block h-[5px] flex-1 overflow-hidden rounded-pill bg-divider">
          <span className="block h-full rounded-pill bg-amber" style={{ width: `${width}%` }} />
        </span>
      </div>
    </div>
  );
}

/**
 * ***Jadwalkan 1:1*** (navy, the calendar's 1:1 with them) and ***WhatsApp*** (outlined, its green mark) — 44px
 * (UI-027). WhatsApp opens their chat when the number is on file, else asks for it first (UI-081's flow).
 */
function HireButtons({
  membershipId, name, schedule, phone, mayAskPhone, onAskPhone,
}: {
  membershipId: string;
  name: string;
  schedule: boolean;
  phone: string | null;
  mayAskPhone: boolean;
  onAskPhone: () => void;
}) {
  const t = useMessages(newHiresMessages);
  const chat = whatsAppHref(phone);
  if (!schedule && !chat && !mayAskPhone) return null;
  const pill = 'flex min-h-11 items-center justify-center gap-2 rounded-pill px-3 text-md font-semibold';
  const whatsAppFace = (
    <>
      <LineIcon name="whatsapp" className="h-5 w-5 text-whatsapp" />
      {t.hire.whatsApp}
    </>
  );
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
      {schedule && (
        <Link href={oneOnOneHref(membershipId)} aria-label={t.scheduleOneOnOneName({ name })} className={cn(pill, 'bg-navy text-white hover:bg-navy-soft')}>
          <LineIcon name="calendarPlus" className="h-[18px] w-[18px]" />
          {t.scheduleOneOnOne}
        </Link>
      )}
      {chat && (
        <a href={chat} target="_blank" rel="noopener noreferrer" aria-label={t.hire.whatsAppName({ name })} className={cn(pill, 'border border-line bg-card text-ink hover:bg-hover-row')}>
          {whatsAppFace}
        </a>
      )}
      {!chat && mayAskPhone && (
        <button type="button" aria-haspopup="dialog" aria-label={t.hire.whatsAppName({ name })} onClick={onAskPhone} className={cn(pill, 'border border-line bg-card text-ink hover:bg-hover-row')}>
          {whatsAppFace}
        </button>
      )}
    </div>
  );
}

/**
 * **The sections below 768px** (UI-027): a 44px row each — its number, its name, *1/4* and ⌄ — **only the current one
 * open** (the first not done), each opening and closing on its own; its items under it.
 */
function SectionList({
  aspects, renderItem,
}: {
  aspects: readonly ActivationAspectProgress[];
  renderItem: (item: ActivationItemProgress) => ReactNode;
}) {
  const t = useMessages(newHiresMessages).hire;
  const base = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const current = aspects.find((aspect) => aspect.status !== 'done');
    return new Set(current ? [current.code] : []);
  });
  const toggle = (code: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  return (
    <div className="rounded-lg border border-card-edge bg-card py-1">
      {aspects.map((aspect, i) => {
        const id = `${base}-${i}`;
        const shown = open.has(aspect.code);
        return (
          <div key={aspect.code} className="border-b border-divider last:border-b-0">
            <h2>
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={id}
                onClick={() => toggle(aspect.code)}
                className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left"
              >
                <NumberBadge n={i + 1} />
                <span className="min-w-0 flex-1 text-md font-bold text-ink">{aspectTitle(aspect.label)}</span>
                <span className="text-sm font-semibold text-muted">
                  <span aria-hidden="true">{aspect.done}/{aspect.total}</span>
                  <span className="sr-only">{t.sectionCount({ done: aspect.done, total: aspect.total })}</span>
                </span>
                <LineIcon name={shown ? 'chevronUp' : 'chevronDown'} className="h-5 w-5 text-signal-grey" />
              </button>
            </h2>
            {shown && <div id={id} className="px-3 pb-1">{aspect.items.map(renderItem)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A leader's row (`:6823-6840`; UI V1, UI-027): a box to tick for a manual item; for an item its link completes, the
 * box inert and **a small ⚡** with its rule and who or what completed it **behind ⓘ** — never the *OTOMATIS* chip.
 */
function HireItemRow({
  item, reader, writable, onTick, status, error,
}: {
  item: ActivationItemProgress;
  reader: string | null | undefined;
  writable: boolean;
  onTick: (done: boolean) => void;
  status: InlineSaveStatusProps;
  error: string | undefined;
}) {
  const language = useLanguage();
  const words = attributionOf(item, reader, language, useFigureLanguage());
  const manual = isManual(item);
  return (
    <div className={cn(ITEM_ROW, V1_ITEM_ROW)} data-code={item.code}>
      <div className="flex items-center gap-2.5">
        <label className={cn('flex min-w-0 items-center gap-2.5 text-md font-medium text-navy', manual && writable && 'cursor-pointer')}>
          <input
            type="checkbox"
            checked={item.done}
            disabled={!manual || !writable}
            onChange={(e) => onTick(e.target.checked)}
            className={V1_ITEM_CHECKBOX}
          />
          <span className="break-words">{item.label}</span>
        </label>
        {!manual && item.link && (
          <AutoMarker name={item.label} explanation={[autoBadge(item.link.completesWhen, language).tip, words].filter(Boolean).join(' ')} />
        )}
        {/* D-orphan (P18.5-T3 AC-4): a link that does not complete the item now — ticked by hand, as Settings says. */}
        {isTickedByHandLink(item) && <ByHandBadge />}
        {manual && <AttributionMark words={words} />}
        <InlineSaveStatus {...status} label={item.label} />
      </div>
      <RowError message={error} />
    </div>
  );
}

/**
 * **First Sale's *Close first case independently*** (UI-027, D-26): its date as a pill on the right — *1 Sep 2026 ✎*,
 * or the accent's *Isi tanggal ›* on a tinted row while there is none — and the whole row opens *Kapan pecah telor?*.
 * One the sales data completed shows its date and ⚡, and opens nothing: the data's day is the data's.
 */
function FirstSaleRow({
  item, standing, reader, writable, onOpen, status, error,
}: {
  item: ActivationItemProgress;
  standing: NewHireStanding | null;
  reader: string | null | undefined;
  writable: boolean;
  onOpen: () => void;
  status: InlineSaveStatusProps;
  error: string | undefined;
}) {
  const t = useMessages(newHiresMessages).hire;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const date = item.done && standing?.firstSaleDate ? formatShortDay(standing.firstSaleDate, { year: true }, figures) : null;
  const byData = item.done && item.source === 'link';
  const recorded = item.done && !byData && item.doneBy && item.doneAt
    ? t.recordedBy({
      who: item.doneBy.membershipId === reader ? messagesIn(activationMessages, language).you : item.doneBy.name,
      when: formatOfficeDay(item.doneAt, OFFICE_TIME_ZONE, figures),
    })
    : null;
  const box = (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px] border-2',
        item.done ? 'border-success bg-success text-white' : 'border-line bg-card',
      )}
    >
      {item.done && <LineIcon name="check" className="h-3.5 w-3.5" />}
    </span>
  );
  const pill = date
    ? <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-base px-2.5 py-1 text-sm font-semibold text-ink">{date}{writable && <LineIcon name="pencil" className="h-3.5 w-3.5" />}</span>
    : writable
      ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-amber px-2.5 py-1 text-sm font-semibold text-navy">{t.addDate}<LineIcon name="chevronRight" className="h-3.5 w-3.5" /></span>
      : null;
  return (
    <div className={cn(ITEM_ROW, V1_ITEM_ROW, !item.done && writable && '-mx-1.5 rounded-row bg-amber/[0.08] px-1.5')} data-code={item.code}>
      <div className="flex items-center gap-2.5">
        {writable ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${item.label}: ${date ? t.changeDate({ on: date }) : t.addDate}`}
            onClick={onOpen}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left text-md font-medium text-navy"
          >
            {box}
            <span className="min-w-0 flex-1 break-words">{item.label}</span>
            {pill}
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2.5 text-md font-medium text-navy">
            {box}
            <span className="sr-only">{item.done ? '✓' : ''}</span>
            <span className="min-w-0 flex-1 break-words">{item.label}</span>
            {byData && item.link && (
              <AutoMarker
                name={item.label}
                explanation={[autoBadge(item.link.completesWhen, language).tip, attributionOf(item, reader, language, figures)].filter(Boolean).join(' ')}
              />
            )}
            {pill}
          </span>
        )}
        <AttributionMark words={recorded} />
        <InlineSaveStatus {...status} label={item.label} />
      </div>
      <RowError message={error} />
    </div>
  );
}

/**
 * ***Kapan pecah telor?*** (D-26): a date between the join date and today — or, with a first sale recorded by hand, up
 * to it, since a first sale only moves earlier (ADR-0171 §1) — and *Simpan*, pinned. A bottom sheet below 1024px, a
 * centred modal from it.
 */
function FirstSaleSheet({
  open, view, standing, onClose, onSave,
}: {
  open: boolean;
  view: ActivationView;
  standing: NewHireStanding | null;
  onClose: () => void;
  onSave: (date: string) => Promise<boolean>;
}) {
  const t = useMessages(newHiresMessages).hire;
  const figures = useFigureLanguage();
  const formId = useId();
  const fieldId = useId();
  const from = standing?.joinDate ?? view.startDate;
  const to = standing?.firstSaleDate && standing.firstSaleSource === 'manual' ? standing.firstSaleDate : view.today;
  const [date, setDate] = useState(standing?.firstSaleDate ?? view.today);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setDate(standing?.firstSaleDate ?? view.today); }, [open, standing?.firstSaleDate, view.today]);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= from && date <= to;
  const line = t.sheetLine({
    from: formatShortDay(from, { year: true }, figures),
    to: to === view.today ? t.today : formatShortDay(to, { year: true }, figures),
  });
  return (
    <ResponsiveSheet
      open={open}
      title={t.sheetTitle}
      description={line}
      onClose={onClose}
      footer={<Button type="submit" form={formId} disabled={!valid || saving} className="w-full">{t.save}</Button>}
    >
      <form
        id={formId}
        className="py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || saving) return;
          setSaving(true);
          void onSave(date).finally(() => setSaving(false));
        }}
      >
        <label htmlFor={fieldId} className="mb-1 block text-sm font-semibold text-navy">{t.dateLabel}</label>
        <DateField id={fieldId} value={date} min={from} max={to} onChange={setDate} className="w-full" />
      </form>
    </ResponsiveSheet>
  );
}

/** *Back to New Hires* from 768px (UI-027: ‹ alone on a phone): the prototype's chevron and words, as a link. */
function BackToRoster() {
  const t = useMessages(newHiresMessages);
  return (
    <Link
      href="/new-hires"
      className="mb-3.5 inline-flex min-h-11 items-center gap-1.5 py-1.5 text-base font-semibold text-navy-soft hover:text-navy lg:min-h-8"
    >
      <LineIcon name="chevronLeft" className="h-4 w-4" />
      {t.detail.back}
    </Link>
  );
}

/**
 * *Join date* — the prototype's *Start date* (P18.96-T2 AC-5, ADR-0169) — which a leader may correct (OD-118): the
 * shared date field, here, written on change and audited by the server, within the contract's bounds — not after
 * the office's today and no more than a year before it. The server moves the membership's join date and the
 * activation's start together. Beside it, who last corrected it and when.
 */
function JoinDateField({
  view, reader, writable, onCommit, status, error, resetKey,
}: {
  view: ActivationView;
  reader: string | null | undefined;
  writable: boolean;
  onCommit: (startDate: string) => void;
  /** Its save confirmation (P18.95-T1 AC-5), under the field where the refusal is. */
  status: InlineSaveStatusProps;
  error: string | null;
  resetKey: number;
}) {
  const a = useMessages(activationMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const corrected = correctionOf(view, reader, language, figures);
  if (!writable) {
    return (
      <dl className="flex items-center gap-2">
        <dt className="whitespace-nowrap text-xs font-semibold text-navy">{a.joinDate}</dt>
        <dd className="flex h-[34px] items-center rounded-md border-[1.5px] border-hairline bg-base px-3 text-base text-navy">
          <time dateTime={view.startDate}>{formatShortDay(view.startDate, { year: true }, figures)}</time>
        </dd>
        {corrected && <dd><AttributionMark words={corrected} /></dd>}
      </dl>
    );
  }
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2">
        <label htmlFor="activation-start-date" className="whitespace-nowrap text-xs font-semibold text-navy">
          {a.joinDate}
        </label>
        <AutoSaveDateField
          id="activation-start-date"
          value={view.startDate}
          min={earliestStart(view.today)}
          max={view.today}
          allowed={(value) => startDateAllowed(value, view.today)}
          invalidText={startDateRangeText(view.today, language, figures)}
          resetKey={resetKey}
          onCommit={(next) => { if (next) onCommit(next); }}
        />
        <AttributionMark words={corrected} />
      </div>
      <InlineSaveStatus {...status} label={a.joinDate} className="mt-1" />
      <RowError message={error ?? undefined} />
    </div>
  );
}

/** How an activation that is over ended, in the subtitle's place (parity L-89): words in `language`, days in `figures`. */
function closedLine(view: ActivationView, reader: string | null | undefined, language: Language, figures: Language): string {
  const t = messagesIn(newHiresMessages, language).detail;
  const you = messagesIn(activationMessages, language).you;
  return view.state === 'graduated'
    ? t.closedGraduated({
      by: view.graduatedBy ? (view.graduatedBy.membershipId === reader ? you : view.graduatedBy.name) : view.hire.name,
      on: view.graduatedAt ? formatOfficeDay(view.graduatedAt, OFFICE_TIME_ZONE, figures) : '',
    })
    : t.closedExpired({ on: formatShortDay(view.endsOn, { year: true }, figures) });
}

/**
 * *Coaching note* (`.notes-card`, `:3407-3414`; OD-117, T6 AC-1): the prototype's heading, hint,
 * example and button, verbatim. One note per hire, replaced on each save; beside the heading, who saved
 * the one there now and when, since any leader above the hire may write it (ADR-0074).
 */
function NoteCard({
  view, reader, writable, onSaved, onMissing,
}: {
  view: ActivationView;
  reader: string | null | undefined;
  writable: boolean;
  onSaved: (note: NonNullable<ActivationView['note']>) => void;
  onMissing: () => void;
}) {
  const t = useMessages(newHiresMessages);
  const a = useMessages(activationMessages);
  const figures = useFigureLanguage();
  const [draft, setDraft] = useState(view.note?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedBy = view.note
    ? t.note.savedBy({
      who: view.note.by.membershipId === reader ? a.you : view.note.by.name,
      when: formatOfficeDay(view.note.at, OFFICE_TIME_ZONE, figures),
    })
    : null;

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      setError(t.note.empty);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { note } = await saveActivationNote(view.hire.membershipId, text);
      onSaved(note);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) onMissing();
      // Read as every other write on these pages reads a refusal (L-85): *Not saved. {why}*.
      setError(a.notSaved({ why: toDisplayError(err).message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="coaching-note" className="rounded-lg border border-card-edge bg-card p-[18px]">
      <div className="flex items-center gap-1.5">
        <h2 id="coaching-note" className="font-display text-md font-bold text-navy">{a.noteHeading}</h2>
        <AttributionMark words={savedBy} />
      </div>
      <p id="coaching-note-hint" className="mb-2.5 mt-1 text-sm text-muted">{t.note.hint}</p>
      <Textarea
        aria-labelledby="coaching-note"
        // Its name while a sheet holds the page behind it (D-26's date sheet): the heading's words, the same name.
        aria-label={a.noteHeading}
        aria-describedby="coaching-note-hint"
        value={draft}
        readOnly={!writable}
        maxLength={ACTIVATION_NOTE_MAX}
        placeholder={t.note.example}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        className="w-full resize-y text-md"
      />
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-alert">{error}</p>}
      {writable && (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? t.note.saving : t.note.save}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Outside the reader's reach, or no activation (T5 AC-8): the same words for each, naming nobody. */
function HireNotFound() {
  const t = useMessages(newHiresMessages);
  return (
    <div>
      <BackToRoster />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{t.detail.notFoundTitle}</h2>
        <p className="mt-1 text-md text-muted">{t.detail.notFoundLine}</p>
      </Card>
    </div>
  );
}
