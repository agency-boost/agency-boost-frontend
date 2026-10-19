'use client';

import { use } from 'react';
import { briefFromQuery } from '@/lib/recruitment';
import { RecruitmentPlanScreen } from './recruitment-plan-screen';

type Query = Record<string, string | string[] | undefined>;

/**
 * **Recruitment › Attack Plan** (`/recruitment/attack-plan`; `AgencyBoost_Recruitment_Section.html:288-353`,
 * logic `:512-621`; P17-T3).
 *
 * **The address** (D-urls): `?type=&motivation=&hesitation=` is the plan for that brief, the last two
 * comma-separated codes; anything else — nothing, or a brief missing one of the three — is the brief with
 * nothing chosen, never an error page (AC-5). The title, the tabs and the `recruitment:read` gate are the
 * layout's.
 */
export default function RecruitmentAttackPlanPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = searchParams ? use(searchParams) : {};
  const brief = briefFromQuery(query);
  return <RecruitmentPlanScreen address={brief ? { kind: 'plan', brief } : { kind: 'brief' }} />;
}
