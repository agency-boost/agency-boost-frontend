import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { CORE_LEADER_LABEL, profileLine } from './profile-line';
import type { Me } from './session';

const membership = (over: Partial<NonNullable<Me['membership']>> = {}): NonNullable<Me['membership']> => ({
  ...makeMe().membership!, ...over,
});

describe('profileLine (P18.8-T6 AC-2, ADR-0159 §5)', () => {
  it('the role, Core Leader, the groups comma-joined, and the office as code · branch, in that order', () => {
    expect(profileLine('AB', membership({
      isCoreLeader: true, groups: ['Mentoring Circle', 'Top Producers 2026'], office: { code: '0417', branch: 'Cempaka Putih' },
    }))).toBe('AB · Core Leader · Mentoring Circle, Top Producers 2026 · 0417 · Cempaka Putih');
  });

  it('leaves out what does not apply: no tag, no group', () => {
    expect(profileLine('KPM Owner', membership({ isCoreLeader: false, groups: [], office: { code: '0417', branch: 'Cempaka Putih' } })))
      .toBe('KPM Owner · 0417 · Cempaka Putih');
    expect(profileLine('AAB', membership({ isCoreLeader: true, office: { code: '0417', branch: 'Cempaka Putih' } })))
      .toBe(`AAB · ${CORE_LEADER_LABEL} · 0417 · Cempaka Putih`);
  });

  it('the role alone for a session that carries none of it — the platform shell, somebody in no office', () => {
    expect(profileLine('Superadmin', null)).toBe('Superadmin');
    expect(profileLine('No office yet', undefined)).toBe('No office yet');
    expect(profileLine('Agent', membership())).toBe('Agent');
  });

  it('an office with no branch is its code; a blank group name is no group', () => {
    expect(profileLine('Agent', membership({ groups: ['  '], office: { code: '0417', branch: '' } }))).toBe('Agent · 0417');
  });
});
