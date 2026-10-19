'use client';

import { CoacheeActivation } from '@/components/activation-record';

/**
 * A coachee's *Activation* tab (`Overall.html:4337-4342`, renderer `:6464-6489`; P13-T9): their whole
 * checklist, read-only, from the read their leader's detail makes, so the coach, the hire and every
 * leader above them read the same progress (exit criterion 2). The person shell above has already
 * answered an address outside the reader's reach; somebody with no activation opens on an empty state.
 */
export default function CoacheeActivationTab() {
  return <CoacheeActivation />;
}
