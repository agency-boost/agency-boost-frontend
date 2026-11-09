import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import type { PitchMaterialsView, PitchSlot } from '@/lib/recruitment-pitch';
import { PhonePitch } from './pitch-phone';

const SIGNED = 'https://storage.googleapis.com/test-bucket/dev/kpm-1/recruitment-pitch/01PAGE?X-Goog-Signature=abc';
const slot = (over: Partial<PitchSlot>): PitchSlot => ({
  slot: 'opportunity', title: 'Opportunity Overview', line: 'line', required: true, state: 'uploaded', file: null,
  checklist: [], version: 1, ...over,
});
const view = (slots: PitchSlot[]): PitchMaterialsView => ({ slots, summary: { done: 1, total: 4, missing: 3, unconfirmed: 0 } });

/** **Pitch Materials on a phone, with an HTML page** (P19.6-T2, ADR-0217 §4): *View* opens it in the window, not a tab. */
describe('P19.6-T2 PhonePitch with an HTML page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('P19.6-T2 AC-2 opens an HTML page in the sandboxed window, never a tab', async () => {
    const open = vi.spyOn(window, 'open');
    stubFetch({ '/recruitment/pitch-materials/opportunity/url': { body: { url: SIGNED, expiresAt: '2026-11-06T03:05:00Z' } } });
    render(<PhonePitch view={view([slot({ file: { name: 'Peluang.html', bytes: 48_000, uploadedOn: '2026-11-06', mimeType: 'text/html' } })])} />);
    await userEvent.click(screen.getByRole('button', { name: 'View page, Opportunity Overview — opens in this window' }));
    const frame = await screen.findByTitle('Opportunity Overview');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(open).not.toHaveBeenCalled();
  });

  it('P19.6-T2 AC-6 a PDF still opens in a new tab', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    stubFetch({ '/recruitment/pitch-materials/opportunity/url': { body: { url: 'https://cdn.example/x.pdf', expiresAt: '2026-11-06T03:05:00Z' } } });
    render(<PhonePitch view={view([slot({ file: { name: 'Peluang.pdf', bytes: 1024, uploadedOn: '2026-11-06', mimeType: 'application/pdf' } })])} />);
    await userEvent.click(screen.getByRole('button', { name: 'View PDF, Opportunity Overview — opens in a new tab' }));
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
