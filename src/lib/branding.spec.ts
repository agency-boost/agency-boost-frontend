import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyBrandLinks, applyPalette, applySessionBranding, BRANDING_CACHE_KEY, brandingFileUrl, clearBranding,
  kpmIdFromLink, mascotUrl, PALETTE_VARS, paletteStyle,
} from './branding';
import type { BrandingPalette, SessionBranding } from './session';

const BOOT = readFileSync(join(__dirname, '../../public/branding-boot.js'), 'utf8');
const GLOBALS = readFileSync(join(__dirname, '../styles/globals.css'), 'utf8');

const PALETTE = Object.fromEntries(Object.keys(PALETTE_VARS).map((k, i) => [k, `#0a6e${String(i).padStart(2, '0')}`])) as unknown as BrandingPalette;
const BRANDED: SessionBranding = {
  kpmId: '66f0000000000000000005a5', version: 'abc123def456', palette: PALETTE, logo: { width: 480, height: 96 },
  logoSquare: true, icons: true, mascotPoses: ['default', 'thinking'], lesson: { accent: '0a6e5c', accentSoft: 'ebf3f2' },
};

/** Run the boot script as the browser runs it, before anything else, at `path`. */
function boot(path: string) {
  window.history.replaceState(null, '', path);
  new Function(BOOT)();
}

afterEach(() => {
  clearBranding();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('P19.6-T1 the KPM’s colours in the browser (ADR-0218 §6, §8)', () => {
  it('P19.6-T1 AC-1 maps every palette key to a token globals.css declares', () => {
    for (const name of Object.values(PALETTE_VARS)) expect(GLOBALS, name).toMatch(new RegExp(`${name}:`));
  });

  it('P19.6-T1 AC-12 the boot script knows the same names as the shell, and no others', () => {
    const block = /var VARS = \{([\s\S]*?)\};/.exec(BOOT)![1];
    const pairs = Object.fromEntries(Array.from(block.matchAll(/(\w+): '([^']+)'/g), (m) => [m[1], m[2]]));
    expect(pairs).toEqual(PALETTE_VARS);
  });

  it('P19.6-T1 AC-12 sets a palette on <html>, skips a value that is not #rrggbb, and null takes every property off', () => {
    applyPalette({ ...PALETTE, primary: 'red; background: url(x)' } as BrandingPalette);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--color-primary')).toBe('');
    expect(style.getPropertyValue('--color-secondary')).toBe(PALETTE.secondary);
    applyPalette(null);
    for (const name of Object.values(PALETTE_VARS)) expect(style.getPropertyValue(name)).toBe('');
  });

  it('P19.6-T1 AC-9 builds a preview frame’s style from the palette alone', () => {
    expect(paletteStyle(PALETTE)['--color-primary-contrast']).toBe(PALETTE.primaryContrast);
    expect(paletteStyle(null)).toEqual({});
  });

  it('B7-AC1 P19.6-T1 AC-12 no orange flash: a reload paints the colours the last session left, before the app starts', () => {
    applySessionBranding(BRANDED);
    expect(JSON.parse(window.localStorage.getItem(BRANDING_CACHE_KEY)!)).toMatchObject({ kpmId: BRANDED.kpmId, version: BRANDED.version });
    applyPalette(null);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    boot('/home');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(PALETTE.primary);
    expect(document.documentElement.style.getPropertyValue('--color-sidebar-text')).toBe(PALETTE.sidebarText);
  });

  it('P19.6-T1 AC-13 the boot script paints nothing on the sign-in, registration and invitation pages', () => {
    applySessionBranding(BRANDED);
    applyPalette(null);
    for (const path of ['/login', '/register?kpm=1', '/join?invite=x', '/forgot-password', '/verify-email/abc']) {
      boot(path);
      expect([path, document.documentElement.style.getPropertyValue('--color-primary')]).toEqual([path, '']);
    }
  });

  it('P19.6-T1 AC-12 Keluar clears the cache and the colours; a broken cache paints nothing', () => {
    applySessionBranding(BRANDED);
    clearBranding();
    expect(window.localStorage.getItem(BRANDING_CACHE_KEY)).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    window.localStorage.setItem(BRANDING_CACHE_KEY, '{not json');
    boot('/home');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });

  it('P19.6-T1 AC-16 points the favicon, the touch icon and the manifest at the KPM’s, and back', () => {
    applyBrandLinks(BRANDED);
    const href = (rel: string) => document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)!.getAttribute('href');
    expect(href('icon')).toBe(brandingFileUrl(BRANDED.kpmId, 'favicon-48.png', BRANDED.version));
    expect(href('apple-touch-icon')).toContain('/files/apple-touch-icon.png?v=abc123def456');
    expect(href('manifest')).toBe(`/manifest.webmanifest?kpm=${BRANDED.kpmId}&v=${BRANDED.version}`);
    applyBrandLinks(null);
    expect(href('icon')).toBe('/icon.svg');
    expect(href('manifest')).toBe('/manifest.webmanifest');
  });

  it('P19.6-T1 AC-6 the mascot’s pose is its own picture where it has one, else the default’s; Boost without one', () => {
    expect(mascotUrl(BRANDED, 'thinking', 240)).toContain('/files/mascot-thinking-240.webp?v=');
    expect(mascotUrl(BRANDED, 'phone', 120)).toContain('/files/mascot-default-120.webp?v=');
    expect(mascotUrl({ ...BRANDED, mascotPoses: [] }, 'phone', 120)).toBeNull();
  });

  it('P19.6-T1 AC-13 takes a KPM from a link by its id alone; a code or anything else is ignored', () => {
    expect(kpmIdFromLink('66F0000000000000000005A5')).toBe('66f0000000000000000005a5');
    expect(kpmIdFromLink('0417')).toBeNull();
    expect(kpmIdFromLink(null)).toBeNull();
  });
});
