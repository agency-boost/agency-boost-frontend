import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { summaryTileMessages } from '@/i18n/messages/summary-tiles';
import type { ApiError } from './api-client';
import type { TermKey } from './terms';
import { suggestCode } from './config-code';

/**
 * The summary strip above Log Activity and the Activity Dashboard (ADR-0064,
 * `Overall.html:2720-2726`, `:2752-2757`).
 *
 * **The prototype's four tiles and a total, grouped by the office's own configuration.** The
 * prototype sums hardcoded id ranges — *Development* is items 10, 11 and 12 — and OD-63 took the
 * ranges out, so for a while the strip drew one tile per category: six on the seed, where the
 * prototype draws five. ADR-0064 gives the grouping a place in the data instead. A category names
 * the tile it counts toward with `summaryGroupCode`, and the seed sets it so that Personal and Team
 * Development share one tile. Writing that merge here would miscount every office that renamed,
 * split or added a section, which is the defect OD-63 was resolved to prevent.
 *
 * **Presentation, never a metric input.** Nothing but the strips reads the grouping. A tile's value
 * is whatever the screen counts for its categories, and the total is the screen's own figure, so
 * regrouping moves a count between tiles and never changes one.
 *
 * *Amended 2026-10-26 (P18.95-T5 AC-2):* **Log Activity draws a tile per section** (`sectionTiles`),
 * at the client's request, so its tiles and its cards are one list; the grouping is the Activity
 * Dashboard's strip's alone.
 */

/** What the strip reads off a category — `ActivityCategoryRow` satisfies it. */
export interface SummaryTileCategory {
  code: string;
  label: string;
  displayOrder: number;
  status: 'active' | 'archived';
  /** Empty means every rung (ADR-0020). */
  appliesToOrgLevelCodes: string[];
  summaryGroupCode?: string | null;
  summaryGroupLabel?: string | null;
}

export interface SummaryTile {
  /** Unique within one strip, and stable across renders: React keys it. */
  key: string;
  label: string;
  value: number;
  /** The strip's last tile, the one it is about. */
  total: boolean;
  /** A term the tile's label uses, whose ⓘ it carries (P18.95-T9 AC-3): *Total touches* → *a touch*. */
  term?: TermKey;
}

/** Whether a reader on `rung` is shown this category. Empty means every rung (ADR-0020). */
export function isShownTo(category: { appliesToOrgLevelCodes: string[] }, rung: string): boolean {
  return category.appliesToOrgLevelCodes.length === 0
    || category.appliesToOrgLevelCodes.includes(rung);
}

/**
 * The tiles, in order, then the total.
 *
 * - **A tile sits where its first category sits in display order**, so reordering sections
 *   reorders the tiles and nothing else has to be told.
 * - **A tile's label is its group's**, or the category's own when it has no group. A category with
 *   no code gets a tile of its own, so a section an office adds is always counted somewhere.
 * - **A tile counts only the categories this reader's rung is shown**, and is not drawn when none
 *   of them are. Archived categories are not drawn either: nobody logs against them today.
 */
export function summaryTiles<C extends SummaryTileCategory>(
  categories: readonly C[],
  rung: string,
  count: (category: C) => number,
  total: { label: string; value: number; term?: TermKey },
): SummaryTile[] {
  const shown = categories
    .map((category, at) => ({ category, at }))
    .filter(({ category }) => category.status === 'active' && isShownTo(category, rung))
    // By display order, and by position where two carry the same number, so a tie cannot shuffle.
    .sort((a, b) => a.category.displayOrder - b.category.displayOrder || a.at - b.at);

  // A `Map` keeps insertion order, which is the order of each tile's first category.
  const tiles = new Map<string, SummaryTile>();
  for (const { category } of shown) {
    const group = category.summaryGroupCode?.trim() || null;
    // Prefixed, because a category's own code may equal another category's group code.
    const key = group ? `group:${group}` : `own:${category.code}`;
    const value = Number(count(category)) || 0;
    const tile = tiles.get(key);
    if (tile) {
      tile.value += value;
    } else {
      tiles.set(key, {
        key,
        label: (group && category.summaryGroupLabel?.trim()) || category.label,
        value,
        total: false,
      });
    }
  }

  return [...tiles.values(), { key: 'total', label: total.label, value: total.value, total: true, term: total.term }];
}

