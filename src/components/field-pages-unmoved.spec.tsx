import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { atWidth, makeMe, renderWithSession, wears } from '@test/harness';
import { asBeforeBranding } from '@test/brand-aliases';
import type { Me } from '@/lib/session';
import { AgentShell } from './agent-shell';
import { Page } from './page';

/**
 * **P19.2-T1 AC-2: the Agent's, the AAB's and the AB's pages look exactly as before** (UI-146's *Done when*; ADR-0197
 * §7). Bringing the Owner, the Admin and the Super Admin into the shell must move nothing of the field roles', so their
 * page is pinned, as `drawnAt` prints it, at the five widths the phase file names (P19.2-T0 AC-5's automated half) —
 * the digests taken from the build **before** the change and recorded here. A digest that moves is a field page that
 * moved; re-record it only with the change that is meant to move it, and say which.
 */
const route = vi.hoisted(() => ({ path: '/goals' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(),
}));

function member(over: Partial<NonNullable<Me['membership']>>, me: Partial<Me> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, office: { code: '0417', branch: 'Cempaka Putih' }, ...over,
    },
    ...me,
  });
}

/** The display classes: the last that holds decides whether an element is drawn. */
const DISPLAY = new Set(['hidden', 'flex', 'inline-flex', 'block', 'inline-block', 'inline', 'grid', 'inline-grid', 'contents', 'table']);
const SCREEN = /^(?:max-)?(?:sm|md|lg|xl|2xl):/;

/**
 * **Whether an element is drawn at a width**: its display classes as the stylesheet orders them — a screen variant's
 * after every bare class — and the last that holds there wins. `md:hidden` over a bare `flex` is not drawn from 768px.
 */
