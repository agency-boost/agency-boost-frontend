'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { joinInFlight } from '@/lib/in-flight';
import {
  FORUM_COPY, readMeeting, readSharedMeeting, type MeetingView,
} from '@/lib/leader-meetings';
import { printAs, restorePrintTitle } from '@/lib/print';
import { formatShortDay } from '@/lib/format';
import { signInPathFrom, type SessionEnd } from '@/lib/return-path';
import { useSession } from '@/lib/session';
import { LoadError, MeetingSkeleton, NotFound } from './forum-states';
import { MeetingDialog } from './meeting-dialog';
import { MeetingHead } from './meeting-head';
import { MeetingTabs, type MeetingTab } from './meeting-tabs';
import { MeetingWriterProvider, useMeetingWriter } from './meeting-writer';
import { PrintLayout } from './print-layout';
import { ShareDialog } from './share-dialog';

/** How the page was reached: the meeting's own address, or a shared link (ADR-0131). */
export type MeetingSource = { via: 'address'; meetingId: string } | { via: 'link'; token: string };

/** The prototype waits this long before the print dialog, so its line is on screen first (`:2752`). */
const PRINT_DELAY_MS = 400;

/**
 * Where a reader not signed in goes: sign in, and come back here (D-share — *"one not signed in signs in
 * first and returns to it"*). The address rides on `next` — except after the reader signed out themselves
 * (`signedOut`, 2026-10-11), when it is plain `/login`, and a session that ended under the reader adds
 * `reason=expired` (ADR-0168 §1), as `signInPathFrom` decides for every guard.
 */
export const signInAndReturn = (pathname: string, end: SessionEnd) =>
  signInPathFrom({ pathname, search: '' }, end);

/**
 * **A meeting** (`/leader-meetings/[meetingId]`, and read-only by a link at `/leader-meetings/shared/[token]`):
 * read once the session has settled, then the head, the tabs and the print layout inside the writer that
 * every tab writes through. What the reader may do is the server's `can`; a read by a link answers it all
 * false but *Save as PDF*, so the same screen draws no write control there.
 */
export function MeetingScreen({ source }: { source: MeetingSource }) {
  const { me, loading, signedOut, expired } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = !loading && me !== null;
  const [meeting, setMeeting] = useState<MeetingView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const key = source.via === 'link' ? source.token : source.meetingId;
  const read = useCallback(
    () => (source.via === 'link' ? readSharedMeeting(source.token) : readMeeting(source.meetingId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source.via, key],
  );

  useEffect(() => {
    if (!loading && !me) router.replace(signInAndReturn(pathname, { signedOut, expired }));
  }, [loading, me, signedOut, expired, router, pathname]);

  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    setError(null);
    // One read, though React runs an effect twice in development: a link's opening is audited, and the
    // first read after the date is the one that freezes the scorecard.
    joinInFlight(`leader-meeting:${source.via}:${key}`, read)
      .then((answer) => { if (live) setMeeting(answer); })
      .catch((err) => {
        if (!live) return;
        const refused = toDisplayError(err);
        if (refused.code === 'NOT_FOUND') setMissing(true);
        else setError(refused);
      });
    return () => { live = false; };
  }, [signedIn, source.via, key, read, attempt]);

  const update = useCallback((change: (m: MeetingView) => MeetingView) => {
    setMeeting((now) => (now ? change(now) : now));
  }, []);

  if (missing) return <NotFound via={source.via === 'link' ? 'link' : 'address'} />;
  if (error && !meeting) return <LoadError error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!meeting) return <MeetingSkeleton />;

  return (
    <MeetingWriterProvider meeting={meeting} setMeeting={update} reread={read}>
      <MeetingBody meeting={meeting} reread={async () => setMeeting(await read())} onGone={() => setMissing(true)} />
    </MeetingWriterProvider>
  );
}

function MeetingBody({
  meeting,
  reread,
  onGone,
}: {
  meeting: MeetingView;
  reread: () => Promise<void>;
  onGone: () => void;
}) {
  const writer = useMeetingWriter();
  const router = useRouter();
  const [tab, setTab] = useState<MeetingTab>('overview');
  const [details, setDetails] = useState(false);
  const [sharing, setSharing] = useState(false);
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A page that prints puts the document's title back as it goes (`print.ts`).
  useEffect(() => () => {
    if (printTimer.current) clearTimeout(printTimer.current);
    restorePrintTitle();
  }, []);

  /**
   * *Save as PDF* (`:2750-2753`): the line, then the browser's print of the print layout, under a title that
   * names the meeting and its day so the file is saved as that (ADR-0077's precedent). It writes nothing.
   */
  function print() {
    writer.announce(FORUM_COPY.preparingPdf);
    if (printTimer.current) clearTimeout(printTimer.current);
    printTimer.current = setTimeout(() => {
      printTimer.current = null;
      printAs(`${meeting.title} – ${formatShortDay(meeting.date, { year: true })}`);
    }, PRINT_DELAY_MS);
  }

  async function changed() {
    try {
      await reread();
    } catch (err) {
      if (toDisplayError(err).code === 'NOT_FOUND') onGone();
    }
  }

  return (
    <>
      {meeting.via === 'address' && (
        <Link
          href="/leader-meetings"
          className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-navy-soft underline-offset-2 hover:underline print:hidden"
        >
          {FORUM_COPY.back}
        </Link>
      )}
      <MeetingHead
        meeting={meeting}
        onDetails={() => setDetails(true)}
        onShare={() => setSharing(true)}
        onPrint={print}
      />
      <MeetingTabs meeting={meeting} active={tab} onSelect={setTab} />
      <PrintLayout meeting={meeting} />

      {/* The dialogs are chrome too, and leave the paper (`:757`). */}
      <div className="print:hidden">
        {(meeting.can.reschedule || meeting.can.delete) && (
          <MeetingDialog
            open={details}
            onClose={() => setDetails(false)}
            limits={meeting.limits}
            meeting={meeting}
            onChanged={changed}
            onDeleted={() => router.replace('/leader-meetings')}
          />
        )}
        {meeting.can.share && (
          <ShareDialog open={sharing} onClose={() => setSharing(false)} meeting={meeting} />
        )}
      </div>
    </>
  );
}
