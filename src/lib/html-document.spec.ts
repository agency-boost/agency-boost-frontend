import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FRAME_MIN_HEIGHT_PX, HTML_ACCEPT, HTML_MIME_TYPE, isFrameableAddress, isHtmlDocument, isHtmlFile, lessonColoursOf,
  lessonFragment,
} from './html-document';

/** A signed link of the fake storage host every spec uses: a host of its own, as `test/stub-storage.ts`'s is. */
const STORAGE = 'https://storage.googleapis.com/test-bucket/dev/kpm-1/training/01LESSON?X-Goog-Signature=abc';
const APP = 'http://localhost:3000';
const API = 'http://api.test';

describe('P19.6-T2 an HTML file’s rules (ADR-0217)', () => {
  it('P19.6-T2 AC-1 names text/html as the backend does (domain/constants/assets.ts)', () => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'assets.ts'), 'utf8');
    expect(source).toContain(`export const HTML_MIME_TYPE = '${HTML_MIME_TYPE}';`);
    expect(HTML_ACCEPT).toBe('text/html,.html,.htm');
  });

  it('P19.6-T2 AC-6 tells an HTML file from a PDF, an image, a video and a link', () => {
    expect(isHtmlDocument('text/html')).toBe(true);
    for (const other of ['application/pdf', 'image/png', 'video/mp4', 'text/csv', null, undefined, '']) {
      expect(isHtmlDocument(other)).toBe(false);
    }
  });

  it('P19.6-T2 AC-1 takes a picked file as HTML by its type, or by its name where a desktop reports none', () => {
    expect(isHtmlFile({ type: 'text/html', name: 'pelajaran' })).toBe(true);
    expect(isHtmlFile({ type: '', name: 'Pelajaran 01.HTM' })).toBe(true);
    expect(isHtmlFile({ type: '', name: 'pelajaran.html' })).toBe(true);
    expect(isHtmlFile({ type: 'application/pdf', name: 'x.html' })).toBe(false);
    expect(isHtmlFile({ type: '', name: 'x.pdf' })).toBe(false);
  });

  describe('P19.6-T2 AC-2 only the storage host is framed, never the app’s origin', () => {
    it('P19.6-T2 AC-2 frames a signed https link of another host', () => {
      expect(isFrameableAddress(STORAGE, APP, API)).toBe(true);
    });

    it.each([
      ['the app’s own origin', `${APP}/lesson.html`],
      ['the API’s origin', `${API}/api/v1/lesson.html`],
      ['plain http', 'http://storage.googleapis.com/test-bucket/x'],
      ['a data address', 'data:text/html,<script>alert(1)</script>'],
      ['a script address', 'javascript:alert(1)'],
      ['a relative path', '/lesson.html'],
      ['nothing', ''],
    ])('P19.6-T2 AC-2 refuses %s', (_case, src) => {
      expect(isFrameableAddress(src, APP, API)).toBe(false);
    });

    it('P19.6-T2 AC-2 refuses an https app origin too', () => {
      expect(isFrameableAddress('https://agencyboost.id/x.html', 'https://agencyboost.id', 'https://api.agencyboost.id')).toBe(false);
      expect(isFrameableAddress('https://api.agencyboost.id/x.html', 'https://agencyboost.id', 'https://api.agencyboost.id')).toBe(false);
    });
  });

  describe('P19.6-T2 the KPM’s colours, in the fragment (ADR-0217 §5)', () => {
    it('P19.6-T2 writes the three names, six lower-case hex digits each, in the fragment and never the query', () => {
      expect(lessonFragment({ accent: 'a85e1b', accentSoft: 'fcf3ea', ink: '1b2b4b' }))
        .toBe('#accent=a85e1b&accentSoft=fcf3ea&ink=1b2b4b');
      expect(lessonFragment({ accent: 'a85e1b', accentSoft: 'fcf3ea' })).toBe('#accent=a85e1b&accentSoft=fcf3ea');
      expect(lessonFragment({ accent: 'a85e1b', accentSoft: 'fcf3ea', ink: null })).toBe('#accent=a85e1b&accentSoft=fcf3ea');
    });

    it('P19.6-T2 sends nothing without branding, and leaves out a value that is not six lower-case hex digits', () => {
      expect(lessonFragment(null)).toBe('');
      expect(lessonFragment(undefined)).toBe('');
      expect(lessonFragment({ accent: '#A85E1B', accentSoft: 'red', ink: '1b2b4b"><script>' })).toBe('');
      expect(lessonFragment({ accent: 'A85E1B', accentSoft: 'fcf3ea' })).toBe('#accentSoft=fcf3ea');
    });

    it('P19.6-T2 reads the colours from the session’s branding, and none from a session without', () => {
      const lesson = { accent: 'a85e1b', accentSoft: 'fcf3ea', ink: '1b2b4b' };
      expect(lessonColoursOf({ branding: { kpmId: 'k1', version: 3, palette: {}, lesson } })).toEqual(lesson);
      expect(lessonColoursOf({ branding: { kpmId: 'k1', version: 0, palette: null, lesson: null } })).toBeNull();
      // The Super Admin's own view: no office, no branding.
      expect(lessonColoursOf({ branding: null })).toBeNull();
      expect(lessonColoursOf({})).toBeNull();
      expect(lessonColoursOf(null)).toBeNull();
    });
  });

  it('P19.6-T2 AC-4 a frame is never shorter than 480 px', () => {
    expect(FRAME_MIN_HEIGHT_PX).toBe(480);
  });
});
