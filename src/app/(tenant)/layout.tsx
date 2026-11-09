'use client';

import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';

/**
 * The office's pages — `/kpm/*` and `/people/*` — rendered once for every route beneath it, **in the one shell**
 * (P19.2-T1; ADR-0197): the office view of an Owner or an Admin (ADR-0198 §2, §5), with the leader bar, the *Lainnya*
 * sheet and the sidebar every role has. The separate office console (`TenantShell`) is gone.
 *
 * A file under `(tenant)/` is in the office family, and there is no way for it not to be — which is the point of the
 * group: `family="tenant"` admits the office's Owner and its Admins alone (`familyAllows`), in either of their views,
 * and gates on `member:read_profile` (`FAMILY_GATES`), so being here at all is checked once rather than in every page.
 *
 * The configuration is read **here**, once, for the same reason (P4-T7): every screen
 * beneath needs some of it, and each fetching its own copy is three requests to render one
 * screen on a connection budgeted for a mid-range Android over 4G.
 */
export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <TenantConfigProvider>
      <Shell family="tenant">{children}</Shell>
    </TenantConfigProvider>
  );
}
