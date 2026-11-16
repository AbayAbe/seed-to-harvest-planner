import type { AgriProduct } from "./types.js";

/** User-supplied example specs, NOT an approved dose for a particular crop. */
export const DEMO_AGRI_PRODUCTS: readonly AgriProduct[] = Object.freeze([
  Object.freeze({
    id: "nativo-75-wg-demo",
    name: "Bayer Nativo 75 WG",
    doseUnit: "g",
    dosePerHectare: 400,
    waterVolumePerHectare: 200,
  } satisfies AgriProduct),
]);
