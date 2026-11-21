import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Informal groups and the monthly targets per AB group** — the dialogs KPM Overview, All members and Advanced
 * analytics' *Informal group* share (P19.17-T4; ADR-0270; `components/groups/`).
 *
 * **The Indonesian is the source**: the approved mockups of 19 November word for word — the target card (*Target Group
 * {AB}*, *Target Active Agent per bulan*, *Target Rekrut per bulan*, *Target APE tidak diubah di sini: diambil dari Goal
 * Setting tiap orang.*), the Group dialog (*Group untuk {AB}*, *{n} orang ikut pindah bersama {first}*, *Tanpa group*,
 * *Group baru*), *Group baru* (*Nama group*, *… dan timnya masuk ke group ini · group leader ditunjuk nanti*, *Buat
 * group*) and the brief's link *Kelola semua group di All members ›* and a group card's ⋯ (*Ubah nama · Ubah group leader
 * · Hapus group*). The English is ours. **Kept** (§A): *Group*, *Group Leader*, *Target*, *Active Agent*, *Rekrut*, *Goal
 * Setting*, *All members*, *AB*. Typed content stays as typed: names, group names.
 */
const en = {
  loading: 'Loading…',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  close: 'Close',
  noGroup: 'No group',
  people: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'}`,
  /* The target card. */
  target: {
    title: ({ name }: { name: string }) => `${name}’s group targets`,
    line: ({ role, n, group }: { role: string; n: number; group: string }) => `${role} · ${n} ${n === 1 ? 'person' : 'people'} · ${group}`,
    month: 'Month',
    activeAgent: 'Monthly Active Agent target',
    rekrut: 'Monthly recruitment target',
    apeNote: 'The APE target is not changed here: it comes from each person’s Goal Setting.',
    openActiveAgent: ({ name }: { name: string }) => `Active Agent target, ${name}`,
    openRekrut: ({ name }: { name: string }) => `Recruitment target, ${name}`,
  },
  /* The Group dialog, and Group baru. */
  group: {
    title: ({ name }: { name: string }) => `Group for ${name}`,
    moves: ({ role, n, first }: { role: string; n: number; first: string }) =>
      `${role} · ${n} ${n === 1 ? 'person moves' : 'people move'} with ${first}`,
    movesAll: ({ role }: { role: string }) => `${role} · the whole team moves`,
    options: 'Informal groups',
    newGroup: 'New group',
    manage: 'Manage every group in All members ›',
    newTitle: 'New group',
    name: 'Group name',
    nameMissing: 'Type the group’s name',
    newLine: ({ name }: { name: string }) => `${name} and their team join this group · Group Leaders are appointed later`,
    create: 'Create group',
    creating: 'Creating…',
  },
  /* A group card's ⋯ (Advanced analytics › Informal group). */
  card: {
    more: ({ name }: { name: string }) => `More for ${name}`,
    rename: 'Rename',
    leaders: 'Change Group Leaders',
    remove: 'Delete group',
    renameTitle: 'Rename the group',
    leadersTitle: 'Change Group Leaders',
    leadersLine: 'ABs of this group. A group may have several Group Leaders.',
    noAbs: 'No AB in this group yet.',
    groupLeader: kept('Group Leader'),
    removeTitle: ({ name }: { name: string }) => `Delete group ${name}?`,
    removeLine: ({ n }: { n: number }) => `${n} ${n === 1 ? 'AB' : 'ABs'} in this group and their teams will have no group.`,
    removing: 'Deleting…',
    removeAction: 'Delete',
  },
  /* The interim sheet of a group's AB groups (Advanced analytics' rows, until its rewrite). */
  sheet: {
    open: ({ name }: { name: string }) => `AB groups of ${name}`,
    line: ({ abs, n }: { abs: number; n: number }) => `${abs} AB ${abs === 1 ? 'group' : 'groups'} · ${n} ${n === 1 ? 'person' : 'people'}`,
    inGroup: ({ n }: { n: number }) => `${n} ${n === 1 ? 'person' : 'people'} in their group`,
    target: kept('Target'),
    group: kept('Group'),
    targetOf: ({ name }: { name: string }) => `Targets for ${name}`,
    groupOf: ({ name }: { name: string }) => `Group for ${name}`,
    none: 'No AB group here.',
  },
  noTarget: 'No target yet',
};

const id: MessagesOf<typeof en> = {
  loading: 'Memuat…',
  cancel: 'Batal',
  save: 'Simpan',
  saving: 'Menyimpan…',
  close: 'Tutup',
  noGroup: 'Tanpa group',
  people: ({ n }) => `${n} orang`,
  target: {
    title: ({ name }) => `Target Group ${name}`,
    line: ({ role, n, group }) => `${role} · ${n} orang · ${group}`,
    month: 'Bulan',
    activeAgent: `Target ${kept('Active Agent')} per bulan`,
    rekrut: `Target ${kept('Rekrut')} per bulan`,
    apeNote: `Target APE tidak diubah di sini: diambil dari ${kept('Goal Setting')} tiap orang.`,
    openActiveAgent: ({ name }) => `Target ${kept('Active Agent')}, ${name}`,
    openRekrut: ({ name }) => `Target ${kept('Rekrut')}, ${name}`,
  },
  group: {
    title: ({ name }) => `Group untuk ${name}`,
    moves: ({ role, n, first }) => `${role} · ${n} orang ikut pindah bersama ${first}`,
    movesAll: ({ role }) => `${role} · seluruh tim ikut pindah`,
    options: 'Informal group',
    newGroup: 'Group baru',
    manage: `Kelola semua group di ${kept('All members')} ›`,
    newTitle: 'Group baru',
    name: 'Nama group',
    nameMissing: 'Isi nama group',
    newLine: ({ name }) => `${name} dan timnya masuk ke group ini · group leader ditunjuk nanti`,
    create: 'Buat group',
    creating: 'Membuat…',
  },
  card: {
    more: ({ name }) => `Lainnya untuk ${name}`,
    rename: 'Ubah nama',
    leaders: 'Ubah group leader',
    remove: 'Hapus group',
    renameTitle: 'Ubah nama group',
    leadersTitle: 'Ubah group leader',
    leadersLine: `AB di group ini. Satu group bisa punya beberapa ${kept('Group Leader')}.`,
    noAbs: 'Belum ada AB di group ini.',
    groupLeader: kept('Group Leader'),
    removeTitle: ({ name }) => `Hapus group ${name}?`,
    removeLine: ({ n }) => `${n} AB di group ini dan timnya akan jadi Tanpa group.`,
    removing: 'Menghapus…',
    removeAction: 'Hapus',
  },
  sheet: {
    open: ({ name }) => `AB group di ${name}`,
    line: ({ abs, n }) => `${abs} AB group · ${n} orang`,
    inGroup: ({ n }) => `${n} orang di grupnya`,
    target: kept('Target'),
    group: kept('Group'),
    targetOf: ({ name }) => `Target untuk ${name}`,
    groupOf: ({ name }) => `Group untuk ${name}`,
    none: 'Belum ada AB group di sini.',
  },
  noTarget: 'Belum ada target',
};

export const groupsMessages = defineMessages({ en, id });
