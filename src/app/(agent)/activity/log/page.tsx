'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ActivityTabs, useActivityTitle } from '@/components/activity-tabs';
import { DateField } from '@/components/ui/date-field';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TermText, TermTip } from '@/components/ui/term-tip';
import { LineIcon } from '@/components/ui/line-icon';
import { SaveStateLabel } from '@/components/ui/save-state';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TAP_AREA } from '@/components/ui/phone';
import { uiMessages } from '@/i18n/messages/ui';
import { Dialog } from '@/components/ui/dialog';
import { Toast, useToast } from '@/components/ui/toast';
import { ColumnFlow } from '@/components/ui/columns';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { formatCalendarDay, formatNumber, formatShortDay, formatWeekday } from '@/lib/format';
import { activityTermMentions, type TermKey } from '@/lib/terms';
import { useSession } from '@/lib/session';
import { shownSections } from '@/lib/summary-tiles';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { usePhone } from '@/lib/use-phone';
import {
  correctActivityDay, readActivityDay, saveActivityDay, type ActivityDay,
} from '@/lib/activity';

/**
 * The daily minute (P6-T2), back to the prototype (P10.1-T5, `Overall.html:2695-2745`).
 *
 * **Driven entirely by the office's own configuration.** The sections are the office's activity
 * categories and the rows are its types, read from the published snapshot the shell already holds.
 * Nothing here is hardcoded — the prototype groups twelve items by hardcoded id ranges, which is
 * why an office that adds a thirteenth has nowhere to put it (OD-63).
 *
 * **The day is the office's day.** The server decides which calendar day an instant falls on, in
 * the office's timezone; this screen never computes one. The prototype builds every date key with
 * `toISOString()`, so an agent logging at 06:30 files against yesterday.
 *
 * **What the prototype has, and two things it needs** (ADR-0062). The *Logged / Missed* standing
 * card, the day-status card and each section's description are gone, at the client's request of
 * 2026-09-29. What stays beyond the prototype is a frozen day's reason field (ADR-0042), the
 * empty-configuration card and the unsaved-counts dialog, each only when it is needed.
 *
 * **On a phone** (P18.7-T5 AC-1, the client's UI review of 2026-10-26, UI-017): the five tiles that filled
 * the first screen are one line, *Today: 3 touches*, and *Save activity* — 2,260px down the page — is in a
 * bar fixed to the bottom of the screen with its *Saved* / *Not yet saved* beside it. At 768px and wider
 * nothing changes (ADR-0167 §12). **At every size the tiles are the sections below them** (AC-2), one each.
 *
 * *Changed 2026-11-04 (P19.1-T1 AC-1, AC-2, ADR-0196; UI-112, UI-113, `activity-tablet-desktop`):* **a tablet and a laptop
 * draw the phone's log in two columns**: the title *Activity*, no sub-line; one control row — the three views, the date
 * pill and *Hari ini: n aktivitas* — where the *Tanggal* field stood with the save status stacked under it; the phone's
 * section cards, each row the name and − n + with the examples behind ⓘ, filled down two columns (`ColumnFlow`); and the
 * phone's save pill, floating above the tab bar on a tablet and standing under the lists on a laptop. The tile strip,
 * the item numbers and the italic notes under each name go with the old layout, as the approved mockup draws it.
 */
