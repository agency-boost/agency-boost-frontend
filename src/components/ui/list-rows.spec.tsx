import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { wears } from '@test/harness';
import { FilterChips, ListCard, ListRow, SearchPill } from './list-rows';

vi.mock('next/navigation', () => ({ usePathname: () => '/kpm/data-upload' }));

/**
 * **The Owner's rows, chips and search pill** (P19.2-T3; UI-139 to UI-142): built once in `list-rows.tsx` and drawn by
 * Data upload, All members and the settings pages.
 */
describe('P19.2-T3 the shared rows, chips and search pill', () => {
  it('P19.2-T3 AC-4 a row is 56px below 1024px and 52px from it, the whole row its title’s target, with a ›', () => {
    const open = vi.fn();
    render(
      <ListCard label="Data for Nov 2026">
        <ListRow title="Agus Prasetyo" caps meta="80005" onSelect={open} haspopup ariaLabel="Correct figures for Agus Prasetyo" />
        <ListRow title="Read only" />
      </ListCard>,
    );
    const list = screen.getByRole('list', { name: 'Data for Nov 2026' });
    const [live, still] = within(list).getAllByRole('listitem');
    for (const px of [375, 768]) expect(wears(live, px).split(' ')).toContain('min-h-14');
    expect(wears(live, 1280).split(' ')).toContain('min-h-[3.25rem]');
    const target = within(live).getByRole('button', { name: 'Correct figures for Agus Prasetyo' });
    expect(target).toHaveAttribute('aria-haspopup', 'dialog');
    // Stretched over the row, so a tap anywhere on it is a tap on the title.
    expect(target.className).toContain('after:inset-0');
    expect(target.className).toContain('uppercase');
    expect(live.querySelector('svg')).not.toBeNull();
    fireEvent.click(target);
    expect(open).toHaveBeenCalledOnce();
    // A row with nothing to open is read, and draws no ›.
    expect(within(still).queryByRole('button')).not.toBeInTheDocument();
    expect(still.querySelector('svg')).toBeNull();
  });

  it('P19.2-T3 AC-4 a row links where it has an href, its trailing controls above the stretched target', () => {
    render(
      <ListCard label="Members">
        <ListRow title="Sari Puspita" href="/people/members/m1" trailing={<button type="button">⋯</button>} />
      </ListCard>,
    );
    expect(screen.getByRole('link', { name: 'Sari Puspita' })).toHaveAttribute('href', '/people/members/m1');
    expect(screen.getByRole('button', { name: '⋯' }).parentElement!.className).toContain('z-[1]');
  });

  it('P19.2-T3 AC-4 chips are toggles that say their counts, 44px tall below 1024px and 36px from it', () => {
    const pick = vi.fn();
    render(
      <FilterChips
        label="Show members"
        active="all"
        onSelect={pick}
        chips={[{ key: 'all', label: 'All', count: 28 }, { key: 'none', label: 'Not reported', count: 3 }]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Show members' });
    const [all, none] = within(group).getAllByRole('button');
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(all).toHaveTextContent('All28');
    expect(none).toHaveAttribute('aria-pressed', 'false');
    for (const px of [375, 768]) expect(wears(none, px).split(' ')).toContain('min-h-11');
    expect(wears(none, 1024).split(' ')).toContain('min-h-9');
    // The row scrolls in its own box, never the page.
    expect(group.className).toContain('overflow-x-auto');
    fireEvent.click(none);
    expect(pick).toHaveBeenCalledWith('none');
  });

  it('P19.2-T3 AC-4 the search pill is a 44px labelled search box, its placeholder its words', () => {
    const typed = vi.fn();
    render(<SearchPill label="Cari nama atau kode agen" value="" onChange={typed} />);
    const box = screen.getByRole('searchbox', { name: 'Cari nama atau kode agen' });
    expect(box).toHaveAttribute('placeholder', 'Cari nama atau kode agen');
    expect(box.closest('label')!.className).toContain('min-h-11');
    fireEvent.change(box, { target: { value: 'Agus' } });
    expect(typed).toHaveBeenCalledWith('Agus');
  });
});
