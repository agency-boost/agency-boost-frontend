import { describe, expect, it } from 'vitest';
import { reservedRefusal } from './reserved-types';

describe('reservedRefusal (P13.2-T6 AC-3)', () => {
  it('drops the batch’s change number and op, and keeps the API’s sentence', () => {
    expect(reservedRefusal({
      code: 'ACTIVITY_TYPE_RESERVED', requestId: 'r',
      message: 'Change 3 (category.archive): Selling cannot be archived while it holds “Submission polis”.',
    })?.message).toBe('Selling cannot be archived while it holds “Submission polis”.');
  });

  it('leaves a refusal from a single route as it is, and answers null for any other code', () => {
    const plain = { code: 'ACTIVITY_TYPE_RESERVED', requestId: 'r', message: '“Submission polis” cannot be archived.' };
    expect(reservedRefusal(plain)).toEqual(plain);
    expect(reservedRefusal({ code: 'VALIDATION_FAILED', requestId: 'r', message: 'x' })).toBeNull();
  });
});
