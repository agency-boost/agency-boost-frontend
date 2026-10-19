import type { ReactNode } from 'react';

/**
 * The screens somebody meets before they are anybody.
 *
 * No chrome, deliberately: there is no session to read a role from, so there is no
 * sidebar that would be right. Each page centres its own card.
 *
 * The group exists anyway, for two reasons. It says *these five are one kind of screen*,
 * which the flat tree could not; and it gives them a shared `loading.tsx`, so the wait
 * between clicking **Create one** and the form appearing shows something.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
