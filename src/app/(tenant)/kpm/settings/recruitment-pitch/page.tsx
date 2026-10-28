'use client';

import { PitchMaterials } from '@/components/recruitment/pitch-materials';
import { SettingsScreen } from '@/components/settings-screen';
import { PITCH_COPY } from '@/lib/recruitment-pitch';
import { useCan } from '@/lib/session';

/**
 * **Settings › Recruitment pitch** (`/kpm/settings/recruitment-pitch`; the prototype's *Viewing as KPM*
 * view, `Recruitment_Section.html:693-753`, `:797-820`; P17-T5, D-settings): the office's pitch documents —
 * the four, then *Company Profile* and *Agency Profile*, optional (ADR-0177) — uploaded, replaced and confirmed
 * for every agent who shows them.
 *
 * The title and no sub-line, as drawn; **no toggle** — the prototype's *Viewing as Agent* / *Viewing as
 * KPM* switch is two routes, and the permissions decide which one a reader reaches (H-22).
 *
 * **Who reaches it**: the Owner and the Admin. The gate is `kpm:read_profile`, the office's own read
 * Branch info uses — the Owner's, the Admin's and nobody else's in an office, and a read by its verb,
 * so a read-only support session as either keeps it and draws the page with nothing to change. A field
 * member is refused. **Who writes** is `tenant_config:write`, which a read-only session never holds:
 * without it there is no *Upload PDF*, no *Replace*, and every box is disabled. The API refuses every
 * write the same way whatever this decides.
 */
export default function RecruitmentPitchPage() {
  const canWrite = useCan('tenant_config:write');

  return (
    <SettingsScreen title={PITCH_COPY.settingsTitle} permission="kpm:read_profile">
      <PitchMaterials audience="office" canWrite={canWrite} />
    </SettingsScreen>
  );
}
