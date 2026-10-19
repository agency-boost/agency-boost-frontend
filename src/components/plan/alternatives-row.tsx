/**
 * **The alternatives row** (D-components; `.also-fits`, `Overall.html:9696-9700`, styles `:2502-2506`): a
 * line saying what the chips are, a chip per alternative, and a line counting the rest.
 *
 * Props only, so the Recruitment Attack Plan (**P17-T3**, its second user) offers a candidate's other
 * routes the same way. Which alternatives, and in what order, is the caller's — on the Sales Attack Plan,
 * the server's (D-alternatives) — and this draws them as given, every time.
 */
export function AlternativesRow({
  label,
  items,
  onPick,
  more,
}: {
  label: string;
  items: readonly { readonly key: string; readonly label: string }[];
  onPick: (key: string) => void;
  /** The *more* line, or nothing. */
  more?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1">
      <p className="m-0 mb-2.5 text-base text-muted">{label}</p>
      <div className="flex flex-wrap">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(item.key)}
            className="mb-2 mr-2 inline-flex items-center gap-2 rounded-pill border border-hairline bg-card px-3.5 py-[7px] text-base font-semibold text-navy hover:border-navy"
          >
            {item.label}
          </button>
        ))}
      </div>
      {more && <p className="m-0 mt-1.5 text-base text-muted">{more}</p>}
    </div>
  );
}
