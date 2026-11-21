import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentFile, TrainingCategoryRow } from '@/lib/tenant-config';
import {
  categoryCounts, codeTaken, flattenTraining, TRAINING_ACCEPT, TRAINING_FILE_ACCEPT, TRAINING_FILE_TYPES,
  TRAINING_VIDEO_ACCEPT, trainingFileType, uploadTrainingFile, withUploaded,
} from './training-view';

const moduleOf = (code: string, status: 'active' | 'archived' = 'active') => ({
  id: `m-${code}`, code, skillCode: 'S', title: code, publishState: 'published' as const, displayOrder: 1, version: 1, status,
});
const tree: TrainingCategoryRow[] = [{
  id: 'c1', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
  skills: [
    { id: 's1', code: 'S', categoryCode: 'SALES', label: 'Prospecting', displayOrder: 1, version: 1, status: 'active', modules: [moduleOf('A'), moduleOf('B'), moduleOf('C', 'archived')] },
    { id: 's2', code: 'T', categoryCode: 'SALES', label: 'Closing', displayOrder: 2, version: 1, status: 'active', modules: [moduleOf('D')] },
    { id: 's3', code: 'U', categoryCode: 'SALES', label: 'Old', displayOrder: 3, version: 1, status: 'archived', modules: [moduleOf('E', 'archived')] },
  ],
}];

const file = (label: string, mimeType = 'application/pdf'): ContentFile => ({ id: label, label, storageKey: `k-${label}`, mimeType, bytes: 1 });

describe('P19.25-T4 the tree’s helpers', () => {
  it('P19.25-T4 AC-1 counts a category’s live skills and their live modules — "n skill · n modul"', () => {
    expect(categoryCounts(tree[0])).toEqual({ skills: 2, modules: 3 });
  });

  it('flattens the tree into three lists for a module’s page', () => {
    const flat = flattenTraining(tree);
    expect([flat.categories.length, flat.skills.length, flat.modules.length]).toEqual([1, 3, 5]);
  });

  it('a code is taken at its level whatever its case, archived rows included', () => {
    expect(codeTaken(flattenTraining(tree).modules, 'e')).toBe(true);
    expect(codeTaken(flattenTraining(tree).modules, 'NEW')).toBe(false);
    expect(codeTaken([], '  ')).toBe(false);
  });
});

describe('P19.25-T4 AC-2 Unggah materi takes any format (ADR-0282 §3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.25-T4 AC-2 offers exactly the types the API signs for a module (backend TRAINING_FILE_MIME_TYPES)', () => {
    // Two repositories: read from the backend's source, so the two cannot drift.
    const source = readFileSync(join(__dirname, '../../../backend/src/domain/constants/assets.ts'), 'utf8');
    const block = /export const TRAINING_FILE_MIME_TYPES = \[([\s\S]*?)\] as const;/.exec(source)?.[1] ?? '';
    const backend = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).concat(block.includes('HTML_MIME_TYPE') ? ['text/html'] : []);
    expect([...TRAINING_FILE_TYPES.map((t) => t.mimeType)].sort()).toEqual(backend.sort());
  });

  it.each([
    [{ type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', name: 'deck.pptx' }, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    [{ type: '', name: 'Prospek.DOCX' }, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    [{ type: '', name: 'old.ppt' }, 'application/vnd.ms-powerpoint'],
    [{ type: '', name: 'lesson.html' }, 'text/html'],
    [{ type: 'video/quicktime', name: 'clip.mov' }, 'video/quicktime'],
    [{ type: 'application/pdf', name: 'a.pdf' }, 'application/pdf'],
    [{ type: 'application/x-msdownload', name: 'setup.exe' }, null],
    [{ type: '', name: 'notes.txt' }, null],
    // A type reported and foreign is refused, whatever the name claims.
    [{ type: 'application/x-msdownload', name: 'macro.pdf' }, null],
  ])('P19.25-T4 AC-2 sends %j as %s', (picked, type) => {
    expect(trainingFileType(picked)).toBe(type);
  });

  it('P19.25-T4 AC-2 the row’s picker offers every type; a module page’s File picker no video, its Video picker only video', () => {
    for (const ext of ['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.xlsx', '.csv', '.html', '.jpg', '.mp4', '.webm', '.mov']) {
      expect(TRAINING_ACCEPT.split(',')).toContain(ext);
    }
    expect(TRAINING_FILE_ACCEPT.split(',')).not.toContain('.mp4');
    expect(TRAINING_FILE_ACCEPT.split(',')).toContain('.pptx');
    expect(TRAINING_VIDEO_ACCEPT.split(',').filter((e) => e.startsWith('.'))).toEqual(['.mp4', '.webm', '.mov']);
  });

  it('P19.25-T4 AC-2 Unggah materi on a module with nothing: the file is its material, a video under Video', () => {
    const none = { content: { files: [], videos: [], links: [] }, overridden: false };
    expect(withUploaded(none, file('deck.pptx', 'application/vnd.ms-powerpoint'))).toEqual({ files: [file('deck.pptx', 'application/vnd.ms-powerpoint')], videos: [], links: [] });
    expect(withUploaded(none, file('clip.mp4', 'video/mp4'))).toEqual({ files: [], videos: [file('clip.mp4', 'video/mp4')], links: [] });
  });

  it('P19.25-T4 AC-2 Ganti on the office’s own material replaces the item the row names and keeps the rest', () => {
    const link = { id: 'l', label: 'Panduan', url: 'https://example.com/' };
    const own = { content: { files: [file('old.pdf'), file('extra.pdf')], videos: [], links: [link] }, overridden: true };
    expect(withUploaded(own, file('new.pdf'))).toEqual({ files: [file('new.pdf'), file('extra.pdf')], videos: [], links: [link] });
    const linkOnly = { content: { files: [], videos: [], links: [link] }, overridden: true };
    expect(withUploaded(linkOnly, file('new.pdf'))).toEqual({ files: [file('new.pdf')], videos: [], links: [] });
  });

  it('P19.25-T4 AC-2 Ganti on the template’s material: the office’s becomes the file alone, the template’s untouched', () => {
    const company = { content: { files: [file('company.pdf')], videos: [], links: [] }, overridden: false };
    expect(withUploaded(company, file('mine.pdf'))).toEqual({ files: [file('mine.pdf')], videos: [], links: [] });
  });

  it('P19.25-T4 AC-2 an upload signs, sends the bytes to storage, and confirms what landed', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/kpm/settings/training/uploads')) {
        return new Response(JSON.stringify({ uploadUrl: 'https://storage.test/up', storageKey: 'k1', fields: {} }), { status: 201 });
      }
      if (url === 'https://storage.test/up') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ storageKey: 'k1', mimeType: 'application/pdf', bytes: 3 }), { status: 201 });
    }));
    const item = await uploadTrainingFile(new File(['abc'], 'deck.pdf', { type: 'application/pdf' }), 'application/pdf');
    expect(item).toEqual({ id: '', label: 'deck.pdf', storageKey: 'k1', mimeType: 'application/pdf', bytes: 3 });
    expect(calls.map((c) => c.replace(/^(\w+) .*(\/kpm\/settings\/training\/uploads.*)$/, '$1 $2'))).toEqual([
      'POST /kpm/settings/training/uploads', 'POST https://storage.test/up', 'POST /kpm/settings/training/uploads/confirm',
    ]);
  });
});
