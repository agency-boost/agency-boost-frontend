'use client';

import { useEffect, useState } from 'react';
import type { KpmRequestRow } from './admin';
import { api } from './api-client';
import { LEADER_LIMIT_QUEUE_CHANGED, readLeaderLimitQueue } from './leader-limit-queue';
import type { LeaderLimitRequestRow } from './leader-limit-requests';
import { useSession } from './session';

/**
 * ***Persetujuan* — everything waiting for the Super Admin, in one list** (P19.23-T3 AC-2; the Super Admin spec of 20
 * November 2026, §8; ADR-0277). Two queues the API already keeps, read together:
 *
 * - **new KPM registrations** (`GET /admin/kpm-requests`; ADR-0191) — *Setujui* makes the office and its Owner in one
 *   press, the code made by the server where none is typed;
 * - **leaders past the plan limit** (`GET /admin/leader-limit-requests`; ADR-0157 §3).
 *
 * No other kind of request waits on the platform today; a third queue joins here when one does. Each decision answers its
 * own queue, and the page reads both again.
 */

export type ApprovalKind = 'kpm' | 'limit';

/**
 * The KPM registrations, read here rather than through `admin.ts`'s `readKpmRequests` (the same route): the shell counts
 * the waiting ones on every page (`useApprovalsPending`), and `admin.ts` is the whole console's client — kept out of the
 * shell's first load, as `leader-limit-queue.ts` keeps the leader queue's (the bundle, 2026-11-06).
 */
const readKpmQueue = () => api<KpmRequestRow[]>('/admin/kpm-requests');

/** One request of either queue, as *Persetujuan* lists it. */
export type Approval =
  | { kind: 'kpm'; id: string; status: 'pending' | 'approved' | 'declined'; requestedAt: string; decidedAt: string | null;
    decidedByName: string | null; row: KpmRequestRow }
  | { kind: 'limit'; id: string; status: LeaderLimitRequestRow['status']; requestedAt: string; decidedAt: string | null;
    decidedByName: string | null; row: LeaderLimitRequestRow };

/** Both queues as one list: waiting first, newest asked first; then decided, newest decided first. */
export function mergeApprovals(kpm: readonly KpmRequestRow[], limit: readonly LeaderLimitRequestRow[]): Approval[] {
  const all: Approval[] = [
    ...kpm.map((row): Approval => ({
      kind: 'kpm', id: row.requestId, status: row.status, requestedAt: row.requestedAt, decidedAt: row.decidedAt,
      decidedByName: row.decidedByName ?? null, row,
    })),
    ...limit.map((row): Approval => ({
      kind: 'limit', id: row.requestId, status: row.status, requestedAt: row.requestedAt, decidedAt: row.decidedAt,
      decidedByName: row.decidedByName ?? null, row,
    })),
  ];
  const waiting = all.filter((a) => a.status === 'pending').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const decided = all.filter((a) => a.status !== 'pending')
    .sort((a, b) => (b.decidedAt ?? b.requestedAt).localeCompare(a.decidedAt ?? a.requestedAt));
  return [...waiting, ...decided];
}

/** Both queues, read together. */
export async function readApprovals(): Promise<Approval[]> {
  const [kpm, limit] = await Promise.all([readKpmQueue(), readLeaderLimitQueue()]);
  return mergeApprovals(kpm, limit);
}

/** Said after *Persetujuan* decides, so the nav's count reads afresh (`useApprovalsPending`). */
export const APPROVALS_CHANGED = 'agencyboost:approvals-changed';

/**
 * **How many requests wait for the Super Admin**, for the console nav's count on *Persetujuan* (P19.23-T1 AC-1, T3
 * AC-2): pending KPM registrations and pending leaders past the limit. Read when the shell mounts, for a reader who
 * decides them, and again when either queue says it changed (`APPROVALS_CHANGED`, `LEADER_LIMIT_QUEUE_CHANGED`) — as
 * `useUnreadCount` reads the inbox, with no timer. **`0`** for anybody else, and on a failed read: a count is a
 * convenience, and an error about it would push the screen's own out of view.
 */
export function useApprovalsPending(): number {
  const { me } = useSession();
  const [pending, setPending] = useState(0);
  const permissions = me?.permissions ?? [];
  const superAdmin = me?.user.platformRole === 'super_admin' && !me.isImpersonating;
  const readsKpm = superAdmin && permissions.includes('kpm_request:read');
  const readsLimit = superAdmin && permissions.includes('leader_limit_request:read');

  useEffect(() => {
    if (!readsKpm && !readsLimit) {
      setPending(0);
      return;
    }
    let live = true;
    const read = () => {
      void Promise.all([
        readsKpm ? readKpmQueue() : Promise.resolve([] as KpmRequestRow[]),
        readsLimit ? readLeaderLimitQueue() : Promise.resolve([] as LeaderLimitRequestRow[]),
      ])
        .then(([kpm, limit]) => {
          if (live) setPending(kpm.filter((r) => r.status === 'pending').length + limit.filter((r) => r.status === 'pending').length);
        })
        .catch(() => { if (live) setPending(0); });
    };
    read();
    window.addEventListener(APPROVALS_CHANGED, read);
    window.addEventListener(LEADER_LIMIT_QUEUE_CHANGED, read);
    return () => {
      live = false;
      window.removeEventListener(APPROVALS_CHANGED, read);
      window.removeEventListener(LEADER_LIMIT_QUEUE_CHANGED, read);
    };
  }, [readsKpm, readsLimit]);

  return pending;
}
