import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **No grey sub-line on any `/admin` page** (P19.2-T2 AC-7; UI-136 and Appendix A's first UI-136 row: page subtitles
 * removed at every size). Read off the pages' sources, so a sub-line added back to any of them fails here whatever its
 * words: every `/admin` page draws its title through `Page`, and its `subtitle` is the grey line.
 *
 * **Three keep a line that names the record being changed** — which office's owner, which template — because without it
 * a reader can change the wrong one (UI-112: *no subtitle unless it prevents a mistake*). They are listed, with why.
 */
const ROOT = join(__dirname);

const NAMES_THE_RECORD: Record<string, string> = {
  'tenants/[kpmId]/owner/page.tsx': 'the office whose owner is being set, by its code and branch',
  'companies/[companyId]/templates/[templateId]/page.tsx': 'the template whose sections are listed',
  'companies/[companyId]/templates/[templateId]/[section]/page.tsx': 'the template whose section is being edited',
};

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === 'page.tsx' ? [relative(ROOT, path)] : [];
  });
}

describe('P19.2-T2 AC-7 no grey sub-line on any /admin page (UI-136)', () => {
  it('P19.2-T2 AC-7 finds the pages, so an empty list cannot pass', () => {
    expect(pages(ROOT).length).toBeGreaterThan(15);
  });

  it.each(pages(ROOT).filter((p) => !(p in NAMES_THE_RECORD)))('P19.2-T2 AC-7 %s passes no subtitle', (page) => {
    expect(readFileSync(join(ROOT, page), 'utf8')).not.toMatch(/\bsubtitle=\{/);
  });

  it('P19.2-T2 AC-7 a company’s page frame draws none either', () => {
    const frame = readFileSync(join(ROOT, '..', '..', '..', 'components', 'kpm-template', 'company-frame.tsx'), 'utf8');
    expect(frame).not.toMatch(/\bsubtitle=\{/);
  });
});
