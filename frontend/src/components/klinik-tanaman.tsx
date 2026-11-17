"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Upload, ScanLine, Leaf, LoaderCircle, ShieldCheck, FlaskConical, ArrowRight, RotateCcw } from "lucide-react";
import type { ClinicCrop, ClinicResult } from "@agri/contracts";

const MAX_BYTES = 5 * 1024 * 1024;
const crops: { value: ClinicCrop; label: string }[] = [
  { value: "tomat", label: "Tomat" }, { value: "padi", label: "Padi" }, { value: "cabai", label: "Cabai" },
  { value: "jagung", label: "Jagung" }, { value: "lainnya", label: "Tanaman lainnya" },
];
const control = "min-h-[64px] w-full rounded-2xl border border-slate-300 bg-white px-5 text-base text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700 disabled:opacity-50";
// GitHub Pages has no API runtime; set this PUBLIC URL to the separately hosted backend.
const backend = (process.env.NEXT_PUBLIC_CLINIC_API_URL ?? "").replace(/\/$/, "");
const unavailable = process.env.NEXT_PUBLIC_DEMO_STATIC === "true" && !backend;

function isResult(value: unknown): value is ClinicResult {
  if (!value || typeof value !== "object") return false;
  const r = value as ClinicResult;
  const a = r.analysis;
  if (!a || !["suspected", "uncertain", "healthy", "not_plant"].includes(a.status)
    || !["low", "medium", "high"].includes(a.confidence)
    || ![a.diseaseName, a.cause, a.nextStep, r.notice].every(s => typeof s === "string")
    || !Array.isArray(a.evidence) || !a.evidence.every(s => typeof s === "string")) return false;
  return r.product === null || !!(r.product && r.product.catalogMode === "dummy"
    && ["ml", "gram"].includes(r.product.unit) && Number.isFinite(r.product.dosePerTank)
    && Number.isFinite(r.product.tankLiters) && Number.isFinite(r.product.dosePerLiter)
    && typeof r.product.name === "string" && typeof r.product.instruction === "string");
}

