import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession } from '@test/harness';
import { SANDBOXED_FRAME, SandboxedDocument, useSandboxedDocument } from './sandboxed-document';

/** The fake storage host: a signed link of a bucket on a host that is not the app's (`localhost`) or the API's. */
const LESSON = 'https://storage.googleapis.com/test-bucket/dev/company/c1/training/01LESSON?X-Goog-Signature=abc';
const COLOURS = { accent: 'a85e1b', accentSoft: 'fcf3ea', ink: '1b2b4b' };

/** A reader that opens one lesson, as a training item, a pitch card or a product document does. */
function Opener({ link }: { link: () => Promise<string> }) {
  const viewer = useSandboxedDocument();
  return (
    <>
      <button type="button" onClick={() => { void viewer.open('Pelajaran 01', link).catch(() => undefined); }}>Buka file</button>
      {viewer.dialog}
    </>
  );
}

/** `GET /auth/me`'s top-level `branding` (ADR-0218 §8), its `lesson` computed by the API. */
const withBranding = () => ({ ...makeMe(), branding: { kpmId: 'kpm-1', version: 2, palette: null, lesson: COLOURS } }) as never;

describe('P19.6-T2 SandboxedDocument (ADR-0217 §4)', () => {
  it('P19.6-T2 AC-2 frames the storage host’s link with sandbox="allow-scripts" and nothing else', async () => {
    render(<SandboxedDocument src={LESSON} title="Pelajaran 01" />);
    const frame = await screen.findByTitle('Pelajaran 01');
    expect(frame.tagName).toBe('IFRAME');
    // Exactly the one token: no allow-same-origin, allow-top-navigation(-by-user-activation), allow-popups, allow-forms,
    // allow-modals or allow-downloads.
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('sandbox')!.split(/\s+/)).toEqual(['allow-scripts']);
    expect(frame.getAttribute('allow')).toBe('');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(SANDBOXED_FRAME).toEqual({ sandbox: 'allow-scripts', allow: '', referrerPolicy: 'no-referrer', loading: 'lazy' });
  });

  it('P19.6-T2 AC-2 the frame’s origin is the storage host’s, not the app’s', async () => {
    render(<SandboxedDocument src={LESSON} title="Pelajaran 01" />);
    const frame = await screen.findByTitle('Pelajaran 01');
    const origin = new URL(frame.getAttribute('src')!).origin;
    expect(origin).toBe('https://storage.googleapis.com');
    expect(origin).not.toBe(window.location.origin);
  });

  it.each([
    ['the app’s own origin', `${window.location.origin}/lesson.html`],
    ['the API’s origin', 'http://api.test/api/v1/lesson.html'],
    ['plain http', 'http://storage.googleapis.com/test-bucket/x'],
    ['a data address', 'data:text/html,<p>x</p>'],
  ])('P19.6-T2 AC-2 draws no frame at all for %s, and says the page cannot be shown', async (_case, src) => {
    renderInIndonesian(<SandboxedDocument src={src} title="Pelajaran 01" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Halaman ini tidak dapat ditampilkan. Tutup, lalu coba lagi.');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('P19.6-T2 AC-4 fills the width it is given, at least 480 px tall, and is reachable by keyboard', async () => {
    render(<SandboxedDocument src={LESSON} title="Pelajaran 01" className="h-[calc(90dvh-6rem)]" />);
    const frame = await screen.findByTitle('Pelajaran 01');
    expect(frame).toHaveStyle({ width: '100%', minHeight: '480px' });
    expect(frame.className).toContain('w-full');
    expect(frame.className).toContain('h-[calc(90dvh-6rem)]');
    expect(frame.getAttribute('tabindex')).toBe('0');
  });

  it('P19.6-T2 the KPM’s colours ride in the fragment, after the signed link, and none without branding', async () => {
    const { rerender } = render(<SandboxedDocument src={LESSON} title="Pelajaran 01" colours={COLOURS} />);
    const frame = await screen.findByTitle('Pelajaran 01');
    expect(frame.getAttribute('src')).toBe(`${LESSON}#accent=a85e1b&accentSoft=fcf3ea&ink=1b2b4b`);
    // The signature's query is untouched: nothing is added to it (a V4 link refuses any parameter it did not sign).
    expect(new URL(frame.getAttribute('src')!).search).toBe('?X-Goog-Signature=abc');
    rerender(<SandboxedDocument src={LESSON} title="Pelajaran 01" colours={null} />);
    expect(screen.getByTitle('Pelajaran 01').getAttribute('src')).toBe(LESSON);
  });
});

describe('P19.6-T2 the window an HTML file opens in', () => {
  it('P19.6-T2 AC-2 opens in a window titled with the item, says it is opening, then draws the frame — never a new tab', async () => {
    let answer: (url: string) => void = () => undefined;
    const link = () => new Promise<string>((resolve) => { answer = resolve; });
    const opened: unknown[] = [];
    const realOpen = window.open;
    window.open = ((...args: unknown[]) => { opened.push(args); return null; }) as typeof window.open;
    try {
      renderWithSession(<Opener link={link} />, { me: withBranding() });
      fireEvent.click(screen.getByRole('button', { name: 'Buka file' }));
      const dialog = await screen.findByRole('dialog', { name: 'Pelajaran 01' });
      expect(dialog).toHaveTextContent('Opening…');
      await act(async () => { answer(LESSON); });
      const frame = await screen.findByTitle('Pelajaran 01');
      // The session's branding reaches the lesson.
      expect(frame.getAttribute('src')).toBe(`${LESSON}#accent=a85e1b&accentSoft=fcf3ea&ink=1b2b4b`);
      expect(opened).toEqual([]);
      // No download and no *open in a new tab*: no link to the file anywhere in the window.
      expect(dialog.querySelector('a[href]')).toBeNull();
    } finally {
      window.open = realOpen;
    }
  });

  it('P19.6-T2 closes on its ✕, and a lesson with no branding keeps its own colours', async () => {
    renderWithSession(<Opener link={async () => LESSON} />, { me: makeMe() });
    fireEvent.click(screen.getByRole('button', { name: 'Buka file' }));
    const frame = await screen.findByTitle('Pelajaran 01');
    expect(frame.getAttribute('src')).toBe(LESSON);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('P19.6-T2 closes the window when the link cannot be had, so the control says why where it always has', async () => {
    renderWithSession(<Opener link={async () => { throw new Error('404'); }} />, { me: makeMe() });
    fireEvent.click(screen.getByRole('button', { name: 'Buka file' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
