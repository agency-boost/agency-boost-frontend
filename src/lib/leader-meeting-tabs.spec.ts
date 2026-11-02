import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, SRC } from '@test/copy-scan';
import { billions, makeActionItems, makeMeetingView, makeScorecard, millions } from '@test/leader-meetings-fixtures';
import {
  accessNoteText, asOfText, cellText, changeText, columnHeader, formatFigure, FOOTNOTES, ItemWrites,
  LEADER_MEETING_TARGET_RATE_DECIMALS, listed, moveTo,
  NET_APE_FOOTNOTE, nextStatus, noneWords, numberedFootnotes, oneDecimal, partialNotes, rateFromTyped, rateText, STATUS_TONE,
  rowName, statsTitle, TABS_COPY, TABS_OWN_COPY, targetDraftText, targetText, withActionItem, withActionItems, withAgendaItem, withTarget,
} from './leader-meeting-tabs';

describe('P18.97-T1 AC-15 the scorecard as written: the slide’s numbers, the served figure exact (ADR-0174)', () => {
  const ape = { key: 'ape', unit: 'idr_minor' } as const;
  const caseSize = { key: 'average_case_size', unit: 'idr_minor' } as const;
  const count = { key: 'avg_monthly_aa', unit: 'count' } as const;
  const pct = { key: 'new_agent_3m', unit: 'percentage' } as const;
  const ratio = { key: 'cases_per_producing_agent', unit: 'ratio' } as const;

  it('P18.97-T1 AC-15 APE in miliar to one decimal, a comma — the two below 1 gone (0,10 is 0,1)', () => {
    expect(formatFigure(ape, billions(5.8))).toBe('5,8');
    expect(formatFigure(ape, billions(12.1))).toBe('12,1');
    expect(formatFigure(ape, billions(8.44))).toBe('8,4');
    expect(formatFigure(ape, billions(12))).toBe('12,0');
    expect(formatFigure(ape, billions(0.75))).toBe('0,8');
    expect(formatFigure(ape, billions(0.1))).toBe('0,1');
    expect(formatFigure(ape, billions(0.996))).toBe('1,0');
    expect(formatFigure(ape, billions(1250))).toBe('1.250,0');
  });

  it('P18.97-T1 AC-15 a figure that is not zero and rounds to 0,0 reads < 0,1; zero reads 0,0', () => {
    expect(formatFigure(ape, billions(0.04))).toBe('< 0,1');
    expect(formatFigure(ape, 1)).toBe('< 0,1');
    expect(formatFigure(ape, billions(0.05))).toBe('0,1');
    expect(formatFigure(ape, 0)).toBe('0,0');
    expect(oneDecimal(0.049)).toBe('< 0,1');
  });

  it('P18.97-T1 AC-15 Avg. Case Size in juta by the same rule, 17,6 as the slide writes it', () => {
    expect(formatFigure(caseSize, millions(17.6))).toBe('17,6');
    expect(formatFigure(caseSize, millions(20.46))).toBe('20,5');
    expect(formatFigure(caseSize, millions(0.85))).toBe('0,9');
    expect(formatFigure(caseSize, millions(0.02))).toBe('< 0,1');
  });

  it('P18.97-T1 AC-15 counts and averages whole, a thousand with a dot; % whole; Cases/producing agents to a tenth', () => {
    expect(formatFigure(count, 14.4)).toBe('14');
    expect(formatFigure(count, 14.5)).toBe('15');
    expect(formatFigure({ key: 'manpower', unit: 'count' }, 1250)).toBe('1.250');
    expect(formatFigure(pct, 16)).toBe('16%');
    expect(formatFigure(pct, 30)).toBe('30%');
    expect(formatFigure(ratio, 2.4)).toBe('2,4');
    expect(formatFigure(ratio, 420 / 96)).toBe('4,4');
    expect(formatFigure(ratio, 3)).toBe('3,0');
  });

  it('*pending data* where no source holds it, *—* over nothing or for what a kept scorecard lacks, nothing when not tracked — never 0', () => {
    expect(cellText(count, { kind: 'pending' })).toBe('pending data');
    expect(cellText(caseSize, { kind: 'none' })).toBe('—');
    expect(cellText(count, { kind: 'unrecorded' })).toBe('—');
    expect(cellText(count, { kind: 'blocked' })).toBe('');
    expect(cellText(count, { kind: 'figure', value: 0, leavesOut: [] })).toBe('0');
    expect(noneWords(caseSize, { kind: 'none' })).toBe('No policies in this period.');
    expect(noneWords(ratio, { kind: 'none' })).toBe('No annual active agents in this period.');
    expect(noneWords(count, { kind: 'unrecorded' })).toBe('Not recorded for this meeting.');
  });

  it('P18.97-T1 AC-17 a phone’s change: a sign before a rise, — where last year’s is none', () => {
    expect(changeText({ kind: 'figure', value: 18, unit: 'percent' })).toBe('+18%');
    expect(changeText({ kind: 'figure', value: -9, unit: 'percent' })).toBe('-9%');
    expect(changeText({ kind: 'figure', value: 0, unit: 'percent' })).toBe('0%');
    expect(changeText({ kind: 'none' })).toBe('—');
  });

  it('P18.97-T8 F1 a percentage row’s change in percentage points, signed and whole, as the app writes points (parity F-256)', () => {
    // 3M new agent % at 60% against 100%, and at 45% against 30%: never -40% or +50%.
    expect(changeText({ kind: 'figure', value: -40, unit: 'points' })).toBe('-40 points');
    expect(changeText({ kind: 'figure', value: 15, unit: 'points' })).toBe('+15 points');
    // One point is one: the app's own words for points (`formatRatioValue`), a sign before them.
    expect(changeText({ kind: 'figure', value: 1, unit: 'points' })).toBe('+1 point');
    expect(changeText({ kind: 'figure', value: -1, unit: 'points' })).toBe('-1 point');
    expect(changeText({ kind: 'figure', value: 0, unit: 'points' })).toBe('0 points');
    // The same figure on a count is a percentage of last year's, as it was.
    expect(changeText({ kind: 'figure', value: -40, unit: 'percent' })).toBe('-40%');
  });
});

