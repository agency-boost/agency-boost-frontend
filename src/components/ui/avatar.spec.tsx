import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, tintFor } from './avatar';

/**
 * **The shared avatar's placeholder** (P19.11-T2 AC-4; UX-14: *show a placeholder while the image loads*). Every list that
 * draws a photo — New Hires' circle, the Unit roster, coaching, the forum — shows the person's own tint until the photo
 * has loaded, then the photo on nothing; a photo that fails still falls back to the initials.
 */
describe('Avatar — the placeholder while a photo loads (P19.11-T2 AC-4)', () => {
  const PHOTO = 'https://cdn.test/kemal.jpg?sig=abc';
  const tint = (seed: string) => tintFor(seed).split(' ');

  it('P19.11-T2 AC-4 shows the person’s seeded tint behind the photo until it loads, then takes it off', () => {
    const { container } = render(<Avatar name="Kemal Pratama" photoUrl={PHOTO} seed="mem-kemal" size={28} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', PHOTO);
    expect(img).toHaveClass(...tint('mem-kemal'));
    expect(img).not.toHaveAttribute('data-loaded');
    fireEvent.load(img);
    expect(img).toHaveAttribute('data-loaded');
    for (const cls of tint('mem-kemal')) expect(img).not.toHaveClass(cls);
    // Its size and its shape are the avatar's throughout.
    expect(img).toHaveStyle({ width: '28px', height: '28px' });
    expect(img).toHaveClass('rounded-full', 'object-cover');
  });

  it('P19.11-T2 AC-4 a new photo shows the placeholder again until it loads', () => {
    const { container, rerender } = render(<Avatar name="Kemal Pratama" photoUrl={PHOTO} seed="mem-kemal" />);
    fireEvent.load(container.querySelector('img')!);
    rerender(<Avatar name="Kemal Pratama" photoUrl={`${PHOTO}&v=2`} seed="mem-kemal" />);
    expect(container.querySelector('img')).not.toHaveAttribute('data-loaded');
    expect(container.querySelector('img')).toHaveClass(...tint('mem-kemal'));
  });

  it('P19.11-T2 AC-4 keeps the rest: a photo that fails falls back to the initials on the tint; none draws initials; hidden from a reader', () => {
    const { container } = render(<Avatar name="Kemal Pratama" photoUrl={PHOTO} seed="mem-kemal" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    const initials = container.firstElementChild as HTMLElement;
    expect(initials).toHaveTextContent(/^KP$/);
    expect(initials).toHaveClass(...tint('mem-kemal'));
    expect(initials).toHaveAttribute('aria-hidden', 'true');

    const none = render(<Avatar name="Tari Wulandari" photoUrl={null} />).container.firstElementChild as HTMLElement;
    expect(none).toHaveTextContent(/^TW$/);
    expect(none).toHaveClass(...tint('Tari Wulandari'));
  });
});
