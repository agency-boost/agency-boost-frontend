import { describe, expect, it } from 'vitest';
import {
  GENDER_LABEL, genderLabels, NOT_RECORDED, notRecorded, personalLines, WORK_STATUS_LABEL, workStatusLabels,
} from './personal';

/** P18.8-T4 AC-6: the four as a screen prints them, *Not recorded* when absent (ADR-0158 §3). */
describe('personalLines', () => {
  it('prints each of the four in words', () => {
    expect(personalLines({
      dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: '2021-07', workStatus: 'part_time',
    })).toEqual({
      dateOfBirth: '15 Mar 1990', gender: 'Female', companyJoinMonth: 'Jul 2021', workStatus: 'Part-time',
    });
  });

  it('says Not recorded for each one somebody has not given, and for a read that carries none', () => {
    const none = { dateOfBirth: NOT_RECORDED, gender: NOT_RECORDED, companyJoinMonth: NOT_RECORDED, workStatus: NOT_RECORDED };
    expect(personalLines({ dateOfBirth: null, gender: null, companyJoinMonth: null, workStatus: null })).toEqual(none);
    expect(personalLines(undefined)).toEqual(none);
    expect(NOT_RECORDED).toBe('Not recorded');
  });

  it('labels the codes the way the screens ask them', () => {
    expect(GENDER_LABEL).toEqual({ male: 'Male', female: 'Female' });
    expect(WORK_STATUS_LABEL).toEqual({ full_time: 'Full-time', part_time: 'Part-time' });
  });
});

/**
 * **P18.98-T4 (coaching and unit): the four in Indonesian.** The words in the reader's language — English when passed
 * none, every case above — and the birth date and the join month in the figures' (Indonesian when passed none).
 */
describe('P18.98-T4 personalLines in Indonesian', () => {
  it('labels the codes in Indonesian, and says Belum dicatat for each one not given', () => {
    expect(personalLines({
      dateOfBirth: '1990-10-15', gender: 'female', companyJoinMonth: '2021-08', workStatus: 'part_time',
    }, 'id', 'id')).toEqual({
      dateOfBirth: '15 Okt 1990', gender: 'Perempuan', companyJoinMonth: 'Agu 2021', workStatus: 'Paruh waktu',
    });
    expect(personalLines(undefined, 'id')).toEqual({
      dateOfBirth: 'Belum dicatat', gender: 'Belum dicatat', companyJoinMonth: 'Belum dicatat', workStatus: 'Belum dicatat',
    });
    expect(genderLabels('id')).toEqual({ male: 'Laki-laki', female: 'Perempuan' });
    expect(workStatusLabels('id')).toEqual({ full_time: 'Penuh waktu', part_time: 'Paruh waktu' });
    expect(notRecorded('id')).toBe('Belum dicatat');
  });

  it('writes the words and the figures each in their own language', () => {
    const personal = { dateOfBirth: '1990-10-15', gender: 'male' as const, companyJoinMonth: '2021-08', workStatus: 'full_time' as const };
    // A reader with no choice: English words, Indonesian figures (P18.98-T3).
    expect(personalLines(personal)).toEqual({
      dateOfBirth: '15 Okt 1990', gender: 'Male', companyJoinMonth: 'Agu 2021', workStatus: 'Full-time',
    });
    expect(personalLines(personal, 'en', 'en')).toEqual({
      dateOfBirth: '15 Oct 1990', gender: 'Male', companyJoinMonth: 'Aug 2021', workStatus: 'Full-time',
    });
  });
});
