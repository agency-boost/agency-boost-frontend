'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { POSTER_FILL } from '@/components/campaigns/campaign-parts';
import { useLadder } from '@/components/ui/role-badge';
import { DateField } from '@/components/ui/date-field';
import { Button, Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { messagesIn } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import { settingsMessages } from '@/i18n/messages/settings';
import { settingsCampaignsMessages } from '@/i18n/messages/settings-campaigns';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { figureWords, officeDay, officeDayEdge, POSTER_COLORS, ratioUnitsOf, type PosterColor } from '@/lib/campaigns';
import { cn } from '@/lib/cn';
import { suggestCode } from '@/lib/config-code';
import { formatCalendarDay, formatDayRange, moneyPrefix, parseDecimal } from '@/lib/format';
import { parseDigits, toMinor } from '@/lib/goals';
import { useCan } from '@/lib/session';
import { byPhaseAndDate } from '@/lib/settings-order';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { ARCHIVED_SWITCH_ROW, CHECK_LINE_TOUCH } from '../settings-touch';
import {
  archiveCampaign, createCampaign, listCampaigns, listMetrics, restoreCampaign, updateCampaign,
  type CampaignKindCode, type CampaignRow, type CampaignWindowCode, type MetricDefinition, type RequirementView,
} from '@/lib/tenant-config';

/** *Semua · Struktural · Musiman* (P19.25-T5 AC-1). */
type Filter = 'all' | 'structural' | 'seasonal';

/** The comparisons a requirement takes, in the order the form offers them. */
const COMPARATORS = ['gte', 'gt', 'lte', 'lt', 'eq'] as const;

/** A stored value's words, or the value itself for one this screen does not know. */
const wordFor = (words: Readonly<Record<string, string>>, value: string) => words[value] ?? value;

/**
 * One requirement in words.
 *
 * `idr_minor` is integer sen, rendered as rupiah — the prototype stores *"Rp 600,000,000"* as a
 * display string and one campaign's reward in **pesos**, so neither can be compared or totalled.
 * Written as the campaign cards write it (`figureWords`, ADR-0167 §1): *Rp 600 Jt*, in full where
 * compact writing would round the rule. **A rate as a percentage** (P18.9-T4 AC-8, ADR-0176 §8; UI-030): a
 * requirement on one of the office's ratios is written in that ratio's own unit, `ratioUnits` — *Recruitment success
 * rate at least 30%*, where it read *0,30* — and one the office does not hold as a number, as before.
 */
function readRequirement(
  r: RequirementView, ratioUnits: ReadonlyMap<string, 'percent' | 'decimal'>, language: Language, figures: Language,
): string {
  const t = messagesIn(settingsCampaignsMessages, language);
  return t.requirement({
    name: r.metricName,
    comparator: wordFor(t.comparators, r.comparator),
    target: figureWords(r.value, r.unit, ratioUnits.get(r.metricKey), figures, language),
  });
}

/**
 * A day in the form, as the office's instant (ADR-0016): its first moment, or its last — so a campaign from
 * Oct 1 to Dec 31 runs in whole office months whatever zone the browser is in (D-windows). It read
 * `new Date(day)`, which is midnight UTC, 07:00 in Jakarta.
 */
const toInstant = (day: string, edge: 'start' | 'end') => (day ? officeDayEdge(day, edge) : '');
const localDate = (iso: string | null) => (iso ? officeDay(iso) : '');

/**
 * One requirement in the form (P18.2-T7 AC-9): its metric, its comparator **as stored**, and its target as typed
 * — rupiah for money. `stored` is the requirement as read: one the Owner has not touched goes back exactly as it
 * came, so a requirement a campaign can no longer measure is kept, never rewritten or dropped.
 */
interface RequirementDraft {
  /** The row's own key, for React: a position would move a typed value onto the wrong row on a removal. */
  key: number;
  metricKey: string;
  comparator: string;
  value: string;
  stored: RequirementView | null;
}

let nextRowKey = 0;
const rowKey = () => (nextRowKey += 1);

const requirementDraft = (r: RequirementView): RequirementDraft => ({
  key: rowKey(),
  metricKey: r.metricKey,
  comparator: r.comparator,
  value: String(r.unit === 'idr_minor' ? r.value / 100 : r.value),
  stored: r,
});

const blankRequirement = (): RequirementDraft => ({ key: rowKey(), metricKey: '', comparator: 'gte', value: '', stored: null });

/** What a row sends: the stored requirement unchanged when the row was not touched, else the row as typed. */
function requirementBody(row: RequirementDraft, metrics: readonly MetricDefinition[]) {
  const s = row.stored;
  if (s && s.metricKey === row.metricKey && s.comparator === row.comparator
    && row.value === String(s.unit === 'idr_minor' ? s.value / 100 : s.value)) {
    return { metricKey: s.metricKey, comparator: s.comparator, value: s.value };
  }
  const unit = metrics.find((m) => m.key === row.metricKey)?.unit ?? s?.unit;
  return {
    metricKey: row.metricKey,
    comparator: row.comparator,
    // Rupiah in, integer sen stored: money is never a float (invariant §9). By the metric's unit — whole rupiah
    // as digits, anything else a decimal typed with a comma or a point (ADR-0167 §1).
    value: unit === 'idr_minor' ? toMinor(parseDigits(row.value)) : (row.value.trim() === '' ? 0 : parseDecimal(row.value)),
  };
}

/**
 * **Pengaturan › Campaigns** (P19.25-T5, ADR-0282; `data-upload-pengaturan-*` frame 20; the brief's *"no Production club;
 * each campaign is only tagged Struktural (always on: jenjang, MDRT) or Musiman (has start and end date), filter Semua /
 * Struktural / Musiman"*).
 *
 * - ***Semua n · Struktural n · Musiman n***, then one white list: each campaign's title, its line — its first
 *   requirements and when it runs (*setiap tahun*, *sepanjang tahun*, a seasonal one's dates, *mulai …* before it
 *   starts) —, its tag ***Struktural*** or ***Musiman***, and ⋯ (*Ubah*, *Arsipkan* / *Pulihkan*). ***+ Tambah
 *   campaign*** at the foot, the two notes under the card.
 * - **No *Production club tiers* tab and no MOC** (*"MOC / Club: not shown anywhere for now"*): the carrier's rules stay
 *   stored, unread by any screen (ADR-0282 §6). **No section in the form**: a structural campaign is *Struktural* and
 *   nothing more (§5).
 * - **The form is the one it was** (P18.2-T7 AC-9: requirements, window, rungs, poster, line, prize) in a sheet; kept
 *   with *Tampilkan yang diarsipkan* (the owner's rule that fidelity work never strips a requested feature).
 *
 * **Saved at once**: a campaign is read live, never published, so no orange bar speaks of it (P19.21-T2).
 */
export default function CampaignsSettingsPage() {
  const t = useMessages(settingsCampaignsMessages);
  const s = useMessages(settingsMessages);
  const c = useMessages(campaignsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const canWrite = useCan('tenant_config:write');
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  /** The campaign whose form is open — `new` for *+ Tambah campaign* — or `null`. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  /** The product's own metric vocabulary, read rather than re-declared here (invariant 7). */
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  /** The company's rungs, for *Open to* (ADR-0035's shape: none ticked is everybody). */
  const ladder = useLadder();
  /**
   * How the office writes each of its ratios (P4-T25), by code — a ratio's code is its metric's key — so a requirement
   * on one reads as the ratio card does (P18.9-T4 AC-8). Read from the office's published configuration.
   */
  const { config } = useTenantConfig();
  const ratioUnits = ratioUnitsOf(config?.ratios);

  const load = useCallback(async () => {
    try {
      setCampaigns(await listCampaigns(true));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /*
   * Read on its own, so a failure here does not take the screen down: the registry is needed by the form alone, and an
   * office that could not see its campaigns because the vocabulary read failed would be a worse answer.
   */
  useEffect(() => { void listMetrics().then(setMetrics).catch(() => setMetrics([])); }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** When it runs, in the row's line: a structural one's window, a seasonal one's dates — or *mulai …* before it starts. */
  const whenOf = (campaign: CampaignRow) => {
    if (campaign.kind === 'structural') {
      return (t.when as Record<string, string>)[campaign.window] ?? campaign.window;
    }
    const start = officeDay(campaign.startsAt);
    if (campaign.phase === 'upcoming' || !campaign.endsAt) return t.from({ day: formatCalendarDay(start, figures) });
    const range = formatDayRange(start, officeDay(campaign.endsAt), figures);
    return campaign.phase === 'ended' ? `${range} · ${c.ended}` : range;
  };

  /** The row's line: every requirement in words, joined as the agent's card joins them (*+*), then when it runs. */
  const lineOf = (campaign: CampaignRow) => {
    const need = campaign.requirements.map((r) => readRequirement(r, ratioUnits, language, figures)).join(' + ');
    return [need, whenOf(campaign)].filter(Boolean).join(' · ');
  };

  const menuOf = (campaign: CampaignRow) => (canWrite ? (
    <ActionMenu
      label={t.more({ title: campaign.title })}
      glyph="⋯"
      triggerClassName="max-lg:h-11 max-lg:w-11"
      items={[
        { label: s.edit, onSelect: () => { setDraft(draftOf(campaign)); setEditing(campaign.id); } },
        {
          label: campaign.status === 'archived' ? s.restore : s.archive,
          tone: campaign.status === 'archived' ? 'neutral' : 'alert',
          onSelect: () => void run(() => (campaign.status === 'archived'
            ? restoreCampaign(campaign.id)
            : archiveCampaign(campaign.id))),
        },
      ]}
    />
  ) : null);

  function list(active: string) {
    if (campaigns === null) return <SkeletonCards count={3} />;
    const live = campaigns.filter((row) => showArchived || row.status === 'active');
    // Struktural first — always on —, then Musiman: upcoming, running, ended, each by date (P18.9-T4 AC-8).
    const ordered = [
      ...byPhaseAndDate(live.filter((row) => row.kind === 'structural')),
      ...byPhaseAndDate(live.filter((row) => row.kind === 'seasonal')),
    ];
    const shown = active === 'all' ? ordered : ordered.filter((row) => row.kind === active);
    return (
      <div className="overflow-hidden rounded-lg bg-card" data-campaign-list="">
        {shown.length === 0 ? (
          <EmptyState title={campaigns.length === 0 ? t.empty : t.noneOfKind} />
        ) : (
          <ul role="list" aria-label={t.title} className="m-0 list-none p-0 [&>li+li]:border-t [&>li+li]:border-divider">
            {shown.map((campaign) => (
              <li key={campaign.id} data-row={campaign.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-md font-bold text-navy">{campaign.title}</span>
                    {campaign.status === 'archived' && <ConfigBadge tone="open">{s.archivedBadge}</ConfigBadge>}
                    {/* A requirement stored before the evaluable set, naming what a campaign cannot measure (T8 AC-1). */}
                    {campaign.requirements.some((r) => r.measured === false) && <ConfigBadge tone="open">{c.notMeasured}</ConfigBadge>}
                  </span>
                  <span className="text-sm text-muted">{lineOf(campaign)}</span>
                </span>
                <TonePill tone={campaign.kind === 'structural' ? 'blue' : 'amber'} className="shrink-0">
                  {campaign.kind === 'structural' ? c.structural : c.seasonal}
                </TonePill>
                {menuOf(campaign)}
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <button
            type="button"
            disabled={busy}
            onClick={() => { setDraft(emptyDraft(active === 'structural' ? 'structural' : 'seasonal')); setEditing('new'); }}
            className="flex min-h-11 w-full items-center gap-2 border-t border-divider px-4 text-left text-base font-bold text-primary-ink hover:bg-hover-row lg:min-h-10"
          >
            <LineIcon name="plus" className="h-4 w-4" />
            {t.addCampaign}
          </button>
        )}
      </div>
    );
  }

  function panel() {
    const isNew = editing === 'new';
    const structural = draft.kind === 'structural';
    const ready = draft.title.trim() && draft.code.trim() && draft.startsAt
      && (structural ? draft.window : draft.endsAt)
      && draft.requirements.every((r) => r.metricKey && r.value.trim() !== '');
    const setRow = (key: number, fields: Partial<RequirementDraft>) =>
      setDraft((n) => ({ ...n, requirements: n.requirements.map((r) => (r.key === key ? { ...r, ...fields } : r)) }));
    return (
      <div className="flex flex-col pb-2">
        <div className="flex flex-wrap gap-3">
          <Field label={t.fieldTitle} htmlFor="c-title" className="min-w-60 flex-1">
            <TextInput
              id="c-title"
              value={draft.title}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({
                ...n,
                title: e.target.value,
                code: n.touched ? n.code : suggestCode(e.target.value),
              }))}
            />
          </Field>
          <Field
            label={s.code}
            htmlFor="c-code"
            hint={isNew ? t.codeHintNew : t.codeHintEditing}
            className="min-w-48"
          >
            <TextInput
              id="c-code"
              value={draft.code}
              disabled={busy || !isNew}
              onChange={(e) => setDraft((n) => ({
                ...n, code: e.target.value.toUpperCase(), touched: e.target.value !== '',
              }))}
            />
          </Field>
        </div>

        {/*
          * D-fields (P18.2-T7 AC-9): what the agent's card draws — the tab it sits under, its section, the window
          * it is read over, who it is for, its poster and its line. A Fill: the prototype's *+ Create campaign*
          * is an `alert()` (`KPM_Owner.html:1681`), so no form is drawn; the field names are the agent screen's.
          */}
        <div className="mt-3 flex flex-wrap gap-3">
          <Field label={t.kind} htmlFor="c-kind" className="min-w-40">
            <Select
              id="c-kind"
              value={draft.kind}
              disabled={busy}
              onChange={(e) => {
                const kind = e.target.value as CampaignKindCode;
                setDraft((n) => ({
                  ...n,
                  kind,
                  window: kind === 'structural' ? (n.window === 'campaign_dates' ? 'rolling_12m' : n.window) : 'campaign_dates',
                }));
              }}
            >
              <option value="seasonal">{c.seasonal}</option>
              <option value="structural">{c.structural}</option>
            </Select>
          </Field>
          {structural && (
            <>
              <Field label={t.readOver} htmlFor="c-window" className="min-w-48">
                <Select
                  id="c-window"
                  value={draft.window}
                  disabled={busy}
                  onChange={(e) => setDraft((n) => ({ ...n, window: e.target.value as CampaignWindowCode }))}
                >
                  <option value="rolling_12m">{t.windows.rolling_12m}</option>
                  <option value="calendar_year">{t.windows.calendar_year}</option>
                </Select>
              </Field>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <Field
            label={t.starts}
            htmlFor="c-starts"
            hint={structural ? undefined : t.startsHint}
            className="min-w-48 flex-1"
          >
            <DateField
              id="c-starts"
              value={draft.startsAt}
              disabled={busy}
              onChange={(startsAt) => setDraft((n) => ({ ...n, startsAt }))}
              className="w-full"
            />
          </Field>
          {!structural && (
            <Field label={t.ends} htmlFor="c-ends" className="min-w-48 flex-1">
              <DateField
                id="c-ends"
                value={draft.endsAt}
                disabled={busy}
                onChange={(endsAt) => setDraft((n) => ({ ...n, endsAt }))}
                className="w-full"
              />
            </Field>
          )}
        </div>

        <fieldset className="mt-3">
          <legend className="mb-1 text-sm font-semibold text-navy">{t.openTo}</legend>
          <p id="c-rungs-hint" className="mb-1.5 text-sm text-muted">{t.openToHint}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5" aria-describedby="c-rungs-hint">
            {ladder.map((rung) => (
              <label key={rung.code} className={cn('flex items-center gap-2 text-md text-navy', CHECK_LINE_TOUCH)}>
                <input
                  type="checkbox"
                  checked={draft.rungs.includes(rung.code)}
                  disabled={busy}
                  onChange={(e) => setDraft((n) => ({
                    ...n,
                    rungs: e.target.checked ? [...n.rungs, rung.code] : n.rungs.filter((c) => c !== rung.code),
                  }))}
                />
                {rung.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label={t.posterEmoji} htmlFor="c-emoji" className="w-32">
            <TextInput
              id="c-emoji"
              value={draft.emoji}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, emoji: e.target.value }))}
            />
          </Field>
          <Field label={t.posterColour} htmlFor="c-color" className="min-w-40">
            <Select
              id="c-color"
              value={draft.color}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, color: e.target.value as PosterColor }))}
            >
              {POSTER_COLORS.map((colour) => <option key={colour} value={colour}>{t.colours[colour]}</option>)}
            </Select>
          </Field>
          {/* The poster as the card draws it, so the colour is seen and not only named. */}
          <span
            aria-hidden="true"
            data-poster-preview
            className={cn('flex h-10 w-16 items-center justify-center rounded-md text-xl', POSTER_FILL[draft.color])}
          >
            {draft.emoji}
          </span>
        </div>

        <Field label={t.cardLine} htmlFor="c-blurb" hint={t.cardLineHint} className="mt-3">
          <TextInput
            id="c-blurb"
            value={draft.blurb}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, blurb: e.target.value }))}
          />
        </Field>

        <Field label={s.description} htmlFor="c-description" hint={t.descriptionHint} className="mt-3">
          <Textarea
            id="c-description"
            value={draft.description}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, description: e.target.value }))}
          />
        </Field>

        {/*
          * **Every requirement, each a row** (P18.2-T7 AC-9): the metric, its comparison as stored and its target,
          * *Remove* on each and *+ Add requirement* beneath. The prototype draws no form (`Owner:1681`); one row was
          * this form's first draft, and saving an edit of a campaign holding two dropped the second. A Fill, the
          * smallest that keeps a campaign's requirements whole.
          */}
        <fieldset className="mt-3" aria-describedby="c-requirements-hint">
          <legend className="mb-1 text-sm font-semibold text-navy">{t.toReach}</legend>
          <p id="c-requirements-hint" className="mb-1.5 text-sm text-muted">{t.toReachHint}</p>
          <ul className="flex flex-col gap-2.5">
            {draft.requirements.map((row, i) => {
              const n = i + 1;
              const metric = metrics.find((m) => m.key === row.metricKey);
              const measurable = metrics.some((m) => m.key === row.metricKey && m.campaign);
              const unit = metric?.unit ?? row.stored?.unit;
              // A metric another row names is not offered again: the API refuses two requirements on one metric.
              const taken = new Set(draft.requirements.filter((r) => r.key !== row.key).map((r) => r.metricKey));
              return (
                <li key={row.key} className="flex flex-wrap items-end gap-3" data-requirement-row>
                  <Field label={t.requirementN({ n })} htmlFor={`c-metric-${row.key}`} className="min-w-56 flex-1">
                    <Select
                      id={`c-metric-${row.key}`}
                      value={row.metricKey}
                      disabled={busy}
                      onChange={(e) => setRow(row.key, { metricKey: e.target.value })}
                    >
                      <option value="" disabled>{t.chooseMetric}</option>
                      {/*
                        * From the registry, not from this file (P5-T9, invariant 7), and only the metrics a campaign
                        * can measure (P18.2-T8 AC-1, D-evaluable): a production figure over whole months, logged
                        * activity, the five ratios, a unit's active agents.
                        */}
                      {metrics.filter((m) => m.campaign).map((m) => (
                        <option key={m.key} value={m.key} disabled={taken.has(m.key)}>{m.name}</option>
                      ))}
                      {/* A requirement stored before the set existed stays on its own campaign, and goes back unchanged. */}
                      {row.metricKey && !measurable && (
                        <option value={row.metricKey}>
                          {t.notMeasuredOption({ name: metric?.name ?? row.stored?.metricName ?? row.metricKey })}
                        </option>
                      )}
                    </Select>
                  </Field>
                  <Field
                    label={<><span className="sr-only">{t.requirementBefore({ n })}</span>{t.comparison}</>}
                    htmlFor={`c-comparator-${row.key}`}
                    className="min-w-36"
                  >
                    <Select
                      id={`c-comparator-${row.key}`}
                      value={row.comparator}
                      disabled={busy}
                      onChange={(e) => setRow(row.key, { comparator: e.target.value })}
                    >
                      {COMPARATORS.map((value) => (
                        <option key={value} value={value}>{t.comparators[value]}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label={<><span className="sr-only">{t.requirementBefore({ n })}</span>{unit === 'idr_minor' ? t.targetMoney({ mark: moneyPrefix(figures) }) : t.target}</>}
                    htmlFor={`c-value-${row.key}`}
                    className="min-w-40"
                  >
                    <TextInput
                      id={`c-value-${row.key}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.value}
                      disabled={busy}
                      onChange={(e) => setRow(row.key, { value: e.target.value })}
                    />
                  </Field>
                  <Button
                    variant="inlineDanger"
                    disabled={busy}
                    aria-label={t.removeRequirement({ n })}
                    className="mb-2.5"
                    onClick={() => setDraft((d) => ({ ...d, requirements: d.requirements.filter((r) => r.key !== row.key) }))}
                  >
                    {s.remove}
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            variant="secondary"
            disabled={busy}
            className="mt-2.5"
            onClick={() => setDraft((d) => ({ ...d, requirements: [...d.requirements, blankRequirement()] }))}
          >
            {t.addRequirement}
          </Button>
        </fieldset>

        <Field label={t.rewardField} htmlFor="c-reward" className="mt-3">
          <TextInput
            id="c-reward"
            value={draft.reward}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, reward: e.target.value }))}
          />
        </Field>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy || !ready}
            onClick={() => void run(async () => {
              // Every row, in order; an untouched one exactly as it was stored.
              const requirements = draft.requirements.map((row) => requirementBody(row, metrics));
              const body = {
                title: draft.title.trim(),
                kind: draft.kind,
                // *Struktural* or *Musiman*, nothing else (ADR-0282 §5): a new campaign has no subtype, a seasonal one
                // never, and a structural one being edited keeps whatever it was stored with.
                ...(structural && !isNew ? {} : { subtype: null }),
                window: structural ? draft.window : 'campaign_dates',
                appliesToOrgLevelCodes: draft.rungs,
                poster: { emoji: draft.emoji.trim(), color: draft.color },
                blurb: draft.blurb.trim(),
                description: draft.description.trim(),
                startsAt: toInstant(draft.startsAt, 'start'),
                endsAt: structural ? null : toInstant(draft.endsAt, 'end'),
                reward: draft.reward.trim(),
                requirements,
              };
              if (isNew) await createCampaign({ ...body, code: draft.code.trim() });
              else await updateCampaign(editing!, body);
              setEditing(null);
            })}
          >
            {isNew ? t.addTheCampaign : t.saveTheCampaign}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>{s.cancel}</Button>
        </div>
      </div>
    );
  }

  const editingRow = editing && editing !== 'new' ? campaigns?.find((row) => row.id === editing) ?? null : null;
  const count = (kind: Filter) => (campaigns ?? [])
    .filter((row) => (showArchived || row.status === 'active') && (kind === 'all' || row.kind === kind)).length;

  return (
    <SettingsScreen
      title={t.title}
      permission="campaign_settings:read"
      error={campaigns === null ? error : null}
      bars={<PublishBar />}
    >
      {error && campaigns !== null && (
        <div role="alert" className="mb-4 rounded-md border border-primary bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}
      {campaigns === null ? (error ? null : <SkeletonCards count={3} />) : (
        <div className="flex flex-col gap-3">
          <Segmented
            label={t.filterLabel}
            tabs={[
              { id: 'all', label: t.filter.all({ n: count('all') }) },
              { id: 'structural', label: t.filter.structural({ n: count('structural') }) },
              { id: 'seasonal', label: t.filter.seasonal({ n: count('seasonal') }) },
            ]}
            active={filter}
            onSelect={(id) => setFilter(id as Filter)}
          >
            {(active) => list(active)}
          </Segmented>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-muted">
            <span>{t.noteStructural}</span>
            <span>{t.noteSeasonal}</span>
            <label className={cn('inline-flex items-center gap-2', ARCHIVED_SWITCH_ROW)}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {s.showArchived}
            </label>
          </div>
        </div>
      )}
      <ResponsiveSheet
        open={editing !== null}
        title={editing === 'new' ? t.addCampaign : editingRow?.title ?? ''}
        onClose={() => setEditing(null)}
      >
        {editing !== null && panel()}
      </ResponsiveSheet>
    </SettingsScreen>
  );
}

function draftOf(campaign: CampaignRow) {
  return {
    title: campaign.title,
    code: campaign.code,
    touched: true,
    kind: campaign.kind,
    window: campaign.window,
    rungs: campaign.appliesToOrgLevelCodes,
    emoji: campaign.poster.emoji,
    color: (POSTER_COLORS as readonly string[]).includes(campaign.poster.color) ? campaign.poster.color as PosterColor : 'navy',
    blurb: campaign.blurb,
    description: campaign.description,
    startsAt: localDate(campaign.startsAt),
    endsAt: localDate(campaign.endsAt),
    reward: campaign.reward,
    requirements: campaign.requirements.map(requirementDraft),
  };
}

/** A new campaign's form: *Musiman* unless it is opened from *Struktural*'s filter. */
function emptyDraft(kind: CampaignKindCode = 'seasonal') {
  return {
    title: '', code: '', touched: false,
    kind, window: (kind === 'structural' ? 'calendar_year' : 'campaign_dates') as CampaignWindowCode,
    rungs: [] as string[],
    // A poster to start from, which the Owner changes; the preview beside the fields shows it.
    emoji: '🎯', color: 'navy' as PosterColor,
    blurb: '', description: '', startsAt: '', endsAt: '',
    reward: '', requirements: [] as RequirementDraft[],
  };
}
