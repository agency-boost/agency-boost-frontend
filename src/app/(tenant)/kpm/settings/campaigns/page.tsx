'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, Field, Select, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import {
  archiveCampaign, createCampaign, listCampaigns, listMetrics, listQualificationRules, restoreCampaign,
  updateCampaign,
  type CampaignRow, type MetricDefinition, type QualificationRuleRow, type RequirementView,
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

const toInstant = (value: string) => (value ? new Date(value).toISOString() : '');
const localDate = (iso: string) => iso.slice(0, 10);

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
  const [tab, setTab] = useState('#campaigns');
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [rules, setRules] = useState<QualificationRuleRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  /** The product's own metric vocabulary, read rather than re-declared here (invariant 7). */
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);

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
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-md font-semibold text-navy">{campaign.title}</h2>
                      {campaign.description && (
                        <p className="mt-0.5 text-sm text-muted">{campaign.description}</p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="text-sm text-muted">{campaign.code}</code>
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
                            <li key={r.metricKey} className="text-md text-navy">
                              {readRequirement(r)}
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
                          variant="secondary"
                          disabled={busy}
                          onClick={() => { setDraft(draftOf(campaign)); setEditing(campaign.id); }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
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

        <div className="mt-3 flex flex-wrap gap-3">
          <Field label="Starts" htmlFor="c-starts" className="min-w-48 flex-1">
            <TextInput
              id="c-starts"
              type="date"
              value={draft.startsAt}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, startsAt: e.target.value }))}
            />
          </Field>
          <Field label="Ends" htmlFor="c-ends" className="min-w-48 flex-1">
            <TextInput
              id="c-ends"
              type="date"
              value={draft.endsAt}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, endsAt: e.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <Field
            label="What has to be reached"
            htmlFor="c-metric"
            hint="Only what this product actually measures — a target nothing computes could never be reached."
            className="min-w-60 flex-1"
          >
            <Select
              id="c-metric"
              value={draft.metricKey}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, metricKey: e.target.value }))}
            >
              <option value="">Nothing — this campaign is not measured</option>
              {/*
                * From the registry, not from this file (P5-T9, invariant 7).
                *
                * Five metrics were listed here by hand. That is a second definition of the
                * product's own vocabulary — the one that disagrees is whichever nobody
                * remembered to update — and it could not offer the other thirty. Only what is
                * computed by the phase campaigns are evaluated in is offered: a target nothing
                * computes could never be reached.
                */}
              {metrics.filter((m) => m.computed).map((metric) => (
                <option key={metric.key} value={metric.key}>{metric.name}</option>
              ))}
            </Select>
          </Field>
          {draft.metricKey && (
            <Field
              label={metrics.find((m) => m.key === draft.metricKey)?.unit === 'idr_minor'
                ? 'At least (Rp)' : 'At least'}
              htmlFor="c-value"
              className="min-w-40"
            >
              <TextInput
                id="c-value"
                type="number"
                value={draft.value}
                disabled={busy}
                onChange={(e) => setDraft((n) => ({ ...n, value: e.target.value }))}
              />
            </Field>
          )}
        </div>

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
            disabled={busy || !draft.title.trim() || !draft.code.trim()
              || !draft.startsAt || !draft.endsAt}
            onClick={() => void run(async () => {
              const requirements = draft.metricKey
                ? [{
                  metricKey: draft.metricKey,
                  comparator: 'gte',
                  // Rupiah in, integer sen stored: money is never a float (invariant §9).
                  value: draft.metricKey === 'APE_ACHIEVED'
                    ? Math.round(Number(draft.value || 0) * 100)
                    : Number(draft.value || 0),
                }]
                : [];
              const body = {
                title: draft.title.trim(),
                startsAt: toInstant(draft.startsAt),
                endsAt: toInstant(draft.endsAt),
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
                      <p className="mt-1 text-sm text-muted">
                        This one cannot be worked out yet: it needs{' '}
                        {rule.waitingOnMetrics.join(', ')}, which this product does not measure
                        until the production figures arrive. Nothing here guesses them.
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
      permission="tenant_config:read"
      subtabs={TABS}
      activeSubtab={tab}
      onSelectSubtab={setTab}
      subtabsLabel="Campaign sections"
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
  const first = campaign.requirements[0];
  return {
    title: campaign.title,
    code: campaign.code,
    touched: true,
    startsAt: localDate(campaign.startsAt),
    endsAt: localDate(campaign.endsAt),
    reward: campaign.reward,
    metricKey: first?.metricKey ?? '',
    value: first
      ? String(first.unit === 'idr_minor' ? first.value / 100 : first.value)
      : '',
  };
}

function emptyDraft() {
  return {
    title: '', code: '', touched: false, startsAt: '', endsAt: '',
    reward: '', metricKey: '', value: '',
  };
}
