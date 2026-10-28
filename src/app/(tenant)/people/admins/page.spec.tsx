import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { atWidth, digestAt, makeMe, renderInLayout, renderWithSession, stubFetch, wears } from '@test/harness';
import AdminsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/admins',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list'],
});

const admin = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH',
  agentCode: 'KPM0417-002', role: 'ab', grantedAt: '2026-01-14T00:00:00.000Z',
  grantedByName: 'Wilson Tanoto', canRevoke: true, ...over,
});

const node = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, subtreeCount: 0,
  isLeader: false, isSelf: false, ...over,
});

const OFFICE = {
  nodes: [
    // The tree marks the reader's own node, as `GET /members/tree` does.
    node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', role: 'ab', isSelf: true }),
    node({ membershipId: 'mem-admin', fullName: 'Maya Halim', role: 'ab' }),
    node({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab' }),
  ],
  leader: null, rootIds: ['mem-owner'], selfId: 'mem-owner',
  counts: { ab: 2, aab: 0, agent: 0, total: 2 },
};

function open(admins: Record<string, unknown>[] = [admin()], extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/members/admins': { body: admins },
    '/members/tree': { body: OFFICE },
    ...extra,
  });
  renderInLayout(TenantLayout, <AdminsPage />, { me: OWNER });
  return stub;
}

describe('manage KPM admins (P3-T10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2: shows the hierarchy role beside the name, because the two are separate', async () => {
    // Both of the prototype's own seeded admins are ABs. Leaving the role off would
    // make "an AB who is also an Admin" read as a contradiction.
    open();
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Maya/ });
    expect(within(row).getByTitle('AB')).toBeInTheDocument();
  });

  /*
   * *Amended 2026-10-28 (P18.97-T4 AC-5; the client's grey-text table, UI-026):* the 40-word paragraph — the one thing
   * an Admin does not get, and that admin access is not a hierarchy role — is the client's one line, at every size.
   * The role beside each name (AC-2 above) still says the second half.
   */
  it('AC-4: names the one thing an Admin does not get, in one line', async () => {
    open();
    const blurb = await screen.findByText('Admins can do everything except manage admins.');
    expect(blurb.tagName).toBe('P');
    // Branch info and products left this list with ADR-0027, the Leader Forum with ADR-0028.
    expect(blurb).not.toHaveTextContent('Branch info');
    expect(screen.queryByText(/except one thing: grant or revoke admin access/)).toBeNull();
  });

  it('says when access was granted and by whom', async () => {
    open();
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Maya/ });
    expect(row).toHaveTextContent('Jan 2026');
    expect(row).toHaveTextContent('Wilson Tanoto');
  });

  it('offers only people who are not already admins', async () => {
    open();
    const picker = await screen.findByLabelText('Grant admin access to');
    expect(within(picker).getByRole('option', { name: 'Agus Prasetyo' })).toBeInTheDocument();
    expect(within(picker).queryByRole('option', { name: 'Maya Halim' })).not.toBeInTheDocument();
  });

  it('grants to the person picked', async () => {
    const { calls } = open();
    await userEvent.selectOptions(
      await screen.findByLabelText('Grant admin access to'),
      'mem-agus',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Grant access' }));

    const sent = calls.find((c) => c.init.method === 'POST')!;
    expect(sent.url).toContain('/members/mem-agus/admin');
  });

  it('will not grant until somebody is picked', async () => {
    open();
    expect(await screen.findByRole('button', { name: 'Grant access' })).toBeDisabled();
  });

  it('says what revoking does and does not do, and changes nothing until confirmed', async () => {
    const { calls } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    expect(screen.getByText(/Take Maya Halim's admin access away\?/)).toBeInTheDocument();
    expect(screen.getByText(/keep their place in the office and their unit/)).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Revoke access' }));
    expect(calls.find((c) => c.init.method === 'DELETE')!.url).toContain('/members/mem-admin/admin');
  });

  it('offers no revoke on a row the server says is not revocable', async () => {
    // The Owner's own access comes from being the Owner, not from a grant. The server
    // decides that; the screen renders the answer.
    open([admin({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', canRevoke: false,
                  grantedByName: null, grantedAt: null })]);
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Wilson/ });
    expect(within(row).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(row).toHaveTextContent('Yours');
  });

  it('has an empty state that says what to do', async () => {
    open([]);
    expect(await screen.findByText(/Nobody administers this office but you/)).toBeInTheDocument();
  });

  it('surfaces a refusal rather than looking like it worked', async () => {
    open([admin()], {
      '/members/mem-admin/admin': {
        status: 403,
        body: {
          error: {
            code: 'PERM_OWNER_ONLY',
            message: 'Only this office’s Owner can do that.',
            requestId: 'r-1',
          },
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke access' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only this office’s Owner can do that');
  });

  it('AC-1: never renders for an Admin, who lacks the grant permission', async () => {
    renderInLayout(TenantLayout, <AdminsPage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
          isKpmOwner: false, isKpmAdmin: true, status: 'active', directCount: 0,
        },
        permissions: ['member:read_profile', 'kpm_admin:list'],
      }),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_admin:grant');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('a read that lands after the page is gone (CI, 2026-10-27)', () => {
  /*
   * On CI the answer arrived after the spec's environment was torn down: no `window`, so setting state threw, and
   * the unhandled error failed a run whose every test had passed. Reproduced as it happened, as
   * `tenant-config-cache.spec.tsx` does: the page unmounted, `window` taken away, and only then the answer.
   */
  for (const outcome of ['answered', 'refused'] as const) {
    it(`is dropped when ${outcome}, and touches nothing`, async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const fetchMock = vi.fn(async (url: string) => {
        await gate;
        return outcome === 'answered'
          ? { ok: true, status: 200, json: async () => (url.includes('/members/tree') ? OFFICE : [admin()]) }
          : { ok: false, status: 500, json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } }) };
      });
      vi.stubGlobal('fetch', fetchMock);
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        const { unmount } = renderWithSession(<AdminsPage />, { me: OWNER });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        unmount();
        vi.stubGlobal('window', undefined);
        release();
        for (let tick = 0; tick < 3; tick += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
      } finally {
        vi.unstubAllGlobals();
        process.off('unhandledRejection', unhandled);
      }
      expect(unhandled).not.toHaveBeenCalled();
    });
  }
});

