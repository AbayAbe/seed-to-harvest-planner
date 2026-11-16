/** A calendar date in YYYY-MM-DD format, without a time or timezone. */
export type CalendarDate = string;

export type CropPhaseType =
  | "planting"
  | "herbicide"
  | "insecticide"
  | "fungicide"
  | "monitoring"
  | "harvest";

export interface CropPhase {
  readonly id: string;
  readonly name: string;
  readonly type: CropPhaseType;
  /** Calendar days from planting; every phase uses the same starting point. */
  readonly dayOffset: number;
  /** Null when no product is specified. Named products are demonstration data. */
  readonly productName: string | null;
  readonly note?: string;
}

export interface SeedVariety {
  readonly id: string;
  readonly name: string;
  readonly crop: string;
  readonly startNote?: string;
  readonly phases: readonly CropPhase[];
}

export type WeatherCondition = "Clear" | "Cloudy" | "Rain";

export interface WeatherForecast {
  readonly date: CalendarDate;
  /** In this mock, Rain represents the application's wash-off risk flag. */
  readonly condition: WeatherCondition;
  readonly source: "mock";
}

export interface TaskSchedule {
  /** Stable across weather changes for the same seed, phase, and start date. */
  readonly id: string;
  readonly seedId: string;
  readonly phase: CropPhase;
  readonly originalDate: CalendarDate;
  readonly scheduledDate: CalendarDate;
  readonly originalForecast: WeatherForecast;
  /** Forecast for scheduledDate, after any postponement. */
  readonly forecast: WeatherForecast;
  readonly status: "scheduled" | "rescheduled";
  readonly delayDays: number;
  readonly warning: string | null;
}

/** Synchronous seam for deterministic tests; a live API will need an async adapter. */
export type WeatherForecastProvider = (date: CalendarDate) => WeatherForecast;

export interface TimelineOptions {
  readonly weatherProvider?: WeatherForecastProvider;
  /** User's hypothetical harvest day; does not imply a validated crop duration. */
  readonly harvestDayOffset?: number;
}

/** A task with no confirmed scheduled date; never present it as ready to apply. */
export interface TaskReview {
  readonly id: string;
  readonly phase: CropPhase;
  readonly originalDate: CalendarDate;
  readonly lastCheckedDate: CalendarDate;
  readonly reason: "persistent-rain" | "harvest-conflict";
}

export interface TimelineReport {
  readonly tasks: TaskSchedule[];
  readonly needsReview: TaskReview[];
}
