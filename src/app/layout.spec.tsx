import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SessionProvider } from '@/components/session-provider';
import { LANGUAGE_UNCHOSEN } from '@/i18n/language';
import { LanguageProvider } from '@/i18n/language-provider';
import { PRE_PAINT_SCRIPT } from '@/i18n/pre-paint';
import RootLayout from './layout';

type Element = ReactElement<{ children?: ReactNode } & Record<string, unknown>>;

/** An element's children, as elements. */
const childrenOf = (el: Element): Element[] =>
  ([] as ReactNode[]).concat(el.props.children).filter((c): c is Element => typeof c === 'object' && c !== null);

/**
 * **P18.98-T1 AC-4: `<html lang>` is the reader's language, never a fixed one** (WCAG 3.1.1; parity F-258). It was a
 * hard-coded `id` over screens that are mostly English. The root layout is a server component, prerendered once, so
 * it is read here as the element it returns.
 */
describe('P18.98-T1 the root layout', () => {
  const html = RootLayout({ children: <main /> }) as Element;
  const [head, body] = childrenOf(html);

  it('AC-4 starts <html lang> from the language the pages are prerendered in, and leaves it to the reader’s', () => {
    expect(html.type).toBe('html');
    expect(html.props.lang).toBe(LANGUAGE_UNCHOSEN);
    // The pre-paint script and the provider write it from then on; React does not put it back.
    expect(html.props.suppressHydrationWarning).toBe(true);
  });

  it('AC-4 writes no language into its source: the attribute comes from the reader’s', () => {
    const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');
    expect(source).not.toMatch(/lang="[a-z-]+"/);
  });

  it('AC-3 reads the reader’s language before the body is parsed: the first thing in <head>', () => {
    expect(head.type).toBe('head');
    const [script] = childrenOf(head);
    expect(script.type).toBe('script');
    expect(script.props.dangerouslySetInnerHTML).toEqual({ __html: PRE_PAINT_SCRIPT });
  });

  it('AC-3 puts every word under the language, the session’s own page for an office that cannot be used included', () => {
    const [language] = childrenOf(body);
    expect(language.type).toBe(LanguageProvider);
    expect(childrenOf(language)[0].type).toBe(SessionProvider);
  });
});
