import type { DatabaseSync } from "node:sqlite";
import type { CashEntry, DiseaseLog, FarmRecords, ProductPrice } from "@agri/contracts";
import { RECORDS_SCHEMA } from "./schema.js";
import { validateCash, validateDisease, validatePrice } from "./domain.js";

export class RecordsRepository {
  constructor(private readonly db:DatabaseSync) { db.exec(RECORDS_SCHEMA); }
  private farms(userId:string) { return new Set((this.db.prepare("SELECT id FROM lahan WHERE penggunaId=?").all(userId) as {id:string}[]).map(f=>f.id)); }
  read(userId:string):FarmRecords {
    const prices=this.db.prepare("SELECT id,name,unit,packQuantity,packPriceRp FROM katalog_harga WHERE userId=? ORDER BY name").all(userId) as unknown as ProductPrice[];
    const cash=this.db.prepare("SELECT id,farmId,date,kind,description,amountRp,usageJson FROM transaksi_kas WHERE userId=? ORDER BY date DESC").all(userId).map(row=>{
      const {usageJson,...data}=row; return {...data,usage:typeof usageJson==="string" ? JSON.parse(usageJson) : null} as CashEntry;
    });
    const diseases=this.db.prepare("SELECT id,farmId,date,disease,note,source,analysisId FROM log_penyakit WHERE userId=? ORDER BY date DESC").all(userId) as unknown as DiseaseLog[];
    return {prices,cash,diseases};
  }
  private capacity(userId:string, table:"katalog_harga"|"transaksi_kas"|"log_penyakit") {
    const count=this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE userId=?`).get(userId)!.n as number;
    if(count>=2000)throw new RangeError("Batas 2.000 catatan tercapai.");
  }
  savePrice(userId:string, data:ProductPrice) {
    const p=validatePrice(data); const existing=this.db.prepare("SELECT userId FROM katalog_harga WHERE id=?").get(p.id);
    if(existing && existing.userId!==userId)throw new RangeError("Produk tidak ditemukan.");
    if(!existing)this.capacity(userId,"katalog_harga");
    this.db.prepare("INSERT INTO katalog_harga VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,packQuantity=excluded.packQuantity,packPriceRp=excluded.packPriceRp").run(p.id,userId,p.name,p.unit,p.packQuantity,p.packPriceRp);return p;
  }
  addCash(userId:string, data:CashEntry) {
    const c=validateCash(data,this.farms(userId));
    const existing=this.read(userId).cash.find(row=>row.id===c.id);
    if(existing){if(JSON.stringify(existing)!==JSON.stringify(c))throw new RangeError("ID transaksi sudah digunakan.");return existing;}
    this.capacity(userId,"transaksi_kas");
    this.db.prepare("INSERT INTO transaksi_kas VALUES (?,?,?,?,?,?,?,?)").run(c.id,userId,c.farmId,c.date,c.kind,c.description,c.amountRp,c.usage?JSON.stringify(c.usage):null);return c;
  }
  addDisease(userId:string, data:DiseaseLog) {
    const d=validateDisease(data,this.farms(userId));
    if(d.analysisId){const existing=this.db.prepare("SELECT id,farmId,date,disease,note,source,analysisId FROM log_penyakit WHERE userId=? AND analysisId=?").get(userId,d.analysisId) as unknown as DiseaseLog|undefined;
      if(existing){if(existing.farmId!==d.farmId)throw new RangeError("ID analisis sudah digunakan untuk lahan lain.");return existing;}}
    this.capacity(userId,"log_penyakit");
    this.db.prepare("INSERT INTO log_penyakit VALUES (?,?,?,?,?,?,?,?)").run(d.id,userId,d.farmId,d.date,d.disease,d.note,d.source,d.analysisId);return d;
  }
}
