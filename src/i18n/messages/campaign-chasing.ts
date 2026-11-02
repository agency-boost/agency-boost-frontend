import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **What a person is chasing, in words** (P18.98-T4, events, campaigns and the calendar; `functional/campaigns.md`):
 * the Summary's chased rows and their empty line (`components/campaigns/chasing-card.tsx`), the coachee's and the Unit
 * Dashboard's *Campaigns they're chasing* with its empty line, and the Unit Dashboard roster's *Chasing MDRT* and its
 * cells' sentences. **Apart from `campaigns.ts`** so the Summary's and the Unit Dashboard's routes, which draw these and
 * nothing else of the campaigns' own, carry these alone (as `goal-words.ts` is apart from `goals.tsx`).
 *
 * **English is the source**, the prototype's words (`Overall.html:3225-3232`, `:6221-6253`, `:7280-7283`, `:7396`).
 * The Indonesian is the approved glossary's: *Mengejar* for *chasing* (§B.10), *MDRT* kept with the sentence around it
 * translated (§C6) — as the API's tooltip, *Mengejar MDRT … tahun ini*. **Kept** (§A): *Campaign list*, *Campaigns*,
 * *campaign*, *MDRT*. **Typed content stays as typed**: a campaign's title and emoji, a person's name, and the months it
 * runs, which the server composes (`runs`).
 */
const en = {
  /** The Summary card's tag, and its empty line (`:3228-3229`, `:6229`). */
  fromList: 'From the Campaign list',
  noneChased: "You're not chasing any campaigns yet — check the Campaign list to opt in.",
  /** A chased row's cue (`:6245`). */
  view: 'View →',
  loading: 'Loading the campaigns being chased…',
  tryAgain: 'Try again',
  /** The Unit Dashboard detail's tile (`:7280`, `:7283`), whose empty words the coachee's card reuses (L-01). */
  theyreChasing: 'Campaigns they’re chasing',
  notChasingAny: 'Not currently chasing any campaigns.',
  /** The roster's column and its cells' tooltips (`:7396`). */
  chasingMdrt: 'Chasing MDRT',
  mdrtChasing: ({ name }: { name: string }) => `${name} is chasing MDRT this year.`,
  mdrtNot: 'Not currently chasing MDRT.',
};

const id: MessagesOf<typeof en> = {
  fromList: `Dari ${kept('Campaign list')}`,
  noneChased: `Anda belum mengejar ${kept('campaign')} apa pun — buka ${kept('Campaign list')} untuk ikut.`,
  view: 'Lihat →',
  loading: `Memuat ${kept('campaign')} yang dikejar…`,
  tryAgain: 'Coba lagi',
  theyreChasing: `${kept('Campaigns')} yang dia kejar`,
  notChasingAny: `Saat ini tidak mengejar ${kept('campaign')} apa pun.`,
  chasingMdrt: `Mengejar ${kept('MDRT')}`,
  mdrtChasing: ({ name }) => `${name} mengejar ${kept('MDRT')} tahun ini.`,
  mdrtNot: `Saat ini tidak mengejar ${kept('MDRT')}.`,
};

export const campaignChasingMessages = defineMessages({ en, id });
