'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { DragHandle } from '@/components/ui/drag-handle';
import {
  Button, Card, CodeField, Field, FieldRow, Switch, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineSaveStatus, useInlineSave } from '@/components/ui/inline-save-status';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import {
  archiveLeadStatus,
  createLeadStatus,
  listLeadStatuses,
  renameLeadStatus,
  reorderLeadStatuses,
  restoreLeadStatus,
  setLateStageLeadStatus,
  setTerminalLeadStatus,
  type LeadPipeline,
  type LeadPipelineRow,
} from '@/lib/tenant-config';

const TITLE: Record<LeadPipeline, string> = {
  sales: 'Sales',
  recruitment: 'Recruitment',
};

/** A stage's *Expected to close* switch, in its *Saving… → Saved ✓* (P18.95-T1 AC-5). */
const lateKey = (stageId: string) => `${stageId}\nlate`;

/** Why the stage that closes a pipeline cannot be archived: *Archive*'s tooltip, and its reason behind ⋮. */
const CLOSING_STAGE_KEPT = 'Make another stage close the pipeline first.';

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
 *
 * **`Expected to close` is a switch, and it is the only thing that says so** (ADR-0043). It
 * decides which stages the KPM Overview's *Expected to close* tile counts — the tile that
 * could not be computed at all until this flag existed. A reader who cannot write sees a
 * badge instead; nobody sees both, because a badge beside a switch is two controls
 * answering one question and whichever one a reader trusts, the other contradicts it.
 */
