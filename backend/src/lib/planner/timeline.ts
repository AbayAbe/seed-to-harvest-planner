import { addCalendarDays, parseCalendarDate } from "./dates.js";
import { SEED_VARIETIES } from "./seed-data.js";
import { getMockWeatherForecast } from "./weather.js";
import type {
  CalendarDate,
  CropPhase,
  CropPhaseType,
  SeedVariety,
  TaskSchedule,
  TaskReview,
  TimelineReport,
  TimelineOptions,
  WeatherForecast,
  WeatherForecastProvider,
} from "./types.js";

export const RAIN_DELAY_DAYS = 2;
/** Software retry limit only; this is not an approved agronomic delay window. */
export const MAX_RAIN_RESCHEDULES = 7;

export class ScheduleReviewError extends Error {
  constructor(public readonly review: TaskReview) {
    super(`Cannot schedule ${review.phase.name}: ${review.reason}. Manual review is required.`);
    this.name = "ScheduleReviewError";
  }
}

function isChemicalApplication(type: CropPhaseType): boolean {
  return type === "herbicide" || type === "insecticide" || type === "fungicide";
}

function readForecast(
  provider: WeatherForecastProvider,
  date: CalendarDate,
): WeatherForecast {
  const forecast = provider(date);
  // Missing, mismatched, or unknown weather must not be treated as clear.
  if (
    !forecast ||
    forecast.date !== date ||
    !["Clear", "Cloudy", "Rain"].includes(forecast.condition)
  ) {
    throw new Error(`Invalid or missing weather forecast for ${date}.`);
  }
  return { ...forecast };
}

/**
 * Generate a JSON-serializable timeline from a seed and YYYY-MM-DD start date.
 *
 * Every phase is anchored to planting, independently of other phase delays.
 * Rain postpones only chemical applications, in exactly two-day increments.
 * Recheck each new date so a postponed task is never silently placed in rain.
 * Persistent rain throws after seven postponements (14 days); no partial
 * timeline is returned. Activities at/after the harvest marker also require
 * review. Neither the seed database nor caller data is mutated.
 *
 * @throws RangeError For an invalid start date or an out-of-range result.
 * @throws Error For an unknown seed, unusable forecast, exhausted retries, or
 * a harvest conflict. Use generateTimelineReport to retain unaffected tasks.
 */
export function generateDynamicTimeline(
  seedId: string,
  startDate: CalendarDate,
  options: TimelineOptions = {},
): TaskSchedule[] {
  parseCalendarDate(startDate);

  const seed = SEED_VARIETIES.find((candidate) => candidate.id === seedId);
  if (!seed) {
    throw new Error(`Unknown seed variety: ${seedId}`);
  }

  const weatherProvider = options.weatherProvider ?? getMockWeatherForecast;

  const phases = getPhases(seed, options);
  return phases.map((phase) => schedulePhase(seed, phase, phases, startDate, weatherProvider))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

function getPhases(seed: SeedVariety, options: TimelineOptions): readonly CropPhase[] {
  if (options.harvestDayOffset === undefined) return seed.phases;
  if (!Number.isSafeInteger(options.harvestDayOffset) || options.harvestDayOffset < 1) {
    throw new RangeError("Hari panen harus berupa bilangan bulat lebih dari nol.");
  }
  return seed.phases.map((phase) => phase.type === "harvest" ? { ...phase, dayOffset: options.harvestDayOffset! } : phase);
}

function schedulePhase(seed: SeedVariety, phase: CropPhase, phases: readonly CropPhase[], startDate: CalendarDate, weatherProvider: WeatherForecastProvider): TaskSchedule {
    const originalDate = addCalendarDays(startDate, phase.dayOffset);
    const originalForecast = readForecast(weatherProvider, originalDate);
    let scheduledDate = originalDate;
    let forecast = originalForecast;
    let rescheduleCount = 0;

    while (isChemicalApplication(phase.type) && forecast.condition === "Rain") {
      if (rescheduleCount >= MAX_RAIN_RESCHEDULES) {
        throw new ScheduleReviewError({ id: `${seed.id}:${phase.id}:${startDate}`, phase,
          originalDate, lastCheckedDate: scheduledDate, reason: "persistent-rain" });
      }

      scheduledDate = addCalendarDays(scheduledDate, RAIN_DELAY_DAYS);
      forecast = readForecast(weatherProvider, scheduledDate);
      rescheduleCount += 1;
    }

    const delayDays = rescheduleCount * RAIN_DELAY_DAYS;
    const harvest = phases.find((item) => item.type === "harvest");
    if (phase.type !== "planting" && phase.type !== "harvest" && harvest && scheduledDate >= addCalendarDays(startDate, harvest.dayOffset)) {
      throw new ScheduleReviewError({ id: `${seed.id}:${phase.id}:${startDate}`, phase,
        originalDate, lastCheckedDate: scheduledDate, reason: "harvest-conflict" });
    }
    return {
      id: `${seed.id}:${phase.id}:${startDate}`,
      seedId: seed.id,
      phase,
      originalDate,
      scheduledDate,
      originalForecast,
      forecast,
      status: delayDays > 0 ? "rescheduled" : "scheduled",
      delayDays,
      warning: delayDays > 0 ? "Delayed due to rain risk" : null,
    };
}

/**
 * UI report: retain other tasks while separating unresolved applications.
 * Reviewed tasks have NO scheduled date and must never count as ready to apply.
 * A date before harvest still needs label-specific pre-harvest validation.
 * Unexpected forecast/validation errors propagate rather than implying clear weather.
 */
export function generateTimelineReport(seedId: string, startDate: CalendarDate, options: TimelineOptions = {}): TimelineReport {
  parseCalendarDate(startDate);
  const seed = SEED_VARIETIES.find((item) => item.id === seedId);
  if (!seed) throw new Error(`Unknown seed variety: ${seedId}`);
  const phases = getPhases(seed, options);
  const provider = options.weatherProvider ?? getMockWeatherForecast;
  const tasks: TaskSchedule[] = [];
  const needsReview: TaskReview[] = [];
  for (const phase of phases) {
    try { tasks.push(schedulePhase(seed, phase, phases, startDate, provider)); }
    catch (error) {
      if (error instanceof ScheduleReviewError) needsReview.push(error.review);
      else throw error;
    }
  }
  return { tasks: tasks.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)), needsReview };
}
