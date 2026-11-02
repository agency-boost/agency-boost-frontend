'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

/** An address's query as a page reads it: a name's one value, or every value of a name the address repeats. */
export type Query = Record<string, string | string[] | undefined>;

/**
 * The query in the shape the App Router's `searchParams` page prop had, so each page's parser reads it unchanged:
 * a name given once is its string, a name repeated is its values in order, and `null` (no router mounted) is no
 * query at all. No prototype either, so `?constructor=` is a name like any other.
 */
export function queryOf(params: Pick<URLSearchParams, 'forEach'> | null): Query {
  const query: Query = Object.create(null);
  params?.forEach((value, name) => {
    const held = query[name];
    query[name] = held === undefined ? value : Array.isArray(held) ? [...held, value] : [held, value];
  });
  return query;
}

/**
 * **A client page reads its query here, never from the `searchParams` prop** (found walking a production build,
 * 2026-10-27). `next build` prerenders a static client page with an empty query, and the prop stays empty after
 * hydration: `/calendar?view=month` opened on Week and `/summary?month=2026-08` read this month. A dev server
 * renders on demand, so neither a walk on one nor a spec that passes the prop could see it.
 *
 * `useSearchParams` needs a `<Suspense>` boundary on a prerendered page; the page puts one around whatever calls
 * this. `src/app/query-string.spec.ts` fails a client page that declares the prop.
 */
export function useQuery(): Query {
  const params = useSearchParams();
  return useMemo(() => queryOf(params), [params]);
}
