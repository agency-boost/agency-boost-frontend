import { api } from './api-client';
import { brandingFileUrl } from './branding-files';
import type { BrandingPalette, SessionBranding } from './session';
import { signedUploadForm, type SignedUpload } from './signed-upload';

/**
 * **A KPM's branding in the browser** (P19.6-T1; ADR-0218 §6, §8, §10). The API derives every colour
 * (`backend/src/domain/branding/palette.ts`); this only puts them where the stylesheet reads them — the custom properties
 * of `globals.css`, under names from a fixed list, values checked as `#rrggbb` — and builds the images' addresses. It
 * never computes a colour: the contrast rule lives in the API alone (invariant §7).
 */

/** Each palette key and the custom property it sets. `today`, `todayInk` and `sidebarText` take a KPM's (§6). */
export const PALETTE_VARS: Readonly<Record<keyof BrandingPalette, string>> = Object.freeze({
  primary: '--color-primary',
  primaryHover: '--color-primary-hover',
  primaryContrast: '--color-primary-contrast',
  primaryInk: '--color-primary-ink',
  primaryDeep: '--color-primary-deep',
  primaryOnSecondary: '--color-primary-on-secondary',
  primary50: '--color-primary-50',
  primary100: '--color-primary-100',
  focusRing: '--color-focus-ring',
  secondary: '--color-secondary',
  secondaryHover: '--color-secondary-hover',
  secondaryContrast: '--color-secondary-contrast',
  secondaryInk: '--color-secondary-ink',
  secondaryMuted: '--color-secondary-muted',
  secondary50: '--color-secondary-50',
  secondary100: '--color-secondary-100',
  today: '--color-today',
  todayInk: '--color-today-ink',
  sidebarText: '--color-sidebar-text',
});

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * **Set a palette on an element** — `<html>` for the app, a preview's frame for the settings page (AC-9). `null` removes
 * every property, so the stylesheet's defaults, AgencyBoost's, show. A value that is not `#rrggbb` is skipped.
 */
export function applyPalette(palette: BrandingPalette | null | undefined, target?: HTMLElement | null): void {
  const el = target ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!el) return;
  for (const [key, name] of Object.entries(PALETTE_VARS) as [keyof BrandingPalette, string][]) {
    const value = palette?.[key];
    if (typeof value === 'string' && HEX.test(value)) el.style.setProperty(name, value.toLowerCase());
    else el.style.removeProperty(name);
  }
}

/** The CSS custom properties of a palette, as an inline style object (a preview frame drawn by React). */
export function paletteStyle(palette: BrandingPalette | null | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if (!palette) return style;
  for (const [key, name] of Object.entries(PALETTE_VARS) as [keyof BrandingPalette, string][]) {
    const value = palette[key];
    if (typeof value === 'string' && HEX.test(value)) style[name] = value.toLowerCase();
  }
  return style;
}

/** A KPM's images' addresses (§4), in a module of their own that Boost and the shell import (`branding-files.ts`). */
export { brandingFileUrl, mascotUrl } from './branding-files';

// ----------------------------------------------------------------- the boot cache (§8)

/** What `public/branding-boot.js` reads before the first paint: the palette this browser last applied. */
export const BRANDING_CACHE_KEY = 'agencyboost.branding';

export interface BrandingCache {
  kpmId: string;
  version: string;
  palette: BrandingPalette | null;
  logo: { width: number; height: number } | null;
}

/** Remember what was applied, for the next reload's first paint; a storage that refuses is no failure. */
export function writeBrandingCache(branding: SessionBranding | null | undefined): void {
  try {
    if (!branding) {
      window.localStorage.removeItem(BRANDING_CACHE_KEY);
      return;
    }
    const cache: BrandingCache = { kpmId: branding.kpmId, version: branding.version, palette: branding.palette, logo: branding.logo };
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode, a full disk: the next reload waits for the session, painting nothing brand-coloured (§8).
  }
}

