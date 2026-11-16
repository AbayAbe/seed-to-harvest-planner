import { addDays, format, isValid, parseISO } from "date-fns";
import type { CalendarDate } from "./types.js";

/**
 * Accept the value from an HTML date input, not a timestamp. Parsing and
 * formatting as a local calendar date avoids UTC conversion shifting the day.
 * The round trip also rejects impossible dates such as 2027-02-29.
 */
export function parseCalendarDate(value: CalendarDate): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("Expected a calendar date in YYYY-MM-DD format.");
  }

  const date = parseISO(value);

  if (!isValid(date) || format(date, "yyyy-MM-dd") !== value) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  return date;
}

export function addCalendarDays(
  date: CalendarDate,
  amount: number,
): CalendarDate {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError("The day offset must be a safe integer.");
  }

  // Calendar-day arithmetic handles month/year boundaries and DST changes.
  const result = addDays(parseCalendarDate(date), amount);
  if (!isValid(result)) {
    throw new RangeError("The calculated date is outside the supported range.");
  }

  const formatted = format(result, "yyyy-MM-dd");
  parseCalendarDate(formatted);
  return formatted;
}