export default function KlinikTanaman() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [crop, setCrop] = useState<ClinicCrop>("tomat");
  const [tank, setTank] = useState("16");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClinicResult | null>(null);
  const camera = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);
  function choose(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0]; e.target.value = "";
    if (!next) return;
    setError(""); setResult(null); setFile(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("Gunakan foto JPG, PNG, atau WebP. Ubah foto HEIC ke JPG terlebih dahulu."); return; }
    if (!next.size || next.size > MAX_BYTES) { setError("Pilih foto berukuran maksimal 5 MB dan tidak kosong."); return; }
    setFile(next);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || request.current) return;
    setError(""); setResult(null);
    if (!file) { setError("Pilih foto tanaman terlebih dahulu."); return; }
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(tank) || Number(tank.replace(",", ".")) < 1 || Number(tank.replace(",", ".")) > 100) { setError("Isi kapasitas tangki antara 1 dan 100 liter."); return; }
    if (unavailable) { setError("Backend Klinik Tanaman belum terhubung. Pengelola perlu mengatur alamat API terlebih dahulu."); return; }
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 55_000);
    setBusy(true);
    try {
      const body = new FormData(); body.append("image", file); body.append("crop", crop); body.append("tankLiters", tank);
      const response = await fetch(`${backend}/api/clinic/identify`, { method: "POST", body, signal: controller.signal, credentials: "omit" });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Layanan mengembalikan respons yang tidak dikenal. Periksa konfigurasi backend.");
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: unknown } })?.error?.message;
        throw new Error(typeof message === "string" ? message : "Analisis belum berhasil. Coba lagi nanti.");
      }
      if (!isResult(payload)) throw new Error("Hasil analisis tidak lengkap. Silakan coba lagi.");
      setResult(payload);
    } catch (err) {
      setError(controller.signal.aborted ? "Analisis dibatalkan atau terlalu lama. Foto Anda tetap tersedia untuk dicoba kembali." : err instanceof TypeError ? "Tidak dapat terhubung. Periksa koneksi dan alamat backend." : err instanceof Error ? err.message : "Analisis belum berhasil.");
    } finally { clearTimeout(timer); if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  const stateLabel = result ? { suspected: "Dugaan penyakit", uncertain: "Belum dapat dipastikan", healthy: "Tidak terlihat gejala yang jelas", not_plant: "Tanaman tidak terdeteksi" }[result.analysis.status] : "";
  return <div className="mx-auto max-w-6xl text-slate-900">
    <header className="relative overflow-hidden rounded-3xl bg-emerald-950 p-7 text-white sm:p-10">
      <div className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-lime-200"><Leaf size={19}/> CYPHERA / KLINIK TANAMAN</div>
      <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Kenali gejalanya.<br/><span className="text-lime-200">Rencanakan langkahnya.</span></h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50">Mulai dari satu foto. Dapatkan pengamatan awal AI dan langkah untuk memeriksa kondisi tanaman Anda.</p>
      <div className="mt-7 flex flex-wrap gap-3 text-sm"><span className="rounded-full border border-emerald-700 px-4 py-2">01 Foto</span><span className="rounded-full border border-emerald-700 px-4 py-2">02 Analisis</span><span className="rounded-full border border-emerald-700 px-4 py-2">03 Tinjau hasil</span></div>
    </header>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" aria-label="Analisis foto tanaman">
        <h2 className="text-2xl font-bold">Foto tanaman Anda</h2><p className="mt-2 text-sm leading-6 text-slate-700">Ambil bagian yang bergejala, fokus tajam, dengan cahaya alami. Hindari wajah dan informasi pribadi.</p>
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50">
          {preview ? <img src={preview} alt="Foto tanaman yang dipilih untuk dianalisis" className="aspect-[4/3] w-full object-contain" onError={() => { setFile(null); setError("Foto tidak dapat dibuka. Pilih foto JPG lain."); }}/>
            : <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 p-6 text-center"><div className="rounded-2xl bg-white p-5"><ScanLine size={44} className="text-emerald-800"/></div><strong>Daun, batang, atau bagian bergejala</strong><span className="text-sm text-slate-700">JPG, PNG, WebP · Maksimal 5 MB</span></div>}
        </div>
        <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choose} className="hidden" aria-label="Ambil foto tanaman"/>
        <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} className="hidden" aria-label="Unggah foto tanaman"/>
        <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" disabled={busy} onClick={() => camera.current?.click()} className={`${control} flex items-center justify-center gap-2 px-2 font-semibold`}><Camera size={21}/>Kamera</button><button type="button" disabled={busy} onClick={() => upload.current?.click()} className={`${control} flex items-center justify-center gap-2 px-2 font-semibold`}><Upload size={21}/>Pilih foto</button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="min-w-0"><span className="mb-2 block font-semibold">Tanaman apa?</span><select className={control} value={crop} disabled={busy} onChange={e => { setCrop(e.target.value as ClinicCrop); setResult(null); }}>{crops.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label><label><span className="mb-2 block font-semibold">Tangki (liter)</span><input className={control} inputMode="decimal" value={tank} disabled={busy} onChange={e => { setTank(e.target.value); setResult(null); }} maxLength={6}/></label></div>
        <p className="mt-5 flex gap-2 text-sm leading-6 text-slate-700"><ShieldCheck size={20} className="mt-1 shrink-0"/>Saat dianalisis, foto dikirim ke server dan OpenAI. Aplikasi tidak menyimpan foto secara permanen.</p>
        {unavailable && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Koneksi AI belum diaktifkan pada website ini. Pengelola perlu memasang backend dan API key.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">{error}</p>}
        <button type="submit" disabled={busy || !file || unavailable} className="mt-5 flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-900 px-5 font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none"/> : <ScanLine/>}{busy ? "Sedang mengamati foto…" : "Analisis tanaman"}</button>
        {busy && <><p role="status" className="mt-3 text-center text-sm">Mohon tunggu. Analisis bisa memerlukan beberapa detik.</p><button type="button" onClick={() => request.current?.abort()} className="mt-2 min-h-[64px] w-full rounded-xl border border-slate-300 font-semibold">Batalkan analisis</button></>}
      </form>
      <section ref={resultRef} tabIndex={-1} aria-label="Hasil analisis tanaman" className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 focus-visible:outline-2 focus-visible:outline-emerald-700 sm:p-8">
        {!result ? <><span className="inline-flex rounded-2xl bg-lime-100 p-4"><Leaf size={30}/></span><h2 className="mt-5 text-2xl font-bold">Amati sebelum bertindak.</h2><p className="mt-3 leading-7 text-slate-700">Hasil akan muncul di sini setelah foto dianalisis. Satu foto belum selalu cukup untuk membedakan penyakit, kekurangan unsur hara, dan kerusakan lingkungan.</p><ol className="mt-7 space-y-5 text-sm leading-6"><li><strong>1. Dekat dan jelas</strong><br/>Tampilkan gejala dan sebagian daun yang masih sehat.</li><li><strong>2. Periksa kondisi lahan</strong><br/>Catat penyebaran gejala dan perubahan cuaca.</li><li><strong>3. Konfirmasikan hasil</strong><br/>Bawa foto dan catatan ke penyuluh sebelum memilih obat.</li></ol></>
          : <><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">PENGAMATAN AWAL AI</p><h2 className="mt-3 text-2xl font-bold">{stateLabel}</h2><h3 className="mt-5 text-3xl font-bold leading-tight">{result.analysis.diseaseName || "Belum teridentifikasi"}</h3><p className="mt-3 leading-7 text-slate-700">{result.analysis.cause}</p><p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">Keyakinan model: <strong>{{ low: "rendah", medium: "sedang", high: "tinggi" }[result.analysis.confidence]}</strong>. Ini bukan ukuran kepastian diagnosis.</p>
            {!!result.analysis.evidence.length && <><h4 className="mt-6 font-bold">Yang terlihat pada foto</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{result.analysis.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
            <div className="mt-6 rounded-2xl bg-emerald-50 p-5"><h4 className="flex items-center gap-2 font-bold"><ArrowRight size={20}/>Langkah berikutnya</h4><p className="mt-3 text-sm leading-7">{result.analysis.nextStep}</p></div>
            <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5"><h4 className="flex items-center gap-2 font-bold"><FlaskConical size={21}/>Pencocokan katalog</h4>{result.product ? <><p className="mt-3 font-bold">{result.product.name}</p><p className="mt-3 text-3xl font-bold">{result.product.dosePerTank.toLocaleString("id-ID")} {result.product.unit}<span className="mt-1 block text-base font-normal">untuk contoh tangki {result.product.tankLiters} liter</span></p><p className="mt-3 text-sm">{result.product.dosePerLiter} {result.product.unit}/liter × {result.product.tankLiters} liter</p><p className="mt-4 text-sm font-semibold leading-6">{result.product.instruction}</p></> : <p className="mt-3 text-sm leading-7">Belum ada produk yang dapat dicocokkan dengan aman. Tidak ada dosis yang dihitung untuk hasil ini.</p>}</div>
            <p className="mt-5 text-sm leading-7 text-slate-700">{result.notice}</p><button type="button" onClick={() => { setResult(null); camera.current?.click(); }} className={`${control} mt-5 flex items-center justify-center gap-2 font-semibold`}><RotateCcw size={20}/>Periksa foto lain</button></>}
      </section>
    </div>
  </div>;
}
