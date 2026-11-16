import { differenceInCalendarDays } from "date-fns";
import { parseCalendarDate } from "./dates.js";
import { getMockWeatherForecast } from "./weather.js";
import type { CalendarDate, WeatherForecastProvider } from "./types.js";
import type { WeatherScenario, WeatherScenarioId } from "@agri/contracts";
export type { WeatherScenarioId } from "@agri/contracts";

export const WEATHER_SCENARIOS = [
  { id: "mixed", name: "Cuaca berganti", description: "Simulasi awal: hujan pada Senin dan Kamis, hari lainnya cerah atau berawan." },
  { id: "dry", name: "Tanpa hujan", description: "Semua hari disimulasikan cerah. Tidak ada penundaan karena hujan; ini bukan penilaian risiko kekeringan." },
  { id: "repeated-rain", name: "Hujan berulang", description: "Siklus contoh: 6 hari hujan dan 2 hari berawan. Aplikasi dapat bergeser beberapa kali." },
  { id: "persistent-rain", name: "Hujan terus-menerus", description: "Semua hari disimulasikan hujan. Jika 7 kali penundaan belum menemukan hari tanpa hujan, kegiatan perlu ditinjau." },
] as const satisfies readonly WeatherScenario[];

/** Calendar-based deterministic scenarios, not forecasts of actual weather. */
export function createScenarioWeather(scenario: WeatherScenarioId, startDate: CalendarDate): WeatherForecastProvider {
  const start = parseCalendarDate(startDate);
  if (scenario === "mixed") return getMockWeatherForecast;
  if (!WEATHER_SCENARIOS.some((item) => item.id === scenario)) throw new RangeError("Skenario cuaca tidak dikenal.");
  return (date) => {
    const current = parseCalendarDate(date);
    const day = differenceInCalendarDays(current, start);
    const cycleDay = ((day % 8) + 8) % 8;
    const condition = scenario === "dry" ? "Clear" : scenario === "persistent-rain" || cycleDay < 6 ? "Rain" : "Cloudy";
    return { date, condition, source: "mock" };
  };
}
