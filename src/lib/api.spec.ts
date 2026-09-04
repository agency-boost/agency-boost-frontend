import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiOrigin, apiUrl, healthUrl, DEFAULT_API_VERSION } from './api';

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
  });
});
