import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserChose, InLanguage, languageCookie, makeMe, resetLanguage } from '@test/harness';
import { getRequestLanguage, setRequestLanguage } from '@/lib/api-client';
import { formatCalendarDay, formatRupiahCompact } from '@/lib/format';
import type { Me } from '@/lib/session';
import { defineMessages, type MessagesOf } from './catalogue';
import { kept } from './kept';
import { DEFAULT_LANGUAGE, LANGUAGE_LIVE, LANGUAGE_PENDING, LANGUAGE_UNCHOSEN, type Language } from './language';
import { LanguageProvider, useFigureLanguage, useLanguage, useLanguageChoice, useMessages } from './language-provider';

const en = {
  greeting: 'Saved ✓',
  count: ({ n }: { n: number }) => `${n} leads to follow up`,
  title: kept('Leads management'),
};
const id: MessagesOf<typeof en> = {
  greeting: 'Tersimpan ✓',
  count: ({ n }) => `${n} ${kept('leads')} perlu di-${kept('follow up')}`,
  title: kept('Leads management'),
};
const sample = defineMessages({ en, id });

/** A screen, as small as one can be: its words, and the language it says it is in. */
function Screen() {
  const t = useMessages(sample);
  return (
    <p data-language={useLanguage()}>
      {t.title}: {t.greeting} {t.count({ n: 3 })}
    </p>
  );
}

const root = document.documentElement;

/**
 * **P18.98-T1: the reader's language, and the words of a screen in it** (AC-3, AC-4, AC-5).
 */
describe('P18.98-T1 a screen’s words', () => {
  it('AC-5 reads English outside a provider: what every spec renders unless it asks', () => {
    render(<Screen />);

    expect(screen.getByText('Leads management: Saved ✓ 3 leads to follow up')).toHaveAttribute('data-language', 'en');
  });

  it('AC-5 reads Indonesian when a spec asks, each kept term still English', () => {
    render(<InLanguage language="id"><Screen /></InLanguage>);

    expect(screen.getByText('Leads management: Tersimpan ✓ 3 leads perlu di-follow up')).toHaveAttribute('data-language', 'id');
  });
});

/** *Saved ✓* in the language a reader who has chosen nothing reads: Indonesian since T4's exit, when it went live. */
const SAVED_UNCHOSEN = ({ en: 'Saved ✓', id: 'Tersimpan ✓' } as const)[LANGUAGE_UNCHOSEN];

describe('P18.98-T1 LanguageProvider', () => {
  afterEach(() => {
    root.lang = '';
    root.removeAttribute(LANGUAGE_PENDING);
  });

  it('AC-3 writes a page with no language read before it in the language the prerender used, and says so on <html>', () => {
    render(<LanguageProvider><Screen /></LanguageProvider>);

    expect(screen.getByText(new RegExp(SAVED_UNCHOSEN))).toHaveAttribute('data-language', LANGUAGE_UNCHOSEN);
    expect(root.lang).toBe(LANGUAGE_UNCHOSEN);
  });

  it('AC-3 takes up the language the pre-paint script read, before the page is shown, and shows it', () => {
    // As the inline script leaves a prerendered English page for a reader whose cookie says Indonesian.
    root.lang = 'id';
    root.setAttribute(LANGUAGE_PENDING, '');

    render(<LanguageProvider><Screen /></LanguageProvider>);

    // The sentence's text, read whole: in ID mode its kept terms are their own `<span lang="en">` (P18.98-T7 AC-2).
    expect(document.querySelector('p')).toHaveTextContent('Leads management: Tersimpan ✓ 3 leads perlu di-follow up');
    expect(root.lang).toBe('id');
    expect(root.hasAttribute(LANGUAGE_PENDING)).toBe(false);
  });

  it('AC-4 never leaves <html lang> at another language than the screen’s', () => {
    root.lang = 'fr';

    render(<LanguageProvider><Screen /></LanguageProvider>);

    // Not one of ours: the page's own language stands, and `<html lang>` says it.
    expect(screen.getByText(new RegExp(SAVED_UNCHOSEN))).toHaveAttribute('data-language', LANGUAGE_UNCHOSEN);
    expect(root.lang).toBe(LANGUAGE_UNCHOSEN);
  });

  it('AC-3 renders the same first frame on the server as the prerender wrote, whatever the cookie says', async () => {
    const { renderToString } = await import('react-dom/server');
    root.lang = 'id';

    const html = renderToString(<LanguageProvider><Screen /></LanguageProvider>);

    expect(html).toContain(SAVED_UNCHOSEN);
    expect(html).toContain(`data-language="${LANGUAGE_UNCHOSEN}"`);
  });
});

