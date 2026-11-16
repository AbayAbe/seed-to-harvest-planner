import type { AgriProduct, TankMixInputField, TankMixResult } from "./types.js";

export class TankMixInputError extends RangeError {
  constructor(message: string, public readonly field: TankMixInputField) {
    super(message);
    this.name = "TankMixInputError";
  }
}

function assertPositive(value: number, message: string, field: TankMixInputField): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TankMixInputError(message, field);
  }
}

/**
 * Pure calculator. Area is in hectares; capacity and water volumes are liters.
 * No coercion, I/O, mutation, display rounding, or product recommendations.
 *
 * The requested dose = total chemical / ceil(total water / capacity) assumes
 * EQUAL fills: water per tank = total water / trips. Filling every tank to its
 * maximum instead would exceed the water allowance and dilute the mixture.
 *
 * @throws TankMixInputError for zero, negative, non-finite or invalid inputs.
 * @throws RangeError if the result cannot be represented reliably as numbers.
 */
export function calculateTankMix(
  area: number,
  tankCapacity: number,
  product: AgriProduct,
): TankMixResult {
  assertPositive(area, "Luas lahan harus berupa angka lebih dari 0 ha.", "area");
  assertPositive(tankCapacity, "Kapasitas tangki harus berupa angka lebih dari 0 L.", "tankCapacity");

  if (!product || typeof product.id !== "string" || !product.id.trim() ||
      typeof product.name !== "string" || !product.name.trim() ||
      (product.doseUnit !== "g" && product.doseUnit !== "ml")) {
    throw new TankMixInputError("Spesifikasi produk tidak valid.", "product");
  }
  assertPositive(product.dosePerHectare, "Dosis produk per hektare harus lebih dari 0.", "product");
  assertPositive(product.waterVolumePerHectare, "Volume air per hektare harus lebih dari 0 L.", "product");

  const totalChemicalNeeded = area * product.dosePerHectare;
  const totalWaterNeeded = area * product.waterVolumePerHectare;
  const ratio = totalWaterNeeded / tankCapacity;

  // Decimal arithmetic may yield 1.0000000000000002 instead of 1 (e.g. 0.07
  // ha * 200 L / 14 L). Snap only within two machine-epsilon units so this
  // representation error doesn't add a spurious trip. Genuine remainders ceil.
  const nearest = Math.round(ratio);
  const normalizedRatio = Math.abs(ratio - nearest) <= 2 * Number.EPSILON * Math.abs(ratio)
    ? nearest : ratio;
  const numberOfTanks = Math.max(1, Math.ceil(normalizedRatio));
  const dosePerTank = totalChemicalNeeded / numberOfTanks;
  const waterPerTank = totalWaterNeeded / numberOfTanks;

  if (!Number.isSafeInteger(numberOfTanks) ||
      ![totalChemicalNeeded, totalWaterNeeded, dosePerTank, waterPerTank]
        .every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Nilai terlalu besar atau terlalu kecil untuk dihitung. Periksa kembali masukan Anda.");
  }

  return { totalChemicalNeeded, totalWaterNeeded, numberOfTanks,
    doseUnit: product.doseUnit, dosePerTank, waterPerTank };
}
