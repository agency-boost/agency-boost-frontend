'use client';

import { Shell } from '@/components/shell';

/**
 * **The field family's pages, in the one shell** (P19.2-T1; ADR-0197): every agent and leader screen under `(agent)/`.
 *
 * Until Phase 19.2 this was the field shell itself — the UI V1 chrome (UI-004; D-13, D-20; ADR-0180): the title row, the
 * floating tab bar and the *Lainnya* sheet below 1024px, the regrouped sidebar from 1024px. That chrome is now every
 * role's (`shell.tsx`), and what is left here is the family: `RequireSession` admits anybody but a Super Admin to these
 * pages (`familyAllows`), an Owner or an Admin included in either of their views, and sends a Super Admin to `/admin`.
 * No gate of its own: each page asks for what it needs.
 */
export function AgentShell({
  title,
  subtitle,
  permission,
  actions,
  children,
}: {
  /**
   * Omitted when a **group layout** renders this shell: a layout serves every route
   * beneath it and cannot know their titles, so those pages render `PageHeader`
   * themselves.
   */
  title?: string;
  subtitle?: string;
  permission?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Shell family="agent" title={title} subtitle={subtitle} permission={permission} actions={actions}>
      {children}
    </Shell>
  );
}
