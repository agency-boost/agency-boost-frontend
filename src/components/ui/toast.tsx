'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** The shell's `show`, for every screen and component beneath it (`ToastHost`). */
const HostContext = createContext<((message: string) => void) | null>(null);

/**
 * How long a toast stays (`Overall.html:6125-6129`, `showToast`): 2600 ms, as
 * `components-and-patterns.md` *Toast* specifies it.
 */
export const TOAST_MS = 2600;

export interface ToastMessage {
  /** A new one for every toast, so the same words twice are announced twice. */
  id: number;
  message: string;
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

  const show = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message }));
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, duration);
  }, [duration]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, show };
}

/**
 * The design system's toast (`components-and-patterns.md`, *Toast*; parity D-07): a navy pill with an
 * amber dot, bottom centre (`Overall.html:1385-1387`), gone after 2600 ms.
 *
 * **For saves and status changes, never for an error that needs action** — those stay inline, beside
 * what caused them, where the reader can act on them after the toast has gone. Every toast the coaching
 * session raises is the prototype's own sentence (P11-T8 AC-11).
 *
 * **The live region is always in the page**, empty between toasts, and the words arrive inside it: a
 * region mounted together with its text is not announced by every screen reader. `role="status"` is
 * polite, so a toast never interrupts what is being read. No animation: the prototype's slide is the
 * one motion it has, and the toast reads the same without it, for everybody who asked the system for
 * less movement and everybody who did not.
 */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  // Inside a shell the shell's region speaks for it (`useToast`); a second one would stack.
  if (useContext(HostContext)) return null;
  return <ToastRegion toast={toast} />;
}

/**
 * The region itself. **Above a dialog** (`z-[60]`, over `Modal`'s and the event modal's `z-50`), where
 * the action that raised it often is — an event's *Join* on a phone, where the modal is the whole screen;
 * it takes no pointer, so it never stands between a finger and the dialog.
 */
function ToastRegion({ toast }: { toast: ToastMessage | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-layer="toast"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 print:hidden"
    >
      {toast && (
        <p
          key={toast.id}
          className="flex max-w-[34rem] items-center gap-2.5 rounded-[10px] bg-navy px-5 py-3 text-md font-medium text-white shadow-modal"
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber" />
          {toast.message}
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
  const waiting = useRef<string | null>(null);

  const raise = useCallback((message: string) => {
    waiting.current = message;
    setAsked((n) => n + 1);
  }, []);

  useEffect(() => {
    if (waiting.current === null) return;
    const message = waiting.current;
    waiting.current = null;
    show(message);
  }, [asked, show]);

  return (
    <HostContext.Provider value={raise}>
      {children}
      {asked > 0 && <ToastRegion toast={toast} />}
    </HostContext.Provider>
  );
}

/** The shell's toast, or `null` outside a `ToastHost`. */
export function useHostToast(): ((message: string) => void) | null {
  return useContext(HostContext);
}
