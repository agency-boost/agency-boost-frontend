import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { confirmLink, removeLink, startLink, switchLogin } from './account-links';
import { ApiRequestError, getAccessToken, setAccessToken, setImpersonating } from './api-client';

/**
 * **P19.2-T1 AC-8 — linked logins' calls** (ADR-0199 §2, §4, §5): what each sends, that the access token a switch answers
 * lives in memory alone, and that a wrong password for a login is its route's answer — never refreshed and sent twice —
 * while an expired access token on the same route is still refreshed once.
 */
describe('P19.2-T1 AC-8 lib/account-links', () => {
  beforeEach(() => {
    setAccessToken('tok-a');
    setImpersonating(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.2-T1 AC-8 startLink posts the address and the caller’s password', async () => {
    const { calls } = stubFetch({ '/auth/links': { status: 202, body: { status: 'accepted' } } });
    await startLink('wilson@agencyboost.test', 'pw');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'wilson@agencyboost.test', currentPassword: 'pw' });
  });

  it('P19.2-T1 AC-8 switchLogin replaces the access token in memory with the other login’s, and sends no password unasked', async () => {
    const { calls } = stubFetch({ '/auth/links/switch': { body: { accessToken: 'tok-b', expiresIn: 900 } } });
    await switchLogin('u-b');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ userId: 'u-b' });
    expect(calls[0].init.credentials).toBe('include');
    expect(getAccessToken()).toBe('tok-b');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem('tok-b')).toBeNull();
  });

  it('P19.2-T1 AC-8 a wrong password is not refreshed and replayed; the token stays the caller’s', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'refreshed' } },
      '/auth/links/switch': { status: 401, body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Wrong.', requestId: 'r' } } },
    });
    await expect(switchLogin('u-b', 'nope')).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);
    expect(calls.filter((c) => c.url.includes('/auth/links/switch'))).toHaveLength(1);
    expect(getAccessToken()).toBe('tok-a');
  });

  it('P19.2-T1 AC-8 an expired access token on the same route is still refreshed once, then the switch is sent again', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'refreshed' } },
      '/auth/links/switch': [
        { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired.', requestId: 'r' } } },
        { body: { accessToken: 'tok-b', expiresIn: 900 } },
      ],
    });
    await switchLogin('u-b');
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      '/api/v1/auth/links/switch', '/api/v1/auth/refresh', '/api/v1/auth/links/switch',
    ]);
    expect(getAccessToken()).toBe('tok-b');
  });

  it('P19.2-T1 AC-8 confirmLink is public and never refreshes; removeLink deletes the link by its id', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'refreshed' } },
      '/auth/links/confirm': { status: 401, body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Wrong.', requestId: 'r' } } },
      'DELETE /auth/links/': { status: 204, body: undefined },
    });
    await expect(confirmLink('tok', 'pw')).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);
    await removeLink('link/1');
    const removed = calls.find((c) => c.init.method === 'DELETE')!;
    expect(new URL(removed.url).pathname).toBe('/api/v1/auth/links/link%2F1');
  });
});
