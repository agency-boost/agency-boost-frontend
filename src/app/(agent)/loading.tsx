import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * Shown while a route in this group is being fetched.
 *
 * It replaces only the content area — the group's `layout.tsx` stays mounted, so the
 * sidebar and the identity chip never blink. Without a boundary Next holds the previous
 * screen on display until the next one's payload arrives and *then* mounts it with every
 * state null, which is two waits with the first one completely silent.
 */
export default function Loading() {
  return <PageSkeleton />;
}
