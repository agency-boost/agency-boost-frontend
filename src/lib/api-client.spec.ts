import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { ApiConfigError } from './api';
import {
  api,
  ApiRequestError,
  getAccessToken,
  isImpersonating,
  setAccessToken,
  setImpersonating,
  toDisplayError,
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

  it('lets a misconfigured origin out of the refresh path instead of swallowing it', async () => {
    // "Not refreshed" is right for a network failure. For a missing environment
    // variable it would render a signed-out shell on every screen and never say why.
    const original = process.env.NEXT_PUBLIC_API_ORIGIN;
    delete process.env.NEXT_PUBLIC_API_ORIGIN;
    try {
      await expect(tryRefresh()).rejects.toBeInstanceOf(ApiConfigError);
    } finally {
      process.env.NEXT_PUBLIC_API_ORIGIN = original;
    }
  });

  describe('toDisplayError keeps three outcomes apart', () => {
    it('passes a server envelope through unchanged', () => {
      const error = { code: 'PERM_DENIED', message: 'No.', requestId: 'req-1' };
      expect(toDisplayError(new ApiRequestError(403, error))).toEqual(error);
    });

    it('reports a misconfiguration as configuration, naming what to fix', () => {
      const shown = toDisplayError(
        new ApiConfigError('NEXT_PUBLIC_API_ORIGIN is not set.', 'NEXT_PUBLIC_API_ORIGIN'),
      );
      expect(shown.code).toBe('CONFIG');
      expect(shown.message).toContain('NEXT_PUBLIC_API_ORIGIN');
      // Never the network message — that is what sent people to the wrong place.
      expect(shown.message).not.toMatch(/could not reach/i);
    });

    it('reports anything else as a network failure, and says to check the API', () => {
      const shown = toDisplayError(new TypeError('Failed to fetch'));
      expect(shown.code).toBe('NETWORK');
      expect(shown.message).toMatch(/Check your connection/);
    });
  });
});
