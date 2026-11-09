import { apiUrl } from './api';
import type { SessionBranding } from './session';

/**
 * **A KPM's images, by address** (P19.6-T1; ADR-0218 §4): kept apart from the rest of `branding.ts` — its uploads, its
 * palette and its boot cache — because Boost and the shell's logo draw these on nearly every page, and a page that
 * imported them from there loaded the branding settings' upload client with them (the bundle, 2026-11-06;
 * `performance-and-scale.md`). `branding.ts` re-exports both.
 */

/** **One of a KPM's images, by version** (§4): a public address that never expires, so a reload draws it at once. */
export function brandingFileUrl(kpmId: string, file: string, version: string): string {
  return `${apiUrl(`/kpm-branding/${encodeURIComponent(kpmId)}/files/${file}`)}?v=${encodeURIComponent(version)}`;
}

/** The mascot's picture for a pose: its own when the KPM has one, else the default's (§2). */
export function mascotUrl(branding: SessionBranding, pose: string, width: 120 | 240 | 360): string | null {
  if (!branding.mascotPoses.includes('default')) return null;
  const chosen = branding.mascotPoses.includes(pose) ? pose : 'default';
  return brandingFileUrl(branding.kpmId, `mascot-${chosen}-${width}.webp`, branding.version);
}
