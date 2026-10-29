'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ACTIVITY_TITLE, ActivityTabs } from '@/components/activity-tabs';
import { SummaryStrip } from '@/components/summary-strip';
import { DateField } from '@/components/ui/date-field';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { ConfigBadge } from '@/components/ui/config-badge';
import { TermText, TermTip } from '@/components/ui/term-tip';
import { Dialog } from '@/components/ui/dialog';
import { NumberBadge } from '@/components/ui/number-badge';
import { SaveStatus } from '@/components/ui/save-status';
import { SectionCard } from '@/components/ui/section-card';
import { Stepper } from '@/components/ui/stepper';
import { Toast, useToast } from '@/components/ui/toast';
import { ACTION_BAR_PHONE, ACTION_BAR_ROOM_PHONE } from '@/components/ui/phone';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { formatCalendarDay, formatNumber } from '@/lib/format';
import { activityTermMentions } from '@/lib/terms';
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
      <Page title={ACTIVITY_TITLE} subtitle={t.subtitle} subtitleOnPhone={false}>
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
  const statusInBar = phone && saving;
  /*
   * **Which activity first names each term**, in reading order — every section's types, each label then its note
   * (P18.95-T9 AC-3; UI-028: *NPA*, *JFW*, *BOP* unexplained). *Touch* has its own ⓘ above the cards.
   */
  const termsIn = activityTermMentions(sections);
  /** A closed day's reason field, below the cards: then it is the last thing above the bar. */
  const reasonShown = sections.length > 0 && frozen && !unloggedAndClosed;
  /** Room under whatever is last above the bar, so its last line is never behind it (`ACTION_BAR_ROOM_PHONE`). */
  const roomUnderCards = saving && !reasonShown;

  return (
    <Page
      title={ACTIVITY_TITLE}
      subtitle={t.subtitle}
      // The client's *Remove* on a phone, as every reviewed sub-line (P18.95-T7 AC-1, grey text row 25).
      subtitleOnPhone={false}
      actions={
        /*
         * The date sits in the topbar beside the title, with the save status under it, as the
         * prototype's `.date-field` stacks them (`:2700-2704`, CSS `:91`) — it is what the whole
         * screen is about, not one field of the form.
         */
        <div className="flex flex-col gap-1.5">
          <Field label={t.date} htmlFor="activity-date" className="w-44">
            {/* The shared date field (P18.96-T2 AC-4): the day as the app writes it, the device's picker to choose. */}
            <DateField id="activity-date" value={date} onChange={goTo} />
          </Field>
          {!statusInBar && saveStatus}
        </div>
      }
    >
      <ActivityTabs />
      {error && <ErrorBanner {...error} />}
      {/*
        * **A configuration that did not arrive says so** (P18.95-T5 AC-3). It read as an office with nothing set
        * up — *Ask your KPM Owner* — which sent the reader to the wrong person about a request that failed.
        */}
      {configFailed && <ErrorBanner {...toDisplayError(configError)} />}

      {/* A tile per section, then the total (`:2720-2726`; P18.95-T5 AC-2). Not on a phone: the line below. */}
      {sections.length > 0 && (
        <SummaryStrip
          className="max-md:hidden"
          tiles={sectionTiles(sections, sectionTotal, {
            label: t.totalToday,
            value: total,
            // What a touch is, once (P18.95-T9 AC-3; UI-028): the strip is where the word first shows.
            term: 'TOUCHES',
          })}
        />
      )}
      {/*
        * **On a phone, one line** (AC-1; UI-017): the total the tiles add up to, where five tiles filled the first
        * screen. *Today* is the office's day; another date is named, since the line would otherwise say *today*
        * about a day that is not.
        */}
      {sections.length > 0 && (
        <p className="mb-4 text-md text-navy md:hidden">
          {t.dayLine({
            day: date === today ? t.today : formatCalendarDay(date, figures),
            count: <strong className="font-bold">{formatNumber(total, {}, figures)}</strong>,
            n: total,
          })}{' '}
          {/* Below 768px this line stands where the strip is, so the word's ⓘ is here (P18.95-T9 AC-3). */}
          <TermTip term="TOUCHES" />
        </p>
      )}

      {sections.length === 0 && !configFailed && (
        <Card>
          <p className="text-md text-navy">{t.notSetUp}</p>
        </Card>
      )}

      {/*
        * **Two columns, as the prototype has them** (`.categories`, `:112`). One card per category
        * stacked full-width put three activities on a screen; side by side a reader sees the whole
        * day at once, which is what "in 1 minute" depends on.
        */}
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

      {/*
        * **A frozen day's one addition: the reason, as a bare field** (ADR-0042, ADR-0062 §2). The API
        * refuses a correction without one, so the field is the requirement; the card that held it and
        * the day-status card above the form were not. Its hint is the one place the screen says the
        * day is closed, and how often it has been corrected — a corrected record says so.
        */}
      {sections.length > 0 && unloggedAndClosed && (
        <p role="status" className="mb-4 text-sm text-muted">{t.closedNothing}</p>
      )}
      {reasonShown && (
        <Field
          label={t.why}
          htmlFor="correction-reason"
          hint={corrections > 0 ? t.closedCorrected({ n: corrections }) : t.closed}
          className={cn('mb-4 max-w-xl', ACTION_BAR_ROOM_PHONE)}
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
        */}
      {/*
        * **On a phone, a bar fixed to the bottom of the screen** (AC-1, `ACTION_BAR_PHONE`): the save status, then
        * Cancel and the save, on one line. `data-action-bar` lifts the shell's toast above it (`toast.tsx`), so
        * *Activity logged ✓* never covers the button it confirms.
        */}
      {saving && (
        <div
          data-action-bar=""
          className={cn('flex flex-wrap items-center justify-end gap-2.5', ACTION_BAR_PHONE, 'max-md:flex-nowrap')}
        >
          {statusInBar && <span className="mr-auto min-w-0">{saveStatus}</span>}
          <Button variant="secondary" disabled={busy} onClick={() => void load(date)}>
            {t.cancel}
          </Button>
          {frozen ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => void run(
                () => correctActivityDay({ date, counts, reason: reason.trim() }),
              )}
            >
              {busy ? t.saving : t.saveCorrection}
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => void run(() => saveActivityDay({ date, counts }))}
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
