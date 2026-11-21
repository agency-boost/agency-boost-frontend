import { waitFor } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CHROME, pageFor, startBrowser } from '@test/chrome-page';
import { SHELL_STUBS } from '@test/events-fixtures';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { AGENT_VIEW, AGUS_AB, LEADER, RINA_AGENT } from '@test/home-fixtures';
import AdminLayout from '@/app/(admin)/layout';
import BillingPage from '@/app/(admin)/admin/billing/page';
import AgentLayout from '@/app/(agent)/layout';
import CoachingPage from '@/app/(agent)/coaching/page';
import GoalsPage from '@/app/(agent)/goals/page';
import HomePage from '@/app/(agent)/home/page';
import LeadsPage from '@/app/(agent)/leads/page';
import SummaryPage from '@/app/(agent)/summary/page';
import TenantLayout from '@/app/(tenant)/layout';
import BranchInfoPage from '@/app/(tenant)/kpm/settings/branch-info/page';
import KpmOverviewPage from '@/app/(tenant)/kpm/overview/page';
import type { Me } from '@/lib/session';
import { forgetInFlight } from '@/lib/in-flight';

/**
 * **P19.13 in a real browser — the page frame's edges, the stable gutter, the sidebar that never scrolls and Home's
 * level columns** (P19.13-T5 AC-1, T1 AC-1, AC-3, T2 AC-7, T4 AC-2; UI-192's *add an automated check … fail if a page's
 * edges differ from /home by > 4px*; ADR-0252).
 *
 * Each page is rendered in its own layout — the one shell — by React in jsdom, as a reader's browser renders it (Home with
 * its data, the others in the state they open in: their read on its way), and the markup is then laid out by Chrome with
 * the app's own stylesheet (`chrome-page.ts`). jsdom lays nothing out; Chrome measures:
 *
 * - **the four layouts** — Home's and Summary's dashboard grid, Leads' list + detail, Coaching's and Billing's table,
 *   Branch info's form — at 1440 and 1920px: every child of `main` starts on Home's left edge (±4px), and ends on Home's
 *   right edge (±4px), a form's content at most 720px from the left; the avatar's circle ends on the frame's edge; at
 *   1920 the space left and right of the frame differs by at most 4px — the space on the right measured to the
 *   document's own right edge, where the scrollbar's room begins, not to the window's;
 * - **the gutter** (UI-193): from 1024px the document keeps its scrollbar's room (`scrollbar-gutter: stable`), below it
 *   not; the avatar's right edge on a short page and a long one is the same (±1px). Headless Chrome paints no scrollbar
 *   (`--hide-scrollbars`), so the gutter is read from the computed style, and the edges from the layout. **The room
 *   itself is the platform's** (2026-11-17): none on macOS, whose scrollbars overlay the page, and 15px on Linux — CI's
 *   runner — where Chrome keeps the track's width out of the document although it paints nothing there and `innerWidth`
 *   and the root's `clientWidth` still count it;
 * - **the sidebar** (UI-196; *changed 2026-11-20*, P19.17-T3 AC-5, part E): at 1280 × 800 and 1440 × 900, for an AB and
 *   an Agent on Home, an Owner on the office's Overview and the Super Admin on theirs, the floating panel's place, **only
 *   the menu above *Pengaturan* scrolling**, with no scrollbar drawn, and *Pengaturan* (the Owner's) and the account card
 *   inside the window;
 * - **Home's columns** (UI-195): at 1024, 1280, 1440 and 1920px, for an AB and an Agent, both columns end on one line (±2px).
 */
