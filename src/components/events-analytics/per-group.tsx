'use client';

import { useId, useState } from 'react';
import { PersonName } from '@/components/advanced-analytics/shared';
import { Avatar } from '@/components/ui/avatar';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import { cn } from '@/lib/cn';
import type { Kehadiran, KehadiranFigure, KehadiranGroupCard } from '@/lib/event-analytics';
import { formatShortDay } from '@/lib/format';
import { NoDataLine, ThinBar, TONE_FILL, toneText, useFigureText, usePercentText } from './parts';

/**
 * ***Per group*** (P19.25-T1 AC-4; ADR-0281 §3): the Informal group tab's card format — one card per informal group (its
 * first Group Leader's photo, *Group Leader NAME · n orang*, *n AB group*, a chevron) with **two orange tiles**:
 * ***Rata-rata · 15 event terakhir*** and the event chosen beside the sub-tabs (*Bandingkan dengan*), each with the
 * percentage as the big number (24px, coloured), *"7,1 dari 10 orang"* beside it and a bar. **Open**, the card lists its
 * AB groups with the same two numbers as coloured pills, percentage first (*"45% 4,5 / 10"*). No table, no per-event
 * columns. Every figure is the server's.
 */
export function PerGroup({ view, compareIndex }: { view: Kehadiran; compareIndex: number | null }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(view.groups.slice(0, 1).map((g) => g.key)));
  if (view.groups.length === 0) return <div className="rounded-card bg-card"><NoDataLine /></div>;
  const toggle = (key: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return (
    <div className="space-y-3">
      {view.groups.map((card) => (
        <GroupCard key={card.key} view={view} card={card} compareIndex={compareIndex} open={open.has(card.key)} onToggle={() => toggle(card.key)} />
      ))}
    </div>
  );
}

function GroupCard({ view, card, compareIndex, open, onToggle }: {
  view: Kehadiran;
  card: KehadiranGroupCard;
  compareIndex: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useMessages(eventAnalyticsMessages);
  const language = useFigureLanguage();
  const figure = useFigureText();
  const listId = useId();
  const name = card.group?.name ?? t.noGroup;
  const head = card.leaders[0];
  const chosen = compareIndex === null ? null : view.past[compareIndex];
  const chosenLabel = chosen ? `${chosen.title} · ${formatShortDay(chosen.startsOn, {}, language)}` : null;
  const recentLabel = t.recentTile({ n: figure(view.recentEvents, 0) });
  return (
    <section
      data-group-card={card.key}
      className={cn('relative overflow-hidden rounded-card bg-card', open && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[""]')}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5">
        {head
          ? <Avatar name={head.name} photoUrl={head.photoUrl} seed={head.membershipId} size={32} />
          : (
            <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pill-grey text-muted">
              <LineIcon name="users" className="h-[18px] w-[18px]" />
            </span>
          )}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-navy">{name}</h3>
          <p className="text-sm text-muted">
            {card.leaders.length > 0 && `${t.groupLeader({ names: card.leaders.map((l) => l.name.toUpperCase()).join(', ') })} · `}
            {t.people({ n: figure(card.people, 0) })}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-sm font-bold text-primary-ink">{t.abGroups({ n: figure(card.abGroups.length, 0) })}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? t.closeCard({ name }) : t.openCard({ name })}
          onClick={onToggle}
          className="-mr-2 -mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center text-primary-ink"
        >
          <LineIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-2 px-4 pb-3.5 pt-2.5 md:grid-cols-2">
        <Tile label={recentLabel} figure={card.recent} />
        {chosenLabel && compareIndex !== null && <Tile label={chosenLabel} figure={card.byEvent[compareIndex] ?? null} />}
      </div>
      {open && (
        <ul id={listId} className="divide-y divide-divider border-t border-divider">
          {card.abGroups.map((row) => (
            <li key={row.ab.membershipId} data-ab-group={row.ab.membershipId} className="grid gap-2 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
              <PersonName person={row.ab} size={30} meta={t.people({ n: figure(row.people, 0) })} />
              <MiniPill label={t.recentPill({ n: figure(view.recentEvents, 0) })} figure={row.recent} />
              {chosen && compareIndex !== null && <MiniPill label={chosen.title} figure={row.byEvent[compareIndex] ?? null} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One orange tile: its label, the percentage big and coloured, *"7,1 dari 10 orang"*, a bar. */
function Tile({ label, figure: f }: { label: string; figure: KehadiranFigure | null }) {
  const t = useMessages(eventAnalyticsMessages);
  const pct = usePercentText();
  const figure = useFigureText();
  return (
    <div className="rounded-row bg-today p-3 text-navy">
      <p className="truncate text-sm font-bold">{label}</p>
      <p className="my-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className={cn('text-[24px] font-extrabold leading-tight tabular-nums', toneText(f?.tone ?? null))}>{pct(f?.pct ?? null)}</span>
        {f && f.pct !== null && <span className="text-sm font-semibold">{t.ofPeople({ h: figure(f.hadir), n: figure(f.expected) })}</span>}
      </p>
      <ThinBar pct={f?.pct ?? null} tone={f?.tone ?? null} track="bg-card" />
    </div>
  );
}

/** An AB group's number as a coloured pill, percentage first: *"45% 4,5 / 10"*. */
function MiniPill({ label, figure: f }: { label: string; figure: KehadiranFigure | null }) {
  const pct = usePercentText();
  const figure = useFigureText();
  return (
    <span className="flex min-w-0 flex-col md:w-40">
      <span className="truncate text-xs text-muted">{label}</span>
      <span className={cn('mt-0.5 inline-flex w-fit items-baseline gap-1.5 rounded-pill px-2.5 py-1 text-sm tabular-nums', f?.tone ? TONE_FILL[f.tone] : 'bg-pill-grey text-pill-grey-ink')}>
        <b className="font-extrabold">{pct(f?.pct ?? null)}</b>
        {f && f.pct !== null && <span>{`${figure(f.hadir)} / ${figure(f.expected)}`}</span>}
      </span>
    </span>
  );
}
