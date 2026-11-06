import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { linkTail, MiddleEllipsis } from './middle-ellipsis';

const LINK = 'https://staging.agencyboost.id/join?code=ACQDQT';

/** UI-124: at 768px the invite link wrapped inside its code, *"…?code=ACQD / QT"*. */
describe('MiddleEllipsis (P19.1-T1 AC-5; UI-124)', () => {
  it('P19.1-T1 AC-5 draws the link on one line, its start cut and its code whole after it', () => {
    render(<MiddleEllipsis text={LINK} tail={linkTail(LINK, 'ACQDQT')} />);
    const box = document.querySelector('[data-middle-ellipsis]')!;
    const drawn = box.querySelector('[aria-hidden="true"]')!;
    expect(drawn).toHaveClass('flex', 'whitespace-nowrap');
    const [head, tail] = Array.from(drawn.children);
    expect(head).toHaveTextContent('https://staging.agencyboost.id/join');
    expect(head).toHaveClass('truncate', 'min-w-0');
    // The code never shrinks, so it is never split nor cut.
    expect(tail).toHaveTextContent('?code=ACQDQT');
    expect(tail).toHaveClass('shrink-0');
    expect(tail.className).not.toMatch(/break-all|truncate/);
  });

  it('P19.1-T1 AC-5 says the whole link: its words for a screen reader and a test, its tooltip for a pointer', () => {
    render(<MiddleEllipsis text={LINK} tail="?code=ACQDQT" />);
    expect(screen.getByText(LINK)).toHaveClass('sr-only');
    expect(document.querySelector('[data-middle-ellipsis]')).toHaveAttribute('title', LINK);
  });

  it('keeps the tail whole only when it is the text’s end, and draws nothing for a value not sent', () => {
    expect(linkTail(LINK, 'ACQDQT')).toBe('?code=ACQDQT');
    expect(linkTail('https://app.test/join/AGUS01', 'AGUS01')).toBe('AGUS01');
    expect(linkTail('https://app.test/join', 'AGUS01')).toBe('');
    expect(linkTail(undefined, 'AGUS01')).toBe('');
    const { container } = render(<MiddleEllipsis text={undefined} tail="" />);
    expect(container.textContent).toBe('');
  });
});
