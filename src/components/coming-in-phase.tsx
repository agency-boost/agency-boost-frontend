import Link from 'next/link';

/**
 * A route that exists so people land somewhere sensible, before the phase that builds
 * it arrives.
 *
 * It is a sign, not a screen with its data missing. It renders nothing fabricated and
 * calls no endpoint — the moment a placeholder has fixtures it is the defect
 * `.claude/rules/backend-then-frontend.md` exists to prevent. What it does carry is the
 * phase that builds it, what will be here, and where to go meanwhile.
 */
export interface ElsewhereLink {
  readonly href: string;
  readonly label: string;
  readonly detail: string;
}

export function ComingInPhase({
  phase,
  what,
  elsewhere,
}: {
  phase: number;
  /** One sentence, in the reader's terms, about what this screen will do. */
  what: string;
  elsewhere: readonly ElsewhereLink[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-dashed border-hairline bg-card p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          Arrives in phase {phase}
        </p>
        <p className="mt-2 text-lg text-navy">{what}</p>
        <p className="mt-2 text-md text-muted">
          Nothing is shown here yet — not an empty version of it, and not a sample. When the
          screen is built, what you see will be your own office&apos;s real figures.
        </p>
      </div>

      {elsewhere.length > 0 && (
        <div className="rounded-lg border border-hairline bg-card p-6">
          <h2 className="font-display text-lg font-bold text-navy">What you can do now</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {elsewhere.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-md font-semibold text-navy underline">
                  {link.label}
                </Link>
                <span className="block text-sm text-muted">{link.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
