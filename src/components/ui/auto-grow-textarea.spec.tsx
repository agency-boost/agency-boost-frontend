import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoGrowTextarea } from './auto-grow-textarea';

/**
 * The remark box's height (P13.1-T4 AC-6).
 *
 * jsdom lays nothing out, so the browser's half is stood in for: `scrollHeight` is whatever the test
 * says the content needs at the box's current width, a `ResizeObserver` the test fires by hand, and a
 * `document.fonts` whose `ready` the test resolves. What is asserted is the component's half — that it
 * asks again at each of those moments, and adds the border a border-box height includes.
 */
describe('AutoGrowTextarea (P13.1-T4 AC-6)', () => {
  /** What the content needs, in px — the stand-in for the browser's wrapping at the current width. */
  let needs = 18;
  let observed: ResizeObserverCallback | null = null;
  let fontsReady: () => void = () => {};

  beforeEach(() => {
    needs = 18;
    observed = null;
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(() => needs);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { observed = callback; }
      observe() {}
      disconnect() { observed = null; }
      unobserve() {}
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>((resolve) => { fontsReady = resolve; }) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (document as { fonts?: unknown }).fonts;
  });

  /** The observer, firing as a browser would when the box takes a new width. */
  const resizeTo = (width: number) => act(() => {
    observed?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
  });

  const box = () => screen.getByRole('textbox') as HTMLTextAreaElement;

  it('P13.1-T4 AC-6 is as tall as its content when it first draws, border included', () => {
    render(
      <AutoGrowTextarea
        aria-label="Remarks"
        value="Hobi golf"
        onChange={() => {}}
        style={{ boxSizing: 'border-box', borderStyle: 'solid', borderTopWidth: '1px', borderBottomWidth: '1px' }}
      />,
    );
    // 18px of content and padding, and the two 1px borders a border-box height has to hold as well.
    expect(box().style.height).toBe('20px');
  });

  it('P13.1-T4 AC-6 adds no border to a content-box height', () => {
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf" onChange={() => {}} style={{ boxSizing: 'content-box', borderStyle: 'solid', borderTopWidth: '1px' }} />);
    expect(box().style.height).toBe('18px');
  });

  it('P13.1-T4 AC-6 measures again when the box gets wider, so a remark that now fits on one line is one line tall', () => {
    // Measured while the column was narrow and the remark wrapped onto three lines.
    needs = 54;
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf, anak masuk kuliah" onChange={() => {}} />);
    expect(box().style.height).toBe('54px');
    // The observer's first report: the width it was drawn at.
    resizeTo(120);

    // The column settles wider; the same words fit on one.
    needs = 18;
    resizeTo(240);
    expect(box().style.height).toBe('18px');
  });

  it('P13.1-T4 AC-6 takes the observer’s first report as the width it drew at, and measures nothing for it', () => {
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf" onChange={() => {}} />);
    needs = 90;
    resizeTo(240);
    expect(box().style.height).toBe('18px');
  });

  it('P13.1-T4 AC-6 waits on no font set that has already loaded', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { status: 'loaded', ready: Promise.resolve() },
    });
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf" onChange={() => {}} />);
    needs = 90;
    await act(async () => { await Promise.resolve(); });
    expect(box().style.height).toBe('18px');
  });

  it('P13.1-T4 AC-6 ignores a resize that changes only the height — its own', () => {
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf" onChange={() => {}} />);
    resizeTo(120);
    resizeTo(240);
    needs = 90;
    // The same width again: the height it has just set, reported back. Answering it would loop.
    resizeTo(240);
    expect(box().style.height).toBe('18px');
  });

  it('P13.1-T4 AC-6 measures again once the web font has loaded', async () => {
    // The fallback font's wider letters wrapped the remark onto two lines.
    needs = 36;
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf, anak masuk kuliah" onChange={() => {}} />);
    expect(box().style.height).toBe('36px');

    needs = 18;
    await act(async () => { fontsReady(); });
    expect(box().style.height).toBe('18px');
  });

  it('P13.1-T4 AC-6 still grows with what is typed', () => {
    const { rerender } = render(<AutoGrowTextarea aria-label="Remarks" value="Hobi" onChange={() => {}} />);
    needs = 36;
    rerender(<AutoGrowTextarea aria-label="Remarks" value="Hobi golf, and a long second line" onChange={() => {}} />);
    expect(box().style.height).toBe('36px');
  });

  it('P13.1-T4 AC-6 stops listening when it goes, and measures nothing after', async () => {
    const { unmount } = render(<AutoGrowTextarea aria-label="Remarks" value="Hobi" onChange={() => {}} />);
    unmount();
    expect(observed).toBeNull();
    // A font that arrives after the row has left is no reason to touch it.
    await act(async () => { fontsReady(); });
  });

  it('P13.1-T4 AC-6 draws one line where there is no observer and no font set to wait on', () => {
    vi.unstubAllGlobals();
    delete (document as { fonts?: unknown }).fonts;
    render(<AutoGrowTextarea aria-label="Remarks" value="Hobi" onChange={() => {}} />);
    expect(box()).toHaveAttribute('rows', '1');
    expect(box().style.height).toBe('18px');
  });
});
