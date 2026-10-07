import Link from 'next/link';
import type { ApiError } from '@/lib/api-client';

/**
 * **The leader limit's refusal, in plain words** (ADR-0113 §2, P13.2-T4 AC-5).
 *
 * The API refuses a write that would take an office past its limit with `409 LEADER_LIMIT_REACHED`,
 * the maximum and the count in its details. Every screen that can meet it — a role change, an Owner
 * assignment, a roster import — says so in these words, which name the limit and say who can raise it:
 * AgencyBoost, for the office's own people; the offices list, for the Super Admin, who can. **No code
 * reaches the words**, unlike `ErrorBanner`, which prints the code beneath its message for support.
 *
 * `role="alert"`, so a screen reader is told the moment it appears, as a refusal is.
 */
export function isLeaderLimit(error: Pick<ApiError, 'code'> | null | undefined): boolean {
  return error?.code === 'LEADER_LIMIT_REACHED';
}

/** What was being done when the limit was met: it decides the second half of the sentence. */
export type LeaderLimitAction = 'role' | 'owner' | 'roster';

export function leaderLimitWords(
  error: Pick<ApiError, 'details'>,
  audience: 'office' | 'platform',
  action: LeaderLimitAction,
): { said: string; platformAdvice: boolean } {
  const max = Number((error.details as { maxLeaders?: number } | undefined)?.maxLeaders);
  const limit = Number.isFinite(max)
    ? `This office has reached its limit of ${max} ${max === 1 ? 'leader' : 'leaders'}`
    : 'This office has reached its leader limit';
  const what = action === 'owner'
    ? ', so its new Owner cannot be added as an AB.'
    : action === 'roster'
      ? ', so the ABs and AABs in this file cannot be added.'
      : ', so nobody else can be made an AB or an AAB.';
  const counted = ` Leaders are ABs and AABs together, the Owner included.`;
  if (audience === 'platform') {
    return { said: `${limit}${what}${counted}`, platformAdvice: true };
  }
  const roster = action === 'roster' ? ' Import them as Agents, or ask AgencyBoost to raise the limit.' : ' AgencyBoost can raise it.';
  return { said: `${limit}${what}${counted}${roster}`, platformAdvice: false };
}

export function LeaderLimitNotice({
  error,
  audience,
  action,
}: {
  error: Pick<ApiError, 'details'>;
  audience: 'office' | 'platform';
  action: LeaderLimitAction;
}) {
  const { said, platformAdvice } = leaderLimitWords(error, audience, action);
  return (
    <div role="alert" className="rounded-md border border-alert/30 bg-alert/5 p-3">
      <p className="text-md font-semibold text-alert">{said}</p>
      {platformAdvice && (
        <p className="mt-1 text-md text-navy">
          Raise it with <strong>Edit subscription</strong> on the{' '}
          <Link href="/admin/tenants" className="underline">offices list</Link>
          {action === 'roster' ? ' first, or import them as Agents.' : ' first, then try again.'}
        </p>
      )}
    </div>
  );
}
