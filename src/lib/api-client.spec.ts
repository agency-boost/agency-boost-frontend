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

  it('sends a form as it is, and leaves the Content-Type to the browser', async () => {
    const { calls } = stubFetch({ '/uploads': { body: { ok: true } } });
    const form = new FormData();
    form.append('file', new File(['a,b'], 'x.csv', { type: 'text/csv' }));
    await api('/uploads', { method: 'POST', body: form });

    expect(calls[0].init.body).toBe(form);
    // A header set here would carry no multipart boundary, and the server could not read the form.
    expect(calls[0].init.headers).not.toHaveProperty('Content-Type');
  });

  it('sends anything else as JSON', async () => {
    const { calls } = stubFetch({ '/widgets': { body: { ok: true } } });
    await api('/widgets', { method: 'POST', body: { a: 1 } });
    expect(calls[0].init.body).toBe('{"a":1}');
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
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

  describe('one refresh, however many 401s (P11-T6 AC-13)', () => {
    /*
     * The server rotates the refresh token on every use and revokes the whole family when a used one
     * comes back (`auth.service.ts`), so two refreshes racing on one cookie can sign the reader out.
     */
    it('P11-T6 AC-13 shares one refresh between concurrent 401s, and replays each request', async () => {
      const { calls } = stubFetch({
        '/widgets': [{ status: 401, body: {} }, { body: { which: 'widgets' } }],
        '/gadgets': [{ status: 401, body: {} }, { body: { which: 'gadgets' } }],
        '/auth/refresh': { body: { accessToken: 'fresh' } },
      });

      await expect(Promise.all([api('/widgets'), api('/gadgets')])).resolves.toEqual([
        { which: 'widgets' },
        { which: 'gadgets' },
      ]);
      expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(1);
      // Both replays carry the token the one refresh brought.
      const replays = calls.slice(-2).map((c) => (c.init.headers as Record<string, string>).Authorization);
      expect(replays).toEqual(['Bearer fresh', 'Bearer fresh']);
    });

    it('P11-T6 AC-13 makes a refresh asked for while one is out wait on it', async () => {
      // The session's own refresh on a hard load, and a 401 arriving beside it.
      const { calls } = stubFetch({ '/auth/refresh': { body: { accessToken: 'fresh' } } });
      const [a, b] = await Promise.all([tryRefresh(), tryRefresh()]);
      expect([a, b]).toEqual([true, true]);
      expect(calls).toHaveLength(1);
    });

    it('P11-T6 AC-13 refreshes again once the shared one has settled', async () => {
      // Sharing is for the one in flight, not a memo: a token that expires later needs a new refresh.
      const { calls } = stubFetch({ '/auth/refresh': { body: { accessToken: 'fresh' } } });
      await tryRefresh();
      await tryRefresh();
      expect(calls).toHaveLength(2);
    });

    it('P11-T6 AC-13 shares a refused refresh too, and both requests then fail', async () => {
      const { calls } = stubFetch({
        '/widgets': { status: 401, body: {} },
        '/gadgets': { status: 401, body: {} },
        '/auth/refresh': { status: 401, body: {} },
      });
      const results = await Promise.allSettled([api('/widgets'), api('/gadgets')]);
      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
      expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(1);
    });

    it('P11-T6 AC-13 replays with a token replaced while the request was out, without refreshing again', async () => {
      setAccessToken('old');
      const calls: { url: string; auth: string | undefined }[] = [];
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        const auth = (init.headers as Record<string, string>).Authorization;
        calls.push({ url, auth });
        // A refresh elsewhere lands while this request is out; the server refuses the old token.
        if (auth === 'Bearer old') {
          setAccessToken('new');
          return { ok: false, status: 401, json: async () => ({}) } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }));

      await expect(api('/widgets')).resolves.toEqual({ ok: true });
      expect(calls.map((c) => c.auth)).toEqual(['Bearer old', 'Bearer new']);
      expect(calls.some((c) => c.url.includes('/auth/refresh'))).toBe(false);
    });
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

    it('reports a request that never arrived as a network failure', () => {
      for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch', 'Load failed', 'fetch failed']) {
        const shown = toDisplayError(new TypeError(message));
        expect(shown.code).toBe('NETWORK');
        expect(shown.message).toMatch(/Check your connection/);
      }
    });

    /*
     * A bug in a screen used to arrive here and be reported as *"Could not reach the server"*,
     * which sent an office's Owner to check their connection over a null dereference on the page.
     */
    it('reports a broken screen as a broken screen, not as a network failure', () => {
      const broken = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const shown = toDisplayError(new TypeError("Cannot read properties of null (reading 'aspects')"));

      expect(shown.code).toBe('UNEXPECTED');
      expect(shown.message).not.toMatch(/connection/i);
      expect(shown.message).toMatch(/Reload the page/);
      // The stack goes where somebody can act on it, and not to the reader.
      expect(broken).toHaveBeenCalled();
      broken.mockRestore();
    });
  });
});
