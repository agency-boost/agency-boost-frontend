import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The KPM Owner, invited by WhatsApp** (P19.23-T2 AC-3; ADR-0277; OD-420): the Super Admin's *Kirim undangan* button
 * (`components/admin/owner-whatsapp-invite.tsx`), the message their own WhatsApp opens with (`lib/owner-invite.ts`), and
 * the claim page the Owner opens (`app/owner-invite/[token]/page.tsx`).
 *
 * **English is the source.** The Indonesian is the Super Admin spec's (§5 *"owner invited by WhatsApp"*, the mockup's
 * *Kirim undangan*, *Buat KPM & undang owner*, and the brief's *Terima & jadi owner*). *KPM*, *Owner* and *WhatsApp*
 * read alike (§A.5, §B.10); an office is a *KPM* (§B.9). **The message is the invitee's**, written in the language a
 * person who has chosen none reads (`INVITEE_LANGUAGE`), whichever language the Super Admin's screen is in.
 */
const en = {
  /** The button, beside the Owner wherever the console names one who has not signed in. */
  button: 'Send invitation',
  /** Its accessible name: which Owner, by which channel. */
  buttonFor: ({ name }: { name: string }) => `Send ${name} the invitation on WhatsApp`,
  sending: 'Opening WhatsApp…',
  /** The toast once the Super Admin's WhatsApp is open with the message. */
  sent: ({ name }: { name: string }) => `WhatsApp is open for ${name}. Send the message there.`,
  /** The browser refused the new window, so nothing could be opened. */
  blocked: 'The browser blocked the new window. Allow pop-ups for AgencyBoost, then try again.',
  /** The number on file is not one WhatsApp can open. */
  noNumber: ({ name }: { name: string }) => `${name}'s WhatsApp number cannot be opened. Correct it on their profile ("View profile"), then try again.`,
  /** The message itself, to the Owner: a claim link, or the link to choose a password. */
  message: {
    claim: ({ name, kpm, company, link }: { name: string; kpm: string; company: string; link: string }) =>
      `Hello ${name}, your KPM ${kpm} · ${company} is ready on AgencyBoost. Open this link to sign in as its owner: ${link}`,
    password: ({ name, kpm, company, link }: { name: string; kpm: string; company: string; link: string }) =>
      `Hello ${name}, your KPM ${kpm} · ${company} is ready on AgencyBoost. Open this link to choose your password and sign in as its owner: ${link}`,
  },
  /** The claim page. */
  page: {
    title: 'Owner invitation',
    checking: 'Checking this invitation…',
    /** The banner's first line: the KPM and its company. */
    kpm: ({ kpm, company }: { kpm: string; company: string }) => `KPM ${kpm} · ${company}`,
    forName: ({ name }: { name: string }) => `For ${name}`,
    explain: 'Accepting makes your account the owner of this KPM: every page of the KPM, with full rights.',
    expires: ({ date }: { date: string }) => `This link works until ${date}.`,
    signedOut: 'Sign in first — you will come back to this invitation.',
    signIn: 'Sign in',
    noAccount: 'No account yet?',
    register: 'Sign up',
    afterRegister: 'Once you have signed up and verified your email, open this link again.',
    signedInAs: ({ name }: { name: string }) => `Signed in as ${name}.`,
    accept: 'Accept & become owner',
    accepting: 'Accepting…',
  },
};

const id: MessagesOf<typeof en> = {
  button: 'Kirim undangan',
  buttonFor: ({ name }) => `Kirim undangan ke ${name} lewat WhatsApp`,
  sending: 'Membuka WhatsApp…',
  sent: ({ name }) => `WhatsApp terbuka untuk ${name}. Kirim pesannya di sana.`,
  blocked: 'Browser memblokir jendela baru. Izinkan pop-up untuk AgencyBoost, lalu coba lagi.',
  noNumber: ({ name }) => `Nomor WhatsApp ${name} tidak bisa dibuka. Perbaiki di profilnya ("Lihat profil"), lalu coba lagi.`,
  message: {
    claim: ({ name, kpm, company, link }) =>
      `Halo ${name}, KPM ${kpm} · ${company} Anda sudah siap di AgencyBoost. Buka tautan ini untuk masuk sebagai owner: ${link}`,
    password: ({ name, kpm, company, link }) =>
      `Halo ${name}, KPM ${kpm} · ${company} Anda sudah siap di AgencyBoost. Buka tautan ini untuk membuat kata sandi dan masuk sebagai owner: ${link}`,
  },
  page: {
    title: `Undangan owner`,
    checking: 'Memeriksa undangan ini…',
    kpm: ({ kpm, company }) => `KPM ${kpm} · ${company}`,
    forName: ({ name }) => `Untuk ${name}`,
    explain: `Dengan menerima, akun Anda menjadi owner KPM ini: semua halaman KPM, dengan hak penuh.`,
    expires: ({ date }) => `Tautan ini berlaku sampai ${date}.`,
    signedOut: 'Masuk terlebih dahulu — Anda akan kembali ke undangan ini.',
    signIn: 'Masuk',
    noAccount: 'Belum punya akun?',
    register: 'Daftar',
    afterRegister: 'Setelah mendaftar dan memverifikasi email, buka tautan ini lagi.',
    signedInAs: ({ name }) => `Masuk sebagai ${name}.`,
    accept: `Terima & jadi owner`,
    accepting: 'Menerima…',
  },
};

export const ownerInviteMessages = defineMessages({ en, id });
