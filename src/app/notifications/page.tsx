'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RoleShell } from '@/components/role-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  markAllNotificationsRead,
  markNotificationRead,
  readInbox,
  type Inbox,
} from '@/lib/notifications';
import { useSession } from '@/lib/session';

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
 * **An item with somewhere to go is a link there** (P11-T10 AC-8): the server composes the address
 * beside the words — a finalized coaching session opens on that session — and the title is the link.
 * Every other item is the record it always was.
 *
 * **The read waits for the session** (P11-T8's browser walk). This route sits outside the group
 * layouts and their session gate, and a page's effect runs before its parents': on a hard load the
 * inbox was asked for before `SessionProvider` had refreshed, with no token, and drew a 401. It now goes
 * out once the session has settled with somebody in it, as `tenant-config-cache.tsx` does since P11-T6.
 */
export default function NotificationsPage() {
  const { me, loading } = useSession();
  const signedIn = !loading && me !== null;
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setInbox(await readInbox());
    } catch (err) {
      setError(toDisplayError(err));
      setInbox({ items: [], unread: 0 });
    }
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  async function act(run: () => Promise<Inbox>) {
    setBusy(true);
    setError(null);
    try {
      setInbox(await run());
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoleShell
      title="Notifications"
      subtitle="What has happened that you should know about."
      permission="notification:read_inbox"
      actions={
        inbox && inbox.unread > 0 ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void act(markAllNotificationsRead)}
          >
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {error && <ErrorBanner {...error} />}

      {inbox === null && !error && (
        <SkeletonCards count={4} label="Loading your inbox…" />
      )}

      {inbox && inbox.items.length === 0 && (
        <Card>
          <EmptyState title="Nothing yet. This is where you will hear about your unit." />
        </Card>
      )}

      {inbox && inbox.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {inbox.items.map((item) => {
            const unread = item.readAt === null;
            return (
              <li key={item.notificationId}>
                <Card
                  className={unread ? 'border-l-4 border-l-amber' : undefined}
                  /* Read rows are not hidden or greyed to the point of unreadable — a
                     week-old notification is still the record of what happened. The
                     amber edge marks what is new; everything stays legible. */
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="min-w-0 flex-1">
                      {item.href ? (
                        <Link href={item.href} className="block text-md font-semibold text-navy underline underline-offset-2">
                          {item.title}
                        </Link>
                      ) : (
                        <span className="block text-md font-semibold text-navy">{item.title}</span>
                      )}
                      {item.detail && (
                        <span className="mt-0.5 block text-md text-muted">{item.detail}</span>
                      )}
                      <time
                        dateTime={item.createdAt}
                        className="mt-1 block text-sm text-muted"
                      >
                        {new Date(item.createdAt).toLocaleDateString('en-GB')}
                      </time>
                    </span>
                    {unread && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void act(() => markNotificationRead(item.notificationId))}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </RoleShell>
  );
}
