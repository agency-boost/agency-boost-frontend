import type { ReactNode } from 'react';
import { AUTH_FRAME } from '@/components/auth-page';

/**
 * The screens somebody meets before they are anybody.
 *
 * No chrome, deliberately: there is no session to read a role from, so there is no
 * sidebar that would be right. Each page centres its own card.
 *
 * The group exists anyway, for two reasons. It says *these five are one kind of screen*,
 * which the flat tree could not; and it gives them a shared `loading.tsx`, so the wait
 * between clicking **Create one** and the form appearing shows something. And a third since the staging review of
 * 2026-10-31: the one frame that keeps every one of them below the top inset, never under the clock (`AUTH_FRAME`).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div data-auth-frame="" className={AUTH_FRAME}>{children}</div>;
}
