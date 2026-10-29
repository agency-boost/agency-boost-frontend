import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Manage KPM Admins** — `/people/admins`, the Owner's (P18.98-T4, people and forum; `functional/org-hierarchy.md`,
 * *Who decides*): who administers the office, granting it, and taking it away, as a table and as a phone's cards.
 *
 * **English is the source**: the prototype draws two static rows and two `alert()`s (`KPM_Owner.html:1987-1997`), so
 * almost all of it is ours. The Indonesian is the approved glossary's — *Beri akses · Cabut* (§B.1), *office* is *KPM*
 * (§B.9) — and *admin* in a sentence is the Indonesian word for it. **Kept** (§A): the page's title, *KPM Admin* and the
 * roles, a role counted in its English plural (*3 KPM Admins*, §B.0 rule 8). **Typed content stays as typed**: names,
 * agent codes.
 *
 * @moved app/(tenant)/people/admins/page.tsx
 */
const en = {
  subtitle: 'Who has delegated admin access to this KPM',
  /** The client's one line for the paragraph it replaces (P18.97-T4 AC-5). */
  line: 'Admins can do everything except manage admins.',
  columns: { name: 'Name', role: 'Role', since: 'Admin since', grantedBy: 'Granted by', actions: 'Actions' },
  grantTo: 'Grant admin access to',
  chooseSomebody: 'Choose somebody',
  grant: 'Grant access',
  granting: 'Granting…',
  revokeQuestion: ({ name }: { name: string }) => `Take ${name}'s admin access away?`,
  revokeLine:
    'They keep their place in the office and their unit — this only takes away what they can configure and report on. You can grant it again at any time.',
  revokeAccess: 'Revoke access',
  revoking: 'Revoking…',
  cancel: 'Cancel',
  loading: 'Loading KPM Admins…',
  caption: kept('KPM Admins'),
  empty: 'Nobody administers this office but you. Grant access above to delegate it.',
  count: ({ n }: { n: number }) => `${n} ${n === 1 ? 'KPM Admin' : 'KPM Admins'}, delegated by you`,
  revoke: 'Revoke',
  /** After *Revoke* on a phone's card, for a screen reader: whose access it takes. */
  revokeWhose: ({ name }: { name: string }) => ` ${name}'s admin access`,
  /** The Owner's own access comes from being the Owner, not a grant. */
  yours: 'Yours',
};

const id: MessagesOf<typeof en> = {
  subtitle: `Siapa yang memegang akses admin yang didelegasikan di ${kept('KPM')} ini`,
  line: `Para ${kept('Admin')} dapat melakukan semuanya, kecuali mengelola admin.`,
  columns: { name: 'Nama', role: 'Peran', since: `${kept('Admin')} sejak`, grantedBy: 'Diberikan oleh', actions: 'Aksi' },
  grantTo: 'Beri akses admin kepada',
  chooseSomebody: 'Pilih seseorang',
  grant: 'Beri akses',
  granting: 'Memberi akses…',
  revokeQuestion: ({ name }) => `Cabut akses admin ${name}?`,
  revokeLine:
    `Dia tetap di tempatnya di ${kept('KPM')} dan di ${kept('unit')}-nya — ini hanya mencabut apa yang dapat dia atur dan laporkan. Anda dapat memberikannya lagi kapan saja.`,
  revokeAccess: 'Cabut akses',
  revoking: 'Mencabut…',
  cancel: 'Batal',
  loading: `Memuat ${kept('KPM Admins')}…`,
  caption: kept('KPM Admins'),
  empty: `Tidak ada yang mengelola ${kept('KPM')} ini selain Anda. Beri akses di atas untuk mendelegasikannya.`,
  count: ({ n }) => `${n} ${n === 1 ? kept('KPM Admin') : kept('KPM Admins')}, didelegasikan oleh Anda`,
  revoke: 'Cabut',
  revokeWhose: ({ name }) => ` akses admin ${name}`,
  yours: 'Milik Anda',
};

export const adminsMessages = defineMessages({ en, id });