/** *Keluar*: the cache goes, and the app's own colours come back. */
export function clearBranding(): void {
  try {
    window.localStorage.removeItem(BRANDING_CACHE_KEY);
  } catch {
    // Nothing to clear.
  }
  applyPalette(null);
  applyBrandLinks(null);
}

// ----------------------------------------------------------------- the favicon, the touch icon, the manifest (§10)

const SHELL_LINKS = { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png', manifest: '/manifest.webmanifest' } as const;

function setLink(rel: string, href: string, extra: Record<string, string> = {}): void {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-brand]`);
  if (!link) {
    const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    link = existing ?? document.createElement('link');
    link.rel = rel;
    link.setAttribute('data-brand', '');
    if (!existing) document.head.appendChild(link);
  }
  link.href = href;
  for (const [k, v] of Object.entries(extra)) link.setAttribute(k, v);
}

/**
 * **Point the favicon, the touch icon and the manifest at the KPM's** (§10), or back at the shell's. The home-screen app
 * is always named *AgencyBoost*: only its icons change (the owner, 3 November).
 */
export function applyBrandLinks(branding: SessionBranding | null | undefined): void {
  if (typeof document === 'undefined') return;
  if (branding?.icons) {
    setLink('icon', brandingFileUrl(branding.kpmId, 'favicon-48.png', branding.version), { type: 'image/png' });
    setLink('apple-touch-icon', brandingFileUrl(branding.kpmId, 'apple-touch-icon.png', branding.version));
    setLink('manifest', `/manifest.webmanifest?kpm=${encodeURIComponent(branding.kpmId)}&v=${encodeURIComponent(branding.version)}`);
  } else {
    for (const rel of ['icon', 'apple-touch-icon', 'manifest']) {
      const link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-brand]`);
      if (!link) continue;
      link.href = rel === 'icon' ? SHELL_LINKS.icon : rel === 'manifest' ? SHELL_LINKS.manifest : SHELL_LINKS.apple;
      link.removeAttribute('type');
    }
  }
}

/** Everything the session's branding sets in the document: the palette, the links, and the cache for the next paint. */
export function applySessionBranding(branding: SessionBranding | null | undefined): void {
  applyPalette(branding?.palette ?? null);
  applyBrandLinks(branding ?? null);
  writeBrandingCache(branding ?? null);
}

// ----------------------------------------------------------------- the API (`functional/branding.md`, Data contract)

export interface BrandingImage { key: string; url: string }
export interface BrandingView {
  logo: (BrandingImage & { width: number; height: number }) | null;
  logoSquare: BrandingImage | null;
  primary: string | null;
  secondary: string | null;
  mascot: { default: BrandingImage; poses: Partial<Record<'thinking' | 'celebrating' | 'pointing' | 'phone', BrandingImage>> } | null;
}
export interface BrandingSettings {
  own: BrandingView | null;
  template: BrandingView | null;
  shown: SessionBranding & { source: { logos: 'own' | 'template' | null; colours: 'own' | 'template' | null; mascot: 'own' | 'template' | null } };
  version: number;
  canWrite: boolean;
}
/**
 * One colour as the preview measures it (P19.12-T3; ADR-0246): its words, their ratio on the fill, and the fill —
 * the colour chosen, or its nearest shade the words read 4.5:1 on, `adjusted` when it is not the colour chosen.
 */
export interface PreviewColour { contrast: 'light' | 'dark'; ratio: number; fill: string; adjusted: boolean }
export interface BrandingPreview {
  palette: BrandingPalette;
  primary: PreviewColour;
  secondary: PreviewColour;
}
export interface ConfirmedImage { storageKey: string; width: number; height: number; previews: Record<string, string> }
export type UploadKind = 'logo' | 'logo_square' | 'mascot';
export interface SaveBranding {
  logo: { key: string } | null;
  logoSquare: { key: string } | null;
  primary: string | null;
  secondary: string | null;
  mascot: { default: string; poses: Record<string, string> } | null;
  expectedVersion: number;
}
export interface PublicBranding {
  name: string | null;
  version: string | null;
  palette: BrandingPalette | null;
  logo: { width: number; height: number } | null;
}

