'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { ResponsiveSheet as ResponsiveSheetOf } from '@/components/ui/responsive-sheet';
import { useOpenedOnce } from '@/lib/use-opened-once';

const ResponsiveSheet = dynamic(
  () => import('@/components/ui/responsive-sheet').then((m) => m.ResponsiveSheet), { ssr: false },
);

/**
 * **`ResponsiveSheet`, fetched the first time it opens** (the bundle, 2026-11-06; `performance-and-scale.md`;
 * `components-and-patterns.md`, *A sheet opened from a control*). The same props and the same sheet: a page that draws
 * one only after a tap — a filter, a period picker, a figure's detail — keeps `Modal` and the sheet out of its first
 * load, and mounts it from its first opening on, closed, as it always was (`useOpenedOnce`), so what it holds between
 * openings holds as before.
 *
 * A sheet that is open as the page first draws it gains nothing here; use `ResponsiveSheet` itself.
 */
export function LazyResponsiveSheet(props: ComponentProps<typeof ResponsiveSheetOf>) {
  const mounted = useOpenedOnce(props.open);
  return mounted ? <ResponsiveSheet {...props} /> : null;
}
