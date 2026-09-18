'use client';

import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen, TenantConfigBars } from '@/components/settings-screen';
import { ACTIVITY_SETTINGS_TABS } from '@/components/settings-tabs';
import {
  Button, Card, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  benchmarkFromInput, benchmarkToInput, DISPLAY_UNIT_LABEL, formatBenchmark, reexpress, unitFor,
  type RatioDisplayUnit,
} from '@/lib/ratio-format';
import { projectStaged, unstageRow, STAGED_LABEL } from '@/lib/staged-projection';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import {
  applyConfigChanges,
  stageChange,
  archiveRatio,
  createRatio,
  listActivityTypes,
  listRatios,
  restoreRatio,
  type ActivityCategoryRow,
  type ConfigChange,
  type RatioComparison,
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
 * **Two kinds of row** (P4-T15, ADR-0021, revised by ADR-0024). The five the office was
 * provisioned with came from its company; everything else it made itself. What that no
 * longer means is *immutable*: since ADR-0024 every field but the `code` is the office's to
 * change, the formula included, because the comparison the old lock protected computes the
 * **seeded** formula — recorded on the row — rather than reading this one. A row that has
 * moved away from what it was seeded with says so on its card, naming the formula it
 * started from, because one office can now hold two numbers under one name.
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
      {/* The label, and the code **only** when there is no label — a formula input naming an
          activity type this office no longer defines has to render as something, and its code
          is the only thing left to render. Invariant §4's reason for the code mattering has not
          gone away; it stopped being something to paint on a screen an Owner reads daily. */}
      {label && <span className="text-md leading-tight text-navy">{label}</span>}
      {!label && <code className="text-sm leading-tight text-muted">{code}</code>}
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
  /*
   * The unit the draft is typed in (P4-T25). The field takes `15` for 15.0%, so the text
   * alone does not say what it means — changing the unit re-expresses it rather than
   * reinterpreting it, which is what `reexpress` is for.
   */
  const [draftUnit, setDraftUnit] = useState<RatioDisplayUnit>('decimal');
  const [draftLabel, setDraftLabel] = useState('');
  // The company's ladder, for the applicability control. It is the company's to define
  // (ADR-0012), so this reads it and never offers to change it.
  const { ladder, config } = useTenantConfig();
  const [scoping, setScoping] = useState<string | null>(null);
  const [rungs, setRungs] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  /*
   * Staged edits (P4-T19). Nothing reaches the office until **Save changes** — an Owner
   * restructuring used to walk through states their own screen briefly showed, and a
   * second admin opening it mid-restructure saw a half-finished taxonomy.
   */
  const [staged, setStaged] = useState<ConfigChange[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showPublished, setShowPublished] = useState(false);
  /** The two sides of the formula, while a row is open for editing. */
  const [sides, setSides] = useState<{ numerator: string[]; denominator: string[] }>({
    numerator: [], denominator: [],
  });
  const blank = {
    code: '', label: '', numerator: [] as string[], denominator: [] as string[],
    benchmark: '', comparison: 'gte' as RatioComparison,
    displayUnit: 'decimal' as RatioDisplayUnit,
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
   * Hold an edit instead of sending it.
   *
   * Two ops against one row collapse into the later one, so pressing Save after three
   * tweaks to the same benchmark sends one change, not three — and the `expectedVersion`
   * the first edit read still guards it, because the row has not moved in between.
   */
  const stage = (change: ConfigChange) => setStaged((now) => stageChange(now, change));

  async function save() {
    await run(async () => {
      await applyConfigChanges(staged);
      setStaged([]);
    });
  }

  /** What the published copy says, for the panel that shows it beside the working one. */
  const publishedRatios = config?.ratios ?? [];

  /*
   * The rows as they will be, not as the office still has them.
   *
   * Only edits are held here — a new ratio and an archive are written immediately — and an
   * edit was the one that showed nowhere: the panel staged a benchmark and closed, and the
   * card below went on rendering the row `load()` had fetched. Reported three times as
   * *"edit Ratio di owner masih belum bisa"*, when what was broken was the evidence.
   */
  const projected = projectStaged(ratios ?? [], staged, { entity: 'ratio' });
  // A row held for archive stays on screen even when archived rows are hidden: it has
  // not happened yet, and hiding it takes the Undo away with it.
  const visible = projected.filter(
    ({ row, staged: mark }) => showArchived || row.status === 'active' || mark,
  );

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
    <SettingsScreen
      title="Ratio benchmarks"
      subtitle="What each ratio counts, and what counts as on track."
      permission="tenant_config:read"
      tabs={ACTIVITY_SETTINGS_TABS}
      error={error}
      /*
       * The two bars are adjacent now. They were separated by this screen's hint and its
       * two checkboxes, which put the staged-changes count off-screen for every row below
       * the first — so an Owner edited a benchmark, pressed Save, saw the old number and
       * the only evidence of the edit scrolled out of view, and reported three times that
       * editing ratios did not work.
       */
      bars={(
        <TenantConfigBars
          publishRefreshKey={published}
          staged={{
            count: staged.length,
            busy,
            onSave: () => void save(),
            onDiscard: () => setStaged([]),
          }}
        />
      )}
      toolbar={{
        /* The prototype's own hint, and the window is the one thing the cards cannot say:
           every ratio here is computed over the last 30 days, fixed (ADR-0022). */
        hint: 'Calculated on the last 30 days of activity.',
        actions: (
          <>
            <label className="flex items-center gap-2 text-md text-navy">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </>
        ),
      }}
    >

      <div className="mb-4">
        <Button variant="secondary" onClick={() => setShowPublished((v) => !v)}>
          {showPublished ? 'Hide what agents see' : 'See what agents see now'}
        </Button>
        {showPublished && (
          <Card className="mt-2">
            <h2 className="font-display text-lg font-bold text-navy">What agents see now</h2>
            <p className="mt-1 text-sm text-muted">
              The published copy. It changes only when you press <strong>Publish to
              agents</strong> — not when you save.
            </p>
            {publishedRatios.length === 0 ? (
              <p className="mt-3 text-md text-muted">Nothing is published for this office yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {publishedRatios.map((r) => (
                  <li key={r.id} className="text-md text-navy">
                    {r.label}
                    <span className="text-muted">
                      {r.comparison === 'band' ? ' — on track within ' : ' — on track at or above '}
                    </span>
                    <strong>{formatBenchmark(r.benchmark, unitFor(r))}</strong>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {canWrite && ratios !== null && (
        <Card className="mb-4">
          {adding ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const unit = form.comparison === 'band' ? 'points' : form.displayUnit;
                  await createRatio({
                    code: form.code,
                    label: form.label,
                    numerator: form.numerator,
                    denominator: form.denominator,
                    benchmark: benchmarkFromInput(form.benchmark, unit),
                    comparison: form.comparison,
                    displayUnit: unit,
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

              <FieldRow>
                {/* Follows the rule, as the per-card editor already did. A `band` benchmark
                    is ±percentage points, not a floor, and labelling it as a floor is a
                    data-entry defect rather than a wording one. */}
                <Field
                  label={form.comparison === 'band' ? 'Within, either side' : 'On track at or above'}
                  htmlFor="new-ratio-benchmark"
                  hint={form.comparison === 'band'
                    ? 'Percentage points either side of an even split.'
                    : form.displayUnit === 'percent'
                      ? 'As a percentage — type 15 for 15.0%.'
                      : undefined}
                  className="min-w-40"
                >
                  <TextInput
                    id="new-ratio-benchmark"
                    type="number"
                    step="0.01"
                    value={form.benchmark}
                    onChange={(e) => setForm((f) => ({ ...f, benchmark: e.target.value }))}
                  />
                </Field>
                {/* Only for an at-or-above ratio: a band is judged in points and has no
                    other way to be written. Switching re-expresses what was typed, so 0.3
                    becomes 30 as a percentage rather than turning into 0.3%. */}
                {form.comparison === 'gte' && (
                  <Field label="Shown as" htmlFor="new-ratio-unit" className="min-w-48">
                    <Select
                      id="new-ratio-unit"
                      value={form.displayUnit}
                      onChange={(e) => {
                        const next = e.target.value as RatioDisplayUnit;
                        setForm((f) => ({
                          ...f,
                          displayUnit: next,
                          benchmark: reexpress(f.benchmark, f.displayUnit, next),
                        }));
                      }}
                    >
                      <option value="percent">{DISPLAY_UNIT_LABEL.percent}</option>
                      <option value="decimal">{DISPLAY_UNIT_LABEL.decimal}</option>
                    </Select>
                  </Field>
                )}
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
                <FieldRow.Actions>
                  <Button
                    type="submit"
                    disabled={busy
                      || form.code.trim() === ''
                      || form.label.trim() === ''
                      || form.numerator.length === 0
                      || form.denominator.length === 0
                      || Number.isNaN(benchmarkFromInput(
                        form.benchmark, form.comparison === 'band' ? 'points' : form.displayUnit,
                      ))}
                  >
                    Add the ratio
                  </Button>
                  <Button variant="secondary" onClick={() => { setAdding(false); setForm(blank); }}>
                    Cancel
                  </Button>
                </FieldRow.Actions>
              </FieldRow>
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
          {visible.length === 0 && (
            <EmptyState
              title={showArchived ? 'No ratios yet' : 'Every ratio is archived'}
              variant={showArchived ? 'empty' : 'filtered'}
              action={canWrite && !showArchived ? (
                <Button variant="secondary" onClick={() => setShowArchived(true)}>
                  Show archived
                </Button>
              ) : undefined}
            />
          )}
          {visible.map(({ row: ratio, staged: mark }) => (
            <Card key={ratio.id} className={mark ? 'border-amber' : undefined}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-navy">
                  {ratio.label}
                  {ratio.status === 'archived' && (
                    <span className="ml-2 text-sm font-normal text-muted">archived</span>
                  )}
                </h2>
                {/* One cell, so the heading stays hard left however many of these show. */}
                <span className="flex items-center gap-3">
                  {mark && (
                    <>
                      <span className="rounded-full bg-amber/20 px-2 py-0.5 text-sm text-navy">
                        {STAGED_LABEL[mark]}
                      </span>
                      {/* Undo belongs on the row, not only in the bar: the bar discards
                          every staged change at once, which is not what a reader who
                          mistyped one benchmark is asking for. */}
                      <button
                        type="button"
                        className="text-sm font-semibold text-navy underline"
                        onClick={() => setStaged((now) => unstageRow(now, 'ratio', ratio.id))}
                      >
                        Undo
                      </button>
                    </>
                  )}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted">
                {ratio.origin === 'platform'
                  ? 'Provisioned with your company’s standard. Everything on it is yours to '
                    + 'change, the formula included — and if you change what it counts, this '
                    + 'card says so.'
                  : 'Your office’s own — the name, what it counts, the benchmark and who '
                    + 'it applies to are all yours. It is compared with nobody outside this '
                    + 'office, which is what makes that safe.'}
              </p>

              {/*
                * Named on the card, never left to be discovered (ADR-0024). An office may
                * now measure itself however it likes; a comparison across offices computes
                * the formula this office was *seeded* with, so the two can differ and a
                * reader has to be told which one they are looking at.
                */}
              {ratio.divergesFromStandard
                && ratio.standardNumerator && ratio.standardDenominator && (
                <p className="mt-3 rounded-md border border-amber bg-amber/10 p-3 text-sm text-navy">
                  <strong>This is not your company’s standard any more.</strong>{' '}
                  <span className="text-muted">
                    It was set up as{' '}
                    {ratio.standardNumerator.map((c) => labelFor(c) ?? c).join(' + ')}
                    {' ÷ '}
                    {ratio.standardDenominator.map((c) => labelFor(c) ?? c).join(' + ')}.
                    Your office is measured by what is below. A comparison with other offices
                    still uses the standard, so the two figures can differ.
                  </span>
                </p>
              )}

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
                      onClick={() => {
                        stage({
                          op: 'ratio.update',
                          id: ratio.id,
                          expectedVersion: ratio.version,
                          body: { appliesToOrgLevelCodes: rungs },
                        });
                        setScoping(null);
                      }}
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
                        variant="inline"
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

              <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-hairline pt-3">
                {editing === ratio.id ? (
                  <>
                    {/* Every ratio, not only the office's own (ADR-0024). */}
                    <div className="flex w-full flex-wrap gap-4">
                        {/* The balance ratio is not a division — it is a difference over a
                            sum — so its two sides are named the way the card above names
                            them, rather than as a numerator and a denominator. */}
                        {(ratio.comparison === 'band'
                          ? ([['Selling side', 'numerator'], ['Recruitment side', 'denominator']] as const)
                          : ([['Counts', 'numerator'], ['Out of', 'denominator']] as const))
                          .map(([heading, side]) => (
                            <fieldset key={side} className="min-w-0 flex-1">
                              <legend className="text-sm font-semibold text-navy">{heading}</legend>
                              <ul className="mt-1 flex flex-wrap gap-3">
                                {taxonomy
                                  .flatMap((c) => c.types)
                                  .filter((t) => t.status === 'active')
                                  .map((type) => (
                                    <li key={type.code}>
                                      <label className="flex items-center gap-1.5 text-md text-navy">
                                        <input
                                          type="checkbox"
                                          checked={sides[side].includes(type.code)}
                                          onChange={(e) => setSides((now) => ({
                                            ...now,
                                            [side]: e.target.checked
                                              ? [...now[side], type.code]
                                              : now[side].filter((c) => c !== type.code),
                                          }))}
                                        />
                                        {type.label}
                                      </label>
                                    </li>
                                  ))}
                              </ul>
                            </fieldset>
                          ))}
                    </div>
                    {/* The name too. It was read-only on every card, which made the
                        office-ratio copy — *"the name… is yours"* — false for the one
                        field a reader would try first. An office may rename a platform
                        ratio as well: the code is the identity, the label is what their
                        people call it (invariant §4). */}
                    <Field label="Name" htmlFor={`label-${ratio.id}`} className="min-w-60 flex-1">
                      <TextInput
                        id={`label-${ratio.id}`}
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Benchmark"
                      htmlFor={`benchmark-${ratio.id}`}
                      hint={ratio.comparison === 'band'
                        ? 'Percentage points either side of an even split.'
                        : draftUnit === 'percent'
                          ? 'On track at or above this, as a percentage — 15 means 15.0%.'
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
                    {/* On a platform ratio too: how a number is written is presentation,
                        not formula, so ADR-0021 has nothing to say about it. */}
                    {ratio.comparison === 'gte' && (
                      <Field label="Shown as" htmlFor={`unit-${ratio.id}`} className="min-w-48">
                        <Select
                          id={`unit-${ratio.id}`}
                          value={draftUnit}
                          onChange={(e) => {
                            const next = e.target.value as RatioDisplayUnit;
                            setDraft((d) => reexpress(d, draftUnit, next));
                            setDraftUnit(next);
                          }}
                        >
                          <option value="percent">{DISPLAY_UNIT_LABEL.percent}</option>
                          <option value="decimal">{DISPLAY_UNIT_LABEL.decimal}</option>
                        </Select>
                      </Field>
                    )}
                    <Button
                      disabled={busy
                        || Number.isNaN(benchmarkFromInput(draft, draftUnit))
                        || draftLabel.trim() === ''
                        || sides.numerator.length === 0
                        || sides.denominator.length === 0}
                      onClick={() => {
                        stage({
                          op: 'ratio.update',
                          id: ratio.id,
                          expectedVersion: ratio.version,
                          body: {
                            label: draftLabel.trim(),
                            benchmark: benchmarkFromInput(draft, draftUnit),
                            // Only when it moved, so an edit to the number alone sends only
                            // the number — and the row keeps a unit nobody touched.
                            ...(draftUnit !== unitFor(ratio) ? { displayUnit: draftUnit } : {}),
                            numerator: sides.numerator,
                            denominator: sides.denominator,
                          },
                        });
                        setEditing(null);
                      }}
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
                      <strong>{formatBenchmark(ratio.benchmark, unitFor(ratio))}</strong>
                    </p>
                    {canWrite && (
                      <>
                        <Button
                          variant="inline"
                          onClick={() => {
                            setEditing(ratio.id);
                            setDraft(benchmarkToInput(ratio.benchmark, unitFor(ratio)));
                            setDraftUnit(unitFor(ratio));
                            setDraftLabel(ratio.label);
                            setSides({
                              numerator: ratio.numerator,
                              denominator: ratio.denominator,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        {ratio.status === 'active' ? (
                          <Button
                            variant="inlineDanger"
                            disabled={busy}
                            onClick={() => void run(() => archiveRatio(ratio.id))}
                          >
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="inline"
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
    </SettingsScreen>
  );
}
