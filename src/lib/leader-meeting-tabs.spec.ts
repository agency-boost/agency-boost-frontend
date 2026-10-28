import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, SRC } from '@test/copy-scan';
import { billions, makeActionItems, makeMeetingView, makeScorecard, millions } from '@test/leader-meetings-fixtures';
import {
  accessNoteText, cellText, columnHeader, formatFigure, ItemWrites, leftOutLine, listed, moveTo, nextStatus, printLeftOutLine,
  STATUS_TONE, TABS_COPY, TABS_OWN_COPY, withActionItem, withActionItems, withAgendaItem, withTarget,
} from './leader-meeting-tabs';

describe('P18.1-T2 AC-4 the scorecard as written: rounded for display, the served figure exact', () => {
  const ape = { key: 'ape', unit: 'idr_minor' } as const;
  const caseSize = { key: 'average_case_size', unit: 'idr_minor' } as const;
  const count = { key: 'avg_monthly_aa', unit: 'count' } as const;
  const pct = { key: 'new_agent_3m', unit: 'percentage' } as const;

  it('APE in billions to one decimal, two below 1 (`:2488` draws 0.75), with a comma (ADR-0167 §1)', () => {
    expect(formatFigure(ape, billions(12.1))).toBe('12,1');
    expect(formatFigure(ape, billions(8.44))).toBe('8,4');
    expect(formatFigure(ape, billions(12))).toBe('12,0');
    expect(formatFigure(ape, billions(0.75))).toBe('0,75');
    expect(formatFigure(ape, billions(0.5))).toBe('0,50');
    expect(formatFigure(ape, 0)).toBe('0,00');
  });

  it('rounds to two before choosing, so a figure just under 1 reads 1.0, never 1.00', () => {
    expect(formatFigure(ape, billions(0.996))).toBe('1,0');
    expect(formatFigure(ape, billions(0.994))).toBe('0,99');
  });

  it('Average Case Size in millions, by the same rule', () => {
    expect(formatFigure(caseSize, millions(19.8))).toBe('19,8');
    expect(formatFigure(caseSize, millions(20.46))).toBe('20,5');
    expect(formatFigure(caseSize, millions(0.85))).toBe('0,85');
  });

  it('counts and the averages whole (`:2470`), a thousand with a dot; a percentage to one decimal, with its sign (ADR-0167 §1)', () => {
    expect(formatFigure(count, 14.4)).toBe('14');
    expect(formatFigure(count, 14.5)).toBe('15');
    expect(formatFigure({ key: 'manpower', unit: 'count' }, 187)).toBe('187');
    expect(formatFigure({ key: 'manpower', unit: 'count' }, 1250)).toBe('1.250');
    expect(formatFigure(pct, 24.4)).toBe('24,4%');
    expect(formatFigure(pct, 30)).toBe('30,0%');
  });

  it('*pending data* where no source holds it, *—* over nothing, nothing in a blocked cell — never 0', () => {
    expect(cellText(count, { kind: 'pending' })).toBe('pending data');
    expect(cellText(caseSize, { kind: 'none' })).toBe('—');
    expect(cellText(count, { kind: 'blocked' })).toBe('');
    expect(cellText(count, { kind: 'figure', value: 0, leavesOut: [] })).toBe('0');
  });

  it('F-184: *FY* and *YTD* from the meeting’s own year, the months as drawn', () => {
    const periods = makeScorecard().periods;
    expect(columnHeader('fy', periods)).toBe('FY 2025');
    expect(columnHeader('ytd', periods)).toBe('YTD 2026');
    expect(columnHeader('fy', { ...periods, fy: '2026', ytd: '2027' })).toBe('FY 2026');
    expect(columnHeader('ytd', { ...periods, fy: '2026', ytd: '2027' })).toBe('YTD 2027');
    expect(columnHeader('thisMonthLastYear', periods)).toBe('This Month, Last Year');
    expect(columnHeader('lastMonth', periods)).toBe('Last Month');
    expect(columnHeader('thisMonth', periods)).toBe('This Month');
  });

  it('a figure over part of its period names the months it leaves out; a whole one says nothing', () => {
    expect(leftOutLine({ kind: 'figure', value: 1, leavesOut: [] })).toBeNull();
    expect(leftOutLine({ kind: 'pending' })).toBeNull();
    expect(leftOutLine({ kind: 'figure', value: 1, leavesOut: ['2026-08'] }))
      .toBe('Without Agu 2026: no figures uploaded for them yet.');
    expect(leftOutLine({ kind: 'figure', value: 1, leavesOut: ['2026-07', '2026-08'] }))
      .toBe('Without Jul 2026 and Agu 2026: no figures uploaded for them yet.');
    expect(leftOutLine({ kind: 'figure', value: 1, leavesOut: ['2025-01', '2025-02', '2025-03'] }))
      .toBe('Without Jan 2025, Feb 2025 and Mar 2025: no figures uploaded for them yet.');
  });
});

