import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { resetLanguage } from '@test/harness';
import { defineMessages, type MessagesOf } from './catalogue';
import { kept } from './kept';
import { watchKeptTerms } from './kept-lang';
import { LanguageProvider, useLanguageChoice, useMessages } from './language-provider';

const en = {
  title: kept('Leads management'),
  count: ({ n }: { n: number }) => `${n} leads to follow up`,
  saved: 'Saved',
  type: kept('Training'),
};
const id: MessagesOf<typeof en> = {
  title: kept('Leads management'),
  count: ({ n }) => `${n} ${kept('leads')} perlu di-${kept('follow up')}`,
  saved: 'Tersimpan',
  type: kept('Training'),
};
const sample = defineMessages({ en, id });

/** What a typed record looks like on a screen: the office's words, rendered as they came. */
const TYPED = { name: 'Rina Wijaya', note: 'Telepon Bu Rina besok pagi', event: 'Training Senin pagi' };

/** A screen as small as one can be, in every shape React renders text: a whole element, a string child, siblings. */
function Screen() {
  const t = useMessages(sample);
  const { choose } = useLanguageChoice();
  const [n, setN] = useState(3);
  const [shown, setShown] = useState(true);
  return (
    <main>
      <h1>{t.title}</h1>
      <p data-testid="sentence">{t.count({ n })}</p>
      <p data-testid="siblings">{t.title}: {shown && t.count({ n })} {t.saved}</p>
      <div data-testid="flex" style={{ display: 'flex' }}>{t.count({ n })}</div>
      <table>
        <tbody>
          <tr><td data-testid="name">{TYPED.name}</td><td data-testid="note">{TYPED.note}</td></tr>
          <tr><td data-testid="event">{TYPED.event}</td><td>{t.type}</td></tr>
        </tbody>
      </table>
      <button type="button" onClick={() => setN((v) => v + 2)}>more</button>
      <button type="button" onClick={() => setShown((v) => !v)}>toggle</button>
      <button type="button" onClick={() => choose('en')}>English</button>
      <button type="button" onClick={() => choose('id')}>Indonesia</button>
    </main>
  );
}

/** The words marked English, as a screen reader is told them. */
const english = (root: ParentNode = document.body) => [...root.querySelectorAll('[lang="en"]')].map((el) => el.textContent);

const renderLive = () => render(<LanguageProvider live><Screen /></LanguageProvider>);

afterEach(() => {
  resetLanguage();
  vi.restoreAllMocks();
});

/**
 * **P18.98-T7 AC-2: in ID mode every kept-English term carries `lang="en"`** (WCAG 3.1.2; `kept-lang.ts`). The app's
 * provider, live, with nothing chosen: Indonesian, as the product opens.
 */
