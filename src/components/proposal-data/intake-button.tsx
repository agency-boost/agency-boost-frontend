'use client';

import { IntakePanel } from './intake-panel';

/**
 * **The Proposal tab's *Unggah file* mount point** (P19.15-T3; the contract between T1's screen and T3): the shared screen
 * renders `<IntakeButton companyId canManage />` at its top, and *Perusahaan* renders it with `companyId` `null` for a
 * file of any insurer. The button, the upload, the recent uploads and *Yang kami pahami* are `IntakePanel`'s.
 */
export function IntakeButton({ companyId, canManage }: { companyId: string | null; canManage: boolean }) {
  return <IntakePanel companyId={companyId} canManage={canManage} />;
}
