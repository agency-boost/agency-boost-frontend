import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Support sessions** (P18.98-T6; `nfr/security-and-privacy.md`, *Impersonation*; ADR-0162): *Act as another user*
 * (`/admin/impersonate/[userId]`), where a session is started and what it is for chosen, and *Approve a support
 * session to write* (`/admin/impersonation/[sessionId]`). The banner drawn during one is `support-banner.ts`'.
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's:
 * §A.2's two titles (*Bertindak sebagai pengguna lain*, *Setujui sesi dukungan untuk mengubah data*), *sesi penyiapan*
 * and *hanya untuk melihat* (§B.10, the API's), *Alasan* (§B.4), *Batal* (§B.1), a person *dia* (§B.0 rule 8), *office*
 * as *KPM* (§B.9). **Kept** (§A): *Super Admin*, *Owner*, *Admin*, *KPM*. **Typed content stays as typed**: a person's
 * name, an office's code and branch, a user's id, the reasons typed and the server's refusals.
 *
 * @moved app/(admin)/admin/impersonate/
 * @moved app/(admin)/admin/impersonation/
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
      <>
        The person you act as {strong('and')} their Owner are notified the moment it starts, and told which kind of
        session it is.
      </>
    ),
    purpose: 'What is this session for?',
    setup: 'Setup',
    setupHint: 'Change the office’s settings, import people and upload production files, as them — and nothing else. For an office’s Owner or one of its Admins.',
    support: 'Look only',
    supportHint: 'See their screens and change nothing. A second Super Admin has to approve writing.',
    reason: 'Reason',
    reasonHint: 'Recorded in the audit log. Write what a colleague would need to understand this later.',
    duration: 'Duration (minutes)',
    between: ({ max }: { max: number }) => `Between 1 and ${max}.`,
    starting: 'Starting…',
    submit: 'Start session',
    cancel: 'Cancel',
  },

  /** Approving one to write (`/admin/impersonation/[sessionId]`, §3.13). */
  elevate: {
    title: 'Approve a support session to write',
    subtitle: 'A second Super Admin — never the one running it.',
    looksOnly: 'A support session can look at everything and change nothing until somebody approves this.',
    notYourOwn: ({ strong }: { strong: Strong }) => (
      <>{strong('You cannot approve your own session.')} If you started it, find a colleague.</>
    ),
    ownerReads: 'The office\'s Owner reads your name and your reason.',
    done: 'Approved. That session can now make changes for the rest of its hour.',
    back: 'Back to the console',
    why: 'Why is looking not enough?',
    whyHint: 'The Owner of that office reads this. Name the thing that cannot be fixed from a screen.',
    atLeast: ({ min }: { min: number }) => `At least ${min} characters.`,
    approving: 'Approving…',
    submit: 'Approve this session to write',
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
      <>
        Orang yang Anda wakili {strong('dan')} {kept('Owner')}-nya diberi tahu begitu sesi dimulai, beserta jenis sesinya.
      </>
    ),
    purpose: 'Untuk apa sesi ini?',
    setup: 'Penyiapan',
    setupHint: `Ubah pengaturan ${kept('KPM')}, impor orang, dan unggah file produksi, sebagai dia — dan tidak lebih. Untuk ${kept('Owner')} ${kept('KPM')} atau salah satu ${kept('Admin')}-nya.`,
    support: 'Hanya melihat',
    supportHint: `Lihat layarnya tanpa mengubah apa pun. ${kept('Super Admin')} kedua harus menyetujui perubahan data.`,
    reason: 'Alasan',
    reasonHint: 'Dicatat di log audit. Tulis apa yang perlu diketahui rekan kerja untuk memahaminya nanti.',
    duration: 'Durasi (menit)',
    between: ({ max }) => `Antara 1 dan ${max}.`,
    starting: 'Memulai…',
    submit: 'Mulai sesi',
    cancel: 'Batal',
  },

  elevate: {
    title: 'Setujui sesi dukungan untuk mengubah data',
    subtitle: `${kept('Super Admin')} kedua — bukan yang menjalankannya.`,
    looksOnly: 'Sesi dukungan dapat melihat semuanya dan tidak dapat mengubah apa pun sampai ada yang menyetujui ini.',
    notYourOwn: ({ strong }) => (
      <>{strong('Anda tidak dapat menyetujui sesi Anda sendiri.')} Jika Anda yang memulainya, mintalah rekan kerja.</>
    ),
    ownerReads: `${kept('Owner')} ${kept('KPM')} akan membaca nama dan alasan Anda.`,
    done: 'Disetujui. Sesi itu kini dapat mengubah data hingga waktunya yang satu jam habis.',
    back: 'Kembali ke konsol',
    why: 'Mengapa melihat saja tidak cukup?',
    whyHint: `${kept('Owner')} ${kept('KPM')} itu akan membaca ini. Sebutkan hal yang tidak dapat diperbaiki dari layar.`,
    atLeast: ({ min }) => `Minimal ${min} karakter.`,
    approving: 'Menyetujui…',
    submit: 'Setujui sesi ini untuk mengubah data',
  },
};

export const supportSessionMessages = defineMessages({ en, id });
