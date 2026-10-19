import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigBadge } from '@/components/ui/config-badge';

describe('ConfigBadge', () => {
  it('says its state in words, whichever tone it has', () => {
    render(<><ConfigBadge tone="won">Published</ConfigBadge><ConfigBadge tone="open">Draft</ConfigBadge></>);

    expect(screen.getByText('Published')).toHaveAttribute('data-tone', 'won');
    expect(screen.getByText('Draft')).toHaveAttribute('data-tone', 'open');
  });

  it('marks the open tone by its border as well as its colour', () => {
    render(<ConfigBadge tone="open">Empty</ConfigBadge>);

    expect(screen.getByText('Empty').className).toContain('border');
  });
});
