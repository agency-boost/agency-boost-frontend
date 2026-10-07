import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import type { Me } from '@/lib/session';
import { PHONE_QUERY } from '@/lib/use-phone';
import { AgentShell } from './agent-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
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
