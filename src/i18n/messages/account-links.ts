import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Linked logins' own words** (P19.2-T1 AC-8; UI-169 item 5;
 * [ADR-0199](../../../../docs/04-adr/0199-a-second-login-is-linked-through-its-own-mailbox-and-password.md)): the
 * *Tambah akun* sheet, the sheet that asks the other login's password once on a browser that holds no session of it,
 * the link's page (`/link-account/[token]`) and *Profil saya*'s line with *Hapus tautan*.
 *
 * **UI-169's words where it has them** — *Tambah akun* (*Add account*), *Akun saya* — and the glossary's *Linked login*
 * (*akun tertaut*), *tautan* for a link (§B.0 rule 6), *Kirim tautan* as the email change's sheet says it (ADR-0181 §6).
 * **Kept** (§A): *KPM Owner*, *KPM Admin*, *Super Admin*, *AgencyBoost*. The rest is ours, proposed in the glossary's
 * §B.10 for approval.
 *
 * **No sentence says whether the other address is a login.** The start answers the same whatever it is (ADR-0199 §2,
 * the oracle), so *Periksa kotak masuk akun itu* says *if* it can be linked, a link is on its way.
 *
 * @moved components/linked-login-sheets.tsx
 */
const en = {
  /** The avatar menu's *Tambah akun* sheet: the other login's address and the caller's own password. */
  add: {
    title: 'Add account',
    line: `Link another login of yours — a separate ${kept('KPM Owner')}, ${kept('KPM Admin')} or ${kept('Super Admin')} `
      + 'login — so that its views appear in this menu. A link goes to its address; open it there and enter that '
      + 'login’s password.',
    email: 'Email of the other login',
    currentPassword: 'Your password',
    currentPasswordHint: 'The password of the login you are signed in with now.',
    send: 'Send link',
    sending: 'Sending…',
    sentTitle: 'Check the other mailbox',
    sent: ({ email }: { email: string }) => `If ${email} is a ${kept('KPM Owner')}, ${kept('KPM Admin')} or `
      + `${kept('Super Admin')} login that is not linked yet, a link is on its way to it. Open it there and enter that `
      + 'login’s password. The link works for 24 hours.',
    done: 'Done',
  },
  /** The sheet a switch opens where this browser holds no session of the other login (`409`, ADR-0199 §4). */
  signIn: {
    title: 'Switch account',
    line: ({ email }: { email: string }) =>
      `${email} is not signed in on this browser yet. Enter its password once to switch to it.`,
    password: 'Password',
    submit: 'Switch',
    working: 'Switching…',
  },
  /** `/link-account/[token]`: nothing is sent until the button is pressed (ADR-0190 §1, ADR-0199 §2). */
  page: {
    title: 'Link your logins',
    line: `Another of your ${kept('AgencyBoost')} logins asked to be linked to this one — the email you opened names it. `
      + 'Enter the password of this login, the one the email was sent to, to link the two.',
    password: 'Password of this login',
    submit: 'Link the logins',
    working: 'Linking…',
    linked: 'Your two logins are linked. Each now shows the other’s views in its avatar menu.',
    open: `Open ${kept('AgencyBoost')}`,
    goToSignIn: 'Go to sign in',
    failedLine: 'A link works once and for 24 hours. Ask again from Add account in the avatar menu.',
  },
  /** *Profil saya* › *Keamanan*: the linked login, its address and *Hapus tautan* (ADR-0199 §5). */
  profile: {
    linked: 'Linked login',
    remove: 'Remove link',
    removeAsk: ({ email }: { email: string }) =>
      `Remove the link to ${email}? It leaves your account menu. Its own sessions stay signed in.`,
    keep: 'Keep it',
    removed: 'Link removed',
  },
};

const id: MessagesOf<typeof en> = {
  add: {
    title: 'Tambah akun',
    line: `Tautkan akun Anda yang lain — akun ${kept('KPM Owner')}, ${kept('KPM Admin')}, atau ${kept('Super Admin')} `
      + 'yang terpisah — agar tampilannya muncul di menu ini. Tautan dikirim ke alamat akun itu; buka di sana dan '
      + 'masukkan kata sandi akun tersebut.',
    email: 'Email akun yang lain',
    currentPassword: 'Kata sandi Anda',
    currentPasswordHint: 'Kata sandi akun yang sedang Anda pakai sekarang.',
    send: 'Kirim tautan',
    sending: 'Mengirim…',
    sentTitle: 'Periksa kotak masuk akun itu',
    sent: ({ email }) => `Jika ${email} adalah akun ${kept('KPM Owner')}, ${kept('KPM Admin')}, atau `
      + `${kept('Super Admin')} yang belum tertaut, tautan sedang dikirim ke alamat itu. Buka di sana dan masukkan kata `
      + 'sandi akun tersebut. Tautan berlaku 24 jam.',
    done: 'Selesai',
  },
  signIn: {
    title: 'Beralih akun',
    line: ({ email }) => `${email} belum masuk di browser ini. Masukkan kata sandinya sekali untuk beralih ke akun itu.`,
    password: 'Kata sandi',
    submit: 'Beralih',
    working: 'Sedang beralih…',
  },
  page: {
    title: 'Tautkan akun Anda',
    line: `Akun ${kept('AgencyBoost')} Anda yang lain meminta ditautkan ke akun ini — email yang Anda buka menyebutkannya. `
      + 'Masukkan kata sandi akun ini, akun penerima email itu, untuk menautkan keduanya.',
    password: 'Kata sandi akun ini',
    submit: 'Tautkan akun',
    working: 'Menautkan…',
    linked: 'Kedua akun Anda sudah tertaut. Masing-masing kini menampilkan tampilan akun yang lain di menu avatarnya.',
    open: `Buka ${kept('AgencyBoost')}`,
    goToSignIn: 'Buka halaman masuk',
    failedLine: 'Tautan hanya bisa dipakai sekali dan berlaku 24 jam. Minta lagi lewat Tambah akun di menu avatar.',
  },
  profile: {
    linked: 'Akun tertaut',
    remove: 'Hapus tautan',
    removeAsk: ({ email }) =>
      `Hapus tautan ke ${email}? Akun itu hilang dari menu akun Anda. Sesinya sendiri tetap masuk.`,
    keep: 'Biarkan',
    removed: 'Tautan dihapus',
  },
};

export const accountLinkMessages = defineMessages({ en, id });
