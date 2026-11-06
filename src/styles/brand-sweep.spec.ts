import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **P19.6-T1 AC-1: every amber and navy use is sorted into the semantic tokens** (ADR-0218 §6, §7; `tokens.md`, *Brand
 * tokens*). A brand fill, tint or word reads the primary or the secondary family; text stays the fixed `text-navy`; a
 * status, role or feature use keeps its fixed token. This guard reads every source file outside the specs, comments
 * aside, and fails on:
 *
 * - a raw hex of the amber or navy families anywhere but `globals.css`;
 * - an amber or navy class, or `var(--color-amber…)` / `var(--color-navy…)`, outside the map below — `text-navy` and
 *   `text-navy-soft` (the fixed ink) and a navy scrim (`bg-navy/<a>`, a ≥ 0.25) are always allowed;
 * - navy words on a primary fill, or white words on a secondary fill, in one class list: they take the fill's
 *   contrast token, so a KPM's colour never leaves its words unreadable.
 */
const ROOT = join(__dirname, '..');

/**
 * **The exceptions: the fixed amber and navy, each with its reason.** Everything else is a semantic token. Keep this in
 * step with `tokens.md`, *The sweep*.
 */
const KEPT: Record<string, { tokens: string[]; why: string }> = {
  'components/ratio-card.tsx': {
    tokens: ['bg-navy', 'bg-amber'],
    why: 'a fixed navy surface carrying on-navy status words, and its split bar (ADR-0218 §7)',
  },
  'components/plan/phone-plan.tsx': {
    tokens: ['bg-navy', 'bg-amber'],
    why: 'the navy head carries on-navy status words; *Cek kecocokan* is a warning, status amber (§7)',
  },
  'components/training/training-module.tsx': {
    tokens: ['bg-navy', 'bg-navy-soft'],
    why: 'the lesson card carries on-navy status words (*✓ Sudah dibuka*, the open failure), and its video box (§7)',
  },
  'components/ui/role-badge.tsx': {
    tokens: ['text-amber-deep', 'bg-navy/10', 'bg-navy-soft/[0.12]'],
    why: 'role cues: the AB is amber as a role, not as the brand (§7)',
  },
  'components/campaigns/campaign-parts.tsx': {
    tokens: ['bg-amber', 'bg-amber-dark', 'bg-amber/[0.14]', 'bg-navy', 'bg-navy-soft', 'bg-navy/[0.06]', 'text-amber-ink'],
    why: 'a campaign poster’s palette, stored by token name (`campaigns.poster.color`), and the tag drawn on it',
  },
  'components/campaigns/campaign-phone.tsx': {
    tokens: ['bg-amber/[0.14]', 'text-amber-ink', 'bg-navy/[0.08]'],
    why: 'the same poster palette, as the phone draws it',
  },
  'components/calendar/calendar-parts.tsx': {
    tokens: ['border-navy-soft', 'bg-navy-soft/[0.12]', 'bg-navy-soft/[0.14]', 'border-amber-dark', 'bg-amber/[0.18]'],
    why: 'the calendar’s entry types, a categorical palette with *Client*, *Task* and Travel’s teal (feature colours, §7)',
  },
  'components/calendar/calendar-tasks.tsx': {
    tokens: ['bg-navy-soft', 'bg-amber-dark'],
    why: 'the same entry types’ swatches',
  },
  'components/kpm-template/analytics/analytics-thresholds-tab.tsx': {
    tokens: ['bg-amber'],
    why: 'a threshold’s *watch* dot: status amber (§7)',
  },
  'components/kpm-template/analytics/analytics-survey-tab.tsx': {
    tokens: ['bg-amber'],
    why: 'NPS *passive*: status amber beside the promoters’ green and the detractors’ red (§7)',
  },
  'components/ui/status-pill.tsx': {
    tokens: ['bg-amber/15'],
    why: '*Watch closely*: a verdict between success and alert, status amber (§7)',
  },
  'components/recruitment/pitch-card.tsx': {
    tokens: ['bg-amber/[0.14]', 'bg-amber-dark'],
    why: '*Uploaded · needs confirmation*: a warning, status amber (§7)',
  },
  'components/events/feedback-summary.tsx': {
    tokens: ['bg-amber/[0.14]'],
    why: 'an NPS *passive*, as the survey tab’s (§7)',
  },
  'app/(admin)/admin/page.tsx': {
    tokens: ['bg-amber/12', 'text-amber-deep'],
    why: 'the attention queue’s *template* severity, beside *structural* red and *approval* blue (§7)',
  },
  'components/ui/toast.tsx': {
    tokens: ['text-amber'],
    why: 'the action word on the toast’s fixed ink, where it reads 6.9:1; a KPM’s colour could not be read there',
  },
  'components/app-shell.tsx': {
    tokens: ['fill-amber'],
    why: 'AgencyBoost’s own mark, drawn only where no KPM logo is (ADR-0086, ADR-0218 §10)',
  },
};

