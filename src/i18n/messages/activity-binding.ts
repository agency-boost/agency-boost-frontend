import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The activity binding's editor** (ADR-0163; P18.98-T4): the three cascade roles, each a list of activity types —
 * the Super Admin's office *Activity binding* card and a template's *Activity types* tab
 * (`components/activity-binding-fields.tsx`).
 *
 * **Not here: the roles' names.** *Set appointment*, *Sales meeting* and *Submission polis* are the goal cascade's
 * stages, the client's own words and kept English (§A.6), so `lib/activity-binding.ts` writes them `kept('…')`. An
 * activity type's name is the office's or the template's, shown as typed (ADR-0179 §5).
 *
 * @moved components/activity-binding-fields.tsx
 * @moved lib/activity-binding.ts
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
};

const id: MessagesOf<typeof en> = {
  typeName: ({ label, archived }) => (archived ? `${label} (diarsipkan)` : label),
  roleCounts: ({ role }) => `Yang dihitung ${role}`,
  countsNothing: 'Belum menghitung apa pun.',
  removeFrom: ({ name, role }) => `Hapus ${name} dari ${role}`,
  removeFromRole: ({ role }) => `Hapus dari ${role}`,
  addTo: ({ role }) => `Tambahkan aktivitas ke ${role}`,
  addPrompt: 'Tambah aktivitas…',
};

export const activityBindingMessages = defineMessages({ en, id });
