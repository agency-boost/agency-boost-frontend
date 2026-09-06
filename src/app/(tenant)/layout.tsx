'use client';

import type { ReactNode } from 'react';
import { TenantShell } from '@/components/tenant-shell';

/**
 * The office's chrome, rendered once for every route beneath it.
 *
 * A file under `(tenant)/` is in the office application, and there is no way for it not
 * to be — which is the point of the group. The shell also gates on
 * `member:read_profile`, so being here at all is checked once rather than in five pages.
 */
export default function TenantLayout({ children }: { children: ReactNode }) {
  return <TenantShell>{children}</TenantShell>;
}