const HEX = /#(?:1b2b4b|e8954a|f2994a|d97f30|b5651d|a85e1b|2e4370)\b/i;
const UTILITY = '(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|accent|fill|stroke|from|via|to|divide|decoration|caret|shadow|placeholder)';
const LEGACY = new RegExp(`(?:^|[\\s'"\`:!\\[])(-?${UTILITY}-(?:navy-soft|navy|amber-dark|amber-deep|amber-ink|amber)(?:/(?:\\[[0-9.]+\\]|[0-9]+))?)(?=$|[\\s'"\`\\]])`, 'g');
const LEGACY_VAR = /var\(--color-(?:navy|amber)[a-z-]*\)/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * The file's code and string literals with its comments blanked. A small scanner, not a parser: enough for the shapes
 * this repo writes — `//` and `/* *\/` comments, the three quotes, a template's `${…}`.
 */
export function withoutComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && (c === '`' || src[j] !== '\n')) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const alpha = (token: string): number | null => {
  const m = /\/(?:\[([0-9.]+)\]|([0-9]+))$/.exec(token);
  if (!m) return null;
  return m[1] ? Number(m[1]) : Number(m[2]) / 100;
};

/** Whether a legacy token is the fixed ink or a scrim, which every file may use. */
function alwaysAllowed(token: string): boolean {
  if (/^text-navy(?:-soft)?(?:\/.+)?$/.test(token)) return true;
  if (/^bg-navy\//.test(token)) return (alpha(token) ?? 0) >= 0.25;
  return false;
}

const sources = files(ROOT).map((path) => ({ rel: relative(ROOT, path), code: withoutComments(readFileSync(path, 'utf8')) }));

describe('P19.6-T1 AC-1 the brand tokens: every amber and navy use is sorted', () => {
  it('reads every source file', () => {
    expect(sources.length).toBeGreaterThan(300);
  });

  it('P19.6-T1 AC-1 no raw hex of the amber or navy families outside globals.css', () => {
    const found = sources.filter(({ code }) => HEX.test(code)).map(({ rel }) => rel);
    expect(found).toEqual([]);
  });

  it('P19.6-T1 AC-1 no amber or navy class outside the map: a brand use reads the primary or the secondary', () => {
    const outside: string[] = [];
    for (const { rel, code } of sources) {
      const kept = KEPT[rel]?.tokens ?? [];
      for (const m of code.matchAll(LEGACY)) {
        const token = m[1].replace(/^-/, '');
        if (alwaysAllowed(token) || kept.includes(token)) continue;
        outside.push(`${rel}: ${token}`);
      }
      for (const m of code.matchAll(LEGACY_VAR)) outside.push(`${rel}: ${m[0]}`);
    }
    expect(outside).toEqual([]);
  });

  it('P19.6-T1 AC-1 every exception is still used, so the map never lists a file that moved', () => {
    const stale: string[] = [];
    for (const [rel, { tokens }] of Object.entries(KEPT)) {
      const source = sources.find((s) => s.rel === rel);
      if (!source) {
        stale.push(`${rel}: no such file`);
        continue;
      }
      const used = new Set(Array.from(source.code.matchAll(LEGACY), (m) => m[1].replace(/^-/, '')));
      for (const token of tokens) if (!used.has(token)) stale.push(`${rel}: ${token}`);
    }
    expect(stale).toEqual([]);
  });

  it('P19.6-T1 AC-1 words on a brand fill take its contrast token, in the same class list', () => {
    const wrong: string[] = [];
    for (const { rel, code } of sources) {
      for (const m of code.matchAll(/(['"`])([^'"`\n]*)\1/g)) {
        const tokens = m[2].split(/\s+/).filter(Boolean);
        const split = (t: string) => {
          const at = t.lastIndexOf(':');
          return at < 0 ? ['', t] : [t.slice(0, at + 1), t.slice(at + 1)];
        };
        const fills = (name: RegExp) => new Set(tokens.map(split).filter(([, core]) => name.test(core)).map(([v]) => v));
        const primary = fills(/^bg-primary$/);
        const secondary = fills(/^bg-secondary(?:-hover)?$/);
        for (const t of tokens) {
          const [v, core] = split(t);
          if (primary.has(v) && core === 'text-navy') wrong.push(`${rel}: ${m[2]}`);
          if (secondary.has(v) && /^text-(?:white|card)(?:\/.+)?$/.test(core)) wrong.push(`${rel}: ${m[2]}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
