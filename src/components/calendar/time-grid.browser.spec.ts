import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { TimeGrid } from './time-grid';

/**
 * **3 Hari's *Tugas* row, measured in a real browser** (P19.9-T5 AC-2; R12, the owner's screenshot of 6 November;
 * ADR-0235, parity I-920).
 *
 * The row is one 44px row on a phone (32px from 1024px) whose day cells fill it: today's light orange unbroken from its
 * head to its hours, the column lines reaching the hours, **no white band** — and so also when none of the three days has
 * a task, the case the screenshot shows. The paged strip (`flex w-[300%]`) was a block child sized by its content, ~20px
 * of *·*, so the cells stopped short and the head's white showed under them. jsdom lays nothing out, so this asks Chrome:
 * the grid's own markup (`TimeGrid`, as `ThreeDays` draws it, the pager given), the app's own stylesheet.
 */
const TODAY = '2026-11-07';
const DAYS = ['2026-11-07', '2026-11-08', '2026-11-09'];

const grid = (counts: ReadonlyMap<string, number>) => renderToStaticMarkup(createElement(
  'section',
  { className: 'flex min-w-0 flex-1 touch-pan-y flex-col bg-card', 'data-three-days': '' },
  createElement(TimeGrid, {
    days: DAYS,
    today: TODAY,
    nowMinute: 23 * 60 + 9,
    regionLabel: 'Calendar, 7 – 9 Nov 2026',
    morning: true,
    slotBy: 'tap',
    placedOn: () => [],
    trips: [],
    counts,
    opensTasks: (day: string) => (counts.get(day) ?? 0) > 0,
    onTasks: () => undefined,
    onOpen: () => undefined,
    pager: {
      before: ['2026-11-04', '2026-11-05', '2026-11-06'],
      after: ['2026-11-10', '2026-11-11', '2026-11-12'],
      style: { transform: 'translateX(calc(-100% / 3 + 0px))', transition: 'none' },
    },
  }),
));

/** What the page draws of the *Tugas* row: the row, each shown day's cell, today's head, and what is under a point. */
const MEASURE = `(() => {
  const row = document.querySelector('[data-task-row]');
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
  const lane = row.children[1];
  const shown = [...lane.querySelectorAll('.place-items-center')].filter((cell) => {
    const r = cell.getBoundingClientRect();
    return r.right > lane.getBoundingClientRect().left + 1 && r.left < lane.getBoundingClientRect().right - 1;
  });
  const head = document.querySelector('[data-grid-head] [aria-current="date"]').parentElement;
  const today = shown[0];
  const t = box(today);
  const under = document.elementFromPoint(t.left + 4, t.bottom - 2);
  return {
    row: box(row),
    cells: shown.map(box),
    todayBackground: getComputedStyle(today).backgroundColor,
    headBackground: getComputedStyle(head).backgroundColor,
    cardBackground: getComputedStyle(document.querySelector('[data-grid-head]')).backgroundColor,
    underIsToday: under === today || today.contains(under),
    divider: getComputedStyle(today).borderRightWidth,
  };
})()`;

interface Measured {
  row: { top: number; bottom: number; height: number };
  cells: { top: number; bottom: number; height: number }[];
  todayBackground: string;
  headBackground: string;
  cardBackground: string;
  underIsToday: boolean;
  divider: string;
}

describe.skipIf(!CHROME)('P19.9-T5 AC-2 3 Hari’s Tugas row, in a real browser (R12)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  const measure = async (counts: ReadonlyMap<string, number>, width: number) => {
    await browser.show(await pageFor(grid(counts)), width);
    return browser.tab.evaluate<Measured>(MEASURE);
  };

  it.each([
    ['none of the three days has a task', new Map<string, number>()],
    ['only another day has tasks', new Map([['2026-11-08', 2]])],
    ['today has tasks', new Map([[TODAY, 3]])],
  ])('P19.9-T5 AC-2 at 375px, %s: each day’s cell fills the 44px row, today’s orange unbroken, no white band', async (_case, counts) => {
    const m = await measure(counts, 375);
    expect(m.row.height).toBe(44);
    expect(m.cells).toHaveLength(3);
    // Every shown cell runs from under the row's 1px top line to its foot: the column lines reach the hours.
    for (const cell of m.cells) {
      expect(cell.top).toBe(m.row.top + 1);
      expect(cell.bottom).toBe(m.row.bottom);
    }
    // Today's cell wears today's shade — its head's — not the card's white, down to its foot.
    expect(m.todayBackground).toBe(m.headBackground);
    expect(m.todayBackground).not.toBe(m.cardBackground);
    expect(m.underIsToday).toBe(true);
    expect(m.divider).toBe('1px');
  }, 30_000);

  it.each([[768, 44], [1024, 32]])('P19.9-T5 AC-2 at %ipx the cells fill the row too (%ipx), with no task anywhere', async (width, height) => {
    const m = await measure(new Map(), width);
    expect(m.row.height).toBe(height);
    for (const cell of m.cells) expect([cell.top, cell.bottom]).toEqual([m.row.top + 1, m.row.bottom]);
  }, 30_000);
});
