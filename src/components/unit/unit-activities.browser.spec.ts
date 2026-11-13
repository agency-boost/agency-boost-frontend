import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { activities } from '@test/unit-dashboard-fixtures';
import type { ActivitiesPerson, UnitActivitiesView, UnitScope } from '@/lib/unit-dashboard';
import { ActivityTable } from './unit-activities';

/**
 * **The activity table's two sticky columns, measured in a real browser** (P19.11-T6 AC-2; UX-5, the owner's screenshot
 * of 9 November, `revisions/2026-11-09-a/screenshots/05-sticky-column-leak.png`).
 *
 * The people scrolling sideways showed through a gap between *Aktivitas* and *Total*: below 1024px the table was laid out
 * by its content, so once the people overflowed the sticky columns shrank to their words while *Total* stayed pinned at
 * `left: 8.25rem`. jsdom lays nothing out, so this asks Chrome — the table's own markup (`ActivityTable`), the app's own
 * stylesheet — scrolled part way and all the way, at a phone's 375px and a tablet's 800px: in every row type (the header,
 * a category's subtotal row, a type's row, the navy foot) *Aktivitas*'s right edge is *Total*'s left edge, and the point
 * just left of that boundary, and just right of it, is a sticky cell — never a person's.
 */

/** Sixteen people, so the person columns overflow at 375, 800 and 1024px alike; long names, as the screenshot's. */
function crowd(view: UnitActivitiesView): ActivitiesPerson[] {
  const [first, second] = view.people;
  return Array.from({ length: 16 }, (_, i) => ({
    ...(i % 2 === 0 ? first : second),
    membershipId: `mem-${i}`,
    name: `Wahyuningsih Permatasari ${i}`,
    isReader: i === 0,
    inUnit: i < 12,
  }));
}

/** A short name longer than its column, and an office's name longer still: the words must stay inside *Aktivitas*. */
const LONG = 'Pengajuan polis asuransi jiwa';

const table = (scope: UnitScope, span: 'week' | 'month', phone: boolean) => {
  const base = activities();
  const sections = base.sections.map((section) => ({
    ...section,
    types: section.types.map((type) => (type.code === 'SELL_SUBMISSION'
      ? { ...type, label: `${LONG} dan dokumen pendukungnya`, shortLabel: LONG }
      : type)),
  }));
  const view = activities({ people: crowd(base), sections, period: { ...base.period, span } });
  // The page's 16px gutter, as the screen sits in it.
  return renderToStaticMarkup(createElement('div', { className: 'p-4' }, createElement(ActivityTable, { view, scope, phone })));
};

/** For each row type, scrolled by `by` (or to the end): the two sticky cells' edges and what is under the boundary. */
const MEASURE = (by: number | 'end') => `(() => {
  const scroller = document.querySelector('[data-activity-scroll]');
  scroller.scrollLeft = ${by === 'end' ? 'scroller.scrollWidth' : by};
  const rows = {
    header: document.querySelector('thead tr'),
    subtotal: document.querySelector('[data-subtotal]'),
    type: document.querySelector('[data-type]'),
    foot: document.querySelector('tfoot tr'),
  };
  const out = { scrollLeft: scroller.scrollLeft, overflows: scroller.scrollWidth > scroller.clientWidth, rows: {} };
  for (const [kind, row] of Object.entries(rows)) {
    const [activity, total, person] = row.children;
    const a = activity.getBoundingClientRect();
    const t = total.getBoundingClientRect();
    const y = a.top + a.height / 2;
    const cellAt = (x) => document.elementFromPoint(x, y)?.closest('th, td');
    out.rows[kind] = {
      activityLeft: a.left - scroller.getBoundingClientRect().left,
      activityWidth: a.width,
      totalWidth: t.width,
      personWidth: person.getBoundingClientRect().width,
      activityRight: a.right,
      totalLeft: t.left,
      leftOfBoundaryIsActivity: cellAt(a.right - 1) === activity,
      rightOfBoundaryIsTotal: cellAt(t.left + 1) === total,
      activityBackground: getComputedStyle(activity).backgroundColor,
      totalBackground: getComputedStyle(total).backgroundColor,
    };
  }
  // Every type's words — a phone's tap face, a wider screen's truncated name — end inside their cell.
  out.labelsInside = [...document.querySelectorAll('[data-type] > th')].every((th) => {
    const words = th.querySelector('button, span[title]');
    return words.getBoundingClientRect().right <= th.getBoundingClientRect().right + 0.5;
  });
  // A phone's tap face keeps its 44px area (\`TAP_AREA\`): clipping its words does not clip the area above and below it.
  out.tapAreaKept = [...document.querySelectorAll('[data-type] > th button')].every((face) => {
    const r = face.getBoundingClientRect();
    const hit = (y) => document.elementFromPoint(r.left + 2, y)?.closest('button') === face;
    return r.height < 40 && hit(r.top - 6) && hit(r.bottom + 6);
  });
  return out;
})()`;

