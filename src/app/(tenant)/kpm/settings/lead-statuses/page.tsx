'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { DragHandle } from '@/components/ui/drag-handle';
import {
  Button, CodeField, Field, FieldRow, TextInput,
} from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineSaveStatus, useInlineSave } from '@/components/ui/inline-save-status';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill } from '@/components/ui/tone-pill';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { leadStatusesMessages } from '@/i18n/messages/settings-lead-statuses';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useCan } from '@/lib/session';
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
import { ARCHIVED_SWITCH_ROW, HANDLE_TOUCH, TEXT_BUTTON_TOUCH } from '../settings-touch';

/** The two ladders by their tabs' names: §A.3's, the same in both languages. */
const TITLE: Record<LeadPipeline, string> = {
  sales: kept('Sales'),
  recruitment: kept('Recruitment'),
};

/** A stage's *Expected to close* toggle, in its *Saving… → Saved ✓* (P18.7-T1 AC-5). */
const lateKey = (stageId: string) => `${stageId}\nlate`;

/** The tag's and the toggle's words: a metric's name, kept English (§A.4). */
const EXPECTED_TO_CLOSE = kept('Expected to close');

/** An example of a code, in the field that takes one: an identifier, the same in both languages (the glossary's §D). */
const STAGE_CODE_EXAMPLE = 'AWAITING_UNDERWRITING';

/** The orange *+ Tambah status* line at the card's foot (mockup f15), 44px tall below 1024px. */
const ADD_LINE = cn(
  'inline-flex items-center gap-1.5 text-md font-bold text-primary-ink hover:underline disabled:opacity-40',
  TEXT_BUTTON_TOUCH,
);

type Stage = LeadPipelineRow['statuses'][number];

/**
 * The two lead pipelines (P4-T3) — **drawn as the client's 19 November card** (P19.21-T3 AC-2; mockup
 * `data-upload-pengaturan-*` f15, ADR-0274).
 *
 * *Sales | Recruitment* as the tabs; one white card, the ordered pipeline as rows — ⠿, *"1. Not yet approached"*, the
 * tags *Expected to close* (green) and *Terbuka* or *Penutup*, a ⋯ — and *+ Tambah status* at its foot; under it the
 * legend *"Urutan = alur pipeline · Expected to close dihitung di KPM Overview"*. The frame — *‹ Pengaturan*, the
 * per-setting orange bar — is `SettingsScreen`'s and `PublishBar`'s.
 *
 * **Every control is in the ⋯, at every width** (mockup f14's rule for the inside pages): ↑ ↓ (a phone cannot drag, and
 * the ⠿'s keys need a keyboard), *Ganti nama* (its sheet: the code read-only and the name), the *Expected to close*
 * flag (ADR-0043; it decides what the KPM Overview's tile counts, and says *Menyimpan… → Tersimpan ✓* beside the tags),
 * *Jadikan penutup pipeline*, *Arsipkan* — held, with its reason, on the stage that closes the pipeline.
 *
 * **The stage that closes a pipeline is marked, not implied**, and the code stays off the list: a lead holds the code,
 * the label is free to change.
 */
