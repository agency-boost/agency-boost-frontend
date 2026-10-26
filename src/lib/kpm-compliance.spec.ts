import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMPAIGNS, complianceView, EVENTS, NEXT_YEAR_CAMPAIGN, TODAY } from '@test/kpm-compliance-fixtures';
import {
  campaignDateLabel, campaignGroups, campaignOf, campaignTag, COMPLIANCE_LABELS, complianceQuery, complianceSelectionFrom,
  dayWords, eventGroups, eventTag, firstModuleOf, NO_STATUS, OWN_COPY, pillOf, PROTOTYPE_COPY, rankOf, searchTree,
  skillsWithModules, sortRows, trainingPathOf, treeKindOf, type ComplianceCell, type ComplianceRow,
} from './kpm-compliance';

const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

const row = (name: string, status: string | null, extra: Partial<ComplianceCell> & { personal?: boolean } = {}): ComplianceRow => {
  const { personal = false, ...cell } = extra;
  return { membershipId: `m-${name}`, name, personal, leads: false, cell: { status, done: null, on: null, ...cell } };
};

/** Every string a copy object holds, its functions called with a sample. */
function strings(copy: object): string[] {
  return Object.values(copy).flatMap((v): string[] => {
    if (typeof v === 'string') return [v];
    if (typeof v === 'function') return [String((v as (...a: unknown[]) => unknown)('1 Sep', 'x', 'y'))];
    if (v && typeof v === 'object') return strings(v);
    return [];
  });
}

