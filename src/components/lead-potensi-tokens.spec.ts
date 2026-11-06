import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

/**
 * **The *Potensi* switch, the avatar badges, the *n potensi* pill and a kandidat's avatar** (P19.1-T2 AC-5, AC-8; P19.1-T6
 * AC-4, AC-7; UI-153, UI-155; `tokens.md`, *November 2026 tokens*): each class the screens draw compiles from its own
 * token, `globals.css` holds the values `tokens.md` gives, and each pair clears its WCAG floor — computed here, never
 * written down. The two corrections of the stop-motion (the yellow badge's ✓, the switch's off edge) are pinned as such.
 */

async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

const globals = readFileSync(join(__dirname, '../styles/globals.css'), 'utf8');
const valueOf = (name: string) => globals.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1] ?? '';

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const WHITE = '#FFFFFF';

describe('P19.1-T2, P19.1-T6 — the Potensi tokens', () => {
  it.each([
    ['bg-switch-off', '.bg-switch-off', 'switch-off'],
    ['border-switch-off-edge', '.border-switch-off-edge', 'switch-off-edge'],
    ['bg-badge-potensi', '.bg-badge-potensi', 'badge-potensi'],
    ['bg-badge-won', '.bg-badge-won', 'badge-won'],
    ['bg-potensi', '.bg-potensi', 'pill-potensi'],
    ['text-potensi-ink', '.text-potensi-ink', 'pill-potensi-ink'],
    ['bg-kandidat', '.bg-kandidat', 'avatar-kandidat'],
    ['text-kandidat-ink', '.text-kandidat-ink', 'avatar-kandidat-ink'],
  ])('P19.1-T2 AC-5 %s emits a rule mixed from its own token', async (cls, selector, token) => {
    const css = await compile(cls);
    expect(css).toContain(selector);
    expect(css).toContain(`var(--color-${token})`);
  });

  it('P19.1-T2 AC-5 globals.css holds tokens.md’s values', () => {
    expect([
      'switch-off', 'switch-off-edge', 'badge-potensi', 'badge-won', 'pill-potensi', 'pill-potensi-ink',
      'avatar-kandidat', 'avatar-kandidat-ink',
    ].map((t) => valueOf(t).toLowerCase())).toEqual([
      '#f1f3f8', '#78839c', '#e2b232', '#3b8a2e', '#fbefc4', '#7a5a12', '#e1f2ef', '#1f5a55',
    ]);
  });

  it('P19.1-T2 AC-5 the switch: navy words on the off card, its dashed edge and off track 3:1 — the stop-motion’s were not', () => {
    expect(ratio(valueOf('navy'), valueOf('switch-off'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(valueOf('switch-off-edge'), valueOf('switch-off'))).toBeGreaterThanOrEqual(3);
    expect(ratio(valueOf('switch-off-edge'), WHITE)).toBeGreaterThanOrEqual(3);
    // The white thumb on the off track.
    expect(ratio(WHITE, valueOf('switch-off-edge'))).toBeGreaterThanOrEqual(3);
    // The *Fix*: the stop-motion's border and track miss 1.4.11.
    expect(ratio('#9AA6BF', valueOf('switch-off'))).toBeLessThan(3);
    expect(ratio('#C8C6BE', WHITE)).toBeLessThan(3);
    // On: white words on navy, and the `info` track on navy with its white thumb.
    expect(ratio(WHITE, valueOf('navy'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(valueOf('info'), valueOf('navy'))).toBeGreaterThanOrEqual(3);
  });

  it('P19.1-T2 AC-8 the yellow badge’s ✓ is navy (white would miss 3:1); the green badge’s white ✓ clears it', () => {
    expect(ratio(valueOf('navy'), valueOf('badge-potensi'))).toBeGreaterThanOrEqual(3);
    expect(ratio(WHITE, valueOf('badge-potensi'))).toBeLessThan(3);
    expect(ratio(WHITE, valueOf('badge-won'))).toBeGreaterThanOrEqual(3);
    // The two discs barely differ in lightness: colour can never be the only signal (1.4.1).
    expect(ratio(valueOf('badge-potensi'), valueOf('badge-won'))).toBeLessThan(3);
  });

  it('P19.1-T6 AC-4 the n potensi pill and a kandidat’s initials are 4.5:1 text', () => {
    expect(ratio(valueOf('pill-potensi-ink'), valueOf('pill-potensi'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(valueOf('avatar-kandidat-ink'), valueOf('avatar-kandidat'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(valueOf('pill-green-ink'), valueOf('pill-green'))).toBeGreaterThanOrEqual(4.5);
  });
});
