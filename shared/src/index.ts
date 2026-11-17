export type * from "./planner.js";
export type * from "./tank-mix.js";
export type * from "./juragan.js";
export type * from "./clinic.js";
export type * from "./records.js";
import type { SeedVariety } from "./planner.js";
import type { DoseUnit } from "./tank-mix.js";

export type WeatherScenarioId = "mixed" | "dry" | "repeated-rain" | "persistent-rain";
export interface WeatherScenario {
  readonly id: WeatherScenarioId;
  readonly name: string;
  readonly description: string;
}
export interface ProductCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly category: "Fungisida" | "Insektisida";
  readonly unit: DoseUnit;
  readonly source: string;
}
export interface CatalogResponse {
  readonly seeds: readonly SeedVariety[];
  readonly products: readonly ProductCatalogItem[];
  readonly scenarios: readonly WeatherScenario[];
}
export interface TimelineRequest {
  seedId: string;
  startDate: string;
  scenario: WeatherScenarioId;
  harvestDayOffset: number;
}
/** Decimal strings preserve the Indonesian comma notation until validation. */
export interface TankMixForm {
  productId: string;
  area: string;
  capacity: string;
  dose: string;
  water: string;
}
export type FormErrors = Partial<Record<keyof TankMixForm | "general", string>>;
export interface ApiErrorResponse {
  error: { code: string; message: string; fields?: FormErrors };
}