/**
 * **The sections Log Activity shows this reader**, in display order: the active ones their rung is shown
 * (ADR-0020), by display order, ties by position, as `summaryTiles` orders its tiles.
 *
 * The one list the log draws **both** its cards and its tiles from (P18.95-T5 AC-2; the client's UI review,
 * UI-017: four tiles above five groups, because the seed counts Personal and Team Development in one
 * *Development* tile).
 */
export function shownSections<C extends SummaryTileCategory>(categories: readonly C[], rung: string): C[] {
  return categories
    .map((category, at) => ({ category, at }))
    .filter(({ category }) => category.status === 'active' && isShownTo(category, rung))
    .sort((a, b) => a.category.displayOrder - b.category.displayOrder || a.at - b.at)
    .map(({ category }) => category);
}

/**
 * **One tile per section, then the total** — Log Activity's strip since 2026-10-26 (P18.95-T5 AC-2, the
 * client's explicit request): the tiles name exactly the groups below them, so a reader adds up what they see.
 * The office's *Summary tile* grouping (ADR-0064) no longer applies here; the Activity Dashboard's strip,
 * `summaryTiles`, still reads it.
 *
 * `sections` is `shownSections`' answer, the list the cards are drawn from, so the two cannot disagree.
 */
export function sectionTiles<C extends SummaryTileCategory>(
  sections: readonly C[],
  count: (category: C) => number,
  total: { label: string; value: number; term?: TermKey },
): SummaryTile[] {
  return [
    ...sections.map((section) => ({
      key: `own:${section.code}`,
      label: section.label,
      value: Number(count(section)) || 0,
      total: false,
    })),
    { key: 'total', label: total.label, value: total.value, total: true, term: total.term },
  ];
}

// ------------------------------------------------------------------ the settings field (AC-5)

/** The two fields a category write carries. Both or neither: the server refuses one alone. */
export interface SummaryGroup {
  summaryGroupCode: string | null;
  summaryGroupLabel: string | null;
}

/** What a group is keyed by, read off any list of categories — the office's, or a template's. */
export interface SummaryGroupMember {
  code: string;
  summaryGroupCode?: string | null;
  summaryGroupLabel?: string | null;
}

/** The server's code shape (`common/validation/fields.ts`): 3–40 of A–Z, 0–9, `_`, a letter first. */
const CODE = /^[A-Z][A-Z0-9_]{2,39}$/;

/**
 * Every group the list holds, once each, in the order they first appear — what the field offers.
 *
 * **Archived categories count.** An archived category still renders its history, so its group
 * still exists, and the server compares labels across all of an office's categories.
 */
export function summaryGroups(categories: readonly SummaryGroupMember[]): { code: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const category of categories) {
    const code = category.summaryGroupCode?.trim();
    if (code && !seen.has(code)) seen.set(code, category.summaryGroupLabel?.trim() ?? '');
  }
  return [...seen].map(([code, label]) => ({ code, label }));
}

/** A category the tile planner reads: its code, its name, and its two fields. */
export interface TileMember extends SummaryGroupMember {
  label: string;
}

/** One category's two fields, as a tile plan writes them. */
export interface TileChange extends SummaryGroup {
  code: string;
}

/** What typing a tile name does: every category it changes, or why it is refused. */
export type TilePlan = { changes: TileChange[] } | { refused: string };

/** Said when a section with a tile of its own is given another name for it — in English, the catalogue's source. */
export const OWN_TILE_REFUSED = summaryTileMessages.en.ownTile;

/**
 * A code no group and **no section** holds: suggested from the name, then the section's own, then
 * numbered. A section's code is held even when that section is in the new tile: the day it left,
 * it would be a tile of its own under the shared tile's code (`CONFIG_SUMMARY_GROUP_CODE_TAKEN`).
 */
