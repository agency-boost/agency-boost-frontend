'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, Field, Select, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
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
const SCOPES = [
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

/** A local `datetime-local` value as an instant the API can store. */
const toInstant = (value: string) => (value ? new Date(value).toISOString() : '');

/**
 * The events an office runs (P5-T6, ADR-0034).
 *
 * **Nothing per-person is here.** RSVP, attendance and feedback are Phase 12's, each a record of
 * its own — the prototype keeps all three on the shared event, so with two users the second
 * overwrites the first's RSVP and reads the first's feedback as their own.
 *
 * **Nothing says when an event is happening except its dates.** The phase badge is worked out on
 * every read; the prototype hardcodes a status beside a date it never checks against, and labels
 * one record *Running* in the list while its own data says past.
 */
export default function EventsSettingsPage() {
  const canWrite = useCan('tenant_config:write');
  const [tab, setTab] = useState('#events');
  const [types, setTypes] = useState<EventTypeRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  /** `'new'` while adding, an id while editing, `null` when the panel is closed. */
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [typeDraft, setTypeDraft] = useState({ label: '', code: '', touched: false, emoji: '' });
  const [addingType, setAddingType] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([listEventTypes(true), listEvents(true)]);
      setTypes(t);
      setEvents(e);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

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

  function eventsTab() {
    if (events === null || types === null) return <SkeletonCards count={3} />;
    const shown = events.filter((e) => showArchived || e.status === 'active');
    const active = types.filter((t) => t.status === 'active');

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-md text-navy">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          {canWrite && (
            <Button
              disabled={busy || adding !== null || active.length === 0}
              onClick={() => { setDraft(emptyDraft()); setAdding('new'); }}
            >
              Add an event
            </Button>
          )}
        </div>

        {active.length === 0 && (
          <Card>
            <p className="text-md text-navy">
              You have no active event types, so there is nothing to file an event under. Add one on
              the <strong>Event types</strong> tab first.
            </p>
          </Card>
        )}

        {adding && addPanel(active)}

        {shown.length === 0 ? (
          <EmptyState title="No events yet. Anything your office runs goes here — training, launches, recognition nights." />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((event) => (
              <li key={event.id}>
                <Card>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-md font-semibold text-navy">{event.title}</h2>
                      {event.blurb && <p className="mt-0.5 text-sm text-muted">{event.blurb}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="text-sm text-muted">{event.code}</code>
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
                        {event.startsOn} · {label(ISSUERS, event.audience.issuer)} ·{' '}
                        {label(SCOPES, event.audience.scope)}
                        {event.audience.inviteeMembershipIds.length > 0 && (
                          <> · {event.audience.inviteeMembershipIds.length} invited</>
                        )}
                        {event.location && <> · {event.location}</>}
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => { setDraft(draftOf(event)); setAdding(event.id); }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void run(() => (event.status === 'archived'
                            ? restoreEvent(event.id)
                            : archiveEvent(event.id)))}
                        >
                          {event.status === 'archived' ? 'Restore' : 'Archive'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function addPanel(active: EventTypeRow[]) {
    const selecting = draft.scope.startsWith('select_');
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
            hint="A leader is somebody with people under them — not a job title."
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
          <p className="mt-2 text-md text-muted">
            Choosing people one by one arrives with the roster picker in phase 12. Until then,
            invite everybody or all leaders.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={busy || !draft.title.trim() || !draft.code.trim()
              || !draft.startsAt || !draft.endsAt || selecting}
            onClick={() => void run(async () => {
              const body = {
                typeCode: draft.typeCode || active[0]?.code,
                title: draft.title.trim(),
                blurb: draft.blurb.trim(),
                startsAt: toInstant(draft.startsAt),
                endsAt: toInstant(draft.endsAt),
                location: draft.location.trim(),
                audience: { issuer: draft.issuer, scope: draft.scope },
              };
              // The code is never sent on an edit: an event that already happened points at it.
              if (editing) await updateEvent(adding!, body);
              else await createEvent({ ...body, code: draft.code.trim() });
              setDraft(emptyDraft());
              setAdding(null);
            })}
          >
            {editing ? 'Save the event' : 'Add the event'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setAdding(null)}>Cancel</Button>
        </div>
      </Card>
    );
  }

  function typesTab() {
    if (types === null) return <SkeletonCards count={3} />;
    const shown = types.filter((t) => showArchived || t.status === 'active');

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-md text-navy">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          {canWrite && (
            <Button
              disabled={busy || addingType !== null}
              onClick={() => {
                setTypeDraft({ label: '', code: '', touched: false, emoji: '' });
                setAddingType('new');
              }}
            >
              Add an event type
            </Button>
          )}
        </div>

        {addingType && (
          <Card>
            <div className="flex flex-wrap items-end gap-3">
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
            </div>
          </Card>
        )}

        {shown.length === 0 ? (
          <EmptyState title="No event types yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((type) => (
              <li key={type.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <span aria-hidden className="text-lg">{type.emoji ?? '📅'}</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-md font-semibold text-navy">{type.label}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="text-sm text-muted">{type.code}</code>
                        <ConfigBadge tone={type.events > 0 ? 'won' : 'open'}>
                          {type.events} {type.events === 1 ? 'event' : 'events'}
                        </ConfigBadge>
                        {type.status === 'archived' && (
                          <ConfigBadge tone="open">Archived</ConfigBadge>
                        )}
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
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
                        variant="secondary"
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
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <SettingsScreen
      title="Events"
      subtitle="What your office is running, and who is invited."
      permission="tenant_config:read"
      subtabs={TABS}
      activeSubtab={tab}
      onSelectSubtab={setTab}
      subtabsLabel="Events sections"
      error={types === null ? error : null}
      bars={<PublishBar />}
    >
      {error && types !== null && (
        <div role="alert" className="mb-4 rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}
      {tab === '#types' ? typesTab() : eventsTab()}
    </SettingsScreen>
  );
}

/** One event as the panel's fields, with the instants back in the browser's local form. */
function draftOf(event: EventRow) {
  const local = (iso: string) => {
    const at = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
      + `T${pad(at.getHours())}:${pad(at.getMinutes())}`;
  };
  return {
    title: event.title, code: event.code, touched: true, typeCode: event.typeCode,
    blurb: event.blurb, startsAt: local(event.startsAt), endsAt: local(event.endsAt),
    location: event.location, issuer: event.audience.issuer, scope: event.audience.scope,
  };
}

function emptyDraft() {
  return {
    title: '', code: '', touched: false, typeCode: '', blurb: '',
    startsAt: '', endsAt: '', location: '', issuer: 'kpm', scope: 'all_agents',
  };
}
