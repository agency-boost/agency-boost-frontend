import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { SettingsReviewed } from './settings-reviewed';

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
  isKpmOwner: true, isKpmAdmin: false, directCount: 2, ...over,
});
const OWNER = makeMe({ membership: member() as never, permissions: ['tenant_config:read', 'tenant_config:write', 'tenant_config:mark_reviewed'] });
const ADMIN = makeMe({
  membership: member({ membershipId: 'mem-admin', isKpmOwner: false, isKpmAdmin: true, hierarchyRole: 'agent', orgLevelCode: 'AGENT' }) as never,
  permissions: ['tenant_config:read', 'tenant_config:write', 'tenant_config:mark_reviewed'],
});
const FIELD_AB = makeMe({ membership: member({ isKpmOwner: false }) as never, permissions: ['tenant_config:read'] });
/** A read-only support session as the Owner: the member's reads, no write verb (roles §3.13). */
const SUPPORT = makeMe({
  membership: member() as never, permissions: ['tenant_config:read'], isImpersonating: true, impersonationReadOnly: true,
});

const reviewed = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => /\/kpm\/settings\/[a-z-]+\/reviewed$/.test(c.url) && c.init.method === 'PUT');

/**
 * **P19.3-T2 AC-5, AC-10 — *Sudah sesuai* on a settings page** (UI-149, Overview case 0b): one tap marks the page
 * reviewed — `PUT /kpm/settings/:page/reviewed` — and nothing else of it; the Owner's and an Admin's, disabled in a
 * read-only support session, absent for anybody else.
 */
describe('P19.3-T2 Sudah sesuai on a settings page (UI-149)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([['the Owner', OWNER], ['an Admin', ADMIN]])('P19.3-T2 AC-5 AC-10 %s marks the page: one PUT, nothing else, and the button says so', async (_who, me) => {
    const { calls } = stubFetch({
      'PUT /kpm/settings/activation-checklist/reviewed': {
        body: { page: 'activation-checklist', reviewed: true, at: '2026-11-03T03:00:00.000Z', via: 'reviewed' },
      },
    });
    renderWithSession(<SettingsReviewed page="activation-checklist" />, { me });
    await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
    expect(await screen.findByRole('button', { name: 'Reviewed ✓' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Its step on the Overview is ticked. Nothing on this page changed.');
    expect(reviewed(calls).map((c) => c.url.replace(/^.*\/kpm/, '/kpm'))).toEqual(['/kpm/settings/activation-checklist/reviewed']);
    // The page's own data is not sent: no body, no other write.
    expect(reviewed(calls)[0].init.body).toBeUndefined();
    expect(calls.filter((c) => c.init.method && c.init.method !== 'GET')).toHaveLength(1);
  });

  it('P19.3-T2 AC-10 an AB holds no grant: no button', () => {
    stubFetch({});
    renderWithSession(<SettingsReviewed page="branch-info" />, { me: FIELD_AB });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('P19.3-T2 AC-10 a read-only support session sees the member’s button disabled, and sends nothing', async () => {
    const { calls } = stubFetch({});
    renderWithSession(<SettingsReviewed page="products" />, { me: SUPPORT });
    const button = screen.getByRole('button', { name: 'Mark as reviewed' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(reviewed(calls)).toHaveLength(0);
  });

  it('P19.3-T2 AC-10 a refusal says why, and the button can be pressed again', async () => {
    stubFetch({
      'PUT /kpm/settings/branch-info/reviewed': {
        status: 403, body: { error: { code: 'PERM_DENIED', message: 'You do not have permission to do that.', requestId: 'r-1' } },
      },
    });
    renderWithSession(<SettingsReviewed page="branch-info" />, { me: OWNER });
    await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to do that.');
    expect(screen.getByRole('button', { name: 'Mark as reviewed' })).toBeEnabled();
  });

  it('P19.3-T2 AC-5 in Indonesian: Sudah sesuai, then Sudah sesuai ✓', async () => {
    stubFetch({
      'PUT /kpm/settings/products/reviewed': { body: { page: 'products', reviewed: true, at: '2026-11-03T03:00:00.000Z', via: 'saved' } },
    });
    renderInIndonesian(<SettingsReviewed page="products" />, { me: OWNER });
    await userEvent.click(screen.getByRole('button', { name: 'Sudah sesuai' }));
    expect(await screen.findByRole('button', { name: 'Sudah sesuai ✓' })).toBeInTheDocument();
  });
});
