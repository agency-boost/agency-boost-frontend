'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ActivityTabs } from '@/components/activity-tabs';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Dialog } from '@/components/ui/dialog';
import { KpiTile } from '@/components/ui/kpi-tile';
import { NumberBadge } from '@/components/ui/number-badge';
import { SaveStatus } from '@/components/ui/save-status';
import { SectionCard } from '@/components/ui/section-card';
import { Stepper } from '@/components/ui/stepper';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import {
  correctActivityDay, readActivityCompliance, readActivityDay, readActivitySummary,
  saveActivityDay, type ActivityCompliance, type ActivityDay, type ActivitySummary,
} from '@/lib/activity';

/**
 * The daily minute (P6-T2).
 *
 * **Driven entirely by the office's own configuration.** The sections are the office's activity
 * categories and the rows are its types, read from the published snapshot the shell already holds.
 * Nothing here is hardcoded — the prototype groups twelve items by hardcoded id ranges, which is
 * why an office that adds a thirteenth has nowhere to put it (OD-63).
 *
 * **The day is the office's day.** The server decides which calendar day an instant falls on, in
 * the office's timezone; this screen never computes one. The prototype builds every date key with
 * `toISOString()`, so an agent logging at 06:30 files against yesterday.
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
  const [saved, setSaved] = useState<string | null>(null);
  /** The date a pending confirmation would move to, or `null` when nothing is pending. */
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const [standing, setStanding] = useState<
    { compliance: ActivityCompliance; week: ActivitySummary } | null
  >(null);

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
   * Your own standing, beside the form rather than on a screen you have to go and find.
   *
   * This is what the compliance metric is *for*: an agent seeing whether they are reporting,
   * while they are in the place where reporting happens. It reloads after every save, because
   * saving is the thing that changes it.
   */
  const refreshStanding = useCallback(async () => {
    try {
      const [compliance, week] = await Promise.all([
        readActivityCompliance(),
        readActivitySummary({ period: 'ROLLING_7D' }),
      ]);
      setStanding({ compliance, week });
    } catch {
      // A standing strip that cannot load is not worth an error banner over the form the
      // agent came here to fill in. It simply does not render.
      setStanding(null);
    }
  }, []);

  useEffect(() => { void refreshStanding(); }, [refreshStanding]);

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

  async function run(action: () => Promise<ActivityDay>, message: string) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const next = await action();
      setDay(next);
      setCounts(Object.fromEntries(next.entries.map((e) => [e.activityTypeCode, e.count])));
      setDirty(false);
      setReason('');
      setSaved(message);
      void refreshStanding();
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
  /**
   * One tile per section, plus the office-wide total (`Overall.html:2720-2726`).
   *
   * **Per active category, not the prototype's four hardcoded id ranges.** Its strip merges Personal
   * and Team Development into one tile while its own Dashboard keeps them apart — a disagreement
   * between two views of the same numbers, and the same hardcoding OD-63 settled by making the
   * sections the office's own.
   */
  const rung = me?.membership?.orgLevelCode ?? '';
  const sections = (config?.activity ?? []).filter((c) => c.status === 'active'
    && (c.appliesToOrgLevelCodes.length === 0 || c.appliesToOrgLevelCodes.includes(rung)));

  return (
    <Page
      title="Log Activity"
      subtitle="Enter today's activities in 1 minute."
      actions={
        <div className="flex items-end gap-3">
          {/*
            * The date sits in the topbar beside the title, as the prototype has it (`:2701-2704`) —
            * it is what the whole screen is about, not one field of the form.
            */}
          <Field label="Date" htmlFor="activity-date" className="w-44">
            <TextInput
              id="activity-date"
              type="date"
              value={date}
              onChange={(e) => goTo(e.target.value)}
            />
          </Field>
          <div className="flex h-10 items-center">
            {saved ? (
              <SaveStatus state="saved">{saved}</SaveStatus>
            ) : (
              <SaveStatus state="unsaved">Not yet saved</SaveStatus>
            )}
          </div>
        </div>
      }
    >
      <ActivityTabs />
      {error && <ErrorBanner {...error} />}

      {/*
        * Per-category totals and the grand total, above the cards rather than inside one of them
        * (`:2720-2726`). The grand total is the amber one because it is the number the screen is
        * about; the rest are how it was made up.
        */}
      {sections.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sections.map((section) => (
            <KpiTile
              key={section.code}
              label={section.label}
              value={section.types
                .filter((ty) => ty.status === 'active')
                .reduce((sum, ty) => sum + (Number(counts[ty.code]) || 0), 0)}
            />
          ))}
          <KpiTile label="Total touches today" value={total} variant="insight" />
        </div>
      )}

      {(frozen || (day !== null && day.correctionCount > 0)) && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              status={frozen ? 'neutral' : 'success'}
              label={frozen ? 'Closed for editing' : 'Open'}
            />
            {frozen && (
              <span className="text-sm text-muted">
                This day is closed. You can still correct it — the numbers people have already read
                stay beside your correction, with your reason.
              </span>
            )}
          </div>
          {day !== null && day.correctionCount > 0 && (
            <p className="mt-2 text-sm text-muted">
              Corrected {day.correctionCount === 1 ? 'once' : `${day.correctionCount} times`} since
              it closed.
            </p>
          )}
        </Card>
      )}

      {standing && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              status={standing.compliance.compliant7d ? 'success' : 'alert'}
              label={standing.compliance.compliant7d ? 'Logged' : 'Missed'}
            />
            <span className="text-sm text-muted">
              {standing.compliance.lastLoggedOn
                ? `Last logged ${standing.compliance.lastLoggedOn}`
                : 'Never logged'}
              {' · '}
              {standing.week.daysLogged} of the last {standing.compliance.windowDays} days
              {' · '}
              {standing.week.totalCount} touches this week
            </span>
          </div>
        </Card>
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
              {section.description && (
                <p className="border-b border-hairline px-4 py-3 text-sm text-muted">
                  {section.description}
                </p>
              )}
              {types.map((type) => (
                <SectionCard.Row
                  key={type.code}
                  control={
                    <Stepper
                      value={counts[type.code] ?? 0}
                      label={type.label}
                      max={999}
                      disabled={busy}
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

      {/* A correction needs its reason, and that is a form — so it keeps its card. */}
      {sections.length > 0 && frozen && (
        <Card className="mb-3">
          <Field
            label="Why is this being corrected?"
            htmlFor="correction-reason"
            hint="Kept beside the numbers, so a leader who used the old ones can see what changed."
          >
            <TextInput
              id="correction-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Two submissions were logged against the wrong day."
            />
          </Field>
        </Card>
      )}

      {/*
        * **Outside any card and right-aligned**, as `.actions` has it (`:2740-2743`, CSS `:157`).
        * Inside a card the save button read as one more field of the last group; out here it belongs
        * to the page, which is what it saves.
        */}
      {sections.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" disabled={busy} onClick={() => void load(date)}>
            Cancel
          </Button>
          {frozen ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => void run(
                () => correctActivityDay({ date, counts, reason: reason.trim() }),
                'Correction saved.',
              )}
            >
              {busy ? 'Saving…' : 'Save the correction'}
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => void run(
                () => saveActivityDay({ date, counts }),
                `Saved · ${total} touches`,
              )}
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
