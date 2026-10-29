'use client';

import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useCoacheeNotFound } from '@/components/coaching-person';
import { SummaryCard } from '@/components/summary-card';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Textarea } from '@/components/ui/field';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { InlineSaveStatus, useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { Toast, useToast } from '@/components/ui/toast';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingLeaderNotesMessages } from '@/i18n/messages/coaching-leader-notes';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  capabilityTag, gridItems, gridNotApplicable, LEADER_NOTE_MAX, ladderStages, readCoachingProfile, readLeaderNotes,
  saveCoachingProfile, saveLeaderNote, stageMilestones, trackerGrids,
  type CapabilityGridRow, type CapabilityRow, type Coachee, type CoachingProfile, type LeaderNote, type LeaderNotes,
} from '@/lib/coaching';
import { useCan } from '@/lib/session';

/**
 * A coachee's *🔒 Leader Notes* tab (`Overall.html:4344-4382`, logic `:11189-11282`; P11-T9): the
 * *Capability mapping* ladder, the *Skill tracker* and the leader's *Personal notes*, inside the person
 * shell.
 *
 * **Two reads, each failing in its own place.** The profile (`GET …/profile`) carries the office's
 * catalog with its archived rows, the ticks by code and the stage the server derived; the notes
 * (`GET …/leader-notes`) carry the reader's own note and those somebody below them wrote. A 404 from
 * either means the person is out of the reader's reach after all, and the shell shows its not-found
 * state.
 *
 * **Nothing here outlives the tab.** Every answer is held in this component's state and nowhere else:
 * *Agent view* unmounts the tab (`coaching-person.tsx`), and what it read goes with it, so turning the
 * screen round leaves no note in the page (ADR-0078, roles §1.7). Coming back reads both again.
 *
 * Coaching's own strings use none of ADR-0084's six words, and none names a phase, an id or a code. They are the
 * catalogue's (`messages/coaching-leader-notes.ts`, P18.98-T4), in the reader's language.
 */
export function LeaderNotesTab({ coachee }: { coachee: Coachee }) {
  const canReadNotes = useCan('leader_notes:read');
  const { toast, show } = useToast();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CapabilityProfile coachee={coachee} onToast={show} />
      {/*
        * A support session reads no note (ADR-0090): the permission is not the reader's there, so
        * nothing is asked for and the card is not drawn. The server refuses it either way.
        */}
      {canReadNotes && <PersonalNotes coachee={coachee} onToast={show} />}
      <Toast toast={toast} />
    </div>
  );
}

/*
 * ── The profile: Capability mapping and Skill tracker ───────────────────────────────────────────
 */

interface Ticks {
  milestones: string[];
  skills: string[];
}

/** What a save would send, comparable: a tick set in any order is the same tick set. */
const snapshotOf = (ticks: Ticks) => JSON.stringify([[...ticks.milestones].sort(), [...ticks.skills].sort()]);

interface Held {
  version: number;
  ticks: Ticks;
  /** The last tick set the server holds, to go back to when a save is refused. */
  saved: Ticks;
}

/**
 * The profile, ticked as it is read and saved as it is ticked.
 *
 * **Every tick saves the whole tick set** at the version it was read (`PUT …/profile`), one save at a
 * time: a tick made while a save is in flight goes in the next one, with the version the last one
 * answered. **The stage is the server's**: the tag and the highlighted stage change when the save
 * answers, never from a count made here.
 *
 * A save another coach has moved past is `VERSION_CONFLICT`: the profile is read again and one line
 * says so. An item archived since it was read is `CONFIG_ARCHIVED`: read again, with the server's words.
 *
 * **Each tick says its save beside it** (P18.95-T1 AC-5, ADR-0167 §5; UI-007): *Saving… → Saved ✓*, or
 * *Couldn't save — retry*. A refused save puts the boxes back, so the retry ticks the box again and saves;
 * a re-read leaves nothing to retry. The milestone's toast stays.
 */
