'use client';

import { useParams } from 'next/navigation';
import { SessionArchive } from '@/components/coaching-record';

/**
 * One past coaching session (`/coaching/[membershipId]/archive/[sessionId]`, P11-T10): what was agreed,
 * frozen when it was finalized — the goal, the ratios and the last 7 days as the 1:1 saw them, the
 * action items and the tips — with every earlier version, who reopened it, when and why. *View →* on a
 * past session opens it, from the *Coaching Session* tab and from *Sessions you led* on `/coaching/me`.
 *
 * Inside the person shell for a reader who coaches the person, and on its own for a former coach, whose
 * edge has closed (ADR-0082): the shell decides. Keyed by the session, so another one starts afresh.
 *
 * **Its address from `useParams()`, which does not suspend** (F5 of P11's final walk). `use(params)`
 * suspended the first time the shell drew the page, since the App Router hands a client page a promise
 * React has not seen settle; the shell was hidden and shown again, and in development the person and
 * the session were each read again. Reading the address from the router's context draws the archive,
 * and starts its one read, the moment the shell has the person.
 */
export default function CoachingArchivePage() {
  const { membershipId, sessionId } = useParams<{ membershipId: string; sessionId: string }>();
  return <SessionArchive key={sessionId} membershipId={membershipId} sessionId={sessionId} />;
}
