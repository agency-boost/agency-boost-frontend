import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, wears } from '@test/harness';
import { ActivityTabs } from '@/components/activity-tabs';
import { HEADER_BUTTON, HEADER_CONTROL, SECTION_TITLE } from './header-control';
import { PersonRow } from './person-row';
import { SEGMENTS_PHONE, TAB_ROW_PHONE } from './phone';
import { RouteTabs } from './route-tabs';
import { Segmented } from './segmented';
import { StatTile } from './stat-tile';

let pathname = '/activity/log';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  pathname = '/activity/log';
});

const SIZES = [360, 375, 768, 1024, 1280] as const;
const at = (el: Element, px: number) => wears(el, px).split(' ');
const CONTROL = HEADER_CONTROL.split(' ');
/** The field shell's frame, which `touch.ts`' classes are conditional on. */
const inField = (ui: React.ReactNode) => render(<div data-surface="v1">{ui}</div>);

/**
 * **One header-control size** (P19.8-T1 AC-1; R6, D-38; ADR-0227 §1; MOB UI-171): 13px, 600, 44px tall, at every size —
 * Activity's *Log Activity · Dashboard · Ratio*, the reference. A test per shared control pins the shared style.
 */
describe('P19.8-T1 AC-1 one header-control style', () => {
  it('P19.8-T1 AC-1 MOB UI-171 the shared strings: 13px (text-base), 600, 44px — no screen variant in them', () => {
    expect(HEADER_CONTROL).toBe('min-h-11 text-base font-semibold');
    for (const cls of [...CONTROL, ...HEADER_BUTTON.split(' '), ...SECTION_TITLE.split(' ')]) {
      expect(cls).not.toMatch(/^(?:max-)?(?:sm|md|lg|xl|2xl):/);
    }
    expect(HEADER_BUTTON.split(' ')).toEqual(expect.arrayContaining([...CONTROL, 'rounded-pill', 'bg-card', 'whitespace-nowrap']));
  });

  it.each(SIZES)('P19.8-T1 AC-1 MOB UI-171 the reference — Log Activity · Dashboard · Ratio — at %ipx', (px) => {
    renderWithSession(<ActivityTabs />);
    for (const tab of within(screen.getByRole('navigation', { name: 'Activity management' })).getAllByRole('link')) {
      expect(at(tab, px)).toEqual(expect.arrayContaining(CONTROL));
      // From 768px it was 14px (`md:text-md`); the rule holds at every size.
      expect(at(tab, px)).not.toContain('text-md');
    }
  });

  it('P19.8-T1 AC-1 the reference is unchanged on a phone: a 44px segment of 13px / 600 words', () => {
    renderWithSession(<ActivityTabs />);
    const current = screen.getByRole('link', { name: 'Log Activity' });
    expect(at(current, 375)).toEqual(expect.arrayContaining(['flex', 'flex-1', 'items-center', 'justify-center',
      'whitespace-nowrap', 'rounded-pill', 'px-2', 'min-h-11', 'text-base', 'font-semibold', 'bg-secondary', 'text-secondary-contrast']));
  });

  it.each(SIZES)('P19.8-T1 AC-1 MOB UI-171 a Segmented segment at %ipx, in the field shell and out of it', (px) => {
    for (const host of [inField, render]) {
      const { unmount } = host(
        <Segmented label="Mode" tabs={[{ id: 'a', label: 'Bulanan' }, { id: 'b', label: 'Tahunan' }]} active="a" onSelect={() => {}}>
          {() => null}
        </Segmented>,
      );
      for (const tab of screen.getAllByRole('tab')) expect(at(tab, px)).toEqual(expect.arrayContaining(CONTROL));
      unmount();
    }
  });

  it.each(SIZES)('P19.8-T1 AC-1 MOB UI-171 a RouteTabs tab at %ipx — 44px by its own height, its words at the foot', (px) => {
    pathname = '/user-management/leader';
    render(
      <RouteTabs
        label="User Management"
        tabs={[
          { href: '/user-management/leader', label: 'Find Your Leader' },
          { href: '/user-management/add', label: 'Add Members' },
          { href: '/user-management/roster', label: 'Locked', locked: true, hint: 'Not yet' },
        ]}
      />,
    );
    const tabs = [...screen.getAllByRole('link'), screen.getByText('Locked')];
    for (const tab of tabs) {
      expect(at(tab, px)).toEqual(expect.arrayContaining([...CONTROL, 'inline-flex', 'items-end']));
      expect(at(tab, px)).not.toContain('text-md');
    }
  });

  it('P19.8-T1 AC-6 a phone’s scrolling tab track stays, the fallback for a label an office typed too long', () => {
    render(
      <>
        <RouteTabs label="Tabs" tabs={[{ href: '/user-management/leader', label: 'Find Your Leader' }]} />
        <Segmented label="Mode" tabs={[{ id: 'a', label: 'Bulanan' }]} active="a" onSelect={() => {}}>{() => null}</Segmented>
      </>,
    );
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toHaveClass(...TAB_ROW_PHONE.split(' '));
    expect(screen.getByRole('tablist', { name: 'Mode' })).toHaveClass(...SEGMENTS_PHONE.split(' '));
  });
});

