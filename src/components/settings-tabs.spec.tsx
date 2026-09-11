import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACTIVITY_SETTINGS_TABS, SettingsTabs } from './settings-tabs';

const pathname = vi.fn(() => '/kpm/settings/activity-types');
vi.mock('next/navigation', () => ({ usePathname: () => pathname() }));

describe('Settings sub-tabs', () => {
  it('is how Ratio benchmarks is reached, because it is not a sidebar item', () => {
    /*
     * The Owner prototype's Settings group has seven items and `Ratio benchmarks` is not
     * among them — the benchmarks live inside the Activity types screen
     * (`KPM_Owner.html:894-904`, `:1451-1490`). `shell-nav.spec.tsx` holds that as a
     * parity assertion, and it caught this being added to the sidebar.
     */
    render(<SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />);
    expect(screen.getByRole('link', { name: 'Ratio benchmarks' }))
      .toHaveAttribute('href', '/kpm/settings/ratio-benchmarks');
  });

  it('marks the current tab for a screen reader, not only with a colour', () => {
    render(<SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />);
    expect(screen.getByRole('link', { name: 'Activity types' }))
      .toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Ratio benchmarks' }))
      .not.toHaveAttribute('aria-current');
  });

  it('follows the reader to the other tab', () => {
    pathname.mockReturnValueOnce('/kpm/settings/ratio-benchmarks');
    render(<SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />);
    expect(screen.getByRole('link', { name: 'Ratio benchmarks' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('names the group, so it is not an unlabelled nav', () => {
    render(<SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />);
    expect(screen.getByRole('navigation', { name: 'Activity settings' })).toBeInTheDocument();
  });
});
