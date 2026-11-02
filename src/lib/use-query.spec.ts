import { describe, expect, it } from 'vitest';
import { queryOf } from './use-query';

describe('queryOf', () => {
  it('reads a name given once as its string, as the searchParams prop did', () => {
    expect({ ...queryOf(new URLSearchParams('view=month&date=2026-10-27')) }).toEqual({ view: 'month', date: '2026-10-27' });
  });

  it('reads a name the address repeats as its values in order, so a parser that wants one value refuses it', () => {
    expect({ ...queryOf(new URLSearchParams('view=week&view=month&with=mem-1')) }).toEqual({ view: ['week', 'month'], with: 'mem-1' });
    expect({ ...queryOf(new URLSearchParams('a=1&a=2&a=3')) }).toEqual({ a: ['1', '2', '3'] });
  });

  it('decodes values and keeps an empty one empty', () => {
    expect({ ...queryOf(new URLSearchParams('motivation=a%2Cb&session=')) }).toEqual({ motivation: 'a,b', session: '' });
  });

  it('is no query at all with no router mounted', () => {
    expect({ ...queryOf(null) }).toEqual({});
  });

  it('reads a name that is also an object property as a name like any other', () => {
    const query = queryOf(new URLSearchParams('constructor=x&toString=y'));
    expect(query.constructor).toBe('x');
    expect(query.toString).toBe('y');
    expect(queryOf(new URLSearchParams('')).constructor).toBeUndefined();
  });
});
