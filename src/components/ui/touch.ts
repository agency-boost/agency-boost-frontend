/**
 * **A finger's sizes in the field shell, on a phone *and* a tablet** (UI V1, UI-010; ADR-0180): every tap target 44 ×
 * 44px at least below 1024px, a field 48px tall, and an ⓘ that stays small to the eye with a 44px area that takes the
 * tap. From 1024px the controls are as they were (≥32px, a pointer's).
 *
 * **The field shell's alone** — every class here carries `[:root:has([data-surface=v1])_&]`, which holds while the field
 * shell's frame (`data-surface='v1'`, `AppShell`) is in the document, a dialog drawn at the end of `<body>` included. The
 * office console and the platform console keep their controls as they are (UI-010's routes are the field's; the two
 * consoles keep their look but the tokens, ADR-0180). `test/harness.tsx`' `wears` reads the condition the same way.
 *
 * `phone.ts` holds the phone's half that every shell has had since UI-029 (`max-md:`); this is the rest of UI-010.
 * Strings only, and every class written out whole, as Tailwind finds a class only by its literal text.
 *
 * **Fixed in the primitives, not in pages** (UI-010: *fix the primitives, not pages*): `Button` and `buttonClass`,
 * `TextInput` and `Select`, `TippedGlyph`'s ⓘ, `Segmented`'s segments and `RouteTabs`' tabs.
 */

/** The condition every class here carries: the field shell's frame is in the document. */
export const FIELD_SHELL_VARIANT = '[:root:has([data-surface=v1])_&]';

/** A button's box: 40px from 1024px, **44px below it** (UI-010: *"Simpan goal" 111×40*, *"Buka file" 77×35*). */
export const BUTTON_TOUCH = 'max-lg:[:root:has([data-surface=v1])_&]:h-11';

/** A field's box — a text input, a select — **48px below 1024px** (UI-010: *fields 48px*; *inputs 38px*). */
export const FIELD_TOUCH = 'max-lg:[:root:has([data-surface=v1])_&]:h-12';

/** An icon or text button's target on a tablet, as `TAP_TARGET` is on a phone: 44 × 44px, its content centred. */
export const TAP_TARGET_TABLET = 'md:max-lg:[:root:has([data-surface=v1])_&]:min-h-11 '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:min-w-11 md:max-lg:[:root:has([data-surface=v1])_&]:justify-center';

/** The glyph in a line of words keeps its own box on a tablet as on a phone (`TippedGlyph`): undoes the target above. */
export const GLYPH_BOX_TABLET = 'md:max-lg:[:root:has([data-surface=v1])_&]:min-h-0 '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:min-w-0';

/** `TAP_AREA` on a tablet: an invisible 44 × 44px square centred on the ⓘ, which takes the tap (UI-010: *ⓘ 28×28*). */
export const TAP_AREA_TABLET = 'md:max-lg:[:root:has([data-surface=v1])_&]:after:absolute '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:after:left-1/2 md:max-lg:[:root:has([data-surface=v1])_&]:after:top-1/2 '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:after:h-[max(100%,2.75rem)] '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:after:w-[max(100%,2.75rem)] '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:after:-translate-x-1/2 '
  + 'md:max-lg:[:root:has([data-surface=v1])_&]:after:-translate-y-1/2 '
  + "md:max-lg:[:root:has([data-surface=v1])_&]:after:content-['']";

/** A segment of `Segmented`: **44px tall below 1024px** (UI-010: *mode tabs 35px*, *Bulanan/Tahunan 35px*). */
export const SEGMENT_TOUCH = 'max-lg:[:root:has([data-surface=v1])_&]:min-h-11';

/** An underlined tab of `RouteTabs`: **44px tall below 1024px**, its words at the foot as before (UI-010: *tabs 34px*). */
export const TAB_TOUCH = 'max-lg:[:root:has([data-surface=v1])_&]:pt-3';
