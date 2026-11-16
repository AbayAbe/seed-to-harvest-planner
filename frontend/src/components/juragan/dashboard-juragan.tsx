"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CloudSun, MapPinned, Plus, RefreshCw, Sprout } from "lucide-react";
import type { CatalogResponse, Lahan, Pengguna } from "@agri/contracts";
import { useApiQuery } from "../../lib/use-api-query";
import { requestApi } from "../../lib/api";
import { formatQuantity } from "../../lib/tank-mix/form";
import KartuLahan from "./kartu-lahan";
import FormLahan from "./form-lahan";

export default function DashboardJuragan({ pengguna, catalog, aktif, onBukaLahan }: { pengguna: Pengguna; catalog: CatalogResponse; aktif: boolean; onBukaLahan: (lahan: Lahan) => void }) {
  const query = useApiQuery<{ lahan: Lahan[] }>("lahan");
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [penyegaran, setPenyegaran] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const tambahRef = useRef<HTMLButtonElement>(null);
  const daftar = query.data?.lahan ?? [];
  useEffect(() => {
    if (!aktif) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") setPenyegaran((value) => value + 1); }, 60_000);
    return () => clearInterval(timer);
  }, [aktif]);
  function tutupForm() { setFormTerbuka(false); tambahRef.current?.focus(); }
  async function cobaContoh() {
    setSibuk(true); setGalat("");
    try { await requestApi("lahan/contoh", "{}"); query.retry(); }
    catch (error) { setGalat(error instanceof Error ? error.message : "Lahan contoh belum bisa dimuat."); }
    finally { setSibuk(false); }
  }
  return <div>
    <section className="farm-hero" aria-label="Ringkasan lahan">
      <div><p className="light-eyebrow"><Sprout size={18}/> RUANG KENDALI PEMILIK LAHAN</p><h1>Lahan Anda,<br/>lebih terpantau.</h1><p>Lihat keadaan tiap lahan, lalu tentukan langkah berikutnya.</p><span className="owner-tag">{pengguna.nama} · •••• {pengguna.nomorHp.slice(-4)}</span></div>
      <div className="farm-summary"><div><MapPinned size={21}/><strong>{daftar.length}</strong><span>Lahan tersimpan</span></div><div><Sprout size={21}/><strong>{formatQuantity(daftar.reduce((total, item) => total + item.luasHektare, 0))}</strong><span>Total hektare</span></div></div>
    </section>
    <div className="farm-toolbar"><div><h2>Semua lahan saya</h2><p>{daftar.length ? "Pilih lahan untuk melihat rencana tanamnya." : "Mulai dari lahan pertama Anda."}</p></div><div className="flex flex-wrap gap-3"><button type="button" className="reset-button" onClick={() => setPenyegaran((value) => value + 1)}><RefreshCw size={19}/>Perbarui cuaca</button><button ref={tambahRef} type="button" className="primary-button" onClick={() => setFormTerbuka(true)}><Plus size={21}/>Tambah lahan</button></div></div>
    {formTerbuka && <FormLahan catalog={catalog} onBatal={tutupForm} onSelesai={() => { tutupForm(); query.retry(); }}/>}
    <p className="weather-source-note"><CloudSun size={20}/><span><strong>Cuaca masih simulasi.</strong> Setiap kartu memakai koordinat lahannya sendiri. Diperbarui otomatis tiap menit saat halaman aktif.</span></p>
    {query.loading ? <p role="status" className="surface p-6">Sedang memuat lahan Anda…</p> : query.error ? <div className="surface p-6"><p role="alert" className="error-message">{query.error}</p><button type="button" className="primary-button mt-4" onClick={query.retry}>Muat ulang lahan</button></div> : daftar.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{daftar.map((lahan) => <KartuLahan key={lahan.id} lahan={lahan} tanaman={catalog.seeds.find((seed) => seed.id === lahan.seedId)?.crop ?? "Tanaman"} penyegaran={penyegaran} onBuka={onBukaLahan}/>)}</div> : <section className="surface empty-farms"><MapPinned size={43}/><h2>Belum ada lahan tersimpan.</h2><p>Tambahkan lahan Anda, atau coba tampilan dengan tiga lahan contoh di Garut, Subang, dan Lembang.</p><button type="button" className="primary-button" disabled={sibuk} onClick={cobaContoh}>{sibuk ? "Menyiapkan lahan…" : "Coba dengan 3 lahan contoh"}<ArrowRight size={20}/></button>{galat && <p role="alert" className="error-message mt-4">{galat}</p>}</section>}
  </div>;
}
