'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { groupsMessages } from '@/i18n/messages/groups';
import { uiMessages } from '@/i18n/messages/ui';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong } from '@/lib/format';
import {
  abGroupRowOf, monthsBetween, readAbGroupTargets, saveAbGroupTarget, type AbGroupTargetsView,
} from '@/lib/informal-groups';

/** The AB whose AB group the targets are for. */
export interface TargetDialogAb {
  membershipId: string;
  name: string;
  /** The label before the name: *AB*. */
  role?: string;
}

/**
 * ***Target Group {AB}*** — the target card (P19.17-T4; ADR-0270 §4; the approved `kpm-overview-v2-tablet` frame 10, and
 * Advanced analytics' *Ubah target*): **one AB group, one month** — a month picker, *Target Active Agent per bulan* and
 * *Target Rekrut per bulan* with − and +, the line *Target APE tidak diubah di sini: diambil dari Goal Setting tiap
 * orang.*, and *Batal* / *Simpan*. Shared by KPM Overview › *Performa vs target*, Advanced analytics › *Informal group*
 * and anything else that shows the targets.
 *
 * - **It reads its own month** (`GET /kpm/ab-group-targets?month=`): the AB group's targets as they stand — saved for the
 *   month, carried from an earlier one, or 0 with none — its size and its informal group for the line under the title,
 *   and the months it may be saved for. Changing the month reads that one.
 * - **Simpan** writes that month (`PUT /kpm/ab-group-targets/:ab`) and hands the month's whole answer to `onSaved`, so
 *   the row, its informal group's total and the KPM's update at once.
 * - **A centred dialog, a bottom sheet on a phone** (`ResponsiveSheet`): its content scrolls under a pinned foot.
 * - Its states (L-01): the steppers wait as skeletons; a refusal stays in the dialog in `toDisplayError`'s words; the
 *   save waits with its button disabled. The server refuses anybody who is not a steward of the KPM.
 */
export function TargetDialog({
  ab, month, onClose, onSaved,
}: {
  ab: TargetDialogAb;
  /** The month to open on, `YYYY-MM`; the office's month when absent. */
  month?: string;
  onClose: () => void;
  onSaved: (view: AbGroupTargetsView) => void;
}) {
  const t = useMessages(groupsMessages);
  const ui = useMessages(uiMessages).stepper;
  const language = useFigureLanguage();
  const formId = useId();
  const [asked, setAsked] = useState<string | undefined>(month);
  const [view, setView] = useState<AbGroupTargetsView | null>(null);
  const [activeAgent, setActiveAgent] = useState(0);
  const [rekrut, setRekrut] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    setError(null);
    readAbGroupTargets(asked)
      .then((answer) => {
        if (!live) return;
        const found = abGroupRowOf(answer, ab.membershipId)?.row;
        setActiveAgent(found?.activeAgentTarget ?? 0);
        setRekrut(found?.rekrutTarget ?? 0);
        setView(answer);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [asked, ab.membershipId]);

  const found = view ? abGroupRowOf(view, ab.membershipId) : null;
  const role = ab.role ?? 'AB';
  const monthLabel = (m: string) => `${formatMonthLong(m, language)} ${m.slice(0, 4)}`;

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!view || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveAbGroupTarget(ab.membershipId, { month: view.month, activeAgentTarget: activeAgent, rekrutTarget: rekrut }));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  const stepper = (label: string, value: number, set: (n: number) => void, max: number) => {
    const clamp = (n: number) => Math.max(0, Math.min(max, n));
    const round = cn(
      'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-base text-navy',
      'hover:bg-hover-row active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
    );
    return (
      <div className="mt-4">
        <p className="mb-1.5 text-base font-semibold text-navy">{label}</p>
        <div role="group" aria-label={label} data-target-stepper="" className="flex min-h-14 items-center gap-2 rounded-row border border-hairline bg-card px-2">
          <button type="button" aria-label={ui.decrease({ label })} disabled={busy || value <= 0} onClick={() => set(clamp(value - 1))} className={round}>
            <LineIcon name="minus" />
          </button>
          <output aria-live="polite" className="flex-1 text-center text-[1.25rem] font-extrabold tabular-nums text-ink">{value}</output>
          <button type="button" aria-label={ui.increase({ label })} disabled={busy || value >= max} onClick={() => set(clamp(value + 1))} className={round}>
            <LineIcon name="plus" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveSheet
      open
      title={t.target.title({ name: ab.name })}
      description={found
        ? t.target.line({ role, n: found.row.people, group: found.group.group?.name ?? t.noGroup })
        : undefined}
      onClose={onClose}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-12 w-full rounded-pill" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" form={formId} className="min-h-12 w-full rounded-pill" disabled={!view || busy}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={save} noValidate data-target-dialog="" className="pb-2">
        {view ? (
          <>
            <PickerMenu
              label={t.target.month}
              value={view.month}
              options={monthsBetween(view.earliestMonth, view.latestMonth).map((m) => ({ value: m, label: monthLabel(m) }))}
              onChange={(m) => setAsked(m)}
            />
            {stepper(t.target.activeAgent, activeAgent, setActiveAgent, view.max)}
            {stepper(t.target.rekrut, rekrut, setRekrut, view.max)}
            <p className="mt-3 text-sm text-muted">{t.target.apeNote}</p>
          </>
        ) : !error && (
          <Skeleton label={t.loading}>
            <div className="space-y-4">
              <SkeletonBar className="h-11 w-44" />
              <SkeletonBar className="h-14 w-full" />
              <SkeletonBar className="h-14 w-full" />
            </div>
          </Skeleton>
        )}
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </ResponsiveSheet>
  );
}

export default TargetDialog;
