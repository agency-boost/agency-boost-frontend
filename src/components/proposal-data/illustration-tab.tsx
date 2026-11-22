'use client';

import { IllustrationPanel } from './illustration-panel';

/**
 * **A product's *Ilustrasi* tab mount point** (P19.15-T2; the contract between T1's screen and T2): the shared screen's
 * product detail renders `<IllustrationTab companyId productId canManage />` as its third tab. The upload, the blocks,
 * the checks, the preview and *Terbitkan* are `IllustrationPanel`'s.
 */
export function IllustrationTab({ companyId, productId, canManage }: { companyId: string; productId: string; canManage: boolean }) {
  return <IllustrationPanel companyId={companyId} productId={productId} canManage={canManage} />;
}
