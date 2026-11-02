import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InLanguage } from '@test/harness';
import { Boost, BOOST_QUOTE_POSES, BOOST_WIDTHS, boostArt, Brand3dIcon, BRAND_3D_ICON_WIDTHS } from './boost';
import { GoalHeroCard } from './goal-hero-card';

describe('GoalHeroCard (UI V1, UI-054)', () => {
  const card = (percent: number | null) => (
    <InLanguage language="id">
      <GoalHeroCard
        title="Target vs. realisasi (APE)"
        percent={percent}
        achieved="Rp 29 jt"
        target="dari target Rp 94,7 jt"
        facts={[{ label: 'Sisa bulan ini', value: 'Rp 65,7 jt' }, { label: 'Polis yang dibutuhkan', value: '± 4 polis' }]}
      />
    </InLanguage>
  );

  it('UI-054 one orange card: the title and its % badge, the figure and its target, the bar, the foot split in two', () => {
    render(card(31));
    const hero = document.querySelector('[data-goal-hero]')!;
    expect(hero).toHaveClass('bg-amber', 'rounded-lg', 'text-navy');
    expect(screen.getByText('31%')).toHaveClass('bg-card', 'text-amber-ink');
    expect(screen.getByText('Rp 29 jt')).toHaveClass('font-extrabold');
    expect(screen.getByText('dari target Rp 94,7 jt')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '31');
    expect(bar).toHaveAttribute('aria-valuetext', '31% dari target');
    const terms = [...hero.querySelectorAll('dt')].map((d) => d.textContent);
    expect(terms).toEqual(['Sisa bulan ini', 'Polis yang dibutuhkan']);
    expect(hero.querySelectorAll('dd')[1]).toHaveClass('text-2xl', 'font-bold');
    expect(hero.querySelectorAll('dl > div')[1]).toHaveClass('border-l');
  });

  it('UI-054 no "Kurang … polis · … minggu lagi" line; past 100% the bar is full; no target is "–"', () => {
    const { rerender } = render(card(140));
    expect(document.body.textContent).not.toMatch(/minggu/);
    expect(document.querySelector('[style*="width: 100%"]')).not.toBeNull();
    expect(screen.getByText('140%')).toBeInTheDocument();
    rerender(card(null));
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});

describe('Boost (UI V1, UI-102)', () => {
  it('UI-102 each pose from /brand, decorative by default, sized by its width', () => {
    render(<Boost pose="celebrating" size={120} />);
    const img = document.querySelector('[data-boost="celebrating"]')!;
    expect(img).toHaveAttribute('src', expect.stringContaining('boost-celebrating'));
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('width', '120');
    expect(img).toHaveAttribute('srcset', '/brand/boost-celebrating-120.webp 120w, /brand/boost-celebrating-240.webp 240w, '
      + '/brand/boost-celebrating-360.webp 360w');
    expect(img).toHaveAttribute('sizes', '120px');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('UI-102 draws sleeping from its own cut-out, files on disk; the quote rotates through the other four', () => {
    expect(boostArt('sleeping')).toEqual({ src: '/brand/boost-sleeping.png', width: 595, height: 399 });
    const brand = join(__dirname, '../../public/brand');
    for (const file of ['boost-sleeping.png', ...BOOST_WIDTHS.map((w) => `boost-sleeping-${w}.webp`)]) {
      expect(existsSync(join(brand, file))).toBe(true);
    }
    render(<Boost pose="sleeping" size={120} />);
    expect(document.querySelector('[data-boost="sleeping"]')).toHaveAttribute('height', '80');
    expect(BOOST_QUOTE_POSES).toEqual(['thinking', 'celebrating', 'pointing', 'phone']);
  });

  it('UI-102 the three 3D icons: each glyph and its three WebP widths on disk, decorative', () => {
    const brand = join(__dirname, '../../public/brand');
    for (const name of ['chart', 'calendar', 'checklist'] as const) {
      for (const file of [`icon3d-${name}.png`, ...BRAND_3D_ICON_WIDTHS.map((w) => `icon3d-${name}-${w}.webp`)]) {
        expect(existsSync(join(brand, file))).toBe(true);
      }
    }
    render(<Brand3dIcon name="calendar" size={48} />);
    const img = document.querySelector('[data-icon-3d="calendar"]')!;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('srcset', '/brand/icon3d-calendar-48.webp 48w, /brand/icon3d-calendar-96.webp 96w, '
      + '/brand/icon3d-calendar-144.webp 144w');
  });
});
