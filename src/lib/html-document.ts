/**
 * **An HTML file an agent opens: a lesson, a pitch page, a product page** (P19.6-T2, ADR-0217).
 *
 * The rules a reader of one keeps, written once: what an HTML file is, the address it may be drawn from, the colours
 * a lesson receives in that address's fragment, and how tall its frame is. The frame itself is `SandboxedDocument`
 * (`components/sandboxed-document.tsx`), the one component every reader and every writer's preview draws it with.
 */

/**
 * The type the API records an HTML file as (`HTML_MIME_TYPE`, backend `domain/constants/assets.ts`; metrics §B.9).
 * A mirror, pinned to that file by `html-document.spec.ts`.
 */
export const HTML_MIME_TYPE = 'text/html';

/** What a file picker offers for one: the type, and the two names an HTML file is saved under. */
export const HTML_ACCEPT = `${HTML_MIME_TYPE},.html,.htm`;

/** Whether a file the API describes is an HTML page, which is drawn only in the sandboxed frame and never linked. */
export const isHtmlDocument = (mimeType: string | null | undefined): boolean => mimeType === HTML_MIME_TYPE;

/**
 * Whether a file chosen in a picker is an HTML page: its type, or — where a desktop reports none — its name. Storage
 * still checks what arrived before anything is attached (ADR-0040), so this decides only what is sent.
 */
export const isHtmlFile = (file: { type: string; name: string }): boolean =>
  file.type === HTML_MIME_TYPE || (file.type === '' && /\.html?$/i.test(file.name));

/**
 * **The KPM's colours for a lesson** (ADR-0217 §5; ADR-0218 §5): computed by the API — `accent` the primary in its
 * readable form, `accentSoft` its 8 % tint, `ink` the secondary only where white reads 4.5:1 on it — each six
 * lower-case hexadecimal digits with no `#`. `null` when the KPM has no branding of its own or from its template.
 */
export interface LessonColours {
  accent: string;
  accentSoft: string;
  ink?: string | null;
}

const HEX = /^[0-9a-f]{6}$/;

/**
 * **The fragment a lesson reads its colours from**: `#accent=…&accentSoft=…&ink=…`, or `''` with none.
 *
 * In the fragment, never the query (ADR-0217 §5): a V4 signature covers every query parameter, so one added after
 * signing breaks the link, and a fragment never leaves the browser. **It decides nothing**: the API chose the values
 * and whether `ink` is among them; a value that is not six lower-case hex digits is left out, as the lesson's own
 * reader would leave it.
 */
export function lessonFragment(colours: LessonColours | null | undefined): string {
  if (!colours) return '';
  const pairs = (['accent', 'accentSoft', 'ink'] as const)
    .filter((name) => typeof colours[name] === 'string' && HEX.test(colours[name]!))
    .map((name) => `${name}=${colours[name]}`);
  return pairs.length > 0 ? `#${pairs.join('&')}` : '';
}

/**
 * **The colours of the reader's own office, from the session** (ADR-0218 §8): `GET /auth/me`'s `branding.lesson`, the
 * active view's KPM's — `lessonColoursOf(palette)` in the API (`backend/src/domain/branding/palette.ts`). Read through
 * this narrow shape, so a session without branding — the Super Admin's own view, an older API — reads as none and the
 * lesson keeps its own colours.
 */
export function lessonColoursOf(me: unknown): LessonColours | null {
  return (me as { branding?: { lesson?: LessonColours | null } | null } | null)?.branding?.lesson ?? null;
}

/**
 * **May this address be framed?** An `https` address on a host that is neither the app's nor the API's: a signed link
 * of the storage host (ADR-0217 §3). Anything else is never drawn — **an HTML file never runs on the app's origin**,
 * and the API never serves one. The app's policy (`frame-src`, `next.config.mjs`) refuses any bucket but this
 * environment's on top.
 */
export function isFrameableAddress(src: string, appOrigin: string, apiOrigin: string | null = null): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.origin !== appOrigin && url.origin !== apiOrigin;
}

/**
 * **The least a frame is tall, whatever the screen** (ADR-0217 §4). Above it, the frame takes the visible height below
 * its window's head, and the lesson scrolls inside it, so its own anchor links move the lesson and never the page.
 */
export const FRAME_MIN_HEIGHT_PX = 480;
