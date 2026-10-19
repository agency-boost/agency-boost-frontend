import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import ActivityIndex from './page';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/activity',
}));

/**
 * `/activity` hands off to the log and nothing else (P10.1-T2 AC-8). The registry promised the
 * redirect in Phase 6; the route answered 404 until 2026-10-01.
 */
describe('/activity', () => {
  afterEach(() => {
    replace.mockClear();
    push.mockClear();
  });

  it('hands off to /activity/log, replacing itself in the history', () => {
    // `replace`, not `push`: Back from the log must not land on a page whose only act is to leave.
    renderWithSession(<ActivityIndex />, { me: makeMe() });
    expect(replace).toHaveBeenCalledWith('/activity/log');
    expect(push).not.toHaveBeenCalled();
  });

  it('renders no content of its own while it goes', () => {
    // Two screens claiming to be the log would mean the one you saw depended on how fast the
    // redirect ran. The status sentence is the only thing a screen reader is told, so it is pinned.
    renderWithSession(<ActivityIndex />, { me: makeMe() });
    expect(screen.getByRole('status')).toHaveTextContent('Taking you to Log Activity');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
