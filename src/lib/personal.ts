import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { personalMessages } from '@/i18n/messages/personal';
import { formatCalendarDay, formatMonth } from './format';

/**
 * What a person records (ADR-0158, P18.8-T4): a birth date, a gender, the month they joined their
 * insurer, and how they work in their office.
 *
 * **The words, not the rules.** Whether a birth date is 18 years ago or a join month still to come is the
 * server's to decide (`POST /auth/register`, `PATCH /auth/me`), and its sentence is what a screen shows;
 * nothing here re-declares the age or the codes' meaning beyond the label each is printed with.
 *
 * **Its words are the catalogue's** (`i18n/messages/personal.ts`, P18.98-T4): each function takes the reader's
 * `language` — English, the source, when passed none — and `personalLines` the figures' after it, Indonesian when passed
 * none. A screen passes `useLanguage()` and `useFigureLanguage()`.
 */
export type Gender = 'male' | 'female';
export type WorkStatus = 'full_time' | 'part_time';

/** The labels in a language: the gender's, *Male* · *Laki-laki*. */
export const genderLabels = (language: Language = SOURCE_LANGUAGE): Record<Gender, string> =>
  messagesIn(personalMessages, language).gender;

/** The labels in a language: the work status's, *Part-time* · *Paruh waktu*. */
export const workStatusLabels = (language: Language = SOURCE_LANGUAGE): Record<WorkStatus, string> =>
  messagesIn(personalMessages, language).workStatus;

/** The catalogue's English labels, as the specs read them. A screen asks `genderLabels(language)`. */
export const GENDER_LABEL: Record<Gender, string> = genderLabels();
export const WORK_STATUS_LABEL: Record<WorkStatus, string> = workStatusLabels();

/** The four as the API serves them: `null` is *Not recorded* — somebody who arrived before they were asked. */
export interface PersonalDetails {
  dateOfBirth: string | null;
  gender: Gender | null;
  companyJoinMonth: string | null;
  workStatus: WorkStatus | null;
}

/** *Not recorded* in a language; `NOT_RECORDED` is the English. */
export const notRecorded = (language: Language = SOURCE_LANGUAGE): string => messagesIn(personalMessages, language).notRecorded;
export const NOT_RECORDED = notRecorded();

/**
 * Each of the four as a person page or `/profile` prints it, *Not recorded* when absent: the words in `language`, the
 * birth date and the join month in `figures`.
 */
export function personalLines(
  personal: Partial<PersonalDetails> | null | undefined, language: Language = SOURCE_LANGUAGE, figures?: Language,
): {
  dateOfBirth: string; gender: string; companyJoinMonth: string; workStatus: string;
} {
  const none = notRecorded(language);
  return {
    dateOfBirth: personal?.dateOfBirth ? formatCalendarDay(personal.dateOfBirth, figures) : none,
    gender: personal?.gender ? genderLabels(language)[personal.gender] : none,
    companyJoinMonth: personal?.companyJoinMonth ? formatMonth(personal.companyJoinMonth, figures) : none,
    workStatus: personal?.workStatus ? workStatusLabels(language)[personal.workStatus] : none,
  };
}
