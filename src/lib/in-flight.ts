/**
 * **One request for identical reads made while the first is still out** (P11's final browser walk, F5).
 *
 * A second call with the same key, before the first has settled, is handed the first call's promise
 * rather than sending another request. Once it settles the key is free again, so a read made after
 * it, for instance after a write, goes out afresh: this joins reads, it caches nothing.
 *
 * What it is for: an effect that React runs twice, as StrictMode does to every effect it mounts in
 * development, or a screen mounted again while its read is in flight. Where the server audits a read,
 * as it does a coaching session's read by anybody who is not its coachee, each of those would
 * otherwise write an audit entry of its own. `refreshing` in `api-client.ts` is the same idea for
 * the token refresh.
 *
 * Never for a read that must see a write made after it started: it would be handed the older answer.
 */
const held = new Map<string, Promise<unknown>>();

export function joinInFlight<T>(key: string, read: () => Promise<T>): Promise<T> {
  const out = held.get(key) as Promise<T> | undefined;
  if (out) return out;
  // Only ever set while the key is free, so what settles is what the key holds.
  const next = read().finally(() => held.delete(key));
  held.set(key, next);
  return next;
}
