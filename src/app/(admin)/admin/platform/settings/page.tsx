'use client';

import { SettingsSection } from '@/components/admin/platform/settings-section';
import { RequireSession } from '@/components/require-session';

/** ***Platform* › *Pengaturan platform*** (P19.23-T6 AC-3; ADR-0279; frame f54). */
export default function PlatformSettingsPage() {
  return (
    <RequireSession permission="platform_settings:read">
      <SettingsSection />
    </RequireSession>
  );
}
