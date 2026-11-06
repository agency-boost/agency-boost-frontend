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
    360: '1e89a233bda38fd35ed3c9409c9d4015a2b0cc6602e19d5168cdd28f9c795f39',
    375: '1e89a233bda38fd35ed3c9409c9d4015a2b0cc6602e19d5168cdd28f9c795f39',
    768: '0fe9d12836bbe531446d48a6af5fc7b1d3622a234272b687e1607e50610aa23b',
    1024: 'e74114b695d2d48b71ae3bd069927bbc7b1495878f28eb435e6a65dc0780c613',
    1280: 'ed2d0acc997c71121f96be9b53e50b865140d0e27d4973953458aa4e834ca85f',
  },
  AAB: {
    360: '1e89a233bda38fd35ed3c9409c9d4015a2b0cc6602e19d5168cdd28f9c795f39',
    375: '1e89a233bda38fd35ed3c9409c9d4015a2b0cc6602e19d5168cdd28f9c795f39',
    768: '0fe9d12836bbe531446d48a6af5fc7b1d3622a234272b687e1607e50610aa23b',
    1024: 'd42ba6f9f47ca9a95e0fd05236f4ebf44361477285dce415195c8f3ecd65a281',
    1280: '72a641d0b388f28addaa46ca6b20d4b80122f793568c23d4193f3364e76ef8c7',
  },
  Agent: {
    360: '5f393d37c40729b86dfda3332f2fbc43d7f4703fec45d0d70cfcdbfd6c339c91',
    375: '5f393d37c40729b86dfda3332f2fbc43d7f4703fec45d0d70cfcdbfd6c339c91',
    768: '57e87f13b08420e52a2bf2a57924db131e9b1fda6dea80dac762e88d69b39925',
    1024: 'e9fdc028d8243d16591f47ff1e8c98a6cbde29f97a053eabaa30e98a4f1fe845',
    1280: 'eaf2e025c6ce524deebfd8ff63a1d07128a4fcf7773a4d5a9d68ee35602f47dd',
  },
};

/** The *Lainnya* sheet open at 375px, and the sidebar's account menu open at 1280px: recorded as above. */
const OPENED: Record<keyof typeof WHO, { sheet: string; menu: string }> = {
  AB: {
    sheet: 'dc87746fb30236ebe55119c4bc081469ab4694503fe28dba8cbb92516a7fcda1',
    menu: '0661eb30dbc32f6ce12fd22e7fff8e18a92b252d2c5d4e57abcba6cf1cd2bdb7',
  },
  AAB: {
    sheet: '828ce794a7e2bbe60d9dfef9b451a6b113ef59037c25647e17316e2bc759ebf8',
    menu: '0661eb30dbc32f6ce12fd22e7fff8e18a92b252d2c5d4e57abcba6cf1cd2bdb7',
  },
  Agent: {
    sheet: '6be8179aecb86319c25e480c82bff8b76bd6413868ec27c2683a2b8dbe8f101a',
    menu: 'd30345e7eff56612681186862c11e89baf78a00aa1b1ce098d71f1203bafe820',
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
