import { describe, expect, it } from 'vitest';
import { toDisplayError } from './api-client';
import { ApiConfigError } from './api';
import { BROWSER_DETECTED_CODES, errorReference, isBrowserDetected } from './browser-errors';

/**
 * **Which failures show a code** (P18.97-T4 AC-10, ADR-0176 §10; UI-032): a server's answer its code and request id,
 * a failure the browser detected none.
 */
describe('P18.97-T4 AC-10 browser-detected failures', () => {
  it('P18.97-T4 AC-10 names the codes toDisplayError makes without a server, and the unreadable roster file', () => {
    expect(BROWSER_DETECTED_CODES).toEqual(['NETWORK', 'UNEXPECTED', 'CONFIG', 'FILE_UNREADABLE']);
    // Each is what `toDisplayError` answers for a failure no server answered, with no request id.
    const made = [
      toDisplayError(new TypeError('Failed to fetch')),
      toDisplayError(new ApiConfigError('NEXT_PUBLIC_API_ORIGIN is not set.', 'NEXT_PUBLIC_API_ORIGIN')),
    ];
    expect(made.map((e) => [e.code, e.requestId])).toEqual([['NETWORK', 'unknown'], ['CONFIG', 'unknown']]);
    for (const error of made) expect(isBrowserDetected(error.code)).toBe(true);
  });

  it('P18.97-T4 AC-10 gives a browser-detected failure no reference, whatever id it carries', () => {
    for (const code of BROWSER_DETECTED_CODES) {
      expect(errorReference({ code, requestId: 'unknown' })).toBeNull();
      expect(errorReference({ code, requestId: 'local' })).toBeNull();
      expect(errorReference({ code })).toBeNull();
    }
  });

  it('P18.97-T4 AC-10 keeps a server’s code and its request id, and the code alone where it carries none', () => {
    expect(errorReference({ code: 'PERM_OWNER_ONLY', requestId: 'r-1' })).toBe('PERM_OWNER_ONLY · r-1');
    expect(errorReference({ code: 'INTERNAL_ERROR', requestId: 'unknown' })).toBe('INTERNAL_ERROR');
    expect(errorReference({ code: 'NOT_FOUND' })).toBe('NOT_FOUND');
    expect(isBrowserDetected('NOT_FOUND')).toBe(false);
  });
});
