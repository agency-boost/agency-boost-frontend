import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **P19.6-T5 AC-3 and AC-4 — the guides' files** (ADR-0219 §1, §4; the guide spec's *Hosting* and acceptance 3 and 4).
 *
 * - **AC-3**: the two public guides at fixed paths with no date, `public/panduan/agent-leader.html` and
 *   `kpm-owner-admin.html`, each with its PDF beside it, as delivered on 3 November (version 1; OD-271). The superproject's
 *   `scripts/sync-guides.py --check` proves them byte for byte against `revisions/`; this repository holds no copy of
 *   `revisions/`, so here they are read for what they are.
 * - **AC-4**: **the Super Admin's guide is INTERNAL** — nothing in `public/`, and nothing in the built output where there
 *   is one (`.next/static`, `.next/server`, `out/`), and nothing in `src/`, is its file: by its name, by its title's
 *   words, or by the fingerprint of the files delivered. It is the API's alone (`GET /admin/panduan`).
 */
const ROOT = resolve(__dirname, '..', '..');
const PUBLIC = join(ROOT, 'public');
const GUIDES = join(PUBLIC, 'panduan');

/** The Super Admin guide's `<title>` and `<h1>`, version 1 — the words that name it. */
const INTERNAL_TITLE = 'Panduan Super Admin (Internal)';
/** SHA-256 of the INTERNAL guide as delivered on 3 November (`panduan-super-admin-INTERNAL-2026-11-03.html`, `.pdf`). */
const INTERNAL_FINGERPRINTS = new Set([
  'b08733170c64e4be4e874d8682fbe9358bbcac18b8e968e32bd667759badff47',
  '5b4fd43d8d0d16b06f9035dd1bb0aed9512e076d4f5e8fa2d8d3ee802457a345',
]);
const INTERNAL_NAME = /internal|super-?admin/i;

/** Every file under `dir`, recursively; nothing when it is not there. */
function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const titleOf = (html: string) => /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1].trim() ?? '';

/** Where an INTERNAL guide must never be: the public folder, the build's output, and the source itself. */
const SCANNED = [PUBLIC, join(ROOT, '.next', 'static'), join(ROOT, '.next', 'server'), join(ROOT, 'out'), join(ROOT, 'src')];

describe('P19.6-T5 AC-3 the public guides at fixed paths, their PDFs beside them', () => {
  it('Panduan-AC4 P19.6-T5 AC-3 public/panduan holds the two guides and their PDFs, named without a date', () => {
    expect(readdirSync(GUIDES).sort()).toEqual([
      'agent-leader.html', 'agent-leader.pdf', 'kpm-owner-admin.html', 'kpm-owner-admin.pdf',
    ]);
    for (const name of readdirSync(GUIDES)) expect(name).not.toMatch(/\d{4}-?\d{2}-?\d{2}/);
  });

  it.each([
    ['agent-leader', 'Panduan Agent &amp; Leader'],
    ['kpm-owner-admin', 'Panduan KPM Owner &amp; Admin'],
  ])('Panduan-AC4 P19.6-T5 AC-3 %s is the owner’s guide, version 1 of 3 November, with a PDF beside it', (name, title) => {
    const html = readFileSync(join(GUIDES, `${name}.html`), 'utf8');
    expect(titleOf(html)).toBe(title);
    // OD-271: served as delivered — version 1, the date in its words and never in its address.
    expect(html).toContain('Versi 1 · 3 Nov 2026');
    expect(readFileSync(join(GUIDES, `${name}.pdf`)).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('P19.6-T5 AC-4 the Super Admin guide is in no public folder, no build output and no source file', () => {
  it('finds files to scan, so an empty public folder cannot pass', () => {
    expect(files(PUBLIC).length).toBeGreaterThan(4);
    expect(files(join(ROOT, 'src')).length).toBeGreaterThan(500);
  });

  it('Panduan-AC3 P19.6-T5 AC-4 no file in public/ is named as the INTERNAL guide', () => {
    expect(files(PUBLIC).map((p) => relative(ROOT, p)).filter((p) => INTERNAL_NAME.test(p))).toEqual([]);
  });

  it('Panduan-AC3 P19.6-T5 AC-4 no file anywhere scanned is the INTERNAL guide, by its fingerprint or by its title', () => {
    const found: string[] = [];
    for (const path of SCANNED.flatMap(files)) {
      // This spec names the title and the fingerprints to look for: it is the one file allowed to.
      if (path === __filename) continue;
      if (INTERNAL_FINGERPRINTS.has(sha256(path))) found.push(`${relative(ROOT, path)}: the delivered file`);
      else if (statSync(path).size < 20_000_000 && readFileSync(path, 'utf8').includes(INTERNAL_TITLE)) {
        found.push(`${relative(ROOT, path)}: names "${INTERNAL_TITLE}"`);
      }
    }
    expect(found).toEqual([]);
  });

  it('Panduan-AC3 P19.6-T5 AC-4 no HTML in public/ is titled as a Super Admin guide', () => {
    const titled = files(PUBLIC).filter((p) => /\.html?$/i.test(p))
      .filter((p) => /super\s*admin|internal/i.test(titleOf(readFileSync(p, 'utf8'))));
    expect(titled.map((p) => relative(ROOT, p))).toEqual([]);
  });
});
