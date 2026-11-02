import Link from 'next/link';
import { Button } from '@/components/ui/field';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { leaderLimitMessages } from '@/i18n/messages/leader-limit';
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
  /** The reader's language (P18.98-T4; `useLanguage()`): English, the source, when given none. */
  language: Language = SOURCE_LANGUAGE,
): { said: string; platformAdvice: boolean } {
  const read = Number((error.details as { maxLeaders?: number } | undefined)?.maxLeaders);
  const max = Number.isFinite(read) ? read : null;
  const { refused } = messagesIn(leaderLimitMessages, language);
  if (audience === 'platform') {
    return { said: refused({ max, action, next: 'platform' }), platformAdvice: true };
  }
  /*
   * ADR-0157: a role change or an approval past the limit may wait for AgencyBoost instead (`canRequest`), and a
   * roster row never can — its words say the way through that asks: import them as Agents, then promote them.
   */
  const next = action === 'roster'
    ? 'roster'
    : canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: error.details }) ? 'ask' : 'raise';
  return { said: refused({ max, action, next }), platformAdvice: false };
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
  const t = useMessages(leaderLimitMessages);
  const { said, platformAdvice } = leaderLimitWords(error, audience, action, useLanguage());
  const askable = Boolean(onAsk) && audience === 'office'
    && canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: error.details });
  return (
    <div role="alert" className="rounded-md border border-alert/30 bg-alert/5 p-3">
      <p className="text-md font-semibold text-alert">{said}</p>
      {askable && (
        <Button variant="secondary" className="mt-2" disabled={asking} onClick={onAsk}>
          {asking ? t.asking : t.ask}
        </Button>
      )}
      {platformAdvice && (
        <p className="mt-1 text-md text-navy">
          {t.platformAdvice({
            strong: (words) => <strong>{words}</strong>,
            link: (words) => <Link href="/admin/tenants" className="underline">{words}</Link>,
            roster: action === 'roster',
          })}
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
  const t = useMessages(leaderLimitMessages);
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-base p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-md font-semibold text-navy">{t.waiting}</span>
        <span className="block text-sm text-muted">{what}</span>
      </span>
      {onCancel && (
        <Button variant="secondary" disabled={cancelling} onClick={onCancel}>
          {cancelling ? t.cancelling : t.cancelRequest}
        </Button>
      )}
    </div>
  );
}
