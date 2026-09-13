import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { PublishBar } from './publish-bar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activity-types',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const ADMIN_READONLY = makeMe({ membership, permissions: ['tenant_config:read'] });

const state = (over: Partial<Record<string, unknown>> = {}) => ({
  publishedVersion: 3, workingVersion: 4, hasUnpublishedChanges: true,
  publishedAt: '2026-09-10T00:00:00.000Z', ...over,
});

function render(me = OWNER, body: unknown = state()) {
  const stub = stubFetch({
    '/kpm/settings/publish-state': { body },
    '/kpm/settings/publish': { body: state({ hasUnpublishedChanges: false, publishedVersion: 4 }) },
  });
  renderWithSession(<PublishBar />, { me });
  return stub;
}

describe('the publish bar (P4-T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says what agents are on while an Owner is mid-restructure', async () => {
    /*
     * The gate's whole point: an Owner archives a type, and until they rebind the ratio
     * that named it, a published copy would compute over something nobody can log. This
     * is how they know the gate is there.
     */
    render();
    expect(await screen.findByText(/not seeing these changes yet/)).toBeInTheDocument();
    expect(screen.getByText(/on version 3/)).toBeInTheDocument();
  });

  it('says so differently when nothing has ever been published', async () => {
    render(OWNER, state({ publishedVersion: 0 }));
    expect(await screen.findByText(/Nothing has been published/)).toBeInTheDocument();
  });

  it('says nothing at all when there is nothing to say', async () => {
    // A permanent "everything is published" banner is chrome an Owner learns to stop
    // reading, and then misses the one time it matters.
    render(OWNER, state({ hasUnpublishedChanges: false }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('publishes, and stops showing itself', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Publish to agents' }));

    expect(calls.some((c) => c.url.includes('/kpm/settings/publish') && c.init.method === 'POST'))
      .toBe(true);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('tells somebody who cannot publish what is happening, without the button', async () => {
    // Read is wide and write is narrow. Hiding the whole bar would leave them wondering
    // why an Owner's screen and theirs disagree.
    render(ADMIN_READONLY);
    expect(await screen.findByText(/not seeing these changes yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish to agents' })).toBeNull();
  });

  it('says so when it cannot read the publish state, instead of vanishing', async () => {
    /*
     * `!state?.hasUnpublishedChanges` is true both when there is nothing to publish and
     * when the read failed — `state` stays null on a failure — so the component returned
     * `null` and the error it had just set was never rendered. An Owner whose publish
     * state could not be read saw a screen that looked entirely normal.
     */
    stubFetch({
      '/kpm/settings/publish-state': {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } },
      },
    });
    renderWithSession(<PublishBar />, { me: OWNER });

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Could not check what your agents are seeing');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
