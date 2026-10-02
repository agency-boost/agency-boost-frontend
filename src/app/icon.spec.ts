import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * P11-T8 AC-13 (ADR-0086, OD-103): **the browser tab carries the shell's own brand mark**, on the
 * sidebar's navy — `icon.svg`, and `favicon.ico` for the browsers that ask for one by name, both at the
 * app root so every route group has them and no first load asks for a `/favicon.ico` that is not there.
 *
 * An icon cannot read the stylesheet, so the tokens' values are written into both files. This holds
 * them to `globals.css`, as `theme.spec.ts` holds amber-ink, and holds the mark to the shell's own, so
 * neither can drift from what the sidebar draws.
 */
const APP = __dirname;
const globals = readFileSync(join(APP, '../styles/globals.css'), 'utf8');
const token = (name: string) => {
  const found = globals.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i'));
  if (!found) throw new Error(`--color-${name} is not a hex value in globals.css`);
  return found[1].toLowerCase();
};
const NAVY = token('navy');
const LIGHT = token('sidebar-text');
const AMBER = token('amber');

const svg = readFileSync(join(APP, 'icon.svg'), 'utf8');
/** The markup's elements, without its comment, which names the tokens in words. */
const markup = svg.replace(/<!--[\s\S]*?-->/g, '');

describe('the favicon (P11-T8 AC-13, ADR-0086)', () => {
  describe('icon.svg', () => {
    it('P11-T8 AC-13 draws on the sidebar’s navy, its nodes in the sidebar’s light and its amber', () => {
      expect(markup).toMatch(new RegExp(`<rect [^>]*fill="${NAVY}"`, 'i'));
      const colours = [...markup.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase());
      expect(new Set(colours)).toEqual(new Set([NAVY, LIGHT, AMBER]));
      // One amber node, the lower right, as the shell's.
      expect(markup).toMatch(new RegExp(`<circle cx="20" cy="19" r="4" fill="${AMBER}"`, 'i'));
    });

    it('P11-T8 AC-13 is the shell’s mark, node for node and line for line', () => {
      const shell = readFileSync(join(APP, '../components/app-shell.tsx'), 'utf8');
      const mark = shell.slice(shell.indexOf('function BrandMark'), shell.indexOf('function NavLink'));
      const shapes = (text: string) => [
        ...[...text.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => `circle ${m[1]} ${m[2]} ${m[3]}`),
        ...[...text.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => `line ${m.slice(1, 5).join(' ')}`),
      ];
      expect(shapes(mark)).toHaveLength(5);
      expect(shapes(markup)).toEqual(shapes(mark));
    });
  });

  describe('favicon.ico', () => {
    const ico = readFileSync(join(APP, 'favicon.ico'));

    /** The ICO's images: size, and a reader for one pixel of each, as `#rrggbb` plus its alpha. */
    const images = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
      const entry = 6 + i * 16;
      const size = ico.readUInt8(entry) || 256;
      const offset = ico.readUInt32LE(entry + 12);
      const bpp = ico.readUInt16LE(offset + 14);
      const pixel = (x: number, y: number) => {
        // A 32-bit BMP is BGRA, bottom row first, after its 40-byte header.
        const at = offset + 40 + ((size - 1 - y) * size + x) * 4;
        const hex = [ico[at + 2], ico[at + 1], ico[at]].map((v) => v.toString(16).padStart(2, '0')).join('');
        return { colour: `#${hex}`, alpha: ico[at + 3] };
      };
      return { size, bpp, pixel };
    });

    it('P11-T8 AC-13 is an icon file holding the sizes a tab and a bookmark ask for', () => {
      expect(ico.readUInt16LE(2)).toBe(1);
      expect(images.map((image) => [image.size, image.bpp])).toEqual([[16, 32], [32, 32], [48, 32]]);
    });

    it.each([16, 32, 48])('P11-T8 AC-13 at %ipx: the navy ground, the light nodes and the amber node are the tokens', (size) => {
      const image = images.find((i) => i.size === size)!;
      // A point of icon.svg's 32-unit square, at this size: the pixel whose square it falls in.
      const at = (x: number, y: number) => image.pixel(Math.floor((x * size) / 32), Math.floor((y * size) / 32));
      expect(at(16, 28)).toEqual({ colour: NAVY, alpha: 255 });
      expect(at(16.5, 8.5)).toEqual({ colour: LIGHT, alpha: 255 });
      expect(at(9.5, 22.5)).toEqual({ colour: LIGHT, alpha: 255 });
      expect(at(23.5, 22.5)).toEqual({ colour: AMBER, alpha: 255 });
      // The rounded square's corner is the tab's own ground.
      expect(image.pixel(0, 0).alpha).toBe(0);
    });
  });

  it('P11-T8 AC-13 sits at the app root, where every route group and shell has it', () => {
    // A file convention Next serves as `/favicon.ico` and `<link rel="icon">` only from the root
    // segment: inside a route group, a page outside the group would have no icon.
    expect(() => readFileSync(join(APP, 'icon.svg'))).not.toThrow();
    expect(() => readFileSync(join(APP, 'favicon.ico'))).not.toThrow();
  });
});
