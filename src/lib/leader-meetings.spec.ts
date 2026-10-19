import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, SRC } from '@test/copy-scan';
import {
  changeDateLabel, coreLeadersTagged, dateBlock, defaultMeetingTitle, deleteQuestion, editorsInOrder, filterMeetings,
  FORUM_COPY, initialsOf, openItemsNoun, rungShort, sharedAddress, shareHint, stateLabel, taggedLeaders,
} from './leader-meetings';
import { AGUS, card, editors, MAYA, MEETINGS, SARI, WILSON } from '@/app/leader-meetings/forum-fixtures';

describe('the forum’s words and helpers (P18.1-T2)', () => {
  it('P18.1-T2 AC-2: "{n} core leaders tagged", singular for one (F-186)', () => {
    expect(coreLeadersTagged(3)).toBe('3 core leaders tagged');
    expect(coreLeadersTagged(1)).toBe('1 core leader tagged');
    expect(coreLeadersTagged(0)).toBe('0 core leaders tagged');
  });

  it('P18.1-T2 AC-2: "{n} open item" / "{n} open items" (`:2606`)', () => {
    expect(openItemsNoun(1)).toBe('open item');
    expect(openItemsNoun(4)).toBe('open items');
  });

  it('a state reads Upcoming or Completed (`:2600`)', () => {
    expect(stateLabel('upcoming')).toBe('Upcoming');
    expect(stateLabel('completed')).toBe('Completed');
  });

  it('a new meeting is titled one past the highest number on the list (ADR-0130 §2)', () => {
    expect(defaultMeetingTitle(MEETINGS)).toBe('Strategic Check-in — #15');
    expect(defaultMeetingTitle([])).toBe('Strategic Check-in — #1');
    // The highest, not the count or the newest: a deleted #13 leaves a gap that is not refilled here.
    expect(defaultMeetingTitle([{ number: 12 }, { number: 14 }])).toBe('Strategic Check-in — #15');
  });

  it('the filter: Upcoming and Past over the one read, newest first by date (`:2614-2616`)', () => {
    const shuffled = [MEETINGS[2], MEETINGS[0], MEETINGS[1]];
    expect(filterMeetings(shuffled, 'all').map((m) => m.number)).toEqual([14, 13, 12]);
    expect(filterMeetings(shuffled, 'upcoming').map((m) => m.number)).toEqual([14]);
    expect(filterMeetings(shuffled, 'past').map((m) => m.number)).toEqual([13, 12]);
    // The read is not reordered in place.
    expect(shuffled.map((m) => m.number)).toEqual([12, 14, 13]);
  });

  it('the date block is the month’s three letters over the day, from the date’s own numbers (`:2597`)', () => {
    expect(dateBlock('2026-09-12')).toEqual({ month: 'Sep', day: '12' });
    expect(dateBlock('2026-10-01')).toEqual({ month: 'Oct', day: '1' });
    expect(dateBlock('not a date')).toEqual({ month: '', day: '' });
  });

  it('editors in order: the Owner, then the Admins, then the Core Leaders (D-coeditors)', () => {
    expect(editorsInOrder(editors()).map((p) => p.name)).toEqual([
      WILSON.name, MAYA.name, AGUS.name, SARI.name, 'Yosef Pratama',
    ]);
    expect(editorsInOrder(editors({ owner: null, admins: [] })).map((p) => p.name)).toEqual([AGUS.name, SARI.name, 'Yosef Pratama']);
  });

  it('P18.1-T2 AC-2: the card’s avatars are every tagged editor but the Owner — the people the count counts (F-186)', () => {
    // The seed: Maya, an Admin, is not tagged, so #14 reads "3 core leaders tagged" and draws three.
    expect(taggedLeaders(editors()).map((p) => p.name)).toEqual([AGUS.name, SARI.name, 'Yosef Pratama']);
    expect(taggedLeaders(editors())).toHaveLength(editors().coreLeaderCount);
    // A tagged Admin is counted, and drawn, ahead of the Core Leaders; the Owner never, tagged or not.
    const tagged = editors({ owner: { ...WILSON, tagged: true }, admins: [{ ...MAYA, tagged: true }], coreLeaderCount: 4 });
    expect(taggedLeaders(tagged).map((p) => p.name)).toEqual([MAYA.name, AGUS.name, SARI.name, 'Yosef Pratama']);
    expect(taggedLeaders(tagged)).toHaveLength(tagged.coreLeaderCount);
  });

  it('initials, and a rung as the forum draws it', () => {
    expect(initialsOf('Wilson Tanoto')).toBe('WT');
    expect(initialsOf('  maya  halim  putri ')).toBe('MH');
    expect(rungShort({ code: 'AAB', label: 'Associate Agency Builder' })).toBe('AAB');
    expect(rungShort({ code: 'AGENT', label: 'Agent' })).toBe('Agent');
  });

  it('P18.1-T3 AC-1: the share address and the hint in OD-146’s answered words (I-256)', () => {
    expect(sharedAddress('https://app.example', 'abc_DEF-123')).toBe('https://app.example/leader-meetings/shared/abc_DEF-123');
    expect(shareHint('BSD City Branch', 'Oct 24, 2026')).toBe(
      "Anyone signed in to AgencyBoost at BSD City Branch can open this meeting's minutes with this link, read-only, until Oct 24, 2026.",
    );
  });

  it('the dialog’s question and the date’s button, in the spec’s words', () => {
    expect(deleteQuestion(card().title)).toBe(
      "Delete “Strategic Check-in — #14”? Nothing has been written in it yet, and it can't be brought back.",
    );
    expect(changeDateLabel(card().title)).toBe('Change the date of Strategic Check-in — #14');
  });

  it('the prototype’s strings ship verbatim', () => {
    expect(FORUM_COPY.sub).toBe('Biweekly check-ins with your core leaders — agenda, notes, and action items');
    expect(FORUM_COPY.listLine).toBe(
      'Biweekly strategic check-ins with your core leaders — agenda, discussion notes, and action items, updated together.',
    );
    expect(FORUM_COPY.cadence).toBe('Recommended: every 2 weeks · 60–90 mins');
    expect(FORUM_COPY.preparingPdf).toBe('Preparing PDF — use your browser’s print dialog to save');
    expect(FORUM_COPY.tabs).toEqual({ overview: 'Overview & Stats', agenda: 'Agenda', actions: 'Action Items' });
  });
});

