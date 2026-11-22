import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { budi } from '@test/people-fixtures';
import { NameCell } from '@/app/(tenant)/people/members/members-screen';
import { ComplianceCardButton } from '@/components/overview/compliance-section';
import { Segmented } from '@/components/ui/segmented';
import { COMPLIANCE_CATEGORIES, type ComplianceCard } from '@/lib/kpm-overview';
import type { RosterMember } from '@/lib/people';

/**
 * **Long words where the walk of 20 November 2026 found them broken or run over, measured in a real browser** — jsdom
 * lays nothing out, so this asks Chrome, with the component's own markup (`react-dom/server`) and the app's own
 * stylesheet (`chrome-page.ts`):
 *
 * - **All members at 1024px**: a long NAME ran into *Group*. It ends in *…* inside its fixed column.
 * - **The forum's tabs at 1280px**: *MAPA / driver* on two lines in a track sized to its content (`md:w-fit`). One line.
 * - **The Overview's compliance cards at 1024px**: *Campai…*, where the mockup draws every name whole. Whole, and inside
 *   the card.
 */
const html = (element: ReactElement) => renderToStaticMarkup(element);

describe.skipIf(!CHROME)('long words, in a real browser (the walk of 2026-11-20)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  it('All members at 1024px: a long NAME ends in … inside its column, never under Group', async () => {
    const member = { ...budi(), fullName: 'Indah Permatasari Wulandari', role: 'ab', orgLevelCode: 'AB', isCoreLeader: true } as unknown as RosterMember;
    // The member column at 1024px: the table's 884px less the five fixed columns (`members-screen.tsx`'s `colgroup`).
    const markup = html(createElement('table', { className: 'table-fixed', style: { width: '212px' } },
      createElement('tbody', null, createElement('tr', null,
        createElement('td', { className: 'px-4 py-2.5', 'data-cell': '' }, createElement(NameCell, { member, onOpen: () => undefined }))))));
    await browser.show(await pageFor(markup), 1024);
    const m = await browser.tab.evaluate<{ inside: boolean; cut: boolean; star: boolean }>(`(() => {
      const cell = document.querySelector('[data-cell]').getBoundingClientRect();
      const button = document.querySelector('[data-cell] button');
      const name = [...button.querySelectorAll('span')].find((s) => s.textContent === 'INDAH PERMATASARI WULANDARI'
        || s.textContent === 'Indah Permatasari Wulandari');
      const star = [...button.querySelectorAll('span')].find((s) => s.textContent.includes('★'));
      return {
        inside: button.getBoundingClientRect().right <= cell.right - 16 + 0.5,
        cut: name.scrollWidth > name.clientWidth,
        star: !!star && star.getBoundingClientRect().right <= cell.right - 16 + 0.5,
      };
    })()`);
    expect(m).toEqual({ inside: true, cut: true, star: true });
  });

  it('the forum’s tabs at 1280px: every label on one line in a track sized to its content', async () => {
    const tabs = [
      { id: 'mapa', label: 'MAPA driver' }, { id: 'groups', label: 'Informal group' },
      { id: 'agenda', label: 'Agenda' }, { id: 'actions', label: 'Action items' },
    ];
    // The forum's own call (`forum-screen.tsx`): a track sized to its content from 768px. Its panel is a function child.
    const props = { label: 'Forum', tabs, active: 'mapa', onSelect: () => undefined, className: 'md:w-fit' } as unknown as Parameters<typeof Segmented>[0];
    const markup = html(createElement('div', { className: 'p-4', style: { width: '964px' } },
      createElement(Segmented, props, (() => null) as unknown as ReactNode)));
    await browser.show(await pageFor(markup), 1280);
    const lines = await browser.tab.evaluate<number[]>(`[...document.querySelectorAll('[role=tab]')].map((tab) => {
      const range = document.createRange();
      range.selectNodeContents(tab);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    })`);
    expect(lines).toEqual([1, 1, 1, 1]);
  });

  it('the Overview’s compliance cards at 1024px: every name whole and inside its card', async () => {
    const card = (category: ComplianceCard['category'], pct: number): ComplianceCard => ({ category, count: 5, of: 31, pct });
    const cards = COMPLIANCE_CATEGORIES.map((category, i) => card(category, 16 + i * 12));
    // The section's grid at 1024px: the Overview's right column, two cards to a row (`owner-overview-1024`).
    const markup = html(createElement('ul', { className: 'grid grid-cols-2 gap-2 rounded-lg bg-card p-2', style: { width: '330px' } },
      ...cards.map((c) => createElement('li', { key: c.category },
        createElement(ComplianceCardButton, { card: c, view: { thresholds: { lowBelowPct: 34, highFromPct: 67 } }, onOpen: () => undefined })))));
    await browser.show(await pageFor(markup), 1024);
    const m = await browser.tab.evaluate<{ name: string; whole: boolean; inside: boolean }[]>(`[...document.querySelectorAll('[data-card]')].map((card) => {
      const name = card.querySelector('.font-bold');
      const box = card.getBoundingClientRect();
      const words = name.getBoundingClientRect();
      return {
        name: name.textContent,
        whole: name.scrollWidth <= name.clientWidth + 0.5 && getComputedStyle(name).textOverflow !== 'ellipsis',
        inside: words.right <= box.right + 0.5 && card.scrollWidth <= card.clientWidth + 0.5,
      };
    })`);
    expect(m.filter((c) => !c.whole || !c.inside)).toEqual([]);
    expect(m.map((c) => c.name)).toContain('Campaigns');
  });
});
