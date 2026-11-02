import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH } from './password';

/**
 * **The mirror holds the server's value** (invariant §7): `PASSWORD_MIN_LENGTH` re-declares the backend's
 * `PASSWORD.MIN_LENGTH` (`domain/constants/password.ts`, metrics §B.30), so this reads that file from disk, as
 * `phone-number.spec.ts` reads `phone.ts`, and fails the day one side moves without the other.
 */
describe('the password minimum mirrors the backend constant', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'password.ts'), 'utf8',
  );

  it('PASSWORD_MIN_LENGTH is the backend PASSWORD.MIN_LENGTH', () => {
    const block = /export const PASSWORD = \{([\s\S]*?)\} as const;/.exec(source)?.[1] ?? '';
    const min = /\bMIN_LENGTH:\s*(\d+)/.exec(block)?.[1];
    expect(min).toBeDefined();
    expect(PASSWORD_MIN_LENGTH).toBe(Number(min));
  });

  it('is 8 characters (the product owner, 2026-11-01)', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});
