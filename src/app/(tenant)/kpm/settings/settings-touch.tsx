import { DRAG_HANDLE_CLASS } from '@/components/ui/drag-handle';
import { cn } from '@/lib/cn';

/*
 * **The settings pages' own targets on a phone and a tablet** (P19.2-T3 AC-4; UI-142: *"Ubah", "Arsipkan", "Ganti
 * nama", "Hapus", "Sesuaikan", "Tinjau" text links 17px tall; "Tampilkan yang diarsipkan" checkbox 13px; tab rows 38px;
 * ⠿ 20px* — *≥ 44px: row actions in the item sheet or ⋯; "Tampilkan yang diarsipkan" as a 44px switch row; tabs 44px*).
 *
 * The shared controls take their 44px from the field shell's frame (`components/ui/touch.ts`), which the Owner's pages
 * wear once they render inside `AppShell` (ADR-0197). What is here is the pages' own, which no primitive covers.
 *
 * **Every class carries `max-lg:`**, so a laptop (1024px and wider) draws exactly what it drew, to the byte: no element
 * is added, none moved, and a class that holds below 1024px is dropped from a 1024px reading (`drawnAt`).
 */

/**
 * **The ⠿ handle: a 44 × 44px target below 1024px** (UI-142: *⠿ 20px*), the glyph centred in it; the handle as it was
 * from 1024px. A drag still never starts on a touch screen — its keys, and the ↑ ↓ a phone draws beside it, move the row.
 */
export const HANDLE_TOUCH = cn(
  DRAG_HANDLE_CLASS,
  'max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center max-lg:justify-center',
);

/**
 * **"Tampilkan yang diarsipkan" as a 44px switch row below 1024px** (UI-142), on the `<label>` that holds today's
 * checkbox and its words — so the checkbox, its name and its keys stay what they were, and from 1024px it is the
 * checkbox it was. Below 1024px:
 *
 * - the row is 44px tall and the whole of it is the target: the checkbox, transparent, covers the label;
 * - the switch is drawn by the label itself — its `::after` the 38 × 22px track, green when checked, its `::before`
 *   the knob — at the row's right, as `Switch` draws one (`field.tsx`), with the amber ring on the track for the
 *   keyboard's focus.
 *
 * No element is added: the label's pseudo-elements draw it, so a laptop's markup does not change.
 */
export const ARCHIVED_SWITCH_ROW = cn(
  'max-lg:relative max-lg:min-h-11 max-lg:w-full max-lg:cursor-pointer max-lg:pr-12',
  // The checkbox: the whole row, transparent.
  'max-lg:[&>input]:absolute max-lg:[&>input]:inset-0 max-lg:[&>input]:m-0 max-lg:[&>input]:h-full',
  'max-lg:[&>input]:w-full max-lg:[&>input]:cursor-pointer max-lg:[&>input]:opacity-0',
  // The track.
  "max-lg:after:absolute max-lg:after:right-0 max-lg:after:top-1/2 max-lg:after:h-[22px] max-lg:after:w-[38px] max-lg:after:-translate-y-1/2 max-lg:after:rounded-pill max-lg:after:bg-hairline max-lg:after:content-['']",
  'max-lg:has-[:checked]:after:bg-success',
  'max-lg:has-[:focus-visible]:after:outline max-lg:has-[:focus-visible]:after:outline-2 max-lg:has-[:focus-visible]:after:outline-offset-1 max-lg:has-[:focus-visible]:after:outline-primary',
  // The knob.
  "max-lg:before:absolute max-lg:before:right-[19px] max-lg:before:top-1/2 max-lg:before:z-[1] max-lg:before:h-4 max-lg:before:w-4 max-lg:before:-translate-y-1/2 max-lg:before:rounded-full max-lg:before:bg-card max-lg:before:shadow-sm max-lg:before:content-['']",
  'max-lg:has-[:checked]:before:right-[3px]',
);

/**
 * **A tick box's line, 44px tall below 1024px** (UI-142): a *Berlaku untuk* rung, a formula's activity — the `<label>`
 * that holds the box and its words, which is what a finger aims at. The box stays as the browser draws it.
 */
export const CHECK_LINE_TOUCH = 'max-lg:min-h-11';

/**
 * **A text button that stands on its own — *Undo* beside a staged mark — 44px tall below 1024px** (UI-142: text links
 * 17px tall), its words centred in the height. From 1024px it sits on its line as it did.
 */
export const TEXT_BUTTON_TOUCH = 'max-lg:inline-flex max-lg:min-h-11 max-lg:items-center';
