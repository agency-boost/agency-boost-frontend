'use client';

import Link from 'next/link';
import { useId } from 'react';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { pageFrameMessages } from '@/i18n/messages/page-frame';
import { cn } from '@/lib/cn';

/** One onward link from a sign: where to go, meanwhile, for something that works today. */
export interface ElsewhereLink {
  readonly href: string;
  readonly label: string;
  readonly detail: string;
}

/**
 * The *Upcoming* pill: the nav's `.soon-pill` (`KPM_Owner.html:59`, `:882`) moved from the sidebar's
 * navy to a light ground, where it takes `ConfigBadge`'s quiet navy wash. Muted words on that wash
 * clear 4.5:1 over the card and the page (`a11y.spec.tsx`). `font-body` because inside a heading it
 * would otherwise take the heading's face, and the pill is one shape wherever it sits.
 */
function UpcomingPill({ id }: { id?: string }) {
  const t = useMessages(pageFrameMessages).upcoming;
  return (
    <span id={id} className="inline-flex whitespace-nowrap rounded-pill bg-navy/[0.06] px-2 py-0.5 font-body text-2xs font-bold uppercase tracking-wide text-muted">
      {t.pill}
    </span>
  );
}

/**
 * A route that exists so people land somewhere sensible before the screen behind it is built.
 *
 * It is a sign, not a screen with its data missing (`.claude/rules/backend-then-frontend.md`,
 * *Placeholder screens, and what makes one honest*), and it keeps that rule's three promises:
 *
 * 1. **It says what will be there, in the reader's terms, and names no phase.** A phase number is
 *    our schedule, and a customer can do nothing with it (ADR-0062 §3). The phase that builds a route
 *    lives in the route registry's *Placeholder routes* table, where the people who need it look —
 *    a number nothing renders is a number nothing keeps true, so there is no prop for one (P10.1-T2
 *    AC-1). The word is the prototypes' own for a thing not built yet: *Upcoming*, the Owner's nav
 *    pill (`KPM_Owner.html:882`), drawn in that pill's shape for a light ground.
 * 2. **It renders no data, fabricated or otherwise, and calls no endpoint.** The moment it has
 *    fixtures it is the defect the rule exists to prevent.
 * 3. **It links to what works for that role today**, so it is a signpost rather than a dead end.
 *
 * The dashed card is ours, drawn in the shell's idiom and left-aligned like the page's other cards;
 * `ComingInPhaseSection`, below, is the sign that follows the prototype's in-card idiom. The region is
 * named by the pill **and** the sentence, so a reader moving by landmarks hears *Upcoming* before what
 * will be there.
 *
 * **The name stays although the number goes.** `scripts/lib/screens.py` recognises a placeholder by
 * this component's name and import path, and a rename would make the docs and tenancy gates treat
 * every placeholder as a shipped screen.
 */
export function ComingInPhase({
  what,
  elsewhere,
}: {
  /** One sentence, in the reader's terms, about what this screen will do. */
  what: string;
  elsewhere: readonly ElsewhereLink[];
}) {
  const id = useId();
  const t = useMessages(pageFrameMessages).upcoming;
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={`${id}-state ${id}`} className="rounded-lg border border-dashed border-hairline bg-card p-6">
        <p>
          <UpcomingPill id={`${id}-state`} />
        </p>
        <h2 id={id} className="mt-2 font-display text-lg font-bold text-navy">{what}</h2>
        <p className="mt-2 text-md text-muted">{t.nothingShown}</p>
      </section>

      {elsewhere.length > 0 && (
        <div className="rounded-lg border border-card-edge bg-card p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t.whatYouCanDo}</h2>
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

/**
 * One section of a **live** page that is not built yet (the client, 2026-10-01: show the sections that
 * are ready, and mark the ones that are not). The page around it is real; this slot is a sign.
 *
 * It follows the prototype's in-card idiom for a part not there yet: **the card is the section, and
 * the title is inside it**, as the Summary's own `.summary-card` draws *Campaigns you're chasing*
 * (`Overall.html:3227-3231`), as the coming-soon `.goal-card.empty-state` does (`:3771-3776`) and as
 * the console's `.placeholder-card` does (`Superadmin.html:138-143`). So: a dashed card whose heading
 * carries the section's title **verbatim from the prototype**, its card icon when the page's other
 * cards have one, and the *Upcoming* pill inside the heading so a screen reader hears it with the
 * title; then one quiet sentence, centred at `.placeholder-card p`'s measure (`Superadmin.html:143`),
 * saying what the reader will see there.
 *
 * It takes no children and no data, fetches nothing and holds nothing focusable, by construction: the
 * three ways a sign turns into a screen with invented numbers. Like `ComingInPhase` it names no phase.
 *
 * `className` and `headingClassName` are there so the card and its heading can take the padding and
 * size of the page's other cards (`twMerge`, so `text-md` replaces the default `text-lg`).
 */
export function ComingInPhaseSection({
  title,
  what,
  icon,
  className,
  headingClassName,
}: {
  /** The section's title as the prototype prints it. */
  title: string;
  /** One sentence, in the reader's terms, about what this section will show. */
  what: string;
  /** The card's icon, drawn as the page's other cards draw theirs. */
  icon?: NavIconName;
  className?: string;
  headingClassName?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-lg border border-dashed border-hairline bg-card px-5 py-4', className)}
    >
      <h2
        id={id}
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-lg font-bold text-navy',
          headingClassName,
        )}
      >
        {icon && <NavIcon name={icon} className="h-[17px] w-[17px] text-navy-soft" />}
        {title}{' '}
        <UpcomingPill />
      </h2>
      <p className="mx-auto mt-3 max-w-[460px] py-4 text-center text-md text-muted">{what}</p>
    </section>
  );
}