describe('the compliance tree’s rules (P18.6-T1, T2)', () => {
  describe('P18.6-T1 AC-2 the selection in the address', () => {
    it('reads the category and the item from the address', () => {
      expect(complianceSelectionFrom({ category: 'events', item: 'ev-1' })).toEqual({ category: 'events', item: 'ev-1' });
      expect(complianceSelectionFrom({ category: ['campaigns', 'goals'], item: [' APE_SPRINT '] })).toEqual({ category: 'campaigns', item: 'APE_SPRINT' });
    });

    it('is Training and its default when the address names nothing, or a category the read does not know', () => {
      expect(complianceSelectionFrom({})).toEqual({ category: 'training', item: null });
      expect(complianceSelectionFrom({ category: 'coaching' })).toEqual({ category: 'training', item: null });
      expect(complianceSelectionFrom({ category: 'training', item: '  ' })).toEqual({ category: 'training', item: null });
    });

    it('drops an item on a single-item category, which the read would refuse', () => {
      for (const category of ['goals', 'activity', 'activation']) {
        expect(complianceSelectionFrom({ category, item: 'x' })).toEqual({ category, item: null });
      }
    });

    it('writes the query the read takes, the item encoded, none on a single-item category', () => {
      expect(complianceQuery({ category: 'training', item: null })).toBe('?category=training');
      expect(complianceQuery({ category: 'events', item: 'a b&c' })).toBe('?category=events&item=a%20b%26c');
      expect(complianceQuery({ category: 'goals', item: 'x' })).toBe('?category=goals');
    });
  });

  describe('P18.6-T1 AC-3 to AC-7, P18.6-T2 AC-2, AC-6 the labels', () => {
    it('maps every cell code to the prototype’s words (CATEGORIES, :3013-3020)', () => {
      const words = (map: Record<string, { label: string }>) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.label]));
      expect(words(COMPLIANCE_LABELS.training)).toEqual({ done: 'Completed', in_progress: 'In progress', not_started: 'Not started' });
      expect(words(COMPLIANCE_LABELS.goals)).toEqual({ set: 'Set', not_set: 'Not set' });
      expect(words(COMPLIANCE_LABELS.activity)).toEqual({ logged: 'Logged', missed: 'Missed' });
      expect(words(COMPLIANCE_LABELS.activation)).toEqual({ completed: 'Completed', in_progress: 'In progress', overdue: 'Overdue' });
      expect(words(COMPLIANCE_LABELS.events.joined)).toEqual({
        registered: 'Registered', not_registered: 'Not registered', attended: 'Attended', no_show: 'No-show', unconfirmed: '—',
      });
      expect(words(COMPLIANCE_LABELS.events.feedback)).toEqual({ shared: 'Shared', not_shared: 'Not shared' });
      expect(words(COMPLIANCE_LABELS.campaigns.chasing)).toEqual({ chasing: 'Chasing', not_chasing: 'Not chasing' });
      expect(words(COMPLIANCE_LABELS.campaigns.achieved)).toEqual({
        qualified: 'Achieved', not_met: 'Not achieved', not_joined: 'Not achieved', in_progress: '—', unknown: '—',
      });
    });

    it('draws no Draft saved and no Partial (ADR-0049; the Activity tooltip)', () => {
      const all = JSON.stringify(COMPLIANCE_LABELS);
      expect(all).not.toMatch(/Draft saved|Partial/);
    });

    it('paints done green, progress amber with navy words, not done red, and — neutral (:564-568, :2915)', () => {
      expect(COMPLIANCE_LABELS.training.done.tone).toBe('success');
      expect(COMPLIANCE_LABELS.training.in_progress.tone).toBe('watch');
      expect(COMPLIANCE_LABELS.training.not_started.tone).toBe('alert');
      expect(COMPLIANCE_LABELS.events.joined.unconfirmed).toBe(NO_STATUS);
      expect(NO_STATUS).toEqual({ label: '—', tone: 'neutral' });
    });

    it('draws — for null, and for a code the map does not hold', () => {
      expect(pillOf(COMPLIANCE_LABELS.goals, null)).toBe(NO_STATUS);
      expect(pillOf(COMPLIANCE_LABELS.goals, 'draft')).toBe(NO_STATUS);
      expect(pillOf(COMPLIANCE_LABELS.goals, 'toString')).toBe(NO_STATUS);
      expect(pillOf(COMPLIANCE_LABELS.goals, 'set').label).toBe('Set');
    });
  });

  describe('P18.6-T1 AC-3 the sub-line, computed (contradiction 1)', () => {
    it('counts both, in the prototype’s words', () => {
      expect(PROTOTYPE_COPY.sub(28, 5)).toBe("Every AB's unit in this KPM — 28 people across 5 units");
      expect(PROTOTYPE_COPY.sub(1, 1)).toBe("Every AB's unit in this KPM — 1 person across 1 unit");
    });
  });

  describe('P18.6-T1 AC-8 sort, as the prototype does it', () => {
    it('ranks worst-first per category (STATUS_ORDER, eventOrderValue, the chase order)', () => {
      const s = (status: string | null) => rankOf('status', { status, done: null, on: null });
      expect([s('not_started'), s('in_progress'), s('done')]).toEqual([0, 1, 2]);
      expect([s('not_set'), s('set'), s('missed'), s('logged')]).toEqual([0, 2, 0, 2]);
      expect([s('overdue'), s('in_progress'), s('completed'), s(null)]).toEqual([0, 1, 2, null]);

      const e = (status: string | null, second: string | null = null) => rankOf('events', { status, done: null, on: null, second });
      expect([e('not_registered'), e('no_show'), e('attended', 'not_shared'), e('attended', 'shared'), e('registered')]).toEqual([0, 0, 1, 2, 2]);
      expect([e('unconfirmed', 'shared'), e(null)]).toEqual([null, null]);

      const c = (status: string | null) => rankOf('campaigns', { status, done: null, on: null });
      expect([c('not_chasing'), c('chasing'), c(null)]).toEqual([0, 1, null]);
    });

    it('keeps the head’s row first, puts — rows last both ways, and breaks a tie by name', () => {
      const rows = [
        row('Zed', 'done'), row('Head', 'done', { personal: true }), row('Nobody', null), row('Bea', 'not_started'),
        row('Ann', 'not_started'), row('Cal', 'in_progress'), row('Abe', null),
      ];
      expect(sortRows(rows, 'status', 'worst').map((r) => r.name)).toEqual(['Head', 'Ann', 'Bea', 'Cal', 'Zed', 'Abe', 'Nobody']);
      expect(sortRows(rows, 'status', 'best').map((r) => r.name)).toEqual(['Head', 'Zed', 'Cal', 'Ann', 'Bea', 'Abe', 'Nobody']);
    });

    it('sorts the two-column trees by their own orders', () => {
      const rows = [row('A', 'attended', { second: 'shared' }), row('B', 'no_show'), row('C', 'attended', { second: 'not_shared' }), row('D', 'unconfirmed')];
      expect(sortRows(rows, 'events', 'worst').map((r) => r.name)).toEqual(['B', 'C', 'A', 'D']);
      expect(sortRows(rows, 'events', 'best').map((r) => r.name)).toEqual(['A', 'C', 'B', 'D']);
      const chases = [row('A', 'chasing'), row('B', 'not_chasing'), row('C', null)];
      expect(sortRows(chases, 'campaigns', 'worst').map((r) => r.name)).toEqual(['B', 'A', 'C']);
      expect(sortRows(chases, 'campaigns', 'best').map((r) => r.name)).toEqual(['A', 'B', 'C']);
    });

    it('says which tree a category draws', () => {
      expect(['training', 'goals', 'activity', 'activation', 'events', 'campaigns'].map((c) => treeKindOf(c as never)))
        .toEqual(['status', 'status', 'status', 'status', 'events', 'campaigns']);
    });

    it('labels the toggle per category, worst and best (:3672-3684)', () => {
      const label = ([arrow, words]: readonly string[]) => `${arrow} ${words}`;
      expect(label(PROTOTYPE_COPY.sort.status.worst)).toBe('↓ Needs attention first');
      expect(label(PROTOTYPE_COPY.sort.status.best)).toBe('↑ On track first');
      expect(label(PROTOTYPE_COPY.sort.events.worst)).toBe('↓ Not joined first');
      expect(label(PROTOTYPE_COPY.sort.events.best)).toBe('↑ Joined first');
      expect(label(PROTOTYPE_COPY.sort.campaigns.worst)).toBe('↓ Not chasing first');
      expect(label(PROTOTYPE_COPY.sort.campaigns.best)).toBe('↑ Chasing first');
    });
  });

  describe('P18.6-T1 AC-8 search, as the prototype does it (:4017-4071)', () => {
    const view = complianceView('training');

    it('keeps everything for an empty or blank search', () => {
      expect(searchTree(view.tree, '')).toEqual(view.tree);
      expect(searchTree(view.tree, '   ')).toEqual(view.tree);
    });

    it('matches a trimmed, case-insensitive substring, keeping the card’s head row first for context', () => {
      const found = searchTree(view.tree, '  SINTA ');
      expect(found.map((s) => s.head.name)).toEqual(['Hendra Wibowo']);
      expect(found[0].units.map((u) => u.head.name)).toEqual(['Ika Wirawan']);
      expect(found[0].units[0].rows.map((r) => r.name)).toEqual(['Ika Wirawan', 'Sinta Halim']);
    });

    it('keeps a matching leader’s card with their own row, and their section', () => {
      const found = searchTree(view.tree, 'hendra');
      expect(found.map((s) => s.head.name)).toEqual(['Hendra Wibowo']);
      expect(found[0].units.map((u) => u.head.name)).toEqual(['Hendra Wibowo']);
      expect(found[0].units[0].rows.map((r) => r.name)).toEqual(['Hendra Wibowo']);
    });

    it('recomputes no count: a card and a section still total everybody they hold', () => {
      const [section] = searchTree(view.tree, 'sinta');
      const original = view.tree[0];
      expect([section.done, section.of]).toEqual([original.done, original.of]);
      expect([section.units[0].done, section.units[0].of]).toEqual([original.units[1].done, original.units[1].of]);
    });

    it('leaves nothing when nobody matches', () => {
      expect(searchTree(view.tree, 'zzz')).toEqual([]);
    });
  });

  describe('P18.6-T1 AC-4 Training’s tabs', () => {
    const { training } = complianceView().catalog;

    it('finds the default — the first module of the first skill holding one — and a module’s place', () => {
      expect(firstModuleOf(training[0])).toBe('PROSPECT_LIST');
      expect(firstModuleOf(training[1])).toBeNull();
      expect(skillsWithModules({ code: 'X', label: 'X', skills: [{ code: 'S', label: 'S', modules: [] }] })).toEqual([]);
      const path = trainingPathOf(training, 'CLOSING_TECHNIQUES');
      expect([path?.category.code, path?.skill.code]).toEqual(['SALES', 'CLOSING']);
      expect(trainingPathOf(training, null)).toBeNull();
    });
  });

  describe('P18.6-T2 AC-1, AC-4 the pickers', () => {
    it('groups events: Upcoming soonest first with a running one among them, Past latest first', () => {
      const shuffled = [EVENTS[3], EVENTS[1], EVENTS[0], EVENTS[2]];
      const groups = eventGroups(shuffled);
      expect(groups.upcoming.map((e) => e.id)).toEqual(['ev-huddle', 'ev-kickoff']);
      expect(groups.past.map((e) => e.id)).toEqual(['ev-prulink', 'ev-townhall']);
    });

    it('tags an event with its phase word', () => {
      expect(EVENTS.map((e) => eventTag(e).label)).toEqual(['Running', 'Upcoming', 'Past', 'Past']);
    });

    it('groups campaigns: Structural, Seasonal — Ongoing with an upcoming one, Seasonal — Past', () => {
      const groups = campaignGroups(CAMPAIGNS);
      expect(groups.structural.map((c) => c.code)).toEqual(['MDRT_QUALIFICATION']);
      expect(groups.ongoing.map((c) => c.code)).toEqual(['APE_SPRINT', 'APE_CHALLENGE_NEXT']);
      expect(groups.past.map((c) => c.code)).toEqual(['PERSISTENCY_PUSH']);
    });

    it('labels and tags each campaign (CAMPAIGN_ITEMS, :3002-3011), an upcoming one starting, never “since”', () => {
      expect(CAMPAIGNS.map((c) => campaignDateLabel(c, TODAY))).toEqual(['Always on', 'Since 1 Sep', 'Starts 1 Nov', 'Ended 31 Agu']);
      expect(CAMPAIGNS.map((c) => campaignTag(c))).toEqual([
        { label: 'Structural', tone: 'structural' },
        { label: 'Ongoing', tone: 'ongoing' },
        { label: 'Upcoming', tone: 'upcoming' },
        { label: 'Past', tone: 'past' },
      ]);
    });

    it('puts an upcoming campaign of next year under Seasonal — Ongoing, tagged Upcoming, starting with its year', () => {
      expect(campaignGroups([...CAMPAIGNS, NEXT_YEAR_CAMPAIGN]).ongoing.map((c) => c.code))
        .toEqual(['APE_SPRINT', 'APE_CHALLENGE_NEXT', 'NEW_YEAR_DASH']);
      expect(campaignTag(NEXT_YEAR_CAMPAIGN)).toEqual({ label: 'Upcoming', tone: 'upcoming' });
      expect(campaignDateLabel(NEXT_YEAR_CAMPAIGN, TODAY)).toBe('Starts 1 Jan 2027');
    });

    it('finds a campaign by its code in any case, as the read accepts it', () => {
      expect(campaignOf(CAMPAIGNS, 'persistency_push')?.code).toBe('PERSISTENCY_PUSH');
      expect(campaignOf(CAMPAIGNS, null)).toBeNull();
    });

    it('writes a day as the column does, with the year only when it is not this one', () => {
      expect(dayWords('2026-09-01', TODAY)).toBe('1 Sep');
      expect(dayWords('2025-12-20', TODAY)).toBe('20 Des 2025');
    });
  });

  describe('P18.6-T1 AC-10 the module’s own strings', () => {
    it('hold none of OD-39’s six words, no phase and no code', () => {
      for (const text of strings(OWN_COPY)) {
        expect(text).not.toMatch(SIX_WORDS);
        expect(text).not.toMatch(/\bphase\b|P\d+(\.\d+)?-T\d+|[a-z_]+:[a-z_]+/i);
      }
    });

    it('keeps the prototype’s own KPM, and only in its sub-line (OD-39, on the client’s list)', () => {
      const flagged = strings(PROTOTYPE_COPY).filter((text) => SIX_WORDS.test(text));
      expect(flagged).toHaveLength(1);
      expect(flagged[0]).toMatch(/^Every AB's unit in this KPM — /);
    });

    it('names the expired activation’s end in its words (OD-159, ADR-0149)', () => {
      expect(OWN_COPY.expiredName('30 Sep')).toBe('Overdue: ended on 30 Sep without being marked complete');
    });

    it('names a past event’s — for a member nobody has confirmed yet (D-status)', () => {
      expect(OWN_COPY.awaitingConfirmation).toBe('awaiting confirmation');
    });
  });

  describe('P18.6-T1 AC-10 tokens', () => {
    const SRC = join(__dirname, '..');
    const files = ['compliance-screen.tsx', 'compliance-summary.tsx', 'compliance-pickers.tsx', 'compliance-tree.tsx', 'compliance-parts.tsx']
      .map((f) => readFileSync(join(SRC, 'components', 'analytics', f), 'utf8'));

    it('uses no raw colour in any of the screen’s components (their comments may name the prototype’s)', () => {
      const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      for (const source of files) expect(code(source)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    });

    it('draws the category with no module muted at 4.5:1 or better on the card (contradiction 16)', () => {
      const css = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8');
      const token = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1];
      const alpha = Number(/text-muted\/\[(0\.\d+)\]/.exec(files[2])![1]);
      const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
      const over = (fg: string, a: number, bg: string) => [0, 1, 2].map((i) => Math.round(channel(fg, i) * a + channel(bg, i) * (1 - a)));
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const card = token('card');
      const muted = over(token('muted'), alpha, card);
      const ratio = (lum([0, 1, 2].map((i) => channel(card, i))) + 0.05) / (lum(muted) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      // And lighter than its neighbours, which are the muted token itself: the prototype’s cue survives.
      expect(alpha).toBeLessThan(1);
    });
  });
});
