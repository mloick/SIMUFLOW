import { describe, expect, it } from '@jest/globals';

import { addWorkingDays, easterSunday, isWorkingDay, workingDaysBetween } from '../calendar';

/** Date locale lisible : d(2026, 10, 30, 14) = vendredi 30 octobre 2026 à 14 h. */
const d = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);

describe('calendrier des jours ouvrés', () => {
  it('calcule Pâques', () => {
    expect(easterSunday(2026)).toEqual(d(2026, 4, 5));
    expect(easterSunday(2027)).toEqual(d(2027, 3, 28));
  });

  it('écarte week-ends et jours fériés, y compris ceux qui dépendent de Pâques', () => {
    expect(isWorkingDay(d(2026, 10, 30))).toBe(true); // vendredi
    expect(isWorkingDay(d(2026, 10, 31))).toBe(false); // samedi
    expect(isWorkingDay(d(2026, 11, 11))).toBe(false); // Armistice
    expect(isWorkingDay(d(2026, 5, 14))).toBe(false); // Ascension 2026
    expect(isWorkingDay(d(2026, 5, 25))).toBe(false); // lundi de Pentecôte 2026
    expect(isWorkingDay(d(2026, 4, 6))).toBe(false); // lundi de Pâques 2026
  });

  it('ajoute des jours ouvrés en sautant le week-end', () => {
    expect(addWorkingDays(d(2026, 10, 30, 14), 1)).toEqual(d(2026, 11, 2, 14));
  });

  it('saute un jour férié', () => {
    expect(addWorkingDays(d(2026, 11, 10, 10), 1)).toEqual(d(2026, 11, 12, 10));
  });

  it('compte les demi-journées en heures de travail (9 h – 17 h)', () => {
    expect(addWorkingDays(d(2026, 10, 31, 11), 0.5)).toEqual(d(2026, 11, 2, 13)); // samedi → lundi 9 h + 4 h
    expect(addWorkingDays(d(2026, 11, 4, 17, 30), 0.25)).toEqual(d(2026, 11, 5, 11)); // après 17 h → lendemain
    expect(addWorkingDays(d(2026, 11, 4, 15), 0.5)).toEqual(d(2026, 11, 5, 11)); // 2 h ce jour, 2 h le lendemain
  });

  it('mesure le temps de travail écoulé entre deux moments', () => {
    expect(workingDaysBetween(d(2026, 10, 30, 14), d(2026, 11, 2, 14))).toBe(1);
    expect(workingDaysBetween(d(2026, 11, 2, 14), d(2026, 10, 30, 14))).toBe(-1);
    expect(workingDaysBetween(d(2026, 11, 2, 9), d(2026, 11, 2, 13))).toBe(0.5);
  });
});
