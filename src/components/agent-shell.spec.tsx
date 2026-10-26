import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
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
 * **The way back to the office console** (P13.2-T5, ADR-0114): *Open Owner view* or *Open Admin view*
 * in the field view's identity menu, for an Owner or an Admin who opened it, and for nobody else.
 * `shell-nav.spec.tsx` holds the field nav itself; nothing here adds to it.
 */
describe('Open Owner view and Open Admin view, in the field view’s identity menu (P13.2-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const chip = () => screen.getByRole('button', { name: /Rina/ });
  const panel = () => document.getElementById('sidebar-user-actions')!;
  /** The panel's links, in order, by their text. */
  const links = () => within(panel()).getAllByRole('link').map((a) => a.textContent);

  it('P13.2-T5 AC-2 offers an Owner Open Owner view, to the console, above Your account', async () => {
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: reader({ isKpmOwner: true, directCount: 3 }),
    });
    // A link in the chip's panel, never an item in the field nav (ADR-0062 §2).
    expect(screen.queryByRole('link', { name: 'Open Owner view' })).not.toBeInTheDocument();
    await userEvent.click(chip());

    expect(within(panel()).getByRole('link', { name: 'Open Owner view' })).toHaveAttribute('href', '/kpm/overview');
    expect(links()).toEqual(['Open Owner view', 'Your account']);
  });

  it('P13.2-T5 AC-2 offers an Admin who is not the Owner Open Admin view, to the same place', async () => {
    renderWithSession(<AgentShell title="Log Activity">body</AgentShell>, { me: reader({ isKpmAdmin: true }) });
    await userEvent.click(chip());
    expect(within(panel()).getByRole('link', { name: 'Open Admin view' })).toHaveAttribute('href', '/kpm/overview');
    expect(within(panel()).queryByRole('link', { name: 'Open Owner view' })).not.toBeInTheDocument();
  });

  it.each([
    ['an AB who leads people', { orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }],
    ['an AAB who leads people', { orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }],
    ['an AAB who leads nobody', { orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 }],
    ['an Agent', { orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount: 0 }],
  ] as const)('P13.2-T5 AC-2 offers %s neither link', async (_, over) => {
    renderWithSession(<AgentShell title="Log Activity">body</AgentShell>, { me: reader(over) });
    await userEvent.click(chip());
    expect(links()).toEqual(['Your account']);
  });

  it('P13.2-T5 AC-2 offers somebody in no office nothing either', async () => {
    renderWithSession(<AgentShell title="Find your KPM">body</AgentShell>, { me: makeMe({ membership: null }) });
    await userEvent.click(chip());
    expect(links()).toEqual(['Your account']);
  });

  it('P13.2-T5 AC-5 offers a support session impersonating an Owner the same link', async () => {
    const me = {
      ...reader({ isKpmOwner: true, directCount: 3 }),
      isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-support',
    };
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, { me });
    await userEvent.click(chip());
    expect(within(panel()).getByRole('link', { name: 'Open Owner view' })).toHaveAttribute('href', '/kpm/overview');
  });

  it('P13.2-T5 AC-3 on a phone sits after the nav groups and before Your account', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      matches: query === PHONE_QUERY,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })));
    renderWithSession(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: reader({ isKpmAdmin: true, directCount: 1 }),
    });
    await userEvent.click(chip());

    const nav = within(panel()).getByRole('navigation', { name: 'Main' });
    const viewSwitch = within(panel()).getByRole('link', { name: 'Open Admin view' });
    expect(nav.contains(viewSwitch)).toBe(false);
    expect(nav.compareDocumentPosition(viewSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(links().slice(-2)).toEqual(['Open Admin view', 'Your account']);
  });
});

/**
 * **The *Recruitment tools* group** (P17-T3 AC-1): *Recruitment*, the section file's one addition to the
 * shell (`Recruitment_Section.html:251-254`), after *Sales tools* and before the line above *KPM*, for
 * every field role and in the Owner's and the Admin's field view.
 */
/**
 * **One *Sales tools* entry** (P18.8-T12 AC-1, ADR-0161 §5): *Sales Attack Plan*, current on the plan and on the
 * catalog — its drawer included — whose tabs reach each other; *Product Catalog* is no longer an entry of its own.
 */
