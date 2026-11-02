'use client';

import { messagesIn } from '@/i18n/catalogue';
import { useLanguage } from '@/i18n/language-provider';
import { uiMessages } from '@/i18n/messages/ui';

/**
 * **A skeleton's label in the reader's language** (P18.98-T4, the shared pieces; the glossary's §B.2 *Loading…*,
 * *Loading {the thing}…*): what a `Skeleton` says to a screen reader where its caller names nothing of its own — a
 * route's `loading.tsx`, the session's wait, `SkeletonPeople`, `SkeletonTree` — and `SkeletonTable`'s *Loading {its
 * caption}…*. A client component of its own, because `skeleton.tsx` is drawn by the route groups' `loading.tsx`, which
 * are server components and read no hook.
 */
export function LoadingWords({ kind = 'any', caption }: { kind?: 'any' | 'people' | 'tree'; caption?: string }) {
  const t = messagesIn(uiMessages, useLanguage()).loading;
  return <>{caption === undefined ? t[kind] : t.table({ caption })}</>;
}
