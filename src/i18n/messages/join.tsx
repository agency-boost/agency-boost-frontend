import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **`/join`** (P18.98-T4, public and account; `functional/org-hierarchy.md`, *Invites*, *Redemption*, *Accepting an
 * invite*): a leader's code, link or QR checked before anything is written, and a leader's invite to one person, read
 * before anybody signs in — for somebody signed out, with no office, or already in one.
 *
 * **English is the source**, word for word as the page wrote it. The Indonesian is the approved glossary's — the two
 * titles (§A.2: *Bergabung ke KPM*, *Bergabung ke tim leader Anda*), *Terima dan bergabung*, *Masuk* (§B.1), *Kode
 * agen*, *Tanggal bergabung* (§B.4), *office* is *KPM* and *reports to* *melapor ke* (§B.9), *link* *tautan* (§B.0 rule
 * 6) — with what it lacked proposed in the glossary for approval's §B.10 (*Kode undangan*, *Kembali ke halaman kerja
 * Anda* …). **Kept** (§A): *KPM*, *leader*.
 *
 * **Typed content stays as typed**: the office's label (*Prudential — KPM 0417 · BSD City Branch*, the server's), a
 * leader's name, an office's code and branch, a company's name, an agent code, the server's refusals. **A figure is
 * never a message's**: the invite's join date is written by the page in the figures' language and passed in.
 *
 * @moved app/join/
 */

/** Words drawn as a link. */
type Wrap = (words: string) => ReactNode;

const en = {
  /** A leader's code, link or QR (P3-T4). */
  code: {
    title: 'Join an office',
    subtitle: "With a leader's code, link or QR. All three are the same invite.",
    signInFirst: 'Sign in first, then open this link again.',
    signIn: 'Sign in',
    /** `link` draws its words as the link to `/register`. */
    noAccount: ({ link }: { link: Wrap }) => <>No account yet? {link('Create one')}.</>,
    alreadyIn: 'You are already in an office, so this invite is not for you.',
    alreadyInLine: 'Moving between offices is not something you do to yourself — ask whoever administers yours.',
    backToWork: 'Back to your work',
    label: 'Invite code',
    hint: 'Six characters. Upper or lower case, it does not matter.',
    checking: 'Checking…',
    check: 'Check this invite',
    inviteFor: 'This invite is for',
    /** `leader` the leader's name, drawn bold. */
    reportTo: ({ leader }: { leader: ReactNode }) => <>You would report to {leader}.</>,
    straightAway: 'Accepting joins you straight away — nobody has to approve it. You can be moved to a different leader later, but not by yourself.',
    joining: 'Joining…',
    accept: 'Accept and join',
    different: 'Use a different code',
  },
  /** A leader's invite to one person (P18.96-T3 AC-4, ADR-0170 §3, §4). */
  invite: {
    title: 'Join your leader’s team',
    subtitle: 'An invite from your leader, to you by your agent code.',
    banner: ({ leader, kpm }: { leader: string; kpm: string }) => `You're joining ${leader}'s team · ${kept('KPM')} ${kpm}`,
    /** `date` the join date, written in the figures' language. */
    details: ({ code, date }: { code: string; date: string }) => `Agent code ${code} · Join date ${date}`,
    accept: 'Accept and join',
    accepting: 'Joining…',
    signIn: 'Sign in to accept',
    signedOut: 'Sign in with the account your agent code belongs to, then accept.',
    noAccount: 'No account yet?',
    createOne: 'Create one with this invite',
    checking: 'Checking your invite…',
  },
};

const id: MessagesOf<typeof en> = {
  code: {
    title: `Bergabung ke ${kept('KPM')}`,
    subtitle: `Dengan kode, tautan, atau QR dari ${kept('leader')}. Ketiganya adalah undangan yang sama.`,
    signInFirst: 'Masuk terlebih dahulu, lalu buka tautan ini lagi.',
    signIn: 'Masuk',
    noAccount: ({ link }) => <>Belum punya akun? {link('Buat akun')}.</>,
    alreadyIn: `Anda sudah tergabung di ${kept('KPM')}, jadi undangan ini bukan untuk Anda.`,
    alreadyInLine: `Pindah antar-${kept('KPM')} tidak dapat Anda lakukan sendiri — minta kepada pengelola ${kept('KPM')} Anda.`,
    backToWork: 'Kembali ke halaman kerja Anda',
    label: 'Kode undangan',
    hint: 'Enam karakter. Huruf besar atau kecil, tidak masalah.',
    checking: 'Memeriksa…',
    check: 'Periksa undangan ini',
    inviteFor: 'Undangan ini untuk',
    reportTo: ({ leader }) => <>Anda akan melapor ke {leader}.</>,
    straightAway: 'Menerima undangan ini langsung memasukkan Anda — tidak perlu persetujuan siapa pun. Anda bisa '
      + `dipindahkan ke ${kept('leader')} lain nanti, tetapi tidak oleh diri Anda sendiri.`,
    joining: 'Sedang bergabung…',
    accept: 'Terima dan bergabung',
    different: 'Gunakan kode lain',
  },
  invite: {
    title: `Bergabung ke tim ${kept('leader')} Anda`,
    subtitle: `Undangan dari ${kept('leader')} Anda, ditujukan kepada Anda lewat kode agen Anda.`,
    banner: ({ leader, kpm }) => `Anda bergabung ke tim ${leader} · ${kept('KPM')} ${kpm}`,
    details: ({ code, date }) => `Kode agen ${code} · Tanggal bergabung ${date}`,
    accept: 'Terima dan bergabung',
    accepting: 'Sedang bergabung…',
    signIn: 'Masuk untuk menerima',
    signedOut: 'Masuk dengan akun yang terhubung dengan kode agen Anda, lalu terima undangannya.',
    noAccount: 'Belum punya akun?',
    createOne: 'Buat akun dengan undangan ini',
    checking: 'Memeriksa undangan Anda…',
  },
};

export const joinMessages = defineMessages({ en, id });
