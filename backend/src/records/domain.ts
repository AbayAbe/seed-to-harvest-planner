import type { CashEntry, DiseaseLog, DiseaseStatistic, FarmRecords, FinanceSummary, ProductPrice, RecordFilter } from "@agri/contracts";
import { parseCalendarDate } from "../lib/planner/dates.js";

export const emptyRecords = (): FarmRecords => ({ prices: [], cash: [], diseases: [] });
function calendar(value:string) { try { parseCalendarDate(value); } catch { throw new RangeError("Isi tanggal yang valid dengan format tahun-bulan-hari."); } }
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new RangeError(message); }
function text(value: unknown, max: number): asserts value is string { check(typeof value === "string" && !!value.trim() && value.length <= max, "Isi teks wajib dengan panjang yang sesuai."); }
export function money(n: number) { check(Number.isSafeInteger(n) && n > 0 && n <= 1e12, "Nilai rupiah harus bilangan bulat positif, maksimal satu triliun."); return n; }
export function quantity(n: number) { check(Number.isFinite(n) && n > 0 && n <= 1e6 && Math.abs(n * 1000 - Math.round(n * 1000)) < 0.000001, "Jumlah harus positif, maksimal 1 juta dan 3 angka desimal."); return n; }
export function validatePrice(p: ProductPrice): ProductPrice {
  text(p?.id, 100); text(p.name, 100); check(p.unit === "ml" || p.unit === "g", "Satuan produk harus ml atau gram.");
  quantity(p.packQuantity); money(p.packPriceRp); return { id: p.id, name: p.name.trim(), unit: p.unit, packQuantity: p.packQuantity, packPriceRp: p.packPriceRp };
}
/** Exact integer arithmetic, rounded once per usage transaction to the nearest rupiah. */
export function usageCost(p: ProductPrice, used: number) {
  validatePrice(p); quantity(used);
  const numerator = BigInt(Math.round(used * 1000)) * BigInt(p.packPriceRp);
  const denominator = BigInt(Math.round(p.packQuantity * 1000));
  const amount = Number((numerator + denominator / 2n) / denominator);
  check(Number.isSafeInteger(amount) && amount >= 0 && amount <= 1e12, "Total biaya di luar batas perhitungan."); return amount;
}
export function validateCash(c: CashEntry, farmIds: Set<string>): CashEntry {
  text(c?.id, 100); check(farmIds.has(c.farmId), "Pilih lahan yang tersimpan."); calendar(c.date);
  text(c.description, 300); check(c.kind === "expense" || c.kind === "income", "Jenis transaksi tidak dikenal.");
  if (c.usage !== null) {
    check(c.kind === "expense" && !!c.usage, "Pemakaian produk harus berupa pengeluaran.");
    const product = validatePrice(c.usage.product); const used = quantity(c.usage.quantity);
    check(c.amountRp === usageCost(product, used), "Biaya pemakaian tidak sesuai harga yang dicatat.");
    return { id:c.id, farmId:c.farmId, date:c.date, kind:c.kind, description:c.description.trim(), amountRp:c.amountRp, usage:{product,quantity:used} };
  }
  money(c.amountRp); return { id:c.id, farmId:c.farmId, date:c.date, kind:c.kind, description:c.description.trim(), amountRp:c.amountRp, usage:null };
}
export function validateDisease(d: DiseaseLog, farmIds: Set<string>): DiseaseLog {
  text(d?.id, 100); check(farmIds.has(d.farmId), "Pilih lahan yang tersimpan."); calendar(d.date); text(d.disease, 100);
  check(typeof d.note === "string" && d.note.length <= 1000, "Catatan maksimal 1.000 karakter.");
  check(d.source === "manual" || d.source === "ai", "Sumber catatan tidak dikenal.");
  if (d.source === "ai") text(d.analysisId, 100); else check(d.analysisId === null, "Catatan manual tidak mempunyai ID analisis.");
  return { id:d.id, farmId:d.farmId, date:d.date, disease:d.disease.trim().replace(/\s+/g," "), note:d.note.trim(), source:d.source, analysisId:d.analysisId };
}
export function validateRecords(raw: unknown, farmIds: Set<string>): FarmRecords {
  if (raw === undefined) return emptyRecords(); // Backward-compatible workspace migration.
  check(!!raw && typeof raw === "object", "Format buku kas tidak valid."); const r = raw as FarmRecords;
  for (const list of [r.prices, r.cash, r.diseases]) { check(Array.isArray(list) && list.length <= 2000, "Maksimal 2.000 catatan per jenis."); const ids = new Set(); for (const item of list) { check(item && !ids.has(item.id), "ID catatan duplikat."); ids.add(item.id); } }
  const result = { prices:r.prices.map(validatePrice), cash:r.cash.map(c=>validateCash(c,farmIds)), diseases:r.diseases.map(d=>validateDisease(d,farmIds)) };
  const analyses = new Set<string>();
  for (const d of result.diseases) if (d.analysisId) { check(!analyses.has(d.analysisId), "ID analisis sudah tercatat."); analyses.add(d.analysisId); }
  return result;
}
export function validateFilter(f: RecordFilter) {
  if (f.from) calendar(f.from); if (f.to) calendar(f.to);
  check(!f.from || !f.to || f.from <= f.to, "Tanggal awal harus sebelum tanggal akhir.");
}
export function inRange(item: {farmId:string;date:string}, f:RecordFilter) { return (!f.farmId || item.farmId === f.farmId) && (!f.from || item.date >= f.from) && (!f.to || item.date <= f.to); }
export function financeSummary(farmIds: string[], cash: CashEntry[], filter: RecordFilter = {}): FinanceSummary[] {
  validateFilter(filter);
  return farmIds.filter(id=>!filter.farmId || id===filter.farmId).map(farmId=>{
    const rows=cash.filter(c=>c.farmId===farmId && inRange(c,filter));
    const expensesRp=rows.filter(c=>c.kind==="expense").reduce((n,c)=>n+c.amountRp,0);
    const revenueRp=rows.filter(c=>c.kind==="income").reduce((n,c)=>n+c.amountRp,0);
    check(Number.isSafeInteger(expensesRp) && Number.isSafeInteger(revenueRp),"Total rupiah terlalu besar.");
    const profitRp=revenueRp-expensesRp;
    return {farmId,expensesRp,revenueRp,profitRp,roiPercent:expensesRp>0 ? Math.round(profitRp/expensesRp*10000)/100 : null};
  });
}
export function diseaseStats(logs: DiseaseLog[], filter: RecordFilter = {}): DiseaseStatistic[] {
  validateFilter(filter); const groups=new Map<string,DiseaseStatistic>();
  for (const log of logs) {
    if (!inRange(log,filter) || (filter.disease && log.disease.toLocaleLowerCase("id-ID")!==filter.disease.toLocaleLowerCase("id-ID"))) continue;
    const key=JSON.stringify([log.farmId,log.disease.toLocaleLowerCase("id-ID")]);
    const row=groups.get(key) ?? {farmId:log.farmId,disease:log.disease,count:0,manual:0,ai:0,lastDate:log.date};
    row.count++; row[log.source]++; if(log.date>row.lastDate)row.lastDate=log.date; groups.set(key,row);
  }
  return [...groups.values()].sort((a,b)=>b.count-a.count || a.disease.localeCompare(b.disease));
}
