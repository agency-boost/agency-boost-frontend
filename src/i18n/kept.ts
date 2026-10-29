import type { KeptTerm } from './glossary';

/** The mark a kept term carries in its type. Nothing at run time: a kept term is its plain string. */
declare const KEPT: unique symbol;

/**
 * **A kept-English term** (ADR-0179 §3, §8; P18.98-T1 AC-7): the same characters in both languages, and marked, so
 * that ID mode can give it `lang="en"` (P18.98-T7). A plain string to whatever renders it.
 */
export type Kept<T extends string = KeptTerm> = T & { readonly [KEPT]: T };

/** The term a kept message holds, or `never` for a message that is not a kept term. */
export type KeptTermOf<M> = M extends { readonly [KEPT]: infer T extends string } ? T : never;

/** Every term `kept()` has been asked for, so that ID mode can find the kept words in what it renders. */
const named = new Set<string>();

/**
 * **A kept-English term, from the approved list** (`KEPT_ENGLISH`, the glossary's §A): `kept('Leads management')`.
 *
 * - **Typed against the list**: a term the glossary does not keep, or keeps spelled otherwise, fails `tsc`.
 * - **The same in both languages**: it needs no language, so a module-level constant, a shell's nav or a lib function
 *   may hold one; and where a module's English message is a kept term, its Indonesian must be the same `kept()` call.
 * - **Marked**: its type carries the mark, and the term is remembered (`isKept`), for T7's `lang="en"`. Inside an
 *   Indonesian sentence, write the term through `kept()` too: `` `3 ${kept('leads')} perlu di-${kept('follow up')}` ``.
 */
export function kept<const T extends KeptTerm>(term: T): Kept<T> {
  named.add(term);
  return term as Kept<T>;
}

/** Whether `text` is a kept term the app has named through `kept()` — what ID mode marks `lang="en"` (P18.98-T7). */
export function isKept(text: unknown): text is Kept {
  return typeof text === 'string' && named.has(text);
}

/**
 * Every kept term the app has named so far — what `kept-lang.ts` looks for in an Indonesian screen. It grows as a
 * route's chunk loads and its areas call `kept()`, so a reader compares its `size` to know when to look again.
 */
export function keptTerms(): ReadonlySet<string> {
  return named;
}
