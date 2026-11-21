import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentSystemName, DEFAULT_SYSTEM_NAME, messagesInName, setSystemName, withName } from './system-name';
import { kept } from './kept';

/**
 * ***Nama sistem* in the messages** (P19.21-T4 AC-1; ADR-0274): the store the session sets, and the rewrite every message
 * `useMessages` resolves goes through — strings, a message function's string, nested trees and arrays — made once per
 * tree and name.
 */
describe('P19.21-T4 AC-1 the system name store and rewrite', () => {
  afterEach(() => setSystemName(null));

  it('P19.21-T4 AC-1 keeps a name trimmed; nothing, blank or the default itself is AgencyBoost (null)', () => {
    expect(DEFAULT_SYSTEM_NAME).toBe('AgencyBoost');
    setSystemName('  Dynamic Smart System ');
    expect(currentSystemName()).toBe('Dynamic Smart System');
    setSystemName('   ');
    expect(currentSystemName()).toBeNull();
    setSystemName('AgencyBoost');
    expect(currentSystemName()).toBeNull();
    setSystemName(undefined);
    expect(currentSystemName()).toBeNull();
  });

  it('P19.21-T4 AC-1 writes every AgencyBoost as the name, and nothing else', () => {
    expect(withName('Selamat datang di AgencyBoost · AgencyBoost', 'DSS')).toBe('Selamat datang di DSS · DSS');
    expect(withName('agencyboost.id', 'DSS')).toBe('agencyboost.id');
    expect(withName('AgencyBoost', null)).toBe('AgencyBoost');
  });

  it('P19.21-T4 AC-1 rewrites strings, kept terms, nested trees, arrays and a function’s string result', () => {
    const tree = {
      title: 'Masuk ke AgencyBoost',
      term: kept('AgencyBoost'),
      nested: { deeper: { line: 'AgencyBoost membantu Anda' } },
      list: ['AgencyBoost', 'lain'],
      count: 3,
      greet: (o: { name: string }) => `Halo ${o.name}, ini AgencyBoost`,
    };
    const out = messagesInName(tree, 'Dynamic Smart System');
    expect(out.title).toBe('Masuk ke Dynamic Smart System');
    expect(out.term).toBe('Dynamic Smart System');
    expect(out.nested.deeper.line).toBe('Dynamic Smart System membantu Anda');
    expect(out.list).toEqual(['Dynamic Smart System', 'lain']);
    expect(out.count).toBe(3);
    expect(out.greet({ name: 'Rina' })).toBe('Halo Rina, ini Dynamic Smart System');
    // The area's own messages are untouched.
    expect(tree.title).toBe('Masuk ke AgencyBoost');
  });

  it('P19.21-T4 AC-1 leaves a function’s non-string result, and a React element, as they are', () => {
    const element = { $$typeof: Symbol.for('react.element'), props: { children: 'AgencyBoost' } };
    const tree = { node: () => element, el: element };
    const out = messagesInName(tree, 'DSS');
    expect(out.node()).toBe(element);
    expect(out.el).toBe(element);
  });

  it('P19.21-T4 AC-1 without a name returns the tree itself; with one, the same copy every time, one per name', () => {
    const tree = { a: 'AgencyBoost', f: vi.fn(() => 'AgencyBoost') };
    expect(messagesInName(tree, null)).toBe(tree);
    const first = messagesInName(tree, 'DSS');
    expect(messagesInName(tree, 'DSS')).toBe(first);
    const other = messagesInName(tree, 'Gading');
    expect(other).not.toBe(first);
    expect(other.a).toBe('Gading');
    expect(messagesInName('a string' as unknown as object, 'DSS')).toBe('a string');
  });
});
