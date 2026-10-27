import { describe, expect, it } from 'vitest';
import {
  isShownTo, OWN_TILE_REFUSED, planSummaryTile, sectionTiles, shownSections, summaryGroups, summaryTileName,
  summaryTiles, tileRefusal, type SummaryTileCategory,
} from './summary-tiles';

const category = (
  code: string,
  label: string,
  displayOrder: number,
  over: Partial<SummaryTileCategory> = {},
): SummaryTileCategory => ({
  code, label, displayOrder, status: 'active', appliesToOrgLevelCodes: [],
  summaryGroupCode: null, summaryGroupLabel: null, ...over,
});

/**
 * The five seeded sections, grouped as `SEED_ACTIVITY_CATEGORIES` groups them (ADR-0064, OD-101): only
 * *Development* is a shared tile; the other three carry neither field and are named after themselves.
 */
const SEED = [
  category('LEADS_GENERATION', 'Leads Generation', 1),
  category('SELLING', 'Selling', 2),
  category('RECRUITMENT', 'Recruitment', 3),
  category('PERSONAL_DEVELOPMENT', 'Personal Development', 4, { summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Development' }),
  category('TEAM_DEVELOPMENT', 'Team Development', 5, { summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Development' }),
];

/** One count per section, distinct so a sum says which sections went into it. */
const COUNTS: Record<string, number> = {
  LEADS_GENERATION: 1, SELLING: 2, RECRUITMENT: 4, PERSONAL_DEVELOPMENT: 8, TEAM_DEVELOPMENT: 16, REFERRALS: 32,
};
const count = (c: SummaryTileCategory) => COUNTS[c.code] ?? 0;
const TOTAL = { label: 'Total touches today', value: 63 };

const labels = (tiles: ReturnType<typeof summaryTiles>) => tiles.map((t) => t.label);
const values = (tiles: ReturnType<typeof summaryTiles>) => tiles.map((t) => t.value);

describe('summaryTiles (P10.1-T5, ADR-0064)', () => {
  it('AC-3, AC-4: the seed’s strip is the prototype’s — four tiles, then the total', () => {
    // `Overall.html:2720-2726`: Leads Generation, Selling, Recruitment, Development, Total.
    const tiles = summaryTiles(SEED, 'AGENT', count, TOTAL);

    expect(labels(tiles)).toEqual([
      'Leads Generation', 'Selling', 'Recruitment', 'Development', 'Total touches today',
    ]);
    // Development is Personal (8) and Team (16) together.
    expect(values(tiles)).toEqual([1, 2, 4, 24, 63]);
    expect(tiles.map((t) => t.total)).toEqual([false, false, false, false, true]);
  });

  it('AC-4: a category with no code gets a tile of its own, under its own label', () => {
    // A section an office adds is always counted somewhere — OD-63's reason still holds.
    const tiles = summaryTiles(
      [...SEED, category('REFERRALS', 'Referrals', 6)],
      'AGENT', count, TOTAL,
    );

    expect(labels(tiles)).toEqual([
      'Leads Generation', 'Selling', 'Recruitment', 'Development', 'Referrals', 'Total touches today',
    ]);
    expect(tiles[4].value).toBe(32);
  });

  it('AC-4: an ungrouped category renamed renames its tile, because the label is the category’s', () => {
    const tiles = summaryTiles([category('REFERRALS', 'Rujukan', 1)], 'AGENT', count, TOTAL);

    expect(tiles[0].label).toBe('Rujukan');
  });

  it('AC-4: the tile’s label is the group’s, from configuration, never the category’s', () => {
    const renamed = SEED.map((c) => (c.summaryGroupCode === 'DEVELOPMENT'
      ? { ...c, summaryGroupLabel: 'Pengembangan' }
      : c));

    expect(labels(summaryTiles(renamed, 'AGENT', count, TOTAL))[3]).toBe('Pengembangan');
  });

  it('AC-4: a tile sits where its first category sits in display order', () => {
    // Team Development moved to the top takes the Development tile with it; nothing else moves.
    const reordered = SEED.map((c) => (c.code === 'TEAM_DEVELOPMENT' ? { ...c, displayOrder: 0 } : c));

    expect(labels(summaryTiles(reordered, 'AGENT', count, TOTAL))).toEqual([
      'Development', 'Leads Generation', 'Selling', 'Recruitment', 'Total touches today',
    ]);
  });

  it('AC-4: a category this rung is not shown drops out of its tile', () => {
    const narrowed = SEED.map((c) => (c.code === 'TEAM_DEVELOPMENT'
      ? { ...c, appliesToOrgLevelCodes: ['AB'] }
      : c));

    // An agent's Development is Personal alone; an AB's is both.
    expect(summaryTiles(narrowed, 'AGENT', count, TOTAL)[3]).toMatchObject({ label: 'Development', value: 8 });
    expect(summaryTiles(narrowed, 'AB', count, TOTAL)[3]).toMatchObject({ label: 'Development', value: 24 });
  });

  it('AC-4: a group none of whose categories this rung is shown draws no tile', () => {
    const leadersOnly = SEED.map((c) => (c.summaryGroupCode === 'DEVELOPMENT'
      ? { ...c, appliesToOrgLevelCodes: ['AB', 'AAB'] }
      : c));

    expect(labels(summaryTiles(leadersOnly, 'AGENT', count, TOTAL))).toEqual([
      'Leads Generation', 'Selling', 'Recruitment', 'Total touches today',
    ]);
  });

  it('draws no tile for an archived category: nobody logs against it today', () => {
    const archived = SEED.map((c) => (c.code === 'RECRUITMENT' ? { ...c, status: 'archived' as const } : c));

    expect(labels(summaryTiles(archived, 'AGENT', count, TOTAL))).not.toContain('Recruitment');
  });

  it('AC-5: regrouping moves a count between tiles and never changes one', () => {
    // Presentation only (ADR-0064): the tiles still add up to the same figure, and the total is the
    // screen's own number, untouched by the grouping.
    const ungrouped = SEED.map((c) => ({ ...c, summaryGroupCode: null, summaryGroupLabel: null }));
    const lumped = SEED.map((c) => ({ ...c, summaryGroupCode: 'ALL', summaryGroupLabel: 'Everything' }));
    const sum = (cats: SummaryTileCategory[]) => summaryTiles(cats, 'AGENT', count, TOTAL)
      .filter((t) => !t.total).reduce((n, t) => n + t.value, 0);

    expect(sum(ungrouped)).toBe(31);
    expect(sum(SEED)).toBe(31);
    expect(sum(lumped)).toBe(31);
    expect(summaryTiles(lumped, 'AGENT', count, TOTAL).at(-1)).toMatchObject({ value: 63 });
    expect(labels(summaryTiles(ungrouped, 'AGENT', count, TOTAL))).toHaveLength(6);
  });

  it('keeps a category’s own tile apart from a group that happens to share its code', () => {
    const tiles = summaryTiles([
      category('SELLING', 'Selling', 1),
      category('REFERRALS', 'Referrals', 2, { summaryGroupCode: 'SELLING', summaryGroupLabel: 'Sales' }),
    ], 'AGENT', count, TOTAL);

    expect(labels(tiles)).toEqual(['Selling', 'Sales', 'Total touches today']);
    expect(new Set(tiles.map((t) => t.key)).size).toBe(3);
  });

  it('reads a count that is not a number as zero, not as NaN', () => {
    const tiles = summaryTiles([category('SELLING', 'Selling', 1)], 'AGENT', () => Number.NaN, TOTAL);

    expect(tiles[0].value).toBe(0);
  });

  it('keeps two sections with the same display number in the order the office holds them', () => {
    const tied = [category('B', 'Bee', 1), category('A', 'Ay', 1)];

    expect(labels(summaryTiles(tied, 'AGENT', count, TOTAL))).toEqual(['Bee', 'Ay', 'Total touches today']);
  });

  it('names a group that carries no label after its first section, rather than drawing a blank', () => {
    // The server refuses a code without a label; a snapshot from before that rule still renders.
    const tiles = summaryTiles(
      [category('SELLING', 'Selling', 1, { summaryGroupCode: 'SALES', summaryGroupLabel: '  ' })],
      'AGENT', count, TOTAL,
    );

    expect(tiles[0].label).toBe('Selling');
  });

  it('draws the total alone when the office has no sections', () => {
    expect(summaryTiles([], 'AGENT', count, TOTAL)).toEqual([
      { key: 'total', label: 'Total touches today', value: 63, total: true },
    ]);
  });
});

describe('isShownTo (ADR-0020)', () => {
  it('reads an empty list as every rung', () => {
    expect(isShownTo({ appliesToOrgLevelCodes: [] }, 'AGENT')).toBe(true);
    expect(isShownTo({ appliesToOrgLevelCodes: ['AB'] }, 'AGENT')).toBe(false);
    expect(isShownTo({ appliesToOrgLevelCodes: ['AB'] }, 'AB')).toBe(true);
  });
});

describe('the Summary tile field (P10.1-T5 AC-5, OD-101)', () => {
  const REFERRALS = category('REFERRALS', 'Referrals', 6);
  const WITH = [...SEED, REFERRALS];
  const plan = (typed: string, self: SummaryTileCategory, all: readonly SummaryTileCategory[] = WITH) =>
    planSummaryTile(typed, self, all);

  it('lists each shared tile once, archived sections included', () => {
    // A tile of one carries no code, so only *Development* is a group on the seed.
    expect(summaryGroups(SEED)).toEqual([{ code: 'DEVELOPMENT', label: 'Development' }]);
  });

  it('1. empty, or the section’s own name, is a tile of its own: neither field', () => {
    expect(plan('  ', REFERRALS)).toEqual({ changes: [{ code: 'REFERRALS', summaryGroupCode: null, summaryGroupLabel: null }] });
    expect(plan('referrals', REFERRALS)).toEqual({ changes: [{ code: 'REFERRALS', summaryGroupCode: null, summaryGroupLabel: null }] });
  });

  it('2. joins a shared tile, any case, with its code and exact label', () => {
    expect(plan('development', REFERRALS)).toEqual({
      changes: [{ code: 'REFERRALS', summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Development' }],
    });
  });

  it('2. keeps a shared tile as it is when its name is left unchanged', () => {
    expect(plan('Development', SEED[4])).toEqual({
      changes: [{ code: 'TEAM_DEVELOPMENT', summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Development' }],
    });
  });

  it('3. typing another section’s name counts the two together, in one tile under that name', () => {
    // *Referrals* typed "selling": Selling has a tile of its own, so both move into a new shared
    // tile named *Selling* — never a second *Selling* tile beside the first.
    expect(plan('selling', REFERRALS)).toEqual({
      changes: [
        { code: 'REFERRALS', summaryGroupCode: 'SELLING_2', summaryGroupLabel: 'Selling' },
        { code: 'SELLING', summaryGroupCode: 'SELLING_2', summaryGroupLabel: 'Selling' },
      ],
    });
  });

  it('3. never takes a section’s code, even one it counts together (P10.1-T6)', () => {
    // A tile coded SELLING outlives Selling leaving it, and Selling alone is a tile coded SELLING too.
    const result = plan('selling', REFERRALS);
    const codes = new Set(WITH.map((c) => c.code));
    expect('changes' in result && result.changes.every((c) => !codes.has(c.summaryGroupCode!))).toBe(true);
    // A section whose own code the name would suggest, outside both: still not taken.
    const named = [...WITH, category('SELLING_2', 'Selling two', 7)];
    const next = plan('selling', REFERRALS, named);
    expect('changes' in next && next.changes[0].summaryGroupCode).toBe('SELLING_3');
  });

  it('3. never takes a code a shared tile already holds', () => {
    const held = [...WITH, category('X1', 'Other', 7, { summaryGroupCode: 'SELLING_2', summaryGroupLabel: 'Sale' }),
      category('X2', 'Other two', 8, { summaryGroupCode: 'SELLING_2', summaryGroupLabel: 'Sale' })];
    const result = plan('Selling', REFERRALS, held);
    expect('changes' in result && result.changes[0].summaryGroupCode).toBe('SELLING_3');
  });

  it('4. a new name on a section in a shared tile renames the tile for every section in it, keeping its code', () => {
    expect(plan(' Pengembangan ', SEED[3])).toEqual({
      changes: [
        { code: 'PERSONAL_DEVELOPMENT', summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Pengembangan' },
        { code: 'TEAM_DEVELOPMENT', summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Pengembangan' },
      ],
    });
  });

  it('5. refuses a new name on a section with a tile of its own — its tile is its name', () => {
    expect(plan('Penjualan', SEED[1])).toEqual({ refused: OWN_TILE_REFUSED });
  });

  it('leaving a tile of two leaves a tile of one, which carries neither field', () => {
    // Personal Development goes back to a tile of its own; Team Development, alone, does too.
    expect(plan('', SEED[3])).toEqual({
      changes: [
        { code: 'PERSONAL_DEVELOPMENT', summaryGroupCode: null, summaryGroupLabel: null },
        { code: 'TEAM_DEVELOPMENT', summaryGroupCode: null, summaryGroupLabel: null },
      ],
    });
    const three = [...WITH.slice(0, 5), { ...REFERRALS, summaryGroupCode: 'DEVELOPMENT', summaryGroupLabel: 'Development' }];
    // With three in it, the other two stay a shared tile.
    expect(plan('', SEED[3], three)).toEqual({
      changes: [{ code: 'PERSONAL_DEVELOPMENT', summaryGroupCode: null, summaryGroupLabel: null }],
    });
  });

  it('shows a grouped section its tile’s name, and a section with a tile of its own nothing', () => {
    expect(summaryTileName(SEED[3])).toBe('Development');
    expect(summaryTileName(SEED[1])).toBe('');
    expect(summaryTileName({ code: 'X', summaryGroupCode: null, summaryGroupLabel: 'Stray' })).toBe('');
  });

  it('words the server’s mismatch refusal for the reader, and leaves other errors alone', () => {
    const refused = tileRefusal({
      code: 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH',
      message: 'Change 2 (category.update): The sections in the summary tile DEVELOPMENT …',
      details: { summaryGroupCode: 'DEVELOPMENT', labels: ['Development', 'Pengembangan'] },
      requestId: 'r1',
    });
    expect(refused?.message).toBe(
      'One summary tile, two names: “Development” and “Pengembangan”. Give every section in it the same tile name.',
    );
    expect(refused?.message).not.toMatch(/DEVELOPMENT|Change 2/);
    expect(tileRefusal({ code: 'VALIDATION_FAILED', message: 'x', requestId: 'r' })).toBeNull();
  });

  it('words the server’s taken-code refusal, naming the code the reader typed (P10.1-T6)', () => {
    const refused = tileRefusal({
      code: 'CONFIG_SUMMARY_GROUP_CODE_TAKEN',
      message: 'Change 1 (category.create): DEVELOPMENT is the code of the summary tile …',
      details: { summaryGroupCode: 'DEVELOPMENT', label: 'Development' },
      requestId: 'r1',
    });
    expect(refused).toMatchObject({
      code: 'CONFIG_SUMMARY_GROUP_CODE_TAKEN',
      message: 'DEVELOPMENT is already the code of the summary tile “Development”. Give the section another code.',
    });
  });
});

/** Log Activity's strip since 2026-10-26: one tile per section it shows (P18.95-T5 AC-2; UI-017). */
describe('P18.95-T5 AC-2: shownSections and sectionTiles', () => {
  it('P18.95-T5 AC-2: the seed’s log strip is its five sections and the total — the Development grouping is not read', () => {
    const tiles = sectionTiles(shownSections(SEED, 'AGENT'), count, TOTAL);
    expect(labels(tiles)).toEqual([
      'Leads Generation', 'Selling', 'Recruitment', 'Personal Development', 'Team Development', 'Total touches today',
    ]);
    expect(values(tiles)).toEqual([1, 2, 4, 8, 16, 63]);
    expect(tiles.at(-1)!.total).toBe(true);
    expect(tiles.filter((t) => t.total)).toHaveLength(1);
  });

  it('P18.95-T5 AC-2: one list — the sections in display order, ties by position, active and shown to the rung only', () => {
    const list = [
      category('B', 'Second', 2),
      category('A', 'First', 1),
      category('C', 'Tie, earlier', 3),
      category('D', 'Tie, later', 3),
      category('OLD', 'Archived', 0, { status: 'archived' }),
      category('LEAD', 'Leaders only', 4, { appliesToOrgLevelCodes: ['AB'] }),
    ];
    expect(shownSections(list, 'AGENT').map((c) => c.code)).toEqual(['A', 'B', 'C', 'D']);
    expect(shownSections(list, 'AB').map((c) => c.code)).toEqual(['A', 'B', 'C', 'D', 'LEAD']);
    // The tiles are that list, one each, in that order: a card and its tile cannot disagree.
    const sections = shownSections(list, 'AB');
    expect(labels(sectionTiles(sections, () => 0, TOTAL)).slice(0, -1)).toEqual(sections.map((c) => c.label));
  });

  it('P18.95-T5 AC-2: keys a tile by its section, so two sections of one name are still two tiles', () => {
    const tiles = sectionTiles([category('X', 'Same', 1), category('Y', 'Same', 2)], () => 1, TOTAL);
    expect(tiles.map((t) => t.key)).toEqual(['own:X', 'own:Y', 'total']);
  });

  it('P18.95-T5 AC-2: a count that is not a number counts as zero, as summaryTiles has it', () => {
    expect(values(sectionTiles([category('X', 'X', 1)], () => Number.NaN, TOTAL))).toEqual([0, 63]);
  });
});
