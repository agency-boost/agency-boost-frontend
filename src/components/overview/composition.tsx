import { shortOfRung } from '@/components/ui/role-badge';
import { StatTile } from '@/components/ui/stat-tile';
import { TermTip } from '@/components/ui/term-tip';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { newThisMonth, type OverviewComposition } from '@/lib/kpm-overview';

/**
 * *Team composition* (`KPM_Owner.html:938-961`): *Total members* with *"+{n} new this month"*, and how many hold each
 * rung of the company's ladder, in its order and named by it (OD-24, D-figures) — the server's partition, summing to the
 * total, never a sample.
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-5; the client's UI-143, `kpm-owner-mobile-2026-11-03` 1): **one stat tile** — the
 * shared `StatTile` (UI-003) — its rungs as chips under the number (*8 AB · 24 AAB · 155 Agent*), where they were a tile
 * each with a coloured dot. No dot (D-27): a chip's words say the rung. A rung nobody holds is left out, as a chip of 0
 * is (UI-100). *AAB* keeps its ⓘ, its first appearance (P18.7-T9 AC-3).
 */
export function TeamTile({ composition }: { composition: OverviewComposition }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  return (
    <StatTile
      label={t.totalMembers}
      value={composition.total}
      // P19.3-T2 AC-1 (UI-148, Overview R1): the tile opens All members, where each person is.
      href="/people/members"
      sub={(
        <span className={cn('font-semibold', composition.newThisMonth > 0 ? 'text-success' : 'text-muted')}>
          {newThisMonth(composition.newThisMonth, language)}
        </span>
      )}
      chips={composition.rungs.filter((rung) => rung.count > 0).map((rung) => {
        // The badge's name for the rung (P18.7-T9 AC-1): *AB*, *AAB*, *Agent* — a role, kept, or the company's own label.
        const name = shortOfRung(rung);
        return {
          key: rung.code,
          label: <><b>{rung.count}</b> {name}{name === 'AAB' && <> <TermTip term="AAB" /></>}</>,
        };
      })}
    />
  );
}
