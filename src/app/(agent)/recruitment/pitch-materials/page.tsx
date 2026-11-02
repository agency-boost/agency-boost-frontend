'use client';

import { PitchMaterials } from '@/components/recruitment/pitch-materials';
import { RequireSession } from '@/components/require-session';

/**
 * **Recruitment › Pitch Materials** (`/recruitment/pitch-materials`; `Recruitment_Section.html:355-370`,
 * `:693-753` with the agent's view, `:797-820`; P17-T6): the office's documents to show a candidate — the
 * four, then *Company Profile* and *Agency Profile*, optional (ADR-0177), all six for every reader. The title,
 * the sub-line and the tabs are the layout's.
 *
 * **Read-only for everybody here** (D-agent-view, AC-3), the Owner and the Admin in their field view
 * included: the office's page, `/kpm/settings/recruitment-pitch`, is where documents are uploaded and
 * confirmed. Each card reads *Missing*, *Uploaded* or *Uploaded · needs confirmation* (an empty optional one
 * *Not uploaded yet*), and every uploaded one offers *View PDF* whatever its ticks (OD-141, ADR-0126).
 *
 * Gated by `recruitment:read`, as the layout is: the gate is repeated so the tab refuses on its own.
 */
export default function PitchMaterialsPage() {
  return (
    <RequireSession permission="recruitment:read">
      <PitchMaterials audience="agent" />
    </RequireSession>
  );
}
