import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import CoacheeTrainingTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/training',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['coaching_session:read'],
});

const show = () => renderWithSession(<CoacheeTrainingTab params={routeParams({ membershipId: 'mem-rina' })} />, { me: LEADER });

/**
 * P11-T7 AC-7 A sign inside the person shell (`backend-then-frontend.md`, *Placeholder screens*): the shell above
 * it is the layout's, and has already answered an address outside the reader's reach.
 */
describe('/coaching/[membershipId]/training, a sign until it is built (P11-T7 AC-7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T7 AC-7 says what will be there, with no figure, no phase and no call', () => {
    const { calls } = stubFetch({});
    const { container } = show();

    const sign = screen.getByRole('region', { name: /^Upcoming Which training this person has finished/ });
    expect(within(sign).getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/phase|mem-rina|\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i);
    expect(calls).toEqual([]);
  });

  it('P11-T7 AC-7 has no page title of its own: the person shell above has it', () => {
    stubFetch({});
    show();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('P11-T7 AC-7 links to what works for the reader on this person’s page', () => {
    stubFetch({});
    show();
    expect(screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Personal Summary', '/coaching/mem-rina/summary']]);
  });
});
