/**
 * Calendar-date arithmetic for the registers and the gates.
 *
 * Every date this feature records is a calendar date written `YYYY-MM-DD` — an
 * observation date, an acquisition date, a re-query date, a review date. None of
 * them is an instant, so none of them should be compared as one. The helpers
 * below parse a calendar date at UTC midnight, which makes "has the re-query date
 * passed?" a question about days rather than about the machine's timezone.
 *
 * Two decisions are worth stating.
 *
 * **Parsing is strict and returns null.** `new Date('2026-02-30')` yields 2 March
 * in some engines and `Invalid Date` in others, and `new Date('yesterday')` yields
 * `Invalid Date` silently. Both are recording errors, and both must produce a
 * recorded failure rather than a plausible-looking date. `parseCalendarDate`
 * therefore requires the exact `YYYY-MM-DD` shape and round-trips the parsed
 * value back to a string, so only a date that really exists survives.
 *
 * **Working days are Monday to Friday.** Requirement 7.6 gives five working days
 * to record a correction. This module knows nothing about public holidays, and
 * inventing a holiday calendar would be inventing evidence; the five-working-day
 * arithmetic is therefore weekday arithmetic, and that limitation is recorded
 * here rather than implied.
 */

export const MILLISECONDS_PER_DAY = 86_400_000;

/** The only shape a recorded calendar date may take. */
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `Date.prototype.getUTCDay` values for Saturday and Sunday. */
const SATURDAY = 6;
const SUNDAY = 0;

/** A calendar date as `YYYY-MM-DD`, taken from a UTC instant. */
export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a recorded calendar date at UTC midnight.
 *
 * @returns the date, or null when the value is absent, blank, malformed, or names
 * a day that does not exist.
 */
export function parseCalendarDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!CALENDAR_DATE_PATTERN.test(trimmed)) return null;

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // 2026-02-30 parses in some engines by rolling forward. A round trip rejects it.
  if (formatCalendarDate(parsed) !== trimmed) return null;
  return parsed;
}

/** True when the value is a calendar date that exists. */
export function isCalendarDate(value: string | null | undefined): boolean {
  return parseCalendarDate(value) !== null;
}

/** A new date `days` calendar days after `date`. Negative values move back. */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

/**
 * Whole calendar days from `earlier` to `later`.
 *
 * Both arguments are truncated to their UTC day, so the result counts date
 * boundaries crossed rather than elapsed hours.
 */
export function differenceInCalendarDays(later: Date, earlier: Date): number {
  const laterDay = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const earlierDay = Date.UTC(
    earlier.getUTCFullYear(),
    earlier.getUTCMonth(),
    earlier.getUTCDate()
  );
  return Math.round((laterDay - earlierDay) / MILLISECONDS_PER_DAY);
}

/** Monday to Friday. Public holidays are not modelled; see the file note. */
export function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== SATURDAY && day !== SUNDAY;
}

/**
 * The date `workingDays` working days after `date`.
 *
 * Counting starts from the day after `date`, so a Friday start with five working
 * days lands on the following Friday. A weekend start counts from the following
 * Monday, because no working day has passed in between.
 */
export function addWorkingDays(date: Date, workingDays: number): Date {
  if (workingDays <= 0) return new Date(date.getTime());

  let cursor = date;
  let counted = 0;
  while (counted < workingDays) {
    cursor = addCalendarDays(cursor, 1);
    if (isWorkingDay(cursor)) counted += 1;
  }
  return cursor;
}

/**
 * Compare two recorded calendar dates.
 *
 * @returns a negative number when `a` is earlier, zero when they are the same
 * day, a positive number when `a` is later, and null when either value is not a
 * calendar date — so a caller cannot mistake a malformed date for an equal one.
 */
export function compareCalendarDates(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const first = parseCalendarDate(a);
  const second = parseCalendarDate(b);
  if (!first || !second) return null;
  return first.getTime() - second.getTime();
}

/**
 * The date `months` calendar months after `date`, clamped to the end of the target
 * month.
 *
 * Requirement 4.10 gives a guide review window of twelve months, and twelve months
 * is not 365 days — on a leap year it is 366, and "twelve months after 31 August"
 * has to mean 31 August rather than 1 September. Adding days would make the bound
 * drift by a day depending on which year the content date fell in, which is a
 * silly reason for a page to unpublish.
 *
 * Clamping handles the only ambiguous case: one month after 31 January is 28 or 29
 * February, not 2 or 3 March. Rolling forward would place the review date in the
 * following month and quietly widen the window.
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();

  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;

  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}
