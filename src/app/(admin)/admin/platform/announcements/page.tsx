'use client';

import { AnnouncementsSection } from '@/components/admin/platform/announcements-section';
import { RequireSession } from '@/components/require-session';

/** ***Platform* › *Pengumuman*** (P19.23-T6 AC-4; ADR-0279; frame f55). */
export default function PlatformAnnouncementsPage() {
  return (
    <RequireSession permission="announcement:read">
      <AnnouncementsSection />
    </RequireSession>
  );
}
