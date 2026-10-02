import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEADER_NOTE_MAX } from './coaching';

/**
 * P3.5-T11 AC-4. The frontend declares its own copy of every response shape, and until
 * this existed nothing checked that the two agreed.
 *
 * **The direction is deliberate.** A field the frontend declares and the API does not
 * send arrives as `undefined` and renders as a blank cell — the exact failure
 * `.claude/rules/backend-then-frontend.md` describes, where each half passes its own
 * tests against a contract the other does not implement. A field the API sends and the
 * frontend ignores is harmless. So this asserts **frontend ⊆ document**, and says nothing
 * about the other way round.
 *
 * It reads the committed `openapi.json`, which the backend's CI already checks is in step
 * with its code. A route renamed on one side therefore fails here rather than in
 * somebody's browser.
 */

const OPENAPI = join(__dirname, '..', '..', '..', 'backend', 'openapi.json');

interface Doc {
  paths: Record<string, Record<string, { operationId?: string; responses: Record<string, { content?: Record<string, { schema?: Schema }> }> }>>;
  components: { schemas: Record<string, Schema> };
}
interface Schema {
  $ref?: string;
  type?: string;
  maxLength?: number;
  items?: Schema;
  properties?: Record<string, Schema>;
}

const doc = JSON.parse(readFileSync(OPENAPI, 'utf8')) as Doc;

/** The property names a documented schema carries, following one `$ref` or array wrapper. */
function propertiesOf(name: string): string[] {
  const schema = doc.components.schemas[name];
  if (!schema?.properties) throw new Error(`no schema named ${name} in openapi.json`);
  return Object.keys(schema.properties);
}

