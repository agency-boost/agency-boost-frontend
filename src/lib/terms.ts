import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { termMessages } from '@/i18n/messages/terms';

/**
 * **The words a reader may not know, each with one plain line** (P18.95-T9 AC-3; ADR-0167 §10, OD-205; the
 * client's UI review of 2026-10-26, UI-028: *APE, MDRT, AAB, NBO, NPA, BOP, JFW, "touches", "CI premium
 * waiver", "as-billed"* shown with nothing to say what they mean).
 *
 * **One source.** Every ⓘ beside one of these terms reads its words from here (`TermTip`, `TermText`), so a
 * definition is written once and a screen cannot word it its own way. Each line is the glossary's definition
 * (`docs/00-product/glossary.md`, the row named in `glossary`) shortened to one sentence a member can act on;
 * `terms.spec.ts` fails when a row it names is not in the glossary.
 *
 * **The ⓘ goes beside a term the first time it appears on a screen, and only there** — never beside a term the
 * screen already explains in place (*Joint Field Work with leader* needs none). For words the office or the
 * company wrote — an activity's label, a product's benefits — `firstMentions` finds the first one in reading
 * order, so a list says it once however many rows repeat it.
 */
export interface Term {
  /** What the ⓘ is called, after *What is*: *What is APE?*, *What is a touch?* */
  readonly name: string;
  /** The glossary row the line is written from: its *Term* column, verbatim. */
  readonly glossary: string;
  /** The one line the ⓘ shows, in English: the catalogue's source (`termMessages`, P18.98-T4); `termDefinition` writes it in a language. */
  readonly definition: string;
  /** How the term is found in a sentence somebody else wrote. */
  readonly pattern: RegExp;
}

