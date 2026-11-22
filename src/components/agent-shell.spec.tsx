import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { openEveryGroup } from '@test/sidebar';
import type { Me } from '@/lib/session';
import { PHONE_QUERY } from '@/lib/use-phone';
import { AgentShell } from './agent-shell';

// Mutable so the nav's cases can stand on a recruitment address; every other test reads `/coaching`.
const route = vi.hoisted(() => ({ path: '/coaching' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => route.path,
}));

/** A member of the office, with only what a given case is about spelled out. */
function reader(over: Partial<NonNullable<Me['membership']>> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
  });
}

/**
 * **One account menu for everybody** (P19.17-T3 AC-1; ADR-0269 §1, §2; the brief's gaps 3 and 5). Until P19.2 an Owner or
 * an Admin found *Open Owner view* here (P13.2-T5, ADR-0114), then the views and *Tambah akun* (ADR-0198, ADR-0199), with
 * *📘 Panduan* between *Your account* and *Sign out* (ADR-0219 §5). All of it is gone: *Akun Anda · Keluar*, whoever reads.
 */
describe('P19.17-T3 AC-1 the account menu: Your account and Sign out, for every role', () => {
  afterEach(() => vi.unstubAllGlobals());

  const chip = () => screen.getByRole('button', { name: /Rina/ });
  const panel = () => document.getElementById('sidebar-user-actions')!;
  /** The panel's controls, in order, by their text. */
  const controls = () => Array.from(panel().querySelectorAll('a[href], button')).map((a) => a.textContent);

  it.each([
    ['an Owner', { isKpmOwner: true, directCount: 3, office: { code: '0417', branch: 'Cempaka Putih' } }],
    ['an Admin who is not the Owner', { isKpmAdmin: true }],
    ['a core leader', { isCoreLeader: true, directCount: 4 }],
    ['an AB who leads people', { orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }],
    ['an AAB who leads nobody', { orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 }],
    ['an Agent', { orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount: 0 }],
  ] as const)('P19.17-T3 AC-1 offers %s Your account and Sign out, and nothing else', async (_, over) => {
    renderWithSession(<AgentShell title="Log Activity">body</AgentShell>, { me: reader(over) });
    await userEvent.click(chip());
    expect(controls()).toEqual(['Your account', 'Sign out']);
    expect(screen.queryByText(/My account|Add account|Open Owner view|Guide/)).not.toBeInTheDocument();
  });

  it('P19.17-T3 AC-1 somebody in no office, the same', async () => {
    renderWithSession(<AgentShell title="Find your KPM">body</AgentShell>, { me: makeMe({ membership: null }) });
    await userEvent.click(chip());
    expect(controls()).toEqual(['Your account', 'Sign out']);
  });

  it('P19.17-T3 AC-7 on a phone the Lainnya sheet ends with Keluar, after the groups, with no guide and no view', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      matches: query === PHONE_QUERY,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })));
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: reader({ isKpmAdmin: true, directCount: 1 }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'More' });
    expect(within(sheet).queryByRole('link', { name: /Open Admin view|Guide/ })).not.toBeInTheDocument();
    const signOut = within(sheet).getByRole('button', { name: 'Sign out' });
    const groups = sheet.querySelectorAll('[data-more-group]');
    expect(groups[groups.length - 1].compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('the profile line under the name (P18.5-T6 AC-2, ADR-0159 §5)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const OFFICE = { code: '0417', branch: 'Cempaka Putih' };

  it('P19.17-T3 the Owner’s line names the role, KPM Owner, where it named the rung in Akun saya', () => {
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: reader({ isKpmOwner: true, groups: [], office: OFFICE }),
    });
    expect(screen.getByText('KPM Owner · 0417 · Cempaka Putih')).toBeInTheDocument();
  });

  it('the rung · Core Leader · the groups · the office, one line, its whole text in the tooltip', () => {
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: reader({ isCoreLeader: true, groups: ['Mentoring Circle', 'Top Producers 2026'], office: OFFICE }),
    });
    const line = 'AB · Core Leader · Mentoring Circle, Top Producers 2026 · 0417 · Cempaka Putih';
    const shown = screen.getByText(line);
    expect(shown).toHaveAttribute('title', line);
    expect(shown.className).toContain('truncate');
  });

  it('leaves out what does not apply: an Agent in no group and untagged reads their rung and their office', () => {
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: reader({ orgLevelCode: 'AGENT', hierarchyRole: 'agent', isCoreLeader: false, groups: [], office: OFFICE }),
    });
    expect(screen.getByText('Agent · 0417 · Cempaka Putih')).toBeInTheDocument();
    expect(screen.queryByText(/Core Leader/)).not.toBeInTheDocument();
  });

  it('somebody in no office reads No office yet, alone', () => {
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, { me: makeMe({ membership: null }) });
    expect(screen.getByText('No office yet')).toHaveAttribute('title', 'No office yet');
  });
});

