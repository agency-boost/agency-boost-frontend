'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
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
   */
  async function goTo(next: string) {
    if (dirty && !window.confirm('You have unsaved counts for this day. Discard them?')) return;
    await load(next);
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
      <Page title="Log activity" subtitle="Today's work, in about a minute.">
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
  const sections = (config?.activity ?? []).filter((c) => c.status === 'active'
    && (c.appliesToOrgLevelCodes.length === 0 || c.appliesToOrgLevelCodes.includes(rung)));

  return (
    <Page title="Log activity" subtitle="Today's work, in about a minute.">
      {error && <ErrorBanner {...error} />}

      <Card className="mb-3">
        <div className="flex flex-wrap items-start gap-3">
          <Field label="Day" htmlFor="activity-date" className="w-48"
            hint="Your office's calendar day.">
            <TextInput
              id="activity-date"
              type="date"
              value={date}
              onChange={(e) => void goTo(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-1">
            <span aria-hidden="true" className="text-sm font-semibold text-navy">&nbsp;</span>
            <div className="flex items-center gap-2">
              <StatusPill
                status={frozen ? 'neutral' : 'success'}
                label={frozen ? 'Closed for editing' : 'Open'}
              />
              <span className="text-sm text-muted">{total} touches</span>
            </div>
          </div>
        </div>

        {frozen && (
          <p className="mt-2 text-sm text-muted">
            This day is closed. You can still correct it — the numbers people have already read
            stay beside your correction, with your reason.
          </p>
        )}
        {day !== null && day.correctionCount > 0 && (
          <p className="mt-2 text-sm text-muted">
            Corrected {day.correctionCount === 1 ? 'once' : `${day.correctionCount} times`} since
            it closed.
          </p>
        )}
        {saved && <p className="mt-2 text-sm font-semibold text-navy">{saved}</p>}
      </Card>

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

      {sections.map((section) => (
        <Card key={section.code} className="mb-3">
          <h2 className="font-display text-md font-bold text-navy">{section.label}</h2>
          {section.description && (
            <p className="mt-1 text-sm text-muted">{section.description}</p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.types.filter((t) => t.status === 'active').map((type) => (
              <Field key={type.code} label={type.label} htmlFor={`count-${type.code}`}>
                <TextInput
                  id={`count-${type.code}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  value={String(counts[type.code] ?? 0)}
                  onChange={(e) => {
                    setCounts({ ...counts, [type.code]: Number(e.target.value) || 0 });
                    setDirty(true);
                  }}
                />
              </Field>
            ))}
          </div>
        </Card>
      ))}

      {sections.length > 0 && (
        <Card>
          {frozen ? (
            <>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={busy || !reason.trim()}
                  onClick={() => void run(
                    () => correctActivityDay({ date, counts, reason: reason.trim() }),
                    'Correction saved.',
                  )}
                >
                  {busy ? 'Saving…' : 'Save the correction'}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void load(date)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => void run(
                  () => saveActivityDay({ date, counts }),
                  `Saved — ${total} touches logged.`,
                )}
              >
                {busy ? 'Saving…' : 'Save the day'}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void load(date)}>
                Cancel
              </Button>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}

/** A day after the one the server answered with cannot have happened yet. */
function isFuture(chosen: string, serverDay: string): boolean {
  return chosen > serverDay;
}
