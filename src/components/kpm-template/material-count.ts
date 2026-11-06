import type { TemplateMaterial } from '@/lib/admin';

/**
 * **What a section's page counts of a module's material without opening it** (ADR-0208 §1): kept apart from the dialog
 * that edits it (`template-module-material.tsx`), which the page loads only when a module's material is opened — a page
 * that imported this from there loaded the dialog, its uploads and its sandboxed preview in its first load (the bundle,
 * 2026-11-06; `performance-and-scale.md`).
 */

/** A module's material as a template payload holds it: any of the three lists may be absent. */
export type PayloadMaterial = Partial<TemplateMaterial> | undefined;

/** How many items a module's material holds: a module **has material** with one or more (ADR-0208 §1). */
export const materialCount = (raw: PayloadMaterial) =>
  (raw?.files?.length ?? 0) + (raw?.videos?.length ?? 0) + (raw?.links?.length ?? 0);
