import type { Language } from '@/i18n/language';
import { formatMonth } from '@/lib/format';

/**
 * `2026-09` → `Sep 2026` — the shared formatter, under the name this screen has always used; `Okt 2026` or `Oct 2026`
 * in the figures' language (P18.98-T3), which its caller passes (`useFigureLanguage()`). A figure, not a word: the
 * sentences around it are the catalogue's, each language choosing its own plural (P18.98-T4; `dataUploadMessages`).
 */
export const monthLabel = (month: string, figures: Language) => formatMonth(month, figures);
