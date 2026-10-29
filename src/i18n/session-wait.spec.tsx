import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { makeSession, renderWithSession } from '@test/harness';
import { RequireSession } from '@/components/require-session';
import { RoleShell } from '@/components/role-shell';
import { SessionContext } from '@/lib/session';
import LoginPage from '@/app/(auth)/login/page';
import ChooseAPasswordPage from '@/app/choose-a-password/page';
import Home from '@/app/page';
import { LANGUAGE_PENDING } from './language';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const CSS = readFileSync(join(__dirname, '..', 'styles', 'globals.css'), 'utf8');

/** A page as the prerender writes it: on the server, the session still being read. */
function prerendered(page: React.ReactElement): string {
  return renderToString(<SessionContext.Provider value={makeSession({ me: null, loading: true })}>{page}</SessionContext.Provider>);
}

/**
 * **T1's risk, limited (P18.98-T2):** a page prerendered in one language is held back (`data-lang-pending`) for a reader
 * whose cookie says the other, until the app has written it in theirs. Once the switch is live the pages are prerendered
 * in Indonesian, and an English reader's every hard load would wait for the app to start. **Only a page that paints
 * words before then needs holding**: every signed-in route is prerendered as the session's wait, a skeleton with no
 * word in it, and its shell arrives with the session — so a page that is only that wait is shown at once.
 */
describe('P18.98-T2 holding a page back only where a word would paint', () => {
  it('AC-3 still hides a page prerendered in another language, and shows it after 3 s should the app never start', () => {
    expect(CSS).toMatch(/html\[data-lang-pending\] body \{\s*visibility: hidden;\s*animation: ab-language-reveal 0s linear 3s forwards;\s*\}/);
    expect(LANGUAGE_PENDING).toBe('data-lang-pending');
  });

  it('AC-3 shows at once a page that is only the session’s wait — and only by :has(), so an old browser holds it as before', () => {
    expect(CSS).toMatch(/html\[data-lang-pending\] body:has\(\[data-session-wait\]\) \{\s*visibility: visible;\s*animation: none;\s*\}/);
  });

  it('AC-3 marks the wait every signed-in route is prerendered as: a shell’s, a cross-family page’s, and the landing', () => {
    expect(prerendered(<RequireSession><p>Leads management</p></RequireSession>)).toContain('data-session-wait=""');
    expect(prerendered(<RoleShell title="Your account"><p>Your details</p></RoleShell>)).toContain('data-session-wait=""');
    expect(prerendered(<Home />)).toContain('data-session-wait=""');
    // And none of them prerenders a word of the page behind it.
    expect(prerendered(<RequireSession><p>Leads management</p></RequireSession>)).not.toContain('Leads management');
  });

  it('AC-3 still holds a page that paints words before the app starts: sign-in, and choosing a password', () => {
    expect(prerendered(<LoginPage />)).not.toContain('data-session-wait');
    expect(prerendered(<ChooseAPasswordPage />)).not.toContain('data-session-wait');
  });

  it('AC-3 marks the wait alone: a signed-in screen, once it is drawn, carries no mark', () => {
    const { container } = renderWithSession(<RequireSession><p>Leads management</p></RequireSession>);
    expect(container.querySelector('[data-session-wait]')).toBeNull();
  });
});
