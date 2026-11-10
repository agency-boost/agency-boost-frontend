import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { makeMe, makeSession } from '@test/harness';
import type { Lead } from '@/lib/leads';
import { SessionContext } from '@/lib/session';
import { LeadPane } from './lead-sheet';

/**
 * **P19.11-T3 AC-9 — one section gap in the lead sheet, measured in a real browser** (UX-17, the owner's screenshot of
 * 9 November: *Potensi closing* sitting tight on *Tindakan berikutnya*).
 *
 * Every section's label — *Jenis*, *Status*, *Tindakan berikutnya*, *Keterangan*, *Hasil*, *Detail*, *Proposal*,
 * *Riwayat* — sits **16px** under whatever ends above it, the *Potensi* card included; the label-to-field gap is the
 * label's own 6px. The four labels that sat tight were `<legend>`s, whose top margin a browser ignores; jsdom lays
 * nothing out, so this asks Chrome. The pane's markup (`LeadPane`): the same fields as the phone's sheet, in a frame that
 * renders without a portal — and its foot outside the scrolling box, so nothing scrolls under it.
 */
const LEAD: Lead = {
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Handoko', contact: { phone: '+6282335967649', email: null },
  statusCode: 'APPROVED_NOT_PAID', thisMonth: false, committedMonths: [], closedThisMonth: false, lastEditedBy: null,
  remarks: null, nextActionDate: null, nextActionNote: null, outcome: null, source: null,
  dateRegistered: '2026-11-01T03:00:00.000Z', version: 2, flags: [], overdueDays: null, age: null, gender: null,
  proposals: null,
};

const ME = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome', 'proposal:read', 'proposal:create'],
});

const pane = () => renderToStaticMarkup(createElement(
  'div',
  { style: { height: '2400px', display: 'flex', flexDirection: 'column' } },
  createElement(SessionContext.Provider, { value: makeSession({ me: ME }) }, createElement(LeadPane, { lead: LEAD, onClose: () => undefined })),
));

/** Each section: its label's distance under what ends above it, and its field's under the label. */
const MEASURE = `(() => {
  const box = (el) => el.getBoundingClientRect();
  return [...document.querySelectorAll('[data-lead-section]')].map((section) => {
    const label = section.firstElementChild;
    const above = section.previousElementSibling ?? section.parentElement.previousElementSibling;
    const field = label.nextElementSibling;
    return {
      name: section.getAttribute('data-lead-section'),
      gap: Math.round(box(label).top - box(above).bottom),
      toField: field ? Math.round(box(field).top - box(label).bottom) : null,
    };
  });
})()`;

const FOOT = `(() => {
  const scroller = document.querySelector('[data-lead-pane] > .overflow-y-auto');
  const foot = document.querySelector('[data-pane-foot]');
  return { scrollerBottom: scroller.getBoundingClientRect().bottom, footTop: foot.getBoundingClientRect().top };
})()`;

interface Gap { name: string; gap: number; toField: number | null }

describe.skipIf(!CHROME)('P19.11-T3 AC-9 the lead sheet’s section gaps, in a real browser (UX-17)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  it.each([[375], [768], [1280]])('P19.11-T3 AC-9 at %ipx every section label sits 16px under what is above it, 6px over its field', async (width) => {
    await browser.show(await pageFor(pane()), width, 2400);
    const gaps = await browser.tab.evaluate<Gap[]>(MEASURE);
    expect(gaps.map((g) => g.name)).toEqual(['type', 'status', 'next-action', 'remarks', 'outcome', 'details', 'proposals', 'history']);
    for (const g of gaps) {
      expect({ name: g.name, gap: g.gap }).toEqual({ name: g.name, gap: 16 });
      expect({ name: g.name, toField: g.toField }).toEqual({ name: g.name, toField: 6 });
    }
  }, 30_000);

  it('P19.11-T3 AC-9 nothing scrolls under the foot: the content box ends where the foot begins', async () => {
    await browser.show(await pageFor(pane()), 1280, 900);
    const { scrollerBottom, footTop } = await browser.tab.evaluate<{ scrollerBottom: number; footTop: number }>(FOOT);
    expect(scrollerBottom).toBeLessThanOrEqual(footTop);
  }, 30_000);
});
