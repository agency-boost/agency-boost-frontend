'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { PublishBar } from '@/components/publish-bar';
import { ACTIVITY_SETTINGS_TABS, SettingsTabs } from '@/components/settings-tabs';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import {
  archiveRatio,
  createRatio,
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
 * **Two kinds of row** (P4-T15, ADR-0021). The five the office was provisioned with are the
 * platform's: their formula is fixed, because that is what lets two offices' figures mean
 * the same thing. Everything the office added is its own and free in every respect. The
 * difference is stated on the card rather than expressed as a disabled control — a field
 * that will not accept input and does not say why is the worst of both.
 *
 * **Who a ratio is for** (ADR-0020). A ratio applies to ladder rungs, and a member whose
 * rung is absent does not see it at all. An agent with no recruiting mandate reading a
 * permanent alert on the balance ratio is the defect this closes.
 */
/**
 * One activity type in a formula (`metric-chip`).
 *
 * The label with the code beneath it, not the code alone: the prototype's chips are
 * `<select>`s over the numbered item list, and the number is the thing invariant §4 says
 * must never be the identity. Showing both means an Owner reads what is counted and can
 * still see the part that does not move when the numbers do.
 */
function Chip({ code, label }: { code: string; label: string | null }) {
  return (
    <span className="inline-flex flex-col rounded-xl border border-hairline bg-canvas px-2.5 py-1">
      {label && <span className="text-md leading-tight text-navy">{label}</span>}
      <code className="text-sm leading-tight text-muted">{code}</code>
    </span>
  );
}

export default function RatioBenchmarksPage() {
  const canWrite = useCan('tenant_config:write');
  const [ratios, setRatios] = useState<RatioRow[] | null>(null);
  const [taxonomy, setTaxonomy] = useState<ActivityCategoryRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  // Bumped after any write, so the publish bar re-reads rather than going stale behind
  // an edit the Owner just made.
  const [published, setPublished] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // The company's ladder, for the applicability control. It is the company's to define
  // (ADR-0012), so this reads it and never offers to change it.
  const { ladder } = useTenantConfig();
  const [scoping, setScoping] = useState<string | null>(null);
  const [rungs, setRungs] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const blank = {
    code: '', label: '', numerator: [] as string[], denominator: [] as string[],
    benchmark: '', comparison: 'gte' as const,
  };
  const [form, setForm] = useState(blank);

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
      setPublished((n) => n + 1);
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

  /**
   * Who the ratio is a question about, in words.
   *
   * Empty is the common case and reads as *Everyone*, not as an empty list — a card
   * showing nothing beside "Applies to" would look like a setting that failed to load.
   */
  const appliesTo = (codes: string[]) =>
    (codes.length === 0
      ? 'Everyone'
      : codes
        .map((c) => ladder.find((l) => l.code === c)?.label ?? c)
        .join(' · '));

  return (
    <Page
      title="Ratio benchmarks"
      subtitle="What each ratio counts, and what counts as on track."
      permission="tenant_config:read"
    >
      <SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />
      {error && <ErrorBanner {...error} />}
      <PublishBar refreshKey={published} />

      {/* The prototype's own hint, and the window is the one thing the cards cannot say:
          every ratio here is computed over the last 30 days, fixed (ADR-0022). */}
      <p className="mb-4 text-sm text-muted">
        Calculated on the last 30 days of activity.
      </p>

      {canWrite && ratios !== null && (
        <Card className="mb-4">
          {adding ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await createRatio({
                    code: form.code,
                    label: form.label,
                    numerator: form.numerator,
                    denominator: form.denominator,
                    benchmark: Number(form.benchmark),
                    comparison: form.comparison,
                  });
                  setForm(blank);
                  setAdding(false);
                });
              }}
            >
              <h2 className="font-display text-lg font-bold text-navy">Add a ratio</h2>
              <p className="text-sm text-muted">
                Yours entirely — count whatever this office needs to watch. It will not
                appear in any comparison with other offices, because nothing outside this
                office knows what it measures.
              </p>

              <div className="flex flex-wrap gap-3">
                <Field label="Code" htmlFor="new-ratio-code" hint="Never changes once saved.">
                  <TextInput
                    id="new-ratio-code"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  />
                </Field>
                <Field label="Name" htmlFor="new-ratio-label">
                  <TextInput
                    id="new-ratio-label"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </Field>
              </div>

              {/* Two pickers over the office's own taxonomy, because a formula is a pair of
                  code lists and never a typed expression — the prototype's `6 / (4+5)`
                  rebinds itself the moment somebody reorders the activity types. */}
              {([['Counts', 'numerator'], ['Out of', 'denominator']] as const).map(([heading, side]) => (
                <fieldset key={side}>
                  <legend className="text-sm font-semibold text-navy">{heading}</legend>
                  <ul className="mt-1 flex flex-wrap gap-3">
                    {taxonomy.flatMap((c) => c.types).filter((t) => t.status === 'active').map((type) => (
                      <li key={type.code}>
                        <label className="flex items-center gap-1.5 text-md text-navy">
                          <input
                            type="checkbox"
                            checked={form[side].includes(type.code)}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              [side]: e.target.checked
                                ? [...f[side], type.code]
                                : f[side].filter((c) => c !== type.code),
                            }))}
                          />
                          {type.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}

              <div className="flex flex-wrap items-end gap-3">
                <Field label="On track at or above" htmlFor="new-ratio-benchmark" className="min-w-40">
                  <TextInput
                    id="new-ratio-benchmark"
                    type="number"
                    step="0.01"
                    value={form.benchmark}
                    onChange={(e) => setForm((f) => ({ ...f, benchmark: e.target.value }))}
                  />
                </Field>
                <Field label="Rule" htmlFor="new-ratio-comparison" className="min-w-40">
                  <Select
                    id="new-ratio-comparison"
                    value={form.comparison}
                    onChange={(e) => setForm((f) => ({
                      ...f, comparison: e.target.value as typeof f.comparison,
                    }))}
                  >
                    <option value="gte">At or above the benchmark</option>
                    <option value="band">Within the benchmark either side of an even split</option>
                  </Select>
                </Field>
                <Button
                  type="submit"
                  disabled={busy
                    || form.code.trim() === ''
                    || form.label.trim() === ''
                    || form.numerator.length === 0
                    || form.denominator.length === 0
                    || Number.isNaN(Number(form.benchmark))
                    || form.benchmark.trim() === ''}
                >
                  Add the ratio
                </Button>
                <Button variant="secondary" onClick={() => { setAdding(false); setForm(blank); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setAdding(true)}>Add a ratio</Button>
          )}
        </Card>
      )}

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

              <p className="mt-1 text-sm text-muted">
                {ratio.origin === 'platform'
                  ? 'Measured the same way in every office, so its formula is fixed. The '
                    + 'benchmark, the name and who it applies to are yours.'
                  : 'Your office’s own. Everything about it is yours to change.'}
              </p>

              {/*
                * A real fraction — numerator, a rule, denominator underneath
                * (`ratio-fraction`). Two side-by-side lists headed *Counts* and *Out of*
                * said the same thing and read as two unrelated sets; "this over that" is
                * what a ratio *is*, and the prototype is right about it.
                *
                * The balance ratio is not a fraction — it is a difference over a sum — so
                * it renders as two labelled sides with the sentence explaining which way
                * the result leans, exactly as the prototype does and for the reason its
                * own comment gives.
                */}
              {ratio.comparison === 'band' ? (
                <div className="mt-3 flex flex-col gap-2">
                  {([['Selling side', ratio.numerator], ['Recruitment side', ratio.denominator]] as const)
                    .map(([side, codes]) => (
                      <div key={side} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy">{side}</span>
                        {codes.map((code) => <Chip key={code} code={code} label={labelFor(code)} />)}
                      </div>
                    ))}
                  <p className="text-sm text-muted">
                    Result leans Recruitment when its total is higher, Selling when the reverse
                    is true — shown as a −100% to +100% balance.
                  </p>
                </div>
              ) : (
                <div className="mt-3 inline-flex flex-col items-start">
                  <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                    {ratio.numerator.map((code) => (
                      <Chip key={code} code={code} label={labelFor(code)} />
                    ))}
                  </div>
                  <div className="my-0.5 h-0.5 w-full min-w-32 bg-navy" aria-hidden />
                  <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                    {ratio.denominator.map((code) => (
                      <Chip key={code} code={code} label={labelFor(code)} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
                {scoping === ratio.id ? (
                  <>
                    <fieldset className="min-w-0">
                      <legend className="text-sm font-semibold text-navy">Applies to</legend>
                      {/* Checkboxes, not a multi-select: every rung is visible at once, and
                          the empty state — nothing ticked — is the one that means everyone,
                          which a collapsed control would hide. */}
                      <ul className="mt-1 flex flex-wrap gap-3">
                        {ladder.map((rung) => (
                          <li key={rung.code}>
                            <label className="flex items-center gap-1.5 text-md text-navy">
                              <input
                                type="checkbox"
                                checked={rungs.includes(rung.code)}
                                onChange={(e) => setRungs((current) => (e.target.checked
                                  ? [...current, rung.code]
                                  : current.filter((c) => c !== rung.code)))}
                              />
                              {rung.label}
                            </label>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-sm text-muted">
                        Tick none to ask everyone. Anybody on a rung you leave unticked will
                        not see this ratio at all.
                      </p>
                    </fieldset>
                    <Button
                      disabled={busy}
                      onClick={() => void run(async () => {
                        await updateRatio(ratio.id, { appliesToOrgLevelCodes: rungs });
                        setScoping(null);
                      })}
                    >
                      Save
                    </Button>
                    <Button variant="secondary" onClick={() => setScoping(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <p className="text-md text-navy">
                      <span className="text-muted">Applies to </span>
                      <strong>{appliesTo(ratio.appliesToOrgLevelCodes)}</strong>
                    </p>
                    {canWrite && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setScoping(ratio.id);
                          setRungs(ratio.appliesToOrgLevelCodes);
                        }}
                      >
                        Change who it applies to
                      </Button>
                    )}
                  </>
                )}
              </div>

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
