import { cn } from '@/lib/cn';
import { useTenantConfig, type OrgLevel } from '@/lib/tenant-config-cache';

/**
 * What a rung of the company's ladder looks like (P4-T9, ADR-0012).
 *
 * **The labels come from the ladder, the colours from its order.** Until P4-T9 this file
 * held five maps keyed on a three-value enum — a second definition of a company's own
 * vocabulary, in a product where the ladder is company configuration. A second insurer
 * publishing a fourth rung would have had members whose badge said nothing.
 *
 * Colour is assigned by **seniority**, senior first, from a fixed palette. v1's three
 * rungs land on exactly the colours they had, so nothing moves; a fourth rung gets the
 * next entry rather than no colour at all.
 *
 * The badge always renders its text label — roughly 8% of men have a colour vision
 * deficiency, and this product's users are majority-male sales teams.
 */
export type HierarchyRole = 'ab' | 'aab' | 'agent';

/**
 * The seeded ladder, for a screen that has no office to ask.
 *
 * The platform console renders members of many companies and belongs to none, and a test
 * that never mounts the provider still has to draw a badge. Honest rather than silent: v1
 * ships one ladder, and this is it.
 */
export const SEEDED_LADDER: OrgLevel[] = [
  { orgLevelId: 'seed-agent', companyId: '', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active' },
  { orgLevelId: 'seed-aab', companyId: '', code: 'AAB', label: 'Associate Agency Builder', displayOrder: 2, status: 'active' },
  { orgLevelId: 'seed-ab', companyId: '', code: 'AB', label: 'Agency Builder', displayOrder: 3, status: 'active' },
];

/** Senior first. The first rung gets the strongest colour. */
const PALETTE = [
  { badge: 'bg-role-ab/15 text-amber-deep', muted: 'bg-navy/10 text-navy', avatar: 'bg-role-ab text-navy' },
  { badge: 'bg-role-aab/15 text-navy-soft', muted: 'bg-navy-soft/[0.12] text-navy-soft', avatar: 'bg-role-aab text-card' },
  { badge: 'bg-navy/10 text-navy', muted: 'bg-muted/10 text-muted', avatar: 'bg-role-agent text-card' },
  // A fourth rung, and anything beyond it, is quiet rather than absent.
  { badge: 'bg-hairline text-navy', muted: 'bg-hairline text-muted', avatar: 'bg-muted text-card' },
];

function paletteFor(ladder: OrgLevel[], code: string) {
  const senior = [...ladder].sort((a, b) => b.displayOrder - a.displayOrder);
  const at = senior.findIndex((l) => l.code === code.toUpperCase());
  return PALETTE[Math.min(at < 0 ? PALETTE.length - 1 : at, PALETTE.length - 1)];
}

/**
 * The short form.
 *
 * A code that reads as an acronym is already the short form — `AB`, `AAB`. A longer one
 * would be shouted, so the label is used instead: `AGENT` renders `Agent`, which is
 * exactly what v1 shipped.
 */
function shortFor(level: OrgLevel | undefined, code: string): string {
  if (!level) return code.toUpperCase();
  return level.code.length <= 4 ? level.code : level.label;
}

/**
 * A rung's label, without a hook.
 *
 * For the pure modules that compose a sentence and have no React context to read — the
 * ladder is passed in, defaulting to the seeded one. That default is the honest fallback
 * for v1 rather than a second definition: `SEEDED_LADDER` is one constant, not five maps,
 * and a caller with a real ladder passes it.
 */
export function rungLabel(code: string, ladder: OrgLevel[] = SEEDED_LADDER): string {
  return ladder.find((l) => l.code === code.toUpperCase())?.label ?? code.toUpperCase();
}

/** The ladder an office stands on, falling back to the seeded one outside an office. */
export function useLadder(): OrgLevel[] {
  const { ladder } = useTenantConfig();
  return ladder.length > 0 ? ladder : SEEDED_LADDER;
}

/** A rung's full label — `Agency Builder`. */
export function useRoleLabel(code: string): string {
  const ladder = useLadder();
  return ladder.find((l) => l.code === code.toUpperCase())?.label ?? code.toUpperCase();
}

/** The avatar or legend-swatch colour for a rung, without a hook. */
export function avatarClassFor(code: string, ladder: OrgLevel[] = SEEDED_LADDER): string {
  return paletteFor(ladder, code).avatar;
}

/** The avatar or legend-swatch colour for a rung. */
export function useRoleAvatarClass(code: string): string {
  return paletteFor(useLadder(), code).avatar;
}

export function RoleBadge({
  role,
  short = true,
  tone = 'default',
  className,
}: {
  /**
   * The rung, by **ladder code** or by the v1 enum.
   *
   * Both are accepted because the seeded codes are the upper-cased enum values, and seven
   * services still hand the enum around. Comparison is case-insensitive, so a caller
   * passing `'ab'` and one passing `'AB'` draw the same badge.
   */
  role: HierarchyRole | string;
  short?: boolean;
  /** `muted` where a coloured avatar already says the role — the org tree. */
  tone?: 'default' | 'muted';
  className?: string;
}) {
  const ladder = useLadder();
  const code = String(role).toUpperCase();
  const level = ladder.find((l) => l.code === code);
  const palette = paletteFor(ladder, code);
  const label = level?.label ?? code;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        tone === 'muted' ? palette.muted : palette.badge,
        className,
      )}
      title={label}
    >
      {short ? shortFor(level, code) : label}
    </span>
  );
}
