import { api } from './api-client';

/*
 * **The reader's calendar settings, apart from the calendar** (the bundle, 2026-11-06; `performance-and-scale.md`):
 * *Profil saya* reads and saves this one setting and draws nothing of the calendar, whose client and words it loaded with
 * it from `calendar.ts`, which re-exports these.
 */

/**
 * `GET` and `PUT /calendar/settings`: the reader's own (ADR-0110). *Hide my personal activities*: on, a
 * leader comparing the reader's week is answered each entry the reader organised as a busy block, unless
 * that leader is on it. Off until the reader turns it on.
 */
export interface CalendarSettings {
  hideDetails: boolean;
}

/** The reader's own calendar settings. Nobody reads anybody else's. */
export const readCalendarSettings = () => api<CalendarSettings>('/calendar/settings');

/** *Hide my personal activities*, sent whole; the answer is the setting as it is now stored. */
export const saveCalendarSettings = (settings: CalendarSettings) =>
  api<CalendarSettings>('/calendar/settings', { method: 'PUT', body: settings });