/** A screen that shows its language and holds the choice, as the switch and the session use it. */
function Chooser({ me }: { me?: Me | null }) {
  const { live, choose, follow } = useLanguageChoice();
  return (
    <div>
      <p data-testid="language">{useLanguage()}</p>
      <p data-testid="live">{String(live)}</p>
      <button type="button" onClick={() => choose('en')}>choose en</button>
      <button type="button" onClick={() => choose('id')}>choose id</button>
      <button type="button" onClick={() => follow(me ?? null)}>follow</button>
    </div>
  );
}

const account = (locale: Language, localeChosen: boolean, over: Partial<Me> = {}): Me =>
  makeMe({ ...over, user: { ...makeMe().user, locale, localeChosen, ...over.user } });

/**
 * **P18.98-T2: choosing the language, and following an account's** (ADR-0179 §2; AC-3, AC-5, AC-6).
 */
describe('P18.98-T2 LanguageProvider: choosing, and following the account', () => {
  afterEach(() => {
    resetLanguage();
  });

  const shown = () => screen.getByTestId('language').textContent;

  it('AC-3 offers nothing and follows nothing outside a provider, as it reads English there: what every spec renders', () => {
    render(<Chooser me={account('id', true)} />);

    expect(screen.getByTestId('live').textContent).toBe('false');
    fireEvent.click(screen.getByText('choose id'));
    fireEvent.click(screen.getByText('follow'));
    expect(shown()).toBe('en');
    expect(languageCookie()).toBeNull();
  });

  it('AC-3 is live as shipped since T4’s exit: the app’s provider offers the switch, and a reader with no choice reads the default', () => {
    render(<LanguageProvider><Chooser /></LanguageProvider>);

    expect(screen.getByTestId('live').textContent).toBe(String(LANGUAGE_LIVE));
    expect(shown()).toBe(LANGUAGE_UNCHOSEN);
  });

  it('AC-3 live, gives a reader who has chosen nothing and has no cookie Bahasa Indonesia, and says so on <html>', () => {
    render(<LanguageProvider live><Chooser /></LanguageProvider>);

    expect(screen.getByTestId('live').textContent).toBe('true');
    expect(shown()).toBe('id');
    expect(root.lang).toBe('id');
  });

  it('AC-3 changes the screen at once on a choice, without a remount, and keeps it for the browser and the API', () => {
    let mounts = 0;
    function Counted() {
      useEffect(() => { mounts += 1; }, []);
      return null;
    }
    render(<LanguageProvider live><Counted /><Chooser /></LanguageProvider>);

    fireEvent.click(screen.getByText('choose en'));

    expect(shown()).toBe('en');
    expect(root.lang).toBe('en');
    expect(languageCookie()).toBe('en');
    expect(getRequestLanguage()).toBe('en');
    expect(mounts).toBe(1);
  });

  it('AC-5 at sign-in, lets the account’s saved language win over the cookie, and rewrites the cookie', () => {
    document.cookie = 'ab_lang=en; Path=/';
    root.lang = 'en';
    render(<LanguageProvider live><Chooser me={account('id', true)} /></LanguageProvider>);
    expect(shown()).toBe('en');

    fireEvent.click(screen.getByText('follow'));

    expect(shown()).toBe('id');
    expect(languageCookie()).toBe('id');
    expect(getRequestLanguage()).toBe('id');
  });

  it('AC-5 at sign-in, gives an account with no saved language the cookie’s, and writes nothing', () => {
    document.cookie = 'ab_lang=en; Path=/';
    root.lang = 'en';
    const write = vi.spyOn(document, 'cookie', 'set');
    // `locale` is the language in force, Indonesian for an account that never chose: not a choice to follow.
    render(<LanguageProvider live><Chooser me={account('id', false)} /></LanguageProvider>);

    fireEvent.click(screen.getByText('follow'));

    expect(shown()).toBe('en');
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it('AC-5 at sign-in, gives an account with none and a browser with none the default, and writes nothing', () => {
    render(<LanguageProvider live><Chooser me={account('id', false)} /></LanguageProvider>);

    fireEvent.click(screen.getByText('follow'));

    expect(shown()).toBe('id');
    expect(languageCookie()).toBeNull();
  });

  it('AC-2 in a support session neither reads the person’s choice nor writes it: the browser keeps its language', () => {
    document.cookie = 'ab_lang=en; Path=/';
    root.lang = 'en';
    render(
      <LanguageProvider live>
        <Chooser me={account('id', true, { isImpersonating: true, impersonatedBy: 'sa-1' })} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByText('follow'));

    expect(shown()).toBe('en');
    expect(languageCookie()).toBe('en');
  });

  it('AC-5 follows a session once: the next read of the same account does not undo a choice made since', () => {
    render(<LanguageProvider live><Chooser me={account('id', true)} /></LanguageProvider>);
    fireEvent.click(screen.getByText('follow'));
    expect(shown()).toBe('id');

    fireEvent.click(screen.getByText('choose en'));
    // The session reads the account again — a save elsewhere on the screen reloads it — still saying `id`.
    fireEvent.click(screen.getByText('follow'));

    expect(shown()).toBe('en');
    expect(languageCookie()).toBe('en');
  });

  it('AC-5 follows the next person to sign in on the same browser', () => {
    function TwoPeople() {
      const { follow } = useLanguageChoice();
      return (
        <>
          <p data-testid="language">{useLanguage()}</p>
          <button type="button" onClick={() => follow(account('en', true))}>rina</button>
          <button type="button" onClick={() => follow(null)}>signed out</button>
          <button type="button" onClick={() => follow(account('id', true, { user: { ...makeMe().user, id: 'u-2' } }))}>budi</button>
        </>
      );
    }
    render(<LanguageProvider live><TwoPeople /></LanguageProvider>);

    fireEvent.click(screen.getByText('rina'));
    expect(shown()).toBe('en');
    fireEvent.click(screen.getByText('signed out'));
    expect(shown()).toBe('en');
    fireEvent.click(screen.getByText('budi'));
    expect(shown()).toBe('id');
    expect(languageCookie()).toBe('id');
  });

  it('AC-3 not live, still honours a saved choice: only someone who asked outside the product reads Indonesian', () => {
    render(<LanguageProvider live={false}><Chooser me={account('id', true)} /></LanguageProvider>);
    expect(shown()).toBe('en');

    fireEvent.click(screen.getByText('follow'));

    expect(shown()).toBe('id');
  });

  it('AC-6 tells the API the language the pre-paint script read, before the session’s first request', () => {
    root.lang = 'en';
    setRequestLanguage('id');

    render(<LanguageProvider live><Chooser /></LanguageProvider>);

    expect(getRequestLanguage()).toBe('en');
  });
});

/**
 * A screen that writes words and figures, as a wired screen does: a message in its words' language, and a sum and a
 * date in its figures' — with the choice's controls, as the switch and the session hold them.
 */
function Figures({ me }: { me?: Me | null }) {
  const t = useMessages(sample);
  const figures = useFigureLanguage();
  const { choose, follow } = useLanguageChoice();
  return (
    <div>
      <p data-testid="words">{useLanguage()}</p>
      <p data-testid="figures">{figures}</p>
      <p data-testid="line">{`${t.greeting} ${formatRupiahCompact(5_800_000_000_00, {}, figures)} · ${formatCalendarDay('2026-10-26', figures)}`}</p>
      <button type="button" onClick={() => choose('en')}>choose en</button>
      <button type="button" onClick={() => follow(me ?? null)}>follow</button>
    </div>
  );
}

/** English words with Indonesian figures: the product before the phase, for a reader who has chosen nothing. */
const ENGLISH_WORDS_INDONESIAN_FIGURES = 'Saved ✓ Rp 5,8 M · 26 Okt 2026';
const ENGLISH = 'Saved ✓ IDR 5.8B · 26 Oct 2026';
const INDONESIAN = 'Tersimpan ✓ Rp 5,8 M · 26 Okt 2026';

/**
 * **P18.98-T3 figures: `useFigureLanguage`** (ADR-0174, ADR-0179 §1, §6). The language a figure is written in is the
 * reader's chosen language, and with no choice `DEFAULT_LANGUAGE`, whether or not the switch is live. So until it is, a
 * reader with no choice reads English words and Indonesian figures on every screen, wired or not — the product as it was
 * before T3 — and a reader who chose a language, by the cookie or on their account, reads both in it.
 */
describe('P18.98-T3 figures useFigureLanguage', () => {
  afterEach(() => {
    resetLanguage();
  });

  const line = () => screen.getByTestId('line').textContent;
  const said = () => [screen.getByTestId('words').textContent, screen.getByTestId('figures').textContent];

  it('P18.98-T3 figures outside a provider are the words’ language, English: a spec’s English counts as a chosen English', () => {
    render(<Figures />);

    expect(line()).toBe(ENGLISH);
    expect(said()).toEqual(['en', 'en']);
  });

  it('P18.98-T3 figures under InLanguage are the language the spec asks for, words and figures alike', () => {
    render(<InLanguage language="id"><Figures /></InLanguage>);

    expect(line()).toBe(INDONESIAN);
  });

  it('P18.98-T3 figures, unchosen and not live: English words and Indonesian figures, the screen as it was before T3', () => {
    // As the prerender left the page before it went live: `<html lang>` English, and no cookie.
    root.lang = 'en';
    render(<LanguageProvider live={false}><Figures /></LanguageProvider>);

    expect(line()).toBe(ENGLISH_WORDS_INDONESIAN_FIGURES);
    expect(said()).toEqual(['en', DEFAULT_LANGUAGE]);
    expect(root.lang).toBe('en');
    expect(languageCookie()).toBeNull();
  });

  it('P18.98-T3 figures, the app’s provider as shipped: LANGUAGE_LIVE’s words, and Indonesian figures for a reader with no choice', () => {
    render(<LanguageProvider><Figures /></LanguageProvider>);

    expect(said()).toEqual([LANGUAGE_UNCHOSEN, 'id']);
  });

  it('P18.98-T3 figures, chosen English by the cookie, not live: English figures, though the script moved nothing', () => {
    // The page is prerendered in English, so the script leaves it alone: the cookie itself says it was chosen.
    browserChose('en');
    render(<LanguageProvider live={false}><Figures /></LanguageProvider>);

    expect(line()).toBe(ENGLISH);
    expect(said()).toEqual(['en', 'en']);
  });

  it('P18.98-T3 figures, chosen Indonesian by the cookie, not live: Indonesian words and figures', () => {
    browserChose('id');
    render(<LanguageProvider live={false}><Figures /></LanguageProvider>);

    expect(line()).toBe(INDONESIAN);
    expect(root.lang).toBe('id');
  });

  it('P18.98-T3 figures follow the account’s choice, not live: English, or Indonesian, words and figures alike', () => {
    const { unmount } = render(<LanguageProvider live={false}><Figures me={account('en', true)} /></LanguageProvider>);
    expect(line()).toBe(ENGLISH_WORDS_INDONESIAN_FIGURES);
    fireEvent.click(screen.getByText('follow'));
    expect(line()).toBe(ENGLISH);
    unmount();
    resetLanguage();

    render(<LanguageProvider live={false}><Figures me={account('id', true)} /></LanguageProvider>);
    fireEvent.click(screen.getByText('follow'));
    expect(line()).toBe(INDONESIAN);
  });

  it('P18.98-T3 figures, an account with no choice and a browser with none, not live: still Indonesian figures, nothing written', () => {
    render(<LanguageProvider live={false}><Figures me={account('id', false)} /></LanguageProvider>);

    fireEvent.click(screen.getByText('follow'));

    expect(line()).toBe(ENGLISH_WORDS_INDONESIAN_FIGURES);
    expect(languageCookie()).toBeNull();
  });

  it('P18.98-T3 figures, live and unchosen: Indonesian words and figures, as DEFAULT_LANGUAGE says', () => {
    render(<LanguageProvider live><Figures /></LanguageProvider>);

    expect(line()).toBe(INDONESIAN);
    expect(said()).toEqual(['id', 'id']);
  });

  it('P18.98-T3 figures, live: a choice on the switch, or one the browser made, writes both in it', () => {
    const { unmount } = render(<LanguageProvider live><Figures /></LanguageProvider>);
    fireEvent.click(screen.getByText('choose en'));
    expect(line()).toBe(ENGLISH);
    unmount();
    resetLanguage();

    browserChose('en');
    render(<LanguageProvider live><Figures /></LanguageProvider>);
    expect(line()).toBe(ENGLISH);
  });

  it('P18.98-T3 figures in a support session stay the browser’s: the person’s choice is not read', () => {
    browserChose('en');
    render(
      <LanguageProvider live={false}>
        <Figures me={account('id', true, { isImpersonating: true, impersonatedBy: 'sa-1' })} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByText('follow'));

    expect(line()).toBe(ENGLISH);
  });

  it('P18.98-T3 figures on the server: DEFAULT_LANGUAGE whatever the cookie says, so the first client frame agrees', async () => {
    const { renderToString } = await import('react-dom/server');
    browserChose('en');

    const html = renderToString(<LanguageProvider live={false}><Figures /></LanguageProvider>);

    expect(html).toContain(ENGLISH_WORDS_INDONESIAN_FIGURES);
  });

  it('P18.98-T3 figures under InLanguage inside the app’s provider are the spec’s language: a spec’s language is a choice', () => {
    render(<LanguageProvider live={false}><InLanguage language="en"><Figures /></InLanguage></LanguageProvider>);

    expect(line()).toBe(ENGLISH);
  });
});
