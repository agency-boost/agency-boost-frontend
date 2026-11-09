import { wears } from './harness';

/**
 * **The 44px measurement, as far as jsdom can take it** (P19.2-T3 AC-4; UI-142 and UI-135: *the measurement script
 * finds no target under 44px in `main` at 375 and 768*). jsdom lays nothing out, so a box's height is read from the
 * classes it wears at the width (`wears`): a target passes when it — or the `<label>` it sits in — wears a height or a
 * minimum height of 44px or more (`h-11`, `min-h-12`, `min-h-[3.25rem]` …), or the 44px area an ⓘ hangs round its glyph;
 * a box's `<label for>` beside it, the row a row's target is stretched over (`after:inset-0`), and the box an input is laid
 * over (`absolute inset-0`, a date field's), count as its target.
 * The walk in a browser (T4) is what measures pixels; this is what a spec can pin.
 *
 * Read: every `button`, link, `select`, `input` and `[role=tab]` under `root`, except what is not drawn at the width
 * (it or a parent wears `hidden`, or carries `hidden`) and a textarea, which is several lines tall. Returns each target
 * under 44px as *its tag and its name*, so a failure says which.
 */
export function smallTargets(root: Element, px: number): string[] {
  const targets = Array.from(root.querySelectorAll<HTMLElement>(
    'button, a[href], select, input:not([type="hidden"]), [role="tab"]',
  ));
  return targets
    .filter((el) => drawn(el, root, px))
    .filter((el) => !tall(el, px)
      && !(el.closest('label') && tall(el.closest('label')!, px))
      && !(labelFor(el) && tall(labelFor(el)!, px))
      && !(stretched(el, px) && tall(stretched(el, px)!, px))
      && !(laidOver(el, px) && tall(laidOver(el, px)!, px)))
    .map((el) => `${el.tagName.toLowerCase()} "${nameOf(el)}"`);
}

/** At least 44px: 2.75rem, Tailwind's `11`. */
const MIN_PX = 44;

function tall(el: Element, px: number): boolean {
  const worn = wears(el, px).split(' ');
  /*
   * **A tab made 44px by its padding** (`RouteTabs` in the shared shell, `TAB_TOUCH`; P19.2-T2 AC-5, UI-135's *Template
   * KPM / Pengaturan perusahaan 34px*): 12px above and below a 14px line at 1.45 — 20.3px — and its 2px rule, 46px.
   * Read only where all three hold, so a padded box of smaller words is still measured by its height.
   */
  if (worn.includes('pt-3') && worn.includes('pb-3') && (worn.includes('text-md') || worn.includes('text-lg'))) return true;
  return worn.some((token) => {
    if (token === 'after:h-[max(100%,2.75rem)]') return true;
    const step = /^(?:min-)?h-(\d+(?:\.\d+)?)$/.exec(token);
    if (step) return Number(step[1]) * 4 >= MIN_PX;
    const arbitrary = /^(?:min-)?h-\[(\d+(?:\.\d+)?)(rem|px)\]$/.exec(token);
    if (arbitrary) return Number(arbitrary[1]) * (arbitrary[2] === 'rem' ? 16 : 1) >= MIN_PX;
    return false;
  });
}

/** A box's `<label for>` beside it, which takes its tap as the box does. */
function labelFor(el: Element): Element | null {
  return el.id ? el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
}

/**
 * A row's target stretched over the row (`after:absolute after:inset-0`, `PersonRow` and `ListRow`): the box a finger
 * meets is the row it is stretched over, the nearest positioned box above it.
 */
function stretched(el: Element, px: number): Element | null {
  if (!wears(el, px).split(' ').includes('after:inset-0')) return null;
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (wears(node, px).split(' ').includes('relative')) return node;
  }
  return null;
}

/**
 * **A box laid over its face** (`absolute inset-0`: `DateField`'s transparent input over the date it shows, a `Switch`'s
 * over its track): the box a finger meets is the one it covers, the nearest positioned box above it (P19.2-T2 AC-5).
 */
function laidOver(el: Element, px: number): Element | null {
  const worn = wears(el, px).split(' ');
  if (!worn.includes('absolute') || !worn.includes('inset-0')) return null;
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (wears(node, px).split(' ').includes('relative')) return node;
  }
  return null;
}

function drawn(el: Element, root: Element, px: number): boolean {
  for (let node: Element | null = el; node && node !== root.parentElement; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    const classes = wears(node, px).split(' ');
    if (classes.includes('hidden') || classes.includes('sr-only')) return false;
  }
  return true;
}

function nameOf(el: HTMLElement): string {
  return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 60)
    || (el as HTMLInputElement).id || el.getAttribute('type') || '';
}