interface Row {
  activityLeft: number;
  activityWidth: number;
  totalWidth: number;
  personWidth: number;
  activityRight: number;
  totalLeft: number;
  leftOfBoundaryIsActivity: boolean;
  rightOfBoundaryIsTotal: boolean;
  activityBackground: string;
  totalBackground: string;
}

interface Measured {
  scrollLeft: number;
  overflows: boolean;
  labelsInside: boolean;
  tapAreaKept: boolean;
  rows: Record<'header' | 'subtotal' | 'type' | 'foot', Row>;
}

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

describe.skipIf(!CHROME)('P19.11-T6 AC-2 the activity table’s sticky columns, in a real browser (UX-5)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  it.each([
    // A phone: *Aktivitas* 132px, *Total* 44px, a person 56px (the mockup's `132px 44px repeat(n, 56px)`).
    [375, true, 132, 44],
    // A tablet: *Aktivitas* 120px, *Total* 44px.
    [800, false, 120, 44],
  ] as const)('P19.11-T6 AC-2 at %ipx the two sticky columns meet in every row type, at every scroll position, Minggu and Bulan, Unit and Group', async (width, phone, activityWidth, totalWidth) => {
    for (const scope of ['unit', 'group'] as const) {
      for (const span of ['week', 'month'] as const) {
        await browser.show(await pageFor(table(scope, span, phone)), width);
        for (const by of [0, 37, 150, 'end'] as const) {
          const m = await browser.tab.evaluate<Measured>(MEASURE(by));
          expect(m.overflows).toBe(true);
          expect(m.labelsInside).toBe(true);
          expect(m.tapAreaKept).toBe(true);
          if (by !== 0) expect(m.scrollLeft).toBeGreaterThan(0);
          for (const [kind, row] of Object.entries(m.rows)) {
            const at = `${scope} ${span} scrolled ${by}, ${kind}`;
            // The columns are the colgroup's, never the content's.
            expect({ at, width: row.activityWidth }).toEqual({ at, width: activityWidth });
            expect({ at, width: row.totalWidth }).toEqual({ at, width: totalWidth });
            expect({ at, width: row.personWidth }).toEqual({ at, width: 56 });
            // Pinned to the scroller's left edge whatever the scroll.
            expect({ at, left: row.activityLeft }).toEqual({ at, left: 0 });
            // One block: Aktivitas's right edge is Total's left edge.
            expect({ at, gap: row.totalLeft - row.activityRight }).toEqual({ at, gap: 0 });
            // Just left of the boundary is Aktivitas, just right of it Total — never a person scrolling by.
            expect({ at, left: row.leftOfBoundaryIsActivity, right: row.rightOfBoundaryIsTotal }).toEqual({ at, left: true, right: true });
            // Both opaque.
            expect(row.activityBackground).not.toBe(TRANSPARENT);
            expect(row.totalBackground).not.toBe(TRANSPARENT);
          }
        }
      }
    }
  }, 60_000);

  it('P19.11-T6 AC-2 at 1024px Aktivitas is 200px and Total 64px, and they still meet when the people overflow', async () => {
    await browser.show(await pageFor(table('group', 'week', false)), 1024);
    const m = await browser.tab.evaluate<Measured>(MEASURE('end'));
    expect(m.overflows).toBe(true);
    for (const row of Object.values(m.rows)) {
      expect([row.activityWidth, row.totalWidth, row.personWidth]).toEqual([200, 64, 56]);
      expect(row.totalLeft - row.activityRight).toBe(0);
      expect([row.leftOfBoundaryIsActivity, row.rightOfBoundaryIsTotal]).toEqual([true, true]);
    }
  }, 30_000);

  it('P19.11-T6 AC-2 with few people the table fills the card, the people sharing the room, and the sticky columns keep their widths', async () => {
    // Two people: 132 + 44 + 2 × 56 = 288px, inside the phone's 343px card.
    const view = activities({ people: activities().people.slice(0, 2) });
    await browser.show(await pageFor(renderToStaticMarkup(
      createElement('div', { className: 'p-4' }, createElement(ActivityTable, { view, scope: 'unit', phone: true })),
    )), 375);
    const m = await browser.tab.evaluate<Measured>(MEASURE(0));
    expect(m.overflows).toBe(false);
    for (const row of Object.values(m.rows)) {
      expect([row.activityWidth, row.totalWidth]).toEqual([132, 44]);
      expect(row.personWidth).toBeGreaterThan(56);
      expect(row.totalLeft - row.activityRight).toBe(0);
    }
  }, 30_000);
});
