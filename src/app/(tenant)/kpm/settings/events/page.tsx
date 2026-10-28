'use client';

import { useCallback, useEffect, useState } from 'react';
import { AudiencePicker } from '@/components/events/audience-picker';
import { FeedbackDialog } from '@/components/events/feedback-dialog';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import { ADMIN_COPY, officeInstant, officeWallClock, OWNER_PROTOTYPE_COPY } from '@/lib/events-admin';
import { formatCalendarDay } from '@/lib/format';
import { byPhaseAndDate } from '@/lib/settings-order';
import { useHashTab } from '@/lib/use-hash-tab';
import {
  archiveEvent, archiveEventType, createEvent, createEventType, listEventTypes, listEvents,
  restoreEvent, restoreEventType, updateEvent, updateEventType,
  type EventRow, type EventTypeRow,
} from '@/lib/tenant-config';

const TABS = [
  { label: 'Events', href: '#events' },
  { label: 'Event types', href: '#types' },
];

/** The issuer and the scope, which the prototype crams into one free-text string. */
const ISSUERS = [
  { value: 'kpm', label: 'This office' },
  { value: 'company', label: 'Your company' },
  { value: 'group', label: 'A group' },
];
/**
 * The two `select_*` scopes carry a list of people, chosen with the picker beneath the field (P18.5-T5
 * AC-10, D-picker). They were *coming soon* until it was built (F-44, amended as built).
 */
const SCOPES: { value: string; label: string }[] = [
  { value: 'all_agents', label: 'Everybody in the office' },
  { value: 'leaders', label: 'Leaders — anybody with somebody under them' },
  { value: 'select_agents', label: 'Chosen people' },
  { value: 'select_leaders', label: 'Chosen leaders' },
];

const PHASE: Record<string, { tone: 'won' | 'open'; text: string }> = {
  upcoming: { tone: 'open', text: 'Upcoming' },
  running: { tone: 'won', text: 'Happening now' },
  past: { tone: 'open', text: 'Past' },
};

