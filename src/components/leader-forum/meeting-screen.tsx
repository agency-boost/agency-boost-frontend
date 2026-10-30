'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { useFieldChrome } from '@/components/field-nav';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { joinInFlight } from '@/lib/in-flight';
import { FORUM_TITLE, readMeeting, readSharedMeeting, signInAndReturn, type MeetingView } from '@/lib/leader-meetings';
import { usePhone } from '@/lib/use-phone';
import { printAs, restorePrintTitle } from '@/lib/print';
import { formatShortDay } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { LoadError, MeetingSkeleton, NotFound } from './forum-states';
import { MeetingHead } from './meeting-head';
import { MeetingTabs, type MeetingTab } from './meeting-tabs';
import { MeetingWriterProvider, useMeetingWriter } from './meeting-writer';
import { PrintLayout } from './print-layout';
import { V1MeetingHead } from './v1-meeting';

/**
 * *Details* and *Share*'s dialogs, downloaded when each is first opened and mounted from then on (`useOpenedOnce`;
 * P18.99-T16, the bundle).
 */
const MeetingDialog = dynamic(() => import('./meeting-dialog').then((m) => m.MeetingDialog), { ssr: false });
const ShareDialog = dynamic(() => import('./share-dialog').then((m) => m.ShareDialog), { ssr: false });

/** How the page was reached: the meeting's own address, or a shared link (ADR-0131). */
export type MeetingSource = { via: 'address'; meetingId: string } | { via: 'link'; token: string };

/** The prototype waits this long before the print dialog, so its line is on screen first (`:2752`). */
const PRINT_DELAY_MS = 400;


/**
 * **A meeting** (`/leader-meetings/[meetingId]`, and read-only by a link at `/leader-meetings/shared/[token]`):
 * read once the session has settled, then the head, the tabs and the print layout inside the writer that
 * every tab writes through. What the reader may do is the server's `can`; a read by a link answers it all
 * false but *Save as PDF*, so the same screen draws no write control there.
 */
export function MeetingScreen({ source, titled = false }: {
  source: MeetingSource;
  /**
   * **The page's title is this screen's** (UI V1, UI-110): the shell draws none, and the screen draws *Strategic Leader
   * Forum* with its sub-line — or, on a phone in the field shell, the meeting's own header (`V1MeetingHead`), which is
   * the page's title row there. `/leader-meetings/[meetingId]` passes it; the shared link's page keeps its shell's.
   */
  titled?: boolean;
}) {
  const forum = useMessages(forumMessages);
  const v1 = useV1();
  // While the meeting is read, and when it is not there: the forum's own title row.
  const forumHeader = titled
    ? <PageHeader title={FORUM_TITLE} subtitle={forum.sub} subtitleOnPhone={!v1} />
    : null;
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

  if (missing) return <>{forumHeader}<NotFound via={source.via === 'link' ? 'link' : 'address'} /></>;
  if (error && !meeting) return <>{forumHeader}<LoadError error={error} onRetry={() => setAttempt((n) => n + 1)} /></>;
  if (!meeting) return <>{forumHeader}<MeetingSkeleton /></>;

  return (
    <MeetingWriterProvider meeting={meeting} setMeeting={update} reread={read}>
      {!v1 && forumHeader}
      <MeetingBody meeting={meeting} v1={v1} titled={titled} reread={async () => setMeeting(await read())} onGone={() => setMissing(true)} />
    </MeetingWriterProvider>
  );
}

/** A phone in the field shell: the owner's meeting page (UI-110). The console and wider screens as before. */
function useV1(): boolean {
  const phone = usePhone();
  const field = useFieldChrome() !== null;
  return phone && field;
}

function MeetingBody({
  meeting,
  v1,
  titled,
  reread,
  onGone,
}: {
  meeting: MeetingView;
  v1: boolean;
  titled: boolean;
  reread: () => Promise<void>;
  onGone: () => void;
}) {
  const t = useMessages(forumMessages);
  const language = useFigureLanguage();
  const writer = useMeetingWriter();
  const router = useRouter();
  const [tab, setTab] = useState<MeetingTab>('overview');
  const [details, setDetails] = useState(false);
  const [sharing, setSharing] = useState(false);
  const detailsOpened = useOpenedOnce(details);
  const sharingOpened = useOpenedOnce(sharing);
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
    writer.announce(t.preparingPdf);
    if (printTimer.current) clearTimeout(printTimer.current);
    printTimer.current = setTimeout(() => {
      printTimer.current = null;
      printAs(`${meeting.title} – ${formatShortDay(meeting.date, { year: true }, language)}`);
    }, PRINT_DELAY_MS);
  }

  async function changed() {
    try {
      await reread();
    } catch (err) {
      if (toDisplayError(err).code === 'NOT_FOUND') onGone();
    }
  }

  if (v1) {
    return (
      <>
        <V1MeetingHead meeting={meeting} titled={titled} onDetails={() => setDetails(true)} onShare={() => setSharing(true)} onPrint={print} />
        <MeetingTabs meeting={meeting} active={tab} onSelect={setTab} v1 />
        <PrintLayout meeting={meeting} />
        <div className="print:hidden">
          {(meeting.can.reschedule || meeting.can.delete) && detailsOpened && (
            <MeetingDialog
              open={details}
              onClose={() => setDetails(false)}
              limits={meeting.limits}
              meeting={meeting}
              onChanged={changed}
              onDeleted={() => router.replace('/leader-meetings')}
            />
          )}
          {meeting.can.share && sharingOpened && <ShareDialog open={sharing} onClose={() => setSharing(false)} meeting={meeting} />}
        </div>
      </>
    );
  }

  return (
    <>
      {meeting.via === 'address' && (
        <Link
          href="/leader-meetings"
          className="mb-4 inline-flex items-center gap-1.5 text-base font-semibold text-navy-soft underline-offset-2 hover:underline print:hidden"
        >
          {t.back}
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
        {(meeting.can.reschedule || meeting.can.delete) && detailsOpened && (
          <MeetingDialog
            open={details}
            onClose={() => setDetails(false)}
            limits={meeting.limits}
            meeting={meeting}
            onChanged={changed}
            onDeleted={() => router.replace('/leader-meetings')}
          />
        )}
        {meeting.can.share && sharingOpened && (
          <ShareDialog open={sharing} onClose={() => setSharing(false)} meeting={meeting} />
        )}
      </div>
    </>
  );
}
