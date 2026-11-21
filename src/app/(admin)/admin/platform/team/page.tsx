'use client';

import { TeamSection } from '@/components/admin/platform/team-section';
import { RequireSession } from '@/components/require-session';

/** ***Platform* › *Tim Super Admin*** (P19.23-T6 AC-2; ADR-0279; frame f53). */
export default function PlatformTeamPage() {
  return (
    <RequireSession permission="super_admin:read">
      <TeamSection />
    </RequireSession>
  );
}
