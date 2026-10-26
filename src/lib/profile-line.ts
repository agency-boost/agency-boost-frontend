import type { Me } from './session';

/** The words the profile line says for a Core Leader (ADR-0159 §5), as the directory's chip says them. */
export const CORE_LEADER_LABEL = 'Core Leader';

/**
 * **The sidebar's profile line** (ADR-0159 §5, P18.8-T6 AC-2): under the name, one line — the role · *Core Leader*
 * when it applies · the person's live tag groups, comma-joined, when they have any · the office as *{code} ·
 * {branch}* — `KPM Owner · 0417 · Cempaka Putih`, `AB · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih`.
 *
 * Built from what `GET /auth/me` already carries (`membership.isCoreLeader`, `groups`, `office`), so no screen reads
 * anything for it. A part the session does not carry is left out rather than drawn empty, so a session in no office
 * says the role alone, and the platform shell, which passes no membership, says the role alone too. It decides
 * nothing anybody may do.
 */
export function profileLine(role: string, membership: Me['membership'] | null | undefined): string {
  const groups = membership?.groups?.filter((name) => name.trim() !== '') ?? [];
  const office = membership?.office;
  return [
    role,
    membership?.isCoreLeader ? CORE_LEADER_LABEL : null,
    groups.length > 0 ? groups.join(', ') : null,
    office ? [office.code, office.branch].filter((part) => part !== '').join(' · ') : null,
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
}
