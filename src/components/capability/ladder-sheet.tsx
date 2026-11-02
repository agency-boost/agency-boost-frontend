'use client';

import { useId, type ReactNode } from 'react';
import { CurrentStagePill, StepMarker, TickRow } from '@/components/capability/capability-parts';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import type { InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { useMessages } from '@/i18n/language-provider';
import { coachingLeaderNotesMessages } from '@/i18n/messages/coaching-leader-notes';
import { cn } from '@/lib/cn';
import type { LadderRung } from '@/lib/capability-view';

/**
 * **The capability ladder, in a sheet** (Phase 18.99 T10; UI-035): a bottom sheet below 1024px, a centred ~560px modal
 * from 1024px (`ResponsiveSheet`). The four stages as a ladder, **each listing only the criteria it adds** — each
 * criterion once — the current stage tinted with its pill. A tick saves as it is ticked (*Menyimpan… → Tersimpan ✓*
 * beside it, as the page's do), and the tile under the sheet takes the stage the server answers.
 *
 * Loaded only when it is opened (`next/dynamic`, the bundle's budget): the tile carries everything a reader sees first.
 */
export function LadderSheet({
  open, onClose, rungs, ticked, canTick, onTick, statusOf, notice,
}: {
  open: boolean;
  onClose: () => void;
  rungs: readonly LadderRung[];
  ticked: ReadonlySet<string>;
  canTick: boolean;
  onTick: (code: string, on: boolean) => void;
  statusOf: (code: string) => InlineSaveStatusProps;
  /** A refused save or a re-read, said here while the sheet covers the page where it is said otherwise. */
  notice?: ReactNode;
}) {
  const t = useMessages(coachingLeaderNotesMessages);
  return (
    <ResponsiveSheet open={open} title={t.capability} onClose={onClose}>
      {notice && <div className="mb-3 flex flex-col gap-2">{notice}</div>}
      <ol className="flex flex-col gap-1 pb-2" data-ladder="">
        {rungs.map((rung) => (
          <Rung key={rung.stage.code} rung={rung} ticked={ticked} canTick={canTick} onTick={onTick} statusOf={statusOf} />
        ))}
      </ol>
    </ResponsiveSheet>
  );
}

function Rung({
  rung, ticked, canTick, onTick, statusOf,
}: {
  rung: LadderRung;
  ticked: ReadonlySet<string>;
  canTick: boolean;
  onTick: (code: string, on: boolean) => void;
  statusOf: (code: string) => InlineSaveStatusProps;
}) {
  const titleId = useId();
  const current = rung.state === 'current';
  return (
    <li data-stage={rung.stage.code} data-current={current || undefined}>
      <div
        className={cn(
          '-mx-2 flex min-h-11 items-center gap-2.5 rounded-row px-2 text-lg font-bold text-navy lg:min-h-10',
          current && 'bg-amber/10',
        )}
      >
        <StepMarker state={rung.state} n={rung.n} size="md" />
        <span id={titleId} className="min-w-0">{rung.stage.label}</span>
        {current && <CurrentStagePill className="ml-auto" />}
      </div>
      {rung.added.length > 0 && (
        <div role="group" aria-labelledby={titleId} className="pl-9 lg:pl-[34px]">
          {rung.added.map((m) => {
            const archived = m.status === 'archived';
            return (
              <TickRow
                key={m.code}
                label={m.label}
                archived={archived}
                checked={ticked.has(m.code)}
                locked={!canTick || archived}
                onChange={(on) => onTick(m.code, on)}
                status={statusOf(m.code)}
              />
            );
          })}
        </div>
      )}
    </li>
  );
}