/**
 * **D-copy.** Every string the forum's shell writes itself — its words, and anything a screen of it can render —
 * uses none of the six words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*) and names
 * no phase. Read off the syntax tree, as `no-phase-in-copy.spec.ts` reads it, so comments never count.
 */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned|\bphase\s*(\d|\{)/i;

const SHELL_FILES = [
  'lib/leader-meetings.ts',
  'components/leader-forum/meeting-writer.tsx',
  'components/leader-forum/forum-states.tsx',
  'components/leader-forum/forum-list.tsx',
  'components/leader-forum/meeting-card.tsx',
  'components/leader-forum/meeting-dialog.tsx',
  'components/leader-forum/meeting-head.tsx',
  'components/leader-forum/meeting-screen.tsx',
  'components/leader-forum/meeting-tabs.tsx',
  'components/leader-forum/share-dialog.tsx',
  'app/leader-meetings/page.tsx',
  'app/leader-meetings/[meetingId]/page.tsx',
  'app/leader-meetings/shared/[token]/page.tsx',
];

function renderedStrings(file: string): string[] {
  const sf = parse(file, readFileSync(join(SRC, file), 'utf8'));
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    // An import's path is not copy.
    if (ts.isImportDeclaration(node)) return;
    const text = renderable(node);
    if (text !== null && text.trim()) found.push(text.replace(/\s+/g, ' ').trim());
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('D-copy: the forum’s own strings (P18.1-T2)', () => {
  it('the scan reads the files, so a silent zero cannot pass', () => {
    const all = SHELL_FILES.flatMap(renderedStrings);
    expect(all.length).toBeGreaterThan(60);
    expect(all).toContain('Strategic Leader Forum');
  });

  it.each(SHELL_FILES)('%s: none of the six words, no phase', (file) => {
    expect(renderedStrings(file).filter((text) => SIX_WORDS.test(text))).toEqual([]);
  });

  it('every word and sentence the module composes, with its values in', () => {
    const composed = [
      ...Object.values(FORUM_COPY).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
      coreLeadersTagged(1), coreLeadersTagged(3), openItemsNoun(1), openItemsNoun(2),
      changeDateLabel('{title}'), deleteQuestion('{title}'), shareHint('{branch}', '{date}'),
    ];
    expect(composed.filter((text) => SIX_WORDS.test(text))).toEqual([]);
  });

  it('the scan itself catches each word', () => {
    for (const text of ['This office', 'your KPM', 'who reports to', 'tagged to a unit', 'untagged', 'unassigned', 'from phase 18']) {
      expect(SIX_WORDS.test(text)).toBe(true);
    }
    expect(SIX_WORDS.test('3 core leaders tagged')).toBe(false);
  });
});
