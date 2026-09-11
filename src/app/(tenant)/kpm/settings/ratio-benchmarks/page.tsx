'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ACTIVITY_SETTINGS_TABS, SettingsTabs } from '@/components/settings-tabs';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  archiveRatio,
  listActivityTypes,
  listRatios,
  restoreRatio,
  updateRatio,
  type ActivityCategoryRow,
  type RatioRow,
} from '@/lib/tenant-config';

/**
 * How the office measures its agents (P4-T2, `KPM_Owner.html:1451-1490`).
 *
 * **A formula is two lists of activity types, shown by name.** The prototype writes them
 * as `6 / (4+5)` — item numbers — which is unreadable and, worse, breaks the moment
 * somebody reorders the taxonomy. Here each side is rendered as the labels of the codes it
 * names, with the code underneath, so an Owner can see what a ratio actually counts.
 *
 * **The benchmark is the office's own.** It starts from the platform default and is
 * editable; nothing else on this screen changes what is counted, only what counts as good.
 */
export default function RatioBenchmarksPage() {
  const canWrite = useCan('tenant_config:write');
  const [ratios, setRatios] = useState<RatioRow[] | null>(null);
  const [taxonomy, setTaxonomy] = useState<ActivityCategoryRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const [rows, types] = await Promise.all([listRatios(true), listActivityTypes(true)]);
      setRatios(rows);
      setTaxonomy(types);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * A code's label, or `null` when the office has none for it.
   *
   * `null` rather than the code itself: the code is already rendered beside the label, so
   * falling back to it printed the same string twice — *"SELL_FOLLOWUP SELL_FOLLOWUP"* —
   * on exactly the rows where an Owner most needs to read clearly, the ones naming a type
   * that has since been archived.
   */
  const labelFor = (code: string) =>
    taxonomy.flatMap((c) => c.types).find((t) => t.code === code)?.label ?? null;

  return (
    <Page
      title="Ratio benchmarks"
      subtitle="What each ratio counts, and what counts as on track."
      permission="tenant_config:read"
    >
      <SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />
      {error && <ErrorBanner {...error} />}

      {ratios === null ? (
        <SkeletonCards count={5} />
      ) : (
        <div className="flex flex-col gap-4">
          {ratios.map((ratio) => (
            <Card key={ratio.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-navy">
                  {ratio.label}
                  {ratio.status === 'archived' && (
                    <span className="ml-2 text-sm font-normal text-muted">archived</span>
                  )}
                </h2>
                <code className="text-sm text-muted">{ratio.code}</code>
              </div>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {([['Counts', ratio.numerator], ['Out of', ratio.denominator]] as const)
                  .map(([heading, codes]) => (
                    <div key={heading}>
                      <dt className="text-sm font-semibold text-navy">{heading}</dt>
                      <dd>
                        <ul className="mt-1 flex flex-col gap-1">
                          {codes.map((code) => (
                            <li key={code} className="text-md text-navy">
                              {labelFor(code) && <>{labelFor(code)} </>}
                              <code className="text-sm text-muted">{code}</code>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
              </dl>

              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-hairline pt-3">
                {editing === ratio.id ? (
                  <>
                    <Field
                      label="Benchmark"
                      htmlFor={`benchmark-${ratio.id}`}
                      hint={ratio.comparison === 'band'
                        ? 'Percentage points either side of an even split.'
                        : 'On track at or above this.'}
                      className="min-w-40"
                    >
                      <TextInput
                        id={`benchmark-${ratio.id}`}
                        type="number"
                        step="0.01"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                    </Field>
                    <Button
                      disabled={busy || draft.trim() === '' || Number.isNaN(Number(draft))}
                      onClick={() => void run(async () => {
                        await updateRatio(ratio.id, { benchmark: Number(draft) });
                        setEditing(null);
                      })}
                    >
                      Save
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <p className="text-md text-navy">
                      <span className="text-muted">
                        {ratio.comparison === 'band' ? 'On track within ' : 'On track at or above '}
                      </span>
                      <strong>{ratio.benchmark}</strong>
                      {ratio.comparison === 'band' && <span className="text-muted"> points</span>}
                    </p>
                    {canWrite && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditing(ratio.id);
                            setDraft(String(ratio.benchmark));
                          }}
                        >
                          Change the benchmark
                        </Button>
                        {ratio.status === 'active' ? (
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => void run(() => archiveRatio(ratio.id))}
                          >
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void run(() => restoreRatio(ratio.id))}
                          >
                            Restore
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
