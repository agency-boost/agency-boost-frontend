import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Support sessions** (P18.10-T6; `nfr/security-and-privacy.md`, *Impersonation*; ADR-0206): *Act as another user*
 * (`/admin/impersonate/[userId]`), where a session is started. It only looks (P19.4-T2): the choice of *Setup* or
 * *Look only* (ADR-0162) and *Approve a support session to write* (`/admin/impersonation/[sessionId]`, now a redirect)
 * are retired with their words. The banner drawn during one is `support-banner.ts`'.
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's:
 * §A.2's title (*Bertindak sebagai pengguna lain*), *Hanya melihat* (UI-151; the glossary's *View-only session*),
 * *Alasan* (§B.4), *Batal* (§B.1), a person *dia* (§B.0 rule 8), *office* as *KPM* (§B.9). **Kept** (§A): *Super
 * Admin*, *Owner*, *Admin*, *KPM*. **Typed content stays as typed**: a person's name, an office's code and branch, a
 * user's id, the reasons typed and the server's refusals.
 *
 * @moved app/(admin)/admin/impersonate/
 */

/** A run of words drawn bold. */
type Strong = (words: string) => ReactNode;

const en = {
  /** Starting one (`/admin/impersonate/[userId]`). */
  start: {
    title: 'Act as another user',
    subtitle: 'Support access, permanently recorded.',
    /** `who` the person, named or by their id, drawn by the page. */
    recorded: ({ strong, who }: { strong: Strong; who: ReactNode }) => (
      <>Every action you take is recorded against {strong('both')} you and {who}.</>
    ),
    /** `name` drawn bold; `office` as the console names it. */
    ownerOf: ({ name, office }: { name: ReactNode; office: string }) => <>{name}, the Owner of {office}</>,
    office: ({ code, branch }: { code: string; branch: string }) => `KPM ${code} · ${branch}`,
    timeBoxed: ({ max }: { max: number }) => `The session is time-boxed and cannot exceed ${max} minutes.`,
    endsOnReload: 'It ends the moment you reload the page — impersonation is never restored from a cookie.',
    noSuperAdmin: 'Another Super Admin cannot be impersonated.',
    notified: ({ strong }: { strong: Strong }) => (
      <>The person you act as {strong('and')} their Owner are notified the moment it starts.</>
    ),
    /** The kind of session, said rather than chosen (P19.4-T2 AC-1; UI-151): there is one. */
    kind: 'Session:',
    viewOnly: 'View only',
    viewOnlyHint: 'See their screens and change nothing. Every change is refused while you view as them.',
    reason: 'Reason',
    reasonHint: 'Recorded in the audit log. Write what a colleague would need to understand this later.',
    duration: 'Duration (minutes)',
    between: ({ max }: { max: number }) => `Between 1 and ${max}.`,
    starting: 'Starting…',
    submit: 'Start session',
    cancel: 'Cancel',
  },

};

const id: MessagesOf<typeof en> = {
  start: {
    title: 'Bertindak sebagai pengguna lain',
    subtitle: 'Akses dukungan, dicatat permanen.',
    recorded: ({ strong, who }) => (
      <>Setiap tindakan Anda dicatat atas nama {strong('kedua')} pihak: Anda dan {who}.</>
    ),
    ownerOf: ({ name, office }) => <>{name}, {kept('Owner')} {office}</>,
    office: ({ code, branch }) => `${kept('KPM')} ${code} · ${branch}`,
    timeBoxed: ({ max }) => `Sesi ini dibatasi waktu dan tidak dapat melebihi ${max} menit.`,
    endsOnReload: 'Sesi berakhir begitu Anda memuat ulang halaman — sesi dukungan tidak pernah dipulihkan dari cookie.',
    noSuperAdmin: `Anda tidak dapat bertindak sebagai ${kept('Super Admin')} lain.`,
    notified: ({ strong }) => (
      <>Orang yang Anda wakili {strong('dan')} {kept('Owner')}-nya diberi tahu begitu sesi dimulai.</>
    ),
    kind: 'Sesi:',
    viewOnly: 'Hanya melihat',
    viewOnlyHint: 'Lihat layarnya tanpa mengubah apa pun. Setiap perubahan ditolak selama Anda melihat sebagai dia.',
    reason: 'Alasan',
    reasonHint: 'Dicatat di log audit. Tulis apa yang perlu diketahui rekan kerja untuk memahaminya nanti.',
    duration: 'Durasi (menit)',
    between: ({ max }) => `Antara 1 dan ${max}.`,
    starting: 'Memulai…',
    submit: 'Mulai sesi',
    cancel: 'Batal',
  },
};

export const supportSessionMessages = defineMessages({ en, id });
