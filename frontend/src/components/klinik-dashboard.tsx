"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Upload, Leaf, ScanLine, ClipboardCheck, Check, ArrowUpRight, ImagePlus, NotebookPen } from "lucide-react";

import { CropReference } from "./bayer-reference";
import { BAYER_CROPS } from "../../../backend/src/lib/bayer/knowledge";
import { DashboardLink } from "./dashboard-navigation";

interface Observation { id: string; crop: string; location: string; note: string; date: string }
const KEY = "cyphera:clinic:observations:v1";
const crops = [...BAYER_CROPS, "Tanaman lainnya"];
const field = "min-h-[64px] w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700";
function readNotes(): Observation[] {
  const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  if (!Array.isArray(data) || data.length > 200 || data.some(item => !item || typeof item.id !== "string" || typeof item.crop !== "string" || typeof item.location !== "string" || typeof item.note !== "string" || typeof item.date !== "string" || !Number.isFinite(Date.parse(item.date)))) throw new Error("Catatan tersimpan belum dapat dibaca. Data lama tidak diubah.");
  return data;
}

/** Dashboard-only edition: photos stay in browser memory; no inference or API calls. */
export default function KlinikDashboard() {
  const [crop, setCrop] = useState("Tomat");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [notes, setNotes] = useState<Observation[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const load = () => { try { setNotes(readNotes()); } catch (e) { setError(e instanceof Error ? e.message : "Catatan belum dapat dibaca."); } };
    load(); setReady(true); window.addEventListener("storage", load); return () => window.removeEventListener("storage", load);
  }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0]; event.target.value = "";
    if (!image) return;
    setError(""); setSaved(false); setFile(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size === 0 || image.size > 5 * 1024 * 1024) { setError("Pilih foto JPG, PNG, atau WebP maksimal 5 MB."); return; }
    setFile(image);
  }
  function save(event: FormEvent) {
    event.preventDefault(); setError(""); setSaved(false);
    if (!note.trim()) { setError("Tuliskan gejala yang terlihat terlebih dahulu."); return; }
    try {
      const previous = readNotes();
      if (previous.length >= 200) throw new Error("Penyimpanan sudah mencapai 200 catatan. Salin catatan penting sebelum mengosongkan data situs.");
      const updated = [{ id: crypto.randomUUID(), crop, location: location.trim(), note: note.trim(), date: new Date().toISOString() }, ...previous];
      localStorage.setItem(KEY, JSON.stringify(updated)); setNotes(updated); setSaved(true); setNote("");
    } catch (e) { setError(e instanceof Error && !(e instanceof DOMException) ? e.message : "Catatan belum tersimpan. Penyimpanan browser penuh atau diblokir."); }
  }
  return <div className="mx-auto max-w-6xl text-slate-900">
    <header className="relative overflow-hidden rounded-3xl bg-emerald-950 p-7 text-white sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><span className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-lime-200"><Leaf size={20}/> CYPHERA / KLINIK TANAMAN</span><span className="rounded-full border border-emerald-700 px-4 py-2 text-xs text-emerald-50">Ruang pengamatan tanaman</span></div>
      <div className="mt-8 grid items-end gap-8 md:grid-cols-[1.5fr_1fr]"><div><h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Tanaman terpantau.<br/><span className="text-lime-200">Langkah lebih terarah.</span></h1><p className="mt-5 max-w-xl leading-7 text-emerald-50">Lihat lebih dekat, catat perubahan, dan siapkan pengamatan sebelum berkonsultasi dengan penyuluh.</p></div><button type="button" onClick={() => { form.current?.scrollIntoView({ behavior: "smooth" }); form.current?.focus({ preventScroll: true }); }} className="flex min-h-[64px] items-center justify-between gap-4 rounded-2xl bg-lime-200 px-6 font-bold text-emerald-950">Mulai pengamatan <ArrowUpRight size={22}/></button></div>
    </header>
    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><NotebookPen size={22} className="text-emerald-800"/><strong className="mt-3 block text-3xl">{notes.length}</strong><span className="text-sm text-slate-700">Catatan pengamatan</span></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><Leaf size={22} className="text-emerald-800"/><strong className="mt-3 block text-3xl">{new Set(notes.map(n => n.crop)).size}</strong><span className="text-sm text-slate-700">Jenis tanaman dicatat</span></div>
      <div className="col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:col-span-1"><ScanLine size={22} className="text-emerald-800"/><strong className="mt-3 block text-lg">Analisis AI · Segera hadir</strong><span className="mt-1 block text-sm leading-6 text-slate-700">Saat ini fokus pada foto dan catatan Anda.</span></div>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
      <form ref={form} tabIndex={-1} onSubmit={save} aria-label="Catatan pengamatan tanaman" className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold tracking-widest text-emerald-800">01 / AMATI TANAMAN</p><h2 className="mt-3 text-2xl font-bold">Apa yang terlihat hari ini?</h2><p className="mt-2 text-sm leading-6 text-slate-700">Foto bagian yang bergejala dengan cahaya cukup dan fokus yang tajam.</p>
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50">{preview ? <img src={preview} alt="Pratinjau foto pengamatan tanaman" className="aspect-[4/3] w-full object-contain" onError={() => { setFile(null); setError("Foto tidak dapat dibuka. Pilih foto lain."); }}/>: <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-6 text-center"><ImagePlus size={45} className="text-emerald-800"/><strong>Mulai dari satu foto</strong><span className="text-sm text-slate-700">JPG, PNG, WebP · Maksimal 5 MB</span></div>}</div>
        <input ref={camera} disabled={!ready} type="file" capture="environment" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Ambil foto tanaman" onChange={choose}/><input ref={gallery} disabled={!ready} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Unggah foto tanaman" onChange={choose}/>
        <div className="mt-3 grid grid-cols-2 gap-3"><button type="button" className={`${field} flex items-center justify-center gap-2 font-semibold`} onClick={() => camera.current?.click()}><Camera size={20}/>Kamera</button><button type="button" className={`${field} flex items-center justify-center gap-2 font-semibold`} onClick={() => gallery.current?.click()}><Upload size={20}/>Pilih foto</button></div>
        <p className="mt-3 text-xs leading-6 text-slate-700">Foto hanya untuk pratinjau dan tidak ikut disimpan. Tidak ada foto yang dikirim ke server.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block font-semibold">Jenis tanaman</span><select value={crop} onChange={e => { setCrop(e.target.value); setSaved(false); }} className={field}>{crops.map(c => <option key={c}>{c}</option>)}</select></label><label><span className="mb-2 block font-semibold">Nama lahan <small className="font-normal">(opsional)</small></span><input value={location} maxLength={100} onChange={e => { setLocation(e.target.value); setSaved(false); }} placeholder="Contoh: Sawah utara" className={field}/></label></div>
        <label className="mt-5 block"><span className="mb-2 block font-semibold">Catatan gejala</span><textarea value={note} maxLength={1000} onChange={e => { setNote(e.target.value); setSaved(false); }} className={`${field} min-h-[140px] py-4`} placeholder="Contoh: Daun bagian bawah mulai menguning sejak dua hari lalu."/></label>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-900">{error}</p>}{saved && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-lime-100 p-4 text-sm"><Check size={20}/>Catatan tersimpan di browser ini. Foto tidak disimpan.</p>}
        <button type="submit" disabled={!ready} className="mt-5 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-5 font-bold text-white hover:bg-emerald-800"><ClipboardCheck size={21}/>Simpan catatan</button>
      </form>
      <div className="space-y-6"><section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-bold tracking-widest text-emerald-800">02 / SIAPKAN PENGAMATAN</p><h2 className="mt-3 text-2xl font-bold">Periksa tiga hal ini.</h2><ol className="mt-6 space-y-6">{[["01", "Bagian tanaman", "Lihat daun atas dan bawah, batang, serta bagian yang masih sehat."],["02", "Penyebaran gejala", "Catat apakah hanya satu tanaman atau banyak tanaman yang berubah."],["03", "Waktu dan kondisi", "Catat sejak kapan gejala terlihat dan kondisi lahan saat itu."]].map(([num, title, body]) => <li key={num} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-sm font-bold">{num}</span><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-7 text-slate-700">{body}</p></div></li>)}</ol></section>
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8"><ScanLine size={28} className="text-emerald-800"/><h2 className="mt-4 text-2xl font-bold">Ruang hasil pemeriksaan</h2><p className="mt-3 text-sm leading-7 text-slate-700">Setelah layanan AI diaktifkan, hasil pengamatan foto akan tampil di sini. Untuk saat ini, simpan catatan dan konsultasikan gejala dengan penyuluh.</p><div className="mt-5 space-y-3">{["Identifikasi gejala", "Kemungkinan penyebab", "Tinjauan produk dan dosis"].map(label => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm"><span className="font-semibold">{label}</span><span className="text-slate-700">Belum tersedia</span></div>)}</div><p className="mt-4 text-xs leading-6 text-slate-700">Tidak ada diagnosis atau dosis otomatis pada versi ini.</p></section></div>
    </div>
    <DashboardLink to="riwayat" className="mt-6 flex min-h-[64px] items-center justify-between rounded-2xl bg-emerald-900 px-6 font-semibold text-white">Buka riwayat penyakit per lahan <ArrowUpRight size={20}/></DashboardLink><section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" aria-label="Riwayat pengamatan"><p className="text-xs font-bold tracking-widest text-emerald-800">03 / JEJAK PENGAMATAN</p><h2 className="mt-3 text-2xl font-bold">Catatan terakhir Anda</h2><p className="mt-2 text-sm leading-6 text-slate-700">Tersimpan di browser perangkat ini, terpisah dari cadangan lahan. Menghapus data situs akan menghapus catatan.</p>{notes.length ? <ul className="mt-6 grid gap-4 sm:grid-cols-2">{notes.slice(0, 10).map(n => <li key={n.id} className="min-w-0 rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-emerald-900">{n.crop}</strong><time className="text-xs text-slate-700" dateTime={n.date}>{new Date(n.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</time></div>{n.location && <p className="mt-2 break-words text-sm font-semibold">{n.location}</p>}<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{n.note}</p></li>)}</ul>: <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><NotebookPen size={28} className="mx-auto text-emerald-800"/><p className="mt-3 font-semibold">Belum ada catatan.</p><p className="mt-2 text-sm text-slate-700">Pengamatan kecil hari ini membantu pemeriksaan berikutnya.</p></div>}{notes.length > 10 && <p className="mt-4 text-sm text-slate-700">Menampilkan 10 catatan terbaru dari {notes.length} catatan.</p>}</section>
    <CropReference key={crop} crop={crop}/>
  </div>;
}
