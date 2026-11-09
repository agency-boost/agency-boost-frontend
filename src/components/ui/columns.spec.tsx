import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { wears } from '@test/harness';
import { ColumnFlow, FitColumns, PAIRED_ROW } from './columns';

/**
 * **The columns every tablet and laptop page lays the phone's parts out in** (P19.1-T1 AC-2, AC-3, ADR-0196; UI-113,
 * UI-114). jsdom lays nothing out, so what is pinned is what each element asks for at each width.
 */
describe('ColumnFlow (P19.1-T1 AC-2; UI-113)', () => {
  it('P19.1-T1 AC-2 two columns from 768px, filled down the first and then the second, each card kept whole', () => {
    render(
      <ColumnFlow>
        <section>Leads Generation</section>
        <section>Selling</section>
        <section>Recruitment</section>
      </ColumnFlow>,
    );
    const flow = document.querySelector('[data-column-flow]')!;
    expect(wears(flow, 768).split(' ')).toEqual(expect.arrayContaining(['columns-2', 'gap-3']));
    const wrappers = Array.from(flow.children);
    expect(wrappers).toHaveLength(3);
    for (const wrapper of wrappers) {
      expect(wears(wrapper, 768).split(' ')).toEqual(expect.arrayContaining(['break-inside-avoid', 'pb-3']));
    }
    // The reading order is the order given: down the first column, then the second.
    expect(wrappers.map((w) => w.textContent)).toEqual(['Leads Generation', 'Selling', 'Recruitment']);
  });

  it('P19.1-T1 AC-7 leaves a phone as it was: below 768px neither the flow nor its wrappers wear anything', () => {
    render(<ColumnFlow><section>A</section>{null}{false}<section>B</section></ColumnFlow>);
    const flow = document.querySelector('[data-column-flow]')!;
    expect(wears(flow, 375)).toBe('');
    expect(flow.children).toHaveLength(2);
    for (const wrapper of Array.from(flow.children)) expect(wears(wrapper, 375)).toBe('');
  });
});

describe('FitColumns (P19.1-T1 AC-3; UI-114)', () => {
  it('P19.1-T1 AC-3 switches a column on only when it keeps its minimum width, and stacks below it', () => {
    render(<FitColumns min={360}><div>one</div><div>two</div></FitColumns>);
    const grid = document.querySelector<HTMLElement>('[data-fit-columns]')!;
    expect(grid.style.getPropertyValue('--fit-column-min')).toBe('360px');
    const worn = wears(grid, 1024).split(' ');
    expect(worn).toContain('grid');
    expect(worn).toContain('grid-cols-[repeat(auto-fit,minmax(min(100%,var(--fit-column-min)),1fr))]');
    // A phone is one column whatever the width it has: the grid starts at 768px.
    expect(wears(grid, 375).split(' ')).toEqual(['flex', 'flex-col', 'gap-3']);
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('P19.1-T1 AC-2 keeps a label–value row at most 480px wide from 768px, a phone untouched', () => {
    render(<div data-testid="row" className={PAIRED_ROW}>Leads per activity 0,89</div>);
    const row = screen.getByTestId('row');
    expect(wears(row, 768)).toBe('max-w-[480px]');
    expect(wears(row, 375)).toBe('');
  });
});
