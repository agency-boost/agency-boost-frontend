import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The activity binding's editor** (ADR-0163; P18.10-T4): the three cascade roles, each a list of activity types —
 * the Super Admin's office *Activity binding* card and a template's *Activity types* tab
 * (`components/activity-binding-fields.tsx`).
 *
 * **Not here: the roles' names.** *Set appointment*, *Sales meeting* and *Submission polis* are the goal cascade's
 * stages, the client's own words and kept English (§A.6), so `lib/activity-binding.ts` writes them `kept('…')`. An
 * activity type's name is the office's or the template's, shown as typed (ADR-0179 §5).
 *
 * **And the Owner's and the Admin's editor of their own office's** (P19.4-T3; ADR-0206 §1): a button on *Activity types*
 * and its sheet (`components/activity-binding-sheet.tsx`); and the Super Admin's card says who sets it now.
 *
 * @moved components/activity-binding-fields.tsx
 * @moved lib/activity-binding.ts
 * @moved components/activity-binding-sheet.tsx
 */
const en = {
  /** A type's name in the lists, with its state where it is archived: *Referral (archived)*. */
  typeName: ({ label, archived }: { label: string; archived: boolean }) => (archived ? `${label} (archived)` : label),
  /** The list's name, for a screen reader: *Sales meeting counts*. */
  roleCounts: ({ role }: { role: string }) => `${role} counts`,
  countsNothing: 'Counts nothing yet.',
  /** A type's ×, named for both: *Remove Referral from Sales meeting*; and its tooltip. */
  removeFrom: ({ name, role }: { name: string; role: string }) => `Remove ${name} from ${role}`,
  removeFromRole: ({ role }: { role: string }) => `Remove from ${role}`,
  /** The select that adds one, named for its role, and its first option. */
  addTo: ({ role }: { role: string }) => `Add an activity to ${role}`,
  addPrompt: 'Add an activity…',
  /** The Owner's button on *Activity types*, its sheet and its words (P19.4-T3). */
  office: {
    open: 'Activity binding',
    lead: 'Which activities the summary, the goal plan and coaching count at each stage. To replace an activity, add '
      + 'the new one beside the old: what was logged against the old one keeps counting.',
    save: 'Save binding',
    saved: 'Saved. The summary counts it from now.',
  },
  /** The Super Admin's card, read-only since P19.4-T3: who sets it. */
  setByOffice: `The ${kept('KPM')}’s Owner or an Admin sets this on their ${kept('Activity types')} page.`,
};

const id: MessagesOf<typeof en> = {
  typeName: ({ label, archived }) => (archived ? `${label} (diarsipkan)` : label),
  roleCounts: ({ role }) => `Yang dihitung ${role}`,
  countsNothing: 'Belum menghitung apa pun.',
  removeFrom: ({ name, role }) => `Hapus ${name} dari ${role}`,
  removeFromRole: ({ role }) => `Hapus dari ${role}`,
  addTo: ({ role }) => `Tambahkan aktivitas ke ${role}`,
  addPrompt: 'Tambah aktivitas…',
  office: {
    open: 'Pengaitan aktivitas',
    lead: `Aktivitas mana yang dihitung ringkasan, rencana ${kept('goal')}, dan ${kept('coaching')} di setiap tahap. Untuk `
      + 'mengganti aktivitas, tambahkan yang baru di samping yang lama: yang sudah tercatat pada aktivitas lama tetap '
      + 'dihitung.',
    save: 'Simpan pengaitan',
    saved: 'Tersimpan. Ringkasan menghitungnya mulai sekarang.',
  },
  setByOffice: `Pemilik atau Admin ${kept('KPM')} mengaturnya di halaman ${kept('Activity types')} mereka.`,
};

export const activityBindingMessages = defineMessages({ en, id });
