import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { homeMessages } from '@/i18n/messages/home';
import { LOG_LINK_PREVIEW_IMAGE } from '@/lib/pwa';

/**
 * **The Log Activity link's preview** (UI V1, UI-101; UI-102's *link preview* pose): the WhatsApp reminder on Home's
 * *Laporan tim* carries a link to `/activity/log`, and the chat draws its `og:title` and `og:image` under it — *Lapor
 * aktivitas hari ini · AgencyBoost* and Boost holding the phone on the brand's orange (the app icon, UI-103).
 *
 * A layout with nothing but the page under it: the page is a client screen, and a page's metadata is written where the
 * server renders. Its words are the catalogue's, in the language the pages are prerendered in (`LANGUAGE_UNCHOSEN`), as
 * the root layout's title is. The image is a path: on Vercel, Next makes it absolute with the deployment's own address.
 */
const TITLE = messagesIn(homeMessages, LANGUAGE_UNCHOSEN).linkPreview;

export const metadata: Metadata = {
  openGraph: {
    title: TITLE,
    type: 'website',
    images: [{ url: LOG_LINK_PREVIEW_IMAGE.url, width: LOG_LINK_PREVIEW_IMAGE.size, height: LOG_LINK_PREVIEW_IMAGE.size }],
  },
  twitter: { card: 'summary', title: TITLE, images: [LOG_LINK_PREVIEW_IMAGE.url] },
};

export default function ActivityLogLayout({ children }: { children: ReactNode }) {
  return children;
}
