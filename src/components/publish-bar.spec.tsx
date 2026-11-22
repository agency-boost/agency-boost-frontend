import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { PublishBar } from './publish-bar';

const at = vi.hoisted(() => ({ path: '/kpm/settings/activity-types' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => at.path,
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
  afterEach(() => { vi.unstubAllGlobals(); at.path = '/kpm/settings/activity-types'; });

  it('says what agents are on while an Owner is mid-restructure', async () => {
    /*
     * The gate's whole point: an Owner archives a type, and until they rebind the ratio
     * that named it, a published copy would compute over something nobody can log. This
     * is how they know the gate is there.
     */
    render();
    expect(await screen.findByRole('status')).toHaveTextContent('Draft. Agents are still on version 3.');
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
    expect(await screen.findByText(/still on version 3/)).toBeInTheDocument();
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

/** Each setting's own bar (P19.21-T2 AC-3; ADR-0274 §5). */
describe('the publish bar, per setting (P19.21-T2)', () => {
  afterEach(() => { vi.unstubAllGlobals(); at.path = '/kpm/settings/activity-types'; });

  const perSetting = (over: Record<string, Partial<{ version: number; hasUnpublishedChanges: boolean }>> = {}) => state({
    settings: ['activity_types', 'lead_statuses', 'activation_checklist', 'training', 'capability_mapping', 'events']
      .map((setting) => ({ setting, version: 1, hasUnpublishedChanges: false, publishedAt: null, ...over[setting] })),
  });

  it.each([
    ['/kpm/settings/activity-types', 'activity_types'],
    ['/kpm/settings/ratio-benchmarks', 'activity_types'],
    ['/kpm/settings/lead-statuses', 'lead_statuses'],
    ['/kpm/settings/activation-checklist', 'activation_checklist'],
    ['/kpm/settings/training', 'training'],
    ['/kpm/settings/training/66f000000000000000000001', 'training'],
    ['/kpm/settings/capability-mapping', 'capability_mapping'],
    ['/kpm/settings/events', 'events'],
  ])('P19.21-T2 AC-3 on %s reads and publishes %s alone', async (path, setting) => {
    at.path = path;
    const { calls } = render(OWNER, perSetting({ [setting]: { version: 4, hasUnpublishedChanges: true } }));
    const bar = await screen.findByRole('status');
    expect(bar).toHaveAttribute('data-publish-bar', setting);
    expect(bar).toHaveTextContent('Draft. Agents are still on version 4.');
    await userEvent.click(screen.getByRole('button', { name: 'Publish to agents' }));
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ settings: [setting] });
  });

  it('P19.21-T2 AC-3 says nothing on a page whose setting has no changes, while another setting has some', async () => {
    at.path = '/kpm/settings/lead-statuses';
    render(OWNER, perSetting({ events: { hasUnpublishedChanges: true } }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it.each(['/kpm/settings/products', '/kpm/settings/campaigns', '/kpm/settings/branch-info', '/kpm/settings'])(
    'P19.21-T2 AC-3 draws nothing and asks nothing on %s, which is saved live', async (path) => {
      at.path = path;
      const { calls } = render(OWNER, perSetting({ activity_types: { hasUnpublishedChanges: true } }));
      await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
      expect(calls).toHaveLength(0);
    },
  );

  it('P19.21-T2 AC-3 a setting named by its page overrides the address', async () => {
    stubFetch({ '/kpm/settings/publish-state': { body: perSetting({ events: { version: 2, hasUnpublishedChanges: true } }) } });
    renderWithSession(<PublishBar setting="events" />, { me: OWNER });
    expect(await screen.findByRole('status')).toHaveAttribute('data-publish-bar', 'events');
  });

  it('P19.21-T2 AC-3 in Indonesian: "Draf. Agent masih memakai versi n." and Terbitkan ke agent', async () => {
    stubFetch({ '/kpm/settings/publish-state': { body: perSetting({ activity_types: { version: 1, hasUnpublishedChanges: true } }) } });
    renderInIndonesian(<PublishBar />, { me: OWNER });
    expect(await screen.findByRole('status')).toHaveTextContent('Draf. Agent masih memakai versi 1.');
    expect(screen.getByRole('button', { name: 'Terbitkan ke agent' })).toBeInTheDocument();
  });
});
