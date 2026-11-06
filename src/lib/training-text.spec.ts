import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRAINING_DESCRIPTION_MAX } from './training-text';

/**
 * **The mirror holds the server's value** (invariant §7): `TRAINING_DESCRIPTION_MAX` re-declares the backend's
 * `TRAINING_TEXT.DESCRIPTION_MAX`, so this reads that file from disk and fails the day one side moves without the other.
 */
describe('the short description limit mirrors the backend constant', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'training-taxonomy.ts'), 'utf8',
  );

  it('P19.6-T4 AC-1 TRAINING_DESCRIPTION_MAX is the backend TRAINING_TEXT.DESCRIPTION_MAX, 160', () => {
    const block = /export const TRAINING_TEXT = \{([\s\S]*?)\} as const;/.exec(source)?.[1] ?? '';
    const max = /\bDESCRIPTION_MAX:\s*(\d+)/.exec(block)?.[1];
    expect(max).toBeDefined();
    expect(TRAINING_DESCRIPTION_MAX).toBe(Number(max));
    expect(TRAINING_DESCRIPTION_MAX).toBe(160);
  });
});
