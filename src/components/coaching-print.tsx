'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { readSessionPrint, type SessionPrint } from '@/lib/coaching';
import { printAs } from '@/lib/print';
import { useCan } from '@/lib/session';

/** The paper's module (`coaching-print-view.tsx`), as `import()` answers it. */
type PaperModule = typeof import('@/components/coaching-print-view');

/** What is on the page while the print window is open: the read, and the module that draws it. */
interface Paper {
  print: SessionPrint;
  view: PaperModule;
}

/**
 * *⬇ Download as PDF* (`Overall.html:4312`; ADR-0077, P11-T10 AC-3): **a print of the session's frozen
 * snapshot**, as the Summary's *⬇ Download* is a print of the Summary (ADR-0061).
 *
 * - **From its own read**, `GET /coaching/sessions/:sessionId/print`, which the server audits and which
 *   holds no leader note: never the page on screen, which a correction or a later read could have moved.
 *   The latest finalized version, so a session being corrected prints the version that still counts.
 * - **Its content is the prototype's export** (`:11145-11187`): the title, the date line, last week's
 *   items with `[x]` and `[ ]`, the goal, the tips and the two lists of next actions, under the
 *   prototype's headings and in its empty words. No ratios, activity, leads table or notes, as there.
 * - **The session's date, not today's** (a Fix): the prototype printed the browser's today under every
 *   session it exported. A coachee's print says who led it, as the prototype's leader's own export does
 *   (`:11677`), and so does anybody's who did not lead it.
 * - **Money in the one formatter** (F-02), where the prototype's export wrote *Rp1.2M+*: **compact**, *Rp 6,5 jt / Rp 8 jt*,
 *   as every figure is but a price and the file's own (ADR-0174 §4) — a print is read, not checked against a field.
 * - **Numbered as the screen numbers them** (F1 of P11's final walk): the other action items by date,
 *   undated last, with the screen's own comparator, as the prototype sorts them before it exports
 *   (`:11044-11049`, `:11181`). *No goal set* where the archive says it, by the archive's condition (F2).
 *
 * The print view is off the screen (`hidden print:block`) and, while it is mounted, the only thing on
 * the paper (`globals.css`, `[data-print-view]`). While the print window is open the document is titled
 * for the coachee and the day, so the PDF is saved as *Coaching Session – Rina Wijaya – October 2, 2026*.
 * It leaves the page once the window closes.
 *
 * **Its words are the catalogue's** (`messages/coaching-session.tsx`, P18.98-T4) in the reader's language, the paper's
 * as the screen's; its figures in `useFigureLanguage()`'s. *Coaching Session*, its title, is kept in both (§A.2).
 *
 * **The paper is fetched with the read** (P18.99-T16, the bundle): `SessionPrintView` lives in `coaching-print-view.tsx`
 * and comes with the print's answer, both awaited before anything is put on the page, so the print window still opens on
 * a page that holds it.
 */
export function DownloadPdfButton({
  sessionId, showCoach, className,
}: {
  sessionId: string;
  /** Say who led it on the paper: for a coachee, and anybody else who did not lead it. */
  showCoach: boolean;
  className?: string;
}) {
  const figures = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).print;
  const canExport = useCan('coaching_session:export_pdf');
  const [paper, setPaper] = useState<Paper | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Printed once it is on the page, and taken off it once the window closes. Its title in the language it was asked
  // for in: a change of language while the browser's window is open prints nothing again.
  useEffect(() => {
    if (paper) printAs(paper.view.printTitle(paper.print, figures), () => setPaper(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper]);

  if (!canExport) return null;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [view, print] = await Promise.all([import('@/components/coaching-print-view'), readSessionPrint(sessionId)]);
      setPaper({ print, view });
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => void download()} disabled={busy} className={cn('gap-1', className)}>
        {/* A line icon before its label, never the ⬇ glyph (UI V1: no emoji as icons). */}
        <LineIcon name="download" className="h-4 w-4" />{t.download}
      </Button>
      {error && <div className="basis-full text-left"><ErrorBanner {...error} /></div>}
      {paper && createPortal(<paper.view.SessionPrintView print={paper.print} showCoach={showCoach} />, document.body)}
    </>
  );
}
