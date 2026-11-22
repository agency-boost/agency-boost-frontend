import { describe, expect, it } from 'vitest';
import {
  PUBLISHED_SETTINGS, sequenceVersions, settingOfPath, signedUploadForm, stageChange, type ConfigChange,
} from '@/lib/tenant-config';
import { gcsSignedUpload } from '@test/storage-fixtures';

describe('sequenceVersions — the version a batch finds each row at', () => {
  it('leaves one op per row exactly as the screen read it', () => {
    const ops: ConfigChange[] = [
      { op: 'type.update', id: 't-1', expectedVersion: 3, body: { label: 'Closing' } },
      { op: 'type.archive', id: 't-2', expectedVersion: 7 },
      { op: 'type.create', body: { code: 'NEW_ONE' } },
    ];

    expect(sequenceVersions(ops)).toEqual(ops);
  });

  /*
   * The defect: an edit and an archive on one row, saved together, both named version 3. The
   * batch had moved the row to 4 after the edit, and refused the archive as a conflict.
   */
  it('names the version the earlier op on the same row leaves behind', () => {
    const ops = stageChange(
      stageChange([], { op: 'trainingModule.update', id: 'm-1', expectedVersion: 3, body: { publishState: 'draft' } }),
      { op: 'trainingModule.archive', id: 'm-1', expectedVersion: 3 },
    );

    expect(sequenceVersions(ops).map((c) => c.expectedVersion)).toEqual([3, 4]);
  });

  it('counts per row, and per kind of row', () => {
    const ops: ConfigChange[] = [
      { op: 'trainingSkill.update', id: 'x', expectedVersion: 1, body: { label: 'A' } },
      // Another collection's row with the same id is not the same row.
      { op: 'trainingModule.update', id: 'x', expectedVersion: 5, body: { title: 'B' } },
      { op: 'trainingSkill.archive', id: 'x', expectedVersion: 1 },
      { op: 'trainingSkill.restore', id: 'x', expectedVersion: 1 },
    ];

    expect(sequenceVersions(ops).map((c) => c.expectedVersion)).toEqual([1, 5, 2, 3]);
  });

  it('does not change what is staged', () => {
    const ops: ConfigChange[] = [
      { op: 'type.update', id: 't-1', expectedVersion: 3, body: { label: 'Closing' } },
      { op: 'type.archive', id: 't-1', expectedVersion: 3 },
    ];
    sequenceVersions(ops);

    expect(ops[1].expectedVersion).toBe(3);
  });
});

describe('signedUploadForm — the form a signed upload is sent as', () => {
  const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const signed = gcsSignedUpload('dev/kpm-1/products/01DOC');

  it('P18.4-T2 sends every field of the signed POST policy, in the server’s order, then the file last', () => {
    const form = signedUploadForm(signed, file);

    expect([...form.keys()]).toEqual([
      'Content-Type', 'key', 'x-goog-date', 'x-goog-credential', 'x-goog-algorithm', 'policy',
      'x-goog-signature', 'file',
    ]);
    // Each as the server signed it: a value changed on the way is a policy condition storage fails.
    for (const [name, value] of Object.entries(signed.fields)) expect(form.get(name)).toBe(value);
    expect(form.get('key')).toBe('dev/kpm-1/products/01DOC');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it('P18.4-T2 adds nothing the server did not sign — no public id, no signature of its own', () => {
    const form = signedUploadForm(signed, file);

    expect(form.has('public_id')).toBe(false);
    expect(form.has('signature')).toBe(false);
    expect(form.getAll('file')).toHaveLength(1);
  });

  it('P18.4-T2 sends the server’s fields whatever they are named, so a vendor change stays on the server', () => {
    const form = signedUploadForm({ ...signed, fields: { b: '2', a: '1' } }, file);

    expect([...form.keys()]).toEqual(['b', 'a', 'file']);
  });
});

describe('settingOfPath — the setting a settings page publishes (P19.21-T2 AC-3)', () => {
  it.each([
    ['/kpm/settings/activity-types', 'activity_types'],
    ['/kpm/settings/ratio-benchmarks', 'activity_types'],
    ['/kpm/settings/lead-statuses', 'lead_statuses'],
    ['/kpm/settings/activation-checklist', 'activation_checklist'],
    ['/kpm/settings/training', 'training'],
    ['/kpm/settings/training/66f0000000000000000000a1', 'training'],
    ['/kpm/settings/capability-mapping', 'capability_mapping'],
    ['/kpm/settings/events', 'events'],
    ['/kpm/settings/events?tab=types', 'events'],
  ])('%s → %s', (path, setting) => {
    expect(settingOfPath(path)).toBe(setting);
  });

  it.each([
    '/kpm/settings', '/kpm/settings/products', '/kpm/settings/campaigns', '/kpm/settings/recruitment-pitch',
    '/kpm/settings/branch-info', '/kpm/settings/branding', '/admin/companies/c1/template', '', null, undefined,
  ])('%s is saved live, or is no settings page: null', (path) => {
    expect(settingOfPath(path)).toBeNull();
  });

  it('names every one of the six settings the API publishes', () => {
    expect(PUBLISHED_SETTINGS).toEqual([
      'activity_types', 'lead_statuses', 'activation_checklist', 'training', 'capability_mapping', 'events',
    ]);
  });
});
