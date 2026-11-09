import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { wears } from '@test/harness';
import { SECTION_TITLE } from './header-control';
import { SectionHead, SectionTitle } from './section-title';

/** P19.8-T1 AC-3 (MOB UI-185; ADR-0227 §4): one section-title style, 14px / 700 in ink, at every size. */
describe('SectionTitle (P19.8-T1 AC-3)', () => {
  it('P19.8-T1 AC-3 MOB UI-185 is 14px / 700 in ink — Home’s *Aksi hari ini* — at 375, 768 and 1280', () => {
    render(<SectionTitle>Roster tim Anda</SectionTitle>);
    const title = screen.getByRole('heading', { level: 2, name: 'Roster tim Anda' });
    expect(SECTION_TITLE).toBe('text-md font-bold text-ink');
    for (const px of [375, 768, 1280]) expect(wears(title, px)).toBe('text-md font-bold text-ink');
  });

  it('P19.8-T1 AC-3 takes another level and an id, and a caller’s colour on a secondary card', () => {
    render(<SectionTitle as="h3" id="ratio" className="text-secondary-contrast">Ratio · 30 hari terakhir</SectionTitle>);
    const title = screen.getByRole('heading', { level: 3, name: 'Ratio · 30 hari terakhir' });
    expect(title).toHaveAttribute('id', 'ratio');
    expect(title).toHaveClass('text-md', 'font-bold', 'text-secondary-contrast');
    expect(title).not.toHaveClass('text-ink');
  });

  it('P19.8-T1 AC-3 SectionHead: the title, and what sits right of it, on one row', async () => {
    const { container } = render(
      <section aria-labelledby="aksi">
        <SectionHead id="aksi" title="Aksi hari ini"><a href="/calendar">Semua ›</a></SectionHead>
      </section>,
    );
    expect(screen.getByRole('region', { name: 'Aksi hari ini' })).toBeInTheDocument();
    const title = screen.getByRole('heading', { name: 'Aksi hari ini' });
    expect(title).toHaveClass(...SECTION_TITLE.split(' '));
    expect(title.parentElement).toHaveClass('flex', 'items-center', 'justify-between', 'min-h-8', 'mb-2');
    expect(screen.getByRole('link', { name: 'Semua ›' }).parentElement).toBe(title.parentElement);
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
  });
});
