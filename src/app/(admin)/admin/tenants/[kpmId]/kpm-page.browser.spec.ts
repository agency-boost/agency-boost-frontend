import { waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { BSD, CONSOLE_SUPER_ADMIN, PEOPLE } from '@test/console-fixtures';
import { atWidth, renderInIndonesian, routeParams } from '@test/harness';
import AdminLayout from '@/app/(admin)/layout';
import type { ConsoleKpmPeople } from '@/lib/admin-console';
import { leaveKpm } from '@/lib/super-admin-kpm';
import KpmPage from './page';

/**
 * **Inside a KPM, laid out by a real Chrome** (the integration round of P19.26–P19.29, 2026-11-22; its walk's findings).
 * The page is rendered by React in jsdom in the Super Admin's layout, then drawn by Chrome with the app's stylesheet
 * (`chrome-page.ts`), which measures what jsdom cannot:
 *
 * - **at 360 and 375 nothing scrolls sideways** with an owner whose line is *"Owner sejak … · Belum diundang"* — the KPM
 *   page's grid had an implicit `auto` column that grew to that unbroken line, and every card with it;
 * - **the navy card's *APE bulan ini* stays on one line** at 360 and 375 (*Rp 647,3 Jt*, BSD's);
 * - **the ⓘ of *Lihat sebagai* takes a 44px tap** although its glyph is 28px (`TAP_AREA`);
 * - **at 1024 and 1280 the *Anggota* card's head is one line**: *Anggota · n*, *＋ Tambah user*, *Import people* and
 *   *Lihat semua* side by side, as the head was before *Tambah user* joined it.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => `/admin/tenants/${BSD}`,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

/** BSD's month, its APE *Rp 647,3 Jt* — the figure the walk found on two lines at 375. */
const PERFORMANCE = {
  month: '2026-11', currentMonth: '2026-11', earliestMonth: '2026-01', latestMonth: '2026-11', max: 99, currency: 'IDR',
  held: true, group: null, canWrite: true, groups: [],
  total: {
    activeAgentTarget: 14, rekrutTarget: 8, rekrutYtdTarget: 40, apeTargetMinor: 68_600_000_000, unset: 0, abGroups: 4, people: 27,
    actual: { apeMinor: 64_730_000_000, apePct: 94, activeAgents: 8, rekrut: 4 },
  },
};

/** Two owners, the second not yet invited: the line that made the page 379px wide at 360. */
const PEOPLE_TWO_OWNERS: ConsoleKpmPeople = {
  ...PEOPLE,
  owners: {
    canManage: true,
    owners: [
      PEOPLE.owners.owners[0],
      {
        userId: 'u-rina', membershipId: 'm-rina', fullName: 'Rina Kurniawati Wijayakusuma', agentCode: '86077', role: 'aab',
        photoUrl: null, since: '2026-11-20T03:00:00.000Z', state: 'not_invited',
      },
    ],
  },
};

/** The page's two reads answered; every other read of the shell left on its way. */
function answer(people: ConsoleKpmPeople) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.includes(`/admin/tenants/${BSD}/people`) ? people
      : url.includes('/kpm/overview/performance') ? PERFORMANCE : undefined;
    if (body === undefined) return new Promise(() => undefined);
    return { ok: true, status: 200, json: async () => body, blob: async () => new Blob() } as Response;
  }));
}

/** The KPM page in the console's layout at a width, its markup once the figures are in. */
async function capture(px: number, people: ConsoleKpmPeople = PEOPLE_TWO_OWNERS): Promise<string> {
  window.sessionStorage.clear();
  atWidth(px);
  answer(people);
  const rendered = renderInIndonesian(
    createElement(AdminLayout, null, createElement(KpmPage, { params: routeParams({ kpmId: BSD }) })),
    { me: CONSOLE_SUPER_ADMIN },
  );
  await waitFor(() => {
    expect(document.querySelector('[data-kpm-tiles]')?.textContent).toContain('647,3');
    expect(document.querySelector('[data-members-card]')).not.toBeNull();
  });
  const html = rendered.container.innerHTML;
  rendered.unmount();
  leaveKpm();
  vi.unstubAllGlobals();
  return html;
}

describe.skipIf(!CHROME)('inside a KPM, measured in a real browser (the integration round’s walk, 2026-11-22)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([360, 375])('at %ipx nothing scrolls sideways, with an owner not yet invited', async (px) => {
    await browser.show(await pageFor(await capture(px)), px, 1600);
    const at = await browser.tab.evaluate<{ page: number; cards: number[]; grid: number }>(`(() => ({
      page: document.documentElement.scrollWidth,
      grid: document.querySelector('[data-kpm-people-grid]').getBoundingClientRect().width,
      cards: [...document.querySelectorAll('[data-kpm-people-grid] > *')].map((el) => el.getBoundingClientRect().right),
    }))()`);
    expect(at.page).toBeLessThanOrEqual(px);
    expect(at.grid).toBeLessThanOrEqual(px - 32);
    for (const right of at.cards) expect(right).toBeLessThanOrEqual(px - 16 + 0.5);
  });

  it.each([360, 375])('at %ipx the navy card’s APE, Rp 647,3 Jt, is one line', async (px) => {
    await browser.show(await pageFor(await capture(px)), px, 1600);
    const ape = await browser.tab.evaluate<{ text: string; height: number; line: number; right: number; tile: number }>(`(() => {
      const b = [...document.querySelectorAll('[data-kpm-tiles] dd > b')].find((el) => el.textContent.includes('647,3'));
      const style = getComputedStyle(b);
      return {
        text: b.textContent, height: b.getBoundingClientRect().height, line: parseFloat(style.lineHeight),
        right: b.getBoundingClientRect().right, tile: b.closest('dd').parentElement.getBoundingClientRect().right,
      };
    })()`);
    expect(ape.text).toBe('Rp 647,3 Jt');
    expect(ape.height).toBeLessThan(ape.line * 1.5);
    // On one line, and inside its tile.
    expect(ape.right).toBeLessThanOrEqual(ape.tile);
  });

  it('at 375px the ⓘ of Lihat sebagai takes a 44px tap around its 28px glyph', async () => {
    await browser.show(await pageFor(await capture(375)), 375, 2400);
    const hits = await browser.tab.evaluate<boolean[]>(`(() => {
      const name = [...document.querySelectorAll('[data-view-as] button')].find((b) => b.textContent.includes('Tentang Lihat sebagai'));
      name.scrollIntoView({ block: 'center' });
      const r = name.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return [[-20, 0], [20, 0], [0, -20], [0, 20]].map(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy)?.closest('button') === name);
    })()`);
    expect(hits).toEqual([true, true, true, true]);
  });

  it.each([1024, 1280])('at %ipx the Anggota card’s head is one line: the title, Tambah user, Import people, Lihat semua', async (px) => {
    await browser.show(await pageFor(await capture(px, PEOPLE)), px, 1200);
    const head = await browser.tab.evaluate<{ tops: number[]; height: number }>(`(() => {
      const head = document.querySelector('[data-members-card] > div');
      const parts = [head.querySelector('h2'), head.querySelector('[data-kpm-add-user]'), ...head.querySelectorAll('a')]
        .filter((el) => el.getBoundingClientRect().width > 0);
      return { tops: parts.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; }), height: head.getBoundingClientRect().height };
    })()`);
    expect(head.tops).toHaveLength(4);
    // Every part's middle on one line (±4px), and the head no taller than its 40px pills.
    for (const middle of head.tops) expect(Math.abs(middle - head.tops[0])).toBeLessThanOrEqual(4);
    expect(head.height).toBeLessThanOrEqual(44);
  });
});
