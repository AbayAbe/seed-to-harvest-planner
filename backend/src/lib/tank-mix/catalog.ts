import type { ProductCatalogItem } from "@agri/contracts";
import { BAYER_PRODUCTS, BAYER_CONTACT_URL } from "../bayer/knowledge.js";

/** Identification only. The user must supply rates from their current local label. */
export const PRODUCT_CATALOG: readonly ProductCatalogItem[] = BAYER_PRODUCTS
  .filter(p => p.sprayCalculator && p.unit && ["Fungisida","Insektisida","Herbisida"].includes(p.category))
  .map(p => ({id:p.id,name:p.name,category:p.category as ProductCatalogItem["category"],unit:p.unit!,source:p.currentSource??BAYER_CONTACT_URL}));
