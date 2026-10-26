import { formatCalendarDay, formatMonth } from './format';

/**
 * What a person records (ADR-0158, P18.8-T4): a birth date, a gender, the month they joined their
 * insurer, and how they work in their office.
 *
 * **The words, not the rules.** Whether a birth date is 18 years ago or a join month still to come is the
 * server's to decide (`POST /auth/register`, `PATCH /auth/me`), and its sentence is what a screen shows;
 * nothing here re-declares the age or the codes' meaning beyond the label each is printed with.
 */
export type Gender = 'male' | 'female';
export type WorkStatus = 'full_time' | 'part_time';

export const GENDER_LABEL: Record<Gender, string> = { male: 'Male', female: 'Female' };
export const WORK_STATUS_LABEL: Record<WorkStatus, string> = { full_time: 'Full-time', part_time: 'Part-time' };

/** The four as the API serves them: `null` is *Not recorded* — somebody who arrived before they were asked. */
export interface PersonalDetails {
  dateOfBirth: string | null;
  gender: Gender | null;
  companyJoinMonth: string | null;
  workStatus: WorkStatus | null;
}

export const NOT_RECORDED = 'Not recorded';

/** Each of the four as a person page or `/profile` prints it, *Not recorded* when absent. */
export function personalLines(personal: Partial<PersonalDetails> | null | undefined): {
  dateOfBirth: string; gender: string; companyJoinMonth: string; workStatus: string;
} {
  return {
    dateOfBirth: personal?.dateOfBirth ? formatCalendarDay(personal.dateOfBirth) : NOT_RECORDED,
    gender: personal?.gender ? GENDER_LABEL[personal.gender] : NOT_RECORDED,
    companyJoinMonth: personal?.companyJoinMonth ? formatMonth(personal.companyJoinMonth) : NOT_RECORDED,
    workStatus: personal?.workStatus ? WORK_STATUS_LABEL[personal.workStatus] : NOT_RECORDED,
  };
}
