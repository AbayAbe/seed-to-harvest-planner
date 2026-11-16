import { getDay } from "date-fns";
import { parseCalendarDate } from "./dates.js";
import type { CalendarDate, WeatherForecast } from "./types.js";

/**
 * Deterministic mock: Monday/Thursday = Rain, Wednesday/Sunday = Cloudy,
 * otherwise Clear. The same date always gets the same forecast, so renders
 * and tests cannot randomly move tasks. This is not a real weather forecast.
 */
export function getMockWeatherForecast(date: CalendarDate): WeatherForecast {
  const weekday = getDay(parseCalendarDate(date));

  return {
    date,
    condition:
      weekday === 1 || weekday === 4
        ? "Rain"
        : weekday === 0 || weekday === 3
          ? "Cloudy"
          : "Clear",
    source: "mock",
  };
}
