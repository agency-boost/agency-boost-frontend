import { render } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeParams, stubFetch } from '@test/harness';
import CoachingPersonIndex from './page';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/coaching/mem-rina',
}));

describe('/coaching/[membershipId] (P11-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens the person on their Coaching Session tab, as the prototype’s Coaching → does, asking the API for nothing', () => {
    const { calls } = stubFetch({});
    const { getByRole } = render(
      <Suspense fallback={null}><CoachingPersonIndex params={routeParams({ membershipId: 'mem-rina' })} /></Suspense>,
    );

    expect(replace).toHaveBeenCalledWith('/coaching/mem-rina/session');
    expect(getByRole('status')).toHaveTextContent('Opening the coaching session…');
    expect(calls).toEqual([]);
  });
});
