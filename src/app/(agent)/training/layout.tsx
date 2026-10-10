'use client';

import type { ReactNode } from 'react';
import { Page } from '@/components/page';
import { TrainingCatalogProvider } from '@/components/training/training-catalog';

/**
 * **Training modules** (`/training/*`; `Overall.html:3708-3778`; P18.5-T1): the learner's list and each
 * module's page, over one read of the offered catalog held here, so the subtabs, the list and the module
 * page agree and the list shows a status set on a module's page when the reader goes back.
 *
 * Gated by `training_progress:read`, which every field rung holds for their own, and the Owner and the
 * Admin in their field view through the rung they hold (ADR-0114). The API answers what the office offers
 * and nothing else whatever this decides (T1 AC-3).
 */
export default function TrainingLayout({ children }: { children: ReactNode }) {
  return (
    <Page permission="training_progress:read">
      <TrainingCatalogProvider>{children}</TrainingCatalogProvider>
    </Page>
  );
}
