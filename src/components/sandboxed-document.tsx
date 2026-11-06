'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { sandboxedDocumentMessages } from '@/i18n/messages/sandboxed-document';
import { apiOrigin } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  FRAME_MIN_HEIGHT_PX, isFrameableAddress, lessonColoursOf, lessonFragment, type LessonColours,
} from '@/lib/html-document';
import { SessionContext } from '@/lib/session';

/**
 * **The frame's attributes, exactly as ADR-0217 §4 states them** — and nothing else. Exported so the browser check
 * (`sandboxed-document.browser.spec.ts`) frames its probe with these very values.
 *
 * - **`sandbox="allow-scripts"` and no other token**: no `allow-same-origin`, so the page's origin is opaque — it reads
 *   no cookie, no storage and nothing of the app's page; no `allow-top-navigation`, `allow-popups`, `allow-forms`,
 *   `allow-modals` or `allow-downloads`, so it cannot move the app, open a window, submit a form, show a dialog or
 *   save a file.
 * - **`allow=""`**: no camera, microphone, location or any other feature.
 * - **`referrerpolicy="no-referrer"`**: storage is never told which page of the app asked.
 */
export const SANDBOXED_FRAME = {
  sandbox: 'allow-scripts',
  allow: '',
  referrerPolicy: 'no-referrer',
  loading: 'lazy',
} as const;

/**
 * The reader's office's lesson colours, from the session (ADR-0217 §5, ADR-0218 §8); `null` with none — and outside a
 * session, where a page that draws no lesson must not fail for want of one.
 */
export function useLessonColours(): LessonColours | null {
  return lessonColoursOf(useContext(SessionContext)?.me ?? null);
}

/** The API's origin, or `null` where none is configured: the frame refuses that host as well as the app's. */
function apiOriginOrNull(): string | null {
  try {
    return new URL(apiOrigin()).origin;
  } catch {
    return null;
  }
}

/**
 * **`SandboxedDocument`: the one way the app draws an HTML file** (P19.6-T2, ADR-0217 §4) — a lesson, a pitch page, a
 * product page, and each writer's preview of one.
 *
 * - **Only a signed link of the storage host is framed**: `https`, on a host that is neither the app's nor the API's
 *   (`isFrameableAddress`). Anything else shows a line saying the page cannot be shown, and no frame at all. The check
 *   runs once the page is in the browser, so the server's markup never carries the frame.
 * - **The KPM's colours ride in the fragment** (`lessonFragment`), which never leaves the browser.
 * - **It fills the width it is given**, at least `FRAME_MIN_HEIGHT_PX` tall; the height above that is its container's
 *   (`className`). The lesson scrolls inside it. There is no message channel between it and the page.
 * - `tabIndex={0}`, so a keyboard reaches the page inside a window that holds the focus (WCAG 2.1.1).
 */
export function SandboxedDocument({
  src,
  title,
  colours = null,
  className,
}: {
  /** The signed link, as the API answered it. */
  src: string;
  /** The item's own name: the frame's accessible name. */
  title: string;
  colours?: LessonColours | null;
  className?: string;
}) {
  const t = useMessages(sandboxedDocumentMessages);
  const [frameable, setFrameable] = useState<boolean | null>(null);

  useEffect(() => {
    setFrameable(isFrameableAddress(src, window.location.origin, apiOriginOrNull()));
  }, [src]);

  if (frameable === null) return null;
  if (!frameable) {
    return <p role="alert" className="text-md text-navy">{t.notShown}</p>;
  }
  return (
    <iframe
      src={`${src}${lessonFragment(colours)}`}
      title={title}
      sandbox={SANDBOXED_FRAME.sandbox}
      allow={SANDBOXED_FRAME.allow}
      referrerPolicy={SANDBOXED_FRAME.referrerPolicy}
      loading={SANDBOXED_FRAME.loading}
      tabIndex={0}
      data-sandboxed-document=""
      className={cn('block w-full rounded-md border border-hairline bg-card', className)}
      style={{ width: '100%', minHeight: FRAME_MIN_HEIGHT_PX }}
    />
  );
}

/** What the window shows: the item's name, and its link once the API has signed one (`null` while it is asked for). */
export interface OpenDocument {
  title: string;
  src: string | null;
}

/**
 * **The window an HTML file opens in** (ADR-0217 §4; ADR-0062 rule 3, a window opened from the item's own control): the
 * bottom sheet on a phone and a tablet, at 90 % of the screen, and a wide centred window from 1024px. The frame fills
 * its width and the height below its head. Titled with the item's name; its ✕, Escape and the backdrop close it.
 * **No *open in a new tab* and no download**: outside the frame nothing confines the page (ADR-0217 §3).
 */
export function SandboxedDocumentDialog({
  shown,
  colours,
  onClose,
}: {
  shown: OpenDocument | null;
  colours: LessonColours | null;
  onClose: () => void;
}) {
  const t = useMessages(sandboxedDocumentMessages);
  return (
    <ResponsiveSheet
      open={shown !== null}
      title={shown?.title ?? ''}
      onClose={onClose}
      className="lg:max-w-6xl"
    >
      <div data-document-window="" className="pb-1">
        {shown?.src ? (
          <SandboxedDocument
            src={shown.src}
            title={shown.title}
            colours={colours}
            className="h-[calc(90dvh-6rem)] lg:h-[calc(100dvh-8.5rem)]"
          />
        ) : (
          <p role="status" className="py-6 text-md text-muted">{t.opening}</p>
        )}
      </div>
    </ResponsiveSheet>
  );
}

/**
 * **Open an HTML file in the window, from whatever control opens it** — a training item, a pitch card, a product's
 * document, a writer's preview. `open(title, link)` shows the window at once, saying it is opening, asks `link` for
 * the signed address and draws it. If `link` fails the window closes and the promise rejects, so the control shows
 * its own error where it always has. A later `open` or `close` wins over an answer still on its way.
 */
export function useSandboxedDocument() {
  const colours = useLessonColours();
  const [shown, setShown] = useState<OpenDocument | null>(null);
  const asked = useRef(0);

  const open = useCallback(async (title: string, link: () => Promise<string>): Promise<void> => {
    const ask = ++asked.current;
    setShown({ title, src: null });
    try {
      const src = await link();
      if (asked.current === ask) setShown({ title, src });
    } catch (err) {
      if (asked.current === ask) setShown(null);
      throw err;
    }
  }, []);

  const close = useCallback(() => {
    asked.current += 1;
    setShown(null);
  }, []);

  return {
    open,
    close,
    isOpen: shown !== null,
    dialog: <SandboxedDocumentDialog shown={shown} colours={colours} onClose={close} />,
  };
}
