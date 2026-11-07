import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_SHORT_LABEL_MAX } from './activity-text';

/**
 * **The mirror holds the server's value** (invariant §7): `ACTIVITY_SHORT_LABEL_MAX` re-declares the backend's
 * `ACTIVITY_TEXT.SHORT_LABEL_MAX`, so this reads that file from disk and fails the day one side moves without the other.
 */
describe('the activity short name limit mirrors the backend constant', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'activity-taxonomy.ts'), 'utf8',
  );

  it('P19.8-T4 AC-5 MOB UI-180 ACTIVITY_SHORT_LABEL_MAX is the backend ACTIVITY_TEXT.SHORT_LABEL_MAX, 20', () => {
    const block = /export const ACTIVITY_TEXT = \{([\s\S]*?)\} as const;/.exec(source)?.[1] ?? '';
    const max = /\bSHORT_LABEL_MAX:\s*(\d+)/.exec(block)?.[1];
    expect(max).toBeDefined();
    expect(ACTIVITY_SHORT_LABEL_MAX).toBe(Number(max));
    expect(ACTIVITY_SHORT_LABEL_MAX).toBe(20);
  });
});
