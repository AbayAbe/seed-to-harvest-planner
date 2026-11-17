import test from "node:test";
import assert from "node:assert/strict";
import { BAYER_PRODUCTS, findBayerProducts, findBayerUses } from "../backend/src/lib/bayer/knowledge";
import { PRODUCT_CATALOG } from "../backend/src/lib/tank-mix/catalog";

test("catalog records keep provenance, formulation units and archive status",()=>{
  assert.equal(BAYER_PRODUCTS.length,29);
  assert.equal(new Set(BAYER_PRODUCTS.map(p=>p.id)).size,29);
  for(const p of BAYER_PRODUCTS){
    assert.equal(new URL(p.source).hostname,"www.bayer.com");
    assert.equal(Boolean(p.currentSource),p.sourceStatus==="current-page");
    for(const use of p.uses){assert.ok(p.crops.includes(use.crop));assert.ok(use.method);assert.ok(use.dose);}
    assert.ok(p.packs.every(n=>Number.isFinite(n)&&n>0));
  }
  assert.equal(BAYER_PRODUCTS.reduce((n,p)=>n+p.uses.length,0),64);
  assert.equal(findBayerProducts("","","",true).length,8);
});

test("references match explicit crop and target, not a symptom diagnosis",()=>{
  assert.ok(findBayerProducts("IMIDAKLOPRID","Insektisida","Cabai").some(p=>p.id==="confidor-extra"));
  assert.equal(findBayerProducts("movento","","Padi").length,0);
  assert.ok(findBayerUses("Jagung","FAW").some(r=>r.product.id==="vayego"));
  assert.equal(findBayerUses("Padi","FAW").length,0);
  assert.equal(findBayerProducts("produk yang tidak ada").length,0);
});

test("seed treatment, drenches and activators never enter the foliar calculator",()=>{
  assert.equal(PRODUCT_CATALOG.length,22);
  for(const id of ["gaucho","immune-start","velum","ethrel-10-pa","ethrel-480-sl","ambition","agridex"])
    assert.ok(!PRODUCT_CATALOG.some(p=>p.id===id));
  assert.equal(PRODUCT_CATALOG.find(p=>p.id==="adengo")?.unit,"ml");
  assert.equal(PRODUCT_CATALOG.find(p=>p.id==="valacor")?.unit,"g");
  assert.ok(PRODUCT_CATALOG.every(p=>!("dosePerHectare" in p)));
});