export default function LeadStatusesPage() {
  const canWrite = useCan('tenant_config:write');
  const [pipelines, setPipelines] = useState<LeadPipelineRow[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  /* Off the list, on in the edit panel, one click away here — the same rule and the same
     control as the other two settings screens (P4-T24, parity I-64). */
  // One pipeline at a time, as the prototype's subtabs do. Both stacked made the sales
  // ladder and the recruitment ladder read as one eleven-stage list on a narrow screen.
  const [tab, setTab] = useState<LeadPipeline>('sales');
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // Bumped after any write, so the publish bar re-reads rather than going stale behind
  // an edit the Owner just made.
  const [published, setPublished] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<LeadPipeline | null>(null);
  const [draft, setDraft] = useState({ code: '', label: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const inline = useInlineSave();
  /*
   * **On a phone, one ⋮ and the switch on a line of its own** (P18.97-T7 AC-3, ADR-0178 §5; the client's UI-035: each
   * row's *Edit · Expected to close · Make this close the pipeline · Archive* reached 449px on a 375px screen, and the
   * page scrolled sideways). Asked of the window here, where the screen mounts; from 768px the row is as it was — the
   * client's *Don't change* for a desktop.
   */
  const phone = usePhone();

  /*
   * **On a phone the focus follows *Edit*** (WCAG 2.4.3): chosen behind ⋮, it opens the label's field and the ⋮ goes, so
   * the field takes the focus; once the field closes — saved or not — the stage's ⋮ has it back.
   */
  const editingWas = useRef<string | null>(null);
  useEffect(() => {
    const was = editingWas.current;
    editingWas.current = editing;
    if (!phone) return;
    if (editing !== null && editing !== was) document.getElementById(`label-${editing}`)?.focus();
    if (was !== null && was !== editing) {
      document.querySelector<HTMLElement>(`[data-stage="${was}"] button[aria-haspopup="menu"]`)?.focus();
    }
  }, [editing, phone]);

  /**
   * A stage's actions behind ⋮, in the row's order and words — held while a write is out, as the row's are.
   *
   * **On a phone the ⋮ also moves the stage, first, as the ⠿ is first on the row** (P18.97-T8 F3, parity F-257;
   * ADR-0178 §5's ↑ and ↓ for a list reordered by drag): a drag never starts on a touch screen and the ⠿'s ↑ ↓ keys need
   * a keyboard, so a phone could not reorder the ladder at all. *Move up* and *Move down* — `ReorderArrows`' words —
   * make the move the ⠿'s keys make (`moveStage`, the same reorder call). At the ends of the stages the reader sees
   * (`at` of `count`) the one that cannot move stays, held (`aria-disabled`), as the arrows do. The ⋮ keeps the focus:
   * `ActionMenu` gives it back before acting, and React puts it back on a node it moves.
   */
  const stageMenu = (
    stage: LeadPipelineRow['statuses'][number], pipeline: LeadPipeline, at: number, count: number,
  ): ActionMenuItem[] => [
    { label: 'Move up', disabled: busy || at <= 0, onSelect: () => void moveStage(pipeline, stage.id, -1) },
    { label: 'Move down', disabled: busy || at >= count - 1, onSelect: () => void moveStage(pipeline, stage.id, 1) },
    { label: 'Edit', onSelect: () => { setEditing(stage.id); setEditLabel(stage.label); } },
    ...(!stage.isTerminal && stage.status === 'active'
      ? [{ label: 'Make this close the pipeline', disabled: busy, onSelect: () => void run(() => setTerminalLeadStatus(stage.id)) }]
      : []),
    stage.status === 'active'
      ? {
        label: 'Archive',
        tone: 'alert' as const,
        disabled: busy || stage.isTerminal,
        reason: stage.isTerminal ? CLOSING_STAGE_KEPT : undefined,
        onSelect: () => void run(() => archiveLeadStatus(stage.id)),
      }
      : { label: 'Restore', disabled: busy, onSelect: () => void run(() => restoreLeadStatus(stage.id)) },
  ];

  /** The *Expected to close* switch and what it says about its save — on the row from 768px, on a line of its own below. */
  const lateSwitch = (stage: LeadPipelineRow['statuses'][number]) => (
    <>
      <Switch
        id={`late-${stage.id}`}
        label="Expected to close"
        checked={stage.isLateStage}
        disabled={busy}
        describedBy="late-stage-hint"
        // A 44 × 44px target on a phone (P18.97-T7 AC-3, AC-6); from 768px the switch it was.
        phoneTarget={phone}
        // It saves itself, and says so beside it (P18.95-T1 AC-5): a retry sends this same
        // value again. The reason for a refusal stays in the banner above, where it was.
        onChange={(next) => void inline.save(lateKey(stage.id), () => run(
          () => setLateStageLeadStatus(stage.id, next),
        ))}
      />
      <InlineSaveStatus
        state={inline.stateOf(lateKey(stage.id))}
        label={`Expected to close, ${stage.label}`}
        onRetry={() => {
          inline.retry(lateKey(stage.id));
          document.getElementById(`late-${stage.id}`)?.focus();
        }}
      />
    </>
  );

  /*
   * Always read the archived rows, and filter for display — the same rule the activity
   * types screen follows, for the same reason. `LeadStatusService.reorder` counts every
   * status in the pipeline, archived included, so sending only the visible ones returned
   * `400 Send every sales status, once each` on any office that had archived one.
   */
  /**
   * Move one stage, and send the whole pipeline.
   *
   * The order sent is every status the pipeline has, archived included, because that is
   * what the endpoint counts. The *step* skips anything hidden: swapping with a row the
   * reader cannot see reads as a button that did nothing.
   */
  /** Drop `dragging` where `targetId` sits, and send the whole pipeline. */
  function dropStage(pipeline: LeadPipeline, targetId: string) {
    const held = dragging;
    setDragging(null);
    setOver(null);
    if (!held || held === targetId) return;

    const order = (pipelines?.find((p) => p.pipeline === pipeline)?.statuses ?? []).map((s) => s.id);
    const from = order.indexOf(held);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));
    void run(() => reorderLeadStatuses(pipeline, order));
  }

  async function moveStage(pipeline: LeadPipeline, id: string, by: -1 | 1) {
    const all = pipelines?.find((p) => p.pipeline === pipeline)?.statuses ?? [];
    const order = all.map((st) => st.id);
    const at = order.indexOf(id);
    const visible = new Set(
      all.filter((st) => showArchived || st.status === 'active').map((st) => st.id),
    );
    let to = at + by;
    while (to >= 0 && to < order.length && !visible.has(order[to])) to += by;
    if (at < 0 || to < 0 || to >= order.length) return;

    [order[at], order[to]] = [order[to], order[at]];
    await run(() => reorderLeadStatuses(pipeline, order));
  }

  const load = useCallback(async () => {
    try {
      setPipelines(await listLeadStatuses(true));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** A write, then the ladder read again. Answers whether the write landed — a switch's status says so (AC-5). */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      setPublished((n) => n + 1);
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsScreen
      title="Lead statuses"
      subtitle="The stages a lead moves through. One ladder for sales, one for recruitment."
      permission="tenant_config:read"
      /*
       * One row, not two: Lead statuses is its own sidebar entry, so the ladder tabs are
       * this screen's only tabs. What was wrong was where they sat — below the publish
       * bar, which read as though Sales and Recruitment belonged to publishing.
       *
       * `#sales` rather than `sales`: these switch a panel on one route, and a bare
       * relative href sent a middle-click to `/kpm/settings/lead-statuses/sales`, which
       * does not exist. The template screen already uses fragments for the same reason.
       */
      tabs={[
        { label: 'Sales', href: '#sales' },
        { label: 'Recruitment', href: '#recruitment' },
      ]}
      tabsLabel="Lead pipeline"
      activeHref={`#${tab}`}
      onSelectTab={(href) => setTab(href.slice(1) as LeadPipeline)}
      error={error}
      bars={<PublishBar refreshKey={published} />}
      toolbar={{
        /* The prototype's own sentence, per tab — it says what the order is *for*, which
           is the one thing a drag handle cannot. */
        hint: pipelines === null
          ? '\u00a0'
          : `${pipelines.find((p) => p.pipeline === tab)?.statuses
            .filter((st) => st.status === 'active').length ?? 0} statuses — `
            + 'order determines the pipeline stage sequence',
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

      {pipelines === null ? (
        <SkeletonCards count={1} />
      ) : (
        <div className="flex flex-col gap-4">
          {pipelines
            .filter((p) => p.pipeline === tab)
            .map((p) => ({
              ...p,
              // What the reader sees. `moveStage` reads the unfiltered list separately.
              statuses: showArchived ? p.statuses : p.statuses.filter((st) => st.status === 'active'),
            }))
            .map((pipeline) => (
            <Card key={pipeline.pipeline}>
              <h2 className="font-display text-lg font-bold text-navy">
                {TITLE[pipeline.pipeline]}
              </h2>
              {canWrite && (
                /* Named once per card and pointed at by every switch, so the reader is told
                   what the flag *does* rather than having to infer it from the label. In the
                   future tense since 2026-10-01 (P10.1-T2): the Overview's tile is not built,
                   and the sentence said it already counted these. */
                <p id="late-stage-hint" className="mt-1 text-md text-muted">
                  Switch on the stages a lead is usually close to converting from. Leads at those
                  stages will count as <strong className="font-semibold">Expected to close</strong> on
                  the KPM Overview.
                </p>
              )}

              {/*
                * A pipeline with no stage — an office started Empty (ADR-0115 §1). Its Owner adds the
                * first below, and makes one of them close the pipeline.
                */}
              {pipeline.statuses.length === 0 && <EmptyState title="No stages yet." className="py-6" />}
              <ol className="mt-3 flex flex-col divide-y divide-hairline">
                {pipeline.statuses.map((stage, at) => (
                  <li
                    key={stage.id}
                    // Where the focus goes back to after *Edit* on a phone; from 768px the row is as it was.
                    data-stage={phone ? stage.id : undefined}
                    className={`flex flex-wrap items-center gap-3 py-3 ${
                      over === stage.id ? 'bg-canvas' : ''
                    } ${dragging === stage.id ? 'opacity-40' : ''}`}
                    onDragOver={(e) => {
                      if (!dragging) return;
                      e.preventDefault();
                      setOver(stage.id);
                    }}
                    onDragLeave={() => setOver((now) => (now === stage.id ? null : now))}
                    onDrop={(e) => { e.preventDefault(); dropStage(pipeline.pipeline, stage.id); }}
                  >
                    {canWrite && (
                      <DragHandle
                        label={stage.label}
                        disabled={busy}
                        className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                        onPick={() => setDragging(stage.id)}
                        onDrop={() => { setDragging(null); setOver(null); }}
                        onMove={(by) => void moveStage(pipeline.pipeline, stage.id, by)}
                      />
                    )}
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-navy"
                      aria-hidden
                    >
                      {stage.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      {editing === stage.id ? (
                        <div className="flex flex-col gap-2">
                          {/* The identity, shown at the one moment a reader is changing
                              this row and never editable. `readOnly`, not `disabled`:
                              disabled reads as "not right now", and this is never — every
                              lead in the pipeline holds this code, and somebody quoting one
                              in a support ticket has to be able to copy it. */}
                          <CodeField
                            id={`code-stage-code-${stage.code}`}
                            value={stage.code}
                            reason="Every lead that reached this stage points at it."
                          />
                          <FieldRow>
                          <Field label="Label" htmlFor={`label-${stage.id}`} className="min-w-60 flex-1">
                            <TextInput
                              id={`label-${stage.id}`}
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                            />
                          </Field>
                          <FieldRow.Actions>
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
                          </FieldRow.Actions>
                          </FieldRow>
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
                            {!canWrite && stage.isLateStage && (
                              <span className="rounded-full bg-success/10 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-success">
                                Expected to close
                              </span>
                            )}
                          </p>
                          {stage.status === 'archived' && (
                            <p className="mt-0.5 text-sm text-muted">archived</p>
                          )}
                          {/* On a phone, the switch under the stage's name, on a line of its own (AC-3). */}
                          {phone && canWrite && !stage.isTerminal && stage.status === 'active' && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2">{lateSwitch(stage)}</div>
                          )}
                        </>
                      )}
                    </div>

                    {canWrite && editing !== stage.id && (phone ? (
                      // One ⋮ at the row's end, named for its stage, the menu's keys and words its own (AC-3).
                      <ActionMenu
                        label={`Actions for ${stage.label}`}
                        items={stageMenu(stage, pipeline.pipeline, at, pipeline.statuses.length)}
                      />
                    ) : (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="inline"
                          onClick={() => { setEditing(stage.id); setEditLabel(stage.label); }}
                        >
                          Edit
                        </Button>
                        {!stage.isTerminal && stage.status === 'active' && lateSwitch(stage)}
                        {!stage.isTerminal && stage.status === 'active' && (
                          <Button
                            variant="inline"
                            disabled={busy}
                            onClick={() => void run(() => setTerminalLeadStatus(stage.id))}
                          >
                            Make this close the pipeline
                          </Button>
                        )}
                        {stage.status === 'active' ? (
                          <Button
                            variant="inlineDanger"
                            disabled={busy || stage.isTerminal}
                            title={stage.isTerminal ? CLOSING_STAGE_KEPT : undefined}
                            onClick={() => void run(() => archiveLeadStatus(stage.id))}
                          >
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="inline"
                            disabled={busy}
                            onClick={() => void run(() => restoreLeadStatus(stage.id))}
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ol>

              {canWrite && (adding === pipeline.pipeline ? (
                <FieldRow className="mt-3 border-t border-hairline pt-3">
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
                  <FieldRow.Actions>
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
                  </FieldRow.Actions>
                </FieldRow>
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
    </SettingsScreen>
  );
}
