import { render } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeParams } from '@test/harness';
import { redirectTarget } from '@/lib/template-sections';
import OldTemplateAddress from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin/companies/c1/template',
}));

/**
 * **The old address, redirected** (ADR-0185 §2; P18.99-T20 AC-6): one template behind a select and nine tabs, now a
 * company page, a checklist per template, a page per section and the company's own settings.
 */
describe('P18.99-T20 AC-6 /admin/companies/[companyId]/template', () => {
  afterEach(() => {
    replace.mockReset();
    window.history.replaceState(null, '', '/');
  });

  it.each([
    ['', '', '/admin/companies/c1'],
    ['', '#leads-sales', '/admin/companies/c1'],
    ['?templateId=t-9', '', '/admin/companies/c1/templates/t-9'],
    ['?templateId=t-9', '#activity', '/admin/companies/c1/templates/t-9/activity'],
    ['?templateId=t-9', '#ratios', '/admin/companies/c1/templates/t-9/activity#ratios'],
    ['?templateId=t-9', '#leads-recruitment', '/admin/companies/c1/templates/t-9/leads#recruitment'],
    ['?templateId=t-9', '#training-modules', '/admin/companies/c1/templates/t-9/training#modules'],
    ['?templateId=t-9', '#capability-skills', '/admin/companies/c1/templates/t-9/capability#skills'],
    ['?templateId=t-9', '#activation', '/admin/companies/c1/templates/t-9/activation'],
    ['?templateId=t-9', '#events', '/admin/companies/c1/templates/t-9/events'],
    ['?templateId=t-9', '#nonsense', '/admin/companies/c1/templates/t-9'],
    // The company's own tabs, whichever template was shown.
    ['', '#products', '/admin/companies/c1/settings#products'],
    ['?templateId=t-9', '#recruitment', '/admin/companies/c1/settings#recruitment'],
    ['', '#campaign-moc', '/admin/companies/c1/settings#campaigns'],
    // A hash that names a key of every object, not a tab: own keys only, so the prototype chain is no section (N4).
    ['', '#constructor', '/admin/companies/c1'],
    ['', '#toString', '/admin/companies/c1'],
    ['?templateId=t-9', '#constructor', '/admin/companies/c1/templates/t-9'],
    ['?templateId=t-9', '#__proto__', '/admin/companies/c1/templates/t-9'],
  ])('%s%s → %s', (search, hash, target) => {
    expect(redirectTarget('c1', search, hash)).toBe(target);
  });

  it('replaces the address with where the content lives now, so Back does not return to it', async () => {
    window.history.replaceState(null, '', '/admin/companies/c1/template?templateId=t-9#ratios');
    render(<Suspense fallback={null}><OldTemplateAddress params={routeParams({ companyId: 'c1' })} /></Suspense>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/companies/c1/templates/t-9/activity#ratios'));
  });
});