/** **Type sizes on a phone** (P19.8-T1 AC-4; ADR-0227 §7; MOB UI-168), where the piece is shared. */
describe('P19.8-T1 AC-4 the shared pieces’ type on a phone', () => {
  it('P19.8-T1 AC-4 MOB UI-168 StatTile: its label 13px below 768px and 12px from it; its chips 12px', () => {
    render(<StatTile label="Aktivitas saya" value={3} chips={[{ key: 'u', label: <><b>2</b> Unit</> }]} />);
    const label = screen.getByText('Aktivitas saya');
    expect(at(label, 375)).toContain('text-base');
    expect(at(label, 360)).toContain('text-base');
    for (const px of [768, 1024, 1280]) {
      expect(at(label, px)).toContain('text-sm');
      expect(at(label, px)).not.toContain('text-base');
    }
    const chip = screen.getByText('Unit').closest('li')!;
    for (const px of SIZES) expect(at(chip, px)).toContain('text-sm');
  });

  it('P19.8-T2 AC-4 MOB UI-166 StatTile `fill`: the value takes the number row’s free width; off, the tile is as before', () => {
    const { unmount } = render(<StatTile label="Aktivitas saya" value={<a href="/activity/log" className="w-full">+ Log</a>} fill />);
    const box = screen.getByRole('link', { name: '+ Log' }).parentElement!;
    expect(box).toHaveClass('min-w-0', 'flex-1', 'whitespace-nowrap', 'text-[1.625rem]');
    expect(box.parentElement).toHaveClass('flex', 'items-center');
    unmount();
    render(<StatTile label="Jadwal hari ini" value={2} />);
    const plain = screen.getByText('2');
    expect(plain.getAttribute('class')).toBe('whitespace-nowrap text-[1.625rem] font-semibold leading-none tabular-nums text-ink');
  });

  it('P19.8-T1 AC-4 MOB UI-168 PersonRow: a name 13px on a phone, where it was 15px; 13px on a tablet and 14px on a desktop as before', () => {
    render(<PersonRow name="Agus Prasetyo" href="/unit/dashboard/m-1" />);
    const name = screen.getByRole('link', { name: 'Agus Prasetyo' });
    const size = (px: number) => at(name, px).filter((c) => /^text-(?:sm|base|md|\[)/.test(c)).at(-1);
    expect(size(360)).toBe('text-base');
    expect(size(375)).toBe('text-base');
    expect(size(768)).toBe('text-base');
    expect(size(1280)).toBe('text-md');
  });

  it('P19.8-T1 AC-4 a caller’s own size stands, on a phone too (14px: the Coaching list, Home’s team, the roster)', () => {
    render(<PersonRow name="Agus Prasetyo" href="/x" nameClassName="text-md md:max-lg:text-md" />);
    const name = screen.getByRole('link', { name: 'Agus Prasetyo' });
    for (const px of [360, 375, 768, 1280]) {
      expect(at(name, px)).toContain('text-md');
      expect(at(name, px)).not.toContain('text-base');
    }
    // Never cut on a phone, whoever sets the size.
    expect(at(name, 375)).toEqual(expect.arrayContaining(['whitespace-normal', 'break-words']));
  });
});

/** **Names are never cut** (P19.8-T1 AC-5; ADR-0227 §5; MOB UI-165, MOB UI-178): a person's name wraps on a phone. */
describe('P19.8-T1 AC-5 a person’s name is never cut on a phone', () => {
  const FORTY = 'INDAH PERMATASARI KUSUMAWARDHANI SETIAWATI';

  it('P19.8-T1 AC-5 a 40-character name at 360px wraps to a second line: no nowrap, no ellipsis, every letter there', () => {
    expect(FORTY.length).toBeGreaterThanOrEqual(40);
    for (const props of [{ href: '/unit/dashboard/m-1' }, { onSelect: () => {} }, {}]) {
      const { unmount } = render(<PersonRow name={FORTY} {...props} />);
      const name = screen.getByText(FORTY);
      expect(name).toHaveTextContent(FORTY);
      const worn = at(name, 360);
      expect(worn).toEqual(expect.arrayContaining(['whitespace-normal', 'break-words']));
      // `truncate` stays in the list for 768px and wider; below it `whitespace-normal` comes later in the stylesheet
      // (a screen variant after every bare class) and wins, so nothing is cut.
      expect(worn).not.toContain('line-clamp-1');
      expect(worn).not.toContain('line-clamp-2');
      unmount();
    }
  });

  it('P19.8-T1 AC-5 the row grows for the second line: a least height, never a fixed one', () => {
    render(<PersonRow name={FORTY} href="/x" />);
    const row = screen.getByText(FORTY).closest('[data-person-row]')!;
    expect(at(row, 360)).toContain('min-h-14');
    expect(at(row, 360).some((c) => /^h-\d/.test(c))).toBe(false);
  });

  it('P19.8-T1 AC-5 from 768px a name keeps its one line, as the tablet and laptop layouts do (MOB UI-165, UI-178: Mobile)', () => {
    render(<PersonRow name={FORTY} href="/x" />);
    const name = screen.getByText(FORTY);
    for (const px of [768, 1024, 1280]) {
      expect(at(name, px)).toContain('truncate');
      expect(at(name, px)).not.toContain('whitespace-normal');
    }
  });
});
