import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * *Not yet saved* → *Saved · 14 touches*, with a dot that turns green.
 *
 * One rule shared by the two screens that write a whole day or a whole plan at once
 * (`Overall.html:99-102` ≡ `:627-632`). It sits beside the save button rather than under the form,
 * because its job is to answer *did that land* at the moment you are looking at the button.
 *
 * **The words carry the state and the dot only repeats it.** Colour is never the only cue, and the
 * green is `--color-success`, which clears 4.5:1 on both surfaces.
 *
 * **It is the screen's live region, and a screen gets one.** `getByRole('status')` throws on two
 * matches rather than failing on content, and every `Skeleton` is a live region too — so a screen
 * that renders this while loading has two and its own tests stop being able to read either.
 */
export function SaveStatus({
  state,
  children,
  className,
}: {
  state: 'saved' | 'unsaved';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      role="status"
      data-state={state}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold',
        state === 'saved' ? 'text-success' : 'text-muted',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          state === 'saved' ? 'bg-success' : 'bg-hairline',
        )}
      />
      {children}
    </span>
  );
}
