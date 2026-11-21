'use client';

import { MembersScreen } from './members-screen';

/** **All members** (P19.20-T1; ADR-0273 §2): the screen, no sheet open (`?member=` opens one). */
export default function MembersPage() {
  return <MembersScreen />;
}
