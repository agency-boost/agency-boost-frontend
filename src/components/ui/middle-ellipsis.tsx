import { cn } from '@/lib/cn';

/**
 * **One line, cut in the middle, its end whole** (P19.1-T1 AC-5, ADR-0196; UI-124: the invite link wrapped inside its code,
 * *"…?code=ACQD / QT"*). The text is drawn on one line; when it does not fit, its start ends in "…" and `tail` — the part
 * a reader must see whole, an invite link's `?code=ACQDQT` — keeps its full width after it. Never broken across lines.
 *
 * The whole text is the element's words for a screen reader and a test (`sr-only`), and its tooltip for a pointer; the
 * two drawn halves are decoration. Markup only, so a screen of either kind can draw it.
 */
export function MiddleEllipsis({
  text,
  tail,
  className,
}: {
  text: string | undefined;
  /** The end kept whole. Not the end of `text`, or empty: the text is drawn whole on one line, cut at its end. */
  tail: string;
  className?: string;
}) {
  // A value the server has not sent is drawn as nothing, as `{text}` would be — never a crash.
  const whole = text ?? '';
  const kept = tail !== '' && whole.endsWith(tail) ? tail : '';
  const head = whole.slice(0, whole.length - kept.length);
  return (
    <span data-middle-ellipsis="" title={whole || undefined} className={cn('block min-w-0', className)}>
      <span className="sr-only">{whole}</span>
      <span aria-hidden="true" className="flex min-w-0 whitespace-nowrap">
        <span className="min-w-0 truncate">{head}</span>
        {kept && <span className="shrink-0">{kept}</span>}
      </span>
    </span>
  );
}

/**
 * **What an invite link keeps whole**: from its last `?` — `?code=ACQDQT` — or, with none, from where its code starts;
 * nothing when the link holds neither, and then it is cut at its end.
 */
export function linkTail(link: string | undefined, code: string | undefined): string {
  const whole = link ?? '';
  const query = whole.lastIndexOf('?');
  if (query >= 0) return whole.slice(query);
  const at = code ? whole.lastIndexOf(code) : -1;
  return at >= 0 ? whole.slice(at) : '';
}
