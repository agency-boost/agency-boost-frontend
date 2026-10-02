import { describe, expect, it, vi } from 'vitest';
import { joinInFlight } from './in-flight';

/** A read the spec settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('joinInFlight (P11 final walk, F5)', () => {
  it('hands a second identical read the first one’s promise while it is out: one request', async () => {
    const out = deferred<string>();
    const read = vi.fn(() => out.promise);

    const first = joinInFlight('k-join', read);
    const second = joinInFlight('k-join', read);

    expect(second).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
    out.resolve('answer');
    await expect(second).resolves.toBe('answer');
  });

  it('sends a read made after the first has settled: it joins, it does not cache', async () => {
    const read = vi.fn(async () => 'answer');
    await joinInFlight('k-after', read);
    await joinInFlight('k-after', read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps different keys apart', async () => {
    const read = vi.fn(async () => 'answer');
    await Promise.all([joinInFlight('k-a', read), joinInFlight('k-b', read)]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('hands a failure to every reader that joined, and frees the key for the next read', async () => {
    const out = deferred<string>();
    const read = vi.fn(() => out.promise);
    const first = joinInFlight('k-fail', read);
    const second = joinInFlight('k-fail', read);

    out.reject(new Error('refused'));
    await expect(first).rejects.toThrow('refused');
    await expect(second).rejects.toThrow('refused');

    await expect(joinInFlight('k-fail', async () => 'again')).resolves.toBe('again');
  });
});