export default function LeadStatusesPage() {
  const t = useMessages(leadStatusesMessages);
  const s = useMessages(settingsMessages);
  const canWrite = useCan('tenant_config:write');
  const [pipelines, setPipelines] = useState<LeadPipelineRow[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // One pipeline at a time, as the prototype's subtabs do.
  const [tab, setTab] = useState<LeadPipeline>('sales');
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // Bumped after any write, so the publish bar re-reads rather than going stale behind an edit the Owner just made.
  const [published, setPublished] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<LeadPipeline | null>(null);
  const [draft, setDraft] = useState({ code: '', label: '' });
  /** The stage whose *Ganti nama* sheet is open. */
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const inline = useInlineSave();
  /** Where the focus goes back to once a stage's sheet closes: its ⋯ (WCAG 2.4.3). */
  const editingWas = useRef<string | null>(null);
  useEffect(() => {
    const was = editingWas.current;
    editingWas.current = editing;
    if (was !== null && was !== editing) {
      document.querySelector<HTMLElement>(`[data-stage="${was}"] button[aria-haspopup="menu"]`)?.focus();
    }
  }, [editing]);

  const load = useCallback(async () => {
    try {
      // Always the archived rows too: a reorder counts every status in the pipeline.
      setPipelines(await listLeadStatuses(true));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** A write, then the ladder read again. Answers whether the write landed — the flag's status says so. */
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

  /** Drop `dragging` where `targetId` sits, and send the whole pipeline. */
  function dropStage(pipeline: LeadPipeline, targetId: string) {
    const held = dragging;
    setDragging(null);
    setOver(null);
    if (!held || held === targetId) return;
    const order = (pipelines?.find((p) => p.pipeline === pipeline)?.statuses ?? []).map((st) => st.id);
    const from = order.indexOf(held);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));
    void run(() => reorderLeadStatuses(pipeline, order));
  }

  /** Move one stage, and send the whole pipeline — archived included; the step skips what the reader cannot see. */
  async function moveStage(pipeline: LeadPipeline, id: string, by: -1 | 1) {
    const all = pipelines?.find((p) => p.pipeline === pipeline)?.statuses ?? [];
    const order = all.map((st) => st.id);
    const at = order.indexOf(id);
    const visible = new Set(all.filter((st) => showArchived || st.status === 'active').map((st) => st.id));
    let to = at + by;
    while (to >= 0 && to < order.length && !visible.has(order[to])) to += by;
    if (at < 0 || to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    await run(() => reorderLeadStatuses(pipeline, order));
  }

  /** *Expected to close*, flipped and saved at once, with its status beside the tags (P18.7-T1 AC-5). */
  const flipLate = (stage: Stage) => {
    const next = !stage.isLateStage;
    void inline.save(lateKey(stage.id), () => run(() => setLateStageLeadStatus(stage.id, next)));
  };

  /** A stage's ⋯, in one order at every width; held while a write is out. */
  const stageMenu = (stage: Stage, pipeline: LeadPipeline, at: number, count: number): ActionMenuItem[] => [
    { label: t.moveUp, disabled: busy || at <= 0, onSelect: () => void moveStage(pipeline, stage.id, -1) },
    { label: t.moveDown, disabled: busy || at >= count - 1, onSelect: () => void moveStage(pipeline, stage.id, 1) },
    { label: s.rename, onSelect: () => { setEditing(stage.id); setEditLabel(stage.label); } },
    ...(!stage.isTerminal && stage.status === 'active'
      ? [
        {
          label: stage.isLateStage ? t.expectedOff({ expected: EXPECTED_TO_CLOSE }) : t.expectedOn({ expected: EXPECTED_TO_CLOSE }),
          disabled: busy,
          hint: t.legendExpected({ expected: EXPECTED_TO_CLOSE }),
          onSelect: () => flipLate(stage),
        },
        { label: t.makeClose, disabled: busy, onSelect: () => void run(() => setTerminalLeadStatus(stage.id)) },
      ]
      : []),
    stage.status === 'active'
      ? {
        label: s.archive,
        tone: 'alert' as const,
        disabled: busy || stage.isTerminal,
        reason: stage.isTerminal ? t.closingKept : undefined,
        onSelect: () => void run(() => archiveLeadStatus(stage.id)),
      }
      : { label: s.restore, disabled: busy, onSelect: () => void run(() => restoreLeadStatus(stage.id)) },
  ];

  const current = pipelines?.find((p) => p.pipeline === tab) ?? null;
  const stages = current ? (showArchived ? current.statuses : current.statuses.filter((st) => st.status === 'active')) : [];
  const sheetStage = editing === null ? null : current?.statuses.find((st) => st.id === editing) ?? null;

  return (
    <SettingsScreen
      title={kept('Lead statuses')}
      permission="tenant_config:read"
      /*
       * One row of tabs: the ladders are this screen's only tabs. `#sales` rather than `sales`: these switch a panel on
       * one route, and a bare relative href sent a middle-click to a page that does not exist.
       */
      tabs={[
        { label: TITLE.sales, href: '#sales' },
        { label: TITLE.recruitment, href: '#recruitment' },
      ]}
      tabsLabel={t.pipelineTabs}
      activeHref={`#${tab}`}
      onSelectTab={(href) => setTab(href.slice(1) as LeadPipeline)}
      error={error}
      bars={<PublishBar refreshKey={published} />}
    >
      {pipelines === null ? (
        error ? null : <SkeletonCards count={1} />
      ) : current && (
        <section
          aria-label={TITLE[current.pipeline]}
          className="overflow-hidden rounded-lg border border-card-edge bg-card"
        >
          {/* A pipeline with no stage — an office started Empty (ADR-0115 §1): its Owner adds the first below. */}
          {stages.length === 0 && <EmptyState title={t.none} className="py-6" />}
          <ol className="flex flex-col">
            {stages.map((stage, at) => (
              <li
                key={stage.id}
                data-stage={stage.id}
                className={cn(
                  'flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-divider px-4 py-2',
                  over === stage.id && 'bg-base',
                  dragging === stage.id && 'opacity-40',
                )}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setOver(stage.id);
                }}
                onDragLeave={() => setOver((now) => (now === stage.id ? null : now))}
                onDrop={(e) => { e.preventDefault(); dropStage(current.pipeline, stage.id); }}
              >
                {canWrite && (
                  <DragHandle
                    label={stage.label}
                    disabled={busy}
                    className={HANDLE_TOUCH}
                    onPick={() => setDragging(stage.id)}
                    onDrop={() => { setDragging(null); setOver(null); }}
                    onMove={(by) => void moveStage(current.pipeline, stage.id, by)}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-md font-semibold text-navy">
                    {stage.status === 'active' ? `${stage.rank}. ` : ''}
                    {stage.label}
                  </p>
                  {stage.status === 'archived' && <p className="text-sm text-muted">{s.archivedLine}</p>}
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  <InlineSaveStatus
                    state={inline.stateOf(lateKey(stage.id))}
                    label={t.expectedFor({ name: stage.label })}
                    onRetry={() => inline.retry(lateKey(stage.id))}
                  />
                  {stage.isLateStage && !stage.isTerminal && <TonePill tone="green">{EXPECTED_TO_CLOSE}</TonePill>}
                  {stage.isTerminal ? (
                    <span
                      data-tag="closer"
                      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-pill bg-secondary-50 px-2.5 py-0.5 text-xs font-semibold leading-5 text-navy"
                    >
                      {t.closer}
                    </span>
                  ) : (
                    <TonePill tone="grey">{t.open}</TonePill>
                  )}
                </span>
                {canWrite && (
                  <ActionMenu
                    glyph="⋯"
                    label={s.actionsFor({ name: stage.label })}
                    items={stageMenu(stage, current.pipeline, at, stages.length)}
                  />
                )}
              </li>
            ))}
          </ol>

          {canWrite && (adding === current.pipeline ? (
            <FieldRow className="px-4 py-3">
              <Field label={s.code} htmlFor={`code-${current.pipeline}`} hint={t.codeHint} className="min-w-48">
                <TextInput
                  id={`code-${current.pipeline}`}
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  placeholder={STAGE_CODE_EXAMPLE}
                />
              </Field>
              <Field label={s.label} htmlFor={`new-${current.pipeline}`} className="min-w-60 flex-1">
                <TextInput
                  id={`new-${current.pipeline}`}
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                />
              </Field>
              <FieldRow.Actions>
                <Button
                  disabled={!draft.code.trim() || !draft.label.trim() || busy}
                  onClick={() => void run(async () => {
                    await createLeadStatus({ pipeline: current.pipeline, code: draft.code, label: draft.label });
                    setAdding(null);
                    setDraft({ code: '', label: '' });
                  })}
                >
                  {s.add}
                </Button>
                <Button variant="secondary" onClick={() => setAdding(null)}>{s.cancel}</Button>
              </FieldRow.Actions>
            </FieldRow>
          ) : (
            <div className="px-4 py-2.5">
              <button
                type="button"
                aria-label={t.addStatusTo({ pipeline: current.pipeline })}
                className={ADD_LINE}
                onClick={() => { setAdding(current.pipeline); setDraft({ code: '', label: '' }); }}
              >
                <LineIcon name="plus" className="h-4 w-4" />
                {t.addStatus}
              </button>
            </div>
          ))}
        </section>
      )}

      {/* The legend (mockup f15): what the order is, and where *Expected to close* counts; then the archived switch. */}
      {pipelines !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span>{t.legendOrder}</span>
          <span id="late-stage-hint">{t.legendExpected({ expected: EXPECTED_TO_CLOSE })}</span>
          <label className={cn('flex items-center gap-2 text-sm text-muted', ARCHIVED_SWITCH_ROW)}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {s.showArchived}
          </label>
        </div>
      )}

      {/* *Ganti nama*: the code, shown and never editable — every lead that reached this stage holds it — and the name. */}
      <ResponsiveSheet
        open={sheetStage !== null}
        title={sheetStage?.label ?? ''}
        onClose={() => setEditing(null)}
        footer={sheetStage && canWrite ? (
          <Button
            className="w-full"
            disabled={!editLabel.trim() || busy}
            onClick={() => void run(async () => {
              await renameLeadStatus(sheetStage.id, editLabel);
              setEditing(null);
            })}
          >
            {s.save}
          </Button>
        ) : undefined}
      >
        {sheetStage && (
          <div className="flex flex-col gap-3">
            <CodeField id={`code-stage-code-${sheetStage.code}`} value={sheetStage.code} reason={t.codeReason} />
            <Field label={s.label} htmlFor={`label-${sheetStage.id}`}>
              <TextInput id={`label-${sheetStage.id}`} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </Field>
          </div>
        )}
      </ResponsiveSheet>
    </SettingsScreen>
  );
}
