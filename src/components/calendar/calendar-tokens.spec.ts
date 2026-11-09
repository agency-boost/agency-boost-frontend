import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../../tailwind.config';

/**
 * **The calendar's *Tugas* blue and today's shade** (P19.1-T3 AC-5, AC-6; UI-154; `tokens.md`, *November 2026 tokens*):
 * each class the calendar draws compiles from its own token — a class reading an undefined property renders nothing and
 * passes every jsdom test — `globals.css` holds the handover's values, and each pair clears its WCAG floor, computed
 * from those values rather than written down.
 */

/** The utilities Tailwind emits for `classes`, compiled from the real config (as `theme.spec.ts` does). */
async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
const valueOf = (name: string) => globals.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1] ?? '';

/** WCAG 2.1 relative luminance and contrast ratio. */
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

const CARD = '#FFFFFF';
const NAVY = '#1B2B4B';
const AMBER = '#E8954A';

describe('P19.1-T3 — the calendar’s Tugas and today tokens', () => {
  it.each([
    ['bg-tugas', '.bg-tugas', 'tugas'],
    ['text-tugas-ink', '.text-tugas-ink', 'tugas-ink'],
    ['border-tugas-ink', '.border-tugas-ink', 'tugas-ink'],
    ['border-tugas-edge', '.border-tugas-edge', 'tugas-edge'],
    ['max-md:bg-today', '.max-md\\:bg-today', 'today'],
    ['text-today-ink', '.text-today-ink', 'today-ink'],
  ])('P19.1-T3 AC-6 %s emits a rule mixed from its own token', async (cls, selector, token) => {
    const css = await compile(cls);
    expect(css).toContain(selector);
    expect(css).toContain(`var(--color-${token})`);
  });

  it('P19.1-T3 AC-6 globals.css holds the handover’s values (UI-154)', () => {
    expect([valueOf('tugas'), valueOf('tugas-ink'), valueOf('tugas-edge'), valueOf('today'), valueOf('today-ink')]
      .map((v) => v.toLowerCase())).toEqual(['#e3ecfb', '#1f4e9c', '#b9cdee', '#fdf1e6', '#a85a16']);
  });

  it('P19.1-T3 AC-6 a Tugas count is 4.5:1 on its pill and on the card, a ticked box’s ✓ and an unticked box’s edge clear 3:1', () => {
    expect(ratio(valueOf('tugas-ink'), valueOf('tugas'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(valueOf('tugas-ink'), CARD)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(CARD, valueOf('tugas-ink'))).toBeGreaterThanOrEqual(3);
    // The dashed border is decoration: the heading and the boxes say what the checklist is.
    expect(ratio(valueOf('tugas-edge'), CARD)).toBeLessThan(3);
  });

  it('P19.1-T3 AC-5 today’s date is 4.5:1 on its shade on a phone — where amber-ink is not — and navy on the amber circle from 768px', () => {
    expect(ratio(valueOf('today-ink'), valueOf('today'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(valueOf('amber-ink'), valueOf('today'))).toBeLessThan(4.5);
    expect(ratio(NAVY, AMBER)).toBeGreaterThanOrEqual(4.5);
    // Navy words on the shade: the Agenda's other days' words and a phone's today column's entries.
    expect(ratio(NAVY, valueOf('today'))).toBeGreaterThanOrEqual(4.5);
  });

  it('P19.1-T3 AC-6 Month’s event-count pill is the status grey, 4.5:1', () => {
    expect(ratio(valueOf('pill-grey-ink'), valueOf('pill-grey'))).toBeGreaterThanOrEqual(4.5);
  });
});
