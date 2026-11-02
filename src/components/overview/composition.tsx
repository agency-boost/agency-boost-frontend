import type { CSSProperties } from 'react';
import { shortOfRung, useRoleAvatarClass } from '@/components/ui/role-badge';
import { TermTip } from '@/components/ui/term-tip';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { newThisMonth, type OverviewComposition, type OverviewRungCount } from '@/lib/kpm-overview';

/**
 * *Team composition* (`KPM_Owner.html:938-961`, CSS `:450-459`): *Total members* with *"+{n} new this
 * month"*, then one tile per rung of the company's ladder, in its order and labelled by it (OD-24,
 * D-figures). The rung tiles sum to the total — the server's partition, never a sample.
 *
 * The prototype's grid is `1.3fr` and three `1fr` (four tiles for three rungs), two by two under 960px. A
 * ladder of another length keeps the first column wider and gives every rung the same share, through
 * `--rungs`, so a fourth rung is a fifth tile rather than a wrapped row.
 *
 * **Each rung's dot is the rung's colour** — the same palette every other screen gives it, by seniority
 * (`role-badge.tsx`) — and the label beside it carries the meaning, so colour is never the only cue.
 */
export function Composition({ composition }: { composition: OverviewComposition }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  return (
    <div
      className="grid grid-cols-2 gap-3.5 lg:[grid-template-columns:1.3fr_repeat(var(--rungs),minmax(0,1fr))]"
      style={{ '--rungs': Math.max(1, composition.rungs.length) } as CSSProperties}
    >
      <Tile label={t.totalMembers} value={composition.total} total>
        <p className={cn('mt-1 text-xs font-semibold', composition.newThisMonth > 0 ? 'text-success' : 'text-muted')}>
          {newThisMonth(composition.newThisMonth, language)}
        </p>
      </Tile>
      {composition.rungs.map((rung) => <RungTile key={rung.code} rung={rung} />)}
    </div>
  );
}

function RungTile({ rung }: { rung: OverviewRungCount }) {
  const dot = useRoleAvatarClass(rung.code);
  // The badge's name for the rung (P18.95-T9 AC-1): *AB*, *AAB*, *Agent* — a role, kept, or the company's own label;
  // *AAB*'s ⓘ, its first appearance (AC-3).
  const name = shortOfRung(rung);
  const label = (
    <>
      <span aria-hidden="true" className={cn('mr-1.5 inline-block h-2 w-2 rounded-full align-middle', dot)} />
      {name}
      {name === 'AAB' && <> <TermTip term="AAB" /></>}
    </>
  );
  return <Tile label={label} value={rung.count} />;
}

/**
 * `.tile` (`:451-455`): a 12px card, its label in muted 12px, its figure in Inter 26px bold — the total's
 * in amber (`amber-deep`, the amber that clears contrast at that size on white).
 */
function Tile({
  label,
  value,
  total = false,
  children,
}: {
  label: React.ReactNode;
  value: number;
  total?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-card-edge bg-card px-[18px] py-4">
      <p className="mb-1.5 text-sm text-muted">{label}</p>
      <p className={cn('font-body text-3xl font-bold', total ? 'text-amber-deep' : 'text-navy')}>{value}</p>
      {children}
    </div>
  );
}
