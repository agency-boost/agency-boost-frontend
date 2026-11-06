import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { afterEach, describe, expect, it } from 'vitest';
import { BRAND_ALIASES, asBeforeBranding } from '@test/brand-aliases';
import { StatusPill } from '@/components/ui/status-pill';
import { TonePill } from '@/components/ui/tone-pill';
import config from '../../tailwind.config';

const GLOBALS = readFileSync(join(__dirname, 'globals.css'), 'utf8');

/** `--color-<name>`'s value as `:root` declares it, the first declaration in the sheet. */
function declared(name: string): string {
  const m = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(GLOBALS);
  if (!m) throw new Error(`--color-${name} is not declared`);
  return m[1].trim();
}

async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

/**
 * **P19.6-T1 AC-1: with no branding, the app is exactly as today** (ADR-0218 §6). Each semantic token's default is the
 * token it replaced, by reference, so it cannot drift from it; the digests recorded before the sweep are read through
 * the same aliases (`test/brand-aliases.ts`), and this pins that the reading is true.
 */
describe('P19.6-T1 AC-1 the brand tokens default to today’s colours', () => {
  it.each(BRAND_ALIASES.filter(([, before]) => before !== 'white'))(
    'P19.6-T1 AC-1 --color-%s defaults to --color-%s',
    (semantic, before) => {
      expect(declared(semantic)).toBe(`var(--color-${before})`);
    },
  );

  it('P19.6-T1 AC-1 --color-secondary-contrast defaults to white, the words every navy fill carried', () => {
    expect(declared('secondary-contrast')).toBe('#ffffff');
  });

  it('P19.6-T1 AC-1 the tints are the colour at 8 % and 16 % over white (ADR-0218 §5 TINT_50, TINT_100)', () => {
    for (const family of ['primary', 'secondary']) {
      expect(declared(`${family}-50`)).toBe(`color-mix(in srgb, var(--color-${family}) 8%, #ffffff)`);
      expect(declared(`${family}-100`)).toBe(`color-mix(in srgb, var(--color-${family}) 16%, #ffffff)`);
    }
  });

  it('P19.6-T1 AC-1 today’s colours are still the values the contrast specs measure', () => {
    expect(declared('amber')).toBe('#e8954a');
    expect(declared('navy')).toBe('#1b2b4b');
    expect(declared('amber-dark')).toBe('#d97f30');
    expect(declared('amber-ink')).toBe('#a85e1b');
    expect(declared('amber-deep')).toBe('#b5651d');
    expect(declared('navy-soft')).toBe('#2e4370');
  });

  it('P19.6-T1 AC-1 every focus ring reads the focus-ring token', () => {
    expect(GLOBALS).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--color-focus-ring\);/);
  });

  it.each([
    ['bg-primary', 'primary'],
    ['bg-primary/15', 'primary'],
    ['hover:bg-primary-hover', 'primary-hover'],
    ['text-primary-contrast', 'primary-contrast'],
    ['text-primary-ink', 'primary-ink'],
    ['text-primary-deep', 'primary-deep'],
    ['text-primary-on-secondary', 'primary-on-secondary'],
    ['bg-primary-50', 'primary-50'],
    ['bg-primary-100', 'primary-100'],
    ['bg-secondary', 'secondary'],
    ['bg-secondary/[0.06]', 'secondary'],
    ['hover:bg-secondary-hover', 'secondary-hover'],
    ['text-secondary-contrast/[0.78]', 'secondary-contrast'],
    ['text-secondary-ink', 'secondary-ink'],
    ['text-secondary-muted', 'secondary-muted'],
    ['bg-secondary-50', 'secondary-50'],
    ['focus-visible:outline-focus-ring', 'focus-ring'],
    ['ring-focus-ring', 'focus-ring'],
  ])('P19.6-T1 AC-1 %s compiles from its own token', async (cls, token) => {
    const css = await compile(cls);
    expect(css).toContain(`var(--color-${token}) calc(`);
  });

  it('P19.6-T1 AC-1 reads a renamed class back as the one it replaced, and nothing else', () => {
    expect(asBeforeBranding('rounded bg-primary text-primary-contrast hover:bg-primary-hover md:text-secondary-contrast/[0.78]'))
      .toBe('rounded bg-amber text-navy hover:bg-amber-dark md:text-white/[0.78]');
    expect(asBeforeBranding('shadow-[inset_0_0_0_2px_var(--color-primary)] text-secondary-muted text-navy bg-pill-amber'))
      .toBe('shadow-[inset_0_0_0_2px_var(--color-amber)] text-on-navy-muted text-navy bg-pill-amber');
  });
});

/**
 * **P19.6-T1 AC-8: status colours stay fixed** (§B7; ADR-0218 §7). Whatever a KPM picks, a problem is red, a success
 * green and a warning amber: the status tokens never read a brand token, and the pills keep their own classes with the
 * primary set to red.
 */
describe('P19.6-T1 AC-8 the status colours never follow a KPM’s colours', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--color-primary');
  });

  it('P19.6-T1 AC-8 no status, text or surface token is declared from a brand token', () => {
    const fixed = ['success', 'alert', 'neutral', 'info', 'navy', 'ink', 'muted', 'base', 'card', 'amber', 'amber-dark',
      'amber-deep', 'amber-ink', 'navy-soft', 'role-ab', 'role-aab', 'teal', 'tugas', 'tugas-ink', 'gold',
      'pill-red', 'pill-red-ink', 'pill-amber', 'pill-amber-ink', 'pill-green', 'pill-green-ink', 'pill-grey',
      'pill-grey-ink', 'signal-red', 'signal-green', 'signal-grey', 'on-navy-red', 'on-navy-green', 'on-navy-lavender'];
    for (const name of fixed) expect(declared(name), name).not.toMatch(/--color-(?:primary|secondary|focus-ring)/);
  });

  it('P19.6-T1 AC-8 with the primary set to red, the status pills keep their own tokens', () => {
    document.documentElement.style.setProperty('--color-primary', '#d32f2f');
    const { container } = render(
      <div>
        <TonePill tone="red">Perlu perhatian</TonePill>
        <TonePill tone="amber">Perlu dipantau</TonePill>
        <TonePill tone="green">Sesuai target</TonePill>
        <StatusPill status="alert" />
        <StatusPill status="success" />
        <StatusPill status="watch" label="Watch closely" />
      </div>,
    );
    const pills = Array.from(container.querySelectorAll('span'));
    expect(pills).toHaveLength(6);
    for (const pill of pills) expect(pill.className).not.toMatch(/primary|secondary/);
    expect(pills[0]).toHaveClass('bg-pill-red', 'text-pill-red-ink');
    expect(pills[1]).toHaveClass('bg-pill-amber', 'text-pill-amber-ink');
    expect(pills[2]).toHaveClass('bg-pill-green', 'text-pill-green-ink');
    expect(pills[3]).toHaveClass('text-alert');
    expect(pills[4]).toHaveClass('text-success');
    expect(pills[5]).toHaveClass('bg-amber/15');
  });
});
