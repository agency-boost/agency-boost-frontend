'use client';

import { kept } from '@/i18n/kept';
import { brandingFileUrl, mascotUrl } from '@/lib/branding';
import { cn } from '@/lib/cn';
import { useContext } from 'react';
import { SessionContext, type SessionBranding } from '@/lib/session';

/**
 * **The shell's KPM marks** (P19.6-T1 AC-3, AC-4, AC-6, AC-14; ADR-0218 §2, §11; `components-and-patterns.md`, *The
 * branded shell*). With no branding none of this draws anything, and the shell is exactly as before.
 */

/** What the session's KPM shows: `null` for AgencyBoost's (no KPM, no branding, or a fixture without it). */
export function useBranding(): SessionBranding | null {
  // Read from the context directly: a shell drawn without a session provider (a spec's) is AgencyBoost's.
  return useContext(SessionContext)?.me?.branding ?? null;
}

/** The office's name, for the logo's accessible name; `null` without one. */
export function useOfficeName(): string | null {
  return useContext(SessionContext)?.me?.membership?.office?.branch ?? null;
}

/**
 * **The KPM's logo in place of *AgencyBoost*** (AC-3, AC-4): the wide logo inside 160 × 32 px, proportions kept; in the
 * 64px rail the square logo, or the wide one centred when there is none. Its accessible name is the office's name, or
 * *Logo KPM* without one.
 */
export function KpmLogo({ branding, rail, name, className }: {
  branding: SessionBranding; rail?: boolean; name?: string | null; className?: string;
}) {
  if (!branding.logo) return null;
  const square = rail && branding.logoSquare;
  const src = brandingFileUrl(branding.kpmId, square ? 'logo-square.png' : 'logo.png', branding.version);
  const { width, height } = branding.logo;
  // The drawn size: 32px high, at most 160px wide; in the rail at most 40px square.
  const box = rail ? { w: 40, h: 40 } : { w: 160, h: 32 };
  const scale = square ? 1 : Math.min(box.w / Math.max(1, width), box.h / Math.max(1, height));
  const drawn = square ? { w: 40, h: 40 } : { w: Math.round(width * scale), h: Math.round(height * scale) };
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a public, versioned API file the image optimiser cannot fetch
    <img
      src={src}
      alt={name || 'Logo KPM'}
      width={drawn.w}
      height={drawn.h}
      data-kpm-logo=""
      className={cn('block shrink-0 object-contain', rail ? 'mx-auto max-h-10 max-w-10' : 'max-h-8 max-w-[160px]', className)}
    />
  );
}

/**
 * ***Powered by AgencyBoost*** (AC-14; ADR-0218 §11): a small line at the foot of the sidebar and of *Lainnya*, only when
 * the logo shown is the KPM's or its template's — so a KPM with no branding gets nothing added. The words are kept
 * English (the product's name).
 */
export function PoweredBy({ branding, className }: { branding: SessionBranding | null; className?: string }) {
  if (!branding?.logo) return null;
  return (
    <p data-powered-by="" className={cn('m-0 text-2xs font-medium', className)}>
      {kept('Powered by AgencyBoost')}
    </p>
  );
}

/** **The KPM's mascot for a pose** (AC-6), or `null` for Boost. */
export function kpmMascotSrc(branding: SessionBranding | null, pose: string, width: 120 | 240 | 360): string | null {
  return branding ? mascotUrl(branding, pose, width) : null;
}
