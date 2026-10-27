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
  /** The one line the ⓘ shows. */
  readonly definition: string;
  /** How the term is found in a sentence somebody else wrote. */
  readonly pattern: RegExp;
}

export const TERMS = {
  APE: {
    name: 'APE',
    glossary: 'APE',
    definition: 'Annualised Premium Equivalent: a policy’s first-year premium, counted as a full year’s. Goals, production and clubs all count in it.',
    pattern: /\bAPE\b/,
  },
  MDRT: {
    name: 'MDRT',
    glossary: 'MDRT',
    definition: 'Million Dollar Round Table: the international club for the top-producing advisers, qualified by a year’s production.',
    pattern: /\bMDRT\b/,
  },
  AAB: {
    name: 'AAB',
    glossary: 'AAB',
    definition: 'Associate Agency Builder: a leader under an AB, with agents of their own.',
    pattern: /\bAAB\b/,
  },
  NBO: {
    name: 'NBO',
    glossary: 'NBO',
    definition: 'New Business Opportunity: the pitch that presents the agent career to somebody you want to recruit.',
    pattern: /\bNBO\b/,
  },
  NPA: {
    name: 'NPA',
    glossary: 'NPA',
    definition: 'New agent registration: the paperwork that gives a recruit their agent code.',
    pattern: /\bNPA\b/,
  },
  BOP: {
    name: 'BOP',
    glossary: 'BOP',
    definition: 'Business Opportunity Presentation: the company’s group session that presents the agent career to candidates.',
    pattern: /\bBOP\b/,
  },
  JFW: {
    name: 'JFW',
    glossary: 'JFW',
    definition: 'Joint field work: a visit to a prospect that an agent makes with their leader there too.',
    pattern: /\bJFW\b/,
  },
  TOUCHES: {
    name: 'a touch',
    glossary: 'Touch',
    definition: 'A touch is one logged activity: each one you add on Log Activity counts once.',
    pattern: /\btouch(?:es)?\b/i,
  },
  CI_PREMIUM_WAIVER: {
    name: 'a CI premium waiver',
    glossary: 'CI premium waiver',
    definition: 'If the insured is diagnosed with a critical illness, the premiums still to come are waived and the cover carries on.',
    pattern: /\bCI premium waiver\b/i,
  },
  AS_BILLED: {
    name: 'as-billed',
    glossary: 'As-billed',
    definition: 'Hospital costs paid as the bill charges them, up to the plan’s limits, rather than a fixed amount a day.',
    pattern: /\bas-billed\b/i,
  },
  POTENTIAL_MAA: {
    name: 'a Potential Monthly Active Agent',
    glossary: 'Potential Monthly Active Agent',
    definition: 'Potential Monthly Active Agent (✓): pacing, from this month’s activity, to submit at least 1 policy this month. A projection, not a sale.',
    pattern: /\bPotential (?:MAA|Monthly Active Agents?)\b/i,
  },
} as const satisfies Record<string, Term>;

export type TermKey = keyof typeof TERMS;

/** Every term, in the order the glossary spells them out here. */
export const TERM_KEYS = Object.keys(TERMS) as TermKey[];

/**
 * **The terms looked for in words somebody else wrote** — an office's activity labels, a company's product copy.
 * Not *touch*, an ordinary English word there (*a personal touch*), whose ⓘ the screen's own total carries; and not
 * *Potential Monthly Active Agent*, which is the Unit Dashboard's own figure and nobody's content.
 */
export const CONTENT_TERM_KEYS = TERM_KEYS.filter((key) => key !== 'TOUCHES' && key !== 'POTENTIAL_MAA');

/** The ⓘ's accessible name: *What is APE?* */
export const termQuestion = (key: TermKey): string => `What is ${TERMS[key].name}?`;

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
