'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * **What a toast may carry besides its words** (UI V1, UI-070): one action — *Urungkan* on the Calendar's *Selesai*
 * (UI-104) — which the toast draws as a button at its end. Its label is the caller's, from the caller's catalogue.
 */
export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
}

/** The shell's `show`, for every screen and component beneath it (`ToastHost`). */
type Show = (message: string, options?: ToastOptions) => void;
const HostContext = createContext<Show | null>(null);

/**
 * **How long a toast stays: about two seconds** (UI V1, UI-070: *Stays ~2s*). It was the prototype's 2600 ms
 * (`Overall.html:6125-6129`).
 */
export const TOAST_MS = 2000;

/**
 * **A toast with an action stays longer** (UI-070's *Urungkan*): long enough to read the words and reach the button —
 * two seconds is not (WCAG 2.2.1). Five seconds, as the platforms' own *undo* snackbars give.
 */
export const TOAST_ACTION_MS = 5000;

export interface ToastMessage {
  /** A new one for every toast, so the same words twice are announced twice. */
  id: number;
  message: string;
  action?: ToastAction;
}

/**
 * One screen's toast: what it says now, and how to say something.
 *
 * **A later toast replaces an earlier one** and restarts the clock, as the prototype's single element
 * does: two saves in a row leave the second on screen for its full time, not the first's remainder.
 *
 * **Inside a shell, the shell's** (P18.95-T1 AC-6): within a `ToastHost`, `show` is the host's and
 * `toast` stays `null`, and the screen's own `<Toast>` draws nothing — so a shell has **one** toast
 * region, whichever screen or component beneath it speaks, and two toasts never stack. Outside one (a
 * component's own spec) the screen keeps a slot of its own, as before.
 */
export function useToast(duration = TOAST_MS) {
  const host = useContext(HostContext);
  const own = useOwnToast(duration);
  return host ? { toast: null, show: host } : own;
}

/** One toast slot of its own — a screen outside any shell, and the shell's host itself. */
function useOwnToast(duration: number) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<Show>((message, options) => {
    if (timer.current) clearTimeout(timer.current);
    const action = options?.action;
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message, ...(action ? { action } : {}) }));
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, action ? Math.max(duration, TOAST_ACTION_MS) : duration);
  }, [duration]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, show };
}

/**
 * The design system's toast (`components-and-patterns.md`, *Toast*; **UI V1, UI-070**): the ink surface (`#1C1C1A`),
 * 14px corners, 12px × 14px padding, 14px words, and **a line circle-check in the navy-ground green** (`#97C459`) before
 * them — **no dot** (D-27; it was the prototype's navy pill with an amber dot, parity D-07). Gone after about two seconds.
 *
 * **Where it stands** (UI-070): **below 1024px, floating above the field shell's tab bar** with 16px either side
 * (`--tab-bar-space`, which is nothing where no tab bar is drawn); **from 1024px, bottom-right, 32px from the edges**.
 *
 * **For saves and status changes, never for an error that needs action** — those stay inline, beside
 * what caused them, where the reader can act on them after the toast has gone. Every toast the coaching
 * session raises is the prototype's own sentence (P11-T8 AC-11).
 *
 * **The live region is always in the page**, empty between toasts, and the words arrive inside it: a
 * region mounted together with its text is not announced by every screen reader. `role="status"` is
 * polite, so a toast never interrupts what is being read. No animation: the toast reads the same without
 * it, for everybody who asked the system for less movement and everybody who did not.
 */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  // Inside a shell the shell's region speaks for it (`useToast`); a second one would stack.
  if (useContext(HostContext)) return null;
  return <ToastRegion toast={toast} />;
}

