import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm:read_profile', 'data_upload:read'],
});

const ADMIN = makeMe({
  membership: {
    membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: true, directCount: 0,
  },
  permissions: ['member:read_profile', 'kpm:read_profile', 'data_upload:read'],
});

/** The page's own region: the nav holds *Upcoming* pills and an *All members* link of its own. */
const main = () => screen.getByRole('main');

/**
 * The office overview is a sign until it is built (P10.1-T2, the client's request of 2026-10-01).
 *
 * The prototype's overview is five sections (`KPM_Owner.html:937-1222`) and none is built. The page
 * used to wrap a placeholder around two cards the prototype lacks; now it is the placeholder and
 * nothing else, so these tests pin what a sign must be: upcoming, numberless, data-free, and a
 * signpost to what works.
 */
describe('office overview', () => {
  // The layout reads the office's configuration and the unread count; neither has a stub, so both
  // fail quietly, as they would offline, and nothing reaches a network.
  beforeEach(() => { stubFetch({}); });
  afterEach(() => vi.unstubAllGlobals());

  it('is titled as the prototype titles it, with no sub-line it would have to fetch', () => {
    // `KPM_Owner.html:932`. The prototype's sub-line is the office's name, which a sign may not read.
    renderWithSession(<KpmOverviewPage />, { me: OWNER });

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(/^KPM Overview$/);
    expect(title.nextElementSibling).toBeNull();
  });

  it('says it is upcoming, and names no phase', () => {
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });

    expect(within(main()).getByText('Upcoming')).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/phase/i);
  });

  it('shows no figure at all, so nothing on it reads as the office’s', () => {
    // A tile with a plausible number and nothing behind it is worse than an empty screen, because a
    // reader acts on it. A digit anywhere on the page is either a phase or a fabricated figure.
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });

    expect(main().textContent).not.toMatch(/\d/);
    expect(within(main()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('says what will be here: the prototype’s five sections, in the reader’s words', () => {
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });

    const what = within(main()).getByText(/^Team composition/);
    for (const section of [
      /Team composition/, /engagement/, /coaching coverage/,
      /the recruitment pipeline/, /this year’s production/,
    ]) expect(what.textContent).toMatch(section);
    // The region is named by the pill and that sentence, so a landmark list announces the state first.
    expect(within(main()).getByRole('region', {
      name: 'Upcoming Team composition, engagement, coaching coverage, the recruitment pipeline and this year’s production for the whole office, on one screen.',
    })).toBe(what.closest('section'));
  });

  it('asks the API for nothing, and shows none of the cards the prototype lacks', () => {
    // Rendered without the layout, whose config and unread-count reads are its own: whatever is
    // called here, the page called.
    const { calls } = stubFetch({});
    renderWithSession(<KpmOverviewPage />, { me: OWNER });

    expect(calls).toEqual([]);
    expect(screen.queryByText('Seeded configuration')).not.toBeInTheDocument();
    expect(screen.queryByText('Time zone')).not.toBeInTheDocument();
  });

  it.each([
    ['an Owner', OWNER],
    ['an Admin', ADMIN],
  ])('sends %s on to the screens that work today, rather than being a dead end', (_who, me) => {
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me });

    const page = within(main());
    expect(page.getByRole('link', { name: 'All members' })).toHaveAttribute('href', '/people/members');
    expect(page.getByRole('link', { name: 'Data upload' })).toHaveAttribute('href', '/kpm/data-upload');
    expect(page.getByRole('link', { name: 'Branch info' }))
      .toHaveAttribute('href', '/kpm/settings/branch-info');
  });

  it('never renders for somebody without the permission', () => {
    renderInLayout(TenantLayout, <KpmOverviewPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('member:read_profile');
  });
});