describe('the profile line under the name (P18.8-T6 AC-2, ADR-0159 §5)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const OFFICE = { code: '0417', branch: 'Cempaka Putih' };

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

describe('Sales tools, one entry (P18.8-T12 AC-1)', () => {
  afterEach(() => { route.path = '/coaching'; });
  const sidebar = () => within(screen.getByRole('navigation', { name: 'Main' }));

  it('P18.8-T12 AC-1 holds Sales Attack Plan alone, opening the plan', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    const entry = sidebar().getByRole('link', { name: 'Sales Attack Plan' });
    expect(entry).toHaveAttribute('href', '/attack-plan');
    expect(sidebar().queryByRole('link', { name: 'Product Catalog' })).not.toBeInTheDocument();
  });

  it.each(['/attack-plan', '/product-catalog', '/product-catalog/PRUMAPAN'])('P18.8-T12 AC-1 is current on %s', (path) => {
    route.path = path;
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(sidebar().getByRole('link', { name: 'Sales Attack Plan' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/product-catalogs', '/recruitment/attack-plan', '/kpm/settings/products'])('P18.8-T12 AC-1 is not current on %s', (path) => {
    route.path = path;
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(sidebar().getByRole('link', { name: 'Sales Attack Plan' })).not.toHaveAttribute('aria-current');
  });
});

describe('Recruitment tools, after Sales tools (P17-T3 AC-1)', () => {
  afterEach(() => { route.path = '/coaching'; });

  /** The nav's group headings and items, in order, by their text. */
  const navOrder = () => Array.from(screen.getByRole('navigation', { name: 'Main' })
    .querySelectorAll('[aria-controls^="nav-group"], a'))
    .map((el) => (el.textContent ?? '').replace('\u25b8', '').trim());

  it.each([
    ['an Agent', reader({ orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount: 0 })],
    ['an AAB', reader({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1 })],
    ['an AB', reader({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 })],
    ['an Owner in their field view', reader({ isKpmOwner: true, directCount: 3 })],
    ['an Admin in their field view', reader({ isKpmAdmin: true })],
  ])('P17-T3 AC-1 offers %s Recruitment, a live link to the first tab, in its own group after Sales tools', (_who, me) => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me });
    const order = navOrder();
    const at = order.indexOf('Recruitment tools');
    // *Sales tools* is one entry since P18.8-T12 (ADR-0161 §5): the catalog is a tab under it.
    expect(order.slice(at - 2, at + 3)).toEqual([
      'Sales tools', 'Sales Attack Plan', 'Recruitment tools', 'Recruitment', 'KPM',
    ]);
    const item = screen.getByRole('link', { name: 'Recruitment' });
    expect(item).toHaveAttribute('href', '/recruitment/attack-plan');
    expect(item).not.toHaveAttribute('aria-disabled');
    expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
  });

  it('P17-T3 AC-1 ends its group with the line every group but the last has (parity I-144)', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    const group = screen.getByRole('link', { name: 'Recruitment' }).closest('nav > *')!;
    expect(group.lastElementChild).toHaveAttribute('role', 'separator');
  });

  it.each(['/recruitment', '/recruitment/attack-plan', '/recruitment/pitch-materials'])(
    'P17-T3 AC-1 is the current item on %s, and Sales Attack Plan is not',
    (path) => {
      route.path = path;
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
      expect(screen.getByRole('link', { name: 'Recruitment' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Sales Attack Plan' })).not.toHaveAttribute('aria-current');
    },
  );

  it.each(['/attack-plan', '/recruitments', '/kpm/settings/recruitment-pitch'])('P17-T3 AC-1 is not current on %s', (path) => {
    // A prefix is not a parent: `/recruitments` is not beneath `/recruitment`, and the Sales Attack Plan's
    // `/attack-plan` is its own.
    route.path = path;
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(screen.getByRole('link', { name: 'Recruitment' })).not.toHaveAttribute('aria-current');
  });

  it('P17-T3 AC-1 wears a glyph no other item in the sidebar uses', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, {
      me: { ...reader({ directCount: 2, isKpmOwner: true }), activation: { open: true, complete: false }, newHires: true },
    });
    const items = Array.from(screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a'));
    const glyph = (a: Element) => a.querySelector('svg')?.innerHTML ?? '';
    const recruitment = items.find((a) => a.textContent?.trim() === 'Recruitment')!;
    expect(glyph(recruitment)).not.toBe('');
    const others = items.filter((a) => a !== recruitment).map(glyph);
    expect(others.length).toBeGreaterThan(10);
    expect(others).not.toContain(glyph(recruitment));
  });
});

/*
 * P18.8-T15 AC-1 (UI-005): the header's name falls back to the full name when the preferred name is empty or blank.
 * `preferredName ?? fullName` fell back on `null` only, so a profile saved with the field emptied — `''` until the
 * API stored `null` — printed no name at all.
 */
describe('the header name (P18.8-T15 AC-1)', () => {
  it.each([[''], ['   '], [null]])('P18.8-T15 AC-1 shows the full name for a preferred name of %j', (preferredName) => {
    const me = reader();
    renderWithSession(<AgentShell title="x">body</AgentShell>, {
      me: { ...me, user: { ...me.user, preferredName } },
    });
    expect(screen.getByRole('button', { name: /Rina Wijaya/ })).toBeInTheDocument();
  });

  it('P18.8-T15 AC-1 shows the preferred name when there is one', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader() });
    expect(screen.getByRole('button', { name: /Rina/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rina Wijaya/ })).not.toBeInTheDocument();
  });
});
