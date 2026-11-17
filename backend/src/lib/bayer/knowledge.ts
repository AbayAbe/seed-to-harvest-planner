import data from "./products.json" with { type: "json" };
import type { BayerProduct } from "./types.js";

export const BAYER_REVIEW_DATE = "17 November 2026";
export const BAYER_CONTACT_URL = "https://www.bayer.com/id-id/indonesia/hubungi-kami";
// Source transcription is reviewed in tests. No dose is promoted to a numeric preset.
export const BAYER_PRODUCTS: readonly BayerProduct[] = data as BayerProduct[];
export const BAYER_CROPS = [...new Set(BAYER_PRODUCTS.flatMap(p => p.crops))].sort((a,b) => a.localeCompare(b,"id"));
export const BAYER_CATEGORIES = [...new Set(BAYER_PRODUCTS.map(p => p.category))];
export function normalizeReference(value: string): string {
  return value.trim().toLocaleLowerCase("id-ID").replace(/\s+/g," ");
}
export function findBayerProducts(query="", category="", crop="", currentOnly=false): BayerProduct[] {
  const terms=normalizeReference(query).split(" ").filter(Boolean);
  return BAYER_PRODUCTS.filter(p => (!category||p.category===category) && (!crop||p.crops.includes(crop)) && (!currentOnly||p.sourceStatus==="current-page") && terms.every(term => normalizeReference([p.name,p.ingredients,p.category,...p.crops,...p.uses.map(u=>u.target)].join(" ")).includes(term)));
}
/** Matches explicit crop-target pairs; broad product crop lists are never diagnoses. */
export function findBayerUses(crop: string, query="") {
  const terms=normalizeReference(query).split(" ").filter(Boolean);
  return BAYER_PRODUCTS.flatMap(product => product.uses.filter(use => use.crop===crop && terms.every(term=>normalizeReference(use.target).includes(term))).map(use=>({product,use})));
}
