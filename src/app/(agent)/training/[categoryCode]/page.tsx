'use client';

import { use } from 'react';
import { TrainingCategory } from '@/components/training/training-catalog';

/**
 * One category's *Skills List* (`/training/[categoryCode]`, `Overall.html:3708-3732`; P18.5-T1 AC-4),
 * addressed by the category's stored code. A code the office does not offer is the list's not-found.
 */
export default function TrainingCategoryPage({ params }: { params: Promise<{ categoryCode: string }> }) {
  const { categoryCode } = use(params);
  return <TrainingCategory code={decodeURIComponent(categoryCode)} />;
}
