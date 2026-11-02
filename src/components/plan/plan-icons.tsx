import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { cn } from '@/lib/cn';

/**
 * **The glyphs UI V1's selling and programme pages draw that the one line-icon set lacks** (UI-107, UI-108; Phase 18.99
 * T13): a clock and a video for an event's time and place, a star for *Kejar*, a file and a file with none for Pitch
 * Materials, a ticked circle for a benefit, an arrow on the plan's button, a rocket and a magnet for a campaign. Drawn in
 * `LineIcon`'s manner — the 24×24 box, the 1.7 stroke, round joins, `currentColor`, hidden from assistive technology —
 * and a name `LineIcon` already has is drawn by it, so a pin or a target is one drawing wherever it appears.
 *
 * Kept beside the pages that use them while `line-icon.tsx` is another task's; folding them into it later changes no
 * caller's markup.
 */
const PATHS = {
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  video: <><rect x="3" y="6.5" width="12.5" height="11" rx="2" /><path d="m15.5 10.5 5-3v9l-5-3" /></>,
  star: <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  fileOff: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M3 3l18 18" /></>,
  circleCheck: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  rocket: <><path d="M12 15c4-2.5 6.5-6.5 6.5-11.5C13.5 3.5 9.5 6 7 10z" /><path d="M7 10H4l2.5-3.5h4M14 17v3l3.5-2.5V13" /><path d="M7 15c-1.5.8-2 2.6-2 4 1.4 0 3.2-.5 4-2" /></>,
  magnet: <><path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z" /><path d="M6 8h4M14 8h4" /></>,
} as const;

export type PlanIconName = keyof typeof PATHS | LineIconName;

const isOwn = (name: PlanIconName): name is keyof typeof PATHS => name in PATHS;

/** A glyph, hidden from assistive technology: the control or the words beside it carry the meaning. */
export function PlanIcon({ name, className }: { name: PlanIconName; className?: string }) {
  if (!isOwn(name)) return <LineIcon name={name} className={className} />;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5 shrink-0', className)}
    >
      {PATHS[name]}
    </svg>
  );
}
