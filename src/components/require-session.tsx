'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';

/**
 * A client-side gate. It decides what to *render*, and nothing more — every API call it
 * wraps is authorized again on the server. A screen protected only here is a blocking
 * defect (docs/00-product/roles-and-permissions.md).
 *
 * `permission` is checked against the permissions the server resolved for this request,
 * so a revoked grant disappears on the next /auth/me rather than at token refresh.
 */
export function RequireSession({
  permission,
  children,
}: {
  permission?: string;
  children: React.ReactNode;
}) {
  const { me, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  if (loading) {
    return (
      <p role="status" className="px-5 py-10 text-md text-muted">
        Loading…
      </p>
    );
  }

  if (!me) return null;

  if (permission && !me.permissions.includes(permission)) {
    return (
      <div role="alert" className="px-5 py-10">
        <h1 className="font-display text-xl font-bold text-navy">Not available to you</h1>
        <p className="mt-1 text-md text-muted">
          This screen needs the <code>{permission}</code> permission. If you believe you
          should have it, ask whoever administers your office.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
