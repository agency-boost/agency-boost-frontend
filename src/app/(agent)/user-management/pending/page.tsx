'use client';

import { Page } from '@/components/page';
import { RequestInbox } from '@/components/request-inbox';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { Card } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { userManagementMessages } from '@/i18n/messages/user-management';

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
 */
export default function PendingPage() {
  const t = useMessages(userManagementMessages).pending;
  return (
    <Page
      title={USER_MANAGEMENT_TITLE}
      subtitle={t.subtitle}
      permission="leader_request:read_inbox"
    >
      <UserManagementTabs />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{t.heading}</h2>
        {/* The client's words at every size (P18.95-T7 AC-1, grey text row 7). */}
        <p className="mt-1 text-md text-muted">{t.line}</p>
        {/* The list, and approving with the join date (P18.96-T3 AC-5): one component, the one /new-hires opens too. */}
        <RequestInbox />
      </Card>
    </Page>
  );
}
