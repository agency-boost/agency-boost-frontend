'use client';

import { useMessages } from '@/i18n/language-provider';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { cn } from '@/lib/cn';
import type { ComplianceCategory, ComplianceChip } from '@/lib/kpm-compliance';

/**
 * `.compliance-summary` (`KPM_Owner.html:3454-3478`, CSS `:98-102`, `:113-115`): the six chips in the
 * prototype's order, each *"{n} / {of}"* over its label — the counts the server's, done over those each applies
 * to (D-chips) — and a dash over nobody, named *"No rate: nobody to count"* for a screen reader.
 *
 * **Each is a button saying whether it is the one shown** (`aria-pressed`; the prototype's are `div`s with an
 * `onclick`, contradiction 16). Pressing one selects its category and turns the sort back to worst-first
 * (`jumpToCategory`, `:3480-3484`). **The pressed chip is ringed navy** — a selection (ADR-0137 §2), where the
 * prototype rings it amber (`:115`, contradiction 18): the colour changes, the shape stays. The Activity chip keeps
 * its tooltip (`:3475`).
 */
export function ComplianceSummary({
  chips, active, onChoose,
}: {
  chips: readonly ComplianceChip[];
  active: ComplianceCategory;
  onChoose: (category: ComplianceCategory) => void;
}) {
  const t = useMessages(kpmComplianceMessages);
  return (
    <div role="group" aria-label={t.chipsName} className="mb-4 flex flex-wrap gap-2.5">
      {chips.map((chip) => {
        const on = chip.category === active;
        return (
          <button
            key={chip.category}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(chip.category)}
            title={chip.category === 'activity' ? t.activityTooltip : undefined}
            className={cn(
              'min-w-[128px] rounded-[10px] border bg-card px-3.5 py-2.5 text-left transition-colors',
              on ? 'border-navy ring-1 ring-navy' : 'border-hairline hover:border-navy/30',
            )}
            data-category={chip.category}
          >
            <span className="block text-xl font-bold leading-tight text-navy">
              {chip.of === 0 ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">{t.noRate}</span>
                </>
              ) : (
                <>
                  {/* `.n` and `.of` (`:100-101`, `:3474`): the count, then *"/ {of}"* 2px after it — *"3/ 28"*. */}
                  {chip.count}
                  <span className="ml-0.5 text-sm font-medium text-muted">/ {chip.of}</span>
                </>
              )}
            </span>
            <span className="mt-0.5 block text-sm text-muted">{t.chips[chip.category]}</span>
          </button>
        );
      })}
    </div>
  );
}