describe('P18.97-T1 AC-2 each column’s two lines: its name over its period, from the meeting’s month', () => {
  const periods = (from: string, to: string, ytdFrom: string, lastFrom: string, month: string, lastMonth: string, lastYearMonth: string) => ({
    fy: { from, to }, ytdLastYear: { from: lastFrom, to: lastYearMonth }, ytd: { from: ytdFrom, to: month },
    thisMonthLastYear: { from: lastYearMonth, to: lastYearMonth }, lastMonth: { from: lastMonth, to: lastMonth }, thisMonth: { from: month, to: month },
  });
  const october = periods('2025-01', '2025-12', '2026-01', '2025-01', '2026-10', '2026-09', '2025-10');

  it('P18.97-T1 AC-2 Full Year and both YTDs named by their years, their spans in the app’s months; the three months as the slide writes them', () => {
    expect(columnHeader('fy', october)).toEqual({ name: 'Full Year 2025', period: "(Jan-Des '25)" });
    expect(columnHeader('ytdLastYear', october)).toEqual({ name: 'YTD 2025', period: "(Jan-Okt '25)" });
    expect(columnHeader('ytd', october)).toEqual({ name: 'YTD 2026', period: "(Jan-Okt '26)" });
    expect(columnHeader('thisMonthLastYear', october)).toEqual({ name: 'This Month, Last Year', period: '(Okt-25)' });
    expect(columnHeader('lastMonth', october)).toEqual({ name: 'Last Month', period: '(Sep-26)' });
    expect(columnHeader('thisMonth', october)).toEqual({ name: 'This Month', period: '(Okt-26)' });
  });

  it('P18.97-T1 AC-2 a January meeting: each YTD its January alone, Last Month the December before', () => {
    const january = periods('2025-01', '2025-12', '2026-01', '2025-01', '2026-01', '2025-12', '2025-01');
    expect(columnHeader('ytd', january)).toEqual({ name: 'YTD 2026', period: "(Jan '26)" });
    expect(columnHeader('ytdLastYear', january)).toEqual({ name: 'YTD 2025', period: "(Jan '25)" });
    expect(columnHeader('lastMonth', january)).toEqual({ name: 'Last Month', period: '(Des-25)' });
  });

  it('P18.97-T1 AC-2 a December meeting: Full Year and last year’s YTD both run to Des', () => {
    const december = periods('2025-01', '2025-12', '2026-01', '2025-01', '2026-12', '2026-11', '2025-12');
    expect(columnHeader('fy', december).period).toBe("(Jan-Des '25)");
    expect(columnHeader('ytdLastYear', december).period).toBe("(Jan-Des '25)");
    expect(columnHeader('ytd', december).period).toBe("(Jan-Des '26)");
  });
});

