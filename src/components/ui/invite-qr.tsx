'use client';

import { useEffect, useState } from 'react';

/**
 * The invite link as a QR, drawn from the same URL the link box shows.
 *
 * The prototype ships a **static placeholder** here — a 96×96 tile reading
 * `QR code preview`, with no image and no button (`User_Management_Section.html:454`).
 * Parity row I-16 called for drawing it rather than reproducing a control that does
 * nothing, and this does: the code encodes the invite URL and scans to it.
 *
 * **The encoder is loaded on demand.** `import('qrcode')` runs when this component
 * mounts, so it never enters First Load JS — the panel is behind an issued invite, and
 * most people opening the screen never see it. Everything else on the page works while
 * it loads, and if it fails the tile says so rather than showing an empty square: the
 * link and the code are both right there and do the same job.
 */
export function InviteQr({ url, size = 96 }: { url: string; size?: number }) {
  const [state, setState] = useState<{ src: string } | 'loading' | 'failed'>('loading');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { toDataURL } = await import('qrcode');
        // Rendered at twice the box so it stays sharp on a phone, which is the only
        // device anybody scans one with.
        const src = await toDataURL(url, { width: size * 2, margin: 0 });
        if (live) setState({ src });
      } catch {
        if (live) setState('failed');
      }
    })();
    return () => {
      live = false;
    };
  }, [url, size]);

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center rounded-md border border-hairline bg-card p-2 text-center text-sm text-muted"
      style={{ width: size + 16, height: size + 16 }}
    >
      {typeof state === 'object' ? (
        // The alt text names what it is, not what it looks like: a screen-reader user
        // cannot scan it, and the link beside it is the thing they want.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.src} alt="QR code for this invite link" width={size} height={size} />
      ) : state === 'loading' ? (
        <span role="status">Drawing…</span>
      ) : (
        <span>Could not draw the QR — use the link or the code.</span>
      )}
    </div>
  );
}
