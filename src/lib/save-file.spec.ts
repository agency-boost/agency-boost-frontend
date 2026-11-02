import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveFile } from './save-file';

/** ADR-0184: a file the API answered, handed to the browser to save — and let go once it has been taken. */
describe('saveFile', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('saves the blob under its name through a link that is never in the page, then lets the URL go', () => {
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
    expect(clicked).toEqual([{ href: 'blob:test/1', download: 'roster-template.xlsx', rel: 'noopener', inPage: false }]);
    // Not at once: revoking before the click has been taken can cancel the download.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });
});
