'use client';

import type { ReactNode } from 'react';
import { TenantShell } from '@/components/tenant-shell';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';

/**
 * The office's chrome, rendered once for every route beneath it.
 *
 * A file under `(tenant)/` is in the office application, and there is no way for it not
 * to be — which is the point of the group. The shell also gates on
 * `member:read_profile`, so being here at all is checked once rather than in five pages.
 *
 * The configuration is read **here**, once, for the same reason (P4-T7): every screen
 * beneath needs some of it, and each fetching its own copy is three requests to render one
 * screen on a connection budgeted for a mid-range Android over 4G.
 */
export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <TenantConfigProvider>
      <TenantShell>{children}</TenantShell>
    </TenantConfigProvider>
  );
}
