'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ActivityTabs } from '@/components/activity-tabs';
import { SummaryStrip } from '@/components/summary-strip';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Dialog } from '@/components/ui/dialog';
import { NumberBadge } from '@/components/ui/number-badge';
import { SaveStatus } from '@/components/ui/save-status';
import { SectionCard } from '@/components/ui/section-card';
import { Stepper } from '@/components/ui/stepper';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { isShownTo, summaryTiles } from '@/lib/summary-tiles';
import { useTenantConfig } from '@/lib/tenant-config-cache';
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
 */
export default function LogActivityPage() {
  const { config, loading: configLoading } = useTenantConfig();
  const { me } = useSession();
  const [day, setDay] = useState<ActivityDay | null>(null);
  const [date, setDate] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /** The date a pending confirmation would move to, or `null` when nothing is pending. */
  const [confirmDate, setConfirmDate] = useState<string | null>(null);

  const load = useCallback(async (on?: string) => {
    setError(null);
    try {
      const next = await readActivityDay(on ? { date: on } : {});
      setDay(next);
      setDate(next.localDate);
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

  async function run(action: () => Promise<ActivityDay>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setDay(next);
      setCounts(Object.fromEntries(next.entries.map((e) => [e.activityTypeCode, e.count])));
      setDirty(false);
      setReason('');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (configLoading || (day === null && error === null)) {
    return (
      <Page title="Log Activity" subtitle="Enter today's activities in 1 minute.">
        <ActivityTabs />
        <SkeletonCards count={3} label="Loading your day…" />
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
  const sections = categories.filter((c) => c.status === 'active' && isShownTo(c, rung));
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

  return (
    <Page
      title="Log Activity"
      subtitle="Enter today's activities in 1 minute."
      actions={
        /*
         * The date sits in the topbar beside the title, with the save status under it, as the
         * prototype's `.date-field` stacks them (`:2700-2704`, CSS `:91`) — it is what the whole
         * screen is about, not one field of the form.
         */
        <div className="flex flex-col gap-1.5">
          <Field label="Date" htmlFor="activity-date" className="w-44">
            <TextInput
              id="activity-date"
              type="date"
              value={date}
              onChange={(e) => goTo(e.target.value)}
            />
          </Field>
          {savedTotal !== null ? (
            <SaveStatus state="saved">Saved · {savedTotal} touches</SaveStatus>
          ) : (
            <SaveStatus state="unsaved">Not yet saved</SaveStatus>
          )}
        </div>
      }
    >
      <ActivityTabs />
      {error && <ErrorBanner {...error} />}

      {/* The office's tiles, then the total (ADR-0064, `:2720-2726`). */}
      {sections.length > 0 && (
        <SummaryStrip
          tiles={summaryTiles(categories, rung, sectionTotal, {
            label: 'Total touches today',
            value: total,
          })}
        />
      )}

      {sections.length === 0 && (
        <Card>
          <p className="text-md text-navy">
            Your office has not set up its activity types yet. Ask your KPM Owner — the list on this
            screen is theirs to define.
          </p>
        </Card>
      )}

      {/*
        * **Two columns, as the prototype has them** (`.categories`, `:112`). One card per category
        * stacked full-width put three activities on a screen; side by side a reader sees the whole
        * day at once, which is what "in 1 minute" depends on.
        */}
      <div className="mb-5 grid items-start gap-4 lg:grid-cols-2">
        {sections.map((section) => {
          const types = section.types.filter((ty) => ty.status === 'active');
          return (
            <SectionCard
              key={section.code}
              title={section.label}
              meta={
                <ConfigBadge tone="navy" className="normal-case tracking-normal">
                  {types.length === 1 ? '1 item' : `${types.length} items`}
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
                    <span className="block text-md text-navy">{type.label}</span>
                    {/*
                      * The italic sub-note the prototype pulls out of the label's trailing
                      * parenthetical (`splitLabel`, `:4778`). Ours is a field the office fills in, so
                      * there is nothing to parse — and nothing was rendering it.
                      */}
                    {type.description && (
                      <span className="mt-0.5 block text-xs italic text-muted">
                        {type.description}
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
        <p role="status" className="mb-4 text-sm text-muted">This day is closed, and nothing was logged for it.</p>
      )}
      {sections.length > 0 && frozen && !unloggedAndClosed && (
        <Field
          label="Why is this being corrected?"
          htmlFor="correction-reason"
          hint={corrections > 0
            ? `This day is closed, and has been corrected ${corrections === 1 ? 'once' : `${corrections} times`}.`
            : 'This day is closed.'}
          className="mb-4 max-w-xl"
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
      {sections.length > 0 && !unloggedAndClosed && (
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" disabled={busy} onClick={() => void load(date)}>
            Cancel
          </Button>
          {frozen ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => void run(
                () => correctActivityDay({ date, counts, reason: reason.trim() }),
              )}
            >
              {busy ? 'Saving…' : 'Save the correction'}
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => void run(() => saveActivityDay({ date, counts }))}
            >
              {busy ? 'Saving…' : 'Save activity'}
            </Button>
          )}
        </div>
      )}

      <Dialog
        open={confirmDate !== null}
        message="You have unsaved counts for this day. Discard them and open another day?"
        confirmLabel="Discard counts"
        tone="danger"
        onConfirm={() => {
          const next = confirmDate!;
          setConfirmDate(null);
          void load(next);
        }}
        onCancel={() => setConfirmDate(null)}
      />
    </Page>
  );
}

/** A day after the one the server answered with cannot have happened yet. */
function isFuture(chosen: string, serverDay: string): boolean {
  return chosen > serverDay;
}