export const TERMS = {
  APE: {
    name: 'APE',
    glossary: 'APE',
    definition: termMessages.en.APE.definition,
    pattern: /\bAPE\b/,
  },
  MDRT: {
    name: 'MDRT',
    glossary: 'MDRT',
    definition: termMessages.en.MDRT.definition,
    pattern: /\bMDRT\b/,
  },
  AAB: {
    name: 'AAB',
    glossary: 'AAB',
    definition: termMessages.en.AAB.definition,
    pattern: /\bAAB\b/,
  },
  NBO: {
    name: 'NBO',
    glossary: 'NBO',
    definition: termMessages.en.NBO.definition,
    pattern: /\bNBO\b/,
  },
  NPA: {
    name: 'NPA',
    glossary: 'NPA',
    definition: termMessages.en.NPA.definition,
    pattern: /\bNPA\b/,
  },
  BOP: {
    name: 'BOP',
    glossary: 'BOP',
    definition: termMessages.en.BOP.definition,
    pattern: /\bBOP\b/,
  },
  JFW: {
    name: 'JFW',
    glossary: 'JFW',
    definition: termMessages.en.JFW.definition,
    pattern: /\bJFW\b/,
  },
  TOUCHES: {
    name: 'a touch',
    glossary: 'Touch',
    definition: termMessages.en.TOUCHES.definition,
    pattern: /\btouch(?:es)?\b/i,
  },
  CI_PREMIUM_WAIVER: {
    name: 'a CI premium waiver',
    glossary: 'CI premium waiver',
    definition: termMessages.en.CI_PREMIUM_WAIVER.definition,
    pattern: /\bCI premium waiver\b/i,
  },
  AS_BILLED: {
    name: 'as-billed',
    glossary: 'As-billed',
    definition: termMessages.en.AS_BILLED.definition,
    pattern: /\bas-billed\b/i,
  },
  POTENTIAL_MAA: {
    name: 'a Potential Monthly Active Agent',
    glossary: 'Potential Monthly Active Agent',
    definition: termMessages.en.POTENTIAL_MAA.definition,
    pattern: /\bPotential (?:MAA|Monthly Active Agents?)\b/i,
  },
  /*
   * P18.97-T3 AC-8 (ADR-0176 §3; the client's KPM Owner findings, UI-021: *"MOC", "ELITE CLUB", "STAR CLUB" … unexplained*):
   * the analytics' MOC and its three production clubs. The company's own names stay (Phase 18.98's glossary lists them);
   * no threshold is written here — each company sets its own, and the MOC ⓘ shows the company's rules beneath this line.
   */
  MOC: {
    name: 'MOC',
    glossary: 'MOC',
    definition: termMessages.en.MOC.definition,
    pattern: /\bMOC\b/,
  },
  STAR_CLUB: {
    name: 'Star Club',
    glossary: 'Star Club',
    definition: termMessages.en.STAR_CLUB.definition,
    pattern: /\bStar Club\b/i,
  },
  ELITE_CLUB: {
    name: 'Elite Club',
    glossary: 'Elite Club',
    definition: termMessages.en.ELITE_CLUB.definition,
    pattern: /\bElite Club\b/i,
  },
  CHAIRMANS_CLUB: {
    name: 'Chairman’s Club',
    glossary: "Chairman's Club",
    definition: termMessages.en.CHAIRMANS_CLUB.definition,
    pattern: /\bChairman[’']s Club\b/i,
  },
} as const satisfies Record<string, Term>;

export type TermKey = keyof typeof TERMS;

/** Every term, in the order the glossary spells them out here. */
export const TERM_KEYS = Object.keys(TERMS) as TermKey[];

/** The analytics' own words (P18.97-T3 AC-8): drawn by that screen where they first show, and nobody's content. */
const ANALYTICS_TERM_KEYS: readonly TermKey[] = ['MOC', 'STAR_CLUB', 'ELITE_CLUB', 'CHAIRMANS_CLUB'];

/**
 * **The terms looked for in words somebody else wrote** — an office's activity labels, a company's product copy.
 * Not *touch*, an ordinary English word there (*a personal touch*), whose ⓘ the screen's own total carries; not
 * *Potential Monthly Active Agent*, which is the Unit Dashboard's own figure and nobody's content; and not MOC and the
 * clubs, which `/kpm/analytics` explains where its table first draws them — a campaign named after a club (*Year-End
 * Star Club Drive*) is the campaign's, not the tier's (glossary, *Star Club*).
 */
export const CONTENT_TERM_KEYS = TERM_KEYS.filter(
  (key) => key !== 'TOUCHES' && key !== 'POTENTIAL_MAA' && !ANALYTICS_TERM_KEYS.includes(key),
);

/** The ⓘ's accessible name, *What is APE?* — *Apa itu APE?* — in the reader's `language` (P18.98-T4). */
export const termQuestion = (key: TermKey, language: Language = SOURCE_LANGUAGE): string =>
  messagesIn(termMessages, language)[key].question;

/** The ⓘ's one line, in the reader's `language` (P18.98-T4): the glossary's definition, its kept terms kept. */
export const termDefinition = (key: TermKey, language: Language = SOURCE_LANGUAGE): string =>
  messagesIn(termMessages, language)[key].definition;

/** Where `key` first appears in `text`, as `[start, end)`; `null` when it does not. */
export function termAt(text: string, key: TermKey): [number, number] | null {
  const match = TERMS[key].pattern.exec(text);
  return match ? [match.index, match.index + match[0].length] : null;
}

/**
 * **Which terms each text is the first to mention**, in reading order: `texts[i]` → the terms whose first
 * appearance on the screen is in it. A term an earlier text mentioned, or one listed in `shown` (an ⓘ the
 * screen draws elsewhere, above these), is in none of them.
 */
export function firstMentions(
  texts: readonly (string | null | undefined)[],
  keys: readonly TermKey[] = TERM_KEYS,
  shown: readonly TermKey[] = [],
): TermKey[][] {
  const seen = new Set<TermKey>(shown);
  return texts.map((text) => {
    const here: TermKey[] = [];
    if (!text) return here;
    for (const key of keys) {
      if (seen.has(key) || termAt(text, key) === null) continue;
      seen.add(key);
      here.push(key);
    }
    return here;
  });
}

/** An activity as a screen lists it: its code, the office's label, and the note under it. */
interface ActivityWords {
  readonly code: string;
  readonly label: string;
  readonly description?: string | null;
  readonly status?: string;
}

/**
 * **Which of an office's activities first names each term**, every section's active types in order, each label
 * before its note: `section code → "{type code}:label" | "{type code}:description" → terms`. For Log Activity and
 * the Activity Dashboard, which draw the list whole. `CONTENT_TERM_KEYS`: the screen's total carries *touch*'s ⓘ.
 */
export function activityTermMentions(
  sections: readonly { readonly code: string; readonly types: readonly ActivityWords[] }[],
): Map<string, Map<string, TermKey[]>> {
  const slots: { section: string; slot: string; text: string | null | undefined }[] = [];
  for (const section of sections) {
    for (const type of section.types) {
      if (type.status !== undefined && type.status !== 'active') continue;
      slots.push({ section: section.code, slot: `${type.code}:label`, text: type.label });
      slots.push({ section: section.code, slot: `${type.code}:description`, text: type.description });
    }
  }
  const found = firstMentions(slots.map((s) => s.text), CONTENT_TERM_KEYS);
  const out = new Map<string, Map<string, TermKey[]>>();
  slots.forEach(({ section, slot }, i) => {
    if (found[i].length === 0) return;
    if (!out.has(section)) out.set(section, new Map());
    out.get(section)!.set(slot, found[i]);
  });
  return out;
}
