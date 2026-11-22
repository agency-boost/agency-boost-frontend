'use client';

import { use } from 'react';
import { MembersScreen } from '../members-screen';

/**
 * **A member, as All members with their sheet open** (P19.20-T2 AC-1; ADR-0273 §1): `/people/members/[membershipId]` was
 * a page of its own (ADR-0248 §1); the member sheet replaced it, and this address stays so every link other pages made —
 * the KPM Overview, Compliance, a leader's Group Tree for the office — still lands on that person. Closing the sheet
 * leaves the address for `/people/members`. A member the reader may not open answers `404` in the sheet, as before.
 */
export default function MemberPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  return <MembersScreen key={membershipId} openMemberId={membershipId} />;
}
