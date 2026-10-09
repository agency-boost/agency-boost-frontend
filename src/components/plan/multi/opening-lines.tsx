import { OpeningLine, type ScriptSize } from '../script-blocks';

/**
 * **Several opening lines, each under its own tag** (D-components; `.opening-tag`, `.opening-line`,
 * `Recruitment_Section.html:133-135`, logic `:567-570`). Its user is the Recruitment Attack Plan
 * (**P17-T3**): one line per motivation the candidate has.
 *
 * **The tag shows only when there is more than one line** (`:567-569`): a single line needs no label
 * saying what it answers, as drawn. Each line is Phase 14's `OpeningLine`, unchanged — in the display face
 * and in quotation marks — 14px apart (`.opening-line` `margin-bottom`).
 *
 * The tag is amber-ink, where the prototype's amber-dark misses 4.5:1 as small text on a card, as the
 * result's tag and the *Good fit for* block already are. **Every word is rendered as text**: the tag and
 * the line come in by props and are printed, never parsed.
 */
export function OpeningLines({
  lines,
  size = 'page',
}: {
  lines: readonly { readonly key: string; readonly tag: string; readonly text: string }[];
  size?: ScriptSize;
}) {
  const tagged = lines.length > 1;
  return (
    <div className="flex flex-col gap-3.5">
      {lines.map((line) => (
        <div key={line.key} data-opening={line.key}>
          {tagged && <p className="m-0 mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-ink">{line.tag}</p>}
          <OpeningLine text={line.text} size={size} />
        </div>
      ))}
    </div>
  );
}
