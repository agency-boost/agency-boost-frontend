'use client';

import { useState, type ReactNode } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { Avatar } from '@/components/ui/avatar';
import { RungTag } from '@/components/ui/rung-tag';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import {
  BUCKET_TONE, firstRows, PREVIEW_ROWS, rowCount, type OverviewPerson, type TreeGroup,
} from '@/lib/kpm-overview';
import { useCan, useSession } from '@/lib/session';

/** The status tiles' and the person tiles' paint, the status pills' tokens: red, yellow, green, grey. */
export const TONE_CLASS: Record<'red' | 'amber' | 'green' | 'grey', string> = {
  red: 'bg-pill-red text-pill-red-ink',
  amber: 'bg-pill-amber text-pill-amber-ink',
  green: 'bg-pill-green text-pill-green-ink',
  grey: 'bg-pill-grey text-pill-grey-ink',
};

/** One filter tile: its count, its words and its tone. */
export interface FilterTile<K extends string> {
  key: K;
  count: number;
  label: string;
  tone: 'red' | 'amber' | 'green';
}

/**
 * **The filter tiles** (P19.19-T1 AC-3, AC-4, T3 AC-3; the mockup's *4 Belum pernah pakai · 4 Pakai > 14 hari lalu · 22
 * Pakai ≤ 14 hari*): a count over its words in its tone, the chosen one outlined. A radio group: one is always chosen.
 */
export function FilterTiles<K extends string>({
  label, tiles, value, onChange,
}: { label: string; tiles: readonly FilterTile<K>[]; value: K; onChange: (key: K) => void }) {
  const figures = useFigureLanguage();
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1.5 p-2">
      {tiles.map((tile) => {
        const chosen = tile.key === value;
        return (
          <button
            key={tile.key}
            type="button"
            role="radio"
            aria-checked={chosen}
            data-tile={tile.key}
            onClick={() => onChange(tile.key)}
            className={cn(
              'flex min-h-12 flex-col items-start justify-center rounded-lg border-2 px-2.5 py-1.5 text-left',
              chosen ? 'border-current' : 'border-transparent',
              TONE_CLASS[tile.tone],
            )}
          >
            <b className="text-lg font-extrabold leading-tight">{formatNumber(tile.count, {}, figures)}</b>
            <span className="text-xs font-bold leading-tight">{tile.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A person's one status tile: its words in its tone. */
export function StatusTile({ tone, children }: { tone: keyof typeof TONE_CLASS; children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-[6px] px-2 py-0.5 text-sm font-bold leading-5', TONE_CLASS[tone])}>
      {children}
    </span>
  );
}

/** *Pakai n hari lalu* / *Belum pernah pakai*, in its tone. */
export function UsageTile({ person }: { person: OverviewPerson }) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const { status, days } = person.usage;
  const words = status === 'never' || days === null ? t.usageNever
    : days === 0 ? t.usedToday : t.usedDaysAgo({ n: formatNumber(days, {}, figures) });
  return <StatusTile tone={BUCKET_TONE[status]}>{words}</StatusTile>;
}

/**
 * **The tree** (P19.19-T1 AC-3; the brief's §2, *"list laid out like Group Tree"*): each informal group's header, then
 * its people — the AB at the left, their AABs and direct agents one step in, an AAB's agents two — each with their photo,
 * the orange *AB* / *AAB* before the name in capitals, *"n orang di timnya"* under a leader whose team matches, one status
 * tile and WhatsApp. **The first rows, then *Lihat semua (n) ›***, so the two columns end level; it opens in place.
 *
 * WhatsApp is the shared green circle (`MemberContactButtons`): straight to the chat with a number on file, *Isi nomor
 * WhatsApp* for a reader who may save one, nothing for the reader's own row.
 */
export function PeopleTree({
  tree, tile, preview = true, label,
}: {
  tree: readonly TreeGroup[];
  /** The status tile a row draws: `null` for none (an item that does not apply to a leader shown for their team). */
  tile: (person: OverviewPerson) => ReactNode;
  /** Show the first rows and *Lihat semua*; `false` draws every row (a dialog). */
  preview?: boolean;
  label: string;
}) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const [all, setAll] = useState(false);
  const total = rowCount(tree);
  const shown = preview && !all ? firstRows(tree, PREVIEW_ROWS) : tree;
  if (total === 0) return <p className="px-3 py-4 text-sm text-muted">{t.nobodyHere}</p>;
  return (
    <div>
      <ul aria-label={label}>
        {shown.map((group) => (
          <li key={group.groupId ?? 'none'}>
            <p className="bg-primary/[0.12] px-3 py-1.5 text-sm font-bold text-navy">{group.name ?? t.noGroup}</p>
            <ul>
              {group.rows.map((row) => (
                <PersonRow
                  key={row.person.membershipId}
                  person={row.person}
                  inTeam={row.inTeam}
                  tile={tile(row.person)}
                  teamWords={row.inTeam > 0 ? t.inTeam({ n: formatNumber(row.inTeam, {}, figures) }) : null}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {preview && total > PREVIEW_ROWS && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((was) => !was)}
          className="flex min-h-11 w-full items-center justify-center border-t border-divider text-md font-bold text-navy hover:underline"
        >
          {all ? t.showFewer : t.seeAll({ n: formatNumber(total, {}, figures) })}
        </button>
      )}
    </div>
  );
}

const INDENT = ['pl-3', 'pl-8', 'pl-14'] as const;

function PersonRow({
  person, inTeam, tile, teamWords,
}: { person: OverviewPerson; inTeam: number; tile: ReactNode; teamWords: string | null }) {
  const { me } = useSession();
  const canSavePhone = useCan('member:update_phone');
  const [saved, setSaved] = useState<string | null>(null);
  const self = me?.membership?.membershipId === person.membershipId;
  const phone = saved ?? person.phone;
  const leader = person.role !== 'agent';
  return (
    <li
      data-person={person.membershipId}
      data-depth={person.depth}
      data-in-team={inTeam}
      className={cn('flex min-h-14 items-center gap-2.5 border-t border-divider py-2 pr-3', INDENT[person.depth])}
    >
      <Avatar name={person.name} photoUrl={person.photoUrl} seed={person.membershipId} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight text-ink [overflow-wrap:anywhere]">
          {leader && <RungTag rung={{ code: person.role.toUpperCase(), label: person.role.toUpperCase() }} className="mr-1" />}
          <span className="uppercase">{person.name}</span>
        </p>
        {teamWords && <p className="text-xs text-muted">{teamWords}</p>}
      </div>
      {tile}
      {!self && (phone || canSavePhone) ? (
        <span className="-mx-1 flex">
          <MemberContactButtons
            membershipId={person.membershipId}
            name={person.name}
            phone={phone}
            channels={['whatsapp']}
            size={36}
            onSaved={setSaved}
          />
        </span>
      ) : <span aria-hidden="true" className="w-9 shrink-0" />}
    </li>
  );
}