const label = (options: { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

/** Two invitee lists name the same people, in any order. */
const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/** Where a refusal of the panel's save is said: under *Ends*, or under *Who is invited*. */
type FieldRefusal = { field: 'dates' | 'audience'; message: string };

/**
 * The events an office runs (P5-T6, ADR-0034).
 *
 * **Nothing per-person is edited here.** RSVP, the claim and feedback are each member's own record,
 * written on the agent's Events screen. What the office does with them is behind *View feedback* on a
 * past row (`KPM_Owner.html:1655`; P18.5-T5 AC-7, T6 AC-5): the roll call, where the Owner or an Admin
 * confirms who came, and the *Feedback Summary*.
 *
 * **The list is the office's administration's** (P18.5-T5 AC-2): it carries every invitee list and every
 * leaders-only event, so it reads under `event_settings:read`, which no field rung holds.
 *
 * **Nothing says when an event is happening except its dates.** The phase badge is worked out on
 * every read; the prototype hardcodes a status beside a date it never checks against, and labels
 * one record *Running* in the list while its own data says past.
 */
export default function EventsSettingsPage() {
  const canWrite = useCan('tenant_config:write');
  const [tab, setTab] = useHashTab(TABS);
  const [types, setTypes] = useState<EventTypeRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  /** `'new'` while adding, an id while editing, `null` when the panel is closed. */
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  /** The event as it was when *Edit* opened it, so a save sends the audience and the times only when they changed. */
  const [original, setOriginal] = useState<Draft | null>(null);
  const [fieldRefusal, setFieldRefusal] = useState<FieldRefusal | null>(null);
  const [typeDraft, setTypeDraft] = useState({ label: '', code: '', touched: false, emoji: '' });
  const [addingType, setAddingType] = useState<string | null>(null);
  /** The past event whose *View feedback* is open. */
  const [feedbackFor, setFeedbackFor] = useState<EventRow | null>(null);
  const mayReadList = useCan('event_settings:read');
  // *View feedback* opens the roll call (`event_attendance:confirm`) and the summary (`event_feedback:read`).
  const mayConfirm = useCan('event_attendance:confirm');
  const mayReadFeedback = useCan('event_feedback:read');
  const mayViewFeedback = mayConfirm || mayReadFeedback;
  const setInvitees = useCallback((ids: string[]) => setDraft((n) => ({ ...n, invitees: ids })), []);

  const load = useCallback(async () => {
    // The page's gate refuses a reader without the list's read; nothing is asked for them either.
    if (!mayReadList) return;
    try {
      const [t, e] = await Promise.all([listEventTypes(true), listEvents(true)]);
      setTypes(t);
      setEvents(e);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [mayReadList]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * **The panel's save.** The times are the office's wall clock, read in `Asia/Jakarta` whatever the browser's
   * zone (invariant §9). On an edit, **the audience and the times are sent only when they changed** (P18.5-T5
   * AC-9): an ended event people have answered keeps both, and the server refuses a change to either. That
   * refusal is said under the field it is about — the times under *Ends*, in the spec's words; the audience
   * under *Who is invited*, in the server's — and the panel stays open with what was typed.
   */
  const saveEvent = async (fallbackType: string | undefined) => {
    const editing = adding !== null && adding !== 'new';
    const selecting = draft.scope.startsWith('select_');
    const datesChanged = !original || draft.startsAt !== original.startsAt || draft.endsAt !== original.endsAt;
    const audienceChanged = !original || draft.issuer !== original.issuer || draft.scope !== original.scope
      || (selecting && !sameIds(draft.invitees, original.invitees));
    const body = {
      typeCode: draft.typeCode || fallbackType,
      title: draft.title.trim(),
      blurb: draft.blurb.trim(),
      location: draft.location.trim(),
      ...(datesChanged ? { startsAt: officeInstant(draft.startsAt), endsAt: officeInstant(draft.endsAt) } : {}),
      ...(audienceChanged ? {
        audience: {
          issuer: draft.issuer,
          scope: draft.scope,
          ...(selecting ? { inviteeMembershipIds: draft.invitees } : {}),
        },
      } : {}),
    };
    setBusy(true);
    setError(null);
    setFieldRefusal(null);
    try {
      // The code is never sent on an edit: an event that already happened points at it.
      if (editing) await updateEvent(adding!, body);
      else await createEvent({ ...body, code: draft.code.trim() });
      setDraft(emptyDraft());
      setOriginal(null);
      setAdding(null);
      await load();
    } catch (err) {
      const shown = toDisplayError(err);
      const about = err instanceof ApiRequestError && err.status === 409 ? refusedField(shown, datesChanged, audienceChanged) : null;
      if (about === 'dates') setFieldRefusal({ field: 'dates', message: ADMIN_COPY.hasResponses });
      else if (about === 'audience') setFieldRefusal({ field: 'audience', message: shown.message });
      else setError(shown);
    } finally {
      setBusy(false);
    }
  };

  function eventsTab() {
    if (events === null || types === null) return <SkeletonCards count={3} />;
    // Upcoming, then happening now, then past — each by date (P18.97-T4 AC-8, ADR-0176 §8; UI-030).
    const shown = byPhaseAndDate(events.filter((e) => showArchived || e.status === 'active'));
    const active = types.filter((t) => t.status === 'active');

    return (
      <div className="flex flex-col gap-4">
        {active.length === 0 && (
          <Card>
            <p className="text-md text-navy">
              You have no active event types, so there is nothing to file an event under. Add one on
              the <strong>Event types</strong> tab first.
            </p>
          </Card>
        )}

        {adding && addPanel(active)}

        {/*
          * The prototype's `config-table` (`KPM_Owner.html:1651-1656`): one bordered list, a row per event, as the
          * other settings screens draw theirs (P18.8-T13 AC-2, the tidy), where each event was a card of its own.
          */}
        <Card className="p-0">
          {shown.length === 0 ? (
            <EmptyState title="No events yet. Anything your office runs goes here — training, launches, recognition nights." />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {shown.map((event) => {
                const viewable = event.phase === 'past' && mayViewFeedback;
                return (
                  <li key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-md font-semibold text-navy">{event.title}</h2>
                      {event.blurb && <p className="mt-0.5 text-sm text-muted">{event.blurb}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <ConfigBadge tone={PHASE[event.phase].tone}>
                          {PHASE[event.phase].text}
                        </ConfigBadge>
                        <ConfigBadge tone="open">
                          {types.find((t) => t.code === event.typeCode)?.label ?? event.typeCode}
                        </ConfigBadge>
                        {event.status === 'archived' && (
                          <ConfigBadge tone="open">Archived</ConfigBadge>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {formatCalendarDay(event.startsOn)} · {label(ISSUERS, event.audience.issuer)} ·{' '}
                        {label(SCOPES, event.audience.scope)}
                        {event.audience.inviteeMembershipIds.length > 0 && (
                          <> · {event.audience.inviteeMembershipIds.length} invited</>
                        )}
                        {event.location && <> · {event.location}</>}
                      </p>
                    </div>
                    {/* The row's actions in one group, *View feedback* first, as `cfg-actions` holds them (`:1655`). */}
                    {(viewable || canWrite) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {viewable && (
                          <Button variant="inline" onClick={() => setFeedbackFor(event)}>
                            {OWNER_PROTOTYPE_COPY.viewFeedback}
                          </Button>
                        )}
                        {canWrite && (
                          <>
                            <Button
                              variant="inline"
                              disabled={busy}
                              onClick={() => {
                                const opened = draftOf(event);
                                setDraft(opened);
                                setOriginal(opened);
                                setFieldRefusal(null);
                                setAdding(event.id);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="inlineDanger"
                              disabled={busy}
                              onClick={() => void run(() => (event.status === 'archived'
                                ? restoreEvent(event.id)
                                : archiveEvent(event.id)))}
                            >
                              {event.status === 'archived' ? 'Restore' : 'Archive'}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  function addPanel(active: EventTypeRow[]) {
    /*
     * A chosen audience needs somebody in it: Save waits for the first person picked, and the field's
     * line says so while nobody is.
     */
    const selecting = draft.scope.startsWith('select_');
    const nobodyChosen = selecting && draft.invitees.length === 0;
    const editing = adding !== null && adding !== 'new';
    return (
      <Card>
        <div className="flex flex-wrap gap-3">
          <Field label="Title" htmlFor="ev-title" className="min-w-60 flex-1">
            <TextInput
              id="ev-title"
              value={draft.title}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({
                ...n,
                title: e.target.value,
                code: n.touched ? n.code : suggestCode(e.target.value),
              }))}
            />
          </Field>
          <Field
            label="Code"
            htmlFor="ev-code"
            hint={editing ? 'Permanent — it never changes.' : 'Filled in from the title. Permanent.'}
            className="min-w-48"
          >
            <TextInput
              id="ev-code"
              value={draft.code}
              disabled={busy || editing}
              onChange={(e) => setDraft((n) => ({
                ...n, code: e.target.value.toUpperCase(), touched: e.target.value !== '',
              }))}
            />
          </Field>
          <Field label="Type" htmlFor="ev-type" className="min-w-48">
            <Select
              id="ev-type"
              value={draft.typeCode || active[0]?.code}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, typeCode: e.target.value }))}
            >
              {active.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="One line about it" htmlFor="ev-blurb" className="mt-3">
          <TextInput
            id="ev-blurb"
            value={draft.blurb}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, blurb: e.target.value }))}
          />
        </Field>

        <div className="mt-3 flex flex-wrap gap-3">
          <Field
            label="Starts"
            htmlFor="ev-starts"
            hint="Your office’s time."
            className="min-w-56 flex-1"
          >
            <TextInput
              id="ev-starts"
              type="datetime-local"
              value={draft.startsAt}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, startsAt: e.target.value }))}
            />
          </Field>
          <Field
            label="Ends"
            htmlFor="ev-ends"
            hint="Required — without it nothing can say whether the event is running now."
            error={fieldRefusal?.field === 'dates' ? fieldRefusal.message : undefined}
            className="min-w-56 flex-1"
          >
            <TextInput
              id="ev-ends"
              type="datetime-local"
              value={draft.endsAt}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, endsAt: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Where" htmlFor="ev-location" className="mt-3">
          <TextInput
            id="ev-location"
            value={draft.location}
            disabled={busy}
            onChange={(e) => setDraft((n) => ({ ...n, location: e.target.value }))}
          />
        </Field>

        <div className="mt-3 flex flex-wrap gap-3">
          <Field label="Put on by" htmlFor="ev-issuer" className="min-w-48">
            <Select
              id="ev-issuer"
              value={draft.issuer}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, issuer: e.target.value }))}
            >
              {ISSUERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field
            label="Who is invited"
            htmlFor="ev-scope"
            // While a chosen audience has nobody in it, the field's one line says why Save waits: a
            // disabled button with no stated reason is hard to recover from.
            hint={nobodyChosen
              ? 'Pick at least one person below to save.'
              : 'A leader is somebody with people under them — not a job title.'}
            error={fieldRefusal?.field === 'audience' ? fieldRefusal.message : undefined}
            className="min-w-64 flex-1"
          >
            <Select
              id="ev-scope"
              value={draft.scope}
              disabled={busy}
              onChange={(e) => setDraft((n) => ({ ...n, scope: e.target.value }))}
            >
              {SCOPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
        {selecting && (
          <AudiencePicker
            leadersOnly={draft.scope === 'select_leaders'}
            chosen={draft.invitees}
            disabled={busy}
            onChange={setInvitees}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy || !draft.title.trim() || !draft.code.trim()
              || !draft.startsAt || !draft.endsAt || nobodyChosen}
            onClick={() => void saveEvent(active[0]?.code)}
          >
            {editing ? 'Save the event' : 'Add the event'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setAdding(null); setFieldRefusal(null); }}>Cancel</Button>
        </div>
      </Card>
    );
  }

  function typesTab() {
    if (types === null) return <SkeletonCards count={3} />;
    const shown = types.filter((t) => showArchived || t.status === 'active');

    return (
      <div className="flex flex-col gap-4">
        {addingType && (
          <Card>
            <FieldRow>
              <Field label="Name" htmlFor="et-label" className="min-w-48 flex-1">
                <TextInput
                  id="et-label"
                  value={typeDraft.label}
                  disabled={busy}
                  onChange={(e) => setTypeDraft((n) => ({
                    ...n,
                    label: e.target.value,
                    code: n.touched ? n.code : suggestCode(e.target.value),
                  }))}
                />
              </Field>
              <Field label="Code" htmlFor="et-code" hint="Permanent." className="min-w-40">
                <TextInput
                  id="et-code"
                  value={typeDraft.code}
                  disabled={busy || addingType !== 'new'}
                  onChange={(e) => setTypeDraft((n) => ({
                    ...n, code: e.target.value.toUpperCase(), touched: e.target.value !== '',
                  }))}
                />
              </Field>
              <Field label="Emoji" htmlFor="et-emoji" hint="The poster is an emoji." className="min-w-24">
                <TextInput
                  id="et-emoji"
                  value={typeDraft.emoji}
                  disabled={busy}
                  onChange={(e) => setTypeDraft((n) => ({ ...n, emoji: e.target.value }))}
                />
              </Field>
              <FieldRow.Actions>
                <Button
                  disabled={busy || !typeDraft.label.trim() || !typeDraft.code.trim()}
                  onClick={() => void run(async () => {
                    const body = {
                      label: typeDraft.label.trim(),
                      emoji: typeDraft.emoji.trim() || null,
                    };
                    if (addingType === 'new') {
                      await createEventType({ ...body, code: typeDraft.code.trim() });
                    } else {
                      await updateEventType(addingType!, body);
                    }
                    setTypeDraft({ label: '', code: '', touched: false, emoji: '' });
                    setAddingType(null);
                  })}
                >
                  {addingType === 'new' ? 'Add' : 'Save'}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setAddingType(null)}>
                  Cancel
                </Button>
              </FieldRow.Actions>
            </FieldRow>
          </Card>
        )}

        {/* One bordered list, a row per type, as the events tab and the other settings screens draw theirs. */}
        <Card className="p-0">
          {shown.length === 0 ? (
            <EmptyState title="No event types yet." />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {shown.map((type) => (
                <li key={type.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <span aria-hidden className="text-lg">{type.emoji ?? '📅'}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-md font-semibold text-navy">{type.label}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <ConfigBadge tone={type.events > 0 ? 'won' : 'open'}>
                        {type.events} {type.events === 1 ? 'event' : 'events'}
                      </ConfigBadge>
                      {type.status === 'archived' && (
                        <ConfigBadge tone="open">Archived</ConfigBadge>
                      )}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="inline"
                        disabled={busy}
                        onClick={() => {
                          setTypeDraft({
                            label: type.label, code: type.code, touched: true,
                            emoji: type.emoji ?? '',
                          });
                          setAddingType(type.id);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="inlineDanger"
                        disabled={busy}
                        title={type.status === 'archived'
                          ? undefined
                          : `Keeps the ${type.events} event(s) already filed under it readable, and `
                            + 'stops new ones being added.'}
                        onClick={() => void run(() => (type.status === 'archived'
                          ? restoreEventType(type.id)
                          : archiveEventType(type.id)))}
                      >
                        {type.status === 'archived' ? 'Restore' : 'Archive'}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  /*
   * **The toolbar** — the prototype's `config-toolbar` (`:1647-1650`, `:1659-1662`), in `SettingsScreen`'s slot as
   * the other settings screens hold theirs (P18.8-T13 AC-2): *Show archived*, one box for both tabs, and the tab's
   * add button on the right, once the lists it adds to are read.
   */
  const activeTypes = types?.filter((t) => t.status === 'active') ?? [];
  const toolbar = types === null || (tab !== '#types' && events === null) ? undefined : {
    actions: (
      <>
        <label className="flex items-center gap-2 text-md text-navy">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        {canWrite && (tab === '#types' ? (
          <Button
            disabled={busy || addingType !== null}
            onClick={() => {
              setTypeDraft({ label: '', code: '', touched: false, emoji: '' });
              setAddingType('new');
            }}
          >
            Add an event type
          </Button>
        ) : (
          <Button
            disabled={busy || adding !== null || activeTypes.length === 0}
            onClick={() => { setDraft(emptyDraft()); setOriginal(null); setFieldRefusal(null); setAdding('new'); }}
          >
            Add an event
          </Button>
        ))}
      </>
    ),
  };

  return (
    <SettingsScreen
      title="Events"
      subtitle="What your office is running, and who is invited."
      permission="event_settings:read"
      tabs={TABS}
      tabsLabel="Events sections"
      activeHref={tab}
      onSelectTab={setTab}
      error={types === null ? error : null}
      bars={<PublishBar />}
      toolbar={toolbar}
    >
      {error && types !== null && (
        <div role="alert" className="mb-4 rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}
      {tab === '#types' ? typesTab() : eventsTab()}
      {feedbackFor && (
        <FeedbackDialog eventId={feedbackFor.id} title={feedbackFor.title} onClose={() => setFeedbackFor(null)} />
      )}
    </SettingsScreen>
  );
}

/**
 * Which field a `409` on the panel's save is about: the one the server names (`details.field`), else the one
 * the save changed — the times first, since `EVENT_HAS_RESPONSES` is theirs (AC-9).
 */
function refusedField(shown: ApiError, datesChanged: boolean, audienceChanged: boolean): FieldRefusal['field'] | null {
  const named = shown.details?.field;
  if (named === 'dates' || named === 'audience') return named;
  if (shown.code === 'EVENT_HAS_RESPONSES' && datesChanged) return 'dates';
  return audienceChanged ? 'audience' : null;
}

type Draft = ReturnType<typeof emptyDraft>;

/** One event as the panel's fields, its instants as the office's wall clock (invariant §9). */
function draftOf(event: EventRow): Draft {
  return {
    title: event.title, code: event.code, touched: true, typeCode: event.typeCode,
    blurb: event.blurb, startsAt: officeWallClock(event.startsAt), endsAt: officeWallClock(event.endsAt),
    location: event.location, issuer: event.audience.issuer, scope: event.audience.scope,
    invitees: [...event.audience.inviteeMembershipIds] as string[],
  };
}

function emptyDraft() {
  return {
    title: '', code: '', touched: false, typeCode: '', blurb: '',
    startsAt: '', endsAt: '', location: '', issuer: 'kpm', scope: 'all_agents',
    invitees: [] as string[],
  };
}
