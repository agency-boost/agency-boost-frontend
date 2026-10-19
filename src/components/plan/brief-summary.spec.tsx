import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefSummary } from './brief-summary';

/** **The brief summary** (D-components; P14-T8 AC-3; second user P17-T3). */
describe('BriefSummary', () => {
  it('names each answer by its question, in order', () => {
    render(
      <BriefSummary
        label="Customer brief"
        items={[{ label: 'Need: ', value: 'Health' }, { label: 'Age: ', value: '25–34' }, { label: 'Budget: ', value: 'Lump-sum' }]}
      />,
    );
    const strip = screen.getByLabelText('Customer brief');
    expect(strip.tagName).toBe('DL');
    expect(strip.textContent).toBe('Need: HealthAge: 25–34Budget: Lump-sum');
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Need: ', 'Age: ', 'Budget: ']);
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(['Health', '25–34', 'Lump-sum']);
  });
});
