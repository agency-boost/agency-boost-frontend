'use client';

import { useState } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import {
  addAgendaItem, personOf, pickablePeople, saveAgendaItem, type AgendaItem, type AgendaPic,
} from '@/lib/leader-meetings';
import { ChoiceMenu, type Choice } from './choice-menu';
import { PicAvatar, PicLabel } from './forum-people';
import { withProgress, type ForumWriter } from './forum-writes';
import { InlineText } from './inline-text';

const NONE = 'none';
const ALL = 'all';

/**
 * **The agenda: one checklist** (P19.22-T8 AC-3; `slf-*` frame 6): each line its box — ticked during the forum, the text
 * struck through — its text, editable on a tap, and its PIC on the right, a photo and a first name or *Semua*, chosen
 * from the forum's editors. *+ Tambah agenda* types a new line in place. A text emptied removes the line (the server's
 * rule). Read-only by a link and in a support session: the boxes are drawn, not pressed.
 */
export function Agenda({ writer, editable }: { writer: ForumWriter; editable: boolean }) {
  const t = useMessages(forumMessages);
  const { meeting } = writer;
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const replace = (saved: AgendaItem | { removed: true }, itemId: string) => (m: typeof meeting) => withProgress({
    ...m,
    agenda: 'removed' in saved ? m.agenda.filter((i) => i.id !== itemId) : m.agenda.map((i) => (i.id === itemId ? saved : i)),
  });

  async function save(line: AgendaItem, body: { text?: string; pic?: AgendaPic; done?: boolean }) {
    setPending(line.id);
    await writer.run(() => saveAgendaItem(meeting.id, line.id, { ...body, version: line.version }), (saved, m) => replace(saved, line.id)(m));
    setPending(null);
  }

  async function add(text: string) {
    const ok = await writer.run(() => addAgendaItem(meeting.id, { text }), (added, m) => withProgress({ ...m, agenda: [...m.agenda, added] }));
    if (ok) setAdding(false);
  }

  const picChoices: Choice<string>[] = [
    ...pickablePeople(meeting).map((p) => ({ value: p.membershipId, label: p.firstName, lead: <PicAvatar person={p} /> })),
    { value: ALL, label: t.agenda.everyone },
    { value: NONE, label: t.agenda.noPic },
  ];

  return (
    <section data-forum-agenda="" className="rounded-lg border border-card-edge bg-card">
      {meeting.agenda.length === 0 && !adding && <p className="px-4 py-6 text-center text-md text-muted">{t.agenda.empty}</p>}
      <ul>
        {meeting.agenda.map((line) => {
          const busy = pending === line.id;
          const pic = personOf(meeting, line.picMembershipId);
          return (
            <li key={line.id} data-agenda-line={line.id} className="flex min-h-12 items-center gap-3 border-b border-divider px-4 py-1.5 last:border-0">
              <input
                type="checkbox"
                checked={line.done}
                disabled={!editable || busy}
                aria-label={t.agenda.tick({ text: line.text })}
                onChange={(e) => void save(line, { done: e.target.checked })}
                className="h-5 w-5 shrink-0 cursor-pointer accent-success disabled:cursor-default"
              />
              <InlineText
                value={line.text}
                editable={editable && !busy}
                label={t.agenda.edit({ text: line.text })}
                className={cn('min-w-0 flex-1 text-md', line.done ? 'text-muted line-through' : 'text-ink')}
                onSave={(text) => save(line, { text })}
              />
              {editable ? (
                <ChoiceMenu
                  label={t.agenda.picOf({ text: line.text })}
                  value={line.picAll ? ALL : line.picMembershipId ?? NONE}
                  choices={picChoices}
                  align="end"
                  disabled={busy}
                  onChoose={(v) => void save(line, { pic: v === NONE ? null : v })}
                  className="shrink-0 rounded-pill px-1.5 hover:bg-hover-row"
                >
                  {line.picAll || pic ? <PicLabel person={pic} all={line.picAll} /> : <span className="text-sm font-semibold text-muted">+ {t.agenda.choosePic}</span>}
                </ChoiceMenu>
              ) : (
                <span className="shrink-0"><PicLabel person={pic} all={line.picAll} /></span>
              )}
            </li>
          );
        })}
        {adding && (
          <li className="flex min-h-12 items-center gap-3 border-t border-divider px-4 py-1.5">
            <span className="h-5 w-5 shrink-0 rounded-sm border border-hairline" aria-hidden="true" />
            <InlineText
              value=""
              editable
              startEditing
              placeholder={t.agenda.placeholder}
              label={t.agenda.placeholder}
              maxLength={meeting.limits.textMax}
              className="min-w-0 flex-1 text-md"
              onSave={add}
              onCancel={() => setAdding(false)}
            />
          </li>
        )}
      </ul>
      {editable && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-11 w-full items-center gap-1.5 border-t border-divider px-4 text-md font-semibold text-primary-ink hover:bg-hover-row"
        >
          <LineIcon name="plus" className="h-4 w-4" />
          {t.agenda.add}
        </button>
      )}
    </section>
  );
}
