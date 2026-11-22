'use client';

import { Avatar } from '@/components/ui/avatar';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import type { ForumPerson } from '@/lib/leader-meetings';

/** How many photos the stack draws before it stops; the count beside it says the rest. */
const STACK_MAX = 8;

/**
 * **The core leaders' photos, overlapping, and how many they are** (P19.22-T8 AC-1, AC-2): *"7 core leader"* on the
 * navy card, *"7 core leader · semua bisa mengedit"* on a forum's header. Each photo is decorative — the count is the
 * words — and the names are the group's accessible name.
 */
export function CoreLeaderStack({ people, onNavy = false, everyoneEdits = false, className }: {
  people: readonly ForumPerson[];
  onNavy?: boolean;
  everyoneEdits?: boolean;
  className?: string;
}) {
  const t = useMessages(forumMessages);
  const words = `${t.coreLeaders({ n: people.length })}${everyoneEdits ? ` · ${t.everyoneEdits}` : ''}`;
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)} data-core-leaders="">
      {people.length > 0 && (
        <span className="flex shrink-0" role="img" aria-label={people.map((p) => p.name).join(', ')}>
          {people.slice(0, STACK_MAX).map((p, i) => (
            <Avatar
              key={p.membershipId}
              name={p.name}
              photoUrl={p.photoUrl}
              seed={p.membershipId}
              size={28}
              className={cn('ring-2', onNavy ? 'ring-secondary' : 'ring-card', i > 0 && '-ml-1.5')}
            />
          ))}
        </span>
      )}
      <span className={cn('min-w-0 text-sm', onNavy ? 'text-secondary-muted' : 'text-muted')}>{words}</span>
    </div>
  );
}

/** **A PIC as a row draws it**: a photo and a first name — *Semua* or nothing where there is no person. */
export function PicLabel({ person, all = false, emptyLabel }: { person: ForumPerson | null; all?: boolean; emptyLabel?: string }) {
  const t = useMessages(forumMessages);
  if (all) return <span className="text-md font-semibold text-muted">{t.agenda.everyone}</span>;
  if (!person) return emptyLabel ? <span className="text-md text-muted">{emptyLabel}</span> : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar name={person.name} photoUrl={person.photoUrl} seed={person.membershipId} size={24} />
      <span className="truncate text-md font-semibold text-navy">{person.firstName}</span>
    </span>
  );
}

/** A choice's photo in a PIC menu. */
export function PicAvatar({ person }: { person: ForumPerson }) {
  return <Avatar name={person.name} photoUrl={person.photoUrl} seed={person.membershipId} size={24} />;
}
