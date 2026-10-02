'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
 */
export function useToast(duration = TOAST_MS) {
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
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 print:hidden"
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
