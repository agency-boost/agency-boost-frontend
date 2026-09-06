'use client';

import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';

/**
 * The platform console's chrome, rendered once for every route beneath it.
 *
 * Before this existed each page applied its own shell, so nothing structural decided what
 * chrome a route wore — and a route could therefore wear the wrong one, as
 * `/notifications` did. A layout makes the answer positional: a file under `(admin)/` is
 * in the console, and there is no way for it not to be.
 *
 * It also gives the group somewhere to put `loading.tsx`. A boundary here swaps only the
 * content area, so a sidebar click no longer leaves the previous page on screen with no
 * indication that anything is happening.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