function CapabilityProfile({ coachee, onToast }: { coachee: Coachee; onToast: (message: string) => void }) {
  const language = useLanguage();
  const t = useMessages(coachingLeaderNotesMessages);
  const { membershipId } = coachee;
  const gone = useCoacheeNotFound();
  const canTick = useCan('coaching_profile:update');
  const [profile, setProfile] = useState<CoachingProfile | null>(null);
  const [ticks, setTicks] = useState<Ticks | null>(null);
  const [stageCode, setStageCode] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  /** The one line a version conflict leaves: the profile changed somewhere else and was read again. */
  const [reread, setReread] = useState(false);
  const held = useRef<Held | null>(null);
  const inFlight = useRef<Promise<boolean | null> | null>(null);
  const again = useRef(false);
  const { save: track, statusOf } = useInlineSave();
  /** A milestone moved since the last save: the next one that lands says so (`Overall.html:11228`). */
  const announce = useRef(false);

  const open = useCallback((next: CoachingProfile) => {
    const read: Ticks = { milestones: next.milestoneCodes, skills: next.skillCodes };
    held.current = { version: next.version, ticks: read, saved: read };
    again.current = false;
    announce.current = false;
    setProfile(next);
    setTicks(read);
    setStageCode(next.stageCode);
  }, []);

  const refused = useCallback((err: unknown) => {
    if (err instanceof ApiRequestError && err.status === 404) gone();
    else setError(toDisplayError(err));
  }, [gone]);

  useEffect(() => {
    let live = true;
    readCoachingProfile(membershipId)
      .then((next) => { if (live) open(next); })
      .catch((err) => { if (live) refused(err); });
    return () => { live = false; };
  }, [membershipId, open, refused]);

  const readAgain = useCallback(async () => {
    try {
      open(await readCoachingProfile(membershipId));
    } catch (err) {
      refused(err);
    }
  }, [membershipId, open, refused]);

  /** Every unsaved tick, one save at a time: `true` saved, `false` refused and put back, `null` read again or gone. */
  const save = useCallback((): Promise<boolean | null> => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const run = async (): Promise<boolean | null> => {
      const mine = held.current;
      if (!mine) return null;
      do {
        again.current = false;
        const sent = mine.ticks;
        if (snapshotOf(sent) === snapshotOf(mine.saved)) continue;
        const says = announce.current;
        announce.current = false;
        try {
          const saved = await saveCoachingProfile(membershipId, {
            version: mine.version, milestoneCodes: sent.milestones, skillCodes: sent.skills,
          });
          // Read again meanwhile: this answer belongs to the profile that was replaced.
          if (held.current !== mine) return null;
          mine.version = saved.version;
          mine.saved = sent;
          setStageCode(saved.stageCode);
          setSaveError(null);
          if (says) onToast(t.updated);
        } catch (err) {
          if (held.current !== mine) return null;
          // Nothing that was waiting goes out after a refusal, so nothing is left to announce.
          announce.current = false;
          const shown = toDisplayError(err);
          if (err instanceof ApiRequestError && err.status === 404) {
            gone();
            return null;
          } else if (shown.code === 'VERSION_CONFLICT') {
            await readAgain();
            setReread(true);
            return null;
          } else if (shown.code === 'CONFIG_ARCHIVED') {
            await readAgain();
            setSaveError(shown);
            return null;
          }
          // Back to what the server holds, so the boxes never claim a tick it refused.
          mine.ticks = mine.saved;
          setTicks(mine.saved);
          setSaveError(shown);
          return false;
        }
      } while (again.current);
      // Everything is saved; a milestone moved and moved back says nothing.
      announce.current = false;
      return true;
    };
    inFlight.current = run().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [membershipId, gone, onToast, readAgain, t.updated]);

  /** Tick or untick one box, and save; `where` tells apart the same milestone listed under two stages. */
  const toggle = useCallback((part: 'milestone' | 'skill', code: string, on: boolean, where = '') => {
    const tick = (): Promise<boolean | null> => {
      const mine = held.current;
      if (!mine) return Promise.resolve(null);
      const key = part === 'milestone' ? 'milestones' : 'skills';
      const rest = mine.ticks[key].filter((c) => c !== code);
      mine.ticks = { ...mine.ticks, [key]: on ? [...rest, code] : rest };
      setTicks(mine.ticks);
      setReread(false);
      if (part === 'milestone') announce.current = true;
      return save();
    };
    // A retry ticks the box again — a refusal put it back — and saves (AC-5).
    void track(`${part}:${where}:${code}`, tick);
  }, [save, track]);

  if (error) return <ErrorBanner {...error} />;
  if (!profile || !ticks) return <ProfileSkeleton />;

  const milestoneTicks = new Set(ticks.milestones);
  const skillTicks = new Set(ticks.skills);
  const tag = capabilityTag(profile.catalog, stageCode, language);

  return (
    <>
      {reread && (
        <p role="status" className="rounded-md border border-hairline bg-base px-3.5 py-2.5 text-sm text-navy">
          {t.reread}
        </p>
      )}
      {saveError && <ErrorBanner {...saveError} />}

      <SummaryCard id="capability-mapping" title={t.capability} tag={tag ?? undefined} className="min-w-0">
        {/*
          * A catalog with no stage at all. Since ADR-0116 (2026-10-08) an office started Empty is given
          * the platform ladder, so this is no longer reachable from a new office.
          */}
        {profile.catalog.stages.length === 0 && (
          <EmptyState title={t.noStages} className="py-6" />
        )}
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {ladderStages(profile.catalog, stageCode).map((stage, i) => (
            <Stage
              key={stage.code}
              n={i + 1}
              label={stage.label}
              current={stage.code === stageCode}
              milestones={stageMilestones(stage, profile.catalog, milestoneTicks)}
              ticked={milestoneTicks}
              canTick={canTick}
              onTick={(code, on) => toggle('milestone', code, on, stage.code)}
              status={(code) => statusOf(`milestone:${stage.code}:${code}`)}
            />
          ))}
        </ol>
      </SummaryCard>

      <SummaryCard id="skill-tracker" title={t.tracker} className="min-w-0">
        {profile.catalog.grids.length === 0 && (
          <EmptyState title={t.noGrids} className="py-6" />
        )}
        <div className="grid grid-cols-1 items-start gap-x-[22px] gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          {trackerGrids(profile.catalog, skillTicks).map((grid) => (
            <SkillSection
              key={grid.code}
              grid={grid}
              notApplicable={gridNotApplicable(grid, coachee.downline, coachee.pronoun, language)}
              ticked={skillTicks}
              canTick={canTick}
              onTick={(code, on) => toggle('skill', code, on)}
              status={(code) => statusOf(`skill::${code}`)}
            />
          ))}
        </div>
      </SummaryCard>
    </>
  );
}

