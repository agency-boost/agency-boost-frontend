import Link from 'next/link';
import { Button } from '@/components/ui/field';
import type { ApiError } from '@/lib/api-client';
import { canRequestApproval } from '@/lib/leader-limit-requests';

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
  error: Pick<ApiError, 'details'> & Partial<Pick<ApiError, 'code'>>,
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
  /*
   * ADR-0157: a role change or an approval past the limit may wait for AgencyBoost instead (`canRequest`), and a
   * roster row never can — its words say the way through that asks: import them as Agents, then promote them.
   */
  const next = action === 'roster'
    ? ' Import them as Agents, then promote them on their page: past the limit, that asks AgencyBoost to approve it.'
    : canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: error.details })
      ? ' Ask AgencyBoost to approve this one past the limit, or to raise it.'
      : ' AgencyBoost can raise it.';
  return { said: `${limit}${what}${counted}${next}`, platformAdvice: false };
}

export function LeaderLimitNotice({
  error,
  audience,
  action,
  onAsk,
  asking = false,
}: {
  error: Pick<ApiError, 'details'>;
  audience: 'office' | 'platform';
  action: LeaderLimitAction;
  /**
   * **Ask AgencyBoost to approve** (ADR-0157 §1): offered where the refusal says it may be asked about
   * (`details.canRequest`) and the screen can say what to ask for. The ask is the same change, waiting.
   */
  onAsk?: () => void;
  asking?: boolean;
}) {
  const { said, platformAdvice } = leaderLimitWords(error, audience, action);
  const askable = Boolean(onAsk) && audience === 'office'
    && canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: error.details });
  return (
    <div role="alert" className="rounded-md border border-alert/30 bg-alert/5 p-3">
      <p className="text-md font-semibold text-alert">{said}</p>
      {askable && (
        <Button variant="secondary" className="mt-2" disabled={asking} onClick={onAsk}>
          {asking ? 'Asking…' : 'Ask AgencyBoost to approve'}
        </Button>
      )}
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

/**
 * **Waiting for AgencyBoost's approval** (ADR-0157 §2): a request is open about this member, and nothing about
 * them changes until AgencyBoost decides. Whoever asked — or the Owner or an Admin — may withdraw it.
 * `role="status"`, so a screen reader hears it when the ask lands.
 */
export function LeaderLimitWaiting({
  what,
  onCancel,
  cancelling = false,
}: {
  /** What waits, in a few words: *Agent → Associate Agency Builder*. */
  what: string;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-base p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-md font-semibold text-navy">Waiting for AgencyBoost&apos;s approval</span>
        <span className="block text-sm text-muted">{what}</span>
      </span>
      {onCancel && (
        <Button variant="secondary" disabled={cancelling} onClick={onCancel}>
          {cancelling ? 'Cancelling…' : 'Cancel request'}
        </Button>
      )}
    </div>
  );
}
