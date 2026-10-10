'use client';

import { use } from 'react';
import { TrainingModule } from '@/components/training/training-module';

/**
 * One module's page (`/training/[categoryCode]/[moduleCode]`, `Overall.html:3733-3766`; P18.5-T1 AC-5 to
 * AC-7), addressed by stored codes. A module the office does not offer is the page's not-found (AC-3).
 */
export default function TrainingModulePage({ params }: { params: Promise<{ categoryCode: string; moduleCode: string }> }) {
  const { categoryCode, moduleCode } = use(params);
  return (
    <TrainingModule
      key={moduleCode}
      categoryCode={decodeURIComponent(categoryCode)}
      moduleCode={decodeURIComponent(moduleCode)}
    />
  );
}