describe('P18.98-T7 AC-2 kept terms say they are English', () => {
  it('marks a kept term inside an Indonesian sentence, and only the term', async () => {
    renderLive();
    const sentence = screen.getByTestId('sentence');

    await waitFor(() => expect(english(sentence)).toEqual(['leads', 'follow up']));
    expect(sentence.textContent).toBe('3 leads perlu di-follow up');
    expect(sentence).not.toHaveAttribute('lang');
  });

  it('marks an element whose whole text is a kept term on the element itself, adding nothing', async () => {
    renderLive();
    const title = screen.getByRole('heading');

    await waitFor(() => expect(title).toHaveAttribute('lang', 'en'));
    expect(title.childNodes).toHaveLength(1);
  });

  it('marks a kept term React renders beside other text, and the term in a sentence among them', async () => {
    renderLive();
    const siblings = screen.getByTestId('siblings');

    await waitFor(() => expect(english(siblings)).toEqual(['Leads management', 'leads', 'follow up']));
    expect(siblings.textContent).toBe('Leads management: 3 leads perlu di-follow up Tersimpan');
  });

  it('leaves what the office typed unmarked, and marks only the kept word inside it, never the passage', async () => {
    renderLive();
    await waitFor(() => expect(english(screen.getByTestId('sentence'))).toHaveLength(2));

    expect(screen.getByTestId('name')).not.toHaveAttribute('lang');
    expect(screen.getByTestId('name').querySelector('[lang]')).toBeNull();
    expect(screen.getByTestId('note').querySelector('[lang]')).toBeNull();
    // The event type the office named *Training*: the word is the English term, and is read as one.
    expect(screen.getByTestId('event')).not.toHaveAttribute('lang');
    expect(english(screen.getByTestId('event'))).toEqual(['Training']);
    expect(screen.getByTestId('event').textContent).toBe('Training Senin pagi');
  });

  it('does not split a sentence that is a flex box’s own text, whose words would become separate items', async () => {
    renderLive();
    await waitFor(() => expect(english(screen.getByTestId('sentence'))).toHaveLength(2));

    expect(screen.getByTestId('flex').childNodes).toHaveLength(1);
    expect(english(screen.getByTestId('flex'))).toEqual([]);
  });

  it('follows React as it writes the screen again, removes a sentence and puts it back, with nothing lost', async () => {
    const errors = vi.spyOn(console, 'error');
    const { unmount } = renderLive();
    await waitFor(() => expect(english(screen.getByTestId('sentence'))).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: 'more' }));
    await waitFor(() => expect(screen.getByTestId('sentence').textContent).toBe('5 leads perlu di-follow up'));
    expect(english(screen.getByTestId('sentence'))).toEqual(['leads', 'follow up']);
    expect(screen.getByTestId('siblings').textContent).toBe('Leads management: 5 leads perlu di-follow up Tersimpan');
    expect(english(screen.getByTestId('siblings'))).toEqual(['Leads management', 'leads', 'follow up']);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('siblings').textContent).toBe('Leads management:  Tersimpan'));
    expect(english(screen.getByTestId('siblings'))).toEqual(['Leads management']);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(english(screen.getByTestId('siblings'))).toEqual(['Leads management', 'leads', 'follow up']));
    expect(screen.getByTestId('siblings').textContent).toBe('Leads management: 5 leads perlu di-follow up Tersimpan');

    unmount();
    expect(errors).not.toHaveBeenCalled();
  });

  it('marks nothing in EN mode, and switching to English takes every mark off, the nodes as React left them', async () => {
    renderLive();
    await waitFor(() => expect(english()).not.toEqual([]));

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(screen.getByTestId('sentence').textContent).toBe('3 leads to follow up'));
    expect(english()).toEqual([]);
    expect(screen.getByTestId('sentence').childNodes).toHaveLength(1);
    expect(screen.getByRole('heading').childNodes).toHaveLength(1);

    // And back: marked again at once.
    fireEvent.click(screen.getByRole('button', { name: 'Indonesia' }));
    await waitFor(() => expect(english(screen.getByTestId('sentence'))).toEqual(['leads', 'follow up']));
  });

  it('marks nothing outside a provider, where every spec reads English', async () => {
    render(<Screen />);
    await act(async () => undefined);
    expect(english()).toEqual([]);
  });

  it('leaves alone a part of the page React has not adopted yet, and marks it once React writes it', async () => {
    renderLive();
    const prerendered = document.createElement('p');
    prerendered.textContent = 'Belum ada leads';
    document.body.append(prerendered);
    await act(async () => undefined);

    expect(prerendered.childNodes).toHaveLength(1);
    expect(english(prerendered)).toEqual([]);
    prerendered.remove();
  });

  it('takes its marks off when stopped, the text whole again', () => {
    const { container } = render(<p>3 {kept('leads')} perlu di-{kept('follow up')} lagi</p>);
    const p = container.querySelector('p')!;
    const stop = watchKeptTerms(container);
    expect(english(container)).toEqual(['leads', 'follow up']);
    stop();
    expect(english(container)).toEqual([]);
    expect(p.textContent).toBe('3 leads perlu di-follow up lagi');
  });

  it('keeps axe clean with the marks on', async () => {
    renderLive();
    await waitFor(() => expect(english(screen.getByTestId('sentence'))).toHaveLength(2));
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