function freeCode(name: string, fallback: string, held: ReadonlySet<string>): string {
  const candidates = [suggestCode(name), fallback.toUpperCase()].filter((c) => CODE.test(c));
  const free = candidates.find((c) => !held.has(c));
  if (free) return free;
  const base = (candidates[0] ?? fallback.toUpperCase()).slice(0, 36);
  let n = 2;
  while (held.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/**
 * What typing a name into a section's *Summary tile* field does (ADR-0064, amended by OD-101).
 *
 * **One field on screen, two in the data** (ADR-0062 §2). The rule the data keeps: **only a tile of
 * two or more sections carries a code and a label**; a tile of one carries neither, so it is named
 * after its section and a rename carries it. So a name means one of these, checked in order:
 *
 * 1. **Empty**, or **the section's own name**: a tile of its own — neither field.
 * 2. **The name of a shared tile** (any case): join it, with its code and its exact label.
 * 3. **The name of another section that has a tile of its own**: the two are counted together, in a
 *    new shared tile under that section's name — both sections change.
 * 4. **A new name, on a section in a shared tile**: the tile is renamed, for every section in it,
 *    keeping its code — one edit, not one per section.
 * 5. **A new name, on a section with a tile of its own**: refused. Its tile *is* its name; rename the
 *    section instead.
 *
 * **Leaving a tile of two leaves a tile of one**, which then carries neither field — the other section
 * is changed too. Archived sections count throughout: they still render history, and the server
 * compares labels across all of an office's sections (`CONFIG_SUMMARY_GROUP_LABEL_MISMATCH`).
 *
 * A refusal is said in the reader's `language` (P18.98-T4; `messages/summary-tiles.ts`), English when none is passed.
 */
export function planSummaryTile(
  typed: string,
  self: TileMember,
  categories: readonly TileMember[],
  language: Language = SOURCE_LANGUAGE,
): TilePlan {
  const name = typed.trim();
  const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
  const others = categories.filter((c) => c.code !== self.code);
  const current = self.summaryGroupCode?.trim() || null;
  const mates = current ? others.filter((c) => c.summaryGroupCode?.trim() === current) : [];
  const own = (code: string): TileChange => ({ code, summaryGroupCode: null, summaryGroupLabel: null });
  const leave = (): TileChange[] => (mates.length === 1 ? [own(mates[0].code)] : []);

  if (!name) return { changes: [own(self.code), ...leave()] };

  const groups = summaryGroups(others);
  const group = groups.find((g) => same(g.label, name));
  if (group) {
    const joined = { code: self.code, summaryGroupCode: group.code, summaryGroupLabel: group.label };
    return { changes: group.code === current ? [joined] : [joined, ...leave()] };
  }

  if (same(self.label, name)) return { changes: [own(self.code), ...leave()] };

  const lone = others.find((c) => !c.summaryGroupCode?.trim() && same(c.label, name));
  if (lone) {
    const pair = {
      summaryGroupCode: freeCode(lone.label, lone.code, new Set([
        ...groups.map((g) => g.code),
        ...categories.map((c) => c.code),
        self.code,
      ])),
      summaryGroupLabel: lone.label,
    };
    return { changes: [{ code: self.code, ...pair }, { code: lone.code, ...pair }, ...leave()] };
  }

  if (current && mates.length > 0) {
    return {
      changes: [self, ...mates].map((c) => ({ code: c.code, summaryGroupCode: current, summaryGroupLabel: name })),
    };
  }
  return { refused: messagesIn(summaryTileMessages, language).ownTile };
}

/**
 * A tile refusal from the server, in the reader's words — or `null` for any other error.
 *
 * `CONFIG_SUMMARY_GROUP_LABEL_MISMATCH` carries the tile's labels in `details`; its message carries
 * the batch's op prefix and the tile's code, which the screens never show.
 * `CONFIG_SUMMARY_GROUP_CODE_TAKEN` names the code, because the reader typed it as a section's. Said in the reader's
 * `language` (P18.98-T4), English when none is passed.
 */
export function tileRefusal(error: ApiError, language: Language = SOURCE_LANGUAGE): ApiError | null {
  const t = messagesIn(summaryTileMessages, language);
  if (error.code === 'CONFIG_SUMMARY_GROUP_CODE_TAKEN') {
    const code = String(error.details?.summaryGroupCode ?? '');
    const label = String(error.details?.label ?? '');
    return { ...error, message: t.codeTaken({ code, label }) };
  }
  if (error.code !== 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH') return null;
  const labels = (error.details?.labels as string[] | undefined) ?? [];
  return { ...error, message: t.twoNames({ labels }) };
}

/** What the field shows for a section: its group's label, or empty for a tile of its own. */
export function summaryTileName(category: SummaryGroupMember): string {
  return category.summaryGroupCode?.trim() ? (category.summaryGroupLabel ?? '') : '';
}
