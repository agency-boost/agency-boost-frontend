import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVATION_NOTE_MAX, ITEM_NOTE_MAX, START_DATE_BACK_DAYS } from './activation';
import { INVITEES_MAX, NOTES_MAX, PEOPLE_PAGE, TITLE_MAX, TRIP_DAYS_MAX } from './calendar';
import { LEADER_NOTE_MAX } from './coaching';
import { PRODUCT_DESCRIPTION_MAX } from './tenant-config';
import { PDF_MAX_BYTES } from './recruitment-pitch';
import { COMMISSION_MAX_YEARS } from './admin';
import { INBOX_PAGE_SIZE, POPOVER_PAGE_SIZE } from './notifications';

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
  paths: Record<string, Record<string, {
    operationId?: string;
    parameters?: { name: string; in: string; schema?: Schema }[];
    responses: Record<string, { content?: Record<string, { schema?: Schema }> }>;
  }>>;
  components: { schemas: Record<string, Schema> };
}
interface Schema {
  $ref?: string;
  type?: string;
  maxLength?: number;
  maxItems?: number;
  description?: string;
  maximum?: number;
  default?: unknown;
  nullable?: boolean;
  enum?: unknown[];
  required?: string[];
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
  // P13.2-T3: the offices list and its dialog read the subscription, Leaders used and the state off
  // the row; one renamed on the server would draw a blank column.
  ['admin.ts', 'TenantSubscription', 'KpmSubscriptionDto'],
  ['admin.ts', 'TenantAdminFields', 'KpmAdminViewDto'],
  // P4-T25: `displayUnit` is read by every benchmark on screen, and a missing one renders
  // a success rate as `0.15` rather than as a blank.
  ['tenant-config.ts', 'RatioRow', 'RatioDefinitionDto'],
  // Phase 14 (OD-136): the office's Products screen reads the description's draft off the shelf, and
  // the approvals queue reads what agents are served — the description among it — off the effective read.
  ['tenant-config.ts', 'KpmProductRow', 'KpmProductDto'],
  ['tenant-config.ts', 'EffectiveScript', 'EffectiveScriptDto'],
  ['admin.ts', 'Company', 'CompanyResponseDto'],
  // P5-T12: the template screen reads `officesUnrecorded` straight off this response.
  ['admin.ts', 'CompanyTemplate', 'CompanyTemplateDto'],
  // P13.2-T6: the template picker and *Start from* read every template's name, default, status and
  // office count off this row (ADR-0115 §3).
  ['admin.ts', 'NamedTemplate', 'NamedTemplateDto'],
  ['admin.ts', 'DroppedSetting', 'DroppedSettingDto'],
  ['admin.ts', 'TemplateOrigin', 'TemplateOriginDto'],
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
  // P12.1-T4: the pager reads `total`, `page` and `pageSize` straight off the page, and every row and
  // the badge read `readAt` and `unread` straight off a mark's answer.
  ['notifications.ts', 'InboxPage', 'InboxDto'],
  ['notifications.ts', 'ReadState', 'NotificationReadStateDto'],
  ['notifications.ts', 'ReadAllState', 'UnreadCountDto'],
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
  // P13.1-T9: the Activity Dashboard, the reader's own and coaching's *Activity* tab's, one body.
  ['activity.ts', 'ActivityDashboard', 'ActivityDashboardDto'],
  ['activity.ts', 'DashboardBucket', 'DashboardBucketDto'],
  ['activity.ts', 'DashboardSection', 'DashboardSectionDto'],
  ['activity.ts', 'DashboardType', 'DashboardTypeDto'],
  // P13.1-T5: *The gap*'s sentence reads its four numbers straight off `GET /summary`'s pace (ADR-0109).
  ['summary.ts', 'Pace', 'PaceDto'],
  ['summary.ts', 'PeriodFigures', 'MonthlyFiguresDto'],
  // P13.1-T4: `/leads` and the coaching session's *Leads* card read a lead straight off `/leads`.
  ['leads.ts', 'Lead', 'LeadResponseDto'],
  ['leads.ts', 'LeadContact', 'LeadContactDto'],
  ['leads.ts', 'LeadPage', 'LeadPageDto'],
  // Phase 14: the Product Catalog, its drawer and the Sales Attack Plan read every one of these straight
  // off the field reads; a field renamed on the server would draw a blank card, block or verdict.
  ['product-catalog.ts', 'CatalogList', 'CatalogListDto'],
  ['product-catalog.ts', 'CatalogCard', 'CatalogCardDto'],
  ['product-catalog.ts', 'CatalogCategory', 'CatalogCategoryDto'],
  ['product-catalog.ts', 'CatalogProduct', 'CatalogProductDto'],
  ['product-catalog.ts', 'CatalogScript', 'CatalogScriptDto'],
  ['product-catalog.ts', 'CatalogDocument', 'CatalogDocumentDto'],
  ['product-catalog.ts', 'CommissionRate', 'CommissionRateDto'],
  ['product-catalog.ts', 'DocumentLink', 'CatalogDocumentUrlDto'],
  ['product-catalog.ts', 'AttackPlan', 'AttackPlanDto'],
  ['product-catalog.ts', 'AttackPlanBrief', 'AttackPlanBriefDto'],
  ['product-catalog.ts', 'AttackPlanAlternative', 'AttackPlanAlternativeDto'],
  // Phase 17: the recruitment plan, the office's pitch slots, and the company's playbook on the console.
  ['recruitment.ts', 'Choice', 'RecruitmentChoiceDto'],
  ['recruitment.ts', 'RecruitmentVocabulary', 'RecruitmentVocabularyDto'],
  ['recruitment.ts', 'RecruitmentBrief', 'RecruitmentBriefDto'],
  ['recruitment.ts', 'RecruitmentProfile', 'RecruitmentProfileDto'],
  ['recruitment.ts', 'RecruitmentOpening', 'RecruitmentOpeningDto'],
  ['recruitment.ts', 'RecruitmentObjection', 'RecruitmentObjectionDto'],
  ['recruitment.ts', 'RecruitmentPlan', 'RecruitmentPlanDto'],
  ['recruitment.ts', 'RecruitmentAttackPlanView', 'RecruitmentAttackPlanDto'],
  ['recruitment-pitch.ts', 'PitchFile', 'PitchFileDto'],
  ['recruitment-pitch.ts', 'PitchChecklistItem', 'PitchChecklistItemDto'],
  ['recruitment-pitch.ts', 'PitchSlot', 'PitchSlotDto'],
  ['recruitment-pitch.ts', 'PitchSummary', 'PitchSummaryDto'],
  ['recruitment-pitch.ts', 'PitchMaterialsView', 'PitchMaterialsDto'],
  ['recruitment-pitch.ts', 'PitchDocumentLink', 'PitchDocumentUrlDto'],
  ['recruitment-playbook.ts', 'PlaybookDto', 'RecruitmentPlaybookDto'],
  ['recruitment-playbook.ts', 'PlaybookRead', 'RecruitmentPlaybookAdminDto'],
  ['tenant-config.ts', 'SignedUpload', 'SignedUploadDto'],
  // Phase 18: the KPM Overview, its not-logged list and target, the analytics, and the platform's adoption.
  ['kpm-overview.ts', 'KpmOverviewView', 'KpmOverviewDto'],
  ['kpm-overview.ts', 'OverviewOffice', 'OfficeHeaderDto'],
  ['kpm-overview.ts', 'OverviewThresholds', 'ReportingThresholdsDto'],
  ['kpm-overview.ts', 'OverviewComposition', 'OverviewCompositionDto'],
  ['kpm-overview.ts', 'OverviewRungCount', 'RungCountDto'],
  ['kpm-overview.ts', 'OverviewEngagement', 'OverviewEngagementDto'],
  ['kpm-overview.ts', 'LoggedThisMonth', 'LoggedThisMonthDto'],
  ['kpm-overview.ts', 'LoggedThisWeek', 'LoggedThisWeekDto'],
  ['kpm-overview.ts', 'OverviewRate', 'RateDto'],
  ['kpm-overview.ts', 'OverviewCoaching', 'OverviewCoachingDto'],
  ['kpm-overview.ts', 'LeaderboardRow', 'LeaderboardRowDto'],
  ['kpm-overview.ts', 'OverviewRecruitment', 'OverviewRecruitmentDto'],
  ['kpm-overview.ts', 'OverviewProduction', 'OverviewProductionDto'],
  ['kpm-overview.ts', 'OverviewYtd', 'YearToDateDto'],
  ['kpm-overview.ts', 'OverviewMoney', 'MoneyDto'],
  ['kpm-overview.ts', 'OverviewAgency', 'OverviewAgencyDto'],
  ['kpm-overview.ts', 'OverviewAabUnit', 'OverviewUnitDto'],
  ['kpm-overview.ts', 'NotLoggedList', 'NotLoggedDto'],
  ['kpm-overview.ts', 'NotLoggedMember', 'NotLoggedMemberDto'],
  ['kpm-overview.ts', 'NotLoggedRung', 'RungRefDto'],
  ['kpm-overview.ts', 'RecruitTarget', 'RecruitTargetDto'],
  ['kpm-analytics.ts', 'KpmAnalyticsView', 'KpmAnalyticsDto'],
  ['kpm-analytics.ts', 'AgencyRow', 'AnalyticsAgencyDto'],
  ['kpm-analytics.ts', 'AabUnitRow', 'AnalyticsUnitRowDto'],
  ['kpm-analytics.ts', 'UnitFigures', 'AnalyticsRowDto'],
  ['kpm-analytics.ts', 'AnalyticsTotal', 'AnalyticsTotalDto'],
  ['kpm-analytics.ts', 'Moc', 'MocDto'],
  ['kpm-analytics.ts', 'MocCriterion', 'MocCriterionDto'],
  ['kpm-analytics.ts', 'AnalyticsMoney', 'MoneyDto'],
  ['kpm-analytics.ts', 'AnalyticsRate', 'RateDto'],
  ['kpm-analytics.ts', 'AnalyticsLeads', 'AnalyticsLeadsDto'],
  ['kpm-analytics.ts', 'AnalyticsManpower', 'ManpowerDto'],
  ['kpm-analytics.ts', 'MonthlyProduction', 'MonthlyProductionDto'],
  ['kpm-analytics.ts', 'AnalyticsHead', 'RowHeadDto'],
  ['kpm-analytics.ts', 'AnalyticsMember', 'AnalyticsMemberDto'],
  ['kpm-analytics.ts', 'AnalyticsClub', 'ClubDto'],
  ['kpm-analytics.ts', 'AnalyticsThresholds', 'ReportingThresholdsDto'],
  ['admin-analytics.ts', 'AdoptionRung', 'RungCountDto'],
  ['admin-analytics.ts', 'Adoption', 'AdoptionDto'],
  ['admin-analytics.ts', 'AdoptionCompanyRef', 'PlatformCompanyRefDto'],
  ['admin-analytics.ts', 'PlatformOfficeFields', 'PlatformOfficeAdoptionDto'],
  ['admin-analytics.ts', 'PlatformCompanyFields', 'PlatformCompanyAdoptionDto'],
  ['admin-analytics.ts', 'PlatformTotalFields', 'PlatformAdoptionDto'],
  ['admin-analytics.ts', 'PlatformAnalyticsView', 'PlatformAnalyticsDto'],
  // Phase 18.1: the Strategic Leader Forum — the list, a meeting's card, its editors, its scorecard, its agenda
  // and tracker, and a share link. `MeetingView` extends `MeetingCard`, which `declaredFields` cannot follow:
  // its own fields are held in *the forum's routes*, below.
  ['leader-meetings.ts', 'ForumPerson', 'ForumPersonDto'],
  ['leader-meetings.ts', 'MeetingEditors', 'MeetingEditorsDto'],
  ['leader-meetings.ts', 'ForumLimits', 'ForumLimitsDto'],
  ['leader-meetings.ts', 'MeetingCard', 'MeetingCardDto'],
  ['leader-meetings.ts', 'MeetingListView', 'MeetingListViewDto'],
  ['leader-meetings.ts', 'Scorecard', 'ScorecardDto'],
  ['leader-meetings.ts', 'ScorecardRow', 'ScorecardRowDto'],
  ['leader-meetings.ts', 'AgendaItem', 'AgendaItemDto'],
  ['leader-meetings.ts', 'ActionItem', 'LeaderActionItemDto'],
  ['leader-meetings.ts', 'ShareLink', 'ShareLinkDto'],
  // Phase 18.5 (P18.5-T5, T6): KPM Events — the list and the modal read every one of these off `GET /events`
  // and the writes' answers; *View feedback* reads the roll call and the Feedback Summary; the picker its people.
  ['events.ts', 'GuestEventList', 'GuestEventListDto'],
  ['events.ts', 'GuestEvent', 'GuestEventDto'],
  ['events.ts', 'GuestEventType', 'GuestEventTypeDto'],
  ['events.ts', 'GuestEventAudience', 'GuestEventAudienceDto'],
  ['events.ts', 'GuestEventMe', 'MyEventPartDto'],
  ['events.ts', 'GuestFeedback', 'MyEventFeedbackDto'],
  ['events.ts', 'GuestEventLimits', 'GuestEventLimitsDto'],
  ['events.ts', 'GuestEventCan', 'GuestEventCanDto'],
  ['events.ts', 'NpsConstants', 'NpsConstantsDto'],
  ['events-admin.ts', 'RollCall', 'RollCallDto'],
  ['events-admin.ts', 'RollCallRow', 'RollCallRowDto'],
  ['events-admin.ts', 'RollCallCan', 'RollCallCanDto'],
  ['events-admin.ts', 'FeedbackSummary', 'FeedbackSummaryDto'],
  ['events-admin.ts', 'FeedbackRow', 'FeedbackRowDto'],
  ['events-admin.ts', 'EventInvitee', 'EventInviteeDto'],
  ['events-admin.ts', 'EventInviteeList', 'EventInviteeListDto'],
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

