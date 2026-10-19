'use client';

import { TrainingLanding } from '@/components/training/training-catalog';

/**
 * `/training` (P18.5-T1 AC-4): replaced by the office's first category, as the prototype opens on its
 * first tab (`Overall.html:7872`); the empty state when the office offers none.
 */
export default function TrainingPage() {
  return <TrainingLanding />;
}
