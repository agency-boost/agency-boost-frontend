'use client';

import { Suspense } from 'react';
import { AuditLogSection } from '@/components/admin/platform/audit-log';
import { RequireSession } from '@/components/require-session';

/**
 * ***Platform* › *Audit log*** (P19.23-T6 AC-1; ADR-0279; frame f52) — moved from `/admin/audit`, which redirects here
 * with its query. The section is `components/admin/platform/audit-log.tsx`; `useSearchParams` needs its boundary.
 */
export default function PlatformAuditPage() {
  return (
    <RequireSession permission="audit_log:read">
      <Suspense fallback={null}>
        <AuditLogSection />
      </Suspense>
    </RequireSession>
  );
}
