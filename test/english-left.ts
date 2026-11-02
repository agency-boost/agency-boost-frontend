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

/** A kept term ID mode split out of a sentence (`kept-lang.ts`): a bare `<span lang="en">`, part of its parent's text. */
const isKeptMark = (n: Node) =>
  n instanceof HTMLSpanElement && n.attributes.length === 1 && n.getAttribute('lang') === 'en';

/** An element's own text: its text nodes joined, as Testing Library reads an element's text, a kept term's mark in it. */
const ownText = (el: Element) =>
  [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE || isKeptMark(n)).map((n) => n.textContent ?? '').join('').trim();

/**
 * **What a message missing at run time writes** (P18.98-T7 AC-1): a key read that is not there, written into a
 * sentence (`undefined`), or a group of messages where words were meant (`[object Object]`). `tsc` refuses both in a
 * screen that reads its area by key; this is the run-time half, for a key built from a value.
 */
const MISSING = /\bundefined\b|\[object Object\]/;

/**
 * **The English-only messages a rendered element still shows**: as an element's own text, as a name, a title, a
 * description's or a placeholder's, or — a sentence of three words or more — anywhere in its text. **And any message
 * missing** (`MISSING`), reported as `missing message: …` with the words around it.
 *
 * An element's own text is read with a kept term's `<span lang="en">` put back into it (P18.98-T7 AC-2), so a message
 * reads the same whether or not ID mode has marked its terms.
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
      if (value && MISSING.test(value)) found.add(`missing message: ${attr}="${value}"`);
    }
  }
  const text = root.textContent ?? '';
  for (const sentence of words) if (sentence.split(/\s+/).length >= 3 && text.includes(sentence)) found.add(sentence);
  const missing = MISSING.exec(text);
  if (missing) found.add(`missing message: …${text.slice(Math.max(0, missing.index - 40), missing.index + 40)}…`);
  return [...found];
}

/**
 * **Every area's English-only words** (P18.98-T7 AC-1): what no Indonesian screen may show, whichever module wrote
 * it. Every area under `src/i18n/messages/`, found by reading the directory as `catalogue.spec.ts` does; a word is left
 * out when any area writes it in Indonesian too (*Total*, *Status*), or the glossary keeps it — so a word one module
 * translates and another rightly keeps never fails the screen that keeps it.
 */
export async function everyAreasEnglish(): Promise<string[]> {
  const { readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(__dirname, '..', 'src', 'i18n', 'messages');
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes('.spec.'));
  const areas: MessageArea<MessageTree>[] = [];
  for (const file of files) {
    for (const value of Object.values((await import(join(dir, file))) as Record<string, unknown>)) {
      const area = value as Partial<MessageArea<MessageTree>> | null;
      if (typeof area === 'object' && area !== null && typeof area.en === 'object' && typeof area.id === 'object') {
        areas.push(area as MessageArea<MessageTree>);
      }
    }
  }
  const indonesian = new Set<string>();
  const collect = (tree: MessageTree) => {
    for (const value of Object.values(tree)) {
      if (typeof value === 'string') indonesian.add(value);
      else if (typeof value === 'object') collect(value as MessageTree);
    }
  };
  for (const area of areas) collect(area.id as MessageTree);
  return [...new Set(englishOnly(...areas))].filter((word) => !indonesian.has(word));
}
