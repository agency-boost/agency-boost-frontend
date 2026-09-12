'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { PublishBar } from '@/components/publish-bar';
import { SettingsTabs } from '@/components/settings-tabs';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  archiveLeadStatus,
  createLeadStatus,
  listLeadStatuses,
  renameLeadStatus,
  reorderLeadStatuses,
  restoreLeadStatus,
  setTerminalLeadStatus,
  type LeadPipeline,
  type LeadPipelineRow,
} from '@/lib/tenant-config';

const TITLE: Record<LeadPipeline, string> = {
  sales: 'Sales',
  recruitment: 'Recruitment',
};

/**
 * The two lead pipelines (P4-T3, `KPM_Owner.html` Lead statuses).
 *
 * **The stage that closes a pipeline is marked, not implied.** The prototype gates *mark
 * successful* by comparing against the last element of a hardcoded ladder, so an office
 * adding a stage after *Paid and issued* would silently move the gate. Here it is a
 * property of one stage, shown as a badge, and moving it is a deliberate act.
 *
 * **The code is on screen beside every stage**, for the same reason it is on the activity
 * types screen: a lead holds the code, the label is free to change, and somebody about to
 * rename a stage should be able to see that the thing underneath does not move.
 */
export default function LeadStatusesPage() {
  const canWrite = useCan('tenant_config:write');
  const [pipelines, setPipelines] = useState<LeadPipelineRow[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // One pipeline at a time, as the prototype's subtabs do. Both stacked made the sales
  // ladder and the recruitment ladder read as one eleven-stage list on a narrow screen.
  const [tab, setTab] = useState<LeadPipeline>('sales');
  const [error, setError] = useState<ApiError | null>(null);
  // Bumped after any write, so the publish bar re-reads rather than going stale behind
  // an edit the Owner just made.
  const [published, setPublished] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<LeadPipeline | null>(null);
  const [draft, setDraft] = useState({ code: '', label: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const load = useCallback(async () => {
    try {
      setPipelines(await listLeadStatuses(showArchived));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [showArchived]);

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

  return (
    <Page
      title="Lead statuses"
      subtitle="The stages a lead moves through. One ladder for sales, one for recruitment."
      permission="tenant_config:read"
    >
      {error && <ErrorBanner {...error} />}
      <PublishBar refreshKey={published} />

      <SettingsTabs
        tabs={[
          { label: 'Sales', href: 'sales' },
          { label: 'Recruitment', href: 'recruitment' },
        ]}
        activeHref={tab}
        onSelect={(href) => setTab(href as LeadPipeline)}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* The prototype's own sentence, per tab — it says what the order is *for*, which
            is the one thing a drag handle cannot. */}
        <p className="text-sm text-muted">
          {pipelines === null
            ? '\u00a0'
            : `${pipelines.find((p) => p.pipeline === tab)?.statuses
              .filter((st) => st.status === 'active').length ?? 0} statuses — `
              + 'order determines the pipeline stage sequence'}
        </p>
        <label className="flex items-center gap-2 text-md text-navy">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {pipelines === null ? (
        <SkeletonCards count={1} />
      ) : (
        <div className="flex flex-col gap-4">
          {pipelines.filter((p) => p.pipeline === tab).map((pipeline) => (
            <Card key={pipeline.pipeline}>
              <h2 className="font-display text-lg font-bold text-navy">
                {TITLE[pipeline.pipeline]}
              </h2>

              <ol className="mt-3 flex flex-col divide-y divide-hairline">
                {pipeline.statuses.map((stage, index) => (
                  <li key={stage.id} className="flex flex-wrap items-start gap-3 py-3">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-navy"
                      aria-hidden
                    >
                      {stage.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      {editing === stage.id ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <Field label="Label" htmlFor={`label-${stage.id}`} className="min-w-60 flex-1">
                            <TextInput
                              id={`label-${stage.id}`}
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                            />
                          </Field>
                          <Button
                            disabled={!editLabel.trim() || busy}
                            onClick={() => void run(async () => {
                              await renameLeadStatus(stage.id, editLabel);
                              setEditing(null);
                            })}
                          >
                            Save
                          </Button>
                          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <p className="flex flex-wrap items-center gap-2 text-md text-navy">
                            {stage.label}
                            {/* `cfg-badge`, both states. The prototype badges every row —
                                an unbadged one reads as a row whose state failed to load,
                                and *Open* is the thing most stages actually are. */}
                            {stage.isTerminal ? (
                              <span className="rounded-full bg-amber px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-navy">
                                Closes the pipeline
                              </span>
                            ) : (
                              <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-muted">
                                Open
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-sm text-muted">
                            <code>{stage.code}</code>
                            {stage.status === 'archived' && ' · archived'}
                          </p>
                        </>
                      )}
                    </div>

                    {canWrite && editing !== stage.id && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          aria-label={`Move ${stage.label} up`}
                          disabled={busy || index === 0}
                          onClick={() => {
                            const ids = pipeline.statuses.map((s) => s.id);
                            [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                            void run(() => reorderLeadStatuses(pipeline.pipeline, ids));
                          }}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="secondary"
                          aria-label={`Move ${stage.label} down`}
                          disabled={busy || index === pipeline.statuses.length - 1}
                          onClick={() => {
                            const ids = pipeline.statuses.map((s) => s.id);
                            [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                            void run(() => reorderLeadStatuses(pipeline.pipeline, ids));
                          }}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => { setEditing(stage.id); setEditLabel(stage.label); }}
                        >
                          Edit
                        </Button>
                        {!stage.isTerminal && stage.status === 'active' && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void run(() => setTerminalLeadStatus(stage.id))}
                          >
                            Make this close the pipeline
                          </Button>
                        )}
                        {stage.status === 'active' ? (
                          <Button
                            variant="danger"
                            disabled={busy || stage.isTerminal}
                            title={stage.isTerminal
                              ? 'Make another stage close the pipeline first.'
                              : undefined}
                            onClick={() => void run(() => archiveLeadStatus(stage.id))}
                          >
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void run(() => restoreLeadStatus(stage.id))}
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>

              {canWrite && (adding === pipeline.pipeline ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
                  <Field
                    label="Code"
                    htmlFor={`code-${pipeline.pipeline}`}
                    hint="Permanent. Every lead holds it."
                    className="min-w-48"
                  >
                    <TextInput
                      id={`code-${pipeline.pipeline}`}
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      placeholder="AWAITING_UNDERWRITING"
                    />
                  </Field>
                  <Field label="Label" htmlFor={`new-${pipeline.pipeline}`} className="min-w-60 flex-1">
                    <TextInput
                      id={`new-${pipeline.pipeline}`}
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    />
                  </Field>
                  <Button
                    disabled={!draft.code.trim() || !draft.label.trim() || busy}
                    onClick={() => void run(async () => {
                      await createLeadStatus({
                        pipeline: pipeline.pipeline, code: draft.code, label: draft.label,
                      });
                      setAdding(null);
                      setDraft({ code: '', label: '' });
                    })}
                  >
                    Add
                  </Button>
                  <Button variant="secondary" onClick={() => setAdding(null)}>Cancel</Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setAdding(pipeline.pipeline);
                    setDraft({ code: '', label: '' });
                  }}
                >
                  Add a {TITLE[pipeline.pipeline].toLowerCase()} stage
                </Button>
              ))}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
