'use client';

import { Boost } from '@/components/boost';
import { useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import type { HomeQuote } from '@/lib/home';

/**
 * **The quote of the day** (UI-100, UI-102): its own navy card — Boost on the left (64px wide, 72px on a desktop), the
 * quote in white italic 15px (16px on a desktop) between large orange “ ” marks, line height 1.5, and the person's
 * name in 12px muted, not italic, with no dash.
 *
 * **The name never sits on the quote** (the owner): it floats right after the closing mark with a 12px left margin, so
 * it shares the last line when it fits and drops to its own line, at the right, when it does not.
 *
 * The quote is **content**, shown in the language it was said in whatever the reader's, so the paragraph carries its
 * own `lang`: Indonesian for the three the owner wrote in it (Ki Hajar Dewantara's is Javanese, read in the Indonesian
 * voice), English for the rest — so a screen reader reads each in its own voice. The pose is the server's, by the
 * office's day.
 */
export function HomeQuoteCard({ quote }: { quote: HomeQuote }) {
  const t = useMessages(homeMessages);
  return (
    <figure
      data-home-quote=""
      aria-label={t.quoteLabel({ person: quote.person })}
      className="m-0 flex items-center gap-2.5 rounded-lg bg-navy py-2.5 pl-2 pr-4"
    >
      <Boost pose={quote.pose} size={64} className="h-auto lg:w-[72px]" />
      <blockquote className="m-0 min-w-0 flex-1">
        <p lang={languageOf(quote.text)} className="m-0 text-[0.9375rem] italic leading-normal text-white lg:text-md">
          <Mark>{'“'}</Mark>
          {quote.text}
          <Mark>{'”'}</Mark>
          <cite className="float-right ml-3 whitespace-nowrap text-xs not-italic leading-6 text-on-navy-muted">
            {quote.person}
          </cite>
        </p>
      </blockquote>
    </figure>
  );
}

/** A large orange quotation mark, sitting on the line without opening it. */
function Mark({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="mx-0.5 align-[-0.6875rem] text-[1.875rem] font-extrabold not-italic leading-[0] text-amber">
      {children}
    </span>
  );
}

/**
 * The language a quote of the owner's list is written in: Soekarno's, Ki Hajar Dewantara's and R.A. Kartini's are
 * Indonesian (the second Javanese), the other seventeen English — known by their words.
 */
const INDONESIAN = /\b(cita-citamu|setinggi|langit|ngarsa|tuladha|terbitlah|terang|habis|gelap|gantungkan)\b/i;
export function languageOf(text: string): 'id' | 'en' {
  return INDONESIAN.test(text) ? 'id' : 'en';
}
