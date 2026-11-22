'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Segmented } from '@/components/ui/segmented';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { joinInFlight } from '@/lib/in-flight';
import {
  createShareLink, forumWhen, readMeeting, readSharedMeeting, shareText, sharedAddress, signInAndReturn,
  whatsAppShareHref, type MeetingView,
} from '@/lib/leader-meetings';
import { printAs, restorePrintTitle } from '@/lib/print';
import { useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { useQuery } from '@/lib/use-query';
import { ActionItems } from './action-items';
import { Agenda } from './agenda';
import { CoreLeaderStack } from './forum-people';
import { LoadError, MeetingSkeleton, NotFound } from './forum-states';
import { makeRun, type ForumWriter } from './forum-writes';

/*
 * Advanced analytics' own sections, loaded when their tab is opened: the forum's page does not carry them (the bundle).
 * P19.22-T8 AC-2: *"MAPA driver and Informal group tabs = copied from Advanced analytics as they are (same data, same
 * controls and taps)"* — the same components, reading the same endpoints.
 */
const MapaSection = dynamic(() => import('@/components/advanced-analytics/mapa-section').then((m) => m.MapaSection), { ssr: false });
const SubgroupSection = dynamic(() => import('@/components/advanced-analytics/subgroup-section').then((m) => m.SubgroupSection), { ssr: false });
const ForumDialog = dynamic(() => import('./forum-dialog').then((m) => m.ForumDialog), { ssr: false });
const PrintLayout = dynamic(() => import('./print-layout').then((m) => m.PrintLayout), { ssr: false });

export type MeetingSource = { via: 'address'; meetingId: string } | { via: 'link'; token: string };

export type ForumTab = 'mapa' | 'groups' | 'agenda' | 'actions';
const TABS: readonly ForumTab[] = ['mapa', 'groups', 'agenda', 'actions'];
/** By a link the forum is its agenda and action items alone: the analytics are a steward's to read. */
const LINK_TABS: readonly ForumTab[] = ['agenda', 'actions'];

const PRINT_DELAY_MS = 300;

/**
 * **One forum** (`/leader-meetings/[meetingId]`, and read-only by a link at `/leader-meetings/shared/[token]`;
 * P19.22-T8 AC-2 to AC-4; `slf-*` frames 2–9).
 *
 * - ***‹ Semua forum***, then **the header card**: *Forum #n*, *date · time · state*, the core leaders' photos *"n core
 *   leader · semua bisa mengedit"*, a green ***Bagikan*** and an outlined ***PDF*** — under the words on a phone. A pencil
 *   by the date moves a forum to come, or deletes one nobody has written in (`ForumDialog`).
 * - **The tabs *MAPA driver · Informal group · Agenda · Action items*** — opened on `?tab=` or on *Agenda*. The first two
 *   are Advanced analytics' own sections under *"Sama dengan Advanced analytics › …"*.
 * - ***Bagikan***: a fresh read-only link (`POST …/share-links`), then WhatsApp with the forum's text and the link
 *   (`wa.me`, OD-359) — the window opened at the tap, so a browser does not take it for a pop-up.
 * - ***PDF***: the print layout of the agenda and the action items, under the forum's name.
 */
export function ForumScreen({ source }: { source: MeetingSource }) {
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
    // One read, though React runs an effect twice in development: a link's opening is audited.
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

  if (missing) return <NotFound via={source.via === 'link' ? 'link' : 'address'} />;
  if (error && !meeting) return <LoadError error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!meeting) return <MeetingSkeleton />;
  return <ForumBody meeting={meeting} setMeeting={setMeeting} reread={async () => setMeeting(await read())} onGone={() => setMissing(true)} />;
}