  it('P13.1-T4 AC-1: a lead carries no lawful basis, in or out (ADR-0108 §1)', () => {
    // The screen sends none and reads none; the document must not offer one to anybody else either.
    expect(propertiesOf('LeadResponseDto')).not.toContain('lawfulBasis');
    expect(propertiesOf('LeadResponseDto')).not.toContain('consentAt');
    expect(propertiesOf('CreateLeadDto')).not.toContain('lawfulBasis');
    expect(propertiesOf('UpdateLeadDto')).not.toContain('lawfulBasis');
    expect(declaredFields('leads.ts', 'Lead')).not.toContain('lawfulBasis');
  });

  it('Phase 14: the description’s bound on screen is the one the API validates (OD-136)', () => {
    expect(doc.components.schemas.SaveProductOverridesDto.properties?.description.maxLength)
      .toBe(PRODUCT_DESCRIPTION_MAX);
  });

  it('Phase 17: a PDF the screens refuse as too large is the one the API refuses (ASSET_MAX_BYTES)', () => {
    expect(doc.components.schemas.RequestDocumentUploadDto.properties?.bytes.maximum).toBe(PDF_MAX_BYTES);
  });

  it('P14 exit review: the commission editor stops adding years where the API stops taking them (ADR-0119)', () => {
    expect(doc.components.schemas.CommissionYearDto.properties?.year.maximum).toBe(COMMISSION_MAX_YEARS);
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
 * P12.1: the inbox's shapes, held to their **shape** as the calendar's are (below): a field we read as
 * always there is one the document requires, and one it marks `nullable` we type with `| null` — a
 * row's `readAt` is the difference between *Mark as read* and *Mark as unread*.
 */
const INBOX_PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['notifications.ts', 'InboxItem', 'InboxItemDto'],
  ['notifications.ts', 'InboxPage', 'InboxDto'],
  ['notifications.ts', 'ReadState', 'NotificationReadStateDto'],
  ['notifications.ts', 'ReadAllState', 'UnreadCountDto'],
];

describe('the inbox’s types match the API document (P12.1-T4)', () => {
  it.each(INBOX_PAIRS)('%s › %s is shaped as %s promises: required and nullable', (file, ours, theirs) => {
    const schema = doc.components.schemas[theirs];
    const required = new Set(schema.required ?? []);
    const problems: string[] = [];
    for (const field of declaredTypes(file, ours)) {
      const prop = schema.properties?.[field.name] ?? {};
      if (!field.optional && !required.has(field.name)) problems.push(`${field.name}: declared always there, documented optional`);
      if (prop.nullable && !field.nullable) problems.push(`${field.name}: documented nullable, declared without | null`);
    }
    expect(problems).toEqual([]);
  });

  it('pages by the two queries the API documents, the page at the API’s default, and neither list asks for more than it serves', () => {
    const query = (doc.paths['/api/v1/notifications'].get.parameters ?? []).filter((p) => p.in === 'query');
    expect(query.map((p) => p.name).sort()).toEqual(['page', 'pageSize']);
    const pageSize = query.find((p) => p.name === 'pageSize')?.schema;
    const max = pageSize?.maximum ?? 0;
    // `/notifications` shows the API's own default (the backend's `INBOX_PAGE.DEFAULT_SIZE`), pinned
    // here so the two cannot drift (invariant §7).
    expect(INBOX_PAGE_SIZE).toBe(pageSize?.default);
    expect(INBOX_PAGE_SIZE).toBeLessThanOrEqual(max);
    expect(POPOVER_PAGE_SIZE).toBeLessThanOrEqual(max);
  });

  it('every write the rows make is a route in the document', () => {
    for (const path of ['/notifications/{notificationId}/read', '/notifications/{notificationId}/unread', '/notifications/read-all']) {
      expect(doc.paths[`/api/v1${path}`]?.post, path).toBeDefined();
    }
  });
});

/**
 * P12: the calendar's shapes. Held until the document had the calendar's routes, and **enforced
 * unconditionally now that it has**: a hold keyed on a route would skip the whole block, quietly, the
 * day that route was renamed.
 *
 * Beyond the names, the calendar's pairs are held to the field's **shape**, in the same direction —
 * nothing a screen relies on that the API does not promise:
 *
 * - a field we declare without `?` is one the document **requires**: a screen reads it as always there;
 * - a field the document marks `nullable` is one we type with `| null`: `null` is not a `string`, and
 *   a screen that trims it throws;
 * - a field the document lists values for is typed with **exactly** those values: one the API sends
 *   that we lack has no word on screen, and one we keep that it never sends is a branch nobody walks.
 */
const CALENDAR_PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['calendar.ts', 'CalendarRead', 'CalendarPeriodDto'],
  ['calendar.ts', 'CalendarDay', 'CalendarDayDto'],
  ['calendar.ts', 'CalendarNow', 'CalendarNowDto'],
  ['calendar.ts', 'CalendarSubject', 'CalendarSubjectDto'],
  ['calendar.ts', 'CalendarRung', 'CalendarRungDto'],
  ['calendar.ts', 'CalendarPerson', 'CalendarPersonDto'],
  ['calendar.ts', 'CalendarInvitee', 'CalendarInviteeDto'],
  ['calendar.ts', 'CalendarEntry', 'CalendarEntryDto'],
  ['calendar.ts', 'CalendarBusy', 'CalendarBusyBlockDto'],
  ['calendar.ts', 'CalendarEntryDeleted', 'CalendarDeletedDto'],
  ['calendar.ts', 'CalendarPeopleItem', 'CalendarPersonRowDto'],
  ['calendar.ts', 'CalendarPeoplePageInfo', 'CalendarPageDto'],
  ['calendar.ts', 'CalendarPeoplePage', 'CalendarPeoplePageDto'],
  ['calendar.ts', 'CalendarDownlinePerson', 'CalendarDownlineRowDto'],
  ['calendar.ts', 'CalendarDownline', 'CalendarDownlineDto'],
  // P13.1-T8: *Hide my personal activities* (ADR-0110), read and sent whole.
  ['calendar.ts', 'CalendarSettings', 'CalendarSettingsDto'],
  ['calendar.ts', 'CalendarSettings', 'SaveCalendarSettingsDto'],
];

/** The three writes that send an `EntryInput`, and what each call adds to it (`calendar.ts`). */
const CALENDAR_WRITES: ReadonlyArray<[dto: string, added: string[]]> = [
  ['CreateCalendarEntryDto', []],
  ['UpdateCalendarEntryDto', ['version']],
  ['CreateCalendarBlockDto', ['membershipId']],
];

describe('the calendar’s types match the API document (P12)', () => {
  it('reads a document that has the calendar in it', () => {
    expect(Object.keys(doc.paths)).toContain('/api/v1/calendar/entries');
  });

  it.each(CALENDAR_PAIRS)('%s › %s ⊆ %s', (file, ours, theirs) => {
    const documented = new Set(propertiesOf(theirs));
    expect(declaredFields(file, ours).filter((f) => !documented.has(f))).toEqual([]);
  });

  it.each(CALENDAR_PAIRS)('%s › %s is shaped as %s promises: required, nullable, its values', (file, ours, theirs) => {
    const schema = doc.components.schemas[theirs];
    const required = new Set(schema.required ?? []);
    const problems: string[] = [];
    for (const field of declaredTypes(file, ours)) {
      const prop = schema.properties?.[field.name] ?? {};
      if (!field.optional && !required.has(field.name)) problems.push(`${field.name}: declared always there, documented optional`);
      if (prop.nullable && !field.nullable) problems.push(`${field.name}: documented nullable, declared without | null`);
      const theirValues = (prop.enum ?? []).filter((v): v is string => typeof v === 'string');
      if (theirValues.length > 0) {
        const ourValues = literalsOf(file, field.type);
        if (ourValues === null) problems.push(`${field.name}: documented as values, declared as ${field.type}`);
        else if ([...ourValues].sort().join() !== [...theirValues].sort().join()) {
          problems.push(`${field.name}: ${[...ourValues].sort().join('|')} against ${[...theirValues].sort().join('|')}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it.each(CALENDAR_WRITES)('a save sends only what %s takes, and everything it requires', (dto, added) => {
    const documented = new Set(propertiesOf(dto));
    const sent = [...declaredFields('calendar.ts', 'EntryInput'), ...added];
    expect(sent.filter((f) => !documented.has(f))).toEqual([]);
    const always = new Set([...declaredTypes('calendar.ts', 'EntryInput').filter((f) => !f.optional).map((f) => f.name), ...added]);
    expect((doc.components.schemas[dto].required ?? []).filter((f) => !always.has(f))).toEqual([]);
  });

  it('an answer sends one of the two answers the API takes', () => {
    expect(doc.components.schemas.AnswerCalendarEntryDto.required).toEqual(['answer']);
    const answer = (literalsOf('calendar.ts', 'Answer') ?? []).filter((a) => a !== 'pending');
    expect([...answer].sort()).toEqual([...(doc.components.schemas.AnswerCalendarEntryDto.properties?.answer.enum ?? [])].sort());
  });

  it.each(CALENDAR_WRITES)('P12-T2 AC-5: the limits the entry dialog repeats are the ones %s validates', (dto) => {
    const fields = doc.components.schemas[dto].properties ?? {};
    expect(fields.title.maxLength).toBe(TITLE_MAX);
    expect(fields.notes.maxLength).toBe(NOTES_MAX);
    expect(fields.inviteeIds.maxItems).toBe(INVITEES_MAX);
  });

  /*
   * A trip's length is a rule between two fields, so no `maximum` carries it: the document says it in
   * `endsOn`'s description, written from the backend's own constant, and that sentence is read here.
   */
  it.each(CALENDAR_WRITES)('m3: TRIP_DAYS_MAX is the trip limit %s documents on endsOn', (dto) => {
    const description = doc.components.schemas[dto].properties?.endsOn?.description ?? '';
    const limit = /at most (\d+) days/.exec(description);
    expect(limit, description).not.toBeNull();
    expect(Number(limit![1])).toBe(TRIP_DAYS_MAX);
  });

  it('P13.1-T9: the Dashboard names its subject as the API does — `for`, never `membershipId`', () => {
    const params = (doc.paths['/api/v1/activity/dashboard'].get.parameters ?? []).filter((p) => p.in === 'query');
    expect(params.map((p) => p.name).sort()).toEqual(['for', 'from', 'range', 'to']);
    expect(params.find((p) => p.name === 'for')?.schema?.maxLength).toBe(64);
  });

  it('every query a calendar call sends is one the API documents, and the picker asks for no more than it serves', () => {
    const params = (path: string, verb: string) =>
      (doc.paths[`/api/v1${path}`][verb].parameters ?? []).filter((p) => p.in === 'query');
    expect(params('/calendar/entries', 'get').map((p) => p.name).sort()).toEqual(['date', 'for', 'view']);
    expect(params('/calendar/people', 'get').map((p) => p.name).sort()).toEqual(['cursor', 'limit', 'q']);
    expect(params('/calendar/entries/{entryId}', 'delete').map((p) => p.name)).toEqual(['version']);
    expect(params('/calendar/people', 'get').find((p) => p.name === 'limit')?.schema?.maximum).toBe(PEOPLE_PAGE);
  });

  it('every path the calendar calls exists in the document', () => {
    const paths = new Set(Object.keys(doc.paths).map((p) => p.replace('/api/v1', '')));
    const called = callsIn(readFileSync(join(__dirname, 'calendar.ts'), 'utf8'));
    expect(called.length).toBeGreaterThanOrEqual(8);
    expect(called.filter((p) => !matches(p, paths))).toEqual([]);
  });
});

/** Each field of one of our interfaces with how it is declared: `?`, `| null`, and its type's text. */
function declaredTypes(file: string, name: string): { name: string; optional: boolean; nullable: boolean; type: string }[] {
  const src = readFileSync(join(__dirname, file), 'utf8');
  const body = new RegExp(`export interface ${name} \\{([^}]*)\\}`, 's').exec(src);
  if (!body) throw new Error(`no interface ${name} in ${file}`);
  return [...body[1].matchAll(/^\s{2}(\w+)(\?)?:\s*([^;]+);/gm)].map((m) => {
    const parts = m[3].split('|').map((t) => t.trim());
    return {
      name: m[1],
      optional: m[2] === '?',
      nullable: parts.includes('null'),
      type: parts.filter((t) => t !== 'null').join(' | '),
    };
  });
}

/**
 * The string values a declared type allows: its own literals, or those of the `export type` alias it
 * names in the same file. `null` for anything else — `string`, a generic — which no list can check.
 */
function literalsOf(file: string, type: string): string[] | null {
  const literals = (text: string) => {
    const parts = text.split('|').map((t) => t.trim());
    return parts.every((t) => /^'[^']*'$/.test(t)) ? parts.map((t) => t.slice(1, -1)) : null;
  };
  const own = literals(type);
  if (own) return own;
  if (!/^\w+$/.test(type)) return null;
  const src = readFileSync(join(__dirname, file), 'utf8');
  const alias = new RegExp(`export type ${type} = ([^;]+);`).exec(src);
  return alias ? literals(alias[1]) : null;
}

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

/**
 * P13: the activation's shapes, held to their shape as the calendar's are: a field read as always there
 * is one the document requires, one it marks `nullable` is typed `| null`, and a field it lists values
 * for is typed with exactly those values.
 */
const ACTIVATION_PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['activation.ts', 'ActivationView', 'ActivationViewDto'],
  ['activation.ts', 'ActivationAspectProgress', 'ActivationAspectProgressDto'],
  ['activation.ts', 'ActivationItemProgress', 'ActivationItemProgressDto'],
  ['activation.ts', 'ActivationItemLink', 'ActivationLinkDto'],
  ['activation.ts', 'ActivationPerson', 'ActivationPersonDto'],
  ['activation.ts', 'ActivationCorrection', 'ActivationStartCorrectedDto'],
  ['activation.ts', 'ActivationNote', 'ActivationNoteDto'],
  ['activation.ts', 'ActivationNoteSaved', 'ActivationNoteSavedDto'],
  ['activation.ts', 'NewHiresRoster', 'NewHiresRosterDto'],
  ['activation.ts', 'NewHireGroup', 'NewHireGroupDto'],
  ['activation.ts', 'NewHireRow', 'NewHireRowDto'],
  ['session.ts', 'MeActivation', 'MeActivationDto'],
];

describe('the activation’s types match the API document (P13)', () => {
  it.each(ACTIVATION_PAIRS)('%s › %s ⊆ %s', (file, ours, theirs) => {
    const documented = new Set(propertiesOf(theirs));
    expect(declaredFields(file, ours).filter((f) => !documented.has(f))).toEqual([]);
  });

  it.each(ACTIVATION_PAIRS)('%s › %s is shaped as %s promises: required, nullable, its values', (file, ours, theirs) => {
    const schema = doc.components.schemas[theirs];
    const required = new Set(schema.required ?? []);
    const problems: string[] = [];
    for (const field of declaredTypes(file, ours)) {
      const prop = schema.properties?.[field.name] ?? {};
      if (!field.optional && !required.has(field.name)) problems.push(`${field.name}: declared always there, documented optional`);
      if (prop.nullable && !field.nullable) problems.push(`${field.name}: documented nullable, declared without | null`);
      const theirValues = (prop.enum ?? []).filter((v): v is string => typeof v === 'string');
      if (theirValues.length > 0) {
        const ourValues = literalsOf(file, field.type);
        if (ourValues === null) problems.push(`${field.name}: documented as values, declared as ${field.type}`);
        else if ([...ourValues].sort().join() !== [...theirValues].sort().join()) {
          problems.push(`${field.name}: ${[...ourValues].sort().join('|')} against ${[...theirValues].sort().join('|')}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the hire’s tick sends only what TickOwnActivationItemDto takes, and a leader’s only `done`', () => {
    const own = new Set(propertiesOf('TickOwnActivationItemDto'));
    expect(declaredFields('activation.ts', 'MyItemInput').filter((f) => !own.has(f))).toEqual([]);
    expect(propertiesOf('TickHireActivationItemDto')).toEqual(['done']);
  });

  it('the limits the screens repeat are the ones the API validates (invariant §7)', () => {
    expect(doc.components.schemas.TickOwnActivationItemDto.properties?.note.maxLength).toBe(ITEM_NOTE_MAX);
    expect(doc.components.schemas.SaveActivationNoteDto.properties?.text.maxLength).toBe(ACTIVATION_NOTE_MAX);
    const description = doc.components.schemas.CorrectActivationStartDto.properties?.startDate?.description ?? '';
    expect(Number(/at most (\d+) days/.exec(description)?.[1])).toBe(START_DATE_BACK_DAYS);
  });

  it('every path the activation calls exists in the document', () => {
    const paths = new Set(Object.keys(doc.paths).map((p) => p.replace('/api/v1', '')));
    const called = callsIn(readFileSync(join(__dirname, 'activation.ts'), 'utf8'));
    expect(called.length).toBe(8);
    expect(called.filter((p) => !matches(p, paths))).toEqual([]);
  });
});

/**
 * P18.5-T1 to T4: training's shapes, held to their shape as the activation's are — the learner's list and
 * module page, and the coaching *Training* tab, read these fields straight off the response.
 */
const TRAINING_PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['training.ts', 'TrainingProgressView', 'TrainingProgressDto'],
  ['training.ts', 'TrainingCategoryProgress', 'TrainingCategoryProgressDto'],
  ['training.ts', 'TrainingSkillProgress', 'TrainingSkillProgressDto'],
  ['training.ts', 'TrainingModuleRow', 'TrainingModuleRowDto'],
  ['training.ts', 'TrainingArchivedModuleRow', 'TrainingArchivedModuleDto'],
  ['training.ts', 'TrainingModulePage', 'TrainingModulePageDto'],
  ['training.ts', 'TrainingRef', 'TrainingPlaceDto'],
  ['training.ts', 'TrainingModuleCan', 'TrainingModuleCanDto'],
  ['training.ts', 'TrainingItemView', 'TrainingItemDto'],
  ['training.ts', 'TrainingOpenAnswer', 'TrainingOpenDto'],
];

describe('training’s types match the API document (P18.5-T1 to T4)', () => {
  it.each(TRAINING_PAIRS)('%s › %s ⊆ %s', (file, ours, theirs) => {
    const documented = new Set(propertiesOf(theirs));
    expect(declaredFields(file, ours).filter((f) => !documented.has(f))).toEqual([]);
  });

  it.each(TRAINING_PAIRS)('%s › %s is shaped as %s promises: required, nullable, its values', (file, ours, theirs) => {
    const schema = doc.components.schemas[theirs];
    const required = new Set(schema.required ?? []);
    const problems: string[] = [];
    for (const field of declaredTypes(file, ours)) {
      const prop = schema.properties?.[field.name] ?? {};
      if (!field.optional && !required.has(field.name)) problems.push(`${field.name}: declared always there, documented optional`);
      if (prop.nullable && !field.nullable) problems.push(`${field.name}: documented nullable, declared without | null`);
      const theirValues = (prop.enum ?? []).filter((v): v is string => typeof v === 'string');
      if (theirValues.length > 0) {
        const ourValues = literalsOf(file, field.type);
        if (ourValues === null) problems.push(`${field.name}: documented as values, declared as ${field.type}`);
        else if ([...ourValues].sort().join() !== [...theirValues].sort().join()) {
          problems.push(`${field.name}: ${[...ourValues].sort().join('|')} against ${[...theirValues].sort().join('|')}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the status write sends only what SetTrainingStatusDto takes, with its values', () => {
    expect(propertiesOf('SetTrainingStatusDto')).toEqual(['status']);
    const values = (doc.components.schemas.SetTrainingStatusDto.properties?.status.enum ?? []) as string[];
    expect([...values].sort()).toEqual([...(literalsOf('training.ts', 'TrainingStatus') ?? [])].sort());
  });

  it('every route the training client calls is in the document, with its method', async () => {
    const { vi } = await import('vitest');
    const training = await import('./training');
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      sent.push(`${(init.method ?? 'GET').toLowerCase()} ${new URL(url).pathname.replace('/api/v1', '')}`);
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }));
    try {
      await training.readTrainingProgress();
      await training.readCoacheeTraining('m1');
      await training.readTrainingModule('MOD');
      await training.openTrainingItem('MOD', 'it1');
      await training.setTrainingStatus('MOD', 'done');
    } finally {
      vi.unstubAllGlobals();
    }

    expect(sent).toHaveLength(5);
    const routes = Object.entries(doc.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => ({ method, path: path.replace('/api/v1', '') })));
    const unknown = sent.filter((call) => {
      const [method, path] = call.split(' ');
      const asCalled = path.split('/').map((seg) => (['m1', 'MOD', 'it1'].includes(seg) ? '*' : seg)).join('/');
      return !routes.some((r) => r.method === method && matches(asCalled, new Set([r.path])));
    });
    expect(unknown).toEqual([]);
  });
});

/**
 * P18.5-T7 to T9: campaigns' shapes — the list, the dialog and its progress, the chases on the Summary and the
 * coachee's card, the Unit Dashboard's *Chasing MDRT* and chips, the Owner's form's fields and the registry's
 * `campaign` flag — held to their shape as training's are. `CampaignDetail` extends `CampaignCard`, which
 * `declaredFields` cannot follow: its own fields are held in the last test.
 */
const CAMPAIGN_PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['campaigns.ts', 'CampaignPoster', 'AgentCampaignPosterDto'],
  ['campaigns.ts', 'CampaignRequirement', 'AgentCampaignRequirementDto'],
  ['campaigns.ts', 'CampaignCard', 'CampaignCardDto'],
  ['campaigns.ts', 'CampaignCan', 'CampaignCanDto'],
  ['campaigns.ts', 'CampaignList', 'CampaignListDto'],
  ['campaigns.ts', 'ProgressRow', 'CampaignProgressRowDto'],
  ['campaigns.ts', 'CampaignProgress', 'CampaignProgressDto'],
  ['campaigns.ts', 'ChasedCampaign', 'ChasedCampaignDto'],
  ['campaigns.ts', 'ChasingList', 'ChasingDto'],
  ['tenant-config.ts', 'CampaignRow', 'CampaignDto'],
  ['tenant-config.ts', 'CampaignRowPoster', 'CampaignPosterDto'],
  ['tenant-config.ts', 'MetricDefinition', 'MetricDefinitionDto'],
  ['unit-dashboard.ts', 'ChasedRef', 'UnitChasedCampaignDto'],
  ['unit-dashboard.ts', 'MdrtHeader', 'UnitMdrtDto'],
];

describe('campaigns’ types match the API document (P18.5-T7 to T9)', () => {
  it.each(CAMPAIGN_PAIRS)('%s › %s ⊆ %s', (file, ours, theirs) => {
    const documented = new Set(propertiesOf(theirs));
    expect(declaredFields(file, ours).filter((f) => !documented.has(f))).toEqual([]);
  });

  it.each(CAMPAIGN_PAIRS)('%s › %s is shaped as %s promises: required, nullable, and the values it names', (file, ours, theirs) => {
    const schema = doc.components.schemas[theirs];
    const required = new Set(schema.required ?? []);
    const problems: string[] = [];
    for (const field of declaredTypes(file, ours)) {
      const prop = schema.properties?.[field.name] ?? {};
      if (!field.optional && !required.has(field.name)) problems.push(`${field.name}: declared always there, documented optional`);
      if (prop.nullable && !field.nullable) problems.push(`${field.name}: documented nullable, declared without | null`);
      // Where we name the values (a kind, a phase, a state, a palette), they are the document's; a unit or a
      // comparator we read as text is printed, not branched on.
      const theirValues = (prop.enum ?? []).filter((v): v is string => typeof v === 'string');
      const ourValues = literalsOf(file, field.type);
      if (theirValues.length > 0 && ourValues !== null && [...ourValues].sort().join() !== [...theirValues].sort().join()) {
        problems.push(`${field.name}: ${[...ourValues].sort().join('|')} against ${[...theirValues].sort().join('|')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('the Unit Dashboard’s row and view carry the chases and the MDRT header', () => {
    expect(propertiesOf('UnitRowDto')).toEqual(expect.arrayContaining(['chasingMdrt', 'campaigns']));
    expect(propertiesOf('UnitDashboardDto')).toContain('mdrt');
  });

  it('CampaignDetail’s own fields are documented on CampaignDetailDto, and the card’s it extends', () => {
    const documented = new Set(propertiesOf('CampaignDetailDto'));
    expect(['description', 'can', 'progress'].filter((f) => !documented.has(f))).toEqual([]);
    expect(declaredFields('campaigns.ts', 'CampaignCard').filter((f) => !documented.has(f))).toEqual([]);
  });

  it('every route the campaigns client calls is in the document, with its method', async () => {
    const { vi } = await import('vitest');
    const campaigns = await import('./campaigns');
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      sent.push(`${(init.method ?? 'GET').toLowerCase()} ${new URL(url).pathname.replace('/api/v1', '')}`);
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }));
    try {
      await campaigns.readCampaigns();
      await campaigns.readCampaign('CODE');
      await campaigns.chaseCampaign('CODE');
      await campaigns.unchaseCampaign('CODE');
      await campaigns.readChasing();
      await campaigns.readChasing('m1');
    } finally {
      vi.unstubAllGlobals();
    }

    expect(sent).toHaveLength(6);
    const routes = Object.entries(doc.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => ({ method, path: path.replace('/api/v1', '') })));
    const unknown = sent.filter((call) => {
      const [method, path] = call.split(' ');
      const asCalled = path.split('/').map((seg) => (['CODE', 'm1'].includes(seg) ? '*' : seg)).join('/');
      return !routes.some((r) => r.method === method && matches(asCalled, new Set([r.path])));
    });
    expect(unknown).toEqual([]);
  });
});

/**
 * P13.2-T2: the quote tool's one read, held to its shape as the activation's are. The screen prices
 * every figure from these fields, so one renamed on the server would price nothing in the browser.
 */
const BILLING_PAIRS: ReadonlyArray<[file: string, ours: string, theirs: string]> = [
  ['billing.ts', 'BillingPrices', 'BillingPricesDto'],
  ['billing.ts', 'BillingTier', 'BillingTierDto'],
];

describe('the quote tool’s types match the API document (P13.2-T2)', () => {
  it.each(BILLING_PAIRS)('%s › %s ⊆ %s', (file, ours, theirs) => {
    const documented = new Set(propertiesOf(theirs));
    expect(declaredFields(file, ours).filter((f) => !documented.has(f))).toEqual([]);
  });

  it.each(BILLING_PAIRS)('%s › %s is shaped as %s promises: required, nullable, its values', (file, ours, theirs) => {
    const schema = doc.components.schemas[theirs];
    const required = new Set(schema.required ?? []);
    const problems: string[] = [];
    for (const field of declaredTypes(file, ours)) {
      const prop = schema.properties?.[field.name] ?? {};
      if (!field.optional && !required.has(field.name)) problems.push(`${field.name}: declared always there, documented optional`);
      if (prop.nullable && !field.nullable) problems.push(`${field.name}: documented nullable, declared without | null`);
      const theirValues = (prop.enum ?? []).filter((v): v is string => typeof v === 'string');
      if (theirValues.length > 0 && [...(literalsOf(file, field.type) ?? [])].sort().join() !== [...theirValues].sort().join()) {
        problems.push(`${field.name}: ${field.type} against ${theirValues.join('|')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('the screen’s only call is the prices read, and it exists in the document (ADR-0111 §2)', () => {
    const paths = new Set(Object.keys(doc.paths).map((p) => p.replace('/api/v1', '')));
    const called = callsIn(readFileSync(join(__dirname, 'billing.ts'), 'utf8'));
    expect(called).toEqual(['/admin/billing/prices']);
    expect(called.filter((p) => !matches(p, paths))).toEqual([]);
    expect(Object.keys(doc.paths['/api/v1/admin/billing/prices'])).toEqual(['get']);
  });
});

/**
 * P18.1-T2, P18.1-T3: **the forum's routes**, read off the client as it calls them — each call made against a
 * stubbed `fetch`, its method and path recorded — so the path is the one the browser sends, with its ids and
 * its query filled in, which reading the source for string literals would not show. Each must be a route of
 * the document with that method. And `MeetingView`'s own fields, which the pairs above cannot reach through `extends`.
 */
describe('the forum’s routes match the API document (P18.1-T2, P18.1-T3)', () => {
  it('every route the forum’s client calls is in the document, with its method', async () => {
    const { vi } = await import('vitest');
    const forum = await import('./leader-meetings');
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      sent.push(`${(init.method ?? 'GET').toLowerCase()} ${new URL(url).pathname.replace('/api/v1', '')}`);
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }));
    try {
      await forum.readMeetings();
      await forum.createMeeting({ title: 't', date: '2026-10-13' });
      await forum.readMeeting('m1');
      await forum.rescheduleMeeting('m1', { date: '2026-10-20', version: 1 });
      await forum.deleteMeeting('m1', 1);
      await forum.addAgendaItem('m1', 'during');
      await forum.saveAgendaItem('m1', 'a1', { text: 'x', version: 1 });
      await forum.addActionItem('m1');
      await forum.saveActionItem('m1', 'x1', { status: 'planned', version: 1 });
      await forum.removeActionItem('m1', 'x1', 1);
      await forum.reorderActionItems('m1', ['x1']);
      await forum.saveMonthlyTarget('m1', 'ape', { value: 'TBD', version: 0 });
      await forum.createShareLink('m1');
      await forum.revokeShareLinks('m1');
      await forum.readSharedMeeting('tok');
    } finally {
      vi.unstubAllGlobals();
    }

    expect(sent).toHaveLength(15);
    const routes = Object.entries(doc.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => ({ method, path: path.replace('/api/v1', '') })));
    const unknown = sent.filter((call) => {
      const [method, path] = call.split(' ');
      const asCalled = path.split('/').map((seg) => (['m1', 'a1', 'x1', 'tok', 'ape'].includes(seg) ? '*' : seg)).join('/');
      return !routes.some((r) => r.method === method && matches(asCalled, new Set([r.path])));
    });
    expect(unknown).toEqual([]);
  });

  it('MeetingView’s own fields are documented on MeetingViewDto', () => {
    const own = ['version', 'branch', 'scorecard', 'agenda', 'actionItems', 'writtenIn', 'via', 'accessNote', 'can', 'limits'];
    const documented = new Set(propertiesOf('MeetingViewDto'));
    expect(own.filter((f) => !documented.has(f))).toEqual([]);
    // And the card's, which it extends.
    expect(declaredFields('leader-meetings.ts', 'MeetingCard').filter((f) => !documented.has(f))).toEqual([]);
  });
});
