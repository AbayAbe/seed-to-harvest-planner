export type ClinicCrop = "tomat" | "padi" | "cabai" | "jagung" | "lainnya";
export interface ClinicAnalysis {
  status: "suspected" | "uncertain" | "healthy" | "not_plant";
  observedCrop: ClinicCrop | "unknown";
  diseaseCode: "tomato_early_blight" | "rice_blast" | "other" | "none";
  diseaseName: string;
  cause: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
  nextStep: string;
}
export interface ClinicResult {
  analysis: ClinicAnalysis;
  product: null | {
    name: string;
    catalogMode: "dummy";
    dosePerLiter: number;
    tankLiters: number;
    dosePerTank: number;
    unit: "ml" | "gram";
    instruction: string;
  };
  notice: string;
}
