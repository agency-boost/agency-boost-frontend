import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiConfigError, apiOrigin, apiUrl, healthUrl, DEFAULT_API_VERSION } from './api';

const ORIGINAL = process.env.NEXT_PUBLIC_API_ORIGIN;

describe('API URLs', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_ORIGIN = 'http://localhost:3001';
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_ORIGIN = ORIGINAL;
  });

  it('composes the version from code, not configuration', () => {
    expect(apiUrl('/leads')).toBe('http://localhost:3001/api/v1/leads');
    expect(DEFAULT_API_VERSION).toBe('v1');
  });

  it('accepts a path with or without a leading slash', () => {
    expect(apiUrl('leads')).toBe(apiUrl('/leads'));
  });

  it('lets one build call two versions side by side — the reason the version is not in env', () => {
    // When v2 exists, a migrated call site passes it explicitly and the rest keep working.
    const v1 = apiUrl('/leads', 'v1');
    const v2 = apiUrl('/leads', 'v2' as never);
    expect(v1).toBe('http://localhost:3001/api/v1/leads');
    expect(v2).toBe('http://localhost:3001/api/v2/leads');
    expect(new URL(v1).origin).toBe(new URL(v2).origin);
  });

  it('serves health without a version, so a probe never tracks the contract', () => {
    expect(healthUrl()).toBe('http://localhost:3001/api/health');
  });

  it('tolerates a trailing slash on the origin', () => {
    process.env.NEXT_PUBLIC_API_ORIGIN = 'https://api.agencyboost.app/';
    expect(apiUrl('/leads')).toBe('https://api.agencyboost.app/api/v1/leads');
  });

  describe('guards against the misconfiguration this design exists to prevent', () => {
    it('rejects an origin that already carries the version', () => {
      process.env.NEXT_PUBLIC_API_ORIGIN = 'http://localhost:3001/api/v1';
      expect(() => apiOrigin()).toThrow(/must not include the API path or version/);
    });

    it('rejects an origin that carries the api path without a version', () => {
      process.env.NEXT_PUBLIC_API_ORIGIN = 'http://localhost:3001/api';
      expect(() => apiOrigin()).toThrow(/must not include the API path or version/);
    });

    it('fails loudly when unset rather than building a URL against undefined', () => {
      delete process.env.NEXT_PUBLIC_API_ORIGIN;
      expect(() => apiUrl('/leads')).toThrow(/NEXT_PUBLIC_API_ORIGIN is not set/);
    });

    it('throws a config error, not a bare one, so a screen can tell it from a dead server', () => {
      // This is the whole point of the distinct type. A renamed variable once surfaced
      // as "could not reach the server", sending a developer to debug a backend that
      // was running perfectly.
      delete process.env.NEXT_PUBLIC_API_ORIGIN;
      try {
        apiOrigin();
        throw new Error('expected apiOrigin to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiConfigError);
        expect((err as ApiConfigError).variable).toBe('NEXT_PUBLIC_API_ORIGIN');
      }
    });

    it('says a restart is needed, because Next inlines NEXT_PUBLIC_* at build time', () => {
      delete process.env.NEXT_PUBLIC_API_ORIGIN;
      expect(() => apiOrigin()).toThrow(/restart the dev server/);
    });

    it('tags a malformed origin as configuration too', () => {
      process.env.NEXT_PUBLIC_API_ORIGIN = 'http://localhost:3001/api/v1';
      expect(() => apiOrigin()).toThrow(ApiConfigError);
    });
  });
});
