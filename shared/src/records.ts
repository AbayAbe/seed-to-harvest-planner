export interface ProductPrice {
  id: string; name: string; unit: "ml" | "g"; packQuantity: number; packPriceRp: number;
}
export interface CashEntry {
  id: string; farmId: string; date: string; kind: "expense" | "income";
  description: string; amountRp: number;
  usage: null | { product: ProductPrice; quantity: number };
}
export interface DiseaseLog {
  id: string; farmId: string; date: string; disease: string; note: string;
  source: "manual" | "ai"; analysisId: string | null;
}
export interface FarmRecords { prices: ProductPrice[]; cash: CashEntry[]; diseases: DiseaseLog[] }
export interface RecordFilter { farmId?: string; from?: string; to?: string; disease?: string }
export interface FinanceSummary { farmId: string; expensesRp: number; revenueRp: number; profitRp: number; roiPercent: number | null }
export interface DiseaseStatistic { farmId: string; disease: string; count: number; manual: number; ai: number; lastDate: string }
