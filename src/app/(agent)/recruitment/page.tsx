'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { recruitmentPlanMessages } from '@/i18n/messages/recruitment-plan';
import { ATTACK_PLAN_HREF } from '@/lib/recruitment';

/**
 * `/recruitment` hands off to `/recruitment/attack-plan`, the first tab (D-urls), as `/activity` hands
 * off to the log. The sidebar's *Recruitment* points straight at the tab, so this answers a typed or
 * remembered address.
 *
 * A client-side `replace` from inside the layouts, so the sidebar, the title and the tabs stay mounted and
 * nothing blinks; `replace`, not `push`, so Back from the tab does not land on a page whose only act is to
 * leave again. A skeleton rather than content: the title above is the layout's, and two screens claiming
 * to be the plan would mean the one you saw depended on how fast the redirect ran.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint.
 */
export default function RecruitmentIndex() {
  const t = useMessages(recruitmentPlanMessages);
  const router = useRouter();

  useEffect(() => {
    router.replace(ATTACK_PLAN_HREF);
  }, [router]);

  return (
    <Skeleton label={t.redirecting}>
      <div className="rounded-lg border border-card-edge bg-card p-4">
        <SkeletonText lines={5} />
      </div>
    </Skeleton>
  );
}
