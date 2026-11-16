import type { FormErrors, ProductCatalogItem, TankMixForm } from "@agri/contracts";
export type { TankMixForm } from "@agri/contracts";

export const EMPTY_TANK_MIX: TankMixForm = { productId: "", area: "", capacity: "", dose: "", water: "" };

/** Accept decimal commas or points, never ambiguous thousands separators. */
export function parseDecimal(value: string): number {
  return /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim())
    ? Number(value.trim().replace(",", ".")) : NaN;
}

/** UX preflight only; the backend validates again and owns all dosage math. */
export function validateTankMix(form: TankMixForm, products: readonly ProductCatalogItem[]): FormErrors {
  const errors: FormErrors = {};
  if (!products.some((item) => item.id === form.productId)) errors.productId = "Pilih produk yang akan digunakan.";
  const labels = { area: "luas lahan", capacity: "kapasitas tangki", dose: "dosis dari label", water: "air per hektare" };
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    const value = parseDecimal(form[key]);
    if (!Number.isFinite(value) || value <= 0) errors[key] = `Isi ${labels[key]} dengan angka lebih dari nol.`;
  }
  return errors;
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("id-ID", value > 0 && value < 0.01
    ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: 2 }).format(value);
}

export function formatApproximate(value: number): string {
  const text = formatQuantity(value);
  const displayed = Number(text.replaceAll(".", "").replace(",", "."));
  return `${Math.abs(value - displayed) > Math.abs(value) * Number.EPSILON * 4 ? "≈ " : ""}${text}`;
}
