'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { POSTER_FILL } from '@/components/campaigns/campaign-parts';
import { useLadder } from '@/components/ui/role-badge';
import { Button, Card, Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { officeDay, officeDayEdge, POSTER_COLORS, type PosterColor } from '@/lib/campaigns';
import { cn } from '@/lib/cn';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import { useHashTab } from '@/lib/use-hash-tab';
import {
  archiveCampaign, createCampaign, listCampaigns, listMetrics, listQualificationRules, restoreCampaign,
  updateCampaign,
  type CampaignKindCode, type CampaignRow, type CampaignSubtypeCode, type CampaignWindowCode, type MetricDefinition,
  type QualificationRuleRow, type RequirementView,
} from '@/lib/tenant-config';

const TABS = [
  { label: 'Campaigns', href: '#campaigns' },
  { label: 'Production club tiers', href: '#tiers' },
];

const PHASE: Record<string, { tone: 'won' | 'open'; text: string }> = {
  upcoming: { tone: 'open', text: 'Upcoming' },
  running: { tone: 'won', text: 'Running' },
  ended: { tone: 'open', text: 'Ended' },
};

const COMPARATOR: Record<string, string> = {
  gte: 'at least', gt: 'more than', lte: 'at most', lt: 'less than', eq: 'exactly',
};

/**
 * One requirement in words.
 *
 * `idr_minor` is integer sen, rendered as rupiah — the prototype stores *"Rp 600,000,000"* as a
 * display string and one campaign's reward in **pesos**, so neither can be compared or totalled.
 */
function readRequirement(r: RequirementView): string {
  if (r.unit === 'idr_minor') {
    const rupiah = r.value / 100;
    return `${r.metricName} ${COMPARATOR[r.comparator] ?? r.comparator} `
      + `Rp ${rupiah.toLocaleString('id-ID')}`;
  }
  if (r.unit === 'percentage') return `${r.metricName} ${COMPARATOR[r.comparator]} ${r.value}%`;
  return `${r.metricName} ${COMPARATOR[r.comparator] ?? r.comparator} ${r.value}`;
}

/**
 * A day in the form, as the office's instant (ADR-0016): its first moment, or its last — so a campaign from
 * Oct 1 to Dec 31 runs in whole office months whatever zone the browser is in (D-windows). It read
 * `new Date(day)`, which is midnight UTC, 07:00 in Jakarta.
 */
const toInstant = (day: string, edge: 'start' | 'end') => (day ? officeDayEdge(day, edge) : '');
const localDate = (iso: string | null) => (iso ? officeDay(iso) : '');

/**
 * One requirement in the form (P18.5-T7 AC-9): its metric, its comparator **as stored**, and its target as typed
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
    // Rupiah in, integer sen stored: money is never a float (invariant §9). By the metric's unit.
    value: unit === 'idr_minor' ? Math.round(Number(row.value || 0) * 100) : Number(row.value || 0),
  };
}

/** The poster palette's names, in words, for the form's colour list (D-fields). */
const COLOR_LABEL: Record<PosterColor, string> = {
  amber: 'Amber', 'amber-dark': 'Dark amber', navy: 'Navy', 'navy-soft': 'Soft navy', muted: 'Grey', success: 'Green', gold: 'Gold',
};

/**
 * An office's campaigns, and the carrier rules it is measured against (P5-T7, ADR-0026).
 *
 * **Two things that look alike and behave differently, on one screen.** *Year-End Star Club Drive*
 * is this office's campaign and fully editable; *Star Club* is the insurer's recognition tier and
 * editable by nobody in any office. The tiers tab is read-only **with the reason on the card**,
 * rather than inert controls beside live ones (parity I-76).
 */
export default function CampaignsSettingsPage() {
  const canWrite = useCan('tenant_config:write');
  const [tab, setTab] = useHashTab(TABS);
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [rules, setRules] = useState<QualificationRuleRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  /** The product's own metric vocabulary, read rather than re-declared here (invariant 7). */
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  /** The company's rungs, for *Open to* (ADR-0035's shape: none ticked is everybody). */
  const ladder = useLadder();

  const load = useCallback(async () => {
    try {
      const [rows, carrier] = await Promise.all([listCampaigns(true), listQualificationRules()]);
      setCampaigns(rows);
      setRules(carrier);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /*
   * Read on its own, so a failure here does not take the screen down.
   *
   * The registry is needed by one form on one tab. Folding it into `load` would mean an office
   * could not see its campaigns at all because the vocabulary read failed — a worse answer than
   * an Add form that offers nothing to measure.
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

  function campaignsTab() {
    if (campaigns === null) return <SkeletonCards count={3} />;
    const shown = campaigns.filter((c) => showArchived || c.status === 'active');

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-md text-navy">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          {canWrite && (
            <Button
              disabled={busy || editing !== null}
              onClick={() => { setDraft(emptyDraft()); setEditing('new'); }}
            >
              Add a campaign
            </Button>
          )}
        </div>

        {editing && panel()}

        {shown.length === 0 ? (
          <EmptyState title="No campaigns yet. A campaign is something your office runs, with a requirement your agents can actually be measured against." />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((campaign) => (
              <li key={campaign.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-md font-semibold text-navy">{campaign.title}</h2>
                      {campaign.description && (
                        <p className="mt-0.5 text-sm text-muted">{campaign.description}</p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <ConfigBadge tone={PHASE[campaign.phase].tone}>
                          {PHASE[campaign.phase].text}
                        </ConfigBadge>
                        <ConfigBadge tone="open">Your office’s</ConfigBadge>
                        {campaign.status === 'archived' && (
                          <ConfigBadge tone="open">Archived</ConfigBadge>
                        )}
                      </p>
                      {campaign.requirements.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1">
                          {campaign.requirements.map((r) => (
                            <li key={r.metricKey} className="flex flex-wrap items-center gap-2 text-md text-navy">
                              {readRequirement(r)}
                              {/* A requirement stored before the evaluable set, naming what a campaign cannot measure (T8 AC-1). */}
                              {r.measured === false && <ConfigBadge tone="open">Not measured yet</ConfigBadge>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {campaign.reward && (
                        <p className="mt-1 text-sm text-muted">Reward: {campaign.reward}</p>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="inline"
                          disabled={busy}
                          onClick={() => { setDraft(draftOf(campaign)); setEditing(campaign.id); }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="inlineDanger"
                          disabled={busy}
                          onClick={() => void run(() => (campaign.status === 'archived'
                            ? restoreCampaign(campaign.id)
                            : archiveCampaign(campaign.id)))}
                        >
                          {campaign.status === 'archived' ? 'Restore' : 'Archive'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function panel() {
    const isNew = editing === 'new';
    const structural = draft.kind === 'structural';
    const ready = draft.title.trim() && draft.code.trim() && draft.startsAt
      && (structural ? draft.subtype && draft.window : draft.endsAt)
      && draft.requirements.every((r) => r.metricKey && r.value.trim() !== '');
    const setRow = (key: number, fields: Partial<RequirementDraft>) =>
      setDraft((n) => ({ ...n, requirements: n.requirements.map((r) => (r.key === key ? { ...r, ...fields } : r)) }));
    return (
      <Card>
        <div className="flex flex-wrap gap-3">
          <Field label="Title" htmlFor="c-title" className="min-w-60 flex-1">
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
            label="Code"
            htmlFor="c-code"
            hint={isNew ? 'Filled in from the title. Permanent.' : 'Permanent — it never changes.'}
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
          * D-fields (P18.5-T7 AC-9): what the agent's card draws — the tab it sits under, its section, the window
          * it is read over, who it is for, its poster and its line. A Fill: the prototype's *+ Create campaign*
          * is an `alert()` (`KPM_Owner.html:1681`), so no form is drawn; the field names are the agent screen's.
          */}
        <div className="mt-3 flex flex-wrap gap-3">
          <Field label="Kind" htmlFor="c-kind" className="min-w-40">
            <Select
              id="c-kind"
              value={draft.kind}
              disabled={busy}
              onChange={(e) => {
                const kind = e.target.value as CampaignKindCode;
                setDraft((n) => ({
                  ...n,
                  kind,
                  subtype: kind === 'structural' ? (n.subtype || 'promotion') : '',
                  window: kind === 'structural' ? (n.window === 'campaign_dates' ? 'rolling_12m' : n.window) : 'campaign_dates',
                }));
              }}
            >
              <option value="seasonal">Seasonal</option>
              <option value="structural">Structural</option>
            </Select>
          </Field>
          {structural && (
            <>
              <Field label="Section" htmlFor="c-subtype" className="min-w-48">
                <Select
                  id="c-subtype"
                  value={draft.subtype}
                  disabled={busy}
                  onChange={(e) => setDraft((n) => ({ ...n, subtype: e.target.value as CampaignSubtypeCode }))}
                >
                  <option value="promotion">Promotion Criteria</option>
                  <option value="ongoing">Production Clubs</option>
                </Select>
              </Field>
              <Field label="Read over" htmlFor="c-window" className="min-w-48">
                <Select
                  id="c-window"
                  value={draft.window}
                  disabled={busy}
                  onChange={(e) => setDraft((n) => ({ ...n, window: e.target.value as CampaignWindowCode }))}
                >
                  <option value="rolling_12m">The last 12 months</option>
                  <option value="calendar_year">Each calendar year</option>
                </Select>
              </Field>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <Field
            label="Starts"
            htmlFor="c-starts"
            hint={structural ? undefined : 'Asking for production figures, it runs in whole months: from a 1st to a month’s last day.'}
            className="min-w-48 flex-1"
          >
            <TextInput
              id="c-starts"
              type="date"
              value={draft.startsAt}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, startsAt: e.target.value }))}
            />
          </Field>
          {!structural && (
            <Field label="Ends" htmlFor="c-ends" className="min-w-48 flex-1">
              <TextInput
                id="c-ends"
                type="date"
                value={draft.endsAt}
                disabled={busy}
                onChange={(e) => setDraft((n) => ({ ...n, endsAt: e.target.value }))}
              />
            </Field>
          )}
        </div>

        <fieldset className="mt-3">
          <legend className="mb-1 text-sm font-semibold text-navy">Open to</legend>
          <p id="c-rungs-hint" className="mb-1.5 text-sm text-muted">Tick none and it is open to everybody.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5" aria-describedby="c-rungs-hint">
            {ladder.map((rung) => (
              <label key={rung.code} className="flex items-center gap-2 text-md text-navy">
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
          <Field label="Poster emoji" htmlFor="c-emoji" className="w-32">
            <TextInput
              id="c-emoji"
              value={draft.emoji}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, emoji: e.target.value }))}
            />
          </Field>
          <Field label="Poster colour" htmlFor="c-color" className="min-w-40">
            <Select
              id="c-color"
              value={draft.color}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, color: e.target.value as PosterColor }))}
            >
              {POSTER_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}
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

        <Field label="Card line" htmlFor="c-blurb" hint="One line under the title on the agent’s card." className="mt-3">
          <TextInput
            id="c-blurb"
            value={draft.blurb}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, blurb: e.target.value }))}
          />
        </Field>

        <Field label="Description" htmlFor="c-description" hint="What the campaign’s details open to." className="mt-3">
          <Textarea
            id="c-description"
            value={draft.description}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, description: e.target.value }))}
          />
        </Field>

        {/*
          * **Every requirement, each a row** (P18.5-T7 AC-9): the metric, its comparison as stored and its target,
          * *Remove* on each and *+ Add requirement* beneath. The prototype draws no form (`Owner:1681`); one row was
          * this form's first draft, and saving an edit of a campaign holding two dropped the second. A Fill, the
          * smallest that keeps a campaign's requirements whole.
          */}
        <fieldset className="mt-3" aria-describedby="c-requirements-hint">
          <legend className="mb-1 text-sm font-semibold text-navy">What has to be reached</legend>
          <p id="c-requirements-hint" className="mb-1.5 text-sm text-muted">
            Only what a campaign can measure — a target nothing computes could never be reached. None, and the campaign is not measured.
          </p>
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
                  <Field label={`Requirement ${n}`} htmlFor={`c-metric-${row.key}`} className="min-w-56 flex-1">
                    <Select
                      id={`c-metric-${row.key}`}
                      value={row.metricKey}
                      disabled={busy}
                      onChange={(e) => setRow(row.key, { metricKey: e.target.value })}
                    >
                      <option value="" disabled>Choose a metric</option>
                      {/*
                        * From the registry, not from this file (P5-T9, invariant 7), and only the metrics a campaign
                        * can measure (P18.5-T8 AC-1, D-evaluable): a production figure over whole months, logged
                        * activity, the five ratios, a unit's active agents.
                        */}
                      {metrics.filter((m) => m.campaign).map((m) => (
                        <option key={m.key} value={m.key} disabled={taken.has(m.key)}>{m.name}</option>
                      ))}
                      {/* A requirement stored before the set existed stays on its own campaign, and goes back unchanged. */}
                      {row.metricKey && !measurable && (
                        <option value={row.metricKey}>
                          {(metric?.name ?? row.stored?.metricName ?? row.metricKey)} (not measured yet)
                        </option>
                      )}
                    </Select>
                  </Field>
                  <Field
                    label={<><span className="sr-only">{`Requirement ${n} `}</span>Comparison</>}
                    htmlFor={`c-comparator-${row.key}`}
                    className="min-w-36"
                  >
                    <Select
                      id={`c-comparator-${row.key}`}
                      value={row.comparator}
                      disabled={busy}
                      onChange={(e) => setRow(row.key, { comparator: e.target.value })}
                    >
                      {Object.entries(COMPARATOR).map(([value, words]) => (
                        <option key={value} value={value}>{words}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label={<><span className="sr-only">{`Requirement ${n} `}</span>{unit === 'idr_minor' ? 'Target (Rp)' : 'Target'}</>}
                    htmlFor={`c-value-${row.key}`}
                    className="min-w-40"
                  >
                    <TextInput
                      id={`c-value-${row.key}`}
                      type="number"
                      value={row.value}
                      disabled={busy}
                      onChange={(e) => setRow(row.key, { value: e.target.value })}
                    />
                  </Field>
                  <Button
                    variant="inlineDanger"
                    disabled={busy}
                    aria-label={`Remove requirement ${n}`}
                    className="mb-2.5"
                    onClick={() => setDraft((d) => ({ ...d, requirements: d.requirements.filter((r) => r.key !== row.key) }))}
                  >
                    Remove
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
            + Add requirement
          </Button>
        </fieldset>

        <Field label="Reward" htmlFor="c-reward" className="mt-3">
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
                subtype: structural ? draft.subtype : null,
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
            {isNew ? 'Add the campaign' : 'Save the campaign'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
        </div>
      </Card>
    );
  }

  function tiersTab() {
    if (rules === null) return <SkeletonCards count={3} />;
    const tiers = rules.filter((r) => r.kind === 'production_club');
    const moc = rules.filter((r) => r.kind === 'moc');

    return (
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-md text-navy">
            <strong>These are your insurer’s, not your office’s.</strong>{' '}
            <span className="text-muted">
              Production club tiers and Maintenance of Contract are the carrier’s recognition and
              contract rules. You can see what your leaders are measured against; changing them is
              not your office’s to do — the same boundary as the Company field on Branch info.
            </span>
          </p>
        </Card>

        {([
          { heading: 'Production club tiers', rows: tiers },
          { heading: 'Maintenance of Contract', rows: moc },
        ]).map(({ heading, rows }) => (
          <Card key={heading} className="p-0">
            <div className="border-b border-hairline px-4 py-3 sm:px-5">
              <h2 className="font-display text-lg font-bold text-navy">{heading}</h2>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-3 text-md text-muted sm:px-5">Nothing here yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {rows.map((rule) => (
                  <li key={rule.id} className="px-4 py-3 sm:px-5">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-md font-semibold text-navy">{rule.name}</span>
                      {rule.appliesToOrgLevelCodes.length > 0 && (
                        <ConfigBadge tone="open">
                          {rule.appliesToOrgLevelCodes.join(', ')}
                        </ConfigBadge>
                      )}
                      {rule.waitingOnMetrics.length > 0 && (
                        <ConfigBadge tone="open">Not measured yet</ConfigBadge>
                      )}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {rule.criteriaGroups.map((group, i) => (
                        <li key={group.criteria.map((c) => c.metricKey).join('-')} className="text-md text-navy">
                          {i > 0 && (
                            <span className="text-sm font-semibold text-muted">
                              {rule.groupMode === 'any' ? 'or ' : 'and '}
                            </span>
                          )}
                          {group.criteria.map((c) => readRequirement(c)).join(
                            group.mode === 'all' ? ', and ' : ', or ',
                          )}
                        </li>
                      ))}
                    </ul>
                    {rule.reward && (
                      <p className="mt-1 text-sm text-muted">Reward: {rule.reward}</p>
                    )}
                    {rule.waitingOnMetrics.length > 0 && (
                      // The state and what it waits on, and nothing about when (ADR-0070). It read
                      // "until the production figures arrive", which was timing, and stale besides.
                      <p className="mt-1 text-sm text-muted">
                        Nothing measures {rule.waitingOnMetrics.join(', ')} yet, so this rule cannot
                        be worked out. Nothing here guesses them.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    );
  }

  return (
    <SettingsScreen
      title="Campaigns"
      subtitle="What your office is running, and what your insurer measures your leaders against."
      permission="campaign_settings:read"
      tabs={TABS}
      tabsLabel="Campaign sections"
      activeHref={tab}
      onSelectTab={setTab}
      error={campaigns === null ? error : null}
      bars={<PublishBar />}
    >
      {error && campaigns !== null && (
        <div role="alert" className="mb-4 rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}
      {tab === '#tiers' ? tiersTab() : campaignsTab()}
    </SettingsScreen>
  );
}

function draftOf(campaign: CampaignRow) {
  return {
    title: campaign.title,
    code: campaign.code,
    touched: true,
    kind: campaign.kind,
    subtype: (campaign.subtype ?? '') as CampaignSubtypeCode | '',
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

function emptyDraft() {
  return {
    title: '', code: '', touched: false,
    kind: 'seasonal' as CampaignKindCode, subtype: '' as CampaignSubtypeCode | '', window: 'campaign_dates' as CampaignWindowCode,
    rungs: [] as string[],
    // A poster to start from, which the Owner changes; the preview beside the fields shows it.
    emoji: '🎯', color: 'navy' as PosterColor,
    blurb: '', description: '', startsAt: '', endsAt: '',
    reward: '', requirements: [] as RequirementDraft[],
  };
}
