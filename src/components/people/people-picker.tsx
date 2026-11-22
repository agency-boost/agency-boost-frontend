'use client';

import { useId, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { memberSheetMessages } from '@/i18n/messages/member-sheet';
import { matchesAgent } from '@/lib/agent-search';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { HierarchyRole } from '@/lib/org';
import { PersonName } from './people-parts';

/** One person the picker offers. */
export interface PickerPerson {
  membershipId: string;
  fullName: string;
  preferredName?: string | null;
  agentCode?: string;
  role: HierarchyRole;
  photoUrl?: string | null;
}

/**
 * **The usual people picker** (P19.20-T4 AC-2, T1 AC-4; the People mockup's frame 27): a search, one radio row per person
 * — photo, the AB / AAB label, the NAME — a short note under the list, and *Batal* + the main action. KPM admins' *Tambah
 * admin* (*Jadikan admin*) and *Menunggu*'s *Pilih leader*. Test accounts never reach it: the lists it is given leave them
 * out on the server (ADR-0267 §1). Centred, its height capped with the list scrolling (DESIGN-RULES, *Dialogs*).
 */
export function PeoplePicker({
  title, people, actionLabel, busyLabel, note, busy = false, error, onPick, onClose,
}: {
  title: string;
  people: readonly PickerPerson[];
  actionLabel: string;
  busyLabel?: string;
  note?: string;
  busy?: boolean;
  error?: ApiError | null;
  onPick: (membershipId: string) => void;
  onClose: () => void;
}) {
  const t = useMessages(memberSheetMessages);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const name = useId();
  const shown = useMemo(
    () => people.filter((p) => !query.trim() || matchesAgent(query, { fullName: p.fullName, preferredName: p.preferredName ?? null, agentCode: p.agentCode ?? '' })),
    [people, query],
  );
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      className="max-w-[32rem]"
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-11 w-full rounded-pill" onClick={onClose}>{t.cancel}</Button>
          <Button className="min-h-11 w-full rounded-pill" disabled={busy || picked === null} onClick={() => picked && onPick(picked)}>
            {busy && busyLabel ? busyLabel : actionLabel}
          </Button>
        </div>
      )}
    >
      {error && <div className="mb-2"><ErrorBanner {...error} /></div>}
      <label className="mb-2 flex h-11 items-center gap-2 rounded-pill border border-hairline px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-focus-ring">
        <LineIcon name="search" className="h-4 w-4" />
        <span className="sr-only">{t.pickerSearch}</span>
        <input
          type="search"
          value={query}
          placeholder={t.pickerSearch}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[1rem] text-ink placeholder:text-muted focus:outline-none md:text-md"
        />
      </label>
      {shown.length === 0 ? (
        <p role="status" className="py-4 text-center text-md text-muted">{t.pickerEmpty}</p>
      ) : (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">{title}</legend>
          {shown.map((p) => (
            <label
              key={p.membershipId}
              className={cn(
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-1.5',
                picked === p.membershipId ? 'border-secondary bg-base' : 'border-hairline bg-card hover:bg-hover-row',
              )}
            >
              <Avatar name={p.fullName} photoUrl={p.photoUrl} seed={p.membershipId} size={32} />
              <PersonName name={p.preferredName?.trim() || p.fullName} role={p.role} className="flex-1 text-md" />
              <input
                type="radio"
                name={name}
                value={p.membershipId}
                checked={picked === p.membershipId}
                onChange={() => setPicked(p.membershipId)}
                className="h-5 w-5 accent-secondary"
              />
            </label>
          ))}
        </fieldset>
      )}
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
    </Modal>
  );
}
