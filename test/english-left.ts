import type { MessageArea, MessageTree } from '@/i18n/catalogue';
import { KEPT_ENGLISH } from '@/i18n/glossary';

/** Every term the glossary keeps: one may show in either language, a homonym's kept use among them (`KEPT_ELSEWHERE`). */
const KEPT: ReadonlySet<string> = new Set(Object.values(KEPT_ENGLISH).flat());

/**
 * **Whether a screen read in Indonesian still shows English of ours** (P18.98-T4 AC-2): the words an area writes in
 * English and not in Indonesian, and the ones of them a rendered screen still shows. A kept term reads the same in both
 * languages, so it is never among them; what an office typed is not a message, so it never is either.
 */

/**
 * Every message of the areas written as words whose English is not its Indonesian: what ID mode must not show. A word
 * the glossary keeps somewhere is left out — *Groups* is a tab kept English and a legend translated (`KEPT_ELSEWHERE`),
 * and the tab may show.
 */
export function englishOnly(...areas: MessageArea<MessageTree>[]): string[] {
  const out: string[] = [];
  const walk = (en: MessageTree, id: MessageTree) => {
    for (const key of Object.keys(en)) {
      const [a, b] = [en[key], id[key]];
      if (typeof a === 'string' && typeof b === 'string') {
        if (a !== b && !KEPT.has(a)) out.push(a);
      } else if (typeof a === 'object' && typeof b === 'object') {
        walk(a as MessageTree, b as MessageTree);
      }
    }
  };
  for (const area of areas) walk(area.en, area.id as MessageTree);
  return out;
}

/** An element's own text: its text nodes joined, as Testing Library reads an element's text. */
const ownText = (el: Element) =>
  [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('').trim();

/**
 * **The English-only messages a rendered element still shows**: as an element's own text, as a name, a title, a
 * description's or a placeholder's, or — a sentence of three words or more — anywhere in its text.
 */
export function englishShown(root: Element, english: readonly string[]): string[] {
  const words = new Set(english.map((e) => e.trim()));
  const found = new Set<string>();
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const own = ownText(el);
    if (words.has(own)) found.add(own);
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = el.getAttribute(attr)?.trim();
      if (value && words.has(value)) found.add(value);
    }
  }
  const text = root.textContent ?? '';
  for (const sentence of words) if (sentence.split(/\s+/).length >= 3 && text.includes(sentence)) found.add(sentence);
  return [...found];
}