/** Where a page's pictures go: the KPM's own settings, or a template's *Tampilan* (`company_template:write`). */
export type BrandingOwner = { kind: 'kpm' } | { kind: 'template'; companyId: string; templateId: string };

type UploadClaim = { kind: UploadKind; filename: string; mimeType: string; bytes: number };
type UploadConfirm = { kind: UploadKind; storageKey: string; mimeType: string };

export const brandingApi = {
  read: () => api<BrandingSettings>('/kpm/settings/branding'),
  save: (body: SaveBranding) => api<BrandingSettings>('/kpm/settings/branding', { method: 'PUT', body }),
  reset: (expectedVersion: number) =>
    api<BrandingSettings>('/kpm/settings/branding/reset', { method: 'POST', body: { expectedVersion } }),
  /** The palette of two colours, or the `422` naming the unreadable one; writes nothing (AC-9). */
  preview: (owner: BrandingOwner, primary: string, secondary: string) => (owner.kind === 'kpm'
    ? api<BrandingPreview>('/kpm/settings/branding/preview', { method: 'POST', body: { primary, secondary } })
    : api<BrandingPreview>(`/admin/companies/${encodeURIComponent(owner.companyId)}/templates/${encodeURIComponent(owner.templateId)}/branding/preview`, { method: 'POST', body: { primary, secondary } })),
  requestUpload: (owner: BrandingOwner, body: UploadClaim) => (owner.kind === 'kpm'
    ? api<SignedUpload>('/kpm/settings/branding/uploads', { method: 'POST', body })
    : api<SignedUpload>(`/admin/companies/${encodeURIComponent(owner.companyId)}/templates/${encodeURIComponent(owner.templateId)}/branding/uploads`, { method: 'POST', body })),
  confirmUpload: (owner: BrandingOwner, body: UploadConfirm) => (owner.kind === 'kpm'
    ? api<ConfirmedImage>('/kpm/settings/branding/uploads/confirm', { method: 'POST', body })
    : api<ConfirmedImage>(`/admin/companies/${encodeURIComponent(owner.companyId)}/templates/${encodeURIComponent(owner.templateId)}/branding/uploads/confirm`, { method: 'POST', body })),
  /** The sign-in page's read (§9): public, by the KPM's id. */
  publicRead: (kpmId: string) => api<PublicBranding>(`/kpm-branding/${encodeURIComponent(kpmId)}`),
};

/** Storage refused the bytes themselves: the page says so in the field's own words. */
export class BrandingUploadFailed extends Error {}

/**
 * **One picture through its three steps** (ADR-0218 §2): a signed form for its kind, the bytes straight to storage, and
 * the confirm, which checks it and makes its sizes. What the confirm answers is what *Simpan* names.
 */
export async function uploadBrandingImage(owner: BrandingOwner, kind: UploadKind, file: File): Promise<ConfirmedImage> {
  const signed = await brandingApi.requestUpload(owner, { kind, filename: file.name || 'image', mimeType: file.type, bytes: file.size });
  let sent: Response;
  try {
    sent = await fetch(signed.uploadUrl, { method: 'POST', body: signedUploadForm(signed, file) });
  } catch {
    throw new BrandingUploadFailed('storage');
  }
  if (!sent.ok) throw new BrandingUploadFailed('storage');
  return brandingApi.confirmUpload(owner, { kind, storageKey: signed.storageKey, mimeType: file.type });
}

/** A KPM id, as a link carries it (§9): 24 hex digits; anything else is ignored. */
export function kpmIdFromLink(value: string | null | undefined): string | null {
  return value && /^[0-9a-f]{24}$/i.test(value) ? value.toLowerCase() : null;
}
