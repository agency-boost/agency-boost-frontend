import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComingInPhase, ComingInPhaseSection } from './coming-in-phase';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/unit/dashboard',
}));

describe('ComingInPhase', () => {
  it('names no phase: the wait carries the prototype’s word, Upcoming, and no number (P10.1-T2 AC-1)', () => {
    // A phase number is our schedule, and a customer can do nothing with it (ADR-0062 §3). The
    // phase lives in the route registry's table; the sign carries none, so no digit is rendered.
    const { container } = render(<ComingInPhase what="Your unit's activity." elsewhere={[]} />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toMatch(/phase/i);
  });

  it('says what will be here, in the reader terms, as the heading of the sign', () => {
    render(<ComingInPhase what="Recording what you did today." elsewhere={[]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Recording what you did today.' })).toBeInTheDocument();
  });

  it('names its region by the pill and the sentence, so a reader moving by landmarks hears the state first', () => {
    // The pill sits above the heading, outside it; without the pill in the name a landmark list
    // announced the sentence alone, with no cue that none of it exists yet.
    render(<ComingInPhase what="Recording what you did today." elsewhere={[]} />);
    expect(screen.getByRole('region', { name: 'Upcoming Recording what you did today.' })).toBeInTheDocument();
  });

  it('is explicit that nothing shown is standing in for the real thing', () => {
    // The line between a placeholder and a fake screen is exactly this: no fixtures, and
    // it says so rather than leaving a reader to wonder whether the zeroes are real.
    render(<ComingInPhase what="Production." elsewhere={[]} />);
    expect(
      screen.getByText('Nothing is shown here yet — not an empty version of it, and not a sample.'),
    ).toBeInTheDocument();
  });

  it('links onward, so it is a signpost and not a dead end', () => {
    render(
      <ComingInPhase
        what="Your unit."
        elsewhere={[{ href: '/profile', label: 'Your account', detail: 'Name and password.' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    expect(screen.getByText('Name and password.')).toBeInTheDocument();
  });

  it('omits the onward panel entirely when there is nowhere to send anyone', () => {
    render(<ComingInPhase what="Your unit." elsewhere={[]} />);
    expect(screen.queryByText('What you can do now')).not.toBeInTheDocument();
  });
});

describe('ComingInPhaseSection — one section of a live page, not built yet', () => {
  const section = () =>
    render(
      <ComingInPhaseSection
        title="Campaigns you're chasing"
        what="The campaigns you are chasing, and how close you are to each."
      />,
    );

  it('heads the section with the prototype’s title, the Upcoming pill inside the heading', () => {
    section();
    const heading = screen.getByRole('heading', { level: 2, name: "Campaigns you're chasing Upcoming" });
    expect(within(heading).getByText('Upcoming')).toBeInTheDocument();
    // The region is named by that heading, pill and all, so a screen reader hears the state with it.
    expect(screen.getByRole('region', { name: "Campaigns you're chasing Upcoming" })).toBeInTheDocument();
  });

  it('says what will be there, and nothing else', () => {
    const { container } = section();
    expect(screen.getByText('The campaigns you are chasing, and how close you are to each.')).toBeInTheDocument();
    // No number of any kind — not a phase, and not a sample figure standing in for a real one.
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('holds nothing to click or tab to: no link, no button, nothing focusable', () => {
    const { container } = section();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
  });

  it('is one dashed card with its title inside, as the prototype draws a card not there yet', () => {
    // `Overall.html:3227-3231` (the Summary's own card), `:3771-3776` and `Superadmin.html:138-143`
    // all put the title inside the card; a heading floating above a separate box is another idiom.
    section();
    const region = screen.getByRole('region', { name: "Campaigns you're chasing Upcoming" });
    expect(region).toHaveClass('border-dashed', 'bg-card');
    expect(region.firstElementChild).toBe(screen.getByRole('heading', { level: 2 }));
    expect(region.children).toHaveLength(2);
  });

  it('draws the card icon in the heading when it is given one, and none otherwise', () => {
    const { unmount } = section();
    expect(screen.getByRole('heading', { level: 2 }).querySelector('svg')).toBeNull();
    unmount();

    render(<ComingInPhaseSection title="Campaigns you're chasing" what="B." icon="trophy" />);
    const heading = screen.getByRole('heading', { level: 2, name: "Campaigns you're chasing Upcoming" });
    const icon = heading.querySelector('svg');
    // Drawn as the page's other cards draw theirs, and silent: the title names the card.
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass('h-[17px]', 'w-[17px]', 'text-navy-soft');
    expect(heading.firstElementChild).toBe(icon);
  });

  it('takes the page’s card padding and heading size where it is used', () => {
    render(
      <ComingInPhaseSection title="A" what="B." className="px-[22px] py-[18px] print:hidden" headingClassName="text-md" />,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    // `cn` merges with `twMerge`: the page's size and padding replace the defaults rather than joining them.
    expect(heading.className).toContain('text-md');
    expect(heading.className).not.toContain('text-lg');
    const region = screen.getByRole('region');
    expect(region).toHaveClass('print:hidden', 'px-[22px]', 'py-[18px]');
    expect(region).not.toHaveClass('px-5');
    expect(region).not.toHaveClass('py-4');
  });
});
