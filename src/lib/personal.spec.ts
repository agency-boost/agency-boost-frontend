import { describe, expect, it } from 'vitest';
import { GENDER_LABEL, NOT_RECORDED, personalLines, WORK_STATUS_LABEL } from './personal';

/** P18.8-T4 AC-6: the four as a screen prints them, *Not recorded* when absent (ADR-0158 §3). */
describe('personalLines', () => {
  it('prints each of the four in words', () => {
    expect(personalLines({
      dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: '2021-07', workStatus: 'part_time',
    })).toEqual({
      dateOfBirth: 'March 15, 1990', gender: 'Female', companyJoinMonth: 'July 2021', workStatus: 'Part-time',
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
