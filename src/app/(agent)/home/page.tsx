'use client';

import { HomeScreen } from '@/components/home/home-screen';

/**
 * **`/home`** (UI V1, 2026-10-30, Phase 18.99 T11; UI-100, UI-101; ADR-0180 §10): Home, where every field member lands
 * after signing in and from `/`, and the centre tab of the phone's and the tablet's bar. No gate of its own: the
 * field shell's, as `/summary`'s — the API answers the reader's own (`GET /home`, `personal_summary:read`).
 */
export default function HomePage() {
  return <HomeScreen />;
}
