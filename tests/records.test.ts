import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { CashEntry, ProductPrice } from "@agri/contracts";
import { usageCost, financeSummary, diseaseStats, validateRecords } from "../backend/src/records/domain";
import { validateWorkspace } from "../frontend/src/lib/workspace-store";
import { createApiServer } from "../backend/src/app";

const product:ProductPrice={id:"price1",name:"Produk cair",unit:"ml",packQuantity:1000,packPriceRp:150000};
const cost:CashEntry={id:"cost",farmId:"farm",date:"2026-11-17",kind:"expense",description:"Obat",amountRp:48000,usage:{product,quantity:320}};
test("usage pricing, loss, zero expense and weighted ROI use recorded costs",()=>{
  assert.equal(usageCost(product,320),48000); assert.equal(usageCost({...product,packPriceRp:100,packQuantity:3},1),33);
  assert.equal(usageCost({...product,unit:"g"},320),48000);
  assert.throws(()=>usageCost(product,NaN));assert.throws(()=>usageCost({...product,packQuantity:0},1));
  const income:CashEntry={...cost,id:"income",kind:"income",amountRp:96000,usage:null};
  assert.equal(financeSummary(["farm"],[cost,income])[0]?.roiPercent,100);
  assert.equal(financeSummary(["farm"],[cost])[0]?.roiPercent,-100);
  assert.equal(financeSummary(["farm"],[income])[0]?.roiPercent,null);
  assert.equal(financeSummary(["farm"],[cost],{from:"2026-11-18"})[0]?.expensesRp,0);
  assert.throws(()=>financeSummary(["farm"],[cost],{from:"2026-12-01",to:"2026-11-01"}));
});
test("disease grouping is case-insensitive, separates sources and filters dates",()=>{
  const logs=[{id:"1",farmId:"farm",date:"2026-11-17",disease:"Bercak Daun",note:"",source:"manual" as const,analysisId:null},{id:"2",farmId:"farm",date:"2026-11-18",disease:"bercak daun",note:"",source:"ai" as const,analysisId:"analysis1"}];
  const [stat]=diseaseStats(logs);assert.equal(stat?.count,2);assert.equal(stat?.manual,1);assert.equal(stat?.ai,1);
  assert.equal(diseaseStats(logs,{to:"2026-11-17"})[0]?.count,1);
  assert.throws(()=>validateRecords({prices:[],cash:[],diseases:logs},new Set()));
  assert.throws(()=>validateRecords({prices:[],cash:[{...cost,amountRp:1}],diseases:[]},new Set(["farm"])));
});
test("old backups migrate empty records and new backups validate their linked farms",()=>{
  const old={version:2,farms:[],kegiatan:[]};assert.deepEqual(validateWorkspace(old).records,{prices:[],cash:[],diseases:[]});
  assert.throws(()=>validateWorkspace({...old,records:{prices:[],cash:[cost],diseases:[]}}));
});
test("authenticated API snapshots prices, scopes owners, and saves AI history once",async()=>{
  const server=createApiServer({analyzeVision:async()=>({status:"suspected",observedCrop:"tomat",diseaseCode:"tomato_early_blight",diseaseName:"Bercak kering",cause:"Dugaan dari foto",evidence:[],confidence:"high",nextStep:"Periksa lapangan"})});
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/`;
  const post=(path:string,body:unknown,cookie="")=>fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});
  async function login(phone:string){const t=await (await post("auth/request-otp",{nomorHp:phone,kanal:"whatsapp"})).json();const r=await post("auth/verify-otp",{id:t.id,kode:t.kodeSimulasi});return r.headers.get("set-cookie")!.split(";")[0]!;}
  try{
    assert.equal((await fetch(base+"records/finance")).status,401);
    const cookie=await login("081234561234");const other=await login("081234561235");
    const farm=await (await post("lahan",{nama:"Kebun tomat",lokasi:"Garut",luasHektare:1,latitude:-7,longitude:107,seedId:"tomat-demo",tanggalTanam:"2026-11-01"},cookie)).json();
    let r=await post("records/prices",product,cookie);assert.equal(r.status,201);
    const dto={id:"cash-1",farmId:farm.id,date:"2026-11-17",kind:"expense",description:"Pemakaian",productId:product.id,quantity:320,amountRp:1};
    r=await post("records/cash",dto,cookie);assert.equal(r.status,201);assert.equal((await r.json()).amountRp,48000);
    r=await post("records/cash",dto,cookie);assert.equal(r.status,201); // idempotent retry
    await post("records/prices",{...product,packPriceRp:300000},cookie);
    await post("records/cash",{farmId:farm.id,date:"2026-11-17",kind:"income",description:"Panen",amountRp:96000},cookie);
    const report=await (await fetch(base+"records/finance",{headers:{Cookie:cookie}})).json();assert.equal(report.blocks[0].expensesRp,48000);assert.equal(report.blocks[0].roiPercent,100);
    assert.equal((await fetch(base+`records/finance?farmId=${farm.id}`,{headers:{Cookie:other}})).status,404);
    assert.equal((await post("records/cash",{...dto,id:"bad"},other)).status,400);
    assert.equal((await fetch(base+"records/finance?from=2026-12-01&to=2026-11-01",{headers:{Cookie:cookie}})).status,400);
    const image=await sharp({create:{width:20,height:20,channels:3,background:"green"}}).png().toBuffer();const analysisId=randomUUID();
    for(let i=0;i<2;i++){const data=new FormData();data.set("image",new Blob([new Uint8Array(image)],{type:"image/png"}),"leaf.png");data.set("crop","tomat");data.set("tankLiters","16");data.set("farmId",farm.id);data.set("analysisId",analysisId);const response=await fetch(base+"clinic/identify",{method:"POST",headers:{Cookie:cookie},body:data});assert.equal(response.status,200,await response.text());}
    const disease=await (await fetch(base+"records/diseases",{headers:{Cookie:cookie}})).json();assert.equal(disease.statistics[0].count,1);assert.equal(disease.statistics[0].ai,1);
    r=await post("records/diseases",{farmId:farm.id,date:"2026-11-17",disease:"Bercak kering",note:"Pengamatan",source:"ai",analysisId:"fake"},cookie);assert.equal((await r.json()).source,"manual");
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
