'use client';

import { Boost, Brand3dIcon, type Brand3dIconName } from '@/components/boost';
import { cn } from '@/lib/cn';

/**
 * **The sign-in page's column** (UI-102): `AUTH_PAGE`'s one column of 448px with the welcome above the form — starting
 * near the top on a phone, so Boost, the name and the form fit one screen and the 52px *Sign in* falls under the thumb;
 * centred from 768px. `relative` and clipped, for the soft shapes behind it.
 */
export const SIGN_IN_PAGE = 'relative mx-auto flex min-h-screen max-w-md flex-col justify-center overflow-hidden px-5 py-10 '
  + 'max-md:justify-start max-md:pt-6';

/** The three cards floating round Boost: what the app is for — your activity, your calendar, your list. */
const CARDS: readonly { icon: Brand3dIconName; at: string }[] = [
  { icon: 'chart', at: 'left-1 top-6 -rotate-6' },
  { icon: 'calendar', at: 'right-0 top-2 rotate-6' },
  { icon: 'checklist', at: 'bottom-3 right-3 -rotate-3' },
];

/**
 * **The welcome above the form** (UI V1, UI-102, D-11, D-12): soft background shapes in the brand's warm grey and
 * peach, **Boost pointing** on his peach circle in the middle (~200px; 168px on a phone), and the three icon cards
 * floating round him as small white cards — a bar chart, a calendar, a checklist.
 *
 * **Each card holds its 3D icon** (`Brand3dIcon`, cut from `brand/3d-icons.webp`; UI V1 T16). The card is the app's
 * own white card, and the icon is only the glyph. Decorative throughout: the page's words are the title, the line and the
 * form, and a screen reader meets them first.
 */
export function SignInWelcome() {
  return (
    <div data-sign-in-welcome="" aria-hidden="true">
      {/* The shapes: large soft discs behind the column, never under the form's words. */}
      <span className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-amber/[0.12]" />
      <span className="pointer-events-none absolute -right-28 top-40 h-72 w-72 rounded-full bg-hairline/60" />
      <div className="relative mx-auto mb-4 h-[11.5rem] w-[15rem] md:h-[13.5rem] md:w-[17rem]">
        <Boost pose="pointing" size={200} priority className="absolute left-1/2 top-0 h-auto -translate-x-1/2 max-md:w-[168px]" />
        {CARDS.map((card) => (
          <span
            key={card.icon}
            data-sign-in-card={card.icon}
            className={cn(
              'absolute flex h-12 w-12 items-center justify-center rounded-row bg-card text-navy shadow-bar',
              card.at,
            )}
          >
            <Brand3dIcon name={card.icon} size={30} />
          </span>
        ))}
      </div>
    </div>
  );
}
