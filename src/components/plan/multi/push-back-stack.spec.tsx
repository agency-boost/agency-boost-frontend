import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PushBackStack } from './push-back-stack';

const ITEMS = [
  { key: 'no-experience', theySay: 'I\'ve never sold anything.', youSay: 'Most of our best agents hadn\'t either.' },
  { key: 'time', theySay: 'I don\'t have the time.', youSay: 'Start with a few hours a week.' },
];

/** **Push-back boxes, stacked** (D-components; P17-T3 AC-4): its user is the Recruitment Attack Plan. */
describe('PushBackStack', () => {
  it('P17-T3 AC-4 draws a box per item, in the order given, one under another', () => {
    const { container } = render(<PushBackStack theySayLabel="They say:" youSayLabel="You say:" items={ITEMS} />);
    const boxes = Array.from(container.querySelectorAll('[data-push-back]'));
    expect(boxes.map((b) => b.getAttribute('data-push-back'))).toEqual(['no-experience', 'time']);
    // `margin-bottom:10px` on every box, as drawn (`:576`).
    expect(boxes.every((b) => b.classList.contains('mb-2.5'))).toBe(true);
    expect(within(boxes[0] as HTMLElement).getByText('“I\'ve never sold anything.”')).toBeInTheDocument();
    expect(within(boxes[1] as HTMLElement).getByText('Start with a few hours a week.')).toBeInTheDocument();
  });

  it('each box says who says what in words as well as colour, with the labels it is given', () => {
    render(<PushBackStack theySayLabel="They say:" youSayLabel="You say:" items={ITEMS} />);
    expect(screen.getAllByText('They say:', { exact: false }).every((p) => p.classList.contains('text-alert'))).toBe(true);
    expect(screen.getAllByText('You say:').every((p) => p.classList.contains('text-success'))).toBe(true);
  });

  it('nothing to answer draws nothing', () => {
    const { container } = render(<PushBackStack theySayLabel="They say:" youSayLabel="You say:" items={[]} />);
    expect(container.querySelector('[data-push-back]')).toBeNull();
  });

  it('P17-T3 AC-4 renders authored words as text', () => {
    const marked = 'Halo <b>Pak</b><script>noop</script>';
    const { container } = render(
      <PushBackStack theySayLabel="They say:" youSayLabel="You say:" items={[{ key: 'a', theySay: marked, youSay: marked }]} />,
    );
    expect(container.querySelector('b, script')).toBeNull();
    expect(screen.getAllByText(/<b>Pak<\/b><script>noop<\/script>/)).toHaveLength(2);
  });
});

/**
 * **D-components for the additions**: `script-blocks.spec.tsx` holds Phase 14's pieces to this — nothing
 * about products, nothing that calls the API, and a header naming P17-T3 — over the folder's own files. The
 * additions sit one level down, so the same promise is asserted here for each of them.
 */
describe('the plan’s additions (D-components)', () => {
  it('P17-T3 AC-6 are the three, props only: nothing about products or recruitment, no API, a header naming P17-T3', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.tsx') && !f.includes('.spec.'));
    expect(files.sort()).toEqual(['multi-choice-group.tsx', 'opening-lines.tsx', 'push-back-stack.tsx']);
    for (const file of files) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect([file, /from '@\/lib\/(product-catalog|recruitment|api)/.test(src)]).toEqual([file, false]);
      expect([file, src.includes('P17-T3')]).toEqual([file, true]);
    }
  });
});
