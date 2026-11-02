'use client';

import dynamic from 'next/dynamic';
import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CurrentStagePill, StepMarker, TickRow } from '@/components/capability/capability-parts';
import { useCoacheeNotFound } from '@/components/coaching-person';
import { SummaryCard } from '@/components/summary-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Textarea } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SaveStateLabel, useSaveState } from '@/components/ui/save-state';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { Toast, useToast } from '@/components/ui/toast';
import { TonePill } from '@/components/ui/tone-pill';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingLeaderNotesMessages } from '@/i18n/messages/coaching-leader-notes';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { firstIncomplete, gridCount, ladderRungs, type LadderRung } from '@/lib/capability-view';
import { cn } from '@/lib/cn';
import {
  capabilityTag, gridItems, gridNotApplicable, LEADER_NOTE_MAX, readCoachingProfile, readLeaderNotes,
  saveCoachingProfile, saveLeaderNote, trackerGrids,
  type CapabilityGridRow, type Coachee, type CoachingProfile, type LeaderNote, type LeaderNotes,
} from '@/lib/coaching';
import { useCan } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';

/** The ladder's sheet, loaded the first time it is opened (the 200 kB budget). */
const LadderSheet = dynamic(() => import('@/components/capability/ladder-sheet').then((m) => m.LadderSheet), { ssr: false });

/** A V1 card (UI-008): white, no border on the V1 surface, 16px corners. */
const CARD = 'rounded-lg border border-card-edge bg-card px-4 py-3.5 lg:px-[18px] lg:py-4';

/**
 * A coachee's ***Capability mapping*** tab (`/coaching/[membershipId]/leader-notes`; P11-T9, redrawn by Phase 18.99 T10
 * after the UI V1 report, UI-035 to UI-040): where they stand on the capability ladder, the skills their coaches track,
 * and the reader's own note about them, which they never see.
 *
 * - **The ladder is one compact tile** (UI-035): the title with an ⓘ holding the privacy line (UI-038), a four-step
 *   progress line, the current stage with its pill and ›. The whole tile opens the ladder in a sheet (a centred modal
 *   on a desktop), each criterion listed once; nothing is ticked on the page itself.
 * - **The *Skill tracker*** (UI-036, the name at every size): below 1024px each section a 44px accordion row with its
 *   count, only the first incomplete one open, a section that does not apply a grey row with *Tidak berlaku* that opens
 *   onto the reason and its greyed list; from 1024px the sections that apply as open columns, and each that does not
 *   one row with its reason. Rows of 44px with 22px boxes below 1024px, 32px and 18px above (UI-037).
 * - **The private note** (UI-039) says *Belum disimpan* while it differs from what was saved and *Tersimpan ✓* after,
 *   and holds a reader who would leave it unsaved (`useSaveState`). From 1024px it is the right column, sticky (UI-040).
 *
 * **Two reads, each failing in its own place.** The profile (`GET …/profile`) carries the office's catalog with its
 * archived rows, the ticks by code and the stage the server derived; the notes (`GET …/leader-notes`) carry the reader's
 * own note and those somebody below them wrote. A 404 from either means the person is out of the reader's reach after
 * all, and the shell shows its not-found state.
 *
 * **Nothing here outlives the tab.** Every answer is held in this component's state and nowhere else: leaving the tab
 * unmounts it, and what it read goes with it (ADR-0078, roles §1.7). Coming back reads both again.
 *
 * Coaching's own strings use none of ADR-0084's six words, and none names a phase, an id or a code. They are the
 * catalogue's (`messages/coaching-leader-notes.ts`), in the reader's language.
 */
