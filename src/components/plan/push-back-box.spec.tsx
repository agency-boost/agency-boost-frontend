import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PushBackBox } from './push-back-box';

/** **The push-back box** (D-components; P14-T7 AC-6; its second user is P17-T3). */
describe('PushBackBox', () => {
  it('says who says what, in words as well as colour', () => {
    render(<PushBackBox theySayLabel="They say:" theySay="Too dear." youSayLabel="You say:" youSay="Let me show you." />);
    const says = screen.getByText('They say:', { exact: false });
    expect(says).toHaveClass('text-alert');
    expect(within(says).getByText('“Too dear.”')).toBeInTheDocument();
    expect(screen.getByText('You say:')).toHaveClass('text-success');
    expect(screen.getByText('Let me show you.')).toBeInTheDocument();
  });

  it('takes its labels by props, so another plan can word them its own way', () => {
    render(<PushBackBox theySayLabel="Kandidat bilang:" theySay="a" youSayLabel="Kamu jawab:" youSay="b" />);
    expect(screen.getByText('Kandidat bilang:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Kamu jawab:')).toBeInTheDocument();
  });
});