function drawn(node: Element, px: number): boolean {
  const tokens = (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const worn = new Set(wears(node, px).split(/\s+/));
  let bare: string | null = null;
  let varied: string | null = null;
  for (const token of tokens) {
    const rest = token.replace(/^(?:(?:max-)?(?:sm|md|lg|xl|2xl):)+/, '');
    if (!DISPLAY.has(rest) || !worn.has(rest)) continue;
    if (SCREEN.test(token)) varied = rest;
    else bare = rest;
  }
  return (varied ?? bare) !== 'hidden';
}

/**
 * **What is drawn at a width, digested**: `drawnAt` (`test/harness.tsx`) with every element the width does not draw left
 * out (`drawn`). So a node no reader at that width can see — a phone's ☰ inside a desktop's sidebar — is not part of the
 * page's look, and taking it out of the markup moves nothing.
 */
function drawnDigest(el: Element, px: number): string {
  const copy = el.cloneNode(true) as Element;
  for (const node of Array.from(copy.querySelectorAll('*'))) {
    if (copy.contains(node) && !drawn(node, px)) node.remove();
  }
  for (const node of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
    // P19.6-T1 AC-1: the brand tokens read as the colours they replaced, which they hold by default (`brand-aliases.ts`).
    if (node.hasAttribute('class')) node.setAttribute('class', asBeforeBranding(wears(node, px)));
  }
  const html = asBeforeBranding(copy.outerHTML.replace(/_r_[0-9a-z]+_/g, '_id_'));
  return createHash('sha256').update(html).digest('hex');
}

const WHO = {
  AB: member({ directCount: 4 }, { permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'] }),
  AAB: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }, { permissions: ['member:invite'] }),
  Agent: member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent' }),
} as const;

/**
 * *Re-recorded 2026-11-20 by P19.17-T3, the change meant to move them all (AC-3, AC-5, AC-6, AC-7; ADR-0269; part E):*
 * **every width, the sheet and the account menu** — the menu's Tabler outline icons, one set everywhere (the tab bar's
 * four and *Lainnya*'s at 360, 375 and 768px); from 1024px every row with its icon, the group names grey capitals with a
 * chevron, every group open in a part that scrolls with no scrollbar, the rail's one icon per group, a navy current
 * icon, the name in capitals; the sheet's bold headings, 48px tiles and outlined *Keluar*; *📘 Panduan* gone from the
 * sidebar, the sheet and the account menu — which is now the same for the Agent as for the leaders.
 *
 * *Re-recorded 2026-11-12 by P19.13-T1 and T2, the change meant to move them (UI-192, UI-194, UI-196; ADR-0252):* **1024
 * and 1280 only** — `main` the page frame (`lg:mx-auto lg:max-w-frame lg:px-frame`), the title row's 24px under it, and
 * the floating sidebar: the app icon and the branch's name, *Search agent* a field under the logo, the top section Home ·
 * Activity · Calendar · Unit Dashboard, the white pill, only the current page's group open, one line, the account card.
 * **Every 360, 375 and 768 digest, the *Lainnya* sheet's and the account menu's are unchanged** (P19.13-T1 AC-6, T2
 * AC-9): the phone and the tablet are drawn as they were, to the byte.
 *
 * *Re-recorded 2026-11-06 by P19.6-T5, the change meant to move them (AC-1; ADR-0219 §5):* **1024 and 1280, the sheet and
 * the account menu** — *📘 Panduan*, the sidebar's last item from 1024px, the *Lainnya* sheet's line above *Keluar* and
 * the account menu's item between *Your account* and *Sign out*. The Agent's menu now differs from the leaders' by its
 * address alone (`#agent`, `#leader`). Every phone and tablet page digest is unchanged: the item is in the sheet, which
 * these page digests do not open. *Re-recorded the same day:* the new tab moved from an `sr-only` span into each link's
 * `aria-label`, so no sentence of the shell's is in the page's text.
 *
 * *Re-recorded 2026-11-05 by P19.5-T4, the change meant to move them:* **1024 and 1280 only, and the sheets below** — the
 * *Survei* item every field role has in *Saya* (C-R2, D-37; OD-267), in the laptop sidebar and the *Lainnya* sheet.
 * Every phone and tablet digest is the build's before P19.2-T1 still: the reminder's dot on *Lainnya* is drawn only
 * while a survey waits, and this spec's readers have none. The account menu's digests did not move.
 *
 * Recorded 2026-11-05 from the build before P19.2-T1, by this spec's own `drawnDigest`: the shell's markup as it stood,
 * the phone's ☰ and the bar's *ID | EN* (both `md:hidden`, so never drawn beside a desktop's sidebar) still in it.
 */
const BEFORE: Record<keyof typeof WHO, Record<number, string>> = {
  AB: {
    360: '8f0d9464837e84d78b3f4b96072edcdeac1f4c3fd8b775cb598853c360a3e6ec',
    375: '8f0d9464837e84d78b3f4b96072edcdeac1f4c3fd8b775cb598853c360a3e6ec',
    768: 'ad2ea50cd53ab4fc483c4e5b119fe0305e13f8e90511e30007d187ab0da95baf',
    1024: 'ec4e682503e4df62362a5cace75028ab909fe84f120af9da4bf2c543b03639f0',
    1280: '8b181c9fbe527d035a78e47b919c5b5452e67be797fb6af1449c38983df94cef',
  },
  AAB: {
    360: '8f0d9464837e84d78b3f4b96072edcdeac1f4c3fd8b775cb598853c360a3e6ec',
    375: '8f0d9464837e84d78b3f4b96072edcdeac1f4c3fd8b775cb598853c360a3e6ec',
    768: 'ad2ea50cd53ab4fc483c4e5b119fe0305e13f8e90511e30007d187ab0da95baf',
    1024: '5b420c99645990ddda657824df2edf294d7e1079feb1abd9a2b2f45d24488f53',
    1280: '81ee8ef702ea4f9bfc8f4a99ab5ae21101db9df396d27041e57244378e73b95a',
  },
  Agent: {
    360: 'c2da0524e1a6e45a488ae5a39821bf28aa23c62df8e18e03acc093c34f400ace',
    375: 'c2da0524e1a6e45a488ae5a39821bf28aa23c62df8e18e03acc093c34f400ace',
    768: '20e82ea68dae01fd91c337415595dba5539a7720c83a1b5ff0544588c8bffc8e',
    1024: 'ca5a890f0849c725979a91b97ae7042dac4c5798ac20895782767945465d81c8',
    1280: 'b52c421a6974154fce376d66eb1600cabe985e6f6378916c4f001457cf156564',
  },
};

/** The *Lainnya* sheet open at 375px, and the sidebar's account menu open at 1280px: recorded as above. */
const OPENED: Record<keyof typeof WHO, { sheet: string; menu: string }> = {
  AB: {
    sheet: 'e114aae57de5477b09d42b40b0f5ab846cb6a44c74d51d0d4ae3d15711684df9',
    menu: 'db8f36a698509ba97978dff0e03c07aef8f623e934189c65d4a775cccaf70566',
  },
  AAB: {
    sheet: '447a00748e6a69ee5c0b272d907d0f3f2b16b37bd2acbab99ab193a4eb23072a',
    menu: 'db8f36a698509ba97978dff0e03c07aef8f623e934189c65d4a775cccaf70566',
  },
  Agent: {
    sheet: 'fb1a233037214e0e98951eddc72e4c7483f0ba54cef0bba02a36e6bc084c1f02',
    menu: 'db8f36a698509ba97978dff0e03c07aef8f623e934189c65d4a775cccaf70566',
  },
};

function fieldPage(who: keyof typeof WHO) {
  return renderWithSession(
    <AgentShell>
      <Page title="Goal Setting" subtitle="Turn your annual target into this month’s activity.">
        <p>content</p>
      </Page>
    </AgentShell>,
    { me: WHO[who] },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  route.path = '/goals';
});

describe('P19.2-T1 AC-2 the field roles’ pages are drawn as before, at five widths', () => {
  it.each(
    (Object.keys(WHO) as (keyof typeof WHO)[]).flatMap((who) => [360, 375, 768, 1024, 1280].map((px) => [who, px] as const)),
  )('P19.2-T1 AC-2 %s at %ipx', (who, px) => {
    window.localStorage.clear();
    atWidth(px);
    const { container } = fieldPage(who);
    const digest = drawnDigest(container, px);
    if (process.env.RECORD_DIGESTS) console.log(`DIGEST ${who} ${px} ${digest}`);
    expect(digest).toBe(BEFORE[who][px]);
  });

  it.each(Object.keys(WHO) as (keyof typeof WHO)[])('P19.2-T1 AC-2 %s: the Lainnya sheet at 375px and the account menu at 1280px', async (who) => {
    window.localStorage.clear();
    atWidth(375);
    const phone = fieldPage(who);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = drawnDigest(await screen.findByRole('dialog', { name: 'More' }), 375);
    phone.unmount();
    atWidth(1280);
    fieldPage(who);
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    const menu = drawnDigest(document.getElementById('sidebar-user-actions')!, 1280);
    if (process.env.RECORD_DIGESTS) console.log(`OPENED ${who} ${sheet} ${menu}`);
    expect({ sheet, menu }).toEqual(OPENED[who]);
  });
});