export function LeaderNotesTab({ coachee }: { coachee: Coachee }) {
  const canReadNotes = useCan('leader_notes:read');
  const { toast, show } = useToast();
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3',
        // UI-040: two columns from 1024px — the ladder and the tracker, then the note, 360px and sticky.
        canReadNotes && 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6',
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
        <CapabilityProfile coachee={coachee} onToast={show} />
      </div>
      {/*
        * A support session reads no note (ADR-0090): the permission is not the reader's there, so
        * nothing is asked for and the card is not drawn. The server refuses it either way.
        */}
      {canReadNotes && (
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:gap-4" data-note-column="">
          <PersonalNotes coachee={coachee} onToast={show} />
        </div>
      )}
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
 * **Every tick saves the whole tick set** at the version it was read (`PUT …/profile`), one save at a time: a tick made
 * while a save is in flight goes in the next one, with the version the last one answered. **The stage is the server's**:
 * the tile's stage, its progress line and the sheet's current stage change when the save answers, never from a count
 * made here.
 *
 * A save another coach has moved past is `VERSION_CONFLICT`: the profile is read again and one line says so. An item
 * archived since it was read is `CONFIG_ARCHIVED`: read again, with the server's words.
 *
 * **Each tick says its save beside it** (P18.95-T1 AC-5): *Saving… → Saved ✓*, or *Couldn't save — retry*. A refused save
 * puts the boxes back, so the retry ticks the box again and saves; a re-read leaves nothing to retry. The milestone's
 * toast stays.
 */
function CapabilityProfile({ coachee, onToast }: { coachee: Coachee; onToast: (message: string) => void }) {
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
  const [ladderOpen, setLadderOpen] = useState(false);
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

  /** Tick or untick one box, and save. A milestone is one code, listed once (UI-035). */
  const toggle = useCallback((part: 'milestone' | 'skill', code: string, on: boolean) => {
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
    void track(`${part}:${code}`, tick);
  }, [save, track]);

  if (error) return <ErrorBanner {...error} />;
  if (!profile || !ticks) return <ProfileSkeleton />;

  const milestoneTicks = new Set(ticks.milestones);
  const skillTicks = new Set(ticks.skills);
  const rungs = ladderRungs(profile.catalog, stageCode, milestoneTicks);
  const notice = (
    <>
      {reread && (
        <p role="status" className="rounded-md border border-hairline bg-base px-3.5 py-2.5 text-sm text-navy">
          {t.reread}
        </p>
      )}
      {saveError && <ErrorBanner {...saveError} />}
    </>
  );

  return (
    <>
      {/* Said in the sheet while it covers the page. */}
      {!ladderOpen && notice}

      <CapabilityTile
        coachee={coachee}
        profile={profile}
        stageCode={stageCode}
        rungs={rungs}
        onOpen={() => setLadderOpen(true)}
      />
      {ladderOpen && (
        <LadderSheet
          open
          onClose={() => setLadderOpen(false)}
          rungs={rungs}
          ticked={milestoneTicks}
          canTick={canTick}
          onTick={(code, on) => toggle('milestone', code, on)}
          statusOf={(code) => statusOf(`milestone:${code}`)}
          notice={reread || saveError ? notice : undefined}
        />
      )}

      <SkillTracker
        coachee={coachee}
        profile={profile}
        ticked={skillTicks}
        canTick={canTick}
        onTick={(code, on) => toggle('skill', code, on)}
        statusOf={(code) => statusOf(`skill:${code}`)}
      />
    </>
  );
}

/**
 * **The *Capability mapping* tile** (UI-035, ~100px on a phone where the ladder took 812): the title with its ⓘ — the
 * privacy line, moved there from the note's card (UI-038) — the four-step progress line, and the current stage with
 * *TAHAP SAAT INI* and ›. **The whole tile is one button** that opens the ladder; the ⓘ sits above it as its own button,
 * so the two are never nested. Below the first stage the row says *Belum mencapai {first stage}*, with no pill.
 */
function CapabilityTile({
  coachee, profile, stageCode, rungs, onOpen,
}: {
  coachee: Coachee;
  profile: CoachingProfile;
  stageCode: string | null;
  rungs: readonly LadderRung[];
  onOpen: () => void;
}) {
  const t = useMessages(coachingLeaderNotesMessages);
  const language = useLanguage();
  const headingId = useId();
  const privacy = t.leaderOnly({ name: coachee.name });
  const current = rungs.find((r) => r.state === 'current') ?? null;
  // Below the first stage: *Belum mencapai {first}*, the most junior stage by seniority (`capabilityTag`).
  const stageText = current ? current.stage.label : capabilityTag(profile.catalog, stageCode, language);
  const empty = rungs.length === 0;

  return (
    <section aria-labelledby={headingId} className={cn(CARD, 'relative')} data-capability-tile="">
      {!empty && (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={t.openLadder({ stage: stageText ?? '' })}
          onClick={onOpen}
          className="absolute inset-0 rounded-lg hover:bg-hover-row/60"
        />
      )}
      <div className="flex min-h-7 items-center gap-1">
        <h2 id={headingId} className="text-lg font-bold text-navy">{t.capability}</h2>
        {/* Above the tile's button, so a tap on it shows the privacy line and never opens the ladder (UI-038). */}
        <TippedGlyph
          glyph={<LineIcon name="info" className="h-[18px] w-[18px]" />}
          name={privacy}
          tip={privacy}
          align="fit"
          className="relative z-[1]"
        />
        {!empty && <LineIcon name="chevronRight" className="pointer-events-none ml-auto text-signal-grey max-lg:hidden" />}
      </div>
      {empty ? (
        // An office made before ADR-0116 (2026-10-08) gave every office the platform ladder.
        <EmptyState title={t.noStages} className="py-6" />
      ) : (
        <div className="pointer-events-none lg:flex lg:items-center lg:gap-4">
          <ProgressLine rungs={rungs} />
          <p className="flex min-h-10 items-center gap-2 text-lg font-bold leading-tight text-navy">
            <span className="min-w-0">{stageText}</span>
            {current && <CurrentStagePill />}
            <LineIcon name="chevronRight" className="ml-auto text-signal-grey lg:hidden" />
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * **The progress line** (UI-035): a step per stage in the ladder's order, the line in the accent up to the current stage
 * and grey after it. Drawn, not read: the stage's name beside it says where the coachee is, for a screen reader too.
 */
function ProgressLine({ rungs }: { rungs: readonly LadderRung[] }) {
  return (
    <div aria-hidden="true" className="my-2 flex items-center lg:my-0 lg:w-[150px] lg:shrink-0" data-progress-line="">
      {rungs.map((rung, i) => (
        <Fragment key={rung.stage.code}>
          {i > 0 && <span className={cn('h-[3px] flex-1', rung.state === 'next' ? 'bg-line' : 'bg-amber')} />}
          <StepMarker state={rung.state} n={rung.n} />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * **The *Skill tracker*** (UI-036, UI-037). Below 1024px an accordion: each section a 44px row with its count, the first
 * incomplete section that applies open and the rest closed; a section that does not apply — a downline section for
 * somebody with nobody below — **stays visible** as a grey row with *Tidak berlaku* (the owner's override of D-08 here),
 * and opening it shows the reason and the greyed list. From 1024px the sections that apply are open columns, and each
 * that does not one row with its reason in italics. **No toast**, as in the prototype.
 */
function SkillTracker({
  coachee, profile, ticked, canTick, onTick, statusOf,
}: {
  coachee: Coachee;
  profile: CoachingProfile;
  ticked: ReadonlySet<string>;
  canTick: boolean;
  onTick: (code: string, on: boolean) => void;
  statusOf: (code: string) => InlineSaveStatusProps;
}) {
  const t = useMessages(coachingLeaderNotesMessages);
  const language = useLanguage();
  // A phone and a tablet draw the accordion; read before paint, so a desktop's columns never flash on a phone.
  const compact = useMediaQuery(['phone', 'tablet'], { beforePaint: true });
  const grids = trackerGrids(profile.catalog, ticked);
  const reasonOf = (grid: CapabilityGridRow) => gridNotApplicable(grid, coachee.downline, coachee.pronoun, language);
  const applies = (grid: CapabilityGridRow) => reasonOf(grid) === null && grid.status !== 'archived';
  // The first incomplete section, as the profile was read: what the reader opens and closes after is theirs.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => {
    const first = firstIncomplete(grids, ticked, applies);
    return new Set(first ? [first] : []);
  });
  const flip = (code: string) => setOpened((now) => {
    const next = new Set(now);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    return next;
  });

  const sections = grids.map((grid) => ({ grid, reason: reasonOf(grid), ...gridCount(grid, ticked) }));
  const rows = (grid: CapabilityGridRow, off: boolean) => gridItems(grid, ticked).map((item) => {
    const archived = item.status === 'archived';
    return (
      <TickRow
        key={item.code}
        label={item.label}
        archived={archived}
        checked={ticked.has(item.code)}
        locked={!canTick || off || archived}
        muted={off}
        onChange={(on) => onTick(item.code, on)}
        status={statusOf(item.code)}
      />
    );
  });

  return (
    <section aria-labelledby="skill-tracker" className={CARD} data-layout={compact ? 'accordion' : 'columns'}>
      <h2 id="skill-tracker" className="flex min-h-7 items-center text-lg font-bold text-navy">{t.tracker}</h2>
      {grids.length === 0 && <EmptyState title={t.noGrids} className="py-6" />}
      {compact ? (
        <div className="mt-1">
          {sections.map(({ grid, reason, done, total }) => {
            const sectionArchived = grid.status === 'archived';
            const off = reason !== null || sectionArchived;
            const isOpen = opened.has(grid.code);
            const bodyId = `skill-section-${grid.code}`;
            const titleId = `${bodyId}-title`;
            return (
              <div key={grid.code} data-section={grid.code}>
                <h3 className="border-t border-divider">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => flip(grid.code)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 text-left text-lg font-bold',
                      reason !== null ? 'text-signal-grey' : 'text-navy',
                    )}
                  >
                    <span id={titleId} className="min-w-0">
                      {grid.label}
                      {sectionArchived && <ArchivedWord />}
                    </span>
                    {reason !== null
                      ? <TonePill tone="grey" className="ml-auto">{t.notApplicable}</TonePill>
                      : <span className="ml-auto text-md font-bold text-muted">{done}/{total}</span>}
                    <LineIcon name={isOpen ? 'chevronUp' : 'chevronDown'} className="text-signal-grey" />
                  </button>
                </h3>
                {isOpen && (
                  <div id={bodyId} role="group" aria-labelledby={titleId} className="pb-1">
                    {reason !== null && <p className="py-1 text-base italic text-signal-grey">{reason}</p>}
                    {rows(grid, off)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 items-start gap-x-6 gap-y-3">
            {sections.filter((s) => s.reason === null).map(({ grid, done, total }) => {
              const sectionArchived = grid.status === 'archived';
              const titleId = `skill-section-${grid.code}-title`;
              return (
                <div key={grid.code} role="group" aria-labelledby={titleId} data-section={grid.code}>
                  <h3 className="mb-1 flex h-8 items-center border-b border-divider text-md font-bold text-navy">
                    <span id={titleId}>
                      {grid.label}
                      {sectionArchived && <ArchivedWord />}
                    </span>
                    <span className="ml-auto text-muted">{done}/{total}</span>
                  </h3>
                  {rows(grid, sectionArchived)}
                </div>
              );
            })}
          </div>
          {sections.filter((s) => s.reason !== null).map(({ grid, reason }) => (
            <p
              key={grid.code}
              data-section={grid.code}
              className="mt-2 flex min-h-10 flex-wrap items-center gap-x-2.5 border-t border-divider text-base"
            >
              <span className="text-md font-bold text-signal-grey">
                {grid.label}
                {grid.status === 'archived' && <ArchivedWord />}
              </span>
              <span className="italic text-signal-grey">{reason}</span>
            </p>
          ))}
        </>
      )}
    </section>
  );
}

/** *Archived* after a section's name, as after a row's. */
function ArchivedWord() {
  const t = useMessages(coachingLeaderNotesMessages);
  return <>{' '}<span className="text-xs font-semibold text-muted">{t.archived}</span></>;
}

/** The tile and the tracker on their way, shaped like them (UI-071's rule, here too): ~100px, then four rows. */
function ProfileSkeleton() {
  const t = useMessages(coachingLeaderNotesMessages);
  return (
    <Skeleton label={t.loading} className="flex flex-col gap-3 lg:gap-4">
      <div className={CARD}>
        <SkeletonBar className="h-5 w-40" />
        <SkeletonBar className="mt-4 h-2 w-full lg:w-[150px]" />
        <SkeletonBar className="mt-4 h-5 w-56" />
      </div>
      <div className={CARD}>
        <SkeletonBar className="h-5 w-32" />
        {[0, 1, 2, 3].map((i) => <SkeletonBar key={i} className="mt-5 h-4 w-full" />)}
      </div>
    </Skeleton>
  );
}

/*
 * ── Personal notes ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * ***Catatan pribadi*** (`Overall.html:4378-4380`; UI-039, UI-040): the reader's own note about the coachee, saved by
 * *Simpan catatan* and by nothing else — no autosave, as in the prototype. **The save state beside the button**
 * (`useSaveState`, the shared one): *Belum disimpan* while the words differ from the saved note, *Tersimpan ✓* once
 * they match again, and leaving with unsaved words asks first. The privacy line is the tile's ⓘ now (UI-038). Then each
 * note somebody below the reader wrote, read-only, tagged *From {author}* (`:4594-4596`; ADR-0073).
 *
 * A save is pinned to the version the note was read at, 0 for a first note. A stale one is read again, and one line
 * says so.
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
  const saved = notes?.mine?.text ?? '';
  const { state, guard } = useSaveState(text, saved, { saving, warnOnLeave: canWrite });

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
      const sent = text;
      const answer = await saveLeaderNote(membershipId, { version: notes.mine?.version ?? 0, text: sent });
      setNotes({ ...notes, mine: { noteId: answer.noteId, text: sent, version: answer.version, updatedAt: answer.updatedAt } });
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
      <Skeleton label={t.loadingNotes} className={CARD}>
        <SkeletonBar className="h-5 w-32" />
        <SkeletonBar className="mt-3 h-24 w-full lg:h-[180px]" />
        <SkeletonBar className="ml-auto mt-3 h-10 w-36" />
      </Skeleton>
    );
  }

  // Nothing written and nothing typed: no state to say yet, so *Tersimpan ✓* never claims a note there is not.
  const showState = state !== 'saved' || notes.mine !== null;

  return (
    <>
      <section aria-labelledby="personal-notes" className={cn(CARD, 'min-w-0')}>
        <h2 id="personal-notes" className="mb-2 flex min-h-7 items-center text-lg font-bold text-navy">{t.notes}</h2>
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
          className="min-h-24 w-full resize-y rounded-lg border-[1.5px] border-line px-3.5 py-3 text-md leading-normal lg:min-h-[180px]"
        />
        {canWrite && (
          <div className="mt-2.5 flex items-center justify-between gap-3">
            {showState ? <SaveStateLabel state={state} /> : <span />}
            <Button onClick={() => void save()} disabled={saving} className="rounded-pill max-lg:min-h-12">
              {t.save}
            </Button>
          </div>
        )}
        {canWrite && guard}
      </section>

      {notes.others.map((note) => <OtherNote key={note.noteId} note={note} />)}
    </>
  );
}

/**
 * A tag that carries a person's name may be longer than a phone's card is wide: it wraps there rather than pushing
 * the page sideways. The card's own tag stays on one line for everything else.
 */
function Wraps({ children }: { children: ReactNode }) {
  return <span className="whitespace-normal">{children}</span>;
}

/**
 * A note somebody below the reader wrote: *Personal notes*, tagged *From {author}* (`Overall.html:4594-4596`), its words
 * as they wrote them and not editable — a note is written only by its author. The heading carries the author for a
 * screen reader too, so no two cards on the page share a name.
 */
function OtherNote({ note }: { note: LeaderNote }) {
  const t = useMessages(coachingLeaderNotesMessages);
  const id = useId();
  return (
    <SummaryCard
      id={id}
      title={<>{t.notes}<span className="sr-only">{t.notesFrom({ name: note.author.name })}</span></>}
      tag={<Wraps>{t.from({ name: note.author.name })}</Wraps>}
      className="min-w-0 px-4 py-3.5 lg:px-[18px] lg:py-4"
    >
      <p className="min-h-[96px] whitespace-pre-wrap break-words rounded-lg border-[1.5px] border-line px-3.5 py-3 text-md leading-normal text-navy">
        {note.text}
      </p>
    </SummaryCard>
  );
}