/**
 * **Who *Grant admin access to* offers** (P18.97-T4 AC-5, ADR-0176 §5; the client's KPM Owner review of 2026-10-27,
 * UI-026: the list offered *Wilson Tanoto (yourself)* and *Yanti Kusuma (removed)*). Only the office's active members
 * other than the reader and its admins: the tree holds the active memberships, so a removed one is never offered and
 * Yanti, who came back, is offered once — by the membership she holds now. The server's refusals are
 * `directory-admins.int.spec.ts`'s (backend).
 */
describe('P18.97-T4 AC-5 the grant offers only active members other than the reader and the admins', () => {
  afterEach(() => vi.unstubAllGlobals());

  const YANTI_BACK = node({ membershipId: 'mem-yanti-2', fullName: 'Yanti Kusuma' });
  const WITH_YANTI = { ...OFFICE, nodes: [...OFFICE.nodes, YANTI_BACK] };

  function openWith(office = WITH_YANTI) {
    const stub = stubFetch({ '/members/admins': { body: [admin()] }, '/members/tree': { body: office } });
    renderInLayout(TenantLayout, <AdminsPage />, { me: OWNER });
    return stub;
  }

  it('P18.97-T4 AC-5 never offers the reader, nor anybody who already administers the office', async () => {
    openWith();
    await screen.findByRole('table');
    const picker = screen.getByLabelText('Grant admin access to');
    const offered = within(picker).getAllByRole('option').map((o) => o.textContent);
    expect(offered).toEqual(['Choose somebody', 'Agus Prasetyo', 'Yanti Kusuma']);
    expect(offered).not.toContain('Wilson Tanoto');
    expect(offered).not.toContain('Maya Halim');
  });

  it('P18.97-T4 AC-5 offers a member who came back once, by the membership she holds now', async () => {
    const { calls } = openWith();
    await screen.findByRole('table');
    const picker = screen.getByLabelText('Grant admin access to');
    expect(within(picker).getAllByRole('option', { name: 'Yanti Kusuma' })).toHaveLength(1);
    await userEvent.selectOptions(picker, 'mem-yanti-2');
    await userEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    expect(calls.find((c) => c.init.method === 'POST')!.url).toContain('/members/mem-yanti-2/admin');
  });

  it('P18.97-T4 AC-5 offers nobody, and holds Grant access, when everybody left is the reader or an admin', async () => {
    openWith({ ...OFFICE, nodes: OFFICE.nodes.filter((n) => (n as { membershipId?: string }).membershipId !== 'mem-agus') });
    // Once the reads have answered: the picker is held while they are out as well.
    await screen.findByRole('table');
    const picker = screen.getByLabelText('Grant admin access to');
    expect(picker).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Grant access' })).toBeDisabled();
  });

  it('P18.97-T4 AC-5 says the server’s refusal of a membership that is no longer active, in its words', async () => {
    stubFetch({
      '/members/admins': { body: [admin()] },
      '/members/tree': { body: WITH_YANTI },
      'POST /members/mem-yanti-2/admin': {
        status: 422,
        body: { error: { code: 'ORG_ADMIN_TARGET_NOT_ACTIVE', message: 'They have not joined the office yet.', requestId: 'r-9' } },
      },
    });
    renderInLayout(TenantLayout, <AdminsPage />, { me: OWNER });
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Grant admin access to'), 'mem-yanti-2');
    await userEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('They have not joined the office yet.');
    // A server's answer keeps its code and request id, which support asks for (P18.97-T4 AC-10).
    expect(alert).toHaveTextContent('ORG_ADMIN_TARGET_NOT_ACTIVE · r-9');
  });

  it('P18.97-T4 AC-5 explains admin access in the client’s one line, and no paragraph', async () => {
    openWith();
    await screen.findByRole('table');
    const line = screen.getByText('Admins can do everything except manage admins.');
    expect(line.textContent!.split(/\s+/)).toHaveLength(7);
    expect(screen.queryByText(/not.*a hierarchy role/)).toBeNull();
  });
});

