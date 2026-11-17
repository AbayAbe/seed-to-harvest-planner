export type BayerCategory = "Fungisida" | "Insektisida" | "Herbisida" | "Nematisida" | "Aktivator tanaman" | "Adjuvan" | "Pengatur tumbuh" | "Perlakuan benih";

/** A literature reference, not a prescription or proof of a current registration. */
export interface BayerUse {
  crop: string;
  target: string;
  dose: string;
  method: string;
}
export interface BayerProduct {
  id: string;
  name: string;
  category: BayerCategory;
  unit: "g" | "ml" | null;
  ingredients: string;
  formulation: string;
  registration: string;
  packs: number[];
  crops: string[];
  summary: string;
  notes: string;
  source: string;
  currentSource: string | null;
  sourceStatus: "current-page" | "archive";
  uses: BayerUse[];
  /** Only conventional foliar spray categories enter the existing hectare calculator. */
  sprayCalculator: boolean;
}