function ForumBody({ meeting, setMeeting, reread, onGone }: {
  meeting: MeetingView;
  setMeeting: React.Dispatch<React.SetStateAction<MeetingView | null>>;
  reread: () => Promise<void>;
  onGone: () => void;
}) {
  const t = useMessages(forumMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const router = useRouter();
  const query = useQuery();
  const { toast, show } = useToast();
  const byLink = meeting.via === 'link';
  const tabs = byLink ? LINK_TABS : TABS;
  const asked = typeof query.tab === 'string' && (tabs as readonly string[]).includes(query.tab) ? (query.tab as ForumTab) : 'agenda';
  const [tab, setTab] = useState<ForumTab>(asked);
  const [editing, setEditing] = useState(false);
  const editOpened = useOpenedOnce(editing);
  const [printing, setPrinting] = useState(false);
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setTab(asked), [asked]);
  useEffect(() => () => {
    if (printTimer.current) clearTimeout(printTimer.current);
    restorePrintTitle();
  }, []);

  const update = useCallback((change: (m: MeetingView) => MeetingView) => {
    setMeeting((now) => (now ? change(now) : now));
  }, [setMeeting]);
  const writer: ForumWriter = useMemo(() => ({
    meeting,
    update,
    run: makeRun(update, reread, show, { conflict: t.conflict, failed: t.failed }, onGone),
  }), [meeting, update, reread, show, t.conflict, t.failed, onGone]);

  /** *Bagikan*: the window first, at the tap; the link, then WhatsApp in it. */
  async function share() {
    const opened = window.open('', '_blank');
    try {
      const link = await createShareLink(meeting.id);
      const href = whatsAppShareHref(shareText(meeting, sharedAddress(window.location.origin, link.token), words, language));
      if (opened) opened.location.href = href;
      else window.location.href = href;
    } catch (err) {
      opened?.close();
      show(toDisplayError(err).message);
    }
  }

  function print() {
    setPrinting(true);
    show(t.preparingPdf);
    if (printTimer.current) clearTimeout(printTimer.current);
    printTimer.current = setTimeout(() => {
      printTimer.current = null;
      printAs(`${t.forumN({ n: meeting.number })} – ${forumWhen(meeting, language)}`);
    }, PRINT_DELAY_MS);
  }

  const canEditWhen = meeting.can.reschedule || meeting.can.delete;
  const sameAs = (name: string) => <p className="mb-3 text-sm text-muted">{t.sameAs({ tab: name })}</p>;

  return (
    <div data-forum={meeting.id}>
      <div className="print:hidden">
        {!byLink && (
          <Link href="/leader-meetings" className="mb-3 inline-flex min-h-11 items-center gap-1 text-md font-semibold text-navy hover:underline">
            <LineIcon name="chevronLeft" className="h-4 w-4" />
            {t.back}
          </Link>
        )}

        <section className="mb-4 flex flex-col gap-3 rounded-lg border border-card-edge bg-card px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-navy">{t.forumN({ n: meeting.number })}</h2>
            <p className="flex flex-wrap items-center gap-x-1 text-md text-muted">
              <span>{forumWhen(meeting, language)} · {t.state[meeting.state]}</span>
              {canEditWhen && (
                <button
                  type="button"
                  aria-label={t.changeWhen}
                  title={t.changeWhen}
                  onClick={() => setEditing(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-hover-row hover:text-navy"
                >
                  <LineIcon name="pencil" className="h-4 w-4" />
                </button>
              )}
            </p>
            <CoreLeaderStack people={meeting.coreLeaders} everyoneEdits className="mt-2" />
          </div>
          <div className="flex shrink-0 gap-2">
            {meeting.can.share && (
              <Button onClick={() => void share()} className="flex-1 border-success bg-success text-white hover:bg-success md:flex-none">
                <LineIcon name="whatsapp" className="h-4 w-4" />
                {t.share}
              </Button>
            )}
            {meeting.can.print && (
              <Button variant="secondary" onClick={print} className="flex-1 md:flex-none">
                <LineIcon name="download" className="h-4 w-4" />
                {t.pdf}
              </Button>
            )}
          </div>
        </section>

        <Segmented
          label={t.tabsLabel}
          tabs={tabs.map((id) => ({ id, label: t.tabs[id] }))}
          active={tab}
          onSelect={(id) => {
            setTab(id as ForumTab);
            if (!byLink) router.replace(`/leader-meetings/${encodeURIComponent(meeting.id)}?tab=${id}`, { scroll: false });
          }}
          className="md:w-fit"
        >
          {(active) => (
            <div data-forum-tab={active}>
              {active === 'mapa' && <>{sameAs(t.tabs.mapa)}<MapaSection canUpload={meeting.can.edit} /></>}
              {active === 'groups' && <>{sameAs(t.tabs.groups)}<SubgroupSection canUpload={meeting.can.edit} /></>}
              {active === 'agenda' && <Agenda writer={writer} editable={meeting.can.edit} />}
              {active === 'actions' && <ActionItems writer={writer} editable={meeting.can.edit} />}
            </div>
          )}
        </Segmented>
      </div>

      {printing && <PrintLayout meeting={meeting} />}
      <Toast toast={toast} />

      {editOpened && (
        <ForumDialog
          mode="edit"
          open={editing}
          today={meeting.date}
          meeting={meeting}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void reread(); }}
          onDeleted={() => router.push('/leader-meetings')}
        />
      )}
    </div>
  );
}
