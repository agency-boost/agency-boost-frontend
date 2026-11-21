'use client';

import { SettingsScreen } from '@/components/settings-screen';
import { kept } from '@/i18n/kept';
import { useCan } from '@/lib/session';
import { PitchList } from './pitch-list';

/**
 * **Pengaturan › Recruitment pitch** (`/kpm/settings/recruitment-pitch`; P17-T5, D-settings; **redrawn by P19.21-T3
 * AC-6, ADR-0274** after `data-upload-pengaturan-*` frame 22): the six materials agents see in *Recruitment › Pitch
 * Materials*, in one list with no required/optional split, *"n/6 materi siap"*, each with its state and one button —
 * any file format or a link. Saved live: nothing here waits on *Terbitkan*.
 *
 * **Who reaches it**: the Owner, an Admin, a core leader and the Super Admin inside the KPM — `kpm:read_profile`, the
 * office's own read Branch info uses; a read-only support session keeps it and draws the list with nothing to change.
 * **Who writes** is `tenant_config:write`: without it there is no *Unggah file*, *Ganti* or link, only *Lihat*. The API
 * refuses every write the same way whatever this decides.
 */
export default function RecruitmentPitchPage() {
  const canWrite = useCan('tenant_config:write');

  return (
    <SettingsScreen title={kept('Recruitment pitch')} permission="kpm:read_profile">
      <PitchList canWrite={canWrite} />
    </SettingsScreen>
  );
}
