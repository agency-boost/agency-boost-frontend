'use client';

import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';

/**
 * The platform's pages — `/admin/*` — rendered once for every route beneath it, **in the one shell** (P19.2-T1;
 * ADR-0197): the Super Admin's bar *Overview · KPMs · Perusahaan · Analytics · Lainnya* below 1024px and the labelled
 * sidebar from 1024px (UI-127, UI-128). The separate platform console (`AdminShell`) is gone.
 *
 * A layout makes the family positional: a file under `(admin)/` is the platform's, and there is no way for it not to be.
 * `family="admin"` admits a Super Admin alone (`familyAllows`) and gates on `kpm:list_all` (`FAMILY_GATES`).
 *
 * It also gives the group somewhere to put `loading.tsx`. A boundary here swaps only the
 * content area, so a sidebar click no longer leaves the previous page on screen with no
 * indication that anything is happening.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Shell family="admin">{children}</Shell>;
}
