import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **+ Add agent and an invite's share step** (P18.98-T4, new hires and activation; `functional/org-hierarchy.md`,
 * *Adding an agent*; ADR-0170 §1, §2): the one form — on `/new-hires` and the Unit Dashboard's roster header — its
 * refusals said under their fields, the share step an invite turns it into (*Share on WhatsApp*, *Copy link*, a QR), and
 * **the words sent with the link on WhatsApp** (`lib/invites.ts`' `inviteMessage`).
 *
 * **English is the source**: the client's four labels (R1, UI-001) and ours around them. The Indonesian is the approved
 * glossary's — *+ Tambah agent · Batal · Selesai · Salin tautan* (§B.1), *Menambahkan…* (§B.2), *Kode agen · Nama ·
 * Nomor WhatsApp · Tanggal bergabung* (§B.4), *tautan* (§B.0 rule 6) — with what it lacked proposed in the glossary for
 * approval's §B.10 (*Tautan undangan*, *Bagikan di WhatsApp*, *Undang {name}*). **Kept** (§A): *unit*, *AgencyBoost*.
 *
 * **The WhatsApp message is the invitee's, not the reader's**: it is written in the language of the person it is sent
 * to, who has chosen none — so Bahasa Indonesia, the language a reader with no choice reads (ADR-0179 §1), as the client
 * wrote it (P18.96-T3 AC-2) — whichever language the leader's screen is in. Its English is the catalogue's source, for a
 * recipient whose language is known.
 *
 * **Typed content stays as typed**: a name, an agent code, a number, the link. **A figure is never a message's**: a
 * date is written by the caller in the figures' language and passed in.
 *
 * @moved components/add-agent-form.tsx
 * @moved components/invite-share.tsx
 * @moved lib/invites.ts
 */
const en = {
  /** The header's button, the dialog's title, and its title on somebody else's unit (the Owner's, an Admin's). */
  open: '+ Add agent',
  title: 'Add agent',
  titleFor: ({ leader }: { leader: string }) => `Add agent to ${leader}’s unit`,
  /** The four fields (ADR-0170 §1). */
  agentCode: 'Agent code',
  agentCodeHint: 'Issued by the company, on their contract.',
  name: 'Name',
  whatsApp: 'WhatsApp number',
  whatsAppHint: 'The invite link is sent here.',
  joinDate: 'Join date',
  submit: 'Add agent',
  adding: 'Adding…',
  cancel: 'Cancel',
  done: 'Done',
  /** What the form says before the server does; `today` written in the figures' language. */
  badCode: 'Digits only, as on their contract.',
  badNumber: 'Enter a WhatsApp number, like 0812-3456-7890.',
  lateDate: ({ today }: { today: string }) => `The join date cannot be after today, ${today}.`,
  /** Why *Add agent* is held, where nothing is missing but a field says it is wrong. */
  fix: 'Fix the field marked above.',
  /** The share step's title. */
  inviteTitle: ({ name }: { name: string }) => `Invite ${name}`,

  /** An invite's three ways out (P18.96-T3 AC-2): ours, no prototype draws an invite to one person. */
  share: {
    shareOnWhatsApp: 'Share on WhatsApp',
    copyLink: 'Copy link',
    linkLabel: 'Invite link',
    /** `until` the day the link stops working, written. */
    ready: ({ name, until }: { name: string; until: string }) =>
      `The invite for ${name} is ready. The link works until ${until}, once.`,
    signIn: ({ name }: { name: string }) => `${name} already has an account, so the link asks them to sign in and accept.`,
    noNumber: 'That number is not one WhatsApp can open. Copy the link and send it another way.',
  },

  /** **The words sent with the link** (`inviteMessage`): short, their name and the link — in the recipient's language. */
  whatsAppMessage: ({ name, link }: { name: string; link: string }) =>
    `Hello ${name}, I am inviting you to join my team on ${kept('AgencyBoost')}: ${link}`,
};

const id: MessagesOf<typeof en> = {
  open: '+ Tambah agent',
  title: 'Tambah agent',
  titleFor: ({ leader }) => `Tambah agent ke ${kept('unit')} ${leader}`,
  agentCode: 'Kode agen',
  agentCodeHint: 'Diterbitkan oleh perusahaan, tertera di kontraknya.',
  name: 'Nama',
  whatsApp: 'Nomor WhatsApp',
  whatsAppHint: 'Tautan undangan dikirim ke nomor ini.',
  joinDate: 'Tanggal bergabung',
  submit: 'Tambah agent',
  adding: 'Menambahkan…',
  cancel: 'Batal',
  done: 'Selesai',
  badCode: 'Hanya angka, sesuai kontraknya.',
  badNumber: 'Masukkan nomor WhatsApp, seperti 0812-3456-7890.',
  lateDate: ({ today }) => `Tanggal bergabung tidak boleh setelah hari ini, ${today}.`,
  fix: 'Perbaiki kolom yang ditandai di atas.',
  inviteTitle: ({ name }) => `Undang ${name}`,

  share: {
    shareOnWhatsApp: 'Bagikan di WhatsApp',
    copyLink: 'Salin tautan',
    linkLabel: 'Tautan undangan',
    ready: ({ name, until }) => `Undangan untuk ${name} sudah siap. Tautannya bisa dipakai sekali, hingga ${until}.`,
    signIn: ({ name }) => `${name} sudah punya akun, jadi tautan ini memintanya masuk lalu menerima undangan.`,
    noNumber: 'Nomor itu tidak dapat dibuka di WhatsApp. Salin tautannya dan kirim dengan cara lain.',
  },

  /** The client's own sample (P18.96-T3 AC-2), unchanged. */
  whatsAppMessage: ({ name, link }) => `Halo ${name}, saya mengundang Anda bergabung di tim saya di ${kept('AgencyBoost')}: ${link}`,
};

export const addAgentMessages = defineMessages({ en, id });
