import { globSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup } from '@testing-library/react';
import { createElement, type ComponentType } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithSession, routeParams } from '@test/harness';
import { SUPER_ADMIN } from '@test/kpm-template-fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}));

/** Every page of the Super Admin's console, found by reading the tree: a page added later is swept too. */
const PAGES = globSync('**/page.tsx', { cwd: __dirname }).sort();
type PageModule = { default: ComponentType<{ params?: Promise<Record<string, string>> }> };
const PARAMS = { companyId: 'c1', templateId: 't1', section: 'training', kpmId: 'k1', userId: 'u1', sessionId: 's1' };

/**
 * **No admin page writes to the clipboard on its own** (P19.4-T5 AC-10; the 11-03 handover's B1-10, *"the admin page
 * once wrote to the clipboard on its own"*). Every write the console makes — *Copy link*, *Copy code* — is inside a
 * click handler (`copyable-value.tsx`, `invite-share-block.tsx`), and none is in an effect or a render; so every page is
 * drawn here, the API refusing whatever it is asked, and `navigator.clipboard.writeText` is spied across the
 * first render and what follows it. What the production report saw was not the app's: a browser session driven by a
 * tool, as Part C's parallel sessions were.
 */
describe('P19.4-T5 AC-10 the admin pages’ first render writes nothing to the clipboard', () => {
  const writeText = vi.fn(async () => undefined);
  let saved: PropertyDescriptor | undefined;

  beforeAll(() => {
    saved = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });
  afterAll(() => {
    if (saved) Object.defineProperty(navigator, 'clipboard', saved);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('finds the pages, so a silent zero cannot pass', () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(PAGES)('P19.4-T5 AC-10 %s', async (path) => {
    // Whatever is asked, a refusal: every page draws its loading or error state from it, whatever shape it reads.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 503, blob: async () => new Blob([]),
      json: async () => ({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Not now.', requestId: 'r-1' } }),
    }) as unknown as Response));
    const Page = ((await import(join(__dirname, path))) as PageModule).default;
    try {
      renderWithSession(createElement(Page, { params: routeParams(PARAMS) }), { me: SUPER_ADMIN });
    } catch {
      // A page that cannot draw from an empty answer still had its first render; what matters is the clipboard.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(writeText).not.toHaveBeenCalled();
  });
});