/**
 * **The admins as cards on a phone** (P18.97-T7 AC-1, ADR-0178 §4; the client's KPM Owner review of 2026-10-27,
 * UI-034: *Manage KPM Admins*, 425px). Below 768px a card per admin, each label above its value, through the shared
 * card pieces (`components/ui/row-cards.tsx`); at 768px and wider the table it was, to the byte.
 */
describe('P18.97-T7 AC-1 the admins as cards on a phone (UI-034)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ADMINS = [
    admin({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', agentCode: 'KPM0417-001', grantedAt: null, grantedByName: null, canRevoke: false }),
    admin(),
    admin({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', agentCode: 'KPM0417-003', role: 'aab', grantedAt: '2026-03-02T00:00:00.000Z' }),
  ];

  /** The list's markup on the build before P18.97-T7, rendered from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<768 | 1280, string> = {
    768: 'be6564ecfa9e8fbaa938514a8ef656ada7add7938b19c3a2a8999850b480f785',
    1280: 'be6564ecfa9e8fbaa938514a8ef656ada7add7938b19c3a2a8999850b480f785',
  };

  it.each([768, 1280] as const)('P18.97-T7 AC-1 at %ipx draws the table it drew, to the byte', async (px) => {
    atWidth(px);
    open(ADMINS);
    const table = await screen.findByRole('table', { name: 'KPM Admins' });
    expect(digestAt(table.parentElement!, px)).toBe(BEFORE_T7[px]);
  });
  /** An admin's card, by the name on its first line (the name also stands under *Granted by* on others). */
  const cardOf = (name: string) => screen.getAllByRole('listitem')
    .find((li) => li.querySelector('p > span')?.textContent === name)!;

  it.each([375, 767])('P18.97-T7 AC-1 at %ipx draws a card per admin and no table, each value under its heading', async (px) => {
    atWidth(px);
    open(ADMINS);
    const list = await screen.findByRole('list', { name: 'KPM Admins' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    const maya = cardOf('Maya Halim');
    expect(within(maya).getByTitle('AB')).toBeInTheDocument();
    expect(maya).toHaveTextContent('KPM0417-002');
    expect([...maya.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Admin since', 'Granted by']);
    expect(maya).toHaveTextContent('Admin sinceJan 2026');
    expect(maya).toHaveTextContent('Granted byWilson Tanoto');
    expect(within(cardOf('Agus Prasetyo')).getByTitle('AAB')).toBeInTheDocument();
    // The Owner's own access is not a grant: nothing to revoke, and no — written for a grant there is not.
    const wilson = cardOf('Wilson Tanoto');
    expect(within(wilson).getByText('Yours')).toBeInTheDocument();
    expect(within(wilson).queryByRole('button')).not.toBeInTheDocument();
    expect(wilson.querySelector('dl')).toBeNull();
  });

  it('P18.97-T7 AC-1 revokes from the card after asking, its button across the card and 44px tall on a phone', async () => {
    atWidth(375);
    const { calls } = open(ADMINS, { 'DELETE /members/mem-admin/admin': { body: [ADMINS[0], ADMINS[2]] } });
    await screen.findByRole('list', { name: 'KPM Admins' });
    const revoke = within(cardOf('Maya Halim')).getByRole('button', { name: 'Revoke Maya Halim’s admin access'.replace('’', "'") });
    expect(wears(revoke, 375).split(' ')).toEqual(expect.arrayContaining(['w-full', 'h-11']));
    await userEvent.click(revoke);
    expect(screen.getByRole('heading', { name: 'Take Maya Halim’s admin access away?'.replace('’', "'") })).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Revoke access' }));
    expect(calls.find((c) => c.init.method === 'DELETE')!.url).toContain('/members/mem-admin/admin');
  });
});