/**
 * The office stopped offering this row: it still renders where it was ticked, and is ticked anew
 * nowhere (P11-T9 AC-3). The badge the Activity Dashboard puts on a row the office archived.
 */
function ArchivedBadge() {
  const t = useMessages(coachingLeaderNotesMessages);
  // The space is the label's, so the name a screen reader hears is *Cold calling Archived*, not one word.
  return <>{' '}<ConfigBadge tone="navy" className="ml-1 align-middle">{t.archived}</ConfigBadge></>;
}

/**
 * One rung, `.cap-stage` (`Overall.html:1352-1361`): its number, its name, its milestones, and on the
 * current one the amber ground and *Current stage*.
 *
 * **Navy words on the amber.** The prototype puts white on amber-dark in the number and amber-dark on
 * an amber tint in the badge, and neither clears a contrast floor (`a11y.spec.tsx`); navy on amber
 * does, as the product's other amber grounds have it. The milestones are a group named by the stage,
 * because the same milestone is a checkbox in every stage that lists it.
 */
function Stage({
  n, label, current, milestones, ticked, canTick, onTick, status,
}: {
  n: number;
  label: string;
  current: boolean;
  milestones: CapabilityRow[];
  ticked: ReadonlySet<string>;
  canTick: boolean;
  onTick: (code: string, on: boolean) => void;
  /** Each box's save confirmation (P18.95-T1 AC-5), on the line under it — never inside its label. */
  status: (code: string) => InlineSaveStatusProps;
}) {
  const t = useMessages(coachingLeaderNotesMessages);
  const titleId = useId();
  return (
    <li
      className={cn(
        'rounded-lg border-[1.5px] px-3.5 py-3.5',
        current ? 'border-amber bg-amber/[0.08]' : 'border-hairline bg-base',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mb-2 flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold',
          current ? 'bg-amber text-navy' : 'bg-navy text-white',
        )}
      >
        {n}
      </span>
      <p id={titleId} className="mb-2.5 text-base font-bold leading-tight text-navy">{label}</p>
      <div role="group" aria-labelledby={titleId} className="flex flex-col gap-[7px]">
        {milestones.map((m) => {
          const on = ticked.has(m.code);
          const archived = m.status === 'archived';
          const locked = !canTick || archived;
          return (
            <Fragment key={m.code}>
              <label
                className={cn(
                  'flex items-start gap-1.5 text-sm leading-snug',
                  on ? 'font-medium text-navy' : 'text-muted',
                  locked ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={(e) => onTick(m.code, e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-success disabled:cursor-not-allowed"
                />
                <span>
                  {m.label}
                  {archived && <ArchivedBadge />}
                </span>
              </label>
              <InlineSaveStatus {...status(m.code)} label={m.label} className="-mt-1 pl-5" />
            </Fragment>
          );
        })}
      </div>
      {current && (
        <span className="mt-2 inline-block rounded-pill bg-amber/15 px-[9px] py-0.5 text-2xs font-bold uppercase tracking-wide text-navy">
          {t.currentStage}
        </span>
      )}
    </li>
  );
}

/**
 * One section of the *Skill tracker* (`.skill-section`, `Overall.html:1363-1377`): its title, its
 * items ticked by code, a ticked one bold. **No toast**, as in the prototype.
 *
 * A section for somebody's downline, when they have none, is drawn disabled with the prototype's note
 * in their pronoun, and the note describes the group. So is a section the office has archived, shown
 * only because an item of it is ticked. What was ticked stays ticked either way.
 */
function SkillSection({
  grid, notApplicable, ticked, canTick, onTick, status,
}: {
  grid: CapabilityGridRow;
  notApplicable: string | null;
  ticked: ReadonlySet<string>;
  canTick: boolean;
  onTick: (code: string, on: boolean) => void;
  /** Each box's save confirmation (P18.95-T1 AC-5), on the line under it. */
  status: (code: string) => InlineSaveStatusProps;
}) {
  const titleId = useId();
  const noteId = useId();
  const sectionArchived = grid.status === 'archived';
  const off = notApplicable !== null || sectionArchived;
  return (
    <div role="group" aria-labelledby={titleId} aria-describedby={notApplicable ? noteId : undefined}>
      <p
        id={titleId}
        className={cn('mb-2.5 text-sm font-bold uppercase tracking-wide', off ? 'text-muted/50' : 'text-muted')}
      >
        {grid.label}
        {sectionArchived && <ArchivedBadge />}
      </p>
      {notApplicable && <p id={noteId} className="mb-1 text-sm italic text-muted">{notApplicable}</p>}
      <div className="flex flex-col">
        {gridItems(grid, ticked).map((item) => {
          const on = ticked.has(item.code);
          const archived = item.status === 'archived';
          const locked = !canTick || off || archived;
          return (
            <Fragment key={item.code}>
              <label
                className={cn(
                  'flex items-center gap-[9px] py-1 text-base',
                  off ? 'text-navy/[0.45]' : 'text-navy',
                  on && 'font-semibold',
                  locked ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={(e) => onTick(item.code, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-success disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span>
                  {item.label}
                  {archived && <ArchivedBadge />}
                </span>
              </label>
              <InlineSaveStatus {...status(item.code)} label={item.label} className="pl-[25px]" />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  const t = useMessages(coachingLeaderNotesMessages);
  return (
    <Skeleton label={t.loading} className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
      <SkeletonBar className="mb-4 h-4 w-40" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <SkeletonText key={i} lines={3} />)}
      </div>
    </Skeleton>
  );
}

/*
 * ── Personal notes ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * *Personal notes* (`Overall.html:4378-4380`): the reader's own note about the coachee, tagged
 * *Leader-only, never shown to {name}*, saved by *Save notes* and by nothing else — no autosave, as in
 * the prototype. Then each note somebody below the reader wrote, read-only, in the prototype's own card
 * for another leader's note, tagged *From {author}* (`:4594-4596`; ADR-0073).
 *
 * A save is pinned to the version the note was read at, 0 for a first note. A stale one is read again,
 * and one line says so.
 */
function PersonalNotes({ coachee, onToast }: { coachee: Coachee; onToast: (message: string) => void }) {
  const t = useMessages(coachingLeaderNotesMessages);
  const { membershipId } = coachee;
  const gone = useCoacheeNotFound();
  const canWrite = useCan('leader_notes:write');
  const [notes, setNotes] = useState<LeaderNotes | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [reread, setReread] = useState(false);

  const open = useCallback((next: LeaderNotes) => {
    setNotes(next);
    setText(next.mine?.text ?? '');
  }, []);

  const refused = useCallback((err: unknown) => {
    if (err instanceof ApiRequestError && err.status === 404) gone();
    else setError(toDisplayError(err));
  }, [gone]);

  useEffect(() => {
    let live = true;
    readLeaderNotes(membershipId)
      .then((next) => { if (live) open(next); })
      .catch((err) => { if (live) refused(err); });
    return () => { live = false; };
  }, [membershipId, open, refused]);

  async function save() {
    if (!notes) return;
    setSaving(true);
    setSaveError(null);
    setReread(false);
    try {
      const saved = await saveLeaderNote(membershipId, { version: notes.mine?.version ?? 0, text });
      setNotes({ ...notes, mine: { noteId: saved.noteId, text, version: saved.version, updatedAt: saved.updatedAt } });
      onToast(t.saved);
    } catch (err) {
      const shown = toDisplayError(err);
      if (err instanceof ApiRequestError && err.status === 404) {
        gone();
      } else if (shown.code === 'VERSION_CONFLICT') {
        try {
          open(await readLeaderNotes(membershipId));
          setReread(true);
        } catch (again) {
          refused(again);
        }
      } else {
        setSaveError(shown);
      }
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorBanner {...error} />;
  if (!notes) {
    return (
      <Skeleton label={t.loadingNotes} className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
        <SkeletonBar className="mb-4 h-4 w-32" />
        <SkeletonBar className="h-[110px] w-full" />
      </Skeleton>
    );
  }

  return (
    <>
      <SummaryCard id="personal-notes" title={t.notes} tag={<Wraps>{t.leaderOnly({ name: coachee.name })}</Wraps>} className="min-w-0">
        {reread && (
          <p role="status" className="mb-2.5 rounded-md border border-hairline bg-base px-3.5 py-2.5 text-sm text-navy">
            {t.notesReread}
          </p>
        )}
        {saveError && <div className="mb-2.5"><ErrorBanner {...saveError} /></div>}
        <Textarea
          aria-labelledby="personal-notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={!canWrite}
          maxLength={LEADER_NOTE_MAX}
          className="min-h-[110px] w-full resize-y px-3.5 py-3 text-md leading-normal"
        />
        {canWrite && (
          <div className="mt-2.5 flex justify-end">
            <Button onClick={() => void save()} disabled={saving}>{t.save}</Button>
          </div>
        )}
      </SummaryCard>

      {notes.others.map((note) => <OtherNote key={note.noteId} note={note} />)}
    </>
  );
}

/**
 * A tag that carries a person's name may be longer than a phone's card is wide: it wraps there rather
 * than pushing the page sideways. The card's own tag stays on one line for everything else.
 */
function Wraps({ children }: { children: ReactNode }) {
  return <span className="whitespace-normal">{children}</span>;
}

/**
 * A note somebody below the reader wrote: *Personal notes*, tagged *From {author}* (`Overall.html:
 * 4594-4596`), its words as they wrote them and not editable — a note is written only by its author.
 * The heading carries the author for a screen reader too, so no two cards on the page share a name.
 */
function OtherNote({ note }: { note: LeaderNote }) {
  const t = useMessages(coachingLeaderNotesMessages);
  const id = useId();
  return (
    <SummaryCard
      id={id}
      title={<>{t.notes}<span className="sr-only">{t.notesFrom({ name: note.author.name })}</span></>}
      tag={<Wraps>{t.from({ name: note.author.name })}</Wraps>}
      className="min-w-0"
    >
      <p className="min-h-[110px] whitespace-pre-wrap break-words rounded-md border border-hairline px-3.5 py-3 text-md leading-normal text-navy">
        {note.text}
      </p>
    </SummaryCard>
  );
}
