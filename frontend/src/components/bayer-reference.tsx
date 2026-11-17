"use client";

import { useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { BAYER_PRODUCTS, BAYER_CONTACT_URL, findBayerUses } from "../../../backend/src/lib/bayer/knowledge";
import { useDashboardNavigation } from "./dashboard-navigation";

const action="inline-flex min-h-[64px] items-center justify-center gap-2 rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4";

export function ProductReference({productId}:{productId:string}) {
  const nav=useDashboardNavigation();
  const p=BAYER_PRODUCTS.find(p=>p.id===productId);
  if(!p)return null;
  return <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6">
    <p><strong>Bahan aktif:</strong> {p.ingredients||"Cek label kemasan"}</p>
    <p><strong>Tanaman dalam referensi:</strong> {p.crops.join(", ")||"Cek label kemasan"}.</p>
    <p>{p.notes}</p>
    {p.sourceStatus==="archive"&&<p className="font-semibold text-amber-950">Referensi arsip. Keberlakuan label dan ketersediaan produk perlu dikonfirmasi.</p>}
    {nav&&<button type="button" className={action} onClick={()=>nav.chooseProduct(p.id,"panduan")}><BookOpen size={18}/>Lihat rincian {p.name}</button>}
  </div>;
}

/** A reading aid based on crop + known target, never an image diagnosis. */
export function CropReference({crop,initialQuery=""}:{crop:string;initialQuery?:string}) {
  const nav=useDashboardNavigation();
  const [query,setQuery]=useState(initialQuery);
  const [expanded,setExpanded]=useState(false);
  const rows=findBayerUses(crop,query);
  return <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5 text-slate-900 sm:p-6" aria-label={`Referensi Bayer untuk ${crop}`}>
    <div className="flex items-start gap-3"><BookOpen className="mt-1 shrink-0 text-emerald-800" size={24}/><div><h2 className="text-xl font-bold">Kenali sasaran pada {crop}</h2><p className="mt-2 text-sm leading-6">Bahan bacaan dari arsip Bayer. Kecocokan nama gejala tidak memastikan penyakit atau kebutuhan penyemprotan.</p></div></div>
    <label className="mt-4 block text-sm font-semibold">Cari hama atau penyakit dalam referensi<input className="mt-2 min-h-[64px] w-full rounded-xl border border-slate-400 px-4 text-base" value={query} onChange={e=>{setQuery(e.target.value);setExpanded(false);}} placeholder="Contoh: antraknosa, ulat, karat"/></label>
    <p className="mt-3 text-sm" role="status">{rows.length} pasangan tanaman dan sasaran ditemukan.</p>
    <ul className="mt-3 divide-y divide-slate-200">{rows.slice(0,expanded?rows.length:3).map(({product,use})=><li key={`${product.id}:${use.crop}:${use.target}`} className="py-4"><p className="font-bold">{use.target}</p><p className="mt-1 text-sm">{product.name} · {product.category}</p>{nav?<button type="button" className={`${action} mt-3`} onClick={()=>nav.chooseProduct(product.id,"panduan")}>Baca referensi produk <ExternalLink size={16}/></button>:<a className={`${action} mt-3`} href={product.currentSource??BAYER_CONTACT_URL} target="_blank" rel="noreferrer">Buka sumber Bayer</a>}</li>)}</ul>
    {!rows.length&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">Belum ada pasangan terverifikasi dalam koleksi ini. Jangan menyimpulkan produk tidak terdaftar atau penyakit tidak ada; cocokkan dengan label dan penyuluh.</p>}
    {rows.length>3&&<button type="button" className={`${action} mt-3 w-full`} onClick={()=>setExpanded(!expanded)}>{expanded?"Tampilkan lebih sedikit":`Lihat semua ${rows.length} referensi`}</button>}
  </section>;
}
