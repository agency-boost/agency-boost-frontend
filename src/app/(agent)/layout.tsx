'use client';

import type { ReactNode } from 'react';
import { AgentShell } from '@/components/agent-shell';

/**
 * The agent application's chrome, rendered once for every route beneath it.
 *
 * The User Management sub-tabs are **not** here: only four of these routes carry them, so
 * they belong to those four (`UserManagementTabs`) rather than to the shell they happen
 * to share. A layout renders for everything under it, and a strip that appears on half of
 * that is not chrome — it is part of a journey.
 */
export default function AgentLayout({ children }: { children: ReactNode }) {
  return <AgentShell>{children}</AgentShell>;
}
