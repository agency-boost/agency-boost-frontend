import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '../../test/harness';
import {
  api,
  ApiRequestError,
  getAccessToken,
  isImpersonating,
  setAccessToken,
  setImpersonating,
  tryRefresh,
} from './api-client';

describe('api client', () => {
  beforeEach(() => {
    setAccessToken(null);
    setImpersonating(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the access token in memory and never in storage', async () => {
    setAccessToken('tok');
    expect(getAccessToken()).toBe('tok');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain('tok');
  });

  it('sends the bearer token and the refresh cookie', async () => {
    setAccessToken('tok');
    const { calls } = stubFetch({ '/widgets': { body: { ok: true } } });
    await api('/widgets');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(calls[0].init.credentials).toBe('include');
    expect(calls[0].url).toBe('http://api.test/api/v1/widgets');
  });

  it('refreshes once and replays the request on a 401', async () => {
    setAccessToken('stale');
    const { calls } = stubFetch({
      '/widgets': [{ status: 401, body: {} }, { body: { ok: true } }],
      '/auth/refresh': { body: { accessToken: 'fresh' } },
    });

    await expect(api('/widgets')).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.url.split('/api/v1')[1])).toEqual([
      '/widgets',
      '/auth/refresh',
      '/widgets',
    ]);
    expect(getAccessToken()).toBe('fresh');
  });

  it('does not recurse when the refresh itself is refused', async () => {
    const { calls } = stubFetch({
      '/widgets': { status: 401, body: {} },
      '/auth/refresh': { status: 401, body: {} },
    });

    await expect(api('/widgets')).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(1);
  });

  it('refuses to refresh while impersonating, so a request is never replayed as the Super Admin', async () => {
    // The refresh cookie still belongs to the real Super Admin. Replaying here would
    // attribute the action to the wrong person — the precise thing impersonation exists
    // to get right.
    setAccessToken('imp');
    setImpersonating(true);
    const { calls } = stubFetch({ '/widgets': { status: 401, body: {} } });

    await expect(api('/widgets')).rejects.toMatchObject({ status: 401 });
    expect(isImpersonating()).toBe(true);
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);
  });

  it('surfaces the server error envelope, request id included', async () => {
    stubFetch({
      '/widgets': {
        status: 409,
        body: { error: { code: 'TENANT_CODE_TAKEN', message: 'taken', requestId: 'req-7' } },
      },
    });

    await expect(api('/widgets')).rejects.toMatchObject({
      status: 409,
      error: { code: 'TENANT_CODE_TAKEN', requestId: 'req-7' },
    });
  });

  it('falls back to a generic error when the body is not the envelope', async () => {
    stubFetch({ '/widgets': { status: 502, body: null } });
    await expect(api('/widgets')).rejects.toMatchObject({
      error: { code: 'INTERNAL_ERROR', requestId: 'unknown' },
    });
  });

  it('returns undefined for 204 rather than trying to parse a body', async () => {
    stubFetch({ '/widgets': { status: 204, body: undefined } });
    await expect(api('/widgets')).resolves.toBeUndefined();
  });

  it('treats a network failure during refresh as "not refreshed", not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(tryRefresh()).resolves.toBe(false);
  });
});