/** The fields one of our own interfaces declares, read from the source rather than the type. */
function declaredFields(file: string, name: string): string[] {
  const src = readFileSync(join(__dirname, file), 'utf8');
  const body = new RegExp(`export interface ${name} \\{([^}]*)\\}`, 's').exec(src);
  if (!body) throw new Error(`no interface ${name} in ${file}`);
  return [...body[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
}

/**
 * Ours → theirs. Every entry is a shape a screen reads straight off a response, so a
 * mismatch is something a person would see.
 */
const PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['admin.ts', 'Kpm', 'KpmViewDto'],
  // P4-T25: `displayUnit` is read by every benchmark on screen, and a missing one renders
  // a success rate as `0.15` rather than as a blank.
  ['tenant-config.ts', 'RatioRow', 'RatioDefinitionDto'],
  ['admin.ts', 'Company', 'CompanyResponseDto'],
  // P5-T12: the template screen reads `officesUnrecorded` straight off this response.
  ['admin.ts', 'CompanyTemplate', 'CompanyTemplateDto'],
  ['admin.ts', 'CompanyCard', 'CompanyCardDto'],
  ['admin.ts', 'OrgLevel', 'OrgLevelRowDto'],
  ['admin.ts', 'KpmRequestRow', 'KpmRequestRowDto'],
  ['admin.ts', 'PlatformAdminRow', 'PlatformAdminRowDto'],
  ['admin.ts', 'AuditEntry', 'AuditEntryResponseDto'],
  ['org.ts', 'Member', 'DirectoryMemberDto'],
  ['org.ts', 'MemberPage', 'DirectoryPageDto'],
  ['org.ts', 'TeamMember', 'TeamMemberDto'],
  ['org.ts', 'RoleChangeEntry', 'RoleChangeEntryDto'],
  ['org.ts', 'GroupSummary', 'GroupSummaryDto'],
  ['join.ts', 'PendingRequest', 'PendingRequestDto'],
  ['join.ts', 'UntaggedMember', 'UntaggedMemberDto'],
  ['join.ts', 'MyLeaderCode', 'MyLeaderCodeDto'],
  ['notifications.ts', 'InboxItem', 'InboxItemDto'],
  // P11-T6: the roster reads every one of these straight off `GET /coaching/coachees`, and a field
  // renamed on the server would otherwise pass both suites and draw blank cells.
  ['coaching.ts', 'Roster', 'CoachingRosterDto'],
  ['coaching.ts', 'RosterRow', 'RosterRowDto'],
  ['coaching.ts', 'RosterRung', 'RosterRungDto'],
  ['coaching.ts', 'RosterUnit', 'RosterUnitDto'],
  ['coaching.ts', 'LastOneOnOne', 'RosterLastOneOnOneDto'],
  ['coaching.ts', 'RosterPerson', 'RosterPersonDto'],
  // P11-T7: the person shell's header reads these straight off `GET /coaching/coachees/:membershipId`.
  ['coaching.ts', 'Coachee', 'CoacheeDto'],
  ['coaching.ts', 'CoacheeDownline', 'CoacheeDownlineDto'],
  // P11-T8: the session workspace reads these straight off the lifecycle's routes.
  ['coaching.ts', 'SessionHistory', 'SessionHistoryDto'],
  ['coaching.ts', 'SessionCurrent', 'SessionCurrentDto'],
  ['coaching.ts', 'PastSession', 'SessionHistoryRowDto'],
  ['coaching.ts', 'CoachingSession', 'CoachingSessionDto'],
  ['coaching.ts', 'LastWeekRef', 'LastWeekRefDto'],
  ['coaching.ts', 'LastWeekItem', 'LastWeekItemDto'],
  ['coaching.ts', 'SessionLeadTag', 'SessionLeadTagDto'],
  ['coaching.ts', 'LeadAction', 'LeadActionDto'],
  ['coaching.ts', 'ActionItem', 'ActionItemDto'],
  ['coaching.ts', 'CoachingTip', 'TipDto'],
  ['coaching.ts', 'SessionDraftSaved', 'SessionDraftSavedDto'],
  // P11-T9: the Leader Notes tab reads the profile and the notes straight off their reads and saves.
  ['coaching.ts', 'CoachingProfile', 'CoachingProfileDto'],
  ['coaching.ts', 'CapabilityProfileCatalog', 'ProfileCatalogDto'],
  ['coaching.ts', 'CapabilityStageRow', 'CapabilityStageDto'],
  ['coaching.ts', 'CapabilityRow', 'CapabilityEntryDto'],
  ['coaching.ts', 'CapabilityGridRow', 'CapabilityGridDto'],
  ['coaching.ts', 'CoachingProfileSaved', 'CoachingProfileSavedDto'],
  ['coaching.ts', 'LeaderNotes', 'LeaderNotesDto'],
  ['coaching.ts', 'MyLeaderNote', 'LeaderNoteMineDto'],
  ['coaching.ts', 'LeaderNote', 'LeaderNoteOtherDto'],
  ['coaching.ts', 'LeaderNoteSaved', 'LeaderNoteSavedDto'],
  // P11-T10: the archive reads the snapshot and the earlier versions off the session read; the print
  // and `/coaching/me` read their own routes.
  ['coaching.ts', 'SessionSnapshot', 'SessionSnapshotDto'],
  ['coaching.ts', 'SnapshotGoal', 'SnapshotGoalDto'],
  ['coaching.ts', 'SnapshotPeriod', 'SnapshotPeriodDto'],
  ['coaching.ts', 'SnapshotSource', 'SnapshotSourceDto'],
  ['coaching.ts', 'SnapshotRatios', 'SnapshotRatiosDto'],
  ['coaching.ts', 'SnapshotRatioRow', 'SnapshotRatioRowDto'],
  ['coaching.ts', 'SnapshotActivity', 'SnapshotActivityDto'],
  ['coaching.ts', 'SnapshotTarget', 'SnapshotTargetDto'],
  ['coaching.ts', 'SnapshotSection', 'SnapshotSectionDto'],
  ['coaching.ts', 'SnapshotSectionRow', 'SnapshotSectionRowDto'],
  ['coaching.ts', 'EarlierVersion', 'EarlierVersionDto'],
  ['coaching.ts', 'SessionPrint', 'SessionPrintDto'],
  ['coaching.ts', 'PrintPerson', 'PrintPersonDto'],
  ['coaching.ts', 'PrintLastWeekItem', 'PrintLastWeekItemDto'],
  ['coaching.ts', 'PrintGoal', 'PrintGoalDto'],
  ['coaching.ts', 'PrintPeriod', 'PrintPeriodDto'],
  ['coaching.ts', 'PrintTip', 'PrintTipDto'],
  ['coaching.ts', 'PrintLeadAction', 'PrintLeadActionDto'],
  ['coaching.ts', 'PrintActionItem', 'PrintActionItemDto'],
  ['coaching.ts', 'MySessions', 'MySessionsDto'],
  ['coaching.ts', 'LedSession', 'LedSessionRowDto'],
  // P11-T8: the Activity card and its drill read the 7-day window off `GET /activity/summary`.
  ['activity.ts', 'ActivitySummary', 'ActivitySummaryDto'],
  ['activity.ts', 'SubPeriodTarget', 'ActivityWindowTargetDto'],
  ['activity.ts', 'ActivitySection', 'SectionChipDto'],
  ['activity.ts', 'ActivitySectionRow', 'SectionRowDto'],
];

describe('the frontend types match the API document (P3.5-T11 AC-4)', () => {
  it('reads a document with something in it', () => {
    expect(Object.keys(doc.components.schemas).length).toBeGreaterThan(30);
  });

  it.each(PAIRS)('%s › %s ⊆ %s', (file, ours, theirs) => {
    const documented = new Set(propertiesOf(theirs));
    const extra = declaredFields(file, ours).filter((f) => !documented.has(f));
    // Anything listed here is a field a screen reads and the API never sends.
    expect(extra).toEqual([]);
  });

  it('P11 exit review: the input limits a screen repeats are the ones the API validates', () => {
    const coachingParts = readFileSync(join(__dirname, '..', 'components', 'coaching-parts.tsx'), 'utf8');
    const reasonMax = Number(/const REASON_MAX = (\d+);/.exec(coachingParts)?.[1]);
    expect(doc.components.schemas.SaveLeaderNoteDto.properties?.text.maxLength).toBe(LEADER_NOTE_MAX);
    expect(doc.components.schemas.ReopenCoachingSessionDto.properties?.reason.maxLength).toBe(reasonMax);
  });

  it('every path the client calls exists in the document', () => {
    const paths = new Set(Object.keys(doc.paths).map((p) => p.replace('/api/v1', '')));
    const sources = ['admin.ts', 'org.ts', 'join.ts', 'notifications.ts', 'session.ts', 'api.ts', 'coaching.ts'];
    const called = new Set<string>();
    for (const file of sources) {
      for (const path of callsIn(readFileSync(join(__dirname, file), 'utf8'))) called.add(path);
    }
    expect(called.size).toBeGreaterThan(20);

    const unknown = [...called].filter((p) => !matches(p, paths));
    expect(unknown).toEqual([]);
  });
});


/**
 * Every path passed to `api(...)`, with each interpolation reduced to `*`.
 *
 * A scanner rather than a regex, because the calls nest: `/members${query ? `?${query}`
 * : ''}` has a template literal **inside** its interpolation, and a regex that stops at
 * the next backtick reads the path as `/members${query ` — which then fails to match
 * anything and reports a route that is perfectly fine.
 */
function callsIn(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\bapi(?:<[^>]*>)?\(\s*[`']/g)) {
    const quote = src[m.index! + m[0].length - 1];
    let i = m.index! + m[0].length;
    let path = '';
    let depth = 0;
    while (i < src.length) {
      const ch = src[i];
      if (depth === 0 && ch === quote) break;
      if (depth === 0 && ch === '$' && src[i + 1] === '{') {
        path += '*';
        depth = 1;
        i += 2;
        continue;
      }
      if (depth > 0) {
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        i += 1;
        continue;
      }
      path += ch;
      i += 1;
    }
    // A query string is not part of the path. An interpolation that is not preceded by
    // `/` is not a segment either — `/members${query ? '?…' : ''}` appends a query, while
    // `/members/${id}` names a parameter.
    out.push(path.split('?')[0].replace(/([^/])\*$/, '$1'));
  }
  return out;
}

/** A called path matches a documented one when their segments line up, `*` against `{…}`. */
function matches(called: string, documented: Set<string>): boolean {
  const want = called.split('/');
  for (const path of documented) {
    const have = path.split('/');
    if (have.length !== want.length) continue;
    if (have.every((seg, i) => seg === want[i] || (seg.startsWith('{') && want[i] === '*'))) return true;
  }
  return false;
}