export default function LogActivityPage() {
  const t = useMessages(activityMessages).log;
  const title = useActivityTitle();
  const confirmed = useMessages(confirmationMessages);
  const { config, loading: configLoading, error: configError } = useTenantConfig();
  const { me } = useSession();
  const phone = usePhone();
  const [day, setDay] = useState<ActivityDay | null>(null);
  const [date, setDate] = useState<string>('');
  /** The office's today: the day the first read, which names no date, answered with. */
  const [today, setToday] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /** The date a pending confirmation would move to, or `null` when nothing is pending. */
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  /** *Activity logged ✓* once a save lands (P18.7-T1 AC-6); the shell's toast, beneath its chrome. */
  const { toast, show } = useToast();

  const load = useCallback(async (on?: string) => {
    setError(null);
    try {
      const next = await readActivityDay(on ? { date: on } : {});
      setDay(next);
      setDate(next.localDate);
      if (!on) setToday(next.localDate);
      setCounts(Object.fromEntries(next.entries.map((e) => [e.activityTypeCode, e.count])));
      setDirty(false);
      setReason('');
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * Changing the date would discard unsaved edits, so it asks first.
   *
   * The prototype does not: it silently drops whatever was typed when the date or the sub-tab
   * changes (`activity-management.md` §4). Losing a day's typing without warning is a defect
   * rather than a design, and the divergence is registered.
   *
   * **It asks in the product's own dialog**, not `window.confirm`. The prototype built a modal for
   * exactly this and we had reached for the browser's, whose buttons say OK and Cancel whatever the
   * question was — and which arrives on a phone as a system sheet over the app.
   */
  function goTo(next: string) {
    if (dirty) {
      setConfirmDate(next);
      return;
    }
    void load(next);
  }

  /**
   * Save the day, or correct a closed one. **Either is the log's whole-form save**, so either says
   * *Activity logged ✓* when it lands (P18.7-T1 AC-6), beside the *Saved · {n} touches* it has always
   * shown under the date; a refusal toasts nothing and stays in the banner.
   */
  async function run(action: () => Promise<ActivityDay>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setDay(next);
      setCounts(Object.fromEntries(next.entries.map((e) => [e.activityTypeCode, e.count])));
      setDirty(false);
      setReason('');
      show(confirmed.activityLogged);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (configLoading || (day === null && error === null)) {
    return (
      <Page title={title} subtitle={t.subtitle} subtitleOnPhone={false}>
        <ActivityTabs />
        <SkeletonCards count={3} label={t.loading} />
      </Page>
    );
  }

  const frozen = day !== null && !day.editable && !isFuture(date, day.localDate);
  const total = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  /*
   * **Only the sections this reader's rung is shown** (ADR-0020, P4-T18).
   *
   * `tenant-config.md` states the contract: every member receives the same rows and the same
   * rule, and *"the client hides what does not apply to the reader"*. The snapshot is identical
   * for everybody in the office, so the hiding has to happen here. An empty list means every
   * rung — that is the seeded state, so most offices see no difference.
   *
   * The Phase 6 exit review found this screen ignoring the rule: an office that had narrowed a
   * section still showed it to everybody, and the server accepted the counts. The server refuses
   * them now, which is why this is a hidden row rather than the only defence.
   */
  const rung = me?.membership?.orgLevelCode ?? '';
  const categories = config?.activity ?? [];
  /** The configuration's read failed and there is none to draw from (P18.7-T5 AC-3): its error, not *not set up*. */
  const configFailed = configError !== null && config === null;
  /*
   * **One list for the cards** (P18.7-T5 AC-2; UI-017), in its order — and, until P19.1-T1, for the strip of tiles above
   * them from 768px, which the 2 November layout does not draw.
   */
  const sections = shownSections(categories, rung);
  /*
   * **The loaded day's own entry decides the status**, as the prototype's `refreshSaveStatus` reads
   * `savedEntries[date]` (`:4937-4958`). It was a message set by Save and never cleared, so a saved
   * day opened as *Not yet saved* and one save's message followed the reader to the next date. A day
   * has an entry once it has a version; its total is the saved one, not what is being typed.
   */
  const savedTotal = day !== null && day.version > 0 ? day.totalCount : null;
  const corrections = day?.correctionCount ?? 0;
  /*
   * **A closed day that was never logged has nothing to correct.** The API refuses a correction with
   * no entry behind it and refuses a save after the window, so such a day is shown and nothing is
   * offered: no reason field, no save, the counts read-only (ADR-0062 §1 — an action the API refuses is
   * not offered). Found walking P10.1-T5, 2026-10-01; the screen had offered it since Phase 6.
   */
  const unloggedAndClosed = frozen && savedTotal === null;
  /** The buttons are drawn: on a phone, in the bar fixed to the bottom of the screen (AC-1). */
  const saving = sections.length > 0 && !unloggedAndClosed;
  /*
   * **Which activity first names each term**, in reading order — every section's types, each label then its note
   * (P18.7-T9 AC-3; UI-028: *NPA*, *JFW*, *BOP* unexplained). *Touch* has its own ⓘ above the cards.
   */
  const termsIn = activityTermMentions(sections);
  /** A closed day's reason field, below the cards: then it is the last thing above the bar. */
  const reasonShown = sections.length > 0 && frozen && !unloggedAndClosed;
  /**
   * Room under whatever is last above the floating bar on a phone and a tablet, so its last line is never behind it
   * (`FLOATING_BAR_ROOM`, below 1024px). From 1024px the bar stands in the page and needs none.
   */
  const roomUnderCards = saving && !reasonShown;

  /*
   * **On a phone, UI V1's log** (UI-106, D-03): the segmented views, the date pill with the day's saved count beside it,
   * each section a card of rows — the name on the left, at most two lines, and − n + on the right of the same row — and
   * the save bar held just above the tab bar. From 768px, the screen as it was (UI-106's scope is the phone).
   */
  const unsaved = dirty || savedTotal === null;
  const added = Math.max(0, total - (savedTotal ?? 0));
  const barState = busy ? 'saving' as const : unsaved ? 'unsaved' as const : 'saved' as const;
  /** *Batal* and the save, in the floating bar at every size (P19.1-T1 AC-2): its pill's two buttons. */
  const barActions = (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void load(date)}
        className="min-h-11 shrink-0 rounded-pill border-0 bg-pill-grey px-3.5 text-pill-grey-ink"
      >
        {t.cancel}
      </Button>
      {frozen ? (
        <Button
          disabled={busy || !reason.trim()}
          onClick={() => void run(
            () => correctActivityDay({ date, counts, reason: reason.trim() }),
          )}
          className={SAVE_ON_PHONE}
        >
          {busy ? t.saving : t.saveCorrection}
        </Button>
      ) : (
        <Button
          disabled={busy}
          onClick={() => void run(() => saveActivityDay({ date, counts }))}
          className={SAVE_ON_PHONE}
        >
          {busy ? t.saving : t.saveActivity}
        </Button>
      )}
    </>
  );

  /** The section cards, the phone's (UI-106), in the one list every size draws; `className` from 768px (P19.1-T1). */
  const sectionCards = (className?: string) => sections.map((section) => {
    const types = section.types.filter((ty) => ty.status === 'active');
    const mentions = termsIn.get(section.code);
    return (
      <PhoneSection
        key={section.code}
        className={className}
        title={section.label}
        count={t.items({ n: types.length })}
        rows={types.map((type) => ({
          code: type.code,
          label: type.label,
          description: type.description,
          terms: mentions?.get(`${type.code}:label`) ?? [],
          value: counts[type.code] ?? 0,
          saved: day?.entries.find((e) => e.activityTypeCode === type.code)?.count ?? 0,
        }))}
        disabled={busy || unloggedAndClosed}
        onChange={(code, next) => {
          setCounts({ ...counts, [code]: next });
          setDirty(true);
        }}
      />
    );
  });

  return (
    <Page
      title={title}
      subtitle={t.subtitle}
      // The client's *Remove* on a phone, as every reviewed sub-line (P18.7-T7 AC-1, grey text row 25); from 768px the
      // field shell draws none (P19.1-T1 AC-1).
      subtitleOnPhone={false}
    >
      {/*
        * **From 768px, one control row** (P19.1-T1 AC-1; UI-112, `activity-tablet-desktop`): the three views, the date
        * pill and *Hari ini: n aktivitas* — no *Tanggal* label, and the save state in the bar, not stacked under the date.
        * On a phone the views, then the date pill's own row below, as UI-106 draws them.
        */}
      {phone ? <ActivityTabs /> : (
        <div data-control-row="" className="mb-1 flex flex-wrap items-center gap-2">
          <ActivityTabs />
          <DayPill date={date} today={today} onChange={goTo} />
          {sections.length > 0 && <DayCount date={date} today={today} savedTotal={savedTotal} />}
        </div>
      )}
      {error && <ErrorBanner {...error} />}
      {/*
        * **A configuration that did not arrive says so** (P18.7-T5 AC-3). It read as an office with nothing set
        * up — *Ask your KPM Owner* — which sent the reader to the wrong person about a request that failed.
        */}
      {configFailed && <ErrorBanner {...toDisplayError(configError)} />}

      {/*
        * **On a phone, the date pill and the day's count on one line** (UI-106): *‹ Jum, 30 Okt ›*, the › held on the
        * office's today, and *Hari ini: n aktivitas ⓘ* — the day as saved, so the unsaved taps are the bar's to count.
        * Another day is named rather than called *today*.
        */}
      {phone && (
        <div className="mb-0.5 mt-2.5 flex items-center gap-2">
          <DayPill date={date} today={today} onChange={goTo} />
          {sections.length > 0 && <DayCount date={date} today={today} savedTotal={savedTotal} />}
        </div>
      )}

      {sections.length === 0 && !configFailed && (
        <Card>
          <p className="text-md text-navy">{t.notSetUp}</p>
        </Card>
      )}

      {phone ? (
        <div className={cn(roomUnderCards && FLOATING_BAR_ROOM)}>
          {sectionCards()}
        </div>
      ) : (
        /*
         * **Two columns from 768px, the phone's cards in them** (P19.1-T1 AC-2; UI-113, `activity-tablet-desktop`): down
         * the first column, then the second, each card whole (`ColumnFlow`), so the five groups read *Leads Generation,
         * Selling | Recruitment, Personal Development, Team Development* — the whole day on one screen, which is what *in
         * 1 minute* depends on.
         */
        <ColumnFlow className={cn('mt-3', roomUnderCards && FLOATING_BAR_ROOM)}>
          {sectionCards('mt-0')}
        </ColumnFlow>
      )}

      {/*
        * **A frozen day's one addition: the reason, as a bare field** (ADR-0042, ADR-0062 §2). The API
        * refuses a correction without one, so the field is the requirement; the card that held it and
        * the day-status card above the form were not. Its hint is the one place the screen says the
        * day is closed, and how often it has been corrected — a corrected record says so.
        */}
      {sections.length > 0 && unloggedAndClosed && (
        <p role="status" className="mb-4 mt-3 text-sm text-muted">{t.closedNothing}</p>
      )}
      {reasonShown && (
        <Field
          label={t.why}
          htmlFor="correction-reason"
          hint={corrections > 0 ? t.closedCorrected({ n: corrections }) : t.closed}
          className={cn('mb-4 max-w-xl max-md:mt-4', FLOATING_BAR_ROOM)}
        >
          {/* Required, and capped where the API caps it (`activity.dto.ts`, 500), so a reason is never
              refused far from the field a phone user is looking at. */}
          <TextInput
            id="correction-reason"
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      )}

      {/*
        * **Outside any card and right-aligned**, as `.actions` has it (`:2740-2743`, CSS `:157`).
        * Inside a card the save button read as one more field of the last group; out here it belongs
        * to the page, which is what it saves.
        *
        * **On a phone, the save bar held just above the tab bar at every scroll position** (UI-106, D-03): *Belum
        * disimpan · n aktivitas baru* or *Tersimpan ✓* on the left, *Batal*, and the accent's *Simpan aktivitas* — its
        * words navy on the accent (I-542). **In Goal Setting's pill** (`FloatingBar`; the product owner's staging review,
        * 2026-10-31), not the full-width strip it was. The floating bar lifts the shell's toast above it (`toast.tsx`), so
        * *Activity logged ✓* never covers the button it confirms. `data-action-bar` names the row at every width.
        *
        * *Changed 2026-11-04 (P19.1-T1 AC-2; UI-113, `activity-tablet-desktop`: *save bar always visible*):* **the same pill
        * at every size** — floating above the tab bar on a tablet, as on a phone, and standing under the lists from 1024px
        * (`wide="pill"`). It was a row of two buttons from 768px, the save state stacked under the date.
        */}
      {saving && (
        <FloatingBar data-action-bar="" wide="pill" pillClassName="gap-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <SaveStateLabel state={barState} />
            {barState === 'unsaved' && added > 0 && <span className="text-sm text-muted">{t.newCount({ n: added })}</span>}
          </span>
          {barActions}
        </FloatingBar>
      )}

      <Dialog
        open={confirmDate !== null}
        message={t.unsaved}
        confirmLabel={t.discard}
        tone="danger"
        onConfirm={() => {
          const next = confirmDate!;
          setConfirmDate(null);
          void load(next);
        }}
        onCancel={() => setConfirmDate(null)}
      />
      <Toast toast={toast} />
    </Page>
  );
}

/** A day after the one the server answered with cannot have happened yet. */
function isFuture(chosen: string, serverDay: string): boolean {
  return chosen > serverDay;
}

/**
 * *Simpan aktivitas* on a phone (UI-106): the floating bar's accent button, 44px, its words navy on it (parity I-542) —
 * 16px either side rather than 20px, as it shares the pill with *Batal*.
 */
const SAVE_ON_PHONE = cn(FLOATING_BAR_BUTTON, 'px-4');

/** A calendar day moved by whole days, `YYYY-MM-DD` to `YYYY-MM-DD`: arithmetic on the date, never on an instant. */
function addDays(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + by));
  return at.toISOString().slice(0, 10);
}

/**
 * **UI-106's date pill**: *‹ Jum, 30 Okt ›*. The arrows step a day back or forward — **the › held on the office's today**,
 * since a later day cannot be logged — and the day between them opens the device's own picker (`DateField`), never
 * later than today. Each arrow a 44px target around its 32px glyph.
 */
function DayPill({ date, today, onChange }: { date: string; today: string | null; onChange: (day: string) => void }) {
  const t = useMessages(activityMessages).log;
  const atToday = today !== null && date >= today;
  const ARROW = cn('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-pill-grey-ink', TAP_AREA,
    'hover:bg-hover-row disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent');
  return (
    <div data-day-pill="" className="flex h-10 shrink-0 items-center gap-1 rounded-pill bg-card px-1">
      <button type="button" aria-label={t.previousDay} onClick={() => onChange(addDays(date, -1))} className={ARROW}>
        <LineIcon name="chevronLeft" className="h-[18px] w-[18px]" />
      </button>
      <DateField
        aria-label={t.chooseDay}
        value={date}
        max={today ?? undefined}
        onChange={(day) => { if (day) onChange(day); }}
        density="text"
        glyph="none"
        format={(day, language) => `${formatWeekday(day, language)}, ${formatShortDay(day, {}, language)}`}
        faceClassName="text-md font-bold text-navy no-underline max-md:text-md"
        className="min-w-0"
      />
      <button
        type="button"
        aria-label={t.nextDay}
        disabled={atToday}
        onClick={() => onChange(addDays(date, 1))}
        className={ARROW}
      >
        <LineIcon name="chevronRight" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

/**
 * **The day's saved count beside the date pill** (UI-106): *Hari ini: n aktivitas ⓘ* — the day as saved, so the unsaved
 * taps are the bar's to count; another day is named rather than called *today*. On a phone its own row under the views;
 * from 768px the end of the control row (P19.1-T1 AC-1).
 */
function DayCount({ date, today, savedTotal }: { date: string; today: string | null; savedTotal: number | null }) {
  const t = useMessages(activityMessages).log;
  const figures = useFigureLanguage();
  return (
    <p className="ml-auto flex min-w-0 items-center gap-1 text-base text-muted">
      <span className="min-w-0">
        {t.dayLine({
          day: date === today ? t.today : formatCalendarDay(date, figures),
          count: <strong className="font-semibold text-ink">{formatNumber(savedTotal ?? 0, {}, figures)}</strong>,
          n: savedTotal ?? 0,
        })}
      </span>
      <TermTip term="TOUCHES" />
    </p>
  );
}

/** One activity type's row on a phone: its words, its term, its examples, and its count as typed and as saved. */
interface PhoneRow {
  code: string;
  label: string;
  description: string | null;
  terms: readonly TermKey[];
  value: number;
  saved: number;
}

/**
 * **A section on a phone** (UI-106; D-03 as the owner revised it, *less white space*): a white card, its head the
 * section's name and *n item*, then a row per activity — the name on the left, 13px, **two lines at most**, with the
 * office's examples behind an ⓘ and a term's own ⓘ (*Proses NPA*); **− n + on the right of the same row**. No item
 * numbers. Each row 44px tall at least.
 */
function PhoneSection({
  title, count, rows, disabled, onChange, className,
}: {
  /** From 768px the column's own gap stands in for the phone's 8px above (`ColumnFlow`). */
  className?: string;
  title: string;
  count: string;
  rows: readonly PhoneRow[];
  disabled: boolean;
  onChange: (code: string, next: number) => void;
}) {
  return (
    <section data-phone-section="" className={cn('mt-2 overflow-hidden rounded-lg bg-card', className)}>
      <div className="flex items-center justify-between gap-2 bg-hover-row px-3 py-[7px]">
        <h2 className="min-w-0 font-body text-base font-bold text-navy">{title}</h2>
        <span className="shrink-0 text-xs font-semibold text-muted">{count}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.code} className="flex min-h-11 items-center gap-1.5 border-t border-divider py-1 pl-3 pr-1.5 first:border-t-0">
            <span className="flex min-w-0 flex-1 items-center gap-0.5">
              <span data-activity-name="" className="line-clamp-2 min-w-0 text-base leading-tight text-ink">
                <TermText text={row.label} terms={row.terms} />
              </span>
              {row.description && (
                <TippedGlyph glyph="ⓘ" name={row.description} tip={row.description} align="fit" className="shrink-0" />
              )}
            </span>
            <PhoneCounter
              label={row.label}
              value={row.value}
              changed={row.value !== row.saved}
              disabled={disabled}
              onChange={(next) => onChange(row.code, next)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * **− n +** on a phone (UI-106): two 32px circles, each a 44px target (`TAP_AREA`), and the count between them — a
 * number field still, so a reader can type 15 rather than press 15 times, 0 to 999 as the API clamps it. The count in
 * the accent's ink while it differs from the saved day, grey at nothing. Named as `Stepper` names its three.
 */
function PhoneCounter({
  label, value, changed, disabled, onChange,
}: {
  label: string;
  value: number;
  changed: boolean;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const t = useMessages(uiMessages).stepper;
  const set = (n: number) => onChange(Math.max(0, Math.min(999, Number.isFinite(n) ? Math.trunc(n) : 0)));
  const CIRCLE = cn('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TAP_AREA,
    'disabled:cursor-not-allowed disabled:opacity-40');
  return (
    <div role="group" aria-label={label} data-phone-counter="" className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={t.decrease({ label })}
        disabled={disabled || value <= 0}
        onClick={() => set(value - 1)}
        className={cn(CIRCLE, 'bg-pill-grey text-pill-grey-ink')}
      >
        <LineIcon name="minus" className="h-[18px] w-[18px]" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={t.count({ label })}
        value={value}
        min={0}
        max={999}
        disabled={disabled}
        onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
        onWheel={(e) => e.currentTarget.blur()}
        className={cn(
          'w-8 bg-transparent text-center font-bold tabular-nums [appearance:textfield] focus:outline-none',
          'focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-focus-ring',
          '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          value === 0 ? 'text-signal-grey' : changed ? 'text-primary-ink' : 'text-ink',
        )}
      />
      <button
        type="button"
        aria-label={t.increase({ label })}
        disabled={disabled || value >= 999}
        onClick={() => set(value + 1)}
        className={cn(CIRCLE, 'bg-primary/[0.12] text-primary-ink')}
      >
        <LineIcon name="plus" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
