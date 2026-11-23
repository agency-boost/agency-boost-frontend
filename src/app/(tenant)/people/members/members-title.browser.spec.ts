import { waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { atWidth, makeMe, renderInIndonesian } from '@test/harness';
import { row } from '@test/people-fixtures';
import TenantLayout from '@/app/(tenant)/layout';
import MembersPage from './page';

/**
 * ***All members*' title row on a phone, laid out by a real Chrome** (the P19.30 browser walk, 2026-11-23): with the round
 * ⋯ beside *Undang anggota* the `<h1>` was squeezed to about 60px at 360 and 375, and *members* ran under the button. Below
 * 768px the actions now take their own row under the title (`max-md:basis-full`); the title keeps its one line, and from
 * 768px the row is as it was — the title and the actions side by side.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/people/members',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

/** The KPM's Owner, who may download the *Akun & password* PDF — so the ⋯ is drawn. */
const OWNER = makeMe({
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 4,
  },
  permissions: ['member:read_profile', 'member:add', 'member:issue_temporary_password'],
});

/** The page at a width, its markup once the roster is in; every other read of the shell left on its way. */
async function capture(px: number): Promise<string> {
  atWidth(px);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!url.includes('/members?') && !/\/members$/.test(url.split('?')[0])) return new Promise(() => undefined);
    const body = { members: [row()], nextCursor: null, counts: { directory: 1, pending: 0, removed: 0 } };
    return { ok: true, status: 200, json: async () => body, blob: async () => new Blob() } as Response;
  }));
  const rendered = renderInIndonesian(createElement(TenantLayout, null, createElement(MembersPage)), { me: OWNER });
  await waitFor(() => expect(document.querySelector('[data-members-actions]')).not.toBeNull());
  const html = rendered.container.innerHTML;
  rendered.unmount();
  vi.unstubAllGlobals();
  return html;
}

describe.skipIf(!CHROME)('All members’ title row, measured in a real browser (the P19.30 walk, 2026-11-23)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  afterEach(() => vi.unstubAllGlobals());

  const measure = () => browser.tab.evaluate<{ title: { width: number; height: number; line: number; bottom: number }; actions: { top: number; left: number }; page: number }>(`(() => {
    const h1 = document.querySelector('h1');
    const style = getComputedStyle(h1);
    const r = h1.getBoundingClientRect();
    const a = document.querySelector('[data-members-actions]').getBoundingClientRect();
    return {
      title: { width: r.width, height: r.height, line: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2, bottom: r.bottom },
      actions: { top: a.top, left: a.left },
      page: document.documentElement.scrollWidth,
    };
  })()`);

  it.each([360, 375])('at %ipx the title keeps its one line, and the actions sit on the row under it', async (px) => {
    await browser.show(await pageFor(await capture(px)), px, 1200);
    const at = await measure();
    // *All members* on one line, not squeezed: well over the 60px the walk measured.
    expect(at.title.height).toBeLessThan(at.title.line * 1.5);
    expect(at.title.width).toBeGreaterThan(100);
    // *Undang anggota* and ⋯ below the title, never beside it.
    expect(at.actions.top).toBeGreaterThanOrEqual(at.title.bottom - 1);
    expect(at.page).toBeLessThanOrEqual(px);
  });

  it('at 1280px the row is as it was: the title and the actions side by side', async () => {
    await browser.show(await pageFor(await capture(1280)), 1280, 900);
    const at = await measure();
    expect(at.actions.top).toBeLessThan(at.title.bottom);
  });
});
