import { keptTerms } from './kept';

/**
 * **`lang="en"` on every kept-English term an Indonesian screen shows** (WCAG 3.1.2; ADR-0179 §8; P18.98-T7 AC-2).
 *
 * In ID mode `<html lang="id">`, and *Leads management*, *KPM* or *follow up* inside *3 leads perlu di-follow up* are
 * English: a screen reader reads them in English only if they say so. `watchKeptTerms(document.body)` makes them say
 * so, from the language provider, while the words' language is Indonesian; in EN mode it is never started, and
 * stopping it puts every node back as it was.
 *
 * **Why a pass over the document, and not elements where the terms are rendered.** A kept term is a plain string
 * (`kept()`), and 1,100 of them sit inside Indonesian sentences built as template strings, then go into `aria-label`s,
 * titles, comparisons and other strings. Making them elements would change every message's type and every screen that
 * renders one; the pass changes none, and it reads the same remembered list (`keptTerms`, what `kept()` was called
 * with) that the catalogue writes from.
 *
 * **Why React does not fight it.** Two moves, neither of which takes a node away from React:
 *
 * - **An element whose whole text is one kept term** (a nav item, a tab, a title, a tile's label) gets the attribute
 *   on itself — no node is added, moved or removed, and React sets no `lang` on these elements.
 * - **A term inside a text node with other words** is split *after* React's node: the node React holds keeps the words
 *   before the first term (`head`), and new nodes follow it — `<span lang="en">term</span>` and the rest. React's node
 *   never moves, so every `insertBefore`, `removeChild` and text update React makes still finds it where it left it.
 *   When React writes that node again, or moves it, or removes it, the observer drops the nodes it added — in the same
 *   task, before the browser paints — and looks again. An element whose children are a single string React rewrites
 *   with `textContent`, which takes the added nodes with it.
 *
 * **No flash, no layout change.** `lang` draws nothing. A span inside a sentence is inline and unstyled, and a sentence
 * that is the direct text of a flex or grid box is not split, since its words would become separate items; there the
 * term is left unmarked (a residual: the words are still read, in Indonesian). Text the reader's `textContent` sees is
 * unchanged, character for character.
 *
 * **What an office typed.** Its words carry no `lang`: a name, a note or a label is never marked as a passage. A
 * kept term inside it — an event type the office named *Training* — is marked, because the pass cannot know who wrote
 * the characters, and the mark is right: that word is the English term, and is read as one. Telling them apart would
 * need every screen to label its typed values, for a mark that would be the same.
 *
 * **Prerendered pages.** A public page arrives as HTML and React adopts it a part at a time; a part not yet adopted is
 * not touched (its elements carry none of React's keys yet), since changing its text would make React discard and
 * redraw it. The pass looks again, briefly, until there is nothing left waiting.
 *
 * About 1 kB compressed, in the shared chunk with the provider.
 */
