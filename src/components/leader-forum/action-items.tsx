'use client';

import { useRef, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import {
  ACTION_STATUSES, addActionItem, personOf, pickablePeople, removeActionItem, saveActionItem, type ActionItem,
  type ActionStatus,
} from '@/lib/leader-meetings';
import { ChoiceMenu, type Choice } from './choice-menu';
import { PicAvatar, PicLabel } from './forum-people';
import { withProgress, type ForumWriter } from './forum-writes';
import { InlineText } from './inline-text';

/** *Belum* red, *Proses* amber, *Selesai* green — each on its own tint, from tokens (the mockup's pills). */
export const STATUS_PILL: Record<ActionStatus, string> = {
  todo: 'bg-pill-red text-pill-red-ink',
  doing: 'bg-pill-amber text-pill-amber-ink',
  done: 'bg-pill-green text-pill-green-ink',
};

const NONE = 'none';

/** The columns from 768px: the item, *PIC*, *Tenggat*, *Status*, the trash. */
const GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_9rem_7.5rem_8.5rem_2.75rem] md:items-center md:gap-3';

/**
 * **The action items** (P19.22-T8 AC-4; `slf-*` frames 7–9): each row the item — *dari forum #n* under it when carried —
 * its PIC (a photo and a first name, chosen from the forum's editors), its *tenggat*, its state as a pill that opens
 * *Belum · Proses · Selesai*, and a trash that asks *Hapus action item?* first (*"Juga hilang dari forum berikutnya.
 * Tidak bisa dibatalkan."*, *Batal* · *Hapus* in red). The text is edited on a tap; *+ Tambah action item* types one in
 * place. Under the card: *Action item yang belum selesai otomatis pindah ke forum berikutnya* and the tap hint.
 *
 * **On a phone each row is three short lines** (part C): the item, then PIC · tenggat, then the state and the trash.
 */
