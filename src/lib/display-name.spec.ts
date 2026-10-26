import { describe, expect, it } from 'vitest';
import { displayName } from './display-name';

describe('displayName (P18.8-T15 AC-1, UI-005)', () => {
  it('falls back to the full name for an empty, blank or missing preferred name', () => {
    expect(displayName({ preferredName: '', fullName: 'Rina Wijaya' })).toBe('Rina Wijaya');
    expect(displayName({ preferredName: '   ', fullName: 'Rina Wijaya' })).toBe('Rina Wijaya');
    expect(displayName({ preferredName: null, fullName: 'Rina Wijaya' })).toBe('Rina Wijaya');
    expect(displayName({ fullName: 'Rina Wijaya' })).toBe('Rina Wijaya');
  });

  it('shows the preferred name when there is one, trimmed', () => {
    expect(displayName({ preferredName: 'Rina', fullName: 'Rina Wijaya' })).toBe('Rina');
    expect(displayName({ preferredName: ' Rina ', fullName: 'Rina Wijaya' })).toBe('Rina');
  });
});