/** The line circle-check (UI-070): a circle and a tick, drawn as the nav's glyphs are, in the toast's green. */
function CircleCheck() {
  return (
    <svg
      aria-hidden="true"
      data-mark="toast-check"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-on-navy-green"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

/**
 * The region itself. **Above a dialog** (`z-[60]`, over `Modal`'s and the event modal's `z-50`), where
 * the action that raised it often is — an event's *Join* on a phone, where the modal is the whole screen;
 * it takes no pointer, so it never stands between a finger and the dialog. **A toast with an action takes the pointer
 * on itself alone**, so *Urungkan* can be pressed and nothing around it is covered.
 *
 * **Above the tab bar, and above a phone's action bar** (P18.95-T5 AC-1, AC-4; UI-070): below 1024px it stands 12px over
 * `--tab-bar-space` — the floating tab bar's room in the field shell, nothing elsewhere — and a screen whose save sits
 * in a bar fixed to the bottom (`ACTION_BAR_PHONE`, marked `data-action-bar`) puts it 96px higher still below 768px, clear
 * of the bar: *Activity logged ✓* and *Goal saved ✓* would otherwise cover the button they confirm. A screen that floats
 * a save pill (`FloatingSavePill`, marked `data-floating-save`) puts it 64px higher below 1024px, over the pill, which
 * stands where the toast does — on a tablet too, where no action bar lifts it (UI V1 T16).
 */
function ToastRegion({ toast }: { toast: ToastMessage | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-layer="toast"
      className={
        'pointer-events-none fixed z-[60] flex print:hidden '
        + 'max-lg:inset-x-4 max-lg:bottom-[calc(var(--tab-bar-space)+0.75rem)] max-lg:justify-center '
        + 'max-lg:[body:has([data-floating-save])_&]:bottom-[calc(var(--tab-bar-space)+4.75rem)] '
        + 'max-md:[body:has([data-action-bar])_&]:bottom-[calc(var(--tab-bar-space)+6rem)] '
        + 'lg:bottom-8 lg:right-8 lg:justify-end'
      }
    >
      {toast && (
        <p
          key={toast.id}
          className={
            'flex w-full items-center gap-2.5 rounded-[14px] bg-ink px-3.5 py-3 text-md font-medium leading-snug '
            + 'text-white shadow-modal lg:w-auto lg:max-w-[28rem]'
            + (toast.action ? ' pointer-events-auto' : '')
          }
        >
          <CircleCheck />
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.onAction}
              className="-my-2 -mr-1.5 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 font-bold text-amber hover:bg-white/10"
            >
              {toast.action.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * A toast that outlives the page that raised it: held by the shell, which stays mounted while the
 * reader moves between the routes beneath it.
 *
 * For a write whose answer is to **leave the page** — *Mark activation complete →* takes the hire to
 * their landing, and says so on the way (`Overall.html:6684-6688`, P13-T7 AC-3). A page's own `Toast`
 * goes with the page.
 *
 * **Its live region is drawn from the first toast on, not before.** Every `Skeleton` and `SaveStatus` is
 * a `status` region too, and a screen's tests reach theirs with `getByRole('status')`, which a second,
 * empty one in every shell would break. The region is mounted by the first toast and its words arrive a
 * render later, so even that first toast is announced (`Toast`, above, says why that matters).
 */
export function ToastHost({ children }: { children: ReactNode }) {
  // A host inside a host is the outer one's: one region per shell (P18.95-T1 AC-6).
  if (useContext(HostContext)) return <>{children}</>;
  return <RootToastHost>{children}</RootToastHost>;
}

function RootToastHost({ children }: { children: ReactNode }) {
  const { toast, show } = useOwnToast(TOAST_MS);
  const [asked, setAsked] = useState(0);
  const waiting = useRef<{ message: string; options?: ToastOptions } | null>(null);

  const raise = useCallback<Show>((message, options) => {
    waiting.current = { message, options };
    setAsked((n) => n + 1);
  }, []);

  useEffect(() => {
    if (waiting.current === null) return;
    const { message, options } = waiting.current;
    waiting.current = null;
    show(message, options);
  }, [asked, show]);

  return (
    <HostContext.Provider value={raise}>
      {children}
      {asked > 0 && <ToastRegion toast={toast} />}
    </HostContext.Provider>
  );
}

/** The shell's toast, or `null` outside a `ToastHost`. */
export function useHostToast(): Show | null {
  return useContext(HostContext);
}