export function watchKeptTerms(root: HTMLElement): () => void {
  /** A text node this pass split: React's node, the words it was left with, and the nodes added after it. */
  const splits = new WeakMap<Text, { head: string; full: string; extras: ChildNode[] }>();
  /** The nodes this pass added, each pointing at the node of React's it was split from. */
  const owner = new WeakMap<Node, Text>();
  /** The elements whose `lang` this pass wrote. */
  const marked = new WeakSet<Element>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tries = 0;

  const release = (text: Text, rewritten: boolean) => {
    const split = splits.get(text);
    if (!split) return;
    splits.delete(text);
    for (const node of split.extras) node.remove();
    // Moved or put back: its words are whole again. Rewritten by React: React's words stand.
    if (!rewritten && text.data === split.head) text.data = split.full;
  };

  /** Takes off a mark whose element no longer reads as one kept term. */
  const settle = (el: Element) => {
    if (marked.has(el) && !keptTerms().has(el.textContent?.trim() ?? '')) {
      el.removeAttribute('lang');
      marked.delete(el);
    }
  };

  /** Marks one text node's kept terms; `true` where React has not adopted it yet, to look again. */
  const mark = (text: Text): boolean => {
    const parent = text.parentElement;
    if (!parent || owner.has(text) || splits.has(text) || SKIP.has(parent.tagName) || parent.isContentEditable) return false;
    const pattern = termPattern();
    const value = text.data;
    const found = pattern ? [...value.matchAll(pattern)] : [];
    if (found.length === 0) return false;
    if (!adoptedByReact(parent)) return true;
    const declared = parent.closest('[lang]');
    if (declared && declared !== document.documentElement && !declared.getAttribute('lang')?.startsWith('id')) return false;

    const whole = value.trim();
    const single = found.length === 1 && found[0][2] === whole;
    if (single && parent !== root && parent.textContent?.trim() === whole) {
      parent.setAttribute('lang', 'en');
      marked.add(parent);
      return false;
    }
    if (NO_SPAN.has(parent.tagName) || parent.namespaceURI !== HTML || (!single && laysOutItems(parent))) return false;

    const extras: ChildNode[] = [];
    let at = -1;
    let head = '';
    for (const match of found) {
      const start = (match.index ?? 0) + match[1].length;
      if (at < 0) head = value.slice(0, start);
      else if (start > at) extras.push(document.createTextNode(value.slice(at, start)));
      const span = document.createElement('span');
      span.lang = 'en';
      span.textContent = match[2];
      extras.push(span);
      at = start + match[2].length;
    }
    if (at < value.length) extras.push(document.createTextNode(value.slice(at)));
    for (const node of extras) owner.set(node, text);
    splits.set(text, { head, full: value, extras });
    text.data = head;
    text.after(...extras);
    return false;
  };

  /** Every text node under `node`, collected before any is split. */
  const scan = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) return mark(node as Text);
    if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has((node as Element).tagName)) return false;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) texts.push(t as Text);
    let later = false;
    for (const t of texts) later = mark(t) || later;
    return later;
  };

  const observer = new MutationObserver((records) => {
    const again = new Set<Node>();
    for (const record of records) {
      if (record.type === 'characterData') {
        const text = record.target as Text;
        if (owner.has(text)) continue;
        release(text, true);
        if (text.parentElement) settle(text.parentElement);
        again.add(text);
        continue;
      }
      record.removedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) release(node as Text, false);
      });
      if (record.target.nodeType === Node.ELEMENT_NODE) settle(record.target as Element);
      record.addedNodes.forEach((node) => {
        if (!owner.has(node)) again.add(node);
      });
    }
    let later = false;
    for (const node of again) if (node.isConnected) later = scan(node) || later;
    // What this pass just did is not news.
    observer.takeRecords();
    if (later) lookAgain();
  });

  /** React adopts a prerendered page in parts: until it has, look again, ten times a second, for five seconds. */
  const lookAgain = () => {
    if (timer !== undefined || tries >= 50) return;
    timer = setTimeout(() => {
      timer = undefined;
      tries += 1;
      const later = scan(root);
      observer.takeRecords();
      if (later) lookAgain();
    }, 100);
  };

  if (scan(root)) lookAgain();
  observer.observe(root, { subtree: true, childList: true, characterData: true });

  return () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const el of root.querySelectorAll('[lang="en"]')) {
      if (marked.has(el)) {
        el.removeAttribute('lang');
        marked.delete(el);
      } else {
        const text = owner.get(el);
        if (text) release(text, false);
      }
    }
  };
}

const HTML = 'http://www.w3.org/1999/xhtml';
/** Text that is not words on the screen, or not the screen's to mark. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'TEMPLATE', 'TITLE']);
/** Where a span may not go: an option holds text only. Its element takes the mark when its text is one term. */
const NO_SPAN = new Set(['OPTION', 'OPTGROUP', 'SELECT']);

/** Whether React has adopted the element: it keeps its fiber on the node, under a key of its own. */
function adoptedByReact(el: Element): boolean {
  return Object.keys(el).some((key) => key.startsWith('__reactFiber$'));
}

/** Whether the element lays its text out as items — a flex or grid box, looked through `display: contents`. */
function laysOutItems(el: Element): boolean {
  for (let box: Element | null = el; box; box = box.parentElement) {
    const display = getComputedStyle(box).display;
    if (display !== 'contents') return display.includes('flex') || display.includes('grid');
  }
  return false;
}

let pattern: RegExp | null = null;
let patternOf = -1;

/**
 * Every kept term as one pattern, the longest first so *Leads management* wins over *leads*, a term whole between
 * anything that is not a letter or a digit (*di-follow up*, *leads-nya*), and case as written. Built again when a
 * route's chunk has named more terms.
 */
function termPattern(): RegExp | null {
  const terms = keptTerms();
  if (terms.size !== patternOf) {
    patternOf = terms.size;
    const alternatives = [...terms].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    pattern = alternatives.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}])(${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu')
      : null;
  }
  return pattern;
}
