'use client';

import { useState } from 'react';
import { Boost } from '@/components/boost';
import { Page } from '@/components/page';
import { RequestInbox } from '@/components/request-inbox';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { Card } from '@/components/ui/field';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { useMessages } from '@/i18n/language-provider';
import { requestsMessages } from '@/i18n/messages/requests';
import { userManagementMessages } from '@/i18n/messages/user-management';
import { cn } from '@/lib/cn';

/**
 * Pending Requests (`Overall.html:3625-3631`).
 *
 * Two things the prototype does not do, and both matter.
 *
 * It captures no reason for a decline, so somebody is refused with no way to know why or
 * what to do instead. Here the reason is asked for and sent to them.
 *
 * And it splices the row out of an array, which leaves the person nowhere — declined and
 * un-registered at once. Here declining leaves them in the office, free to ask somebody
 * else; it is a refusal, not a removal, and the screen says so.
 *
 * Its words are the catalogue's (`user-management.ts`; P18.98-T4); the inbox's are `requests.ts`'.
 *
 * **UI V1 (2026-10-30, Phase 18.99 T9).** No sub-line below 1024px (UI-087). **Nothing waiting is a small empty state
 * with Boost thinking** (UI-089, D-11): one card under 120px — Boost, the heading and the inbox's own line, the
 * client's *Approve to add them…* from 768px only. The tab's count follows the inbox as it changes (UI-085).
 */
export default function PendingPage() {
  const t = useMessages(userManagementMessages).pending;
  const inbox = useMessages(requestsMessages).inbox;
  const [count, setCount] = useState<number | undefined>(undefined);
  return (
    <Page
      title={USER_MANAGEMENT_TITLE}
      subtitle={t.subtitle}
      subtitleOnPhone={false}
      subtitleOnTablet={false}
      permission="leader_request:read_inbox"
    >
      {/* The inbox's own count, so the tab follows an approval at once and the tab row asks nothing twice. */}
      <UserManagementTabs pendingCount={count ?? 0} />
      <Card className={cn(count === 0 && 'p-4')}>
        {count !== 0 && (
          <>
            <h2 className="font-display text-lg font-bold text-navy">{t.heading}</h2>
            {/* The client's words from 768px (P18.95-T7 AC-1, grey text row 7; UI-089: gone on a phone). */}
            <p className={cn('mt-1 text-md text-muted', REMOVED_ON_PHONE)}>{t.line}</p>
          </>
        )}
        {/* The list, and approving with the join date (P18.96-T3 AC-5): one component, the one /new-hires opens too. */}
        <RequestInbox
          onCount={setCount}
          empty={(
            <div className="flex items-center gap-4" data-testid="pending-empty">
              <Boost pose="thinking" size={72} />
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-navy max-md:text-[0.9375rem]">{t.heading}</h2>
                <p className={cn('text-md text-muted', REMOVED_ON_PHONE)}>{t.line}</p>
                <p className="mt-0.5 text-md text-muted">{inbox.empty}</p>
              </div>
            </div>
          )}
        />
      </Card>
    </Page>
  );
}
