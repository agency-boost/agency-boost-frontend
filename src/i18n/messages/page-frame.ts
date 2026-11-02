import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The page frame's own words** (P18.98-T4, the shared pieces): the refusal a screen draws for a reader it is not for
 * (`NotAvailableToYou`, `components/require-session.tsx`; `Page`'s `permission`), the page that replaces the app when
 * the reader's office cannot be used (`components/office-unavailable.tsx`, ADR-0112 §4), and the sign a route not
 * built yet shows (`components/coming-in-phase.tsx`, whose name, path and props stay: `scripts/lib/screens.py` knows a
 * placeholder by them).
 *
 * **English is the source**, byte for byte what the frame wrote. The Indonesian is the approved glossary's — *office* is
 * *KPM* (§B.9), *Keluar · Sedang keluar…* (§B.1, §B.2), *Segera hadir* for a thing not built yet (§B.3), *sesi
 * dukungan* (§A.2) — with what it lacked in the glossary for approval's §B.10. **Kept** (§A): *KPM*, *AgencyBoost*.
 * The server's sentence for a suspended or an archived office arrives in the reader's language (P18.98-T5), and an
 * office's code and branch are shown as typed. **A figure is never a message's**: the day a subscription ended is
 * written by the caller in the figures' language.
 *
 * @moved components/page.tsx
 * @moved components/require-session.tsx
 * @moved components/office-unavailable.tsx
 * @moved components/coming-in-phase.tsx
 */
const en = {
  /** `NotAvailableToYou`: names no permission code (P11-T6) and none of ADR-0084's six words. */
  notAvailable: {
    title: 'Not available to you',
    body: 'Your account does not have access to this screen. If you believe it should, ask whoever manages accounts where you work.',
  },
  /** `OfficeUnavailable`: `support` is a support session's view of somebody else's office. */
  office: {
    title: ({ kind, support }: { kind: 'ended' | 'suspended' | 'archived'; support: boolean }) => {
      const whose = support ? 'This office' : 'Your office';
      if (kind === 'ended') return `${whose}’s subscription has ended`;
      return kind === 'suspended' ? `${whose} is suspended` : `${whose} is archived`;
    },
    /** `date` written by the caller. */
    endedOn: ({ date }: { date: string }) =>
      `Its subscription ended on ${date}. Nobody in the office can use AgencyBoost until it is renewed. Contact AgencyBoost to renew it.`,
    ended: 'Its subscription has ended. Nobody in the office can use AgencyBoost until it is renewed. Contact AgencyBoost to renew it.',
    nothingDeleted: 'Nothing in the office has been deleted. Everything is here again the moment it can be used.',
    endSupport: 'End support session',
    ending: 'Ending…',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
  },
  /** `ComingInPhase` and `ComingInPhaseSection`. */
  upcoming: {
    pill: 'Upcoming',
    nothingShown: 'Nothing is shown here yet — not an empty version of it, and not a sample.',
    whatYouCanDo: 'What you can do now',
  },
};

const id: MessagesOf<typeof en> = {
  notAvailable: {
    title: 'Tidak tersedia untuk Anda',
    body: 'Akun Anda tidak memiliki akses ke layar ini. Jika menurut Anda seharusnya bisa, tanyakan kepada orang yang mengelola akun di tempat kerja Anda.',
  },
  office: {
    title: ({ kind, support }) => {
      const whose = support ? `${kept('KPM')} ini` : `${kept('KPM')} Anda`;
      if (kind === 'ended') return `Langganan ${whose} telah berakhir`;
      return kind === 'suspended' ? `${whose} ditangguhkan` : `${whose} diarsipkan`;
    },
    endedOn: ({ date }) =>
      `Langganannya berakhir pada ${date}. Tidak seorang pun di ${kept('KPM')} ini dapat menggunakan ${kept('AgencyBoost')} sampai langganannya diperpanjang. Hubungi ${kept('AgencyBoost')} untuk memperpanjangnya.`,
    ended: `Langganannya telah berakhir. Tidak seorang pun di ${kept('KPM')} ini dapat menggunakan ${kept('AgencyBoost')} sampai langganannya diperpanjang. Hubungi ${kept('AgencyBoost')} untuk memperpanjangnya.`,
    nothingDeleted: `Tidak ada data ${kept('KPM')} yang dihapus. Semuanya tersedia lagi begitu ${kept('KPM')} ini dapat digunakan.`,
    endSupport: 'Akhiri sesi dukungan',
    ending: 'Mengakhiri…',
    signOut: 'Keluar',
    signingOut: 'Sedang keluar…',
  },
  upcoming: {
    pill: 'Segera hadir',
    nothingShown: 'Belum ada yang ditampilkan di sini — bukan versi kosongnya, dan bukan contoh.',
    whatYouCanDo: 'Yang dapat Anda lakukan sekarang',
  },
};

export const pageFrameMessages = defineMessages({ en, id });
