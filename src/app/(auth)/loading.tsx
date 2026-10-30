import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';

/**
 * The auth group has no chrome to preserve, so its boundary stands in for the whole
 * screen: the heading, then the card. Same `max-w-md` centred column every page in the
 * group uses, so the real form lands where the placeholder was.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <Skeleton>
        <SkeletonBar className="h-8 w-3/4" />
        <div className="mt-6 rounded-lg border border-card-edge bg-card p-5">
          <SkeletonText lines={4} />
          <SkeletonBar className="mt-6 h-9 w-full" />
        </div>
      </Skeleton>
    </main>
  );
}
