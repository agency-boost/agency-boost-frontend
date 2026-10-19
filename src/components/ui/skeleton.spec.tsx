import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLoading from '@/app/(admin)/loading';
import AgentLoading from '@/app/(agent)/loading';
import AuthLoading from '@/app/(auth)/loading';
import TenantLoading from '@/app/(tenant)/loading';
import {
  PageSkeleton,
  Skeleton,
  SkeletonBar,
  SkeletonCards,
  SkeletonPeople,
  SkeletonTable,
  SkeletonTree,
} from './skeleton';

/**
 * P3.5-T14 Stage 3. Two things have to hold at once and they pull in opposite directions:
 * a wait must be *announced*, and a grid of blank bars must not be *read out*.
 */
describe('skeleton', () => {
  it('announces the wait once and hides the bars from assistive technology', () => {
    render(
      <Skeleton label="Loading the roster…">
        <SkeletonBar />
        <SkeletonBar />
      </Skeleton>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading the roster…');
    // One sentence, not one per bar: the visual tree sits under `aria-hidden`, so a
    // screen reader hears that a wait started and nothing else.
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('stops pulsing under prefers-reduced-motion', () => {
    // A repeating pulse is exactly what the preference exists to switch off, and the
    // variant is the only thing standing between us and ignoring it.
    const { container } = render(<SkeletonBar />);
    expect(container.firstElementChild).toHaveClass('animate-pulse', 'motion-reduce:animate-none');
  });

  // These two read the DOM rather than the accessibility tree, and that is the point:
  // the bars sit under `aria-hidden`, so `getByRole('table')` finds nothing here. A
  // skeleton that *is* reachable by role is the bug, not the passing assertion.
  it('builds the table from the columns it is given, so it is the width of the real one', () => {
    const { container } = render(
      <SkeletonTable caption="Office roster" columns={['Name', 'Agent code', 'Role']} rows={4} />,
    );

    expect([...container.querySelectorAll('th')].map((h) => h.textContent)).toEqual([
      'Name',
      'Agent code',
      'Role',
    ]);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(container.querySelector('[role="status"]')).toHaveTextContent(
      'Loading office roster…',
    );
  });

  it('honours a visually hidden column, because the real table has one', () => {
    const { container } = render(
      <SkeletonTable
        caption="Groups"
        columns={['Group', { label: 'Actions', visuallyHidden: true }]}
        rows={1}
      />,
    );
    const headers = [...container.querySelectorAll('th span')];
    expect(headers.map((h) => h.textContent)).toEqual(['Group', 'Actions']);
    expect(headers[1]).toHaveClass('sr-only');
  });

  it('has no axe violations in any of its shapes', async () => {
    render(
      <div>
        <SkeletonTable caption="Office roster" columns={['Name', 'Role']} />
        <SkeletonCards count={2} />
        <SkeletonPeople count={2} />
        <SkeletonTree rows={3} />
        <PageSkeleton />
      </div>,
    );
    const { violations } = await axe(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(violations ?? []).toHaveLength(0);
  });
});

/**
 * The route-group boundaries. They are one line each, and that line is the difference
 * between a sidebar click showing something and showing the previous screen frozen.
 */
describe('route group loading boundaries', () => {
  it.each([
    ['admin', AdminLoading],
    ['tenant', TenantLoading],
    ['agent', AgentLoading],
    ['auth', AuthLoading],
  ])('%s announces a wait', (_name, Loading) => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});
