'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ActivityTabs, useActivityTitle } from '@/components/activity-tabs';
import { SummaryStrip } from '@/components/summary-strip';
import { DateField } from '@/components/ui/date-field';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { ConfigBadge } from '@/components/ui/config-badge';
import { TermText, TermTip } from '@/components/ui/term-tip';
import { LineIcon } from '@/components/ui/line-icon';
import { SaveStateLabel } from '@/components/ui/save-state';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TAP_AREA } from '@/components/ui/phone';
import { uiMessages } from '@/i18n/messages/ui';
import { Dialog } from '@/components/ui/dialog';
import { NumberBadge } from '@/components/ui/number-badge';
import { SaveStatus } from '@/components/ui/save-status';
import { SectionCard } from '@/components/ui/section-card';
import { Stepper } from '@/components/ui/stepper';
import { Toast, useToast } from '@/components/ui/toast';
import { ACTION_BAR_ROOM_PHONE } from '@/components/ui/phone';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { formatCalendarDay, formatNumber, formatShortDay, formatWeekday } from '@/lib/format';
import { activityTermMentions, type TermKey } from '@/lib/terms';
import { useSession } from '@/lib/session';
import { sectionTiles, shownSections } from '@/lib/summary-tiles';
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
 * **On a phone** (P18.95-T5 AC-1, the client's UI review of 2026-10-26, UI-017): the five tiles that filled
 * the first screen are one line, *Today: 3 touches*, and *Save activity* — 2,260px down the page — is in a
 * bar fixed to the bottom of the screen with its *Saved* / *Not yet saved* beside it. At 768px and wider
 * nothing changes (ADR-0167 §12). **At every size the tiles are the sections below them** (AC-2), one each.
 */
export default function LogActivityPage() {
  const t = useMessages(activityMessages).log;
  const title = useActivityTitle();
  const confirmed = useMessages(confirmationMessages);
  const figures = useFigureLanguage();
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
  /** *Activity logged ✓* once a save lands (P18.95-T1 AC-6); the shell's toast, beneath its chrome. */
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
   * *Activity logged ✓* when it lands (P18.95-T1 AC-6), beside the *Saved · {n} touches* it has always
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
  /** The configuration's read failed and there is none to draw from (P18.95-T5 AC-3): its error, not *not set up*. */
  const configFailed = configError !== null && config === null;
  /*
   * **One list for the cards and the tiles** (P18.95-T5 AC-2; UI-017). The strip counted the office's
   * *Summary tiles* (ADR-0064), so the seed's Personal and Team Development were one *Development* tile over
   * two cards: four tiles, five groups. Now both are drawn from this list, in its order.
   */
  const sections = shownSections(categories, rung);
  const sectionTotal = (section: (typeof categories)[number]) => section.types
    .filter((ty) => ty.status === 'active')
    .reduce((sum, ty) => sum + (Number(counts[ty.code]) || 0), 0);
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
   * **One save status, where the reader is looking** (AC-1): under the date, as the prototype stacks them, and
   * on a phone in the bar, beside the button it answers for. Never both: it is the screen's live region.
   */
  const saveStatus = savedTotal !== null ? (
    <SaveStatus state="saved">{t.saved({ n: savedTotal })}</SaveStatus>
  ) : (
    <SaveStatus state="unsaved">{t.notSaved}</SaveStatus>
  );
  /*
   * **Which activity first names each term**, in reading order — every section's types, each label then its note
   * (P18.95-T9 AC-3; UI-028: *NPA*, *JFW*, *BOP* unexplained). *Touch* has its own ⓘ above the cards.
   */
  const termsIn = activityTermMentions(sections);
  /** A closed day's reason field, below the cards: then it is the last thing above the bar. */
  const reasonShown = sections.length > 0 && frozen && !unloggedAndClosed;
  /** Room under whatever is last above the bar, so its last line is never behind it (`ACTION_BAR_ROOM_PHONE`). */
  const roomUnderCards = saving && !reasonShown;

  /*
   * **On a phone, UI V1's log** (UI-106, D-03): the segmented views, the date pill with the day's saved count beside it,
   * each section a card of rows — the name on the left, at most two lines, and − n + on the right of the same row — and
   * the save bar held just above the tab bar. From 768px, the screen as it was (UI-106's scope is the phone).
   */
  const unsaved = dirty || savedTotal === null;
  const added = Math.max(0, total - (savedTotal ?? 0));
  const barState = busy ? 'saving' as const : unsaved ? 'unsaved' as const : 'saved' as const;

  return (
    <Page
      title={title}
      subtitle={t.subtitle}
      // The client's *Remove* on a phone, as every reviewed sub-line (P18.95-T7 AC-1, grey text row 25).
      subtitleOnPhone={false}
      actions={phone ? undefined : (
        /*
         * The date sits in the topbar beside the title, with the save status under it, as the
         * prototype's `.date-field` stacks them (`:2700-2704`, CSS `:91`) — it is what the whole
         * screen is about, not one field of the form. On a phone it is the date pill below the views (UI-106).
         */
        <div className="flex flex-col gap-1.5">
          <Field label={t.date} htmlFor="activity-date" className="w-44">
            {/* The shared date field (P18.96-T2 AC-4): the day as the app writes it, the device's picker to choose. */}
            <DateField id="activity-date" value={date} onChange={goTo} />
          </Field>
          {saveStatus}
        </div>
      )}
    >
      <ActivityTabs />
      {error && <ErrorBanner {...error} />}
      {/*
        * **A configuration that did not arrive says so** (P18.95-T5 AC-3). It read as an office with nothing set
        * up — *Ask your KPM Owner* — which sent the reader to the wrong person about a request that failed.
        */}
      {configFailed && <ErrorBanner {...toDisplayError(configError)} />}

      {/* A tile per section, then the total (`:2720-2726`; P18.95-T5 AC-2). Not on a phone: the date row below. */}
      {sections.length > 0 && !phone && (
        <SummaryStrip
          className="max-md:hidden"
          tiles={sectionTiles(sections, sectionTotal, {
            label: t.totalToday,
            value: total,
            // What an activity counts, once (P18.95-T9 AC-3; UI-028): the strip is where the word first shows.
            term: 'TOUCHES',
          })}
        />
      )}

      {/*
        * **On a phone, the date pill and the day's count on one line** (UI-106): *‹ Jum, 30 Okt ›*, the › held on the
        * office's today, and *Hari ini: n aktivitas ⓘ* — the day as saved, so the unsaved taps are the bar's to count.
        * Another day is named rather than called *today*.
        */}
      {phone && (
        <div className="mb-0.5 mt-2.5 flex items-center gap-2">
          <DayPill date={date} today={today} onChange={goTo} />
          {sections.length > 0 && (
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
          )}
        </div>
      )}

      {sections.length === 0 && !configFailed && (
        <Card>
          <p className="text-md text-navy">{t.notSetUp}</p>
        </Card>
      )}

      {phone ? (
        <div className={cn(saving && !reasonShown && 'pb-20')}>
          {sections.map((section) => {
            const types = section.types.filter((ty) => ty.status === 'active');
            const mentions = termsIn.get(section.code);
            return (
              <PhoneSection
                key={section.code}
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
          })}
        </div>
      ) : (
        /*
         * **Two columns, as the prototype has them** (`.categories`, `:112`). One card per category
         * stacked full-width put three activities on a screen; side by side a reader sees the whole
         * day at once, which is what "in 1 minute" depends on.
         */
        <div className={cn('mb-5 grid items-start gap-4 lg:grid-cols-2', roomUnderCards && ACTION_BAR_ROOM_PHONE)}>
          {sections.map((section) => {
            const types = section.types.filter((ty) => ty.status === 'active');
            const mentions = termsIn.get(section.code);
            return (
              <SectionCard
                key={section.code}
                title={section.label}
                meta={
                  <ConfigBadge tone="navy" className="normal-case tracking-normal">
                    {t.items({ n: types.length })}
                  </ConfigBadge>
                }
              >
                {types.map((type) => (
                  <SectionCard.Row
                    key={type.code}
                    control={
                      <Stepper
                        value={counts[type.code] ?? 0}
                        label={type.label}
                        max={999}
                        disabled={busy || unloggedAndClosed}
                        onChange={(next) => {
                          setCounts({ ...counts, [type.code]: next });
                          setDirty(true);
                        }}
                      />
                    }
                  >
                    <NumberBadge n={type.displayOrder} />
                    <span className="min-w-0">
                      {/* An ⓘ after a term the office's words use (*Proses NPA*), the first time on the screen (AC-3). */}
                      <span className="block text-md text-navy">
                        <TermText text={type.label} terms={mentions?.get(`${type.code}:label`) ?? []} />
                      </span>
                      {/*
                        * The italic sub-note the prototype pulls out of the label's trailing
                        * parenthetical (`splitLabel`, `:4778`). Ours is a field the office fills in, so
                        * there is nothing to parse — and nothing was rendering it.
                        */}
                      {type.description && (
                        <span className="mt-0.5 block text-xs italic text-muted">
                          <TermText text={type.description} terms={mentions?.get(`${type.code}:description`) ?? []} />
                        </span>
                      )}
                    </span>
                  </SectionCard.Row>
                ))}
              </SectionCard>
            );
          })}
        </div>
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
          className={cn('mb-4 max-w-xl max-md:mt-4', phone ? 'pb-20' : ACTION_BAR_ROOM_PHONE)}
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
        * words navy on the accent (I-542). `data-action-bar` lifts the shell's toast above it (`toast.tsx`), so
        * *Activity logged ✓* never covers the button it confirms.
        */}
      {saving && (
        <div
          data-action-bar=""
          className={cn(
            'flex flex-wrap items-center justify-end gap-2.5',
            phone && 'fixed inset-x-0 bottom-[max(calc(var(--tab-bar-space)+0.25rem),env(safe-area-inset-bottom))] z-[9] '
              + 'flex-nowrap border-t border-line bg-card px-4 py-2.5',
          )}
        >
          {phone && (
            <span className="mr-auto flex min-w-0 flex-col">
              <SaveStateLabel state={barState} />
              {barState === 'unsaved' && added > 0 && <span className="text-sm text-muted">{t.newCount({ n: added })}</span>}
            </span>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void load(date)}
            className={cn(phone && 'min-h-11 rounded-pill border-0 bg-pill-grey px-3.5 text-pill-grey-ink')}
          >
            {t.cancel}
          </Button>
          {frozen ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => void run(
                () => correctActivityDay({ date, counts, reason: reason.trim() }),
              )}
              className={cn(phone && SAVE_ON_PHONE)}
            >
              {busy ? t.saving : t.saveCorrection}
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => void run(() => saveActivityDay({ date, counts }))}
              className={cn(phone && SAVE_ON_PHONE)}
            >
              {busy ? t.saving : t.saveActivity}
            </Button>
          )}
        </div>
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

/** *Simpan aktivitas* on a phone (UI-106): the accent, 44px, its words navy on it (parity I-542). */
const SAVE_ON_PHONE = 'min-h-11 rounded-pill bg-amber px-4 font-bold text-navy hover:bg-amber-dark';

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
  title, count, rows, disabled, onChange,
}: {
  title: string;
  count: string;
  rows: readonly PhoneRow[];
  disabled: boolean;
  onChange: (code: string, next: number) => void;
}) {
  return (
    <section data-phone-section="" className="mt-2 overflow-hidden rounded-lg bg-card">
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
          'focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-amber',
          '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          value === 0 ? 'text-signal-grey' : changed ? 'text-amber-ink' : 'text-ink',
        )}
      />
      <button
        type="button"
        aria-label={t.increase({ label })}
        disabled={disabled || value >= 999}
        onClick={() => set(value + 1)}
        className={cn(CIRCLE, 'bg-amber/[0.12] text-amber-ink')}
      >
        <LineIcon name="plus" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
