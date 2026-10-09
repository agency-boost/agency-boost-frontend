import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpeningLines } from './opening-lines';

const line = (key: string, tag: string, text: string) => ({ key, tag, text });

/** **Opening lines with their tags** (D-components; P17-T3 AC-4): its user is the Recruitment Attack Plan. */
describe('OpeningLines', () => {
  it('P17-T3 AC-4 one line: no tag, as drawn (`:567-569`), in quotation marks', () => {
    render(<OpeningLines lines={[line('flexibility', 'Flexibility / time freedom', 'Imagine owning your calendar.')]} />);
    expect(screen.getByText('“Imagine owning your calendar.”')).toBeInTheDocument();
    expect(screen.queryByText('Flexibility / time freedom')).not.toBeInTheDocument();
  });

  it('P17-T3 AC-4 several lines: each under its motivation’s tag, in the order given', () => {
    const { container } = render(
      <OpeningLines
        lines={[
          line('side-income', 'Extra income on the side', 'One.'),
          line('leadership', 'Building a team / leadership', 'Two.'),
        ]}
      />,
    );
    const blocks = Array.from(container.querySelectorAll('[data-opening]'));
    expect(blocks.map((b) => b.getAttribute('data-opening'))).toEqual(['side-income', 'leadership']);
    expect(blocks.map((b) => b.textContent)).toEqual(['Extra income on the side“One.”', 'Building a team / leadership“Two.”']);
    // The tag sits above its line.
    expect(blocks[0].firstElementChild).toHaveTextContent('Extra income on the side');
  });

  it('the tag is amber-ink, where the prototype’s amber-dark misses 4.5:1 on a card', () => {
    const { container } = render(<OpeningLines lines={[line('a', 'Tag A', 'x'), line('b', 'Tag B', 'y')]} />);
    expect(screen.getByText('Tag A')).toHaveClass('text-amber-ink', 'uppercase');
    expect(container.innerHTML).not.toMatch(/amber-dark/);
  });

  it('P17-T3 AC-4 renders authored words as text: a bold tag and a script tag print as characters', () => {
    const marked = 'Halo <b>Pak</b><script>noop</script>';
    const { container } = render(<OpeningLines lines={[line('a', marked, marked), line('b', marked, marked)]} />);
    expect(container.querySelector('b, script')).toBeNull();
    expect(screen.getAllByText(/<b>Pak<\/b><script>noop<\/script>/)).toHaveLength(4);
  });
});
