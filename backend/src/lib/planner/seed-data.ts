import mockSeeds from "./mock-seeds.json" with { type: "json" };
import type { CropPhaseType, SeedVariety } from "./types.js";

function parsePhaseType(value: string): CropPhaseType {
  switch (value) {
    case "planting":
    case "herbicide":
    case "insecticide":
    case "fungicide":
    case "monitoring":
    case "harvest":
      return value;
    default:
      throw new Error(`Unsupported crop phase type: ${value}`);
  }
}

/**
 * Fictional scheduling fixtures from the project brief, not validated product
 * recommendations. The listed crop/product combinations and timing require
 * local label and agronomic validation before any real-world use.
 *
 * JSON imports widen enum fields to strings. Validate them instead of casting
 * the entire JSON document to SeedVariety[]. Freeze nested data to protect it
 * from accidental edits when a consumer holds a task's phase reference.
 */
export const SEED_VARIETIES: readonly SeedVariety[] = Object.freeze(
  mockSeeds.map((seed): SeedVariety => ({
    ...seed,
    phases: Object.freeze(
      seed.phases.map((phase) => {
        if (!Number.isSafeInteger(phase.dayOffset) || phase.dayOffset < 0) {
          throw new Error(`Invalid day offset for phase: ${phase.id}`);
        }

        return Object.freeze({ ...phase, type: parsePhaseType(phase.type) });
      }),
    ),
  })).map((seed) => Object.freeze(seed)),
);
