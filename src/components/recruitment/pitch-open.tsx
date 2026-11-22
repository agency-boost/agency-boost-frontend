'use client';

import { useState, type ReactNode } from 'react';
import { useSandboxedDocument } from '@/components/sandboxed-document';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { pitchDocumentUrl, pitchOpening, type PitchOpening, type PitchSlot } from '@/lib/recruitment-pitch';

export interface PitchOpener {
  /** How this material opens, or `null` for a slot with none. */
  kind: PitchOpening | null;
  open: () => Promise<void>;
  opening: boolean;
  error: ApiError | null;
  /** The sandboxed window an HTML page opens in (ADR-0217 §4); render it once beside the button. */
  dialog: ReactNode;
}

/**
 * **Opening a pitch material, whatever it is** (P19.21-T3 AC-6, ADR-0274) — one rule for the office's list, the cards
 * and the agents' phone rows:
 *
 * - **a link** opens in a new tab, `noopener noreferrer`, never framed and never fetched by the app;
 * - **an HTML page** opens in the sandboxed window, never a tab (P19.6-T2, ADR-0217 §4);
 * - **PowerPoint and Word** are signed for 300 seconds and **downloaded**: storage serves them as attachments named by
 *   their type (`gcs.adapter.ts`), so nothing renders them in the browser;
 * - **a PDF, an image or a video** opens in a new tab, as a PDF always did.
 *
 * The tab is opened at the tap, before the link is asked for, so a phone's pop-up blocker lets it through; it is closed
 * again if the link cannot be had.
 */
export function usePitchOpen(slot: Pick<PitchSlot, 'slot' | 'title' | 'file' | 'link'>): PitchOpener {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const page = useSandboxedDocument();
  const kind = pitchOpening(slot);

  const open = async () => {
    // Ignored while it signs, rather than disabled: a disabled button drops the focus.
    if (opening || kind === null) return;
    setError(null);
    if (kind === 'link') {
      window.open(slot.link!.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setOpening(true);
    if (kind === 'sandboxed') {
      await page.open(slot.title, async () => (await pitchDocumentUrl(slot.slot)).url)
        .catch((err: unknown) => setError(toDisplayError(err)))
        .finally(() => setOpening(false));
      return;
    }
    // A download needs no tab of its own: the attachment saves where the page is.
    const tab = kind === 'tab' ? window.open('', '_blank') : null;
    if (tab) tab.opener = null;
    try {
      // Signed a moment ago for 300 seconds, so opened as it comes (a phone's clock may run fast).
      const { url } = await pitchDocumentUrl(slot.slot);
      if (kind === 'download') window.location.assign(url);
      else if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (err) {
      tab?.close();
      setError(toDisplayError(err));
    } finally {
      setOpening(false);
    }
  };

  return { kind, open, opening, error, dialog: kind === 'sandboxed' ? page.dialog : null };
}
