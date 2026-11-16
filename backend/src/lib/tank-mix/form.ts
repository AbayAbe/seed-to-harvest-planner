import { calculateTankMix } from "./calculate.js";
import { PRODUCT_CATALOG } from "./catalog.js";
import type { TankMixResult } from "./types.js";

import type { FormErrors, TankMixForm } from "@agri/contracts";
export type { FormErrors, TankMixForm } from "@agri/contracts";
export const EMPTY_TANK_MIX: TankMixForm = { productId: "", area: "", capacity: "", dose: "", water: "" };

/** Accept decimal commas or points, never ambiguous thousands separators. */
export function parseDecimal(value: string): number {
  return /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim())
    ? Number(value.trim().replace(",", ".")) : NaN;
}

export function evaluateTankMix(form: TankMixForm): { result: TankMixResult | null; errors: FormErrors } {
  const errors: FormErrors = {};
  const product = PRODUCT_CATALOG.find((item) => item.id === form.productId);
  if (!product) errors.productId = "Pilih produk yang akan digunakan.";
  const labels = { area: "luas lahan", capacity: "kapasitas tangki", dose: "dosis dari label", water: "air per hektare" };
  const values = { area: parseDecimal(form.area), capacity: parseDecimal(form.capacity), dose: parseDecimal(form.dose), water: parseDecimal(form.water) };
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    if (!Number.isFinite(values[key]) || values[key] <= 0) errors[key] = `Isi ${labels[key]} dengan angka lebih dari nol.`;
  }
  if (!product || Object.keys(errors).length) return { result: null, errors };
  try {
    return { errors, result: calculateTankMix(values.area, values.capacity, {
      id: product.id, name: product.name, doseUnit: product.unit,
      dosePerHectare: values.dose, waterVolumePerHectare: values.water,
    }) };
  } catch {
    return { result: null, errors: { general: "Angka terlalu besar atau terlalu kecil. Periksa kembali angka yang Anda masukkan." } };
  }
}

