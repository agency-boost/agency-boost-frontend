import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { GoalCalculator } from './goal-calculator';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/goal-setting',
}));

describe('GoalCalculator, before it knows the year (P11-T7 AC-5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads nothing and waits, in the subject’s words, until its page knows which year it is', () => {
    const { calls } = stubFetch({});
    renderWithSession(<GoalCalculator period={null} subject={{ membershipId: 'mem-rina', pronoun: 'she' }} />, { me: makeMe() });

    expect(screen.getByRole('status')).toHaveTextContent('Loading her plan…');
    expect(calls).toEqual([]);
  });

  it('waits in the reader’s own words without a subject', () => {
    stubFetch({});
    renderWithSession(<GoalCalculator period={null} />, { me: makeMe() });
    expect(screen.getByRole('status')).toHaveTextContent('Loading your plan…');
  });
});
