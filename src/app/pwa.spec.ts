import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { APPLE_TOUCH_ICON, PWA_BACKGROUND, PWA_ICONS } from '@/lib/pwa';
import { metadata, viewport } from './layout';
import manifest from './manifest';
import { BOOST_WIDTHS } from '@/components/boost';

const ROOT = join(__dirname, '..', '..');
const PUBLIC = join(ROOT, 'public');
const CSS = readFileSync(join(ROOT, 'src', 'styles', 'globals.css'), 'utf8');

/** A PNG's size, from its header, and the colour of its top-left pixel (8-bit RGB or RGBA, filter 0 on row one). */
function png(file: string) {
  const buf = readFileSync(join(PUBLIC, file));
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colourType = buf[25];
  const chunks: Buffer[] = [];
  for (let at = 8; at < buf.length;) {
    const length = buf.readUInt32BE(at);
    const type = buf.subarray(at + 4, at + 8).toString('ascii');
    if (type === 'IDAT') chunks.push(buf.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  // Row one's filter byte, then the first pixel; filter 0 (none) or 1 (sub) leave the first pixel as stored.
  const corner = `#${[raw[1], raw[2], raw[3]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  return { width, height, colourType, corner, filter: raw[0] };
}

describe('the installed app (UI V1, UI-103; D-02, D-15)', () => {
  it('UI-103 the manifest: standalone, start and scope "/", short name AgencyBoost, the page’s colour, four icons', () => {
    const m = manifest();
    expect(m).toMatchObject({
      display: 'standalone',
      start_url: '/',
      scope: '/',
      short_name: 'AgencyBoost',
      name: 'AgencyBoost',
      theme_color: '#ededea',
      background_color: '#ededea',
    });
    expect(m.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  it('UI-103 the colour is the V1 page background, the token itself', () => {
    const v1 = /:root:has\(\[data-surface='v1'\]\)\s*\{[^}]*--color-base:\s*(#[0-9a-f]{6})/i.exec(CSS);
    expect(v1?.[1].toLowerCase()).toBe(PWA_BACKGROUND);
  });

  it.each(PWA_ICONS.map((i) => [i.src, i.sizes] as const))('D-15 %s is a %s PNG on the brand orange, opaque', (src, sizes) => {
    const icon = png(src.slice(1));
    expect(`${icon.width}x${icon.height}`).toBe(sizes);
    // The accent, `--color-amber`, at the corner: Boost is on the solid brand orange.
    const amber = /--color-amber:\s*(#[0-9a-f]{6})/i.exec(CSS)![1].toLowerCase();
    if (icon.filter <= 1) expect(icon.corner).toBe(amber);
    // RGB, no alpha: a Home Screen icon has no transparent edge.
    expect(icon.colourType).toBe(2);
  });

  it('UI-103 the apple-touch-icon is 180 × 180', () => {
    const icon = png(APPLE_TOUCH_ICON.slice(1));
    expect([icon.width, icon.height]).toEqual([180, 180]);
  });

  it('UI-103 the <head>: the manifest, both capable flags, the default status bar, the touch icon', () => {
    expect(metadata.manifest).toBe('/manifest.webmanifest');
    expect(metadata.other).toMatchObject({ 'mobile-web-app-capable': 'yes', 'apple-mobile-web-app-capable': 'yes' });
    expect(metadata.appleWebApp).toMatchObject({ statusBarStyle: 'default', title: 'AgencyBoost' });
    expect(metadata.icons).toMatchObject({ apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }] });
  });

  it('UI-103 theme-color is the page’s, and the page reaches the home indicator (viewport-fit=cover) for the safe area', () => {
    expect(viewport).toMatchObject({ themeColor: PWA_BACKGROUND, viewportFit: 'cover', width: 'device-width', initialScale: 1 });
  });

  it('UI-102 the four poses ready to use are served from /brand: the transparent PNG and its WebP widths', () => {
    for (const pose of ['thinking', 'celebrating', 'pointing', 'phone']) {
      expect(png(`brand/boost-${pose}.png`).colourType).toBe(6);
      for (const width of BOOST_WIDTHS) {
        const webp = readFileSync(join(PUBLIC, 'brand', `boost-${pose}-${width}.webp`));
        expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');
      }
    }
  });
});
