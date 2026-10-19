'use client';

import { useEffect } from 'react';
import { INBOX_EMPTY, NotificationList } from '@/components/notification-list';
import { RoleShell } from '@/components/role-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { Pager } from '@/components/ui/pager';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { INBOX_PAGE_SIZE } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { useCanMark, useInbox } from '@/lib/use-inbox';

/**
 * Your notifications.
 *
 * **No prototype counterpart** — none of the fourteen files has a notifications surface,
 * even though `Overall.html` fires toasts. Registered as a Fill, and designed in the
 * prototype's idiom: the same shell, the same card and empty-state vocabulary.
 *
 * **`RoleShell`, not `AgentShell`.** Everybody has an inbox, so this route belongs to no
 * one role family. It rendered `AgentShell` until 2026-09-06, which dropped a Super Admin
 * or an Owner into the agent application with no way back to their own.
 *
 * ADR-0010 makes this the **authoritative channel** — *"v1 notifications will be
 * under-read, because agents live in WhatsApp… the in-app inbox, not email, is treated as
 * the authoritative channel for anything the product depends on."* So what a row says is
 * composed on the server and arrives ready to read; this screen never improvises copy
 * from a template id.
 *
 * The unread count comes back with the list rather than from a second call, so the badge
 * in the sidebar and the page can never disagree with each other.
 *
 * **The rows are the bell's** (P12.1-T3): compact, so many fit; the whole row opens — its page when
 * the server composed an address for it, its modal when not — and reads itself as it does; a toggle
 * beside each reads or unreads it without opening it. One component, so the popover and this page
 * cannot differ.
 *
 * **Twenty a page** (P12.1-T4), with *Previous*, *Page {n} of {m}* and *Next* under them once there is
 * more than one. *Mark all read* reads the page again for the server's own times.
 *
 * **The read waits for the session** (P11-T8's browser walk). This route sits outside the group
 * layouts and their session gate, and a page's effect runs before its parents': on a hard load the
 * inbox was asked for before `SessionProvider` had refreshed, with no token, and drew a 401. It now goes
 * out once the session has settled with somebody in it, as `tenant-config-cache.tsx` does since P11-T6.
 *
 * **A read-only support session marks nothing** (roles-and-permissions §7.2; the Phase 12.1 exit
 * review, N2): no *Mark all read*, no toggle, and a row opens without reading itself (`useCanMark`).
 */
export default function NotificationsPage() {
  const { me, loading } = useSession();
  const signedIn = !loading && me !== null;
  const canMark = useCanMark();
  const list = useInbox(INBOX_PAGE_SIZE, { listen: signedIn });
  const { inbox, error, load } = list;

  useEffect(() => {
    if (signedIn) void load(1);
  }, [signedIn, load]);

  const pages = inbox ? Math.max(1, Math.ceil(inbox.total / (inbox.pageSize || INBOX_PAGE_SIZE))) : 1;

  return (
    <RoleShell
      title="Notifications"
      subtitle="What has happened that you should know about."
      permission="notification:read_inbox"
      actions={
        canMark && inbox && inbox.unread > 0 ? (
          <Button variant="secondary" onClick={() => void list.readAll()}>
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {error && (
        <div className="mb-4">
          <ErrorBanner {...error} />
          {inbox === null && (
            <Button variant="secondary" className="mt-3" onClick={() => void load(1)}>Try again</Button>
          )}
        </div>
      )}

      {inbox === null && !error && (
        <Skeleton label="Loading your inbox…">
          <div className="space-y-4 rounded-lg border border-hairline bg-card p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i}>
                <SkeletonBar className="h-3.5 w-2/5" />
                <SkeletonBar className="mt-1.5 w-3/5" />
              </div>
            ))}
          </div>
        </Skeleton>
      )}

      {inbox && inbox.items.length === 0 && (
        <Card>
          <EmptyState title={INBOX_EMPTY} />
        </Card>
      )}

      {inbox && inbox.items.length > 0 && (
        <>
          <Card className="p-1.5" aria-busy={list.loading || undefined}>
            <NotificationList items={inbox.items} setRead={canMark ? list.setRead : undefined} />
          </Card>
          <Pager
            label="Notification pages"
            page={inbox.page}
            pages={pages}
            onPage={(page) => void load(page)}
          />
        </>
      )}
    </RoleShell>
  );
}
