/**
 * **The brief summary** (D-components; `.brief-summary`, `Overall.html:3857-3861`, styles `:2421-2424`):
 * the brief the plan was built for, in one strip — `Need: … · Age: … · Budget: …`.
 *
 * Props only, so the Recruitment Attack Plan (**P17-T3**, its second user) sums up a candidate's brief
 * the same way. The retired section file's *Edit brief* link does not ship (ADR-0062 §4): *Back* and the
 * first step's pill return to the brief.
 */
export function BriefSummary({ label, items }: {
  /** Names the strip for a screen reader. */
  label: string;
  items: readonly { readonly label: string; readonly value: string }[];
}) {
  return (
    <dl
      aria-label={label}
      className="mb-5 flex flex-wrap items-center gap-x-[22px] gap-y-2.5 rounded-lg border border-card-edge bg-card px-5 py-3.5"
    >
      {items.map((item) => (
        <div key={item.label} className="flex text-base text-muted">
          <dt className="whitespace-pre">{item.label}</dt>
          <dd className="m-0 font-semibold text-navy">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