const route = vi.hoisted(() => ({ path: '/home' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => route.path,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const office = { code: '0417', branch: 'BSD City Branch' };
const OWNER: Me = makeMe({
  user: { ...makeMe().user, fullName: 'Wilson Tanoto', preferredName: 'Wilson', initials: 'WT' },
  membership: {
    membershipId: 'mem-o', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3, isCoreLeader: true, office,
  },
  permissions: ['member:read_profile', 'kpm:read_profile', 'kpm:update_profile', 'kpm_admin:grant', 'kpm:import_roster', 'kpm_overview:read'],
});
const SUPER: Me = makeMe({
  user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all', 'billing:read_prices'],
});
/** The AB of Home's fixture, let into every page measured here: each page drawn, none refused. */
const AB: Me = makeMe({
  ...AGUS_AB,
  permissions: [...AGUS_AB.permissions, 'lead:read', 'lead:create', 'lead:update', 'goal:read', 'goal:update', 'coaching_session:read'],
});

/** `/goals` with a goal, as `goals/page.spec.tsx`'s fixture answers it: the four steps and the result drawn. */
const PERIOD = String(new Date().getFullYear());
const projection = {
  annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 0, remainingApeMinor: 500_000_000_00, monthlyApeTargetMinor: 100_000_000_00,
  policiesPerMonth: 6, policiesPerWeek: 1.4, appointmentsPerMonth: 20, appointmentsPerWeek: 5, leadsPerMonth: 67, leadsPerWeek: 16,
  targetMet: false,
};
const GOAL = {
  period: PERIOD, mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00, commissionRatePct: 10,
  monthsLeft: 5, apeAchievedMinor: 0, achieved: { minor: 0, provenance: 'self_reported', month: null }, caseSizeMinor: 18_000_000_00,
  leadsToApptPct: 30, closingRatePct: 30,
  snapshot: { monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67 },
  projected: projection,
  cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
  cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
  monthsLeftIsOverride: false, savedAt: '2026-09-13T04:00:00.000Z', savedByMembershipId: 'mem-1',
};
const goals = (px: number) => {
  stubFetch({
    ...SHELL_STUBS,
    '/goals': { body: GOAL },
    [`POST /goals/${PERIOD}/preview`]: {
      body: { period: PERIOD, monthsLeft: 5, monthsLeftIsOverride: false, achieved: GOAL.achieved, projected: projection },
    },
  });
  return capture(px, '/goals', inAgent(createElement(GoalsPage)), AB, () => {
    expect(document.querySelector('[data-goal-aside] [data-goal-result]')).not.toBeNull();
  });
};

/** Every read stays on its way: a page drawn in the state it opens in. */
const pending = () => vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

/** A page in its layout, rendered by React at a width, its markup taken once `ready` holds. */
async function capture(
  px: number, path: string, ui: ReactElement, me: Me, ready: () => void = () => undefined,
): Promise<string> {
  route.path = path;
  window.localStorage.clear();
  window.sessionStorage.clear();
  // A read another capture left on its way (the office's configuration) is not this page's to wait on.
  forgetInFlight();
  atWidth(px);
  const rendered = renderWithSession(ui, { me });
  await waitFor(ready);
  const html = rendered.container.innerHTML;
  rendered.unmount();
  vi.unstubAllGlobals();
  return html;
}

const inAgent = (page: ReactElement) => createElement(AgentLayout, null, page);
const home = (px: number, me: Me = AGUS_AB, view = LEADER) => {
  stubFetch({ ...SHELL_STUBS, '/home': { body: view } });
  return capture(px, '/home', inAgent(createElement(HomePage)), me, () => {
    expect(document.querySelector('[data-home-chart]')).not.toBeNull();
  });
};

/** The pages, one or more per layout (UI-192: *dashboard grid, list + detail, table, form*), and what each is. */
const PAGES: { name: string; layout: 'dashboard' | 'list' | 'table' | 'form'; at: (px: number) => Promise<string> }[] = [
  { name: '/summary', layout: 'dashboard', at: (px) => { pending(); return capture(px, '/summary', inAgent(createElement(SummaryPage)), AB); } },
  {
    name: '/leads', layout: 'list', at: (px) => {
      pending();
      return capture(px, '/leads', inAgent(createElement(LeadsPage)), AB, () => {
        expect(document.querySelector('[data-leads-split]')).not.toBeNull();
      });
    },
  },
  { name: '/coaching', layout: 'table', at: (px) => { pending(); return capture(px, '/coaching', inAgent(createElement(CoachingPage)), AB); } },
  {
    name: '/admin/billing', layout: 'table', at: (px) => {
      pending();
      return capture(px, '/admin/billing', createElement(AdminLayout, null, createElement(BillingPage)), SUPER);
    },
  },
  {
    name: '/kpm/settings/branch-info', layout: 'form', at: (px) => {
      pending();
      return capture(px, '/kpm/settings/branch-info', createElement(TenantLayout, null, createElement(BranchInfoPage)), OWNER);
    },
  },
];

interface Box { left: number; right: number; top: number; bottom: number; width: number }
interface Frame {
  width: number;
  /** The document's right edge: the window's, less the scrollbar's room where the platform keeps one (Linux 15px). */
  room: number;
  main: Box;
  frame: { left: number; right: number };
  asideRight: number;
  kids: (Box & { what: string; form: boolean })[];
  avatar: Box | null;
}

const FRAME = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
  const main = document.querySelector('main');
  const style = getComputedStyle(main);
  // A page that wraps its whole self in one element of no width of its own (Leads' \`[data-leads-page]\`) is read inside it.
  const kids = [...main.children].flatMap((el) => (el.matches('[data-leads-page]') ? [...el.children] : [el]))
    .filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).position !== 'fixed');
  // The avatar's circle: the link's one child, or the view menu's last (its view's name stands before it).
  const circle = document.querySelector('[data-title-row] [data-title-avatar] > :last-child');
  return {
    width: innerWidth,
    room: document.documentElement.getBoundingClientRect().right,
    main: box(main),
    frame: { left: box(main).left + parseFloat(style.paddingLeft), right: box(main).right - parseFloat(style.paddingRight) },
    asideRight: box(document.querySelector('aside')).right,
    kids: kids.map((el) => ({
      ...box(el),
      what: el.tagName + (el.getAttribute('data-title-row') !== null ? '[title-row]' : '') + ' ' + String(el.className).slice(0, 48),
      form: el.matches('.lg\\\\:max-w-form') || !!el.querySelector(':scope > .lg\\\\:max-w-form, :scope > form'),
    })),
    avatar: circle ? box(circle) : null,
  };
})()`;

describe.skipIf(!CHROME)('P19.13 the desktop page frame, measured in a real browser (UI-192 to UI-196)', () => {
  let browser: Awaited<ReturnType<typeof startBrowser>>;

  beforeAll(async () => {
    browser = await startBrowser();
  }, process.env.CI ? 120_000 : 30_000);

  afterAll(async () => {
    await browser?.stop();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/home';
  });

  const measure = async (html: string, width: number, height = 900) => {
    await browser.show(await pageFor(html), width, height);
    return browser.tab.evaluate<Frame>(FRAME);
  };

  it.each([1440, 1920])('P19.13-T5 AC-1, T1 AC-1 at %ipx every layout’s edges are Home’s (±4px), and the avatar ends on them', async (width) => {
    const at = await measure(await home(width), width);
    // The frame: at most 1320px, its 32px sides inside it, centred in the room beside the panel — between the panel and
    // the scrollbar's room, which a reader on Windows or Linux sees as the track and a Mac reader not at all.
    expect(at.main.width).toBeLessThanOrEqual(1320);
    expect(Math.round(at.frame.left - at.main.left)).toBe(32);
    expect(at.width - at.room).toBeLessThanOrEqual(20);
    const spaceLeft = at.main.left - at.asideRight;
    const spaceRight = at.room - at.main.right;
    expect(Math.abs(spaceLeft - spaceRight)).toBeLessThanOrEqual(4);
    if (width === 1920) expect(at.main.width).toBe(1320);
    for (const kid of at.kids) {
      expect({ kid: kid.what, left: Math.round(kid.left) }).toEqual({ kid: kid.what, left: Math.round(at.frame.left) });
      expect({ kid: kid.what, right: Math.round(kid.right) }).toEqual({ kid: kid.what, right: Math.round(at.frame.right) });
    }
    expect(at.avatar).not.toBeNull();
    expect(Math.abs(at.avatar!.right - at.frame.right)).toBeLessThanOrEqual(1);

    for (const page of PAGES) {
      const it2 = await measure(await page.at(width), width);
      expect({ page: page.name, left: Math.abs(it2.frame.left - at.frame.left) <= 4 }).toEqual({ page: page.name, left: true });
      expect({ page: page.name, right: Math.abs(it2.frame.right - at.frame.right) <= 4 }).toEqual({ page: page.name, right: true });
      // The title row and the page under it, at least.
      expect({ page: page.name, kids: it2.kids.length >= 2 }).toEqual({ page: page.name, kids: true });
      for (const kid of it2.kids) {
        const where = `${page.name} ${kid.what}`;
        expect({ where, left: Math.abs(kid.left - at.frame.left) <= 4 }).toEqual({ where, left: true });
        if (page.layout === 'form' && kid.form) {
          expect({ where, width: kid.width <= 720 + 1 }).toEqual({ where, width: true });
        } else {
          expect({ where, right: Math.abs(kid.right - at.frame.right) <= 4 }).toEqual({ where, right: true });
        }
      }
      if (page.layout === 'form') expect(it2.kids.some((kid) => kid.form)).toBe(true);
      expect({ page: page.name, avatar: Math.round(it2.avatar!.right) }).toEqual({ page: page.name, avatar: Math.round(at.frame.right) });
    }
  }, 120_000);

  it.each([1440, 1920])('P19.13-T1 AC-3 at %ipx the frame keeps its place on a short page and a long one (UI-193)', async (width) => {
    const html = await home(width);
    const short = await measure(html, width, 2400);
    const long = await measure(html.replace('</main>', '<div style="height:4000px"></div></main>'), width, 900);
    expect(Math.abs(short.avatar!.right - long.avatar!.right)).toBeLessThanOrEqual(1);
    expect(await browser.tab.evaluate<string>('getComputedStyle(document.documentElement).scrollbarGutter')).toBe('stable');
  }, 60_000);

  it('P19.13-T1 AC-3, AC-6 below 1024px the document keeps no gutter (the phone unchanged)', async () => {
    await measure(await home(375), 375, 812);
    expect(await browser.tab.evaluate<string>('getComputedStyle(document.documentElement).scrollbarGutter')).toBe('auto');
  }, 60_000);

  /*
   * *Changed 2026-11-20 (P19.17-T3 AC-5; ADR-0269 §5; part E, `sidebar-icons-laptop`):* P19.13-T2 AC-7's *the nav never
   * scrolls on its own* (with only the current page's group open) gave way to the approved sidebar: every group open,
   * **only the menu above *Pengaturan* scrolls**, no inner scrollbar is drawn, and *Pengaturan* and the account card are
   * always in sight. *Panduan* is gone.
   */
  describe('P19.17-T3 AC-5 only the menu above Pengaturan scrolls; Pengaturan and the account card stay in sight', () => {
    const SIDEBAR = `(() => {
      const scroll = document.querySelector('#sidebar-nav [data-sidebar-scroll]');
      const aside = document.querySelector('aside').getBoundingClientRect();
      const pinned = document.querySelector('[data-sidebar-pinned]');
      const card = document.querySelector('[data-account-card]').getBoundingClientRect();
      return {
        scrollable: getComputedStyle(scroll).overflowY,
        scrollbar: getComputedStyle(scroll).scrollbarWidth,
        top: aside.top, bottom: aside.bottom, left: aside.left, width: aside.width,
        radius: getComputedStyle(document.querySelector('aside')).borderTopLeftRadius,
        pinnedTop: pinned ? pinned.getBoundingClientRect().top : null,
        pinnedBottom: pinned ? pinned.getBoundingClientRect().bottom : null,
        scrollBottom: scroll.getBoundingClientRect().bottom,
        guide: document.querySelector('[data-panduan]') !== null,
        cardTop: card.top, cardBottom: card.bottom, height: innerHeight,
      };
    })()`;
    const WHO: [string, (px: number) => Promise<string>][] = [
      ['an AB on Home', (px) => home(px)],
      ['an Agent on Home', (px) => home(px, RINA_AGENT, AGENT_VIEW)],
      ['the KPM Owner on the office’s Overview', (px) => {
        pending();
        return capture(px, '/kpm/overview', createElement(TenantLayout, null, createElement(KpmOverviewPage)), OWNER);
      }],
      ['the Super Admin on Billing', (px) => {
        pending();
        return capture(px, '/admin/billing', createElement(AdminLayout, null, createElement(BillingPage)), SUPER);
      }],
    ];

    it.each(WHO.flatMap(([who, at]) => [[1280, 800], [1440, 900]].map(([w, h]) => [who, w, h, at] as const)))(
      'P19.13-T2 AC-1, P19.17-T3 AC-5 %s at %i × %i: a floating panel, its menu the one part that scrolls, unseen; Pengaturan and the account card in sight',
      async (who, width, height, at) => {
        await browser.show(await pageFor(await at(width)), width, height);
        const side = await browser.tab.evaluate<{
          scrollable: string; scrollbar: string; top: number; bottom: number; left: number; width: number; radius: string;
          pinnedTop: number | null; pinnedBottom: number | null; scrollBottom: number; guide: boolean;
          cardTop: number; cardBottom: number; height: number;
        }>(SIDEBAR);
        expect({ top: side.top, left: side.left, width: side.width, bottom: side.height - side.bottom, radius: side.radius })
          .toEqual({ top: 12, left: 12, width: 240, bottom: 12, radius: '20px' });
        expect({ scrollable: side.scrollable, scrollbar: side.scrollbar }).toEqual({ scrollable: 'auto', scrollbar: 'none' });
        expect(side.guide).toBe(false);
        // *Changed 2026-11-20 (P19.23-T1 AC-1; ADR-0277 §1):* the console pins *Platform* at the rail's foot, as the
        // Owner's menu pins *Pengaturan* — it had no pinned group until then.
        if (who.startsWith('the KPM Owner') || who.startsWith('the Super Admin')) {
          // Pengaturan (Platform, the console's), under the part that scrolls and above the account card, inside the window.
          expect(side.pinnedTop).not.toBeNull();
          expect(side.pinnedTop!).toBeGreaterThanOrEqual(side.scrollBottom - 1);
          expect(side.pinnedBottom!).toBeLessThanOrEqual(side.cardTop + 1);
        } else {
          expect(side.pinnedTop).toBeNull();
        }
        expect(side.cardBottom).toBeLessThanOrEqual(side.height - 12);
      },
      60_000,
    );
  });

  it.each([1024, 1280, 1440, 1920])('P19.13-T4 AC-2, T5 AC-1 at %ipx /goals sits on the frame’s edges, its two columns ending within 120px of each other (UI-195)', async (px) => {
    await browser.show(await pageFor(await goals(px)), px, 1600);
    // Goal Setting's own edges are the frame's too (T5 AC-1): read here, with its data, after the other layouts.
    const at = await browser.tab.evaluate<Frame>(FRAME);
    for (const kid of at.kids) {
      expect({ kid: kid.what, left: Math.round(kid.left), right: Math.round(kid.right) })
        .toEqual({ kid: kid.what, left: Math.round(at.frame.left), right: Math.round(at.frame.right) });
    }
    const { steps, aside } = await browser.tab.evaluate<{ steps: number; aside: number }>(`(() => ({
      steps: document.querySelector('[data-goal-steps]').getBoundingClientRect().bottom,
      aside: document.querySelector('[data-goal-aside]').getBoundingClientRect().bottom,
    }))()`);
    expect(Math.abs(steps - aside)).toBeLessThanOrEqual(120);
  }, 60_000);

  describe('P19.13-T4 AC-2 Home’s two columns end on one line (UI-195)', () => {
    const COLUMNS = `(() => {
      const grid = document.querySelector('[data-home] > .grid');
      const [left, right] = [...grid.children];
      const lastBottom = (col) => Math.max(...[...col.children].map((el) => el.getBoundingClientRect().bottom));
      return { left: lastBottom(left), right: lastBottom(right) };
    })()`;
    it.each([
      ...[1024, 1280, 1440, 1920].map((px) => ['an AB', px, AGUS_AB, LEADER] as const),
      ...[1024, 1280, 1440, 1920].map((px) => ['an Agent', px, RINA_AGENT, AGENT_VIEW] as const),
    ])('P19.13-T4 AC-2 %s at %ipx: both columns’ bottoms are equal (±2px)', async (_who, px, me, view) => {
      await browser.show(await pageFor(await home(px, me, view)), px, 1400);
      const { left, right } = await browser.tab.evaluate<{ left: number; right: number }>(COLUMNS);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
    }, 60_000);
  });
});
