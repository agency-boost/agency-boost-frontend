import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE_FILE_REVOKE_MS, saveFile } from './save-file';

/**
 * ADR-0184: a file the API answered, handed to the browser to save — and let go once it has been taken. *Changed
 * 2026-11-23 (the P19.30 browser walk):* the link is in the page while it is clicked, and the URL is kept a minute; a real
 * Chrome's download completing is `save-file.browser.spec.ts`'s.
 */
describe('saveFile', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('saves the blob under its name through a link put in the page for the click, then lets the URL go a minute later', () => {
    vi.useFakeTimers();
    const blob = new Blob(['PK']);
    const createObjectURL = vi.fn(() => 'blob:test/1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL }));
    const clicked: { href: string; download: string; rel: string; inPage: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download, rel: this.rel, inPage: document.contains(this) });
    });

    saveFile(blob, 'roster-template.xlsx');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:test/1', download: 'roster-template.xlsx', rel: 'noopener', inPage: true }]);
    // Out of the page again at once, the URL kept.
    expect(document.querySelector('a[download]')).toBeNull();
    expect(SAVE_FILE_REVOKE_MS).toBe(60_000);
    vi.advanceTimersByTime(SAVE_FILE_REVOKE_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('takes the link out of the page even when the click throws', () => {
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: () => 'blob:test/2', revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => saveFile(new Blob(['x']), 'a.pdf')).toThrow('blocked');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