describe('P18.97-T1 AC-12 the footnotes and the (*) notes', () => {
  const ALL_ROWS = makeScorecard().rows.map((r) => r.key);

  it('P18.97-T1 AC-12 numbered without a gap, in the order the rows reach them; a note on two rows numbered once', () => {
    const { marks, list } = numberedFootnotes(ALL_ROWS);
    expect(marks).toEqual({ producing_agents: 1, new_agent_3m: 2, avg_monthly_aa: 3, case_submission: 4, average_case_size: 4 });
    expect(list.map((f) => f.n)).toEqual([1, 2, 3, 4]);
    expect(list.map((f) => f.text.split(' — ')[0])).toEqual(['Annual Active Agents', '3M new agent %', 'AA', 'Case submission and Avg. Case Size']);
    expect(FOOTNOTES).toHaveLength(4);
  });

  it('P18.97-T1 AC-12 with OD-231 answered — a Net APE note on APE — it is 1 and every number after it moves up, still without a gap', () => {
    expect(NET_APE_FOOTNOTE).toBeNull();
    const netApe = { rows: ['ape'] as const, text: 'Net APE — …' };
    const { marks, list } = numberedFootnotes(ALL_ROWS, [netApe, ...FOOTNOTES]);
    expect(marks).toEqual({ ape: 1, producing_agents: 2, new_agent_3m: 3, avg_monthly_aa: 4, case_submission: 5, average_case_size: 5 });
    expect(list.map((f) => f.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('P18.97-T1 AC-12 a row not drawn gives no number: a scorecard without Annual Active Agents starts at 3M new agent %', () => {
    const { marks, list } = numberedFootnotes(ALL_ROWS.filter((k) => k !== 'producing_agents'));
    expect(marks.new_agent_3m).toBe(1);
    expect(list).toHaveLength(3);
  });

  it('P18.97-T1 AC-12 one (*) note per partial period, in the client’s words: earlier months, later months, a gap', () => {
    const periods = makeScorecard().periods;
    expect(partialNotes({
      periods,
      partialPeriods: [{ column: 'fy', leavesOut: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07'] }],
    })).toEqual(['(*) Full Year 2025 covers Agu–Des 2025 only; earlier months not uploaded']);
    expect(partialNotes({ periods, partialPeriods: [{ column: 'ytd', leavesOut: ['2026-08', '2026-09'] }] }))
      .toEqual(['(*) YTD 2026 covers Jan–Jul 2026 only; later months not uploaded']);
    expect(partialNotes({ periods, partialPeriods: [{ column: 'ytdLastYear', leavesOut: ['2025-03', '2025-04'] }] }))
      .toEqual(['(*) YTD 2025 covers Jan–Sep 2025 without Mar 2025 and Apr 2025, not uploaded']);
    expect(partialNotes({ periods, partialPeriods: [] })).toEqual([]);
  });

  it('P18.97-T1 AC-13 the title, the meeting’s month; AS OF in the office’s calendar, — when unrecorded, nothing with no file', () => {
    expect(statsTitle('BSD City Branch', '2026-10-27')).toBe('BSD City Branch: Okt 2026');
    expect(asOfText({ kind: 'date', date: '2026-10-26' })).toBe('AS OF 26 Okt 2026');
    expect(asOfText({ kind: 'unrecorded' })).toBe('AS OF —');
    expect(asOfText({ kind: 'none' })).toBeNull();
  });
});

describe('P18.97-T1 AC-10 a *Monthly Target* as a rate per unit', () => {
  const ape = { key: 'ape', unit: 'idr_minor' } as const;
  const flc = { key: 'flc', unit: 'count' } as const;
  const MILIAR = 1e9 * 100;

  it('P18.97-T1 AC-10 shown "{rate × units} ({rate} @ unit)", the value the server’s; TBD on APE with none, every other row blank', () => {
    expect(targetText(flc, { rate: 1, value: 9, typed: null, version: 1 })).toBe('9 (1 @ unit)');
    expect(targetText({ key: 'avg_monthly_aa', unit: 'count' }, { rate: 3, value: 27, typed: null, version: 1 })).toBe('27 (3 @ unit)');
    expect(targetText(flc, { rate: 1.5, value: 13.5, typed: null, version: 1 })).toBe('13,5 (1,5 @ unit)');
    expect(targetText(ape, { rate: 0.5 * MILIAR, value: 4.5 * MILIAR, typed: null, version: 1 })).toBe('4,5 (0,5 @ unit)');
    expect(targetText(ape, { rate: null, value: null, typed: null, version: 0 })).toBe('TBD');
    expect(targetText(flc, { rate: null, value: null, typed: null, version: 0 })).toBe('');
    expect(targetText(flc, { rate: null, value: null, typed: 'Ask Hellen', version: 2 })).toBe('Ask Hellen');
  });

  it('P18.97-T1 AC-10 the field’s text is the rate, APE’s in miliar, no thousands dot — so it reads back as the same rate', () => {
    expect(targetDraftText(flc, { rate: 1.5, value: 13.5, typed: null, version: 1 })).toBe('1,5');
    expect(targetDraftText(ape, { rate: 0.15 * MILIAR, value: null, typed: null, version: 1 })).toBe('0,15');
    expect(targetDraftText(flc, { rate: 1250, value: null, typed: null, version: 1 })).toBe('1250');
    expect(targetDraftText(flc, { rate: null, value: null, typed: 'Ask Hellen', version: 1 })).toBe('Ask Hellen');
    expect(targetDraftText(flc, { rate: null, value: null, typed: null, version: 0 })).toBe('');
    for (const rate of [1, 1.5, 0.25, 1250]) expect(rateFromTyped('flc', rateText(flc, rate))).toEqual({ rate });
    expect(rateFromTyped('ape', rateText(ape, 15 * MILIAR / 100))).toEqual({ rate: 15 * MILIAR / 100 });
  });

  it('P18.97-T1 AC-10 what an editor typed: a comma or a point, from 0; APE’s miliar to whole rupiah in sen; empty clears; anything else no rate', () => {
    expect(rateFromTyped('flc', '1,5')).toEqual({ rate: 1.5 });
    expect(rateFromTyped('flc', ' 1.5 ')).toEqual({ rate: 1.5 });
    expect(rateFromTyped('flc', '0')).toEqual({ rate: 0 });
    expect(rateFromTyped('flc', '1,234')).toEqual({ rate: 1.23 });
    expect(rateFromTyped('ape', '0,5')).toEqual({ rate: 0.5 * MILIAR });
    expect(rateFromTyped('ape', '0,0000000015')).toEqual({ rate: 200 });
    expect(rateFromTyped('flc', '')).toEqual({ rate: null });
    expect(rateFromTyped('flc', '   ')).toEqual({ rate: null });
    for (const typed of ['abc', 'about 2', '-1', '1,2,3', '8 (1 @ unit)', 'TBD']) {
      expect([typed, rateFromTyped('flc', typed)]).toEqual([typed, { invalid: true }]);
    }
  });

  it('P18.97-T1 AC-10 a count’s rate and value keep the backend’s places, read from its constants (invariant §7)', () => {
    const backend = readFileSync(
      join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'leader-forum.ts'), 'utf8',
    );
    expect(Number(/export const LEADER_MEETING_TARGET_RATE_DECIMALS = (\d+);/.exec(backend)?.[1]))
      .toBe(LEADER_MEETING_TARGET_RATE_DECIMALS);
    expect(rateFromTyped('flc', '0,756')).toEqual({ rate: 0.76 });
    expect(targetText(flc, { rate: 0.75, value: 6.75, typed: null, version: 1 })).toBe('6,75 (0,75 @ unit)');
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
    expect(withTarget(deletable, 'ape', { rate: 1, value: 32, typed: null, version: 3 }).can).toEqual({ ...deletable.can, delete: false });
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

  it('P18.97-T1 AC-10 a *Monthly Target* cell, as the server answered it, the rest of the scorecard untouched', () => {
    const after = withTarget(unwritten, 'manpower', { rate: 2, value: 64, typed: null, version: 1 });
    expect(after.scorecard.rows.find((r) => r.key === 'manpower')?.monthlyTarget).toEqual({ rate: 2, value: 64, typed: null, version: 1 });
    expect(after.scorecard.rows.find((r) => r.key === 'ape')?.monthlyTarget).toEqual({ rate: null, value: null, typed: null, version: 2 });
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
 * D-copy: the tabs' own strings use none of the six words, no phase, no id and no permission code — the footnotes in
 * our metrics' words included, which say *the monthly production file* (P18.97-T1 AC-12). The prototype's *Source* line
 * and its *"… as tagged to this KPM."* (`:2475`), the one exception, are gone with the per-cell ⓘ.
 */
describe('P18.1-T2 the tabs’ copy', () => {
  const SIX_WORDS = /\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned/i;
  const PHASE = /\bphase\b|\bP\d+(\.\d+)?-T\d+/i;

  it('the own strings, with values in their holes, and the footnotes', () => {
    const own = Object.values(TABS_OWN_COPY).flatMap((v) => {
      if (typeof v === 'object') return Object.values(v);
      if (typeof v !== 'function') return [v];
      if (v === TABS_OWN_COPY.accessNote) return [TABS_OWN_COPY.accessNote(['Wilson Tanoto', 'Maya Halim'])];
      return [(v as (...args: unknown[]) => string)('{a}', '{b}')];
    }).concat(FOOTNOTES.map((f) => f.text), Object.values(TABS_COPY.rows), Object.values(TABS_COPY.groups));
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
        if (text !== null && /\s/.test(text.trim()) && (SIX_WORDS.test(text) || PHASE.test(text))) {
          found.push(`${f}: ${JSON.stringify(text.trim())}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return found;
    });
    expect(hits).toEqual([]);
  });

  it('P18.97-T1 AC-4 the reference slide’s words: its rows in its order, its groups; the prototype’s headers and statuses verbatim', () => {
    // The names, each money row's unit written by the formatter in the reader's language (P18.98-T3 AC-1): ADR-0174's
    // Indonesian units, and the slide's own English ones.
    const keys = Object.keys(TABS_COPY.rows) as (keyof typeof TABS_COPY.rows)[];
    expect(keys.map((key) => rowName(key, 'id'))).toEqual([
      'APE (Rp M)', 'Manpower', 'FLC (avg. monthly)', 'Annual Active Agents', '3M new agent %', 'Avg. monthly AA',
      'Case submission', 'Cases/producing agents', 'Avg. Case Size (Rp jt)',
    ]);
    expect(keys.map((key) => rowName(key, 'en'))).toEqual([
      'APE (IDR B)', 'Manpower', 'FLC (avg. monthly)', 'Annual Active Agents', '3M new agent %', 'Avg. monthly AA',
      'Case submission', 'Cases/producing agents', 'Avg. Case Size (IDR M)',
    ]);
    expect(rowName('ape')).toBe('APE (Rp M)');
    expect(TABS_COPY.groups).toEqual({ year: 'Full Year & YTD View', month: 'Monthly View' });
    // The row stays *APE* until OD-231 is answered; *Producing agents* reads *Annual Active Agents* everywhere.
    expect(JSON.stringify(TABS_COPY)).not.toMatch(/Net APE|Producing agents|New AA/);
    expect(Object.values(TABS_COPY.headers)).toEqual(
      ['Key initiative', 'Success metric', 'Action item', 'PIC', 'Status', 'Remarks / Target'],
    );
    expect(Object.values(TABS_COPY.statuses)).toEqual(['Not yet planned', 'Planned', 'Implemented']);
    expect(TABS_COPY.chips.map((c) => c.label)).toEqual(['Manpower', '# of agents', '# of units', '# of AB', '# of AAB']);
  });
});
