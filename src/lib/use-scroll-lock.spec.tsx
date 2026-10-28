import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useScrollLock } from './use-scroll-lock';

function Layer({ active = true }: { active?: boolean }) {
  useScrollLock(active);
  return null;
}

/**
 * **One lock for every layer** (P18.96-T1 AC-2): a dialog, a sheet, a drawer or the phone's menu holds the page
 * behind still while it is open, and gives `body` back as it was.
 */
describe('useScrollLock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('P18.96-T1 AC-2 holds the page still while a layer is open, and puts back what body said before', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<Layer />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('P18.96-T1 AC-2 a layer that is not open locks nothing, and opening it locks', () => {
    const { rerender } = render(<Layer active={false} />);
    expect(document.body.style.overflow).toBe('');
    rerender(<Layer active />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Layer active={false} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('P18.96-T1 AC-2 nested locks nest: closing a dialog over the drawer leaves the page held until the drawer closes', () => {
    document.body.style.overflow = 'scroll';
    function Stack({ drawer, dialog }: { drawer: boolean; dialog: boolean }) {
      return (
        <>
          {drawer && <Layer />}
          {dialog && <Layer />}
        </>
      );
    }
    const { rerender } = render(<Stack drawer dialog={false} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Stack drawer dialog />);
    expect(document.body.style.overflow).toBe('hidden');

    // Counted, not toggled: the inner one letting go must not free the page under the outer.
    rerender(<Stack drawer dialog={false} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Stack drawer={false} dialog={false} />);
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('P18.96-T1 AC-2 the outer layer closing first still frees the page only when the last one goes', () => {
    function Stack({ outer, inner }: { outer: boolean; inner: boolean }) {
      return (
        <>
          {outer && <Layer />}
          {inner && <Layer />}
        </>
      );
    }
    const { rerender } = render(<Stack outer inner />);
    rerender(<Stack outer={false} inner />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Stack outer={false} inner={false} />);
    expect(document.body.style.overflow).toBe('');
  });
});
