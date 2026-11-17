import express, { type ErrorRequestHandler, type Request } from "express";
import { randomUUID } from "node:crypto";
import type { Lahan, RecordFilter } from "@agri/contracts";
import { HttpError } from "../http-error.js";
import { diseaseStats, financeSummary, usageCost, validateFilter } from "./domain.js";
import type { RecordsRepository } from "./repository.js";

export function createRecordsApp(repo:RecordsRepository, user:(req:Request)=>string, farms:(id:string)=>Lahan[], origins:readonly string[]) {
  const app=express();app.disable("x-powered-by");
  app.use((req,res,next)=>{res.setHeader("Cache-Control","no-store");try{
    res.locals.userId=user(req);
    if(req.method!=="GET" && req.headers.origin && !origins.includes(req.headers.origin))throw new HttpError(403,"ORIGIN_DENIED","Alamat website tidak diizinkan.");
    next();}catch(e){next(e);}});
  app.use(express.json({limit:"16kb"}));
  app.use((req,_res,next)=>{if(req.method==="POST" && (!req.body || typeof req.body!=="object" || Array.isArray(req.body)))next(new RangeError("Kirim objek JSON yang valid."));else next();});
  function context(req:Request,userId:string){
    const f:RecordFilter={};for(const key of ["farmId","from","to","disease"] as const){const val=req.query[key];if(val!==undefined){if(typeof val!=="string"||val.length>100)throw new RangeError("Filter tidak valid.");f[key]=val;}}
    validateFilter(f);const list=farms(userId);if(f.farmId&&!list.some(l=>l.id===f.farmId))throw new HttpError(404,"NOT_FOUND","Lahan tidak ditemukan.");return {f,list};
  }
  app.get("/api/records/finance",(req,res)=>{const {f,list}=context(req,res.locals.userId);res.json({blocks:financeSummary(list.map(l=>l.id),repo.read(res.locals.userId).cash,f)});});
  app.get("/api/records/diseases",(req,res)=>{const {f}=context(req,res.locals.userId);res.json({statistics:diseaseStats(repo.read(res.locals.userId).diseases,f)});});
  app.get("/api/records",(_req,res)=>res.json(repo.read(res.locals.userId)));
  app.post("/api/records/prices",(req,res)=>res.status(201).json(repo.savePrice(res.locals.userId,{...req.body,id:req.body.id??randomUUID()})));
  app.post("/api/records/cash",(req,res)=>{
    const b=req.body;let usage=null;let amountRp=b.amountRp;
    if(b.productId){const product=repo.read(res.locals.userId).prices.find(p=>p.id===b.productId);if(!product)throw new RangeError("Harga produk belum tersedia.");usage={product,quantity:b.quantity};amountRp=usageCost(product,b.quantity);}
    res.status(201).json(repo.addCash(res.locals.userId,{id:b.id??randomUUID(),farmId:b.farmId,date:b.date,kind:b.kind,description:b.description,amountRp,usage}));
  });
  app.post("/api/records/diseases",(req,res)=>res.status(201).json(repo.addDisease(res.locals.userId,{...req.body,id:randomUUID(),source:"manual",analysisId:null})));
  const errors:ErrorRequestHandler=(e,_req,res,_next)=>{const status=e instanceof HttpError?e.status:e instanceof RangeError||e instanceof SyntaxError||e?.type==="entity.too.large"?400:500;
    res.status(status).json({error:{code:"RECORDS_ERROR",message:status===500?"Data belum dapat diproses. Coba lagi.":e.message}});};app.use(errors);return app;
}
