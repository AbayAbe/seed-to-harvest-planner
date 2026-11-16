export type DoseUnit = "g" | "ml";

/** Specs must use the same product unit throughout; water is always liters. */
export interface AgriProduct {
  readonly id: string;
  readonly name: string;
  readonly doseUnit: DoseUnit;
  readonly dosePerHectare: number;
  readonly waterVolumePerHectare: number;
}

export interface TankMixResult {
  /** In doseUnit, without package-size rounding. */
  readonly totalChemicalNeeded: number;
  /** Liters. */
  readonly totalWaterNeeded: number;
  readonly numberOfTanks: number;
  readonly doseUnit: DoseUnit;
  /** Product quantity for EACH equally filled tank, in doseUnit. */
  readonly dosePerTank: number;
  /** Liters for EACH tank; can be less than the sprayer's maximum capacity. */
  readonly waterPerTank: number;
}

export type TankMixInputField = "area" | "tankCapacity" | "product";
