/**
 * Calendrier des jours ouvrés en France : du lundi au vendredi, sans les onze
 * jours fériés (dont Pâques, l'Ascension et la Pentecôte, qui changent chaque
 * année). Une journée de travail va de 9 h à 17 h : un délai de 0,5 jour ouvré
 * fait 4 heures de travail.
 *
 * Fonctions pures, en heure locale du téléphone, testées dans
 * __tests__/calendar.test.ts.
 */

export const WORKDAY_START_HOUR = 9;
export const WORKDAY_HOURS = 8;
const WORKDAY_END_HOUR = WORKDAY_START_HOUR + WORKDAY_HOURS;
const HOUR = 60 * 60 * 1000;

/** Dimanche de Pâques (calcul grégorien, dit « de Meeus »). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const key = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const shift = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const holidayCache = new Map<number, Set<string>>();

/** Les onze jours fériés de l'année (métropole). */
export function frenchHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  return [
    new Date(year, 0, 1), // Jour de l'an
    shift(easter, 1), // Lundi de Pâques
    new Date(year, 4, 1), // Fête du travail
    new Date(year, 4, 8), // Victoire 1945
    shift(easter, 39), // Ascension
    shift(easter, 50), // Lundi de Pentecôte
    new Date(year, 6, 14), // Fête nationale
    new Date(year, 7, 15), // Assomption
    new Date(year, 10, 1), // Toussaint
    new Date(year, 10, 11), // Armistice
    new Date(year, 11, 25), // Noël
  ];
}

export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  let days = holidayCache.get(year);
  if (!days) {
    days = new Set(frenchHolidays(year).map(key));
    holidayCache.set(year, days);
  }
  return days.has(key(date));
}

export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !isHoliday(date);
}

const at = (date: Date, hour: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);

/** Le premier moment de travail à partir de `date` (la date elle-même si on est en heures ouvrées). */
export function nextWorkingMoment(date: Date): Date {
  let day = at(date, 0);
  if (isWorkingDay(day) && date.getTime() < at(day, WORKDAY_END_HOUR).getTime()) {
    return date.getTime() < at(day, WORKDAY_START_HOUR).getTime() ? at(day, WORKDAY_START_HOUR) : date;
  }
  do day = shift(day, 1);
  while (!isWorkingDay(day));
  return at(day, WORKDAY_START_HOUR);
}

/**
 * Le moment où un délai de `days` jours ouvrés, commencé à `start`, est
 * écoulé. Seules comptent les heures de travail (9 h – 17 h, jours ouvrés) :
 * 1 jour ouvré commencé un vendredi à 14 h finit le lundi à 14 h.
 */
export function addWorkingDays(start: Date, days: number): Date {
  let moment = nextWorkingMoment(start);
  let remaining = Math.max(0, days) * WORKDAY_HOURS * HOUR;
  for (;;) {
    const end = at(moment, WORKDAY_END_HOUR).getTime();
    const available = end - moment.getTime();
    if (remaining <= available) return new Date(moment.getTime() + remaining);
    remaining -= available;
    moment = nextWorkingMoment(new Date(end));
  }
}

/** Jours ouvrés écoulés entre deux moments (heures de travail / 8), arrondis au dixième. */
export function workingDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return -workingDaysBetween(to, from);
  let moment = nextWorkingMoment(from);
  let total = 0;
  while (moment.getTime() < to.getTime()) {
    const end = Math.min(at(moment, WORKDAY_END_HOUR).getTime(), to.getTime());
    total += end - moment.getTime();
    moment = nextWorkingMoment(new Date(at(moment, WORKDAY_END_HOUR).getTime()));
  }
  return Math.round((total / (WORKDAY_HOURS * HOUR)) * 10) / 10;
}
