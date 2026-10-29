import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **A forum meeting's minutes: *Agenda* and *Action Items*, and the print of both** (P18.98-T4, people and forum;
 * `functional/leader-forum.md`, *Agenda*, *Action Items*, *Printing* and *The module's own strings*) — the three
 * sections, *+ Add item*, the tracker's headers, statuses and controls, each field's name for a screen reader, the
 * access note and the lines a write says. Drawn by `components/leader-forum/agenda.tsx`, `action-items.tsx` and
 * `print-layout.tsx`.
 *
 * **English is the source**: the prototype's strings as built (`KPM_Owner.html:2800-2843`) and the module's own (D-copy),
 * none of the six words in either language. The Indonesian is the approved glossary's: the statuses are §B.3's
 * (*Belum direncanakan · Direncanakan · Dijalankan*), the toasts §B.2's; *PIC* is written as Indonesian offices write
 * it, for approval (§B.10). **What the office typed is shown as typed** (ADR-0179 §5): every agenda item, initiative,
 * metric, action, PIC and remark — never a message, in either language.
 *
 * @moved components/leader-forum/agenda.tsx
 * @moved components/leader-forum/action-items.tsx
 * @moved components/leader-forum/print-layout.tsx
 */
const en = {
  /** The agenda's three cards (`:2800-2820`). */
  sections: { preparation: 'Preparation', during: 'During', post: 'Post' },
  /** *PIC*: a tracker column, and the agenda's *"PIC: {name}"* (written with its colon by the screen). */
  pic: 'PIC',
  addItem: '+ Add item',
  /** An agenda item's empty PIC, to an editor (P18.97-T2 AC-5): a prompt in the field, which saves nothing. */
  addPic: 'Add a PIC',
  /** A ticked *During* item read-only: the strike-through said to a screen reader. */
  done: 'Done',
  /** Each agenda input's name (I-255). */
  agendaText: ({ section, n }: { section: string; n: number }) => `${section} item ${n}`,
  agendaPic: ({ section, n }: { section: string; n: number }) => `PIC for ${section} item ${n}`,
  /** The tracker (`:2837-2843`). */
  tracker: 'Action items tracker',
  dragHint: 'Drag ⠿ to reorder',
  headers: {
    initiative: 'Key initiative',
    metric: 'Success metric',
    action: 'Action item',
    pic: 'PIC',
    status: 'Status',
    remarks: 'Remarks / Target',
  },
  addAction: '+ Add action item',
  statuses: { not_planned: 'Not yet planned', planned: 'Planned', implemented: 'Implemented' },
  /** What a landed write says (the toasts). */
  statusUpdated: 'Status updated',
  rowRemoved: 'Row removed',
  reordered: 'Reordered',
  /** Each control's name (I-255): the status, the handle, ×, each cell. */
  statusName: ({ status, next }: { status: string; next: string }) => `${status}. Change to ${next}`,
  handleName: ({ n, initiative }: { n: number; initiative: string }) => `Move row ${n}, ${initiative}. Use the arrow keys.`,
  removeName: ({ n }: { n: number }) => `Remove row ${n}`,
  cellName: ({ column, n }: { column: string; n: number }) => `${column}, row ${n}`,
  /**
   * The access note (F-188): who may edit **now** — `names` the Owner and each Admin, joined as the reader's language
   * joins them (`list`), the tag last.
   */
  accessNote: ({ names, list }: { names: readonly string[]; list: (items: readonly string[]) => string }) =>
    `🔒 Only ${list([...names, 'tagged core leaders'])} can edit this tracker.`,
};

const id: MessagesOf<typeof en> = {
  sections: { preparation: 'Persiapan', during: 'Saat rapat', post: 'Setelah rapat' },
  pic: 'PIC',
  addItem: '+ Tambah item',
  addPic: 'Tambah PIC',
  done: 'Selesai',
  agendaText: ({ section, n }) => `${section}, item ${n}`,
  agendaPic: ({ section, n }) => `PIC untuk ${section}, item ${n}`,
  tracker: 'Pelacak tindakan',
  dragHint: 'Seret ⠿ untuk mengubah urutan',
  headers: {
    initiative: 'Inisiatif utama',
    metric: 'Ukuran keberhasilan',
    action: 'Tindakan',
    pic: 'PIC',
    status: 'Status',
    remarks: `Keterangan / ${kept('Target')}`,
  },
  addAction: '+ Tambah tindakan',
  statuses: { not_planned: 'Belum direncanakan', planned: 'Direncanakan', implemented: 'Dijalankan' },
  statusUpdated: 'Status diperbarui',
  rowRemoved: 'Baris dihapus',
  reordered: 'Urutan diubah',
  statusName: ({ status, next }) => `${status}. Ganti ke ${next}`,
  handleName: ({ n, initiative }) => `Pindahkan baris ${n}, ${initiative}. Gunakan tombol panah.`,
  removeName: ({ n }) => `Hapus baris ${n}`,
  cellName: ({ column, n }) => `${column}, baris ${n}`,
  accessNote: ({ names, list }) =>
    `🔒 Hanya ${list([...names, `${kept('Core Leader')} yang di-tag`])} dapat mengubah pelacak ini.`,
};

export const forumMinutesMessages = defineMessages({ en, id });
