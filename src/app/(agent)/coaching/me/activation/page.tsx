'use client';

import { MyActivationRecord } from '@/components/activation-record';
import { MyCoachingHeader } from '@/components/coaching-record';
import { Page } from '@/components/page';

/**
 * The reader's own *Activation* tab on their coaching (`/coaching/me/activation`, `Overall.html:4574-4577`;
 * P13-T9 AC-4, D-coaching-me): their checklist in the coaching renderer's form, read-only, from the read
 * their own `/activation` makes — and still there once the activation is graduated or over, when
 * `/activation` is no longer offered. Titled and gated as `/coaching/me` is.
 */
export default function MyCoachingActivationPage() {
  return (
    <Page title="Coaching Session" permission="coaching_session:read">
      <MyCoachingHeader current="activation" />
      <MyActivationRecord />
    </Page>
  );
}