describe('P18.1-T3 AC-4 the print’s line for what its figures leave out', () => {
  it('every month any figure leaves out, once each, in month order, in the tooltip’s words after a †', () => {
    expect(printLeftOutLine(makeScorecard())).toBe('† Without Agu 2026: no figures uploaded for them yet.');
    const rows = makeScorecard().rows.map((r) => (r.key === 'flc'
      ? { ...r, cells: { ...r.cells, fy: { kind: 'figure' as const, value: 1, leavesOut: ['2025-02', '2026-08'] } } }
      : r));
    expect(printLeftOutLine({ rows })).toBe('† Without Feb 2025 and Agu 2026: no figures uploaded for them yet.');
  });

  it('nothing when no figure is partial', () => {
    const rows = makeScorecard().rows.map((r) => ({
      ...r,
      cells: Object.fromEntries(Object.entries(r.cells).map(([k, c]) => [k, c.kind === 'figure' ? { ...c, leavesOut: [] } : c])) as typeof r.cells,
    }));
    expect(printLeftOutLine({ rows })).toBeNull();
  });
});

describe('P18.1-T2 AC-6 the tracker’s rules', () => {
  it('the status cycles as drawn (`:2865`): Not yet planned → Planned → Implemented → Not yet planned', () => {
    expect(nextStatus('not_planned')).toBe('planned');
    expect(nextStatus('planned')).toBe('implemented');
    expect(nextStatus('implemented')).toBe('not_planned');
  });

  it('a row dropped on another takes its place, as the prototype splices it (`:2894-2898`)', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveTo(['a', 'b'], 1, 0)).toEqual(['b', 'a']);
    expect(moveTo(['a', 'b'], 0, 0)).toEqual(['a', 'b']);
    expect(moveTo(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
    expect(moveTo(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });

  it('F-188: the access note names the Owner, then each Admin, then the tag, joined as a sentence', () => {
    expect(accessNoteText({ ownerName: 'Wilson Tanoto', adminNames: [] }))
      .toBe('🔒 Only Wilson Tanoto and tagged core leaders can edit this tracker.');
    expect(accessNoteText({ ownerName: 'Wilson Tanoto', adminNames: ['Maya Halim'] }))
      .toBe('🔒 Only Wilson Tanoto, Maya Halim and tagged core leaders can edit this tracker.');
    expect(accessNoteText({ ownerName: 'Wilson Tanoto', adminNames: ['Maya Halim', 'Amelia Wijaya'] }))
      .toBe('🔒 Only Wilson Tanoto, Maya Halim, Amelia Wijaya and tagged core leaders can edit this tracker.');
    expect(accessNoteText({ ownerName: null, adminNames: ['Maya Halim'] }))
      .toBe('🔒 Only Maya Halim and tagged core leaders can edit this tracker.');
    expect(accessNoteText({ ownerName: null, adminNames: [] }))
      .toBe('🔒 Only tagged core leaders can edit this tracker.');
  });

  it('`listed` joins as a sentence does', () => {
    expect(listed([])).toBe('');
    expect(listed(['a'])).toBe('a');
    expect(listed(['a', 'b'])).toBe('a and b');
    expect(listed(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('AC-8: the three pills are painted from tokens, *Planned* navy on the amber tint', () => {
    for (const tone of Object.values(STATUS_TONE)) expect(tone).not.toMatch(/#|\[#|rgb/);
    expect(STATUS_TONE.planned).toBe('bg-amber/15 text-navy');
    expect(STATUS_TONE.not_planned).toBe('bg-alert/10 text-alert');
    expect(STATUS_TONE.implemented).toBe('bg-success/10 text-success');
  });
});

describe('P18.1-T2 AC-7 what a landed write leaves in the meeting', () => {
  const unwritten = makeMeetingView({ writtenIn: false });

  it('P18.1-T2 AC-7 every landed write withdraws *Delete meeting*: the server would now refuse it', () => {
    const deletable = makeMeetingView({ writtenIn: false, can: { ...makeMeetingView().can, delete: true } });
    const item = deletable.agenda.post[0];
    expect(withAgendaItem(deletable, 'post', item.id, { ...item, version: 2 }).can.delete).toBe(false);
    expect(withAgendaItem(deletable, 'post', item.id, null).can.delete).toBe(false);
    expect(withActionItems(deletable, []).can.delete).toBe(false);
    expect(withActionItem(deletable, { ...deletable.actionItems[0], version: 2 }).can.delete).toBe(false);
    expect(withTarget(deletable, 'ape', { value: '1', version: 3 }).can).toEqual({ ...deletable.can, delete: false });
  });

  it('an agenda item saved, added or removed — and the meeting no longer unwritten', () => {
    const saved = { ...unwritten.agenda.during[1], text: 'Changed', version: 2 };
    const after = withAgendaItem(unwritten, 'during', saved.id, saved);
    expect(after.agenda.during[1]).toEqual(saved);
    expect(after.writtenIn).toBe(true);

    const added = { id: 'new', text: 'New agenda item', pic: '', done: false, version: 1 };
    expect(withAgendaItem(unwritten, 'post', 'new', added).agenda.post.at(-1)).toEqual(added);

    const removed = withAgendaItem(unwritten, 'preparation', 'ag-2', null);
    expect(removed.agenda.preparation.map((i) => i.id)).toEqual(['ag-1', 'ag-3']);
  });

  it('the tracker’s rows, and the open items counted as the rows not *Implemented* (`:2586`)', () => {
    const rows = makeActionItems();
    const implemented = { ...rows[0], status: 'implemented' as const, version: 2 };
    const after = withActionItem(unwritten, implemented);
    expect(after.actionItems[0]).toEqual(implemented);
    expect(after.openItems).toBe(3);
    expect(after.writtenIn).toBe(true);
    expect(withActionItems(unwritten, []).openItems).toBe(0);
    expect(withActionItem(unwritten, { ...rows[0], id: 'ai-5' }).actionItems).toHaveLength(5);
  });

  it('a *Monthly Target* cell, the rest of the scorecard untouched', () => {
    const after = withTarget(unwritten, 'manpower', { value: '190', version: 1 });
    expect(after.scorecard.rows.find((r) => r.key === 'manpower')?.monthlyTarget).toEqual({ value: '190', version: 1 });
    expect(after.scorecard.rows.find((r) => r.key === 'ape')?.monthlyTarget).toEqual({ value: 'TBD', version: 2 });
    expect(after.writtenIn).toBe(true);
  });
});

describe('P18.1-T2 AC-7 writes to one item go one after another', () => {
  const later = () => {
    let settle!: (v: { version: number }) => void;
    let fail!: (e: Error) => void;
    const promise = new Promise<{ version: number }>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    return { promise, settle, fail };
  };
  const versionOf = (x: { version: number }) => x.version;

  it('the second write to an item waits for the first and sends the version the first answered', async () => {
    const writes = new ItemWrites();
    const first = later();
    const sent: number[] = [];
    const a = writes.run('row', 3, (v) => { sent.push(v); return first.promise; }, versionOf);
    const b = writes.run('row', 3, async (v) => { sent.push(v); return { version: v + 1 }; }, versionOf);
    await Promise.resolve();
    expect(sent).toEqual([3]);
    first.settle({ version: 4 });
    await a;
    await b;
    expect(sent).toEqual([3, 4]);
  });

  it('two items are written side by side', async () => {
    const writes = new ItemWrites();
    const first = later();
    const sent: string[] = [];
    void writes.run('one', 1, () => { sent.push('one'); return first.promise; });
    await writes.run('two', 1, async () => { sent.push('two'); return { version: 2 }; });
    expect(sent).toEqual(['one', 'two']);
    first.settle({ version: 2 });
  });

  it('a write that failed holds nothing up, and a write sends the version its field was read at', async () => {
    const writes = new ItemWrites();
    const first = later();
    const sent: number[] = [];
    const a = writes.run('row', 1, (v) => { sent.push(v); return first.promise; });
    const b = writes.run('row', 7, async (v) => { sent.push(v); return { version: 8 }; });
    first.fail(new Error('refused'));
    await expect(a).rejects.toThrow('refused');
    await b;
    expect(sent).toEqual([1, 7]);
  });

  it('only the reader’s own landed writes move the version sent — never a newer one read under the field', async () => {
    const writes = new ItemWrites();
    const sent: number[] = [];
    await writes.run('row', 2, async (v) => { sent.push(v); return { version: 3 }; }, versionOf);
    // A field read at 2, before that write landed, sends 3: the reader's own. Read at 2 with someone else's 5
    // on the page since, it still sends 3, and the server refuses it rather than overwrite what they never saw.
    await writes.run('row', 2, async (v) => { sent.push(v); return { version: 4 }; }, versionOf);
    expect(sent).toEqual([2, 3]);
  });
});

/**
 * D-copy: the tabs' own strings use none of the six words, no phase, no id and no permission code. The prototype's
 * source footnote — *"… as tagged to this KPM."* (`:2475`) — is verbatim and the one exception.
 */
describe('P18.1-T2 the tabs’ copy', () => {
  const SIX_WORDS = /\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned/i;
  const PHASE = /\bphase\b|\bP\d+(\.\d+)?-T\d+/i;

  it('the own strings, with values in their holes', () => {
    const own = Object.values(TABS_OWN_COPY).map((v) => {
      if (typeof v !== 'function') return v;
      if (v === TABS_OWN_COPY.accessNote) return TABS_OWN_COPY.accessNote(['Wilson Tanoto', 'Maya Halim']);
      return (v as (...args: unknown[]) => string)('{a}', '{b}');
    });
    expect(own.length).toBeGreaterThan(10);
    for (const text of own) {
      expect(text).not.toMatch(SIX_WORDS);
      expect(text).not.toMatch(PHASE);
      expect(text).not.toMatch(/leader_meeting:|membershipId|kpmId/);
    }
  });

  it('every renderable string in the tabs’ files, the verbatim footnote alone excepted', () => {
    const files = [
      'lib/leader-meeting-tabs.ts',
      'components/leader-forum/scorecard.tsx',
      'components/leader-forum/agenda.tsx',
      'components/leader-forum/action-items.tsx',
      'components/leader-forum/print-layout.tsx',
    ];
    const hits = files.flatMap((f) => {
      const sf = parse(f, readFileSync(join(SRC, f), 'utf8'));
      const found: string[] = [];
      const visit = (node: ts.Node): void => {
        const text = renderable(node);
        if (text !== null && /\s/.test(text.trim()) && (SIX_WORDS.test(text) || PHASE.test(text)) && text !== TABS_COPY.source) {
          found.push(`${f}: ${JSON.stringify(text.trim())}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return found;
    });
    expect(hits).toEqual([]);
  });

  it('the prototype’s words verbatim: the asterisk, the footnotes, the headers and the statuses', () => {
    expect(TABS_COPY.rows.new_agent_3m).toBe('3M new agent %*');
    expect(TABS_COPY.note).toBe(
      'Note: AA = Active Agent; 3M new agent % is the share of new agents with a first paid and issued case by day 90 of their join date, of those whose 90 days are over.',
    );
    expect(TABS_COPY.source).toBe(
      'Source: Manpower, APE, average case size, producing agents, avg. monthly AA, FLC and case submission as tagged to this KPM.',
    );
    expect(Object.values(TABS_COPY.headers)).toEqual(
      ['Key initiative', 'Success metric', 'Action item', 'PIC', 'Status', 'Remarks / Target'],
    );
    expect(Object.values(TABS_COPY.statuses)).toEqual(['Not yet planned', 'Planned', 'Implemented']);
    expect(TABS_COPY.chips.map((c) => c.label)).toEqual(['Manpower', '# of agents', '# of units', '# of AB', '# of AAB']);
  });
});