/**
 * **Sales and Recruitment, under *Aktivitas*** (UI V1, UI-004; D-20): one entry each, as before — *Sales* opens the plan
 * and stays current on the catalog (P18.5-T12 AC-1, ADR-0161 §5), *Recruitment* opens its first tab (P17-T3 AC-1) — now
 * the two items of the sidebar's *Aktivitas* group, for every field role.
 */
describe('UI-004 Sales and Recruitment under Aktivitas (P18.5-T12 AC-1, P17-T3 AC-1)', () => {
  afterEach(() => { route.path = '/coaching'; });
  // Every group opened first (P19.13-T2's rule; every group starts open since P19.17-T3, so it opens nothing).
  const sidebar = () => within(openEveryGroup());
  /** The nav's group headings and items, in order, by their text. */
  const navOrder = () => Array.from(openEveryGroup()
    .querySelectorAll('[aria-controls^="nav-group"], a, button[data-nav-control]'))
    .map((el) => (el.textContent ?? '').trim());

  it.each([
    ['an Agent', reader({ orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount: 0 })],
    ['an AAB', reader({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1 })],
    ['an AB', reader({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 })],
    ['an Owner', reader({ isKpmOwner: true, directCount: 3 })],
    ['an Admin', reader({ isKpmAdmin: true })],
  ])('UI-004 offers %s Sales and Recruitment, live, under Activities', (_who, me) => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me });
    const order = navOrder();
    const at = order.indexOf('Activities');
    expect(order.slice(at, at + 3)).toEqual(['Activities', 'Sales', 'Recruitment']);
    expect(sidebar().getByRole('link', { name: 'Sales' })).toHaveAttribute('href', '/attack-plan');
    expect(sidebar().getByRole('link', { name: 'Recruitment' })).toHaveAttribute('href', '/recruitment/attack-plan');
    expect(sidebar().queryByRole('link', { name: 'Product Catalog' })).not.toBeInTheDocument();
  });

  it.each(['/attack-plan', '/product-catalog', '/product-catalog/PRUMAPAN'])('P18.5-T12 AC-1 Sales is current on %s', (path) => {
    route.path = path;
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(sidebar().getByRole('link', { name: 'Sales' })).toHaveAttribute('aria-current', 'page');
    expect(sidebar().getByRole('link', { name: 'Recruitment' })).not.toHaveAttribute('aria-current');
  });

  it.each(['/recruitment', '/recruitment/attack-plan', '/recruitment/pitch-materials'])(
    'P17-T3 AC-1 Recruitment is current on %s, and Sales is not',
    (path) => {
      route.path = path;
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
      expect(sidebar().getByRole('link', { name: 'Recruitment' })).toHaveAttribute('aria-current', 'page');
      expect(sidebar().getByRole('link', { name: 'Sales' })).not.toHaveAttribute('aria-current');
    },
  );

  it.each(['/product-catalogs', '/recruitments', '/kpm/settings/products'])('a prefix is not a parent: neither is current on %s', (path) => {
    route.path = path;
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(sidebar().getByRole('link', { name: 'Sales' })).not.toHaveAttribute('aria-current');
    expect(sidebar().getByRole('link', { name: 'Recruitment' })).not.toHaveAttribute('aria-current');
  });
});

/*
 * P18.5-T15 AC-1 (UI-005): the header's name falls back to the full name when the preferred name is empty or blank.
 * `preferredName ?? fullName` fell back on `null` only, so a profile saved with the field emptied — `''` until the
 * API stored `null` — printed no name at all.
 */
describe('the header name (P18.5-T15 AC-1)', () => {
  it.each([[''], ['   '], [null]])('P18.5-T15 AC-1 shows the full name for a preferred name of %j', (preferredName) => {
    const me = reader();
    renderWithSession(<AgentShell title="x">body</AgentShell>, {
      me: { ...me, user: { ...me.user, preferredName } },
    });
    expect(screen.getByRole('button', { name: /Rina Wijaya/ })).toBeInTheDocument();
  });

  it('P18.5-T15 AC-1 shows the preferred name when there is one', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(screen.getByRole('button', { name: /Rina/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rina Wijaya/ })).not.toBeInTheDocument();
  });
});