export function ActionItems({ writer, editable }: { writer: ForumWriter; editable: boolean }) {
  const t = useMessages(forumMessages);
  const language = useFigureLanguage();
  const { meeting } = writer;
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ActionItem | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  const replace = (saved: ActionItem) => (m: typeof meeting) =>
    withProgress({ ...m, actionItems: m.actionItems.map((i) => (i.id === saved.id ? saved : i)) });

  async function save(item: ActionItem, body: { text?: string; pic?: string | null; dueOn?: string | null; status?: ActionStatus }) {
    setPending(item.id);
    await writer.run(() => saveActionItem(meeting.id, item.id, { ...body, version: item.version }), (saved, m) => replace(saved)(m));
    setPending(null);
  }

  async function add(text: string) {
    const ok = await writer.run(
      () => addActionItem(meeting.id, { text }),
      (added, m) => withProgress({ ...m, actionItems: [...m.actionItems, added] }),
    );
    if (ok) setAdding(false);
  }

  async function confirmRemove() {
    const item = removing;
    if (!item) return;
    setRemoving(null);
    setPending(item.id);
    await writer.run(
      () => removeActionItem(meeting.id, item.id, item.version),
      (_, m) => withProgress({ ...m, actionItems: m.actionItems.filter((i) => i.id !== item.id) }),
    );
    setPending(null);
  }

  const statusChoices: Choice<ActionStatus>[] = ACTION_STATUSES.map((s) => ({
    value: s, label: t.actions.status[s], lead: <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_PILL[s])} aria-hidden="true" />,
  }));
  const picChoices: Choice<string>[] = [
    ...pickablePeople(meeting).map((p) => ({ value: p.membershipId, label: p.firstName, lead: <PicAvatar person={p} /> })),
    { value: NONE, label: t.agenda.noPic },
  ];

  return (
    <div data-forum-actions="">
      <section className="rounded-lg border border-card-edge bg-card">
        <div className={cn('hidden border-b border-divider px-4 py-2.5 text-sm font-semibold text-muted', GRID)} aria-hidden="true">
          <span>{t.actions.headers.item}</span>
          <span>{t.actions.headers.pic}</span>
          <span>{t.actions.headers.due}</span>
          <span>{t.actions.headers.status}</span>
          <span />
        </div>
        {meeting.actionItems.length === 0 && !adding && <p className="px-4 py-6 text-center text-md text-muted">{t.actions.empty}</p>}
        <ul>
          {meeting.actionItems.map((item) => {
            const busy = pending === item.id;
            const pic = personOf(meeting, item.picMembershipId);
            return (
              <li key={item.id} data-action-item={item.id} className={cn('flex flex-col gap-1 border-b border-divider px-4 py-2.5 last:border-0', GRID)}>
                <div className="min-w-0">
                  <InlineText
                    value={item.text}
                    editable={editable && !busy}
                    label={t.actions.edit({ text: item.text })}
                    maxLength={meeting.limits.textMax}
                    className="w-full text-md font-semibold text-navy"
                    onSave={(text) => save(item, { text })}
                  />
                  {item.fromNumber !== null && (
                    <span className="block px-1 text-sm font-semibold text-primary-ink">{t.actions.from({ n: item.fromNumber })}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 md:contents">
                  {editable ? (
                    <ChoiceMenu
                      label={t.actions.picOf({ text: item.text })}
                      value={item.picMembershipId ?? NONE}
                      choices={picChoices}
                      disabled={busy}
                      onChoose={(v) => void save(item, { pic: v === NONE ? null : v })}
                      className="rounded-pill px-1 hover:bg-hover-row"
                    >
                      <PicLabel person={pic} emptyLabel={`+ ${t.agenda.choosePic}`} />
                    </ChoiceMenu>
                  ) : <PicLabel person={pic} emptyLabel="—" />}
                  {editable ? (
                    <DateField
                      value={item.dueOn ?? ''}
                      onChange={(day) => { if (day && day !== item.dueOn) void save(item, { dueOn: day }); }}
                      aria-label={t.actions.dueOf({ text: item.text })}
                      density="cell"
                      emptyText={t.actions.noDue}
                      format={(day, lang) => formatShortDay(day, {}, lang)}
                      disabled={busy}
                      className="w-32 md:w-full"
                    />
                  ) : (
                    <span className="text-md text-ink">{item.dueOn ? formatShortDay(item.dueOn, {}, language) : '—'}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 md:contents">
                  {editable ? (
                    <ChoiceMenu
                      label={t.actions.statusOf({ text: item.text })}
                      value={item.status}
                      choices={statusChoices}
                      disabled={busy}
                      onChoose={(status) => void save(item, { status })}
                      className={cn('w-fit rounded-pill px-3 text-sm font-semibold', STATUS_PILL[item.status])}
                    >
                      {t.actions.status[item.status]}
                    </ChoiceMenu>
                  ) : (
                    <span className={cn('w-fit rounded-pill px-3 py-1 text-sm font-semibold', STATUS_PILL[item.status])}>{t.actions.status[item.status]}</span>
                  )}
                  {editable ? (
                    <button
                      type="button"
                      aria-label={t.actions.remove({ text: item.text })}
                      disabled={busy}
                      onClick={() => setRemoving(item)}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-pill-red hover:text-alert"
                    >
                      <LineIcon name="trash" className="h-5 w-5" />
                    </button>
                  ) : <span />}
                </div>
              </li>
            );
          })}
          {adding && (
            <li className="border-t border-divider px-4 py-2.5">
              <InlineText
                value=""
                editable
                startEditing
                placeholder={t.actions.placeholder}
                label={t.actions.placeholder}
                maxLength={meeting.limits.textMax}
                className="w-full text-md"
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
            {t.actions.add}
          </button>
        )}
      </section>
      <p className="mt-2 flex flex-col gap-1 text-sm text-muted md:flex-row md:gap-4">
        <span>{t.actions.carryHint}</span>
        {editable && <span>{t.actions.tapHint}</span>}
      </p>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t.actions.confirmTitle}
        placement="popup"
        initialFocus={cancel}
        footer={(
          <div className="grid grid-cols-2 gap-2.5">
            <Button ref={cancel} variant="secondary" onClick={() => setRemoving(null)}>{t.actions.cancel}</Button>
            <Button variant="danger" className="border-alert bg-alert text-white hover:bg-alert" onClick={() => void confirmRemove()}>
              {t.actions.delete}
            </Button>
          </div>
        )}
      >
        {removing && (
          <>
            <p className="text-md font-semibold text-navy">“{removing.text}”</p>
            <p className="mt-1 text-sm text-muted">{t.actions.confirmBody}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
